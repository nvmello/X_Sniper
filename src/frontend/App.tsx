import "./App.css";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import Temp from "./components/temp";
import Scrollview from "./components/scrollview";

function App() {
  const [sniperStarted, setSniperStarted] = useState(false);
  const [scraperStarted, setScraperStarted] = useState(false);
  /**
   * This starts the swap scripts
   */
  const runStartSniper = async () => {
    console.log("Attempting to start sniper");
    try {
      await invoke("start_sniper");
      console.log("Successfully started Sniper");
      setSniperStarted(true);
    } catch (error) {
      console.error("Failed to start sniper:", error);
    }
  };

  /**
   * This will start the python scraper script
   */

  const runStartScraper = async () => {
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
    <main className="text-white">
      <button
        onClick={runStartSniper}
        className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded mt-4"
      >
        Start Sniper
      </button>

      <button
        onClick={runStartScraper}
        className="bg-cyan-500 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded mt-4"
      >
        Start Scraper
      </button>
      <Scrollview />
      {/* <Temp /> */}
    </main>
  );
}

export default App;
