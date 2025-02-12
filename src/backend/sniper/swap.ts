import { Connection, Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { connect, StringCodec } from "nats";
import { ray_swap } from "./ray_swap";
import { jup_swap } from "./jup_swap";

interface TransactionData {
  address: string;
  amount: number;
}

let slipAmount: number;
let tipAmount: number;
let privateKey: Keypair;
let rpcConnection: Connection;

async function startSwapHandler() {
  const nc = await connect({
    servers: "nats://127.0.0.1:4222",
    token: "QAkF884gXdP9dXk",
  });
  const sc = StringCodec();

  // Create subscriptions
  const txData = nc.subscribe("tx.data");
  const txSlip = nc.subscribe("tx.slippage");
  const txTip = nc.subscribe("tx.tip");
  const txPrivateKey = nc.subscribe("tx.privatekey");
  const txRPC = nc.subscribe("tx.rpc");

  console.log("🚀 Swap handler started, listening for new contracts...");

  // Handle all subscriptions concurrently
  await Promise.all([
    // Handle private key message
    (async () => {
      for await (const msg of txPrivateKey) {
        let decodePrivateKey = JSON.parse(sc.decode(msg.data));
        console.log(`📥 Received new Private Key: ${decodePrivateKey} 🥷🥷🥷`);
        privateKey = Keypair.fromSecretKey(bs58.decode(decodePrivateKey));
        // console.log(`Keypair from privateKey: ${keypair.publicKey} 🔑🔑🔑`);
      }
    })(),

    // Handle rpc connection
    (async () => {
      for await (const msg of txRPC) {
        const decodedRPC = JSON.parse(sc.decode(msg.data));
        rpcConnection = new Connection(process.env.RPC!);
        console.log(`📥 Received new RPC Connection: ${rpcConnection} 🛜🛜🛜`);
      }
    })(),

    // Handle tip messages
    (async () => {
      for await (const msg of txTip) {
        const tipString = new TextDecoder().decode(msg.data); // Convert Uint8Array to string
        tipAmount = parseFloat(tipString); // Convert string to number
        console.log(`📥 Received new tip amount: ${tipAmount} 💸💸💸`);
      }
    })(),

    // Handle slippage messages
    (async () => {
      for await (const msg of txSlip) {
        const slipString = new TextDecoder().decode(msg.data); // Convert Uint8Array to string
        slipAmount = parseFloat(slipString); // Convert string to number
        console.log(`📥 Received new slippage amount: ${slipAmount} 💦💦💦`);
      }
    })(),

    // Handle transaction data messages
    (async () => {
      for await (const msg of txData) {
        try {
          // Decode and parse the JSON message
          const data: TransactionData = JSON.parse(sc.decode(msg.data));
          const { address, amount } = data;

          console.log(`📥 Received new transaction data:`, data);
          try {
            console.log("🔄 Attempting Raydium swap...");
            await ray_swap(
              privateKey,
              data.address,
              data.amount * 1000000000, //convert sol to lamports
              slipAmount,
              tipAmount,
              rpcConnection
            );
            console.log("💎💎💎💎💎💎 Raydium swap successful! 💎💎💎💎💎💎");
          } catch (rayError) {
            console.log("⚠️ Raydium swap failed, trying Jupiter...");
            console.error("Raydium error:", rayError);

            try {
              await jup_swap(address, amount, slipAmount, tipAmount);
              console.log("💎💎💎💎💎💎 Jupiter swap successful! 💎💎💎💎💎💎");
            } catch (jupError) {
              console.error("❌ Jupiter swap failed:", jupError);
              console.error("❌ Both swaps failed for contract:", address);
            }
          }
        } catch (parseError) {
          console.error("❌ Error parsing transaction data:", parseError);
        }
      }
    })(),
  ]);

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n🛑 Shutting down...");
    await nc.drain();
    process.exit(0);
  });
}

// Start the handler
console.log("🌟 Initializing swap handler...");
startSwapHandler().catch((error) => {
  console.error("💥 Fatal error in swap handler:", error);
  process.exit(1);
});
