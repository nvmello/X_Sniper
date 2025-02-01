// src/config/env.ts
import dotenv from "dotenv";
import path from "path";
import { Connection, Keypair } from "@solana/web3.js";
import bs58 from "bs58";

dotenv.config({ path: path.join(process.cwd(), ".env") });

// Validate all environment variables once
const requiredEnvVars = ["PRIVATE_KEY", "RPC"] as const;

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Export validated values
export const env_config = {
  owner: Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY!)),
  connection: new Connection(process.env.RPC!),
} as const;
