# Solana premium sniper bot

This codebase is a demonstration of various scripts to help you snipe new tokens on solana whilst minimising rugs. It is written in typescript language and utilises solana rpc methods and [jito mev validator](https://www.jito.wtf/) for landing fast transactions . By default the script listens for new raydium liquidity pool transactions, extracts the necessary poolkeys, and executes a buy swap if rug checks are successful.

**disclaimer**: Please read and agree to the terms in the `LICENCE.md` before using this codebase. It is highly recommended to NOT use the default solana RPC in production, instead use an RPC provider to ensure reliability, speed and effectiveness of the bot. Two good recommendations are shyft and helius labs.
You can sign up for shyft free here [shyft](https://shyft.to/) to get your api keys OR You can sign up for free here [helius rpc](https://www.helius.dev/) and use the referal code `3wISAeRX8K` to get 5,000,000 free credits. Follow the [docs](https://docs.helius.dev/solana-rpc-nodes/helius-rpcs-overview) to get your api-key from the dashboard and then replace the value in `RPC_ENDPOINT`in your `.env` file.

## Configuring the sniper bot

### Prelude:

- Install node on your system
- Open codebase in an editor i.e. vscode and install packages in package.json by running `npm install` in your terminal from the root folder.
- Create a `.env` file in the root folder of the codebase.
- Copy the `.env.example` file into the new `.env` file.
- Replace the default rpc endpoints with a rpc provider endpoints. For example, if you're using helius, replace the value in `RPC_ENDPOINT` and `RPC_WEBSOCKET_ENDPOINT` with the helius rpc endpoint. Keep the `wss://` and `https://` prefix format.
- Create or use an existing solana wallet address, send at least 0.2 sol to the wallet. This is your `sniper wallet`. Ideally this should be a tg bot wallet, so you can easily review your PNL, manually sell fast or auto buy/auto sell. I recommend trojan: `https://t.me/hector_trojanbot?start=r-archiekomik`.

  - Export the secret key of your chosen sniper wallet and place it in the `.env` file as `SNIPER_SECRET_KEY=YOUR_WALLET_SECRET_KEY`

- In your `.env` file you can modify your buy, rug check filters, and other configurations. Be careful to ensure not to accidentally delete any of these values or leave them empty.

### Setting up the pending snipe list (optional)

- If you'd like to snipe a specific token or tokens, place the token address in the `pending-snipe-list.txt` file. Please make sure to place the token addresses in new lines.

Example:

```
TokenAddress1
TokenAddress2
```

Set your `SNIPE_LIST_REFRESH_INTERVAL` to the frequency of refreshing the list in milliseconds (assuming you decide to add more token addresses in the future). Example: 60000 refreshes the pending snipe list every 60 seconds.

### Setting up Telegram auto buy and auto sell (optional)

- If you'd like to use your chosen tg sniper bot to buy and sell for you automatically, then please follow these instructions:

  - Visit [telegram](https://my.telegram.org/auth)
  - Login with your phone number. Make sure to select the phone number of the Telegram account connected with the Telegram Sniper Bot. After you press Next, the site will request an access code.
  - The code will be sent by the official Telegram account to your Telegram. DO NOT SHARE THIS CODE WITH ANYONE. Use the access code to login.
  - After logging in, select API Development Tool.
  - Fill out the form:
    - App Title: Sniper
    - Short Name: Sniper
    - URL: https://my.telegram.org/
    - Platform: Web
  - Submit the form. If you run into errors, try on different browser i.e. safari.
  - You will receive an API_ID and API_HASH. Place these values in your `.env` file as `TG_API_ID` and `TG_API_HASH`.
  - Set the value for `TG_BOT_USERNAME` to your tg sniper bot username. This is found by clicking info on the bot. It should look like this `@your_bot_username`.
  - Your `.env` should include fields that looks similar to this (see dummy example):

  ```

  //see example below

  API_ID=26342933
  API_HASH='9324235235e3ccb4e774cb59430ff'
  TG_BOT_USERNAME='@hector_trojanbot'
  ```

  NOTE: Since you are interacting with the telegram app programatically, to avoid violating TOS ensure you are using a valid phone number from a non-red flag country. If not, it may be safer to create a separate telegram account dedicated for sniper.

### Running the sniper bot

Under the hood, your sniper bot will pay a tip of `JITO_TIP_AMOUNT` to use jito mev validator to land fast transactions. [Jito](https://www.jito.wtf/).

Once you've set up your api keys and `.env` file configs, open your terminal at the root folder of the codebase. Run one of the commands below, depending on your preference: sniping using jito vs sniping using your tg sniper bot i.e. trojan, bonkbot.

You will see in your terminal the bot configurations and `monitoring for new tokens.` The bot will begin scanning for tokens to buy.

If a buy is successful, it will show on the terminal and be stored in the `sniper_data/bought_tokens.json` file.

OPTION 1: If you would like to snipe new tokens using jito enable transactions...

Run `npm run sniper` in your terminal.

If you have `USE_SNIPE_LIST` set to `true` in your `.env` file, the bot will only attempt to snipe tokens in the `pending-snipe-list.txt` file.

OPTION 2: If you would like to snipe new tokens using your tg bot...

Ensure you have turned on auto-buy and auto-sell in your tg sniper bot.

Make sure buy and sell slippage at least 70% in your tg bot settings.

If you are using Trojan set fee to "turbo."

Run `npm run sniper-tg` in your terminal.

Enter your phone number (with the international country code i.e. +231). The bot will request an access code and a password. If you don’t have Two-Factor Authentication (2FA) enabled in your Telegram account, you can leave the password field empty.

The code will be sent by the official Telegram account to your Telegram. Copy the code and paste into the terminal to complete installation.

The bot should begin running, store the session id printed in the terminal in your `.env` file as `TG_SESSION_ID`.

## TROUBLESHOOTING

**Make sure after making any changes that you click 'file' tab and then 'save all' in your editor to save the changes.**

1. How do I check errors that have occured whilst running bot?

Please open`errorNewLpsLogs.txt` file.

2. How do I check the tokens I have bought?

Please open `sniper_data/bought_tokens.json` file. Confirm the tokens exist via solscan.io.

3. Why are my transactions failing?

- Network congestion can cause transactions to fail. If you're running into this issue, try increasing your `JITO_TIP_AMOUNT`or changing rpc provider.
- If you're running into 429 too many requests error in terminal, please ensure you have a valid rpc url and api key in your `.env` file as `RPC_ENDPOINT`. If you're using helius and running into problems, try to use free shyft api instead [here](https://shyft.to/). Consider upgrading to a paid plan for more requests per second.

4. How do I run bot faster ?

- If you're running into major speed issues, consider running your bot on a VPS like digital ocean deployed in the same region as your rpc provider. Most RPC providers have servers in popular regions like US, EU, Asia, etc.

5. How can I avoid rugs?

- It is impossible to avoid all rugs because these are new tokens that aren't yet "locked", the purpose of the rug checks is to minimize frequency of buying rugs. Experiment with the configurations.
- The various rug checks may delay transaction speed by up to 5 seconds, you can remove this, but I wouldn't recommend that. There's a tradeoff here between speed and safety. If you'd like to remove the rug checks, set `ENABLE_RUG_CHECKS` to `false` in your `.env` file.

6. How do i close terminal or stop bot running?

You can simply press `ctrl + c` in your terminal to stop the bot running.

## Maintenance and support

Creating this code, mantaining + upgrading it and providing support in the discord is expensive. This code is essentially similar to what popular telegram bots i.e. bonkbot use under the hood, but they are heavily funded with good sized teams.

Given the relatively low purchase price of the bot, to mitigate costs, there is an optional small 1% support fee on each trade enabled by default in `constants.ts` called `ENABLE_ONGOING_SUPPORT_FEE`. Enabling this gives you special access to the premium sniper support channel. You will not only get priority technical support, but also upgrades and fixes on the sniper bot, plus early access to future bots/tools, and more.

If you'd prefer to DIY this codebase yourself and don't want to support the bot maintenance, then simply change the value to `false` and no fees will be collected on your trades.

## Contact/Support

Premium support is provided in the `premium` channel in the discord [![](https://img.shields.io/discord/1201826085655023616?color=5865F2&logo=Discord&style=flat-square)](https://discord.com/invite/47ddgNwa3b)

You can directly contact archie: `archiesnipes` on discord to get access to the premium support channel for sniper bot owners. Please provide a wallet address transaction as evidence that `ENABLE_ONGOING_SUPPORT_FEE` has been used.
