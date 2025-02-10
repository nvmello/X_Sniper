import { connect, StringCodec } from "nats";
import { ray_swap } from "./ray_swap";
import { jup_swap } from "./jup_swap";

interface TransactionData {
  address: string;
  amount: number;
}

let slipAmount = 0.2;
let tipAmount = 0.2;

async function startSwapHandler() {
  const nc = await connect({
    servers: "nats://127.0.0.1:4222",
    token: "QAkF884gXdP9dXk",
  });
  const sc = StringCodec();

  // Create subscriptions
  const txData = nc.subscribe("tx.data");
  const slip = nc.subscribe("tx.slippage");
  const tip = nc.subscribe("tx.tip");

  console.log("🚀 Swap handler started, listening for new contracts...");

  // Handle all subscriptions concurrently
  await Promise.all([
    // Handle tip messages
    (async () => {
      for await (const msg of tip) {
        tipAmount = msg.data[0];
        console.log(`📥 Received new tip amount: ${tipAmount} 💸💸💸`);
      }
    })(),

    // Handle slippage messages
    (async () => {
      for await (const msg of slip) {
        slipAmount = msg.data[0];
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
            await ray_swap(address, amount, slipAmount, tipAmount);
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
