interface NatsMessage {
  type: "update_accounts";
  accounts: string[];
}

interface ApiResponse {
  status: "success" | "error";
  message?: string;
}

import React, { useState, KeyboardEvent, ChangeEvent } from "react";

const XAccountsManager: React.FC = () => {
  const [accounts, setAccounts] = useState<string[]>([
    "v_mello_",
    "mcuban",
    "realDonaldTrump",
    "BarronXSpaces",
  ]);
  const [newAccount, setNewAccount] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const addAccount = (): void => {
    const trimmedAccount = newAccount.trim();

    if (!trimmedAccount) {
      setStatus("Please enter a X username");
      return;
    }

    if (accounts.includes(trimmedAccount)) {
      setStatus("Account already exists in the list");
      return;
    }

    const updatedAccounts = [...accounts, trimmedAccount];
    setAccounts(updatedAccounts);
    setNewAccount("");
    broadcastAccounts(updatedAccounts);
  };

  const removeAccount = (index: number): void => {
    const updatedAccounts = accounts.filter((_, i) => i !== index);
    setAccounts(updatedAccounts);
    broadcastAccounts(updatedAccounts);
  };

  const broadcastAccounts = async (accountsList: string[]): Promise<void> => {
    setIsLoading(true);
    try {
      const message: NatsMessage = {
        type: "update_accounts",
        accounts: accountsList,
      };

      const response = await fetch("/api/nats/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject: "X_accounts",
          message,
        }),
      });

      const data: ApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to broadcast accounts update");
      }

      setStatus("Account list updated successfully");
      setTimeout(() => setStatus(""), 3000); // Clear status after 3 seconds
    } catch (error) {
      setStatus(
        `Error broadcasting update: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter") {
      addAccount();
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setNewAccount(e.target.value);
  };

  return (
    <div className="p-6 mx-auto max-w-2xl bg-white rounded shadow">
      <h1 className="text-2xl font-bold mb-6">X Accounts Manager</h1>

      <div className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newAccount}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="Enter X username"
            className="flex-1 px-3 py-2 border rounded"
            disabled={isLoading}
          />
          <button
            onClick={addAccount}
            className={`px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 ${
              isLoading ? "opacity-50 cursor-not-allowed" : ""
            }`}
            disabled={isLoading}
          >
            {isLoading ? "Adding..." : "Add Account"}
          </button>
        </div>
      </div>

      {status && (
        <div
          className={`p-3 mb-4 rounded ${
            status.includes("Error")
              ? "bg-red-100 text-red-700"
              : "bg-green-100 text-green-700"
          }`}
        >
          {status}
        </div>
      )}

      <div className="space-y-2">
        {accounts.map((account, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-3 bg-gray-50 rounded"
          >
            <span className="font-medium">@{account}</span>
            <button
              onClick={() => removeAccount(index)}
              className="px-3 py-1 text-red-600 hover:bg-red-50 rounded"
              disabled={isLoading}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 text-right">
        <button
          onClick={() => broadcastAccounts(accounts)}
          className={`px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 ${
            isLoading ? "opacity-50 cursor-not-allowed" : ""
          }`}
          disabled={isLoading}
        >
          {isLoading ? "Syncing..." : "Sync Accounts"}
        </button>
      </div>
    </div>
  );
};

export default XAccountsManager;
