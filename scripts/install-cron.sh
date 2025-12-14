#!/bin/bash

# Install WatchBox Content Regeneration Cron Job
# This script adds the cron job to your crontab

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

CRON_ENTRY="0 0 * * 6 $PROJECT_ROOT/scripts/regenerate-content-cron.sh >> $PROJECT_ROOT/logs/cron.log 2>&1"

echo "WatchBox Cron Job Installer"
echo "=========================="
echo ""
echo "This will add the following cron job to your crontab:"
echo ""
echo "  $CRON_ENTRY"
echo ""
echo "Schedule: Every Saturday at 12:00 AM (midnight)"
echo ""

# Check if cron entry already exists
if crontab -l 2>/dev/null | grep -q "regenerate-content-cron.sh"; then
    echo "⚠️  A cron job for WatchBox content regeneration already exists."
    echo ""
    read -p "Do you want to replace it? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Installation cancelled."
        exit 0
    fi
    # Remove existing entry
    crontab -l 2>/dev/null | grep -v "regenerate-content-cron.sh" | crontab -
fi

# Add the new cron entry
(crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -

if [ $? -eq 0 ]; then
    echo "✅ Cron job installed successfully!"
    echo ""
    echo "To verify, run: crontab -l"
    echo "To remove, run: crontab -e (then delete the line)"
    echo ""
    echo "The cron job will run every Saturday at midnight."
else
    echo "❌ Failed to install cron job."
    exit 1
fi

