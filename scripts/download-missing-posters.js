#!/usr/bin/env node

/**
 * Download missing poster images from TMDB
 * Reads missing-posters.json and downloads each poster image
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TMDB_API_KEY = '64a368d02e7f65242e63f10aa130e91f';
const TMDB_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2NGEzNjhkMDJlN2Y2NTI0MmU2M2YxMGFhMTMwZTkxZiIsIm5iZiI6MTY1Nzg0MDg4OS44NTY5OTk5LCJzdWIiOiI2MmQwYTRmOTYyZmNkMzAwNTU0NWFjZWEiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.TxRfKQMNiojwSNluc8kpo0SxCev8mwIC_RDQXmvjRAg';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500'; // w500 is a good size for posters

const POSTERS_DIR = path.join(__dirname, '..', 'data', 'posters');
const MISSING_POSTERS_FILE = path.join(__dirname, '..', 'missing-posters.json');

// Delay between requests to avoid rate limiting
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchTMDBDetails(tmdbId, isMovie) {
  const endpoint = isMovie ? 'movie' : 'tv';
  const url = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?language=en-US`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${TMDB_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch TMDB details for ${tmdbId}:`, error.message);
    return null;
  }
}

async function downloadImage(imageUrl, filepath) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(filepath, buffer);
    return true;
  } catch (error) {
    console.error(`Failed to download image from ${imageUrl}:`, error.message);
    return false;
  }
}

async function downloadMissingPosters() {
  // Read missing posters list
  if (!fs.existsSync(MISSING_POSTERS_FILE)) {
    console.error(`Missing posters file not found: ${MISSING_POSTERS_FILE}`);
    process.exit(1);
  }
  
  const missingPosters = JSON.parse(fs.readFileSync(MISSING_POSTERS_FILE, 'utf8'));
  console.log(`Found ${missingPosters.length} missing posters to download\n`);
  
  let successCount = 0;
  let failCount = 0;
  const failed = [];
  
  for (let i = 0; i < missingPosters.length; i++) {
    const item = missingPosters[i];
    const filepath = path.join(POSTERS_DIR, item.filename);
    
    // Skip if file already exists
    if (fs.existsSync(filepath)) {
      console.log(`[${i + 1}/${missingPosters.length}] ✓ ${item.filename} already exists`);
      successCount++;
      continue;
    }
    
    console.log(`[${i + 1}/${missingPosters.length}] Fetching ${item.title} (TMDB ID: ${item.tmdb_id})...`);
    
    // Fetch details from TMDB
    const details = await fetchTMDBDetails(item.tmdb_id, item.isMovie);
    
    if (!details || !details.poster_path) {
      console.log(`  ✗ No poster found for ${item.title}`);
      failCount++;
      failed.push(item);
      await delay(250); // Still delay to avoid rate limiting
      continue;
    }
    
    // Download poster image
    const imageUrl = `${TMDB_IMAGE_BASE}${details.poster_path}`;
    const success = await downloadImage(imageUrl, filepath);
    
    if (success) {
      console.log(`  ✓ Downloaded ${item.filename}`);
      successCount++;
    } else {
      console.log(`  ✗ Failed to download ${item.filename}`);
      failCount++;
      failed.push(item);
    }
    
    // Delay to avoid rate limiting (TMDB allows 40 requests per 10 seconds)
    await delay(250);
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`Successfully downloaded: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  
  if (failed.length > 0) {
    console.log(`\nFailed items:`);
    failed.forEach(item => {
      console.log(`  - ${item.filename} (${item.title}, TMDB ID: ${item.tmdb_id})`);
    });
    
    // Save failed items to a new file
    const failedFile = path.join(__dirname, '..', 'failed-posters.json');
    fs.writeFileSync(failedFile, JSON.stringify(failed, null, 2));
    console.log(`\nFailed items saved to: failed-posters.json`);
  }
}

// Run the script
downloadMissingPosters().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

