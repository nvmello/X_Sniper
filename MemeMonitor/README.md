# Twitter Monitor

A sophisticated automation tool for monitoring Twitter accounts and detecting cryptocurrency-related content, with a focus on contract addresses. Features multiple account rotation, anti-detection measures, and robust error handling.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Architecture](#architecture)
- [Troubleshooting](#troubleshooting)
- [Maintenance](#maintenance)

## Features

- 🔄 Multiple account rotation with cooldown management
- 🤖 Human-like browser automation
- 💰 Cryptocurrency contract address detection
- 🔍 Smart repost filtering
- ⚡ Automatic failure recovery with exponential backoff
- 🔒 Advanced anti-detection mechanisms
- 🌐 Proxy support

## Prerequisites

- Python 3.8+
- Chrome Browser
- Active Twitter accounts
- (Optional) Proxy service

## Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/twitter-monitor.git
cd twitter-monitor
```

2. Install required packages:

```bash
pip install -r requirements.txt
```

3. Set up environment variables:

```bash
cp .env.example .env
# Edit .env with your Twitter account credentials
```

## Configuration

### Environment Variables

Required for each account (supports up to 4 accounts):

```
TWITTER_EMAIL_1=account1@example.com
TWITTER_PASSWORD_1=password1
TWITTER_USERNAME_1=username1
...
TWITTER_EMAIL_4=account4@example.com
TWITTER_PASSWORD_4=password4
TWITTER_USERNAME_4=username4

# Optional
PROXY=http://your-proxy-url
ADDITIONAL_ACCOUNTS=account1,account2,account3
```

### Monitoring Parameters

Default settings in `config.py`:

```python
MIN_INTERVAL = 60  # Minimum seconds between checks
MAX_INTERVAL = 180  # Maximum seconds between checks
TWEET_DEPTH = 3    # Number of recent tweets to check
SCROLL_DEPTH = 2   # Number of page scrolls per check
```

## Usage

1. Start the monitor:

```bash
python monitor.py
```

2. Monitor output logs:

```bash
tail -f crypto_tweets.json
```

3. Check detected addresses:

```bash
cat pending-snipe-list.txt
```

## Architecture

### Components

1. **TwitterAccount Class**

   - Credential management
   - State tracking
   - Cooldown handling

2. **TwitterMonitor Class**
   - Browser automation
   - Account rotation
   - Tweet processing
   - Data storage

### Data Storage

Tweets are stored in JSON format:

```json
{
  "detection_time": "YYYY-MM-DD HH:MM:SS",
  "username": "twitter_username",
  "tweet_time": "tweet_timestamp",
  "tweet_text": "full_tweet_content",
  "tweet_url": "tweet_url",
  "contract_addresses": ["address1", "address2"]
}
```

## Troubleshooting

### Common Issues

#### Login Failures

- Verify credentials in .env
- Check account status on Twitter
- Ensure no unusual activity flags

#### Browser Issues

- Clear Chrome cache/cookies
- Update ChromeDriver
- Check proxy configuration

#### Detection Prevention

```python
# Add custom user agents in monitor.py
user_agents = [
    'your-custom-user-agent-1',
    'your-custom-user-agent-2'
]
```

### Recovery Steps

1. For account issues:

   - Implement longer cooldowns
   - Rotate to backup accounts
   - Verify account status

2. For browser issues:
   - Clear session data
   - Restart browser instance
   - Update stealth settings

## Maintenance

### Daily Tasks

- Monitor error logs
- Check account health
- Verify data storage

### Weekly Tasks

- Rotate account credentials
- Clean up old logs
- Update user agents
- Check proxy status

### Performance Optimization

- Adjust check intervals
- Fine-tune scroll behavior
- Update stealth parameters
- Monitor resource usage

## Security Considerations

- Keep credentials secure
- Rotate proxies regularly
- Monitor for detection patterns
- Update stealth configurations
- Regular security audits

## Limitations

- Twitter API rate limits
- Account suspension risks
- Network dependencies
- Browser resource usage
- IP blocking risks

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

## Acknowledgments

- Selenium WebDriver team
- Chrome DevTools Protocol
- Twitter's developer community

---

**Note:** This tool is for educational purposes only. Be sure to comply with Twitter's terms of service and rate limiting policies.
