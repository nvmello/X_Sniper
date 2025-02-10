import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface UserCardProps {
  username: string;
  subtitle?: string;
  accountLink?: string;
  successfullSwap?: boolean;
  mint?: string;
  value?: number;
  pnl?: number;
  initialAmount?: number;
}

function UserCard({
  username,
  subtitle,
  successfullSwap,
  mint,
  value,
  pnl,
  initialAmount = 0,
}: UserCardProps) {
  const [solAmount, setSolAmount] = useState(initialAmount);

  // Update local state if initialAmount changes
  useEffect(() => {
    setSolAmount(initialAmount);
  }, [initialAmount]);

  const getBackgroundColor = () => {
    if (mint) return "bg-green-500";
    return "bg-blue-400";
  };

  const handleSliderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAmount = parseFloat(e.target.value);
    setSolAmount(newAmount);

    try {
      await invoke("send_message", {
        subject: "users.amount",
        payload: JSON.stringify({
          username,
          amount: newAmount,
        }),
      });
      console.log(`Updated amount for ${username} to ${newAmount} SOL`);
    } catch (error) {
      console.error("Failed to update amount:", error);
    }
  };

  return (
    <div
      className={`w-full rounded-full ${getBackgroundColor()} shadow-lg transition-all duration-200 hover:shadow-xl`}
    >
      <div className="grid grid-cols-3 gap-4 p-1">
        <div className="flex text-l items-center justify-center font-semibold text-white">
          {username}
        </div>

        <div className="flex flex-col items-center justify-center gap-2">
          <div className="w-full max-w-xs">
            <input
              type="range"
              min="0.1"
              max="10"
              step="0.1"
              value={solAmount}
              onChange={handleSliderChange}
              className="w-full h-2 appearance-none cursor-pointer bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
            />
          </div>
          <div className="text-sm text-white opacity-75"></div>
        </div>

        <div className="flex justify-center text-l items-center font-semibold text-white">
          <h1>{solAmount.toFixed(1)} SOL</h1>
        </div>
      </div>
    </div>
  );
}

export default UserCard;
