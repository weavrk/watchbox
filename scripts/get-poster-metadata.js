#!/usr/bin/env node

/**
 * Helper script to get poster metadata (release dates) for replacement logic
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const POSTERS_DIR = path.join(__dirname, '..', 'data', 'posters');
const MOVIES_JSON = path.join(__dirname, '..', 'data', 'streaming-movies-results.json');
const SHOWS_JSON = path.join(__dirname, '..', 'data', 'streaming-shows-results.json');

/**
 * Get poster metadata with release dates
 */
function getPosterMetadata() {
  const metadata = [];
  
  // Read JSON files
  const movies = JSON.parse(fs.readFileSync(MOVIES_JSON, 'utf8'));
  const shows = JSON.parse(fs.readFileSync(SHOWS_JSON, 'utf8'));
  const all = [...movies, ...shows];
  
  // Get existing poster files
  const existingFiles = fs.readdirSync(POSTERS_DIR).filter(f => f.endsWith('.jpg'));
  
  // Create a map of filename to release date
  const filenameToDate = new Map();
  all.forEach(item => {
    const date = item.isMovie ? item.release_date : item.first_air_date;
    if (date && item.poster_filename) {
      filenameToDate.set(item.poster_filename, date);
    }
  });
  
  // Build metadata for existing posters
  existingFiles.forEach(filename => {
    const date = filenameToDate.get(filename);
    if (date) {
      metadata.push({
        filename,
        date: new Date(date),
        timestamp: new Date(date).getTime()
      });
    } else {
      // For posters not in current JSON, use file modification time as fallback
      const filepath = path.join(POSTERS_DIR, filename);
      const stats = fs.statSync(filepath);
      metadata.push({
        filename,
        date: stats.mtime,
        timestamp: stats.mtime.getTime()
      });
    }
  });
  
  return metadata;
}

/**
 * Get oldest posters to replace
 */
export function getOldestPosters(count = 1) {
  const metadata = getPosterMetadata();
  // Sort by date (oldest first)
  metadata.sort((a, b) => a.timestamp - b.timestamp);
  return metadata.slice(0, count).map(m => m.filename);
}

// Export for use in other scripts
if (import.meta.url === `file://${process.argv[1]}`) {
  const oldest = getOldestPosters(10);
  console.log('Oldest 10 posters:');
  oldest.forEach(f => console.log('  -', f));
}

