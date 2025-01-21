import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import chalk from "chalk";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import bs58 from "bs58";
import input from "input";

import {
  Liquidity,
  LiquidityPoolKeysV4,
  TokenAmount,
} from "@raydium-io/raydium-sdk";
import BN, { min } from "bn.js";
import {
  checkSolBalance,
  getPoolKeysFromMarketId,
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
  JITO_TIP_AMOUNT,
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
  retrieveEnvVariable,
  sniperSupportFeeAddress,
  sniperWallet,
  solanaConnection,
} from "./constants";
import { StringSession } from "telegram/sessions";
import { TelegramClient } from "telegram";
import { NewMessage, NewMessageEvent } from "telegram/events";

dotenv.config();

const tgApiId = parseInt(retrieveEnvVariable("TG_API_ID", logger), 10);
const tgApiHash = retrieveEnvVariable("TG_API_HASH", logger);
const tgSessionId = process.env.TG_SESSION_ID || "";
const tgBotUsername = retrieveEnvVariable("TG_BOT_USERNAME", logger);

/**storage */
const newDataPath = path.join(__dirname, "sniper_data", "bought_tokens.json");
const pendingSnipesListLocation = path.join(
  __dirname,
  "pending-snipe-list.txt"
);

const seenSignatures = new Set<string>();

let pendingSnipeList: string[] = [];

const botUsername = tgBotUsername;

const stringSession = new StringSession(tgSessionId); // fill this later with the value from session.save()

const client = new TelegramClient(stringSession, tgApiId, tgApiHash, {
  connectionRetries: 5,
  autoReconnect: true,
  retryDelay: 1000,
});

async function monitorNewTokens(connection: Connection) {
  await startTelegramClient();

  const bot = await client.getEntity(botUsername);

  const botId = bot.id;

  client.addEventHandler(
    (update: NewMessageEvent) => {
      const message = update.message.text;

      if (update.message.senderId.toString() === botId.toString()) {
        logger.info(`New message from bot: ${message}`);
      }
    },
    new NewMessage({
      chats: [botId, "me"],
    })
  );

  logConfigurations();

  //periodically check if token is in snipe list
  if (USE_PENDING_SNIPE_LIST) {
    setInterval(async () => {
      fetchPendingSnipeList();
    }, PENDING_SNIPE_LIST_REFRESH_INTERVAL);
  }

  try {
    connection.onLogs(
      rayFee,
      async ({ logs, err, signature }) => {
        try {
          const websocketRecievedTimestamp = new Date().toISOString();

          if (err) {
            return;
          }
          if (seenSignatures.has(signature)) {
            return;
          }

          logger.info(`found new token signature: ${signature}`);

          let signer = "";
          let poolKeys: LiquidityPoolKeysV4;
          let initquoteLPAmount;
          let openTime;
          let initTokenAmount;

          /**You need to use a RPC provider for getparsedtransaction to work properly.
           * Check README.md for suggestions.
           */
          const parsedTransaction = await connection.getParsedTransaction(
            signature,
            {
              maxSupportedTransactionVersion: 0,
              commitment: "confirmed",
            }
          );

          if (parsedTransaction && parsedTransaction?.meta.err == null) {
            logger.info(
              `successfully parsed transaction for signature: ${signature}`
            );

            signer =
              parsedTransaction?.transaction.message.accountKeys[0].pubkey.toString();

            /**extract pool keys */
            const rayLogMessage = logs.find((log) => log.includes("ray_log"));

            const initLpLog = logs.find((log) =>
              log.includes("Program log: initialize2: InitializeInstruction2")
            );

            const lastSpaceIndex = rayLogMessage.lastIndexOf(" ");
            const encodedRayLog = rayLogMessage
              .substring(lastSpaceIndex + 1)
              .replace("'", "");
            const logData = Buffer.from(encodedRayLog, "base64");

            if (logData.length === 75) {
              const marketId = new PublicKey(logData.subarray(43, 75));
              logger.info(`fetching pool keys...`);
              poolKeys = await getPoolKeysFromMarketId(marketId, connection);
            }

            if (!poolKeys) {
              throw new Error(
                `unable to extract poolkeys for signature: ${signature}`
              );
            }

            //check if token is in snipe list
            if (USE_PENDING_SNIPE_LIST) {
              if (pendingSnipeList.includes(poolKeys.baseMint.toString())) {
                logger.info(
                  `Found token ${poolKeys.baseMint.toString()} in pending snipe list.`
                );
              } else {
                logger.info(
                  `Skipping token ${poolKeys.baseMint.toString()}. Not in pending snipe list.`
                );
                return;
              }
            }

            if (initLpLog) {
              const initPcAmountMatch = initLpLog.match(
                /init_pc_amount: (\d+)/
              );

              const initCoinAmountMatch = initLpLog.match(
                /init_coin_amount: (\d+)/
              );
              const openTimeMatch = initLpLog.match(/open_time: (\d+)/);

              if (initPcAmountMatch) {
                initquoteLPAmount = new BN(initPcAmountMatch[1]); // The first group in the regex
              }

              if (initCoinAmountMatch) {
                initTokenAmount = new BN(initCoinAmountMatch[1]); // The first group in the regex
              }

              if (openTimeMatch) {
                openTime = parseInt(openTimeMatch[1], 10);
              }
            }

            //check if quotelpamount is in wrong order
            if (
              initquoteLPAmount &&
              initTokenAmount &&
              initquoteLPAmount.gt(initTokenAmount)
            ) {
              let temp = initquoteLPAmount;
              initquoteLPAmount = initTokenAmount;
              initTokenAmount = temp;
            }

            const initPoolBlockTime = parsedTransaction?.blockTime;

            const websocketReceivedTime = new Date(
              websocketRecievedTimestamp
            ).getTime();

            if (openTime > websocketReceivedTime) {
              logger.info(
                `Open time of pool ${openTime} is later than websocket received time ${websocketReceivedTime} for mint: ${poolKeys.baseMint}. Exiting the function.`
              );
              return;
            }

            let initQuoteTokenAmount: BN = new BN(0);

            let initBaseTokenAmount: BN = new BN(0);

            if (ENABLE_RUG_CHECKS) {
              if (initquoteLPAmount) {
                initQuoteTokenAmount = initquoteLPAmount.div(
                  new BN(Math.pow(10, poolKeys.quoteDecimals as number))
                );

                if (initQuoteTokenAmount.lt(new BN(MIN_SOL_LP))) {
                  logger.info(
                    `Skipping token ${poolKeys.baseMint}. LP was created with ${initQuoteTokenAmount} sol, which is less than min required ${MIN_SOL_LP} sol.`
                  );
                  return;
                }

                if (initQuoteTokenAmount.gt(new BN(MAX_SOL_LP))) {
                  logger.info(
                    `Skipping token ${poolKeys.baseMint}. LP was created with ${initQuoteTokenAmount} sol, which is greater than max required ${MAX_SOL_LP} sol.`
                  );
                  return;
                }
              }

              if (initTokenAmount) {
                initBaseTokenAmount = initTokenAmount
                  .div(new BN(Math.pow(10, poolKeys.baseDecimals as number)))
                  .toNumber();

                const totalSupply =
                  (await connection.getTokenSupply(poolKeys.baseMint)).value
                    .uiAmount ?? 0;

                if (totalSupply) {
                  //check ratio of initial lp token amount to total supply
                  const initTokenSupplyPercentage =
                    (initBaseTokenAmount / totalSupply) * 100;

                  if (initTokenSupplyPercentage < MIN_TOKEN_LP_PERCENTAGE) {
                    logger.info(
                      `Skipping token ${poolKeys.baseMint}. Token supply % added to LP ${initTokenSupplyPercentage} is less then MIN_TOKEN_LP_PERCENTAGE: ${MIN_TOKEN_LP_PERCENTAGE}`
                    );
                    return;
                  }
                }
              }
              const dangerousToken = await rugCheck(
                connection,
                poolKeys.baseMint.toString(),
                signer
              );

              if (dangerousToken) {
                logger.info(
                  `Rug check found that token ${poolKeys.baseMint.toString()} is dangerous. Skipping token...`
                );
                return;
              }
            } else {
              logger.info(
                `Rug check is disabled. Skipping rug check for token ${poolKeys.baseMint.toString()}.`
              );
            }

            const response = await client.sendMessage(botUsername, {
              message: poolKeys.baseMint.toString(),
            });

            logger.info(
              `token addres sent to tg bot for auto buy: ${poolKeys.baseMint}...`
            );

            //log signature saved
            seenSignatures.add(signature);

            const websocketCompletionTimestamp = new Date().toISOString();

            const websocketStartTime =
              new Date(websocketRecievedTimestamp).getTime() / 1000;

            const websocketEndTime =
              new Date(websocketCompletionTimestamp).getTime() / 1000;

            const newTokenData = {
              lpSignature: signature,
              websocketReceivedTimestamp: websocketRecievedTimestamp,
              lpCreator: signer,
              websocketCompletionSeconds: websocketEndTime - websocketStartTime,
              websocketCompletionTimestamp,
              baseTokenAddress: poolKeys.baseMint.toString() ?? "",
              quoteTokenAddress: poolKeys.quoteMint.toString() ?? "",
              poolAddress: poolKeys.id.toString() ?? "",
              initPoolOpenTime: new Date(openTime * 1000).toISOString() ?? null,
              initQuoteTokenAmount: initQuoteTokenAmount.toString() ?? null,
              initBaseTokenAmount: initBaseTokenAmount.toString() ?? null,
            };

            //store new tokens data in data folder
            await storeData(newDataPath, newTokenData);
          }
        } catch (error) {
          const timestamp = new Date().toISOString();
          const errorMessage = `Error in new token listener at ${timestamp}: ${error}.`; // Save error logs to a separate file
          logger.error(error);
          logErrorToFile(errorMessage, "errorNewLpsLogs.txt");
        }
      },
      "confirmed"
    );
  } catch (error) {
    const timestamp = new Date().toISOString();
    const errorMessage = `Error in lp monitor at ${timestamp}: ${error}.`;
    logErrorToFile(errorMessage, "errorNewLpsLogs.txt");
  }
}

monitorNewTokens(solanaConnection);

function fetchPendingSnipeList(): string[] {
  logger.info("Fetching snipe list...");
  try {
    const snipeList = fs
      .readFileSync(pendingSnipesListLocation, "utf-8")
      .split("\n")
      .map((item) => item.trim())
      .filter((item) => item);

    logger.info(`Snipe list fetched: ${snipeList.length} tokens`);

    pendingSnipeList = snipeList;

    return snipeList;
  } catch (error) {
    const errorMessage = `Error fetching snipe list: ${error}`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }
}

function logConfigurations() {
  logger.info("|...CONFIGURATIONS...|");
  logger.info(`Buy amount sol: ${BUY_AMOUNT_SOL}`);

  if (USE_PENDING_SNIPE_LIST) {
    logger.info(
      `Snipe list enabled. 
        Make sure to put one or more token addresses in 'pending-sniper-list.txt' file `
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

async function startTelegramClient() {
  logger.info("starting telegram client...");
  await client.start({
    phoneNumber: async () => await input.text("Please enter your number: "),
    password: async () => await input.text("Please enter your password: "),
    phoneCode: async () =>
      await input.text("Please enter the code you received: "),
    onError: (err) => console.log(err),
  });
  logger.info("You should now be connected.");
  if (tgSessionId == "") {
    logger.info(
      "Store this value in .env as TELEGRAM_SESSION_ID to avoid logging in again"
    );
    logger.info(client.session.save()); // Save this string to avoid logging in again
  }
}
