import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import StaleElementReferenceException, TimeoutException
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import json
from datetime import datetime
import os
from dotenv import load_dotenv
import re
import random

class TwitterAccount:
    def __init__(self, email, password, username):
        self.email = email
        self.password = password
        self.username = username
        self.last_used = 0
        self.consecutive_failures = 0
        self.cooldown_until = 0

class TwitterMonitor:
    def __init__(self, proxy=None):
        self.setup_browser(proxy)
        self.accounts = []
        self.current_account_index = 0
        self.initialize_accounts()
        
        # Other initialization code remains the same
        self.address_pattern = r'\b[a-km-zA-HJ-NP-Z1-9]{32,44}\b'
        self.keywords = []
        self.latest_tweets = {}
        self.snipe_list_path = "pending-snipe-list.txt"
        self.processed_addresses = set()
        self.load_processed_addresses()

    def setup_browser(self, proxy=None):
        self.options = Options()
        
        # Enhanced stealth settings
        self.options.add_argument('--disable-blink-features=AutomationControlled')
        self.options.add_experimental_option('excludeSwitches', ['enable-automation', 'enable-logging'])
        self.options.add_experimental_option('useAutomationExtension', False)
        
        # Browser settings
        self.options.add_argument('--window-size=1920,1080')
        self.options.add_argument('--start-maximized')
        self.options.add_argument('--disable-extensions')
        self.options.add_argument('--disable-infobars')
        self.options.add_argument('--disable-dev-shm-usage')
        self.options.add_argument('--no-sandbox')
        self.options.add_argument('--disable-gpu')
        
        # Random user agent
        user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0'
        ]
        self.options.add_argument(f'user-agent={random.choice(user_agents)}')

        if proxy:
            self.options.add_argument(f'--proxy-server={proxy}')
        
        self.service = Service(ChromeDriverManager().install())
        self.driver = webdriver.Chrome(service=self.service, options=self.options)
        self.wait = WebDriverWait(self.driver, 10)
        
        # Execute CDP commands
        self.driver.execute_cdp_cmd('Network.setUserAgentOverride', {
            "userAgent": random.choice(user_agents)
        })
        self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")

    def initialize_accounts(self):
        # Load accounts from environment variables
        for i in range(1, 5):  # Assuming we have 4 accounts
            email = os.getenv(f'TWITTER_EMAIL_{i}')
            password = os.getenv(f'TWITTER_PASSWORD_{i}')
            username = os.getenv(f'TWITTER_USERNAME_{i}')
            
            if email and password and username:
                self.accounts.append(TwitterAccount(email, password, username))

        if not self.accounts:
            raise ValueError("No valid Twitter accounts found in environment variables")

    def get_next_available_account(self):
        current_time = time.time()
        attempts = 0
        
        while attempts < len(self.accounts):
            self.current_account_index = (self.current_account_index + 1) % len(self.accounts)
            account = self.accounts[self.current_account_index]
            
            # Skip accounts in cooldown
            if account.cooldown_until > current_time:
                attempts += 1
                continue
                
            return account
            
        return None

    def handle_account_failure(self, account):
        account.consecutive_failures += 1
        
        # Implement exponential backoff
        if account.consecutive_failures > 0:
            cooldown_minutes = min(120, 5 * (2 ** (account.consecutive_failures - 1)))
            account.cooldown_until = time.time() + (cooldown_minutes * 60)
            print(f"Account {account.username} in cooldown for {cooldown_minutes} minutes")

    def handle_account_success(self, account):
        account.consecutive_failures = 0
        account.last_used = time.time()

    def restart_browser(self):
        try:
            self.driver.quit()
        except:
            pass
        finally:
            time.sleep(random.uniform(3, 6))
            self.setup_browser()

    def _type_like_human(self, element, text):
        for char in text:
            element.send_keys(char)
            time.sleep(random.uniform(0.1, 0.3))

    def login(self, account):
        try:
            print(f"\nAttempting to login with account: {account.username}")
            
            self.driver.get("https://twitter.com/i/flow/login")
            time.sleep(random.uniform(4, 7))
            
            # Enter email
            email_input = self.wait.until(EC.presence_of_element_located(
                (By.XPATH, "//input[@autocomplete='username']")))
            self._type_like_human(email_input, account.email)
            email_input.send_keys(Keys.RETURN)
            time.sleep(random.uniform(3, 5))
            
            # Check for unusual activity prompt and handle username verification
            try:
                username_input = self.wait.until(EC.presence_of_element_located(
                    (By.XPATH, "//input[@data-testid='ocfEnterTextTextInput']")))
                if username_input:
                    print("Unusual activity detected, entering username...")
                    self._type_like_human(username_input, account.username)
                    username_input.send_keys(Keys.RETURN)
                    time.sleep(random.uniform(3, 5))
            except TimeoutException:
                # No unusual activity detected, continue with normal login
                pass
                
            # Enter password
            password_input = self.wait.until(EC.presence_of_element_located(
                (By.XPATH, "//input[@name='password']")))
            self._type_like_human(password_input, account.password)
            password_input.send_keys(Keys.RETURN)
            time.sleep(random.uniform(4, 7))
            
            # Verify login success
            try:
                self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, '[data-testid="tweet"]')))
                print(f"✓ Successfully logged in with {account.username}")
                self.handle_account_success(account)
                return True
            except TimeoutException:
                print(f"✗ Login verification failed for {account.username}")
                self.handle_account_failure(account)
                return False
            
        except Exception as e:
            print(f"✗ Login failed for {account.username}: {e}")
            self.handle_account_failure(account)
            return False

    def check_user_tweets(self, username, account):
        try:
            self.driver.get(f"https://twitter.com/{username}")
            time.sleep(random.uniform(4, 8))
            
            # Add more scrolls to ensure content loads
            for _ in range(2):
                scroll_amount = random.randint(300, 700)
                self.driver.execute_script(f"window.scrollBy(0, {scroll_amount})")
                time.sleep(random.uniform(2, 4))
            
            tweet_elements = self.wait.until(EC.presence_of_all_elements_located(
                (By.CSS_SELECTOR, 'article[data-testid="tweet"]')))
            
            self.handle_account_success(account)
            
            new_tweets = []
            for tweet in tweet_elements[:3]:
                try:
                    # Get tweet text - make sure to get the full text content
                    tweet_text = ''
                    try:
                        # First try to get the main tweet text
                        tweet_text = tweet.find_element(By.CSS_SELECTOR, '[data-testid="tweetText"]').text
                    except:
                        # If that fails, get all text content
                        tweet_text = tweet.text
                    
                    tweet_text = tweet_text.strip()
                    print(f"Processing tweet text: {tweet_text}")
                    
                    # Look for address pattern using compiled regex
                    matches = re.findall(r'\b[a-km-zA-HJ-NP-Z1-9]{32,44}\b', tweet_text)
                    
                    if matches:
                        print(f"Found addresses in tweet: {matches}")
                        # Write to snipe list
                        snipe_path = "../archie-jit-snipe-version-1.0/pending-snipe-list.txt"
                        with open(snipe_path, 'a') as f:
                            for address in matches:
                                if address not in self.processed_addresses:
                                    print(f"Writing new address to file: {address}")
                                    f.write(f"{address}\n")
                                    self.processed_addresses.add(address)
                    
                    tweet_link = tweet.find_element(By.CSS_SELECTOR, 'a[href*="/status/"]').get_attribute('href')
                    tweet_id = tweet_link.split('/')[-1]
                    
                    if username in self.latest_tweets and tweet_id <= self.latest_tweets[username]:
                        continue
                    
                    self.latest_tweets[username] = max(tweet_id, self.latest_tweets.get(username, '0'))
                    
                    if matches or any(keyword.lower() in tweet_text.lower() for keyword in self.keywords):
                        timestamp = tweet.find_element(By.TAG_NAME, 'time').get_attribute('datetime')
                        
                        new_tweets.append({
                            'username': username,
                            'text': tweet_text,
                            'timestamp': timestamp,
                            'url': tweet_link,
                            'found_addresses': matches
                        })
                        
                except StaleElementReferenceException:
                    continue
                except Exception as e:
                    print(f"Error processing tweet: {e}")
                    continue
            
            return new_tweets
            
        except Exception as e:
            print(f"Error checking tweets for {username}: {e}")
            self.handle_account_failure(account)
            return []

    def load_processed_addresses(self):
        """Load already processed addresses from the snipe list"""
        try:
            if os.path.exists(self.snipe_list_path):
                with open(self.snipe_list_path, 'r') as f:
                    self.processed_addresses = set(line.strip() for line in f)
        except Exception as e:
            print(f"Error loading processed addresses: {e}")
    
    def extract_and_save_addresses(self, tweet_text: str) -> list:
        """Extract Solana addresses from tweet and save new ones to snipe list"""
        addresses = self.address_pattern.findall(tweet_text)
        new_addresses = []
        
        if addresses:
            try:
                snipe_path = "/Users/nickvmorello/Projects/Old/Archie_Sniper/archie-jit-snipe-version-1.0/pending-snipe-list.txt"
                with open(snipe_path, 'a') as f:
                    for address in addresses:
                        # Check if address was already processed
                        if address not in self.processed_addresses:
                            f.write(f"{address}\n")
                            self.processed_addresses.add(address)
                            new_addresses.append(address)
                            print(f"Added new address to snipe list: {address}")
            except Exception as e:
                print(f"Error saving addresses to snipe list: {e}")
    
        return new_addresses

    def monitor_accounts(self, usernames, min_interval=60, max_interval=180):
        print("\nMONITORING CONFIGURATION:")
        print("-"*30)
        print(f"Check Interval: {min_interval}-{max_interval} seconds")
        print(f"Number of accounts to monitor: {len(usernames)}")
        print(f"Number of Twitter accounts available: {len(self.accounts)}")
        print(f"Keywords being monitored: {', '.join(self.keywords)}")
        print(f"Saving contract addresses to: {self.snipe_list_path}")
        print("-"*30)

        while True:
            try:
                current_account = self.get_next_available_account()
                
                if not current_account:
                    print("All accounts are in cooldown. Waiting...")
                    time.sleep(300)  # Wait 5 minutes
                    continue
                
                # Try to login if needed
                if not hasattr(self, 'logged_in_account') or self.logged_in_account != current_account:
                    self.restart_browser()
                    if not self.login(current_account):
                        continue
                    self.logged_in_account = current_account

                for username in usernames:
                    new_tweets = self.check_user_tweets(username, current_account)
                    
                    if new_tweets is None:  # Indicates a major error
                        break  # Will trigger account switch
                    
                    # Process the new tweets we found
                    for tweet in new_tweets:
                        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        print(f"\n{'='*60}")
                        print(f"🚨 ALERT: New crypto-related tweet detected! 🚨")
                        print(f"Time: {current_time}")
                        print(f"User: @{tweet['username']}")
                        print(f"Tweet Time: {tweet['timestamp']}")
                        print(f"Text: {tweet['text']}")
                        print(f"URL: {tweet['url']}")
                        if tweet['found_addresses']:
                            print(f"Found contract addresses: {', '.join(tweet['found_addresses'])}")
                        print(f"{'='*60}\n")
                        
                        # Save to file
                        with open('crypto_tweets.json', 'a') as f:
                            tweet_data = {
                                'detection_time': current_time,
                                'username': tweet['username'],
                                'tweet_time': tweet['timestamp'],
                                'tweet_text': tweet['text'],
                                'tweet_url': tweet['url'],
                                'contract_addresses': tweet['found_addresses']
                            }
                            f.write(json.dumps(tweet_data) + '\n')
                    
                    time.sleep(random.uniform(8, 15))
                
                cycle_interval = random.uniform(min_interval, max_interval)
                print(f"\nWaiting {int(cycle_interval)} seconds before next cycle...")
                time.sleep(cycle_interval)
                
            except Exception as e:
                print(f"Error during monitoring cycle: {e}")
                self.handle_account_failure(current_account)
                time.sleep(random.uniform(min_interval, max_interval))

def main():
    proxy = os.getenv('PROXY')
    monitor = TwitterMonitor(proxy)
    
    try:
        ACCOUNTS_TO_MONITOR = [
            "realDonaldTrump",
            "mcuban",
            "MELANIATRUMP",
            "IvankaTrump",
            "EricTrump",
            "DonaldJTrumpJr",
        ]
        
        additional_accounts = os.getenv('ADDITIONAL_ACCOUNTS')
        if additional_accounts:
            ACCOUNTS_TO_MONITOR.extend(additional_accounts.split(','))
        
        monitor.monitor_accounts(ACCOUNTS_TO_MONITOR)
        
    except KeyboardInterrupt:
        print("\nMonitoring stopped by user")
    except Exception as e:
        print(f"\nAn error occurred: {e}")
    finally:
        monitor.driver.quit()

if __name__ == "__main__":
    main()