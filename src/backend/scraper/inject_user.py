import asyncio
import json
import nats
import sqlite3
import re
from nats.aio.client import Client as NATS

def init_db():
    conn = sqlite3.connect('../../database/users.db')
    c = conn.cursor()
    print('Creating users table...')
    c.execute('''CREATE TABLE IF NOT EXISTS users
                 (username TEXT PRIMARY KEY, sniped BOOLEAN, mint TEXT, photopath TEXT, amount DECIMAL(10, 3) CHECK (amount >= 0))''')
    conn.commit()
    conn.close()

async def add_user(username: str):
    try:
        conn = sqlite3.connect('../../database/users.db')
        c = conn.cursor()
        print(f'Adding user {username} to database...')
        c.execute("INSERT INTO users (username, sniped) VALUES (?, ?)", 
                (username, False,))
        conn.commit()
        conn.close()
        print('User: {username} added to users.db ')
        return {"status": "success"}
    except sqlite3.Error as e:
        print(f"Database error: {e}")
        return {"status": "error", "message": str(e)}

async def remove_user(username: str):
    try:
        conn = sqlite3.connect('../../database/users.db')
        c = conn.cursor()
        print(f'Removing user {username} database...')
        c.execute("DELETE FROM users WHERE username = ?", 
                (username,))
        conn.commit()
        conn.close()
        print('User: {username} removed users.db ')
        return {"status": "success"}
    except sqlite3.Error as e:
        print(f"Database error: {e}")
        return {"status": "error", "message": str(e)}

class UserMonitor:
    def __init__(self):
        pass


    def is_valid_twitter_username(self, username):
        pattern = r"^@?[A-Za-z0-9_]{1,15}$"
        if re.match(pattern, username):
            print("✅ Valid Twitter username")
            return True
        else:
            print("❌ Invalid Twitter username")
            return False

    async def message_handler(self, msg):
        print("\n🔔 Received new message from frontend!")
        
        try:
            raw_data = msg.data.decode()
            print(f"Raw data: {raw_data}")
            
            # Parse the JSON string (it's double-encoded)
            parsed_json = json.loads(raw_data)  # First parse
            if isinstance(parsed_json, str):
                data = json.loads(parsed_json)   # Second parse if still a string
            else:
                data = parsed_json
                
            print(f"Final parsed data: {data}")
            
            username = data["username"]  # Direct dictionary access
            status = data["status"]      # Direct dictionary access
            
            if status:
                if self.is_valid_twitter_username(username):
                    await add_user(username)
                    print(f"✅ Added new user: {username}")
            else:
                await remove_user(username)
                print(f"✅ Removed user: {username}")

        except json.JSONDecodeError as e:
            print(f"❌ JSON Decode Error: {e}")
            print(f"Problematic data: {raw_data}")
        except Exception as e:
            print(f"❌ Error: {str(e)}")
            print(f"Error type: {type(e)}")

    async def run(self):
        print("🚀 Starting user monitor...")
        
        nc = NATS()
        await nc.connect("nats://127.0.0.1:4222")
        print("✅ Connected to NATS")

        await nc.subscribe("users.data", cb=self.message_handler)
        print("👂 Listening for user updates on users.data")
        
        try:
            while True:
                await asyncio.sleep(1)
        except asyncio.CancelledError:
            print("\n💤 Shutting down...")
        finally:
            await nc.drain()
            await nc.close()

def main():
    monitor = UserMonitor()
    loop = asyncio.get_event_loop()
    init_db()
    try:
        loop.run_until_complete(monitor.run())
    except KeyboardInterrupt:
        print("\n👋 Monitor stopped by user")
    finally:
        loop.close()

if __name__ == "__main__":
    main()