import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect } from "react";

interface WalletData {
  walletId: string;
  balance: number;
}

const ControlPanel: React.FC = () => {
  const [sniperStarted, setSniperStarted] = useState<boolean>(false);
  const [scraperStarted, setScraperStarted] = useState<boolean>(false);
  const [privateKey, setPrivateKey] = useState<string>("");
  const [slippage, setSlippage] = useState<number>(5);
  const [tip, setTip] = useState<number>(0.02);
  const [walletId, setWalletId] = useState<string>("");
  const [balance, setBalance] = useState<number>(0);

  // Function to handle wallet connection
  const handleConnect = async (): Promise<void> => {};

  // Function to fetch wallet data (to be implemented with your database)
  const fetchWalletData = async (): Promise<void> => {};

  const handleSlippageChange = async (value: number): Promise<void> => {
    setSlippage(value);
    try {
      await invoke("send_message", {
        subject: "tx.slippage",
        payload: slippage,
      });
    } catch (error) {
      console.error("Failed to update slippage:", error);
    }
  };

  const handleTipChange = async (value: number): Promise<void> => {
    setTip(value);
    try {
      await invoke("send_message", {
        subject: "tx.tip",
        payload: tip,
      });
    } catch (error) {
      console.error("Failed to update tip:", error);
    }
  };

  const runStartSniper = async (): Promise<void> => {
    console.log("Attempting to start sniper");
    try {
      await invoke("start_sniper");
      console.log("Successfully started Sniper");
      setSniperStarted(true);
    } catch (error) {
      console.error("Failed to start sniper:", error);
    }

    console.log("Attempting to start scraper");
    try {
      await invoke("start_scraper");
      console.log("Successfully started Scraper");
      setScraperStarted(true);
    } catch (error) {
      console.error("Failed to start scraper:", error);
    }
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
      {/* Private Key Section */}
      <div className="flex flex-col space-y-4 mb-6">
        <div className="flex items-center space-x-4">
          <h1 className="text-white whitespace-nowrap">Private Key:</h1>
          <input
            className="flex-1 py-2 px-4 rounded bg-gray-700 text-white"
            type="password"
            value={privateKey}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setPrivateKey(e.target.value)
            }
            placeholder="Enter your private key"
          />
          <button
            onClick={handleConnect}
            className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-2 px-6 rounded"
          >
            Connect
          </button>
        </div>
      </div>

      {/* Wallet Info Section */}
      <div className="grid grid-cols-2 gap-4 mb-6 bg-gray-700 p-4 rounded">
        <div className="flex justify-center items-center">
          <h1 className="text-lg text-white break-all">
            Wallet: {walletId || "Not Connected"}
          </h1>
        </div>
        <div className="flex justify-center items-center">
          <h1 className="text-lg text-white">
            Balance: {balance ? `${balance} Sol` : "0 Sol"}
          </h1>
        </div>
      </div>

      {/* Controls Section */}
      <div className="grid grid-cols-3 gap-6">
        {/* Slippage Control */}
        <div className="flex flex-col items-center space-y-2">
          <label className="text-white text-sm font-medium">Slippage</label>
          <input
            type="range"
            min="0.1"
            max="50"
            step="0.1"
            value={slippage}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handleSlippageChange(parseFloat(e.target.value))
            }
            className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-700"
          />
          <span className="text-white">{slippage}%</span>
        </div>

        {/* Tip Control */}
        <div className="flex flex-col items-center space-y-2">
          <label className="text-white text-sm font-medium">Tip</label>
          <input
            type="range"
            min="0.01"
            max="1"
            step="0.01"
            value={tip}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handleTipChange(parseFloat(e.target.value))
            }
            className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-700"
          />
          <span className="text-white">{tip} Sol</span>
        </div>

        {/* Start Button */}
        <div className="flex items-center justify-center">
          <button
            onClick={runStartSniper}
            className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded"
          >
            {sniperStarted ? "Running..." : "Start Sniper"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
