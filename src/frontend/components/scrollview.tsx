import { useEffect, useState } from "react";
import Usercard from "./usercard";
import { invoke } from "@tauri-apps/api/core";

interface User {
  username: string;
  mint: string | null;
  photopath: string;
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
      console.log(users);
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
    <div>
      <div className="flex">
        <input
          className="py-2 px-4 rounded mt-4 m-1"
          type="text"
          value={newUser}
          onChange={handleChange}
          onKeyDown={(e) => e.key === "Enter" && sendUser()}
        />
        <button
          onClick={sendUser}
          className="bg-green-500 m-1 hover:bg-green-700 text-white font-bold py-2 px-4 rounded mt-4"
        >
          Add User
        </button>
        <button
          onClick={removeUser}
          className="bg-red-500 m-1 hover:bg-red-700 text-white font-bold py-2 px-4 rounded mt-4"
        >
          Remove User
        </button>
      </div>

      <div className="w-1/2 min-h-[300px] p-4 rounded-lg">
        {users.map((user) => (
          <Usercard
            key={user.username}
            username={user.username}
            photoLink={user.photopath}
            mint={user.mint || undefined}
            pnl={user.amount}
          />
        ))}
      </div>
    </div>
  );
}

export default Scrollview;
