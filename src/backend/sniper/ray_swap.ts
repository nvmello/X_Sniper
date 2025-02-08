/**
 * https://docs.raydium.io/raydium/traders/trade-api
 */
import {
  Transaction,
  VersionedTransaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import axios from "axios";
// import { connection, owner, fetchTokenAccountData } from "../config";
import { API_URLS } from "@raydium-io/raydium-sdk-v2";
import { env_config } from "./config";

const { owner, connection } = env_config;
const inputMint = "So11111111111111111111111111111111111111112";

const amount = 100000;
const slippage = 1;
const txVersion = "V0";
const isInputSol = true;
const isOutputSol = false;
const isV0Tx = true;

export async function ray_swap(outputMint: string) {
  // get statistical transaction fee from API
  /**
   * vh: very high
   * h: high
   * m: medium
   */
  const { data } = await axios.get<{
    id: string;
    success: boolean;
    data: { default: { vh: number; h: number; m: number } };
  }>(`${API_URLS.BASE_HOST}${API_URLS.PRIORITY_FEE}`);
  const priorityFee = 100000; //option to set priorityfee manually

  //fetch quote
  const { data: swapResponse } = await axios.get<any>(
    `${
      API_URLS.SWAP_HOST
    }/compute/swap-base-in?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${
      slippage * 100
    }&txVersion=${txVersion}`
  ); // Use the URL xxx/swap-base-in or xxx/swap-base-out to define the swap type.

  //fetch transaction
  const { data: swapTransactions } = await axios.post<{
    id: string;
    version: string;
    success: boolean;
    data: { transaction: string }[];
  }>(`${API_URLS.SWAP_HOST}/transaction/swap-base-in`, {
    computeUnitPriceMicroLamports: String(data.data.default.h),
    swapResponse,
    txVersion,
    wallet: owner.publicKey.toBase58(),
    wrapSol: isInputSol,
    unwrapSol: isOutputSol, // true means output mint receive sol, false means output mint received wsol
    // inputAccount: isInputSol ? undefined : inputTokenAcc?.toBase58(),
    // outputAccount: isOutputSol ? undefined : outputTokenAcc?.toBase58(),
  });

  const allTxBuf = swapTransactions.data.map((tx) =>
    Buffer.from(tx.transaction, "base64")
  );
  const allTransactions = allTxBuf.map((txBuf) =>
    isV0Tx ? VersionedTransaction.deserialize(txBuf) : Transaction.from(txBuf)
  );

  console.log(`total ${allTransactions.length} transactions`, swapTransactions);

  let idx = 0;
  if (!isV0Tx) {
    for (const tx of allTransactions) {
      console.log(`${++idx} transaction sending...`);
      const transaction = tx as Transaction;
      transaction.sign(owner);
      const txId = await sendAndConfirmTransaction(
        connection,
        transaction,
        [owner],
        { skipPreflight: true }
      );
      console.log(`${++idx} transaction confirmed, txId: ${txId}`);
    }
  } else {
    for (const tx of allTransactions) {
      idx++;
      const transaction = tx as VersionedTransaction;
      transaction.sign([owner]);
      const txId = await connection.sendTransaction(
        tx as VersionedTransaction,
        { skipPreflight: true }
      );
      const { lastValidBlockHeight, blockhash } =
        await connection.getLatestBlockhash({
          commitment: "finalized",
        });
      console.log(`${idx} transaction sending..., txId: ${txId}`);
      //   await connection.confirmTransaction(
      //     {
      //       blockhash,
      //       lastValidBlockHeight,
      //       signature: txId,
      //     },
      //     "confirmed"
      //   );
      console.log(`${idx} transaction confirmed`);
      console.log("🔍 https://solscan.io/tx/" + txId);
      console.log(process.cwd());
    }
  }
}
