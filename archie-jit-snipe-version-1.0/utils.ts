import {
  Connection,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
  Keypair,
  PublicKey,
  ParsedAccountData,
} from "@solana/web3.js";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import {
  ApiPoolInfoV4,
  Currency,
  LIQUIDITY_STATE_LAYOUT_V4,
  Liquidity,
  LiquidityPoolKeys,
  LiquidityPoolKeysV4,
  MAINNET_PROGRAM_ID,
  MARKET_STATE_LAYOUT_V3,
  Market,
  Price,
  WSOL,
  jsonInfo2PoolKeys,
} from "@raydium-io/raydium-sdk";
import { MintLayout, getMint } from "@solana/spl-token";
import pino from "pino";
import { getKeypairFromEnvironment } from "@solana-developers/node-helpers";
import {
  MAX_SINGLE_OWNER_PERCENTAGE,
  MAX_TOKEN_CREATOR_PERCENTAGE,
  MAX_TOP10_HOLDERS_PERCENTAGE,
  jitoTipAccounts,
  logger,
  rayAccount,
} from "./constants";

import dotenv from "dotenv";
dotenv.config();

export async function checkSolBalance(connection, wallet) {
  try {
    const walletBalance = await connection.getBalance(wallet.publicKey);
    const solBalance = walletBalance / LAMPORTS_PER_SOL;
    console.log(`Wallet Balance: ${solBalance}`);
    return solBalance;
  } catch (error) {
    console.error(`unable to fetch sol balance of wallet.`);
  }
}

export const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export async function rugCheck(
  connection: Connection,
  tokenAddress: string,
  creatorAddress: string
): Promise<boolean> {
  try {
    logger.info(`Applying rug filters...`);
    let isDangerous = false;
    const isMintable = await checkMintAndFreezeInfo(connection, tokenAddress);

    if (isMintable) {
      isDangerous = true;
      return isDangerous;
    }

    const tokenSupply = (
      await connection.getTokenSupply(new PublicKey(tokenAddress))
    ).value.uiAmount;

    try {
      const creatorBalance = await getTokenCreatorBalance(
        connection,
        creatorAddress,
        tokenAddress,
        tokenSupply
      );

      const { creatorTokenBalance, tokenPercentageHeldByCreator } =
        creatorBalance;

      if (tokenPercentageHeldByCreator > MAX_TOKEN_CREATOR_PERCENTAGE) {
        logger.info(
          `DANGER! The token creator is holding greater than ${MAX_TOKEN_CREATOR_PERCENTAGE}% of supply. Value: ${tokenPercentageHeldByCreator}%`
        );
        isDangerous = true;
        return isDangerous;
      }
    } catch (error) {
      throw new Error(`unable to fetch token creator balance, ${error}`);
    }

    try {
      const topHolders = await getTokenTopHoldersInfo(
        connection,
        tokenAddress,
        tokenSupply
      );
      const { top10HoldersPercentage, topHoldersInfo } = topHolders;

      if (top10HoldersPercentage > MAX_TOP10_HOLDERS_PERCENTAGE) {
        logger.info(
          `WARNING! The top 10 holders hold more than ${MAX_TOP10_HOLDERS_PERCENTAGE}% of supply`
        );

        isDangerous = true;
        return isDangerous;
      }

      if (topHoldersInfo.length > 0) {
        const topOwner = topHoldersInfo[0];
        logger.info(
          `top owner: ${topOwner.ownerAddress} is holding ${topOwner.percentageOwned}% of supply`
        );

        const excessiveOwnership = topHoldersInfo.some(
          (holder) => holder.percentageOwned > MAX_SINGLE_OWNER_PERCENTAGE
        );

        if (excessiveOwnership) {
          logger.info(
            `DANGER! One or more holders own more than ${MAX_SINGLE_OWNER_PERCENTAGE}% of the total supply.`
          );
          isDangerous = true;
          return isDangerous;
        }
      }
    } catch (error) {
      throw new Error(`unable to fetch token top holders, ${error}`);
    }

    return isDangerous;
  } catch (error) {
    logger.error(`failed to complete rug checks, ${error}`);
    throw new Error(`failed to complete rug checks, ${error}`);
  }
}

export async function getTokenTopHoldersInfo(
  connection: Connection,
  tokenAddress: string,
  tokenSupplyAmount?: number
) {
  console.log(`fetching the token top holders...`);

  try {
    const mint = new PublicKey(tokenAddress);
    const accounts = (await connection.getTokenLargestAccounts(mint)).value;

    if (!accounts) throw new Error(`unable to fetch accounts of top holders`);

    const topHoldersAccounts = accounts
      .filter((a) => a.uiAmount)
      .map((account) => ({
        publicKey: account.address,
        uiAmount: account.uiAmount,
      }));

    const topHoldersPublicKeys = topHoldersAccounts.map(
      (account) => account.publicKey
    );

    const topHoldersParsedAccounts = await connection.getMultipleParsedAccounts(
      topHoldersPublicKeys,
      {
        commitment: "confirmed",
      }
    );

    if (!topHoldersParsedAccounts) {
      throw new Error(`unable to fetch parsed accounts of top holders`);
    }

    const tokenSupply =
      tokenSupplyAmount ??
      (await connection.getTokenSupply(mint)).value.uiAmount;

    const topHolders = topHoldersParsedAccounts.value
      .map((account, index) => ({
        ownerAddress: (account?.data as ParsedAccountData)?.parsed.info.owner,
        uiAmount: topHoldersAccounts[index]?.uiAmount,
        percentageOwned:
          (topHoldersAccounts[index]?.uiAmount / tokenSupply) * 100,
      }))
      .filter((item) => item.ownerAddress !== rayAccount.toString());

    const top10HoldersPercentage = topHolders
      .slice(0, 10)
      .reduce((acc, holder) => acc + holder.percentageOwned, 0);

    console.table(
      topHolders.map((holder) => ({
        "Owner Address": holder.ownerAddress,
        Amount: holder.uiAmount,
        "Ownership (%)": holder.percentageOwned.toFixed(2),
      }))
    );

    logger.info(`top10holders %, ${top10HoldersPercentage}`);

    return { topHoldersInfo: topHolders, top10HoldersPercentage };
  } catch (error) {
    logger.error(`Error fetching token top holders: ${error}`);
    throw new Error(`unable to fetch token top holders, ${error}`);
  }
}

export async function getTokenCreatorBalance(
  connection: Connection,
  creatorAddress: string,
  tokenAddress: string,
  tokenSupplyAmount?: number
): Promise<{
  creatorTokenBalance: number;
  tokenPercentageHeldByCreator: number;
}> {
  logger.info(`fetching token creator balance...`);
  try {
    const mintAddress = new PublicKey(tokenAddress);
    const tokenSupply =
      tokenSupplyAmount ??
      (await connection.getTokenSupply(mintAddress)).value.uiAmount;

    //get token balance of creator
    const parsedTokenAccount = await connection.getParsedTokenAccountsByOwner(
      new PublicKey(creatorAddress),
      {
        mint: new PublicKey(mintAddress),
        programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"), // SPL Token program id
      }
    );

    if (!parsedTokenAccount?.value[0]) {
      const errorMessage = `token account doesn't exist for creator: ${creatorAddress}.`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    const creatorTokenBalance: number =
      parsedTokenAccount?.value[0].account.data.parsed.info.tokenAmount
        .uiAmount;

    logger.info(`creatorTokenBalance: ${creatorTokenBalance}`);

    const tokenPercentageHeldByCreator =
      (creatorTokenBalance / tokenSupply) * 100;

    logger.info(
      `tokenPercentageHeldByCreator: ${tokenPercentageHeldByCreator}`
    );

    const creatorBalance = {
      creatorTokenBalance,
      tokenPercentageHeldByCreator,
    };

    return creatorBalance;
  } catch (error) {
    throw new Error(`unable to fetch token creator balance, ${error}`);
  }
}

export async function checkMintAndFreezeInfo(
  connection: Connection,
  tokenAddress: string
): Promise<boolean> {
  logger.info(`checking if token is mintable or freezable`);

  try {
    let mintable = false;

    const mintInfo = await getMint(connection, new PublicKey(tokenAddress));

    const isMintable = mintInfo?.mintAuthority !== null;
    const isFreezeable = mintInfo?.freezeAuthority !== null;

    if (isMintable || isFreezeable) {
      logger.info(`token is mintable or freezeable. mint: ${mintInfo.address}`);
      logger.info(`mint authority:${mintInfo?.mintAuthority}}`);

      mintable = true;

      return mintable;
    }

    logger.info(
      `token is not mintable or freezeable. mint: ${mintInfo.address}`
    );

    return mintable;
  } catch (error) {
    throw new Error(`error checking mint authority, ${error}`);
  }
}

export async function getPoolKeysFromMarketId(
  marketId: PublicKey,
  connection: Connection
): Promise<LiquidityPoolKeysV4> {
  logger.info(`searching for pool keys...`);

  try {
    let marketAccount;
    while (true) {
      marketAccount = await connection.getAccountInfo(marketId);
      if (marketAccount) {
        break;
      }
    }

    const marketInfo = MARKET_STATE_LAYOUT_V3.decode(marketAccount.data);

    const poolId = PublicKey.findProgramAddressSync(
      [
        MAINNET_PROGRAM_ID.AmmV4.toBuffer(),
        marketId.toBuffer(),
        Buffer.from("amm_associated_seed", "utf-8"),
      ],
      MAINNET_PROGRAM_ID.AmmV4
    )[0];

    let poolAccount;
    while (true) {
      poolAccount = await connection.getAccountInfo(poolId);
      if (poolAccount) {
        break;
      }
    }

    const poolInfo = LIQUIDITY_STATE_LAYOUT_V4.decode(poolAccount.data);

    if (poolInfo.baseMint.toString() === WSOL.mint) {
      logger.info(`mint is sol, rotating pool keys...`);
      /**rotate  */
      poolInfo.baseMint = poolInfo.quoteMint;
      poolInfo.quoteMint = new PublicKey(WSOL.mint);

      let tempDecimals = poolInfo.baseDecimal;
      poolInfo.baseDecimal = poolInfo.quoteDecimal;
      poolInfo.quoteDecimal = tempDecimals;
      //rotate base and quote vaults
      let tempVault = poolInfo.baseVault;
      poolInfo.baseVault = poolInfo.quoteVault;
      poolInfo.quoteVault = tempVault;

      //rotate market vaults
      let tempMarketVault = marketInfo.baseVault;

      marketInfo.baseVault = marketInfo.quoteVault;
      marketInfo.quoteVault = tempMarketVault;
    }

    if (poolInfo.quoteMint.toString() !== WSOL.mint) {
      logger.info(`quote token is not sol, skipping token `);
      return null;
    }

    return {
      id: poolId,
      baseMint: poolInfo.baseMint,
      quoteMint: poolInfo.quoteMint,
      lpMint: poolInfo.lpMint,
      baseDecimals: poolInfo.baseDecimal.toNumber(),
      quoteDecimals: poolInfo.quoteDecimal.toNumber(),
      lpDecimals: poolInfo.baseDecimal.toNumber(),
      version: 4,
      programId: MAINNET_PROGRAM_ID.AmmV4,
      authority: Liquidity.getAssociatedAuthority({
        programId: poolAccount.owner,
      }).publicKey,
      openOrders: poolInfo.openOrders,
      targetOrders: poolInfo.targetOrders,
      baseVault: poolInfo.baseVault,
      quoteVault: poolInfo.quoteVault,
      withdrawQueue: poolInfo.withdrawQueue,
      lpVault: poolInfo.lpVault,
      marketVersion: 3,
      marketProgramId: MAINNET_PROGRAM_ID.OPENBOOK_MARKET,
      marketId: marketId,
      marketAuthority: Market.getAssociatedAuthority({
        programId: poolInfo.marketProgramId,
        marketId: poolInfo.marketId,
      }).publicKey,
      marketBaseVault: marketInfo.baseVault,
      marketQuoteVault: marketInfo.quoteVault,
      marketBids: marketInfo.bids,
      marketAsks: marketInfo.asks,
      marketEventQueue: marketInfo.eventQueue,
      lookupTableAccount: new PublicKey("11111111111111111111111111111111"),
    };
  } catch (error) {
    throw new Error(`error in getPoolKeysFromMarketId: ${error}`);
  }
}

export function storeData(dataPath: string, newData: any) {
  fs.readFile(dataPath, (err, fileData) => {
    if (err) {
      console.error(`Error reading file: ${err}`);
      return;
    }
    let json;
    try {
      json = JSON.parse(fileData.toString());
    } catch (parseError) {
      console.error(`Error parsing JSON from file: ${parseError}`);
      return;
    }
    json.push(newData);

    fs.writeFile(dataPath, JSON.stringify(json, null, 2), (writeErr) => {
      if (writeErr) {
        console.error(`Error writing file: ${writeErr}`);
      } else {
        console.log(`New token data stored successfully.`);
      }
    });
  });
}

export function getRandomJitoTipAccount(): PublicKey {
  const randomTipAccount =
    jitoTipAccounts[Math.floor(Math.random() * jitoTipAccounts.length)];
  return new PublicKey(randomTipAccount);
}

export function logErrorToFile(errorMessage, fileName) {
  fs.appendFile(fileName, `${errorMessage}\n`, function (err) {
    if (err) console.log(`error writing ${fileName}`, err);
  });
}
