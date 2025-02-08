import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

function Temp() {
  const [sniperStarted, setSniperStarted] = useState(false);
  const [scraperStarted, setScraperStarted] = useState(false);
  const [newUser, setNewUser] = useState<string>("@");

  // Sending a list of users
  async function sendUser() {
    const username = newUser.includes("@")
      ? newUser.replace(new RegExp("@", "g"), "")
      : newUser;
    const user = JSON.stringify({ username, status: true }); // Convert to JSON string
    await invoke("send_message", { subject: "users.data", payload: user })
      .then(() => console.log("Sent user list to NATS!"))
      .catch((err) => console.error("Error:", err));

    setNewUser("@"); // Clear input after adding
  }

  async function removeUser() {
    const username = newUser.includes("@")
      ? newUser.replace(new RegExp("@", "g"), "")
      : newUser;
    const user = JSON.stringify({ username, status: false }); // Convert to JSON string
    await invoke("send_message", { subject: "users.data", payload: user })
      .then(() => console.log("Sent user list to NATS!"))
      .catch((err) => console.error("Error:", err));

    setNewUser("@"); // Clear input after adding
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;

    // Ensure "@" is always at the start
    if (!value.startsWith("@")) {
      value = "@" + value.replace(/^@+/, ""); // Prevent multiple '@'
    }

    // Update state
    setNewUser(value);
  };

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
    <div className="container mx-auto px-4 text-white">
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
      <div>
        <input
          className="py-2 px-4 rounded mt-4"
          type="text"
          value={newUser}
          onChange={handleChange}
          onKeyDown={(e) => e.key === "Enter" && sendUser()}
        />
        <button
          onClick={sendUser}
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded mt-4"
        >
          Add User
        </button>
        <button
          onClick={removeUser}
          className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded mt-4"
        >
          Remove User
        </button>
      </div>
    </div>
  );
}

export default Temp;
