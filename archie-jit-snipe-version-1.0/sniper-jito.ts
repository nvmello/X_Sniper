import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import chalk from "chalk";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  ParsedAccountData,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";

import {
  Liquidity,
  LiquidityPoolKeysV4,
  TokenAmount,
} from "@raydium-io/raydium-sdk";
import BN, { min } from "bn.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createAssociatedTokenAccountInstruction,
  createCloseAccountInstruction,
  createSyncNativeInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  getMint,
} from "@solana/spl-token";
import {
  checkSolBalance,
  getPoolKeysFromMarketId,
  getRandomJitoTipAccount,
  logErrorToFile,
  rugCheck,
  sleep,
  storeData,
} from "./utils";
import base58 from "bs58";
import {
  BUY_AMOUNT_SOL,
  DEFAULT_TOKEN,
  ENABLE_ONGOING_SUPPORT_FEE,
  ENABLE_RUG_CHECKS,
  JITO_ENDPOINTS,
  JITO_TIP_AMOUNT,
  MAX_BUY_RETRIES,
  MAX_SINGLE_OWNER_PERCENTAGE,
  MAX_SOL_LP,
  MAX_TOKEN_CREATOR_PERCENTAGE,
  MAX_TOP10_HOLDERS_PERCENTAGE,
  MIN_SOL_LP,
  MIN_SOL_REQUIRED,
  MIN_TOKEN_LP_PERCENTAGE,
  PENDING_SNIPE_LIST_REFRESH_INTERVAL,
  USE_PENDING_SNIPE_LIST,
  logger,
  rayFee,
  sniperSupportFeeAddress,
  sniperWallet,
  solanaConnection,
} from "./constants";
import axios, { AxiosError } from "axios";
import { sniper_bot_settings } from "./sniper_configs";
import { PoolDatabase } from "./poolDb";
import Database from "better-sqlite3";

dotenv.config();

/**storage */
const newDataPath = path.join(__dirname, "sniper_data", "bought_tokens.json");

const pendingSnipesListLocation = path.join(
  __dirname,
  "pending-snipe-list.txt"
);

// create pools database
const poolDb = PoolDatabase.getInstance();

const seenSignatures = new Set<string>();

let pendingSnipeList: string[] = [];

async function monitorNewTokens(connection: Connection, sniperWallet: Keypair) {
  logConfigurations();

  // Set up file watcher for the pending-snipe-list.txt
  fs.watch(pendingSnipesListLocation, async (eventType, filename) => {
    if (eventType === "change") {
      await checkPendingSnipeList(connection, sniperWallet);
    }
  });

  try {
    connection.onLogs(
      rayFee,
      async ({ logs, err, signature }) => {
        try {
          if (err || seenSignatures.has(signature)) {
            return;
          }

          logger.info(`Found new token signature: ${signature}`);

          const parsedTransaction = await connection.getParsedTransaction(
            signature,
            {
              maxSupportedTransactionVersion: 0,
              commitment: "confirmed",
            }
          );

          if (parsedTransaction?.meta.err != null) {
            return;
          }

          // Extract pool keys as in original code
          const rayLogMessage = logs.find((log) => log.includes("ray_log"));
          if (!rayLogMessage) return;

          const lastSpaceIndex = rayLogMessage.lastIndexOf(" ");
          const encodedRayLog = rayLogMessage
            .substring(lastSpaceIndex + 1)
            .replace("'", "");
          const logData = Buffer.from(encodedRayLog, "base64");

          if (logData.length === 75) {
            const marketId = new PublicKey(logData.subarray(43, 75));
            logger.info(`Fetching pool keys...`);
            const poolKeys = await getPoolKeysFromMarketId(
              marketId,
              connection
            );

            if (poolKeys) {
              // Store pool info in database
              await poolDb.addPool(poolKeys);
              logger.info(
                `Added pool for token ${poolKeys.baseMint.toString()} to database`
              );
            }
          }

          seenSignatures.add(signature);
        } catch (error) {
          logger.error(`Error in new token listener: ${error}`);
        }
      },
      "confirmed"
    );
  } catch (error) {
    logger.error(`Error in lp monitor: ${error}`);
  }
}

async function checkPendingSnipeList(
  connection: Connection,
  sniperWallet: Keypair
) {
  try {
    const addresses = fs
      .readFileSync(pendingSnipesListLocation, "utf-8")
      .split("\n")
      .map((addr) => addr.trim())
      .filter((addr) => addr);

    for (const address of addresses) {
      try {
        // Check if pool exists in database
        const poolKeys = await poolDb.getPoolByBaseMint(address);

        if (poolKeys) {
          logger.info(
            `Found pool for token ${address} in database, attempting to buy...`
          );

          // Perform buy operation
          const txSignature = await buyToken(
            connection,
            sniperWallet,
            poolKeys
          );

          if (txSignature) {
            logger.info(
              `Successfully bought token ${address}. Signature: ${txSignature}`
            );

            // Remove the address from the pending snipe list
            const updatedAddresses = addresses.filter(
              (addr) => addr !== address
            );
            fs.writeFileSync(
              pendingSnipesListLocation,
              updatedAddresses.join("\n")
            );
          }
        } else {
          logger.info(
            `Pool for token ${address} not found in database. Waiting for pool creation...`
          );
        }
      } catch (error) {
        logger.error(`Error processing address ${address}: ${error}`);
      }
    }
  } catch (error) {
    logger.error(`Error checking pending snipe list: ${error}`);
  }
}
monitorNewTokens(solanaConnection, sniperWallet);

async function buyToken(
  connection: Connection,
  sniperWallet: Keypair,
  poolKeys: LiquidityPoolKeysV4
) {
  let baseMint: PublicKey | null = null;
  try {
    baseMint = poolKeys.baseMint;
    //token to send -- sol , token to receive -- base token
    let inputToken = DEFAULT_TOKEN.WSOL;

    let inputTokenAmount = new TokenAmount(
      inputToken,
      BUY_AMOUNT_SOL * LAMPORTS_PER_SOL
    );

    const wsolAccountAddress = getAssociatedTokenAddressSync(
      DEFAULT_TOKEN.WSOL.mint, // token address
      sniperWallet.publicKey // owner,
    );

    const tokenAccountAddress = getAssociatedTokenAddressSync(
      baseMint,
      sniperWallet.publicKey
    );

    let transactionIx: TransactionInstruction[] = [];

    transactionIx = [
      ComputeBudgetProgram.setComputeUnitLimit({
        units: sniper_bot_settings.buy_compute_limit,
      }),
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: sniper_bot_settings.buy_unit_price_fee,
      }),
      createAssociatedTokenAccountIdempotentInstruction(
        sniperWallet.publicKey,
        wsolAccountAddress,
        sniperWallet.publicKey,
        inputToken.mint
      ),
      SystemProgram.transfer({
        fromPubkey: sniperWallet.publicKey,
        toPubkey: wsolAccountAddress,
        lamports: inputTokenAmount.raw,
      }),
      // sync wrapped SOL balance
      createSyncNativeInstruction(wsolAccountAddress),
      createAssociatedTokenAccountIdempotentInstruction(
        sniperWallet.publicKey,
        tokenAccountAddress,
        sniperWallet.publicKey,
        baseMint
      ),
    ];

    const { innerTransaction, address } = Liquidity.makeSwapFixedInInstruction(
      {
        poolKeys,
        userKeys: {
          owner: sniperWallet.publicKey,
          tokenAccountIn: wsolAccountAddress,
          tokenAccountOut: tokenAccountAddress,
        },
        amountIn: inputTokenAmount.raw,
        minAmountOut: 0,
      },
      poolKeys.version
    );

    transactionIx.push(
      ...innerTransaction.instructions,
      createCloseAccountInstruction(
        wsolAccountAddress,
        sniperWallet.publicKey,
        sniperWallet.publicKey
      ),
      // JITO TIP
      SystemProgram.transfer({
        fromPubkey: sniperWallet.publicKey,
        toPubkey: getRandomJitoTipAccount(),
        lamports: BigInt(JITO_TIP_AMOUNT * LAMPORTS_PER_SOL),
      })
    );

    //OPTIONAL 1% FEE on trade amount for ongoing access to support and sniper bot upgrades/fixes on archie's discord
    if (ENABLE_ONGOING_SUPPORT_FEE) {
      transactionIx.push(
        SystemProgram.transfer({
          fromPubkey: sniperWallet.publicKey,
          toPubkey: new PublicKey(sniperSupportFeeAddress),
          lamports: BigInt(BUY_AMOUNT_SOL * LAMPORTS_PER_SOL * 0.01),
        })
      );
    }

    let { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash({
        commitment: "confirmed",
      });

    let txSignature: string | null = null;

    for (let attempt = 0; attempt < MAX_BUY_RETRIES; attempt++) {
      logger.info(`transaction attempt: ${attempt + 1}`);
      try {
        const messageV0 = new TransactionMessage({
          payerKey: sniperWallet.publicKey,
          recentBlockhash: blockhash,
          instructions: transactionIx,
        }).compileToV0Message();

        const transaction = new VersionedTransaction(messageV0);

        transaction.sign([sniperWallet, ...innerTransaction.signers]);

        logger.info(`||....Attempting transaction for ${baseMint}......||`);

        const signature = transaction.signatures[0];
        txSignature = bs58.encode(signature);

        const rawTransaction = transaction.serialize();

        const encodedTx = bs58.encode(rawTransaction);
        const requests = JITO_ENDPOINTS.map((url) =>
          axios.post(
            url,
            {
              jsonrpc: "2.0",
              id: 1,
              method: "sendTransaction",
              params: [encodedTx],
            },
            {
              headers: {
                "Content-Type": "application/json",
              },
            }
          )
        );

        logger.info(`Transaction sent. Waiting for response...`);
        const results = await Promise.all(
          requests.map((p) => p.catch((e) => e))
        );

        const successfulResults = results.filter(
          (result) => !(result instanceof Error)
        );

        if (successfulResults.length > 0) {
          logger.info(
            `A successful response was found. Confirming transaction...`
          );

          const confirmationStatus = await connection.confirmTransaction(
            {
              signature: txSignature,
              lastValidBlockHeight: lastValidBlockHeight,
              blockhash: blockhash,
            },
            "confirmed"
          );

          if (confirmationStatus.value.err) {
            logger.info(
              {
                mint: baseMint.toString(),
                error: confirmationStatus.value.err,
                signature: txSignature,
              },
              `Failed to confirm transaction (note txn may still land later)...`
            );
            throw new Error(
              `Failed to confirm transaction (note txn may still land later): ${confirmationStatus.value.err}. Signature: ${txSignature}. Mint: ${baseMint}`
            );
          }

          logger.info(
            {
              mint: baseMint.toString(),
              signature: txSignature,
              solscanUrl: `https://solscan.io/tx/${txSignature}`,
            },
            ` ✅ - Successful swap`
          );

          return txSignature;
        } else {
          const errorMessage = `Failed to receive a successful response for txn: ${txSignature} and mint: ${baseMint}.`;
          logger.info(errorMessage);
          throw new Error(errorMessage);
        }
      } catch (error) {
        if (error instanceof AxiosError) {
          logger.trace(
            { error: error.response?.data },
            "Failed to send jito transaction"
          );
        }
        logger.error(`Error whilst sending jito transaction ${error}`);
        if (attempt === MAX_BUY_RETRIES - 1) {
          throw new Error(
            `Error whilst sending jito transaction: ${error}. Mint: ${baseMint}. Signature: ${txSignature}`
          );
        }
        logger.info(`Retrying transaction for mint: ${baseMint}`);
        const {
          blockhash: newBlockhash,
          lastValidBlockHeight: newBlockHeight,
        } = await connection.getLatestBlockhash();

        lastValidBlockHeight = newBlockHeight;
        blockhash = newBlockhash;
      }
    }
  } catch (error) {
    const errorTimestamp = new Date().toISOString();
    const errorMessage = `Error in buy token function. Timestamp: ${errorTimestamp}. Error: ${error}`;
    throw new Error(errorMessage);
  }
}

function fetchPendingSnipeList(): string[] {
  logger.info("Fetching snipe list...");
  try {
    const snipeList = fs
      .readFileSync(pendingSnipesListLocation, "utf-8")
      .split("\n")
      .map((item) => item.trim())
      .filter((item) => item);

    pendingSnipeList = snipeList;

    logger.info(`Snipe list fetched: ${snipeList.length} tokens. 
    Tokens: 
    ${snipeList.join("\n")}
    `);

    return snipeList;
  } catch (error) {
    const errorMessage = `Error fetching snipe list: ${error}`;
    logger.error(errorMessage);
  }
}

function logConfigurations() {
  logger.info("|...CONFIGURATIONS...|");
  logger.info(`Sniper wallet: ${sniperWallet.publicKey.toString()}`);
  logger.info(`Buy amount sol: ${BUY_AMOUNT_SOL}`);
  logger.info(`Jito tip amount sol: ${JITO_TIP_AMOUNT}`);

  if (USE_PENDING_SNIPE_LIST) {
    logger.info(
      `Snipe list enabled. 
      Make sure to put one or more token addresses in 'pending-snipe-list.txt' file `
    );
    logger.info(`rug checks don't apply to snipe list tokens`);
  } else {
    logger.info(`Snipe list disabled`);

    logger.info(`|----RUG CHECKS----|`);
    logger.info(`Minimum sol used to create liquidity pool: ${MIN_SOL_LP}`);
    logger.info(`Max sol used to create liquidity pool: ${MAX_SOL_LP}`);

    logger.info(
      `Token creator max % of total supply held: ${MAX_TOKEN_CREATOR_PERCENTAGE}`
    );
    logger.info(
      `Top 10 holders max % of total supply held: ${MAX_TOP10_HOLDERS_PERCENTAGE}`
    );
    logger.info(
      `Max percentage of token owned by a single holder: ${MAX_SINGLE_OWNER_PERCENTAGE}`
    );
  }

  logger.info(`monitoring new solana tokens...`);
}
