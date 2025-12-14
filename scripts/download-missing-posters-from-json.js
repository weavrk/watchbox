#!/usr/bin/env node

/**
 * Download missing poster images for items in the JSON files
 * This script checks which posters are missing and downloads them from TMDB
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// TMDB API configuration
const TMDB_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2NGEzNjhkMDJlN2Y2NTI0MmU2M2YxMGFhMTMwZTkxZiIsIm5iZiI6MTY1Nzg0MDg4OS44NTY5OTk5LCJzdWIiOiI2MmQwYTRmOTYyZmNkMzAwNTU0NWFjZWEiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.TxRfKQMNiojwSNluc8kpo0SxCev8mwIC_RDQXmvjRAg';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

// Paths
const POSTERS_DIR = path.join(__dirname, '..', 'data', 'posters');
const MOVIES_JSON = path.join(__dirname, '..', 'data', 'streaming-movies-results.json');
const SHOWS_JSON = path.join(__dirname, '..', 'data', 'streaming-shows-results.json');

// Delay between requests
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch movie details from TMDB
 */
async function fetchMovieDetails(tmdbId) {
  try {
    const url = `${TMDB_BASE_URL}/movie/${tmdbId}?language=en-US`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${TMDB_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch movie ${tmdbId}:`, error.message);
    return null;
  }
}

/**
 * Fetch TV show details from TMDB
 */
async function fetchShowDetails(tmdbId) {
  try {
    const url = `${TMDB_BASE_URL}/tv/${tmdbId}?language=en-US`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${TMDB_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch show ${tmdbId}:`, error.message);
    return null;
  }
}

/**
 * Download poster image
 */
async function downloadPoster(posterPath, filepath) {
  try {
    const imageUrl = `${TMDB_IMAGE_BASE}${posterPath}`;
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(filepath, buffer);
    fs.chmodSync(filepath, 0o644);
    
    return true;
  } catch (error) {
    console.error(`Failed to download poster:`, error.message);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Finding missing poster images...\n');
  
  // Read JSON files
  const movies = JSON.parse(fs.readFileSync(MOVIES_JSON, 'utf8'));
  const shows = JSON.parse(fs.readFileSync(SHOWS_JSON, 'utf8'));
  const all = [...movies, ...shows];
  
  // Get existing poster files
  const existingFiles = new Set(fs.readdirSync(POSTERS_DIR));
  
  // Find missing posters
  const missing = all.filter(item => !existingFiles.has(item.poster_filename));
  
  console.log(`Found ${missing.length} missing posters out of ${all.length} total items\n`);
  
  if (missing.length === 0) {
    console.log('✅ All posters are present!');
    return;
  }
  
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < missing.length; i++) {
    const item = missing[i];
    const filepath = path.join(POSTERS_DIR, item.poster_filename);
    
    console.log(`[${i + 1}/${missing.length}] ${item.title} (${item.isMovie ? 'Movie' : 'Show'}, ID: ${item.tmdb_id})`);
    
    // Fetch details from TMDB
    const details = item.isMovie 
      ? await fetchMovieDetails(item.tmdb_id)
      : await fetchShowDetails(item.tmdb_id);
    
    await delay(250);
    
    if (!details || !details.poster_path) {
      console.log(`  ✗ No poster found`);
      failCount++;
      continue;
    }
    
    // Download poster
    const success = await downloadPoster(details.poster_path, filepath);
    await delay(250);
    
    if (success) {
      console.log(`  ✓ Downloaded ${item.poster_filename}`);
      successCount++;
    } else {
      console.log(`  ✗ Failed to download`);
      failCount++;
    }
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`Successfully downloaded: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Total missing: ${missing.length}`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

