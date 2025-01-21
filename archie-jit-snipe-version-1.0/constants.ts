import { TOKEN_PROGRAM_ID, Token } from '@raydium-io/raydium-sdk';
import { getKeypairFromEnvironment } from '@solana-developers/node-helpers';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import dotenv from 'dotenv';
import pino from 'pino';
dotenv.config();

const transport = pino.transport({
  target: 'pino-pretty',
});

export const logger = pino(
  {
    level: 'info',
    serializers: {
      error: pino.stdSerializers.err,
    },
    base: undefined,
  },
  transport
);

export function getKeypairSafely(variableName, logger) {
  try {
    return getKeypairFromEnvironment(variableName);
  } catch (error) {
    logger.error(`${variableName} secret key is not set in your .env file!`);
    return null;
  }
}

export const retrieveEnvVariable = (variableName: string, logger) => {
  const variable = process.env[variableName] || '';
  if (!variable) {
    logger.error(`${variableName} is not set in your .env file`);
    process.exit(1);
  }
  return variable;
};

//wallets
export const sniperWallet = getKeypairFromEnvironment('SNIPER_SECRET_KEY');

//connections
const RPC_ENDPOINT = retrieveEnvVariable('RPC_ENDPOINT', logger);
const RPC_WEBSOCKET_ENDPOINT = retrieveEnvVariable(
  'RPC_WEBSOCKET_ENDPOINT',
  logger
);

export const solanaConnection = new Connection(RPC_ENDPOINT, {
  wsEndpoint: RPC_WEBSOCKET_ENDPOINT,
  commitment: 'confirmed',
});

//buy settings
export const BUY_AMOUNT_SOL = parseFloat(
  retrieveEnvVariable('BUY_AMOUNT_SOL', logger)
);
export const JITO_TIP_AMOUNT = parseFloat(
  retrieveEnvVariable('JITO_TIP_AMOUNT', logger)
);

// minimum sol in your wallet to run the sniper bot
export const MIN_SOL_REQUIRED = parseFloat(
  retrieveEnvVariable('MIN_SOL_REQUIRED', logger)
);

//rug check filters
export const MIN_SOL_LP = parseFloat(retrieveEnvVariable('MIN_SOL_LP', logger));
export const MAX_SOL_LP = parseFloat(retrieveEnvVariable('MAX_SOL_LP', logger));
export const MAX_TOKEN_CREATOR_PERCENTAGE = parseInt(
  retrieveEnvVariable('MAX_TOKEN_CREATOR_PERCENTAGE', logger),
  10
);
export const MAX_TOP10_HOLDERS_PERCENTAGE = parseInt(
  retrieveEnvVariable('MAX_TOP10_HOLDERS_PERCENTAGE', logger),
  10
);

export const MIN_TOKEN_LP_PERCENTAGE = parseInt(
  retrieveEnvVariable('MIN_TOKEN_LP_PERCENTAGE', logger),
  10
);

//snipe list filters
export const USE_PENDING_SNIPE_LIST =
  retrieveEnvVariable('USE_SNIPE_LIST', logger) === 'true';
export const PENDING_SNIPE_LIST_REFRESH_INTERVAL = parseInt(
  retrieveEnvVariable('SNIPE_LIST_REFRESH_INTERVAL', logger),
  10
);
export const MAX_BUY_RETRIES = parseInt(
  retrieveEnvVariable('MAX_BUY_RETRIES', logger),
  10
);

export const MAX_SINGLE_OWNER_PERCENTAGE = parseInt(
  retrieveEnvVariable('MAX_SINGLE_OWNER_PERCENTAGE', logger),
  10
);

export const ENABLE_RUG_CHECKS = USE_PENDING_SNIPE_LIST
  ? false
  : retrieveEnvVariable('ENABLE_RUG_CHECKS', logger) !== 'false';

export const rayFee = new PublicKey(
  '7YttLkHDoNj9wyDur5pM1ejNaAvT9X4eqaYcHQqtj2G5'
);

export const rayAccount = new PublicKey(
  '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1'
);

//toggle this to false if you don't want access to the ongoing support, improvements and upgrades to the sniper bot
// disable this if you don't want access to ongoing support, upgrades, and fixes.
export const ENABLE_ONGOING_SUPPORT_FEE = true;

//Address to where 1% fees of each successful trade are paid to get ongoing priority support and upgrades of bot in Archie's discord
export const sniperSupportFeeAddress =
  '5PbYSbeuvbmvcAetGhfVdvcydjkbysF5kXM6Xvtcz4L8';

export const DEFAULT_TOKEN = {
  WSOL: new Token(
    TOKEN_PROGRAM_ID,
    new PublicKey('So11111111111111111111111111111111111111112'),
    9,
    'WSOL',
    'WSOL'
  ),
};

export const jitoTipAccounts = [
  'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
  'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
  '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
  '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
  'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe',
  'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
  'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
  'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
];

export const JITO_ENDPOINTS = [
  'https://mainnet.block-engine.jito.wtf/api/v1/transactions',
  'https://amsterdam.mainnet.block-engine.jito.wtf/api/v1/transactions',
  'https://frankfurt.mainnet.block-engine.jito.wtf/api/v1/transactions',
  'https://ny.mainnet.block-engine.jito.wtf/api/v1/transactions',
  'https://tokyo.mainnet.block-engine.jito.wtf/api/v1/transactions',
];
