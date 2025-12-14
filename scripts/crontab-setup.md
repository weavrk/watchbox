# Cron Job Setup for WatchBox Content Regeneration

This document explains how to set up the weekly cron job to automatically regenerate explore content.

## Schedule

- **Frequency**: Weekly
- **Day**: Saturday
- **Time**: 12:00 AM (midnight)
- **Cron Expression**: `0 0 * * 6`

## Setup Instructions

### Option 1: Using crontab (Recommended)

1. **Open your crontab editor:**
   ```bash
   crontab -e
   ```

2. **Add the following line:**
   ```bash
   0 0 * * 6 /Users/katherineweaver/Dropbox/Files/Work/06_Programming/x.Side\ Projects/watchbox/scripts/regenerate-content-cron.sh >> /Users/katherineweaver/Dropbox/Files/Work/06_Programming/x.Side\ Projects/watchbox/logs/cron.log 2>&1
   ```

3. **Save and exit** (in vim: press `Esc`, type `:wq`, press Enter)

4. **Verify the cron job was added:**
   ```bash
   crontab -l
   ```

### Option 2: Using macOS LaunchAgent (Alternative for macOS)

If you prefer using LaunchAgent instead of cron:

1. **Create the LaunchAgent plist file:**
   ```bash
   nano ~/Library/LaunchAgents/com.watchbox.regenerate-content.plist
   ```

2. **Add the following content:**
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
   <dict>
       <key>Label</key>
       <string>com.watchbox.regenerate-content</string>
       <key>ProgramArguments</key>
       <array>
           <string>/Users/katherineweaver/Dropbox/Files/Work/06_Programming/x.Side Projects/watchbox/scripts/regenerate-content-cron.sh</string>
       </array>
       <key>StartCalendarInterval</key>
       <dict>
           <key>Weekday</key>
           <integer>6</integer>
           <key>Hour</key>
           <integer>0</integer>
           <key>Minute</key>
           <integer>0</integer>
       </dict>
       <key>StandardOutPath</key>
       <string>/Users/katherineweaver/Dropbox/Files/Work/06_Programming/x.Side Projects/watchbox/logs/launchagent.log</string>
       <key>StandardErrorPath</key>
       <string>/Users/katherineweaver/Dropbox/Files/Work/06_Programming/x.Side Projects/watchbox/logs/launchagent-error.log</string>
   </dict>
   </plist>
   ```

3. **Load the LaunchAgent:**
   ```bash
   launchctl load ~/Library/LaunchAgents/com.watchbox.regenerate-content.plist
   ```

4. **Verify it's loaded:**
   ```bash
   launchctl list | grep watchbox
   ```

## What the Script Does

1. **Local Environment:**
   - Runs `node scripts/generate-explore-content.js`
   - Updates `data/streaming-movies-results.json` and `data/streaming-shows-results.json`
   - Downloads new posters to `data/posters/`

2. **Production Environment:**
   - Calls `POST https://weavrk.com/api/regenerate_explore_content.php?type=all`
   - Triggers the PHP script to regenerate content on the server
   - Updates the same JSON files on the production server

## Logs

- **Location**: `logs/content-regeneration-YYYYMMDD-HHMMSS.log`
- **Retention**: Last 10 log files are kept automatically
- **Cron output**: `logs/cron.log` (if using crontab)

## Testing

To test the script manually:

```bash
# Run the script directly
./scripts/regenerate-content-cron.sh

# Or with full path
/Users/katherineweaver/Dropbox/Files/Work/06_Programming/x.Side\ Projects/watchbox/scripts/regenerate-content-cron.sh
```

## Troubleshooting

### Cron job not running?

1. **Check if cron has permission:**
   ```bash
   # macOS: Check System Preferences > Security & Privacy > Full Disk Access
   # Make sure Terminal (or your cron service) has Full Disk Access
   ```

2. **Check cron logs:**
   ```bash
   # macOS
   log show --predicate 'process == "cron"' --last 1h
   ```

3. **Verify the script is executable:**
   ```bash
   ls -l scripts/regenerate-content-cron.sh
   # Should show: -rwxr-xr-x
   ```

4. **Test the script manually:**
   ```bash
   ./scripts/regenerate-content-cron.sh
   ```

### Production endpoint not responding?

1. **Check if the URL is correct:**
   ```bash
   curl -X POST https://weavrk.com/api/regenerate_explore_content.php?type=all
   ```

2. **Verify the PHP script exists on the server:**
   - Check via FTP: `/public_html/api/regenerate_explore_content.php`
   - Ensure it has execute permissions

### Node.js not found?

1. **Check if Node.js is installed:**
   ```bash
   which node
   node --version
   ```

2. **If using nvm, ensure it's loaded in the cron environment:**
   ```bash
   # Add to the script:
   source ~/.nvm/nvm.sh
   nvm use default
   ```

## Updating the Schedule

To change when the cron job runs, edit the crontab:

```bash
crontab -e
```

**Common schedules:**
- Daily at midnight: `0 0 * * *`
- Weekly on Sunday: `0 0 * * 0`
- Weekly on Saturday: `0 0 * * 6` (current)
- Every 12 hours: `0 */12 * * *`
- Every day at 2 AM: `0 2 * * *`

## Notes

- The script runs both local and production regeneration
- Production regeneration is triggered via HTTP POST (non-blocking)
- Local regeneration runs synchronously and may take 4-5 minutes
- Logs are automatically rotated (keeps last 10 files)

