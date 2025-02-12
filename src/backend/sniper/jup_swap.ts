import { VersionedTransaction } from "@solana/web3.js";
import fetch from "cross-fetch";
import { env_config } from "./config";
const { owner, connection } = env_config;

export async function jup_swap(
  outputMint: string,
  amount: number,
  slippage: number,
  tip: number
) {
  try {
    const inputMint = "So11111111111111111111111111111111111111112";

    const amount = 1_000_000;
    const slippageBps = 50;
    console.log(
      `Swapping ${amount} lamports from ${inputMint} to ${outputMint}...`
    );
    console.log("Fetching quote...");

    const quoteUrl = new URL("https://quote-api.jup.ag/v6/quote");
    quoteUrl.searchParams.append("inputMint", inputMint);
    quoteUrl.searchParams.append("outputMint", outputMint.toString());
    quoteUrl.searchParams.append("amount", amount.toString());
    quoteUrl.searchParams.append("slippageBps", slippageBps.toString());

    const quoteResponse = await (await fetch(quoteUrl.toString())).json();
    console.log("Quote response:", quoteResponse);

    console.log("Fetching swap transaction...");
    const swapResponse = await fetch("https://quote-api.jup.ag/v6/swap", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey: owner.publicKey.toString(),
        wrapAndUnwrapSol: true,
      }),
    });

    if (!swapResponse.ok) {
      throw new Error(`Swap API error: ${await swapResponse.text()}`);
    }

    const swapData = await swapResponse.json();
    console.log("Swap response:", swapData);

    if (!swapData.swapTransaction) {
      throw new Error("No swap transaction returned");
    }

    // Get latest blockhash BEFORE deserializing
    const latestBlockHash = await connection.getLatestBlockhash("confirmed");

    const swapTransactionBuf = Buffer.from(swapData.swapTransaction, "base64");
    var transaction = VersionedTransaction.deserialize(swapTransactionBuf);

    transaction.sign([owner]);

    console.log("Sending transaction...");
    const txid = await connection.sendTransaction(transaction, {
      skipPreflight: true,
      maxRetries: 2,
      preflightCommitment: "confirmed",
    });

    console.log(`Transaction sent with ID: ${txid}`);
    console.log("Waiting for confirmation...");

    try {
      const confirmation = await connection.confirmTransaction(
        {
          signature: txid,
          blockhash: latestBlockHash.blockhash,
          lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        },
        "confirmed"
      );

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));

      console.log(
        `Transaction successful! View at: https://solscan.io/tx/${txid}`
      );
      return txid;
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error("Transaction confirmation failed:", err.message);
        throw new Error(`Transaction failed to confirm: ${err.message}`);
      } else {
        console.error("Transaction confirmation failed with unknown error");
        throw new Error("Transaction failed to confirm with unknown error");
      }
    }
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error("Error in swap function:", err.message);
      throw err;
    } else {
      console.error("Unknown error in swap function");
      throw new Error("Unknown error in swap function");
    }
  }
}
