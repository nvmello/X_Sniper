// swap_handler.ts
import { connect, StringCodec } from "nats";
import { ray_swap } from "./ray_swap";
import { jup_swap } from "./jup_swap";

async function startSwapHandler() {
  // Connect to NATS using the same address as Python
  const nc = await connect({
    servers: "nats://127.0.0.1:4222",
    token: "QAkF884gXdP9dXk",
  });
  const sc = StringCodec();

  // Subscribe to the 'ca' topic to match your Python publisher
  const sub = nc.subscribe("ca");

  console.log("🚀 Swap handler started, listening for new contracts...");

  // Process incoming contracts
  for await (const msg of sub) {
    const contractAddress = sc.decode(msg.data);
    console.log(`📥 Received new contract: ${contractAddress}`);

    try {
      // First try Raydium swap
      console.log("🔄 Attempting Raydium swap...");
      await ray_swap(contractAddress);
      console.log("✅ Raydium swap successful!");
    } catch (rayError) {
      console.log("⚠️ Raydium swap failed, trying Jupiter...");
      console.error("Raydium error:", rayError);

      try {
        // Fallback to Jupiter swap
        await jup_swap(contractAddress);
        console.log("✅ Jupiter swap successful!");
      } catch (jupError) {
        console.error("❌ Jupiter swap failed:", jupError);
        console.error("❌ Both swaps failed for contract:", contractAddress);
      }
    }
  }

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
