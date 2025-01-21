import { VersionedTransaction } from "@solana/web3.js";

export type JitoBundle = {
  accepted: boolean;
  rejections: number;
  errorType: string | null;
  errorContent: string | null;
  landed: boolean;
  bundle: VersionedTransaction;
  signature?: string;
};
