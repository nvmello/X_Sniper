import { useEffect, useState } from "react";
import Usercard from "./usercard";
import { invoke } from "@tauri-apps/api/core";

interface User {
  username: string;
  mint: string | null;
  amount: number;
}

function Scrollview() {
  const [sniperStarted, setSniperStarted] = useState(false);
  const [scraperStarted, setScraperStarted] = useState(false);
  const [newUser, setNewUser] = useState<string>("@");
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    // Fetch users when component mounts
    fetchUsers();
  }, []);

  // Fetch users from the database
  const fetchUsers = async () => {
    try {
      const fetchedUsers = await invoke<User[]>("get_users");
      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  // Sending a list of users
  async function sendUser() {
    const username = newUser.includes("@")
      ? newUser.replace(new RegExp("@", "g"), "")
      : newUser;
    const user = JSON.stringify({ username, status: true });

    try {
      await invoke("send_message", { subject: "users.data", payload: user });
      console.log("Sent user list to NATS!");
      // Refresh the users list after adding
      fetchUsers();
    } catch (err) {
      console.error("Error:", err);
    }

    setNewUser("@");
  }

  async function removeUser() {
    const username = newUser.includes("@")
      ? newUser.replace(new RegExp("@", "g"), "")
      : newUser;
    const user = JSON.stringify({ username, status: false });

    try {
      await invoke("send_message", { subject: "users.data", payload: user });
      console.log("Sent user list to NATS!");
      // Refresh the users list after removing
      fetchUsers();
    } catch (err) {
      console.error("Error:", err);
    }

    setNewUser("@");
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    if (!value.startsWith("@")) {
      value = "@" + value.replace(/^@+/, "");
    }
    setNewUser(value);
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="grid grid-cols-3 gap-3 p-4">
        <div className="flex justify-center">
          <input
            className="py-2 px-4 rounded mt-4 m-1 bg-gray-700 w-3/4"
            type="text"
            value={newUser}
            onChange={handleChange}
            onKeyDown={(e) => e.key === "Enter" && sendUser()}
          />
        </div>
        <div className="flex justify-center">
          <button
            onClick={sendUser}
            className="bg-green-500 m-1 hover:bg-green-700 text-white font-bold py-2 px-4 rounded mt-4"
          >
            Add User
          </button>
        </div>
        <div className="flex justify-center">
          <button
            onClick={removeUser}
            className="bg-red-500 m-1 hover:bg-red-700 text-white font-bold py-2 px-4 rounded mt-4"
          >
            Remove User
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col w-full gap-4 p-4">
          {users.map((user) => (
            <Usercard
              key={user.username}
              username={user.username}
              mint={user.mint || undefined}
              pnl={user.amount}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default Scrollview;
