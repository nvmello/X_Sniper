import React from "react";

interface UserCardProps {
  username: string;
  subtitle?: string;
  photoLink: string;
  accountLink?: string;
  successfullSwap?: boolean;
  mint?: string;
  value?: number;
  pnl?: number;
}

function Usercard({
  username,
  subtitle,
  photoLink,
  successfullSwap,
  mint,
  value,
  pnl,
}: UserCardProps) {
  console.log("photoLink:");

  console.log(photoLink);

  const getBackgroundColor = () => {
    // if (pnl > 0) return "bg-green-500";
    // else if (pnl < 0) {
    //   return "bg-red-500";
    // } else {
    //   return "bg-blue-400";
    // }

    if (mint) return "bg-green-500";
    else {
      return "bg-blue-400";
    }
  };

  return (
    <div className={`w-full p-2 m-3 rounded-full ${getBackgroundColor()}`}>
      <div className="flex items-center gap-4 ">
        <img
          className="flex w-16 h-16 rounded-full"
          src={photoLink}
          alt={`${username}'s profile`}
        />
        <div className="flex card-header">{username}</div>
      </div>
    </div>
  );
}

export default Usercard;
