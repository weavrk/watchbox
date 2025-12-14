# Weekly Content Regeneration Cron Job

## Quick Setup

Run the installer script:

```bash
./scripts/install-cron.sh
```

This will automatically add the cron job to run **every Saturday at 12:00 AM (midnight)**.

## What It Does

The cron job automatically:

1. **Updates Local Environment:**
   - Runs `node scripts/generate-explore-content.js`
   - Updates `data/streaming-movies-results.json`
   - Updates `data/streaming-shows-results.json`
   - Downloads new posters to `data/posters/`

2. **Updates Production Environment:**
   - Calls `POST https://weavrk.com/api/regenerate_explore_content.php?type=all`
   - Triggers the same regeneration on the production server
   - Updates the JSON files on GoDaddy

## Manual Installation

If you prefer to install manually:

```bash
crontab -e
```

Add this line:

```
0 0 * * 6 /Users/katherineweaver/Dropbox/Files/Work/06_Programming/x.Side\ Projects/watchbox/scripts/regenerate-content-cron.sh >> /Users/katherineweaver/Dropbox/Files/Work/06_Programming/x.Side\ Projects/watchbox/logs/cron.log 2>&1
```

## Verify Installation

Check if the cron job is installed:

```bash
crontab -l | grep watchbox
```

## Test the Script

Test the script manually before the first scheduled run:

```bash
./scripts/regenerate-content-cron.sh
```

Check the logs:

```bash
ls -lt logs/content-regeneration-*.log | head -1
```

## Schedule

- **Frequency**: Weekly
- **Day**: Saturday
- **Time**: 12:00 AM (midnight)
- **Cron Expression**: `0 0 * * 6`

## Logs

- **Location**: `logs/content-regeneration-YYYYMMDD-HHMMSS.log`
- **Cron output**: `logs/cron.log`
- **Retention**: Last 10 log files are kept automatically

## Troubleshooting

See `scripts/crontab-setup.md` for detailed troubleshooting instructions.

## Remove Cron Job

To remove the cron job:

```bash
crontab -e
# Delete the line with regenerate-content-cron.sh
```

Or:

```bash
crontab -l | grep -v "regenerate-content-cron.sh" | crontab -
```

