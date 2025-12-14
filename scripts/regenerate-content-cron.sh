#!/bin/bash

# WatchBox Content Regeneration Cron Job
# Runs weekly to update explore content for both local and production environments
#
# Usage: ./scripts/regenerate-content-cron.sh
# This script is designed to be run via cron job

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Log file location
LOG_DIR="$PROJECT_ROOT/logs"
LOG_FILE="$LOG_DIR/content-regeneration-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$LOG_DIR"

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to log errors
log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" | tee -a "$LOG_FILE" >&2
}

log "=========================================="
log "WatchBox Content Regeneration Started"
log "=========================================="

# Change to project root directory
cd "$PROJECT_ROOT" || {
    log_error "Failed to change to project directory: $PROJECT_ROOT"
    exit 1
}

# ============================================
# LOCAL ENVIRONMENT
# ============================================
log ""
log "--- LOCAL ENVIRONMENT ---"

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed or not in PATH"
else
    log "Node.js version: $(node --version)"
    
    # Check if npm dependencies are installed
    if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
        log "Installing npm dependencies..."
        npm install >> "$LOG_FILE" 2>&1
        if [ $? -ne 0 ]; then
            log_error "Failed to install npm dependencies"
        else
            log "✅ npm dependencies installed"
        fi
    fi
    
    # Run local generation script
    log "Running local content generation..."
    node "$SCRIPT_DIR/generate-explore-content.js" >> "$LOG_FILE" 2>&1
    
    if [ $? -eq 0 ]; then
        log "✅ Local content regeneration completed successfully"
    else
        log_error "Local content regeneration failed"
    fi
fi

# ============================================
# PRODUCTION ENVIRONMENT
# ============================================
log ""
log "--- PRODUCTION ENVIRONMENT ---"

# Production URL (update this if your production URL is different)
PROD_URL="https://weavrk.com/api/regenerate_explore_content.php"

# Check if curl is available
if ! command -v curl &> /dev/null; then
    log_error "curl is not installed or not in PATH"
else
    log "Triggering production content regeneration..."
    log "URL: $PROD_URL"
    
    # Call the PHP endpoint
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$PROD_URL?type=all")
    
    if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 202 ]; then
        log "✅ Production content regeneration triggered successfully (HTTP $HTTP_CODE)"
        log "Note: Production regeneration runs asynchronously and may take several minutes"
    else
        log_error "Production content regeneration failed (HTTP $HTTP_CODE)"
        # Try to get error response
        RESPONSE=$(curl -s -X POST "$PROD_URL?type=all")
        log "Response: $RESPONSE"
    fi
fi

# ============================================
# SUMMARY
# ============================================
log ""
log "=========================================="
log "Content Regeneration Completed"
log "Log file: $LOG_FILE"
log "=========================================="

# Keep only last 10 log files to prevent disk space issues
cd "$LOG_DIR" || exit
ls -t content-regeneration-*.log 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null

exit 0

