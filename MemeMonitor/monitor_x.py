"""
Twitter Monitoring System

This script implements a robust Twitter monitoring system designed to track specific accounts
for cryptocurrency-related content, particularly focusing on contract addresses. It uses
Selenium for browser automation with multiple account rotation and anti-detection measures.

Key Features:
- Multiple account management with rotation and cooldown
- Anti-detection measures including human-like behavior
- Contract address detection and storage
- Repost filtering
- Exponential backoff for failed attempts

Dependencies:
    - selenium: For browser automation
    - webdriver_manager: For ChromeDriver management
    - python-dotenv: For environment variable management
    - time, random: For timing and randomization
    - re: For regex pattern matching
    - json: For data storage
    - datetime: For timestamp management
    - os: For file operations
"""
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

ACCOUNTS_TO_MONITOR = [
            "v_mello_",
            "mcuban",
            "realDonaldTrump",
            "BarronXSpaces",
            # "MELANIATRUMP",
            "mcuban",
            "IvankaTrump",
            "EricTrump",
            "mcuban",
            "DonaldJTrumpJr",
            # "elonmusk",
            # "JDVance",
            # "mrbeast",
            # "joerogan",
        ]

class TwitterAccount:
    """
    Represents a Twitter account with associated credentials and state management.
    
    Attributes:
        email (str): Account email address
        password (str): Account password
        username (str): Twitter username
        last_used (float): Timestamp of last usage
        consecutive_failures (int): Count of consecutive login/operation failures
        cooldown_until (float): Timestamp until account is available again
    """
    def __init__(self, email, password, username):
        self.email = email
        self.password = password
        self.username = username
        self.last_used = 0
        self.consecutive_failures = 0
        self.cooldown_until = 0

class TwitterMonitor:
    """
    Main monitoring system for Twitter accounts. Manages browser automation,
    account rotation, and tweet processing.
    
    Attributes:
        driver: Selenium WebDriver instance
        accounts (list): List of TwitterAccount objects
        current_account_index (int): Index of current active account
        address_pattern (str): Regex pattern for contract addresses
        keywords (list): List of keywords to monitor
        latest_tweets (dict): Cache of most recent tweet IDs per user
        processed_addresses (set): Set of already processed contract addresses
    """
    def __init__(self, proxy=None):
        """
        Initialize the Twitter monitoring system.
        
        Args:
            proxy (str, optional): Proxy server address for connections
        """
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
        """
        Configure and initialize the Chrome WebDriver with anti-detection measures.
        
        Args:
            proxy (str, optional): Proxy server address
            
        Sets up browser with:
            - Stealth settings to avoid detection
            - Random user agent
            - Various Chrome options for stability
            - CDP commands for additional stealth
        """
        self.options = Options()  # Initialize Chrome options object
    
        # Anti-bot detection settings
        self.options.add_argument('--disable-blink-features=AutomationControlled')  # Disables ChromeDriver flags
        self.options.add_experimental_option('excludeSwitches', ['enable-automation', 'enable-logging'])  # Removes automation indicators
        self.options.add_experimental_option('useAutomationExtension', False)  # Disables automation extensions
        
        # Window and performance settings
        self.options.add_argument('--window-size=600,300')  # Sets specific window dimensions
        self.options.add_argument('--disable-extensions')  # Prevents extension loading
        self.options.add_argument('--disable-infobars')  # Removes "Chrome is being controlled by automation" banner
        self.options.add_argument('--disable-dev-shm-usage')  # Prevents issues with limited /dev/shm on Linux
        self.options.add_argument('--no-sandbox')  # Disables sandbox for stability
        self.options.add_argument('--disable-gpu')  # Reduces hardware acceleration issues
        
        # Randomize browser fingerprint with different user agents
        user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0'
        ]
        self.options.add_argument(f'user-agent={random.choice(user_agents)}')  # Sets random user agent

        # Configure proxy if provided
        if proxy:
            self.options.add_argument(f'--proxy-server={proxy}')
        
        # Initialize Chrome driver
        self.service = Service(ChromeDriverManager().install())  # Manages ChromeDriver installation
        self.driver = webdriver.Chrome(service=self.service, options=self.options)  # Creates browser instance
        self.wait = WebDriverWait(self.driver, 10)  # Sets up implicit wait for elements
        
        # Additional anti-detection measures using Chrome DevTools Protocol (CDP)
        self.driver.execute_cdp_cmd('Network.setUserAgentOverride', {  # Override user agent at network level
            "userAgent": random.choice(user_agents)
        })
        self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")  # Hides webdriver flag

    def initialize_accounts(self):
        """
        Load Twitter account credentials from environment variables.
        
        Expects environment variables in format:
            TWITTER_EMAIL_[1-4]
            TWITTER_PASSWORD_[1-4]
            TWITTER_USERNAME_[1-4]
        
        Raises:
            ValueError: If no valid accounts are found in environment variables
        """
        # Load accounts from environment variables
        for i in range(1, 6):  # Assuming we have 4 accounts
            email = os.getenv(f'TWITTER_EMAIL_{i}')
            password = os.getenv(f'TWITTER_PASSWORD_{i}')
            username = os.getenv(f'TWITTER_USERNAME_{i}')
            
            if email and password and username:
                self.accounts.append(TwitterAccount(email, password, username))

        if not self.accounts:
            raise ValueError("No valid Twitter accounts found in environment variables")

    def get_next_available_account(self):
        """
        Select the next available account for use, considering cooldowns.
        
        Returns:
            TwitterAccount: Next available account, or None if all accounts are in cooldown
        """
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
        """
        Manages short cooldown periods for account rotation.
        
        Args:
            account: TwitterAccount object that failed login/operation
        """
        account.consecutive_failures += 1
        
        if account.consecutive_failures > 0:
            cooldown_minutes = min(5, 1 * (2 ** (account.consecutive_failures - 1)))  # Max 5 minutes
            account.cooldown_until = time.time() + (cooldown_minutes * 60)
            print(f"Account {account.username} in cooldown for {cooldown_minutes} minutes")

    def handle_account_success(self, account):
        """
        Handle successful account operation.
        
        Args:
            account (TwitterAccount): Account that completed successful operation
        """
        account.consecutive_failures = 0
        account.last_used = time.time()

    def restart_browser(self):
        """
        Safely restart the browser instance with random delay.
        """
        try:
            self.driver.quit()
        except:
            pass
        finally:
            time.sleep(random.uniform(3, 6))
            self.setup_browser()

    def _type_like_human(self, element, text):
        """
        Simulate human-like typing behavior.
        
        Args:
            element: Selenium WebElement to type into
            text (str): Text to type
        """
        for char in text:
            element.send_keys(char)
            time.sleep(random.uniform(0.1, 0.3))

    def login(self, account):
        """
        Attempt to log into Twitter with given account.
        
        Args:
            account (TwitterAccount): Account to use for login
            
        Returns:
            bool: True if login successful, False otherwise
            
        Handles:
            - Email/username entry
            - Password entry
            - Unusual activity checks
            - Login verification
        """
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
        """
        Check recent tweets from specified user.
        
        Args:
            username (str): Twitter username to monitor
            account (TwitterAccount): Account being used for monitoring
            
        Returns:
            list: List of new tweets containing monitored content
            
        Features:
            - Repost filtering
            - Contract address detection
            - Tweet deduplication
            - Random scrolling behavior
            - Timestamp extraction
            - JSON data storage
        """
        try:
            self.driver.get(f"https://twitter.com/{username}")
            time.sleep(random.uniform(4, 8))
            
            # Navigate to Posts tab
            try:
                posts_tab = self.wait.until(EC.presence_of_element_located(
                    (By.CSS_SELECTOR, 'a[href$="/tweets"]')))
                posts_tab.click()
                time.sleep(random.uniform(2, 4))
            except:
                print(f"Could not find Posts tab for {username}, continuing with current view")
            
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
                    # # First and most important check: Look for socialContext which indicates a repost
                    # try:
                    #     social_context = tweet.find_element(By.CSS_SELECTOR, 'span[data-testid="socialContext"]')
                    #     print("Skipping - Found repost indicator")
                    #     continue
                    # except:
                    #     # No socialContext found - this is good, might be an original tweet
                    #     pass

                    # Get the tweet text
                    try:
                        tweet_text = tweet.find_element(By.CSS_SELECTOR, '[data-testid="tweetText"]').text.strip()
                    except:
                        print("Couldn't find tweet text, skipping")
                        continue
                        
                    print(f"Processing original tweet: {tweet_text}")
                    
                    # Process addresses for original tweets only
                    matches = re.findall(self.address_pattern, tweet_text)
                    
                    if matches:
                        print(f"Found addresses in original tweet: {matches}")
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
                        print(f"Added new original tweet with addresses: {matches}")
                        
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
        """
        Load previously processed contract addresses from the snipe list file.
        
        The function reads the existing snipe list file and populates the
        processed_addresses set to prevent duplicate processing.
        
        Handles file not found and other IO exceptions gracefully.
        """
        try:
            if os.path.exists(self.snipe_list_path):
                with open(self.snipe_list_path, 'r') as f:
                    self.processed_addresses = set(line.strip() for line in f)
        except Exception as e:
            print(f"Error loading processed addresses: {e}")
    
    def extract_and_save_addresses(self, tweet_text: str) -> list:
        """
        Extract and save Solana contract addresses from tweet text.
        
        Args:
            tweet_text (str): The full text content of the tweet
            
        Returns:
            list: List of newly found addresses
            
        Features:
            - Regex-based address detection
            - Duplicate checking
            - Persistent storage
        """
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

    def monitor_accounts(self, usernames, min_interval=10, max_interval=20):
        """
        Main monitoring loop with aggressive polling intervals.
        With 5 accounts rotating, each account gets ~2-4 minutes rest between uses.
        
        Args:
            usernames (list): List of Twitter usernames to monitor
            min_interval (int): Minimum seconds between checks (default: 30)
            max_interval (int): Maximum seconds between checks (default: 20)
            
        Features:
            - Account rotation
            - Configurable check intervals
            - Automatic browser restart
            - Error recovery
            - JSON-based tweet archiving
        """
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
                    time.sleep(60)  # Wait 1 minute
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
                    
                    time.sleep(random.uniform(10, 20))
                
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
        monitor.monitor_accounts(ACCOUNTS_TO_MONITOR)
        
    except KeyboardInterrupt:
        print("\nMonitoring stopped by user")
    except Exception as e:
        print(f"\nAn error occurred: {e}")
    finally:
        monitor.driver.quit()

if __name__ == "__main__":
    main()