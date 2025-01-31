import { VersionedTransaction } from "@solana/web3.js";
import fetch from "cross-fetch";
import { env_config } from "./config";
const { owner, connection } = env_config;

export async function jup_swap(outputMint: string) {
  try {
    const inputMint = "So11111111111111111111111111111111111111112";

    const amount = 1000000;
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

    // Deserialize and process transaction
    const swapTransactionBuf = Buffer.from(swapData.swapTransaction, "base64");
    var transaction = VersionedTransaction.deserialize(swapTransactionBuf);

    // Get latest blockhash BEFORE signing
    const latestBlockHash = await connection.getLatestBlockhash();

    // Sign the transaction
    transaction.sign([owner]);

    // Execute the transaction
    console.log("Sending transaction...");
    const rawTransaction = transaction.serialize();
    const txid = await connection.sendRawTransaction(rawTransaction, {
      skipPreflight: true,
      maxRetries: 2,
    });

    console.log(`Transaction sent with ID: ${txid}`);
    // console.log("Waiting for confirmation...");

    // const confirmationResponse = await connection.confirmTransaction(
    //   {
    //     signature: txid,
    //     blockhash: latestBlockHash.blockhash,
    //     lastValidBlockHeight: swapData.lastValidBlockHeight,
    //   },
    //   "processed"
    // );

    // if (confirmationResponse.value.err) {
    //   throw new Error(`Transaction failed: ${confirmationResponse.value.err}`);
    // }

    console.log(
      `Transaction successful! View at: https://solscan.io/tx/${txid}`
    );
    return txid;
  } catch (error) {
    console.error("Error in swap function:", error);
    throw error;
  }
}
