#!/usr/bin/env node

/**
 * Generate explore content JSON files from TMDB API
 * Fetches popular movies and shows, gets streaming providers, and downloads posters
 * 
 * Usage:
 *   node scripts/generate-explore-content.js
 *   node scripts/generate-explore-content.js --movies-only
 *   node scripts/generate-explore-content.js --shows-only
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// TMDB API configuration
const TMDB_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2NGEzNjhkMDJlN2Y2NTI0MmU2M2YxMGFhMTMwZTkxZiIsIm5iZiI6MTY1Nzg0MDg4OS44NTY5OTk5LCJzdWIiOiI2MmQwYTRmOTYyZmNkMzAwNTU0NWFjZWEiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.TxRfKQMNiojwSNluc8kpo0SxCev8mwIC_RDQXmvjRAg';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500'; // w500 is a good size for posters

// Paths
const POSTERS_DIR = path.join(__dirname, '..', 'data', 'posters');
const DATA_DIR = path.join(__dirname, '..', 'data');
const MOVIES_JSON = path.join(DATA_DIR, 'streaming-movies-results.json');
const SHOWS_JSON = path.join(DATA_DIR, 'streaming-shows-results.json');
const MAX_POSTERS = 1000;

// Delay between requests to avoid rate limiting
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Service name mapping from TMDB to our format
const SERVICE_MAP = {
  'Netflix': 'netflix',
  'Hulu': 'hulu',
  'Disney Plus': 'disneyplus',
  'Apple TV Plus': 'appletv',
  'HBO Max': 'hbomax',
  'Max': 'hbomax',
  'Amazon Prime Video': 'prime',
  'Peacock': 'peacock',
  'Paramount Plus': 'paramount',
  'Paramount+': 'paramount'
};

/**
 * Generate a filename-safe string from title
 */
function generatePosterFilename(title, tmdbId) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    + '.jpg';
}

/**
 * Get service key from TMDB provider name
 */
function getServiceKey(providerName) {
  return SERVICE_MAP[providerName] || providerName.toLowerCase().replace(/\s+/g, '');
}

/**
 * Check if a movie is anime
 */
function isAnime(movie) {
  // Check if it's Japanese animation
  if (movie.original_language === 'ja' && movie.genre_ids && movie.genre_ids.includes(16)) {
    return true;
  }
  // Check title for common anime indicators
  const titleLower = movie.title.toLowerCase();
  const animeKeywords = ['anime', 'ghibli', 'studio ghibli', 'pokemon', 'dragon ball', 'naruto', 'one piece', 'attack on titan'];
  return animeKeywords.some(keyword => titleLower.includes(keyword));
}

/**
 * Check if a movie is horror
 */
function isHorror(movie) {
  // Horror genre ID in TMDB is 27
  if (movie.genre_ids && movie.genre_ids.includes(27)) {
    return true;
  }
  return false;
}

/**
 * Check if content is rated G
 * Note: TMDB discover endpoint may not include certification in initial results
 * We'll filter this during processing when we fetch full details
 */
function isRatedG(item) {
  // Check certification field if available
  if (item.certification && item.certification === 'G') {
    return true;
  }
  // Check release_dates for movies
  if (item.release_dates && item.release_dates.results) {
    const usRelease = item.release_dates.results.find(r => r.iso_3166_1 === 'US');
    if (usRelease && usRelease.release_dates) {
      const gRating = usRelease.release_dates.find(rd => rd.certification === 'G');
      if (gRating) return true;
    }
  }
  // Check content_ratings for TV shows
  if (item.content_ratings && item.content_ratings.results) {
    const usRating = item.content_ratings.results.find(r => r.iso_3166_1 === 'US');
    if (usRating && usRating.rating === 'TV-G') {
      return true;
    }
  }
  return false;
}

/**
 * Check if movie is from last 10 years
 */
function isRecentMovie(movie) {
  if (!movie.release_date) return false;
  const releaseYear = new Date(movie.release_date).getFullYear();
  const currentYear = new Date().getFullYear();
  const tenYearsAgo = currentYear - 10;
  return releaseYear >= tenYearsAgo;
}

/**
 * Fetch popular movies from TMDB (last 10 years)
 * Fetches until we have 400 items
 */
async function fetchPopularMovies() {
  const movies = [];
  const currentYear = new Date().getFullYear();
  const tenYearsAgo = currentYear - 10;
  const startDate = `${tenYearsAgo}-01-01`;
  const endDate = `${currentYear}-12-31`;
  const targetCount = 400;
  let page = 1;
  const maxPages = 50; // Safety limit
  
  // Use discover endpoint to filter by date range
  while (movies.length < targetCount && page <= maxPages) {
    try {
      // Discover movies from last 10 years, sorted by popularity
      const url = `${TMDB_BASE_URL}/discover/movie?language=en-US&page=${page}&region=US&sort_by=popularity.desc&primary_release_date.gte=${startDate}&primary_release_date.lte=${endDate}&with_original_language=en`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${TMDB_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error(`Failed to fetch movies page ${page}: HTTP ${response.status}`);
        break;
      }
      
      const data = await response.json();
      if (!data.results || data.results.length === 0) {
        break; // No more results
      }
      
      // Filter to only recent movies (keep all, including anime/horror/G-rated)
      const filteredMovies = data.results.filter(movie => isRecentMovie(movie));
      
      // Add movies up to target count
      const remaining = targetCount - movies.length;
      movies.push(...filteredMovies.slice(0, remaining));
      
      console.log(`Fetched ${filteredMovies.length} movies from page ${page} (filtered from ${data.results.length}), total: ${movies.length}/${targetCount}`);
      
      if (movies.length >= targetCount) {
        break; // We have enough
      }
      
      page++;
      await delay(250); // Rate limiting
    } catch (error) {
      console.error(`Error fetching movies page ${page}:`, error.message);
      break;
    }
  }
  
  return movies.slice(0, targetCount); // Ensure exactly 400
}

/**
 * Fetch popular TV shows from TMDB
 * Fetches until we have 400 items
 */
async function fetchPopularShows() {
  const shows = [];
  const targetCount = 400;
  let page = 1;
  const maxPages = 40; // Safety limit (40 pages * 20 items = 800 max)
  
  while (shows.length < targetCount && page <= maxPages) {
    try {
      const url = `${TMDB_BASE_URL}/tv/popular?language=en-US&page=${page}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${TMDB_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error(`Failed to fetch shows page ${page}: HTTP ${response.status}`);
        break;
      }
      
      const data = await response.json();
      if (!data.results || data.results.length === 0) {
        break; // No more results
      }
      
      // Add shows up to target count
      const remaining = targetCount - shows.length;
      shows.push(...data.results.slice(0, remaining));
      
      console.log(`Fetched ${data.results.length} shows from page ${page}, total: ${shows.length}/${targetCount}`);
      
      if (shows.length >= targetCount) {
        break; // We have enough
      }
      
      page++;
      await delay(250); // Rate limiting
    } catch (error) {
      console.error(`Error fetching shows page ${page}:`, error.message);
      break;
    }
  }
  
  return shows.slice(0, targetCount); // Ensure exactly 400
}

/**
 * Get movie details including certification
 */
async function getMovieDetails(tmdbId) {
  try {
    const url = `${TMDB_BASE_URL}/movie/${tmdbId}?language=en-US&append_to_response=release_dates`;
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
    console.error(`Error fetching movie details for ${tmdbId}:`, error.message);
    return null;
  }
}

/**
 * Check if movie is rated G or PG
 */
function isMovieRatedGOrPG(movieDetails) {
  if (!movieDetails || !movieDetails.release_dates) return false;
  
  const usRelease = movieDetails.release_dates.results?.find(r => r.iso_3166_1 === 'US');
  if (usRelease && usRelease.release_dates) {
    const rating = usRelease.release_dates.find(rd => 
      rd.certification === 'G' || rd.certification === 'PG'
    );
    return !!rating;
  }
  return false;
}

/**
 * Get streaming providers for a movie
 */
async function getMovieProviders(tmdbId) {
  try {
    const url = `${TMDB_BASE_URL}/movie/${tmdbId}/watch/providers?language=en-US&watch_region=US`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${TMDB_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    const providers = data.results?.US?.flatrate || [];
    
    return providers.map(p => getServiceKey(p.provider_name)).filter(Boolean);
  } catch (error) {
    console.error(`Error fetching providers for movie ${tmdbId}:`, error.message);
    return [];
  }
}

/**
 * Get TV show details including content ratings
 */
async function getShowDetails(tmdbId) {
  try {
    const url = `${TMDB_BASE_URL}/tv/${tmdbId}?language=en-US&append_to_response=content_ratings`;
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
    console.error(`Error fetching show details for ${tmdbId}:`, error.message);
    return null;
  }
}

/**
 * Check if TV show is rated TV-G or TV-PG
 */
function isShowRatedGOrPG(showDetails) {
  if (!showDetails || !showDetails.content_ratings) return false;
  
  const usRating = showDetails.content_ratings.results?.find(r => r.iso_3166_1 === 'US');
  if (usRating && (usRating.rating === 'TV-G' || usRating.rating === 'TV-PG')) {
    return true;
  }
  return false;
}

/**
 * Get streaming providers for a TV show
 */
async function getShowProviders(tmdbId) {
  try {
    const url = `${TMDB_BASE_URL}/tv/${tmdbId}/watch/providers?language=en-US&watch_region=US`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${TMDB_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    const providers = data.results?.US?.flatrate || [];
    
    return providers.map(p => getServiceKey(p.provider_name)).filter(Boolean);
  } catch (error) {
    console.error(`Error fetching providers for show ${tmdbId}:`, error.message);
    return [];
  }
}

/**
 * Get poster metadata with release dates for replacement logic
 */
function getPosterMetadata() {
  const metadata = [];
  
  // Read JSON files to get release dates
  if (fs.existsSync(MOVIES_JSON) && fs.existsSync(SHOWS_JSON)) {
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
  }
  
  return metadata;
}

/**
 * Get oldest posters to replace
 */
function getOldestPosters(count = 1) {
  const metadata = getPosterMetadata();
  // Sort by date (oldest first)
  metadata.sort((a, b) => a.timestamp - b.timestamp);
  return metadata.slice(0, count).map(m => m.filename);
}

/**
 * Download poster image, replacing oldest if at limit
 */
async function downloadPosterIfNeeded(posterPath, filename, releaseDate, currentPosterCount) {
  const filepath = path.join(POSTERS_DIR, filename);
  
  // Check if poster already exists
  if (fs.existsSync(filepath)) {
    return true; // Already exists, skip download
  }
  
  if (!posterPath) {
    return false; // No poster available
  }
  
  // If at limit, replace oldest poster
  if (currentPosterCount >= MAX_POSTERS) {
    const oldestPosters = getOldestPosters(1);
    if (oldestPosters.length > 0) {
      const oldestFile = oldestPosters[0];
      const oldestPath = path.join(POSTERS_DIR, oldestFile);
      
      // Only replace if new poster is newer than oldest
      if (releaseDate) {
        const oldestMetadata = getPosterMetadata().find(m => m.filename === oldestFile);
        if (oldestMetadata && new Date(releaseDate).getTime() > oldestMetadata.timestamp) {
          console.log(`  ↻ Replacing oldest poster: ${oldestFile}`);
          fs.unlinkSync(oldestPath);
        } else {
          console.log(`  ⚠ Poster limit reached, skipping (newer than oldest)`);
          return false;
        }
      } else {
        // No release date, just replace oldest
        console.log(`  ↻ Replacing oldest poster: ${oldestFile}`);
        fs.unlinkSync(oldestPath);
      }
    } else {
      console.log(`  ⚠ Poster limit reached (${MAX_POSTERS}), skipping download`);
      return false;
    }
  }
  
  try {
    const imageUrl = `${TMDB_IMAGE_BASE}${posterPath}`;
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      console.error(`  ✗ Failed to download poster: HTTP ${response.status}`);
      return false;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(filepath, buffer);
    
    // Set file permissions (readable/writable on GoDaddy)
    fs.chmodSync(filepath, 0o644);
    
    return true;
  } catch (error) {
    console.error(`  ✗ Failed to download poster:`, error.message);
    return false;
  }
}

/**
 * Process movies and generate JSON
 */
async function processMovies() {
  console.log('\n=== Fetching Popular Movies ===\n');
  const movies = await fetchPopularMovies(); // Fetches until we have 200 after filtering
  
  console.log(`\n=== Processing ${movies.length} Movies ===\n`);
  const results = [];
  let posterCount = 0;
  
  // Count existing posters
  if (fs.existsSync(POSTERS_DIR)) {
    const existingPosters = fs.readdirSync(POSTERS_DIR).filter(f => f.endsWith('.jpg'));
    posterCount = existingPosters.length;
  }
  
  for (let i = 0; i < movies.length; i++) {
    const movie = movies[i];
    const tmdbId = movie.id;
    
    console.log(`[${i + 1}/${movies.length}] Processing: ${movie.title} (ID: ${tmdbId})`);
    
    // Get movie details to check rating and genre
    const movieDetails = await getMovieDetails(tmdbId);
    await delay(250);
    
    // Skip if rated G or PG
    if (movieDetails && isMovieRatedGOrPG(movieDetails)) {
      console.log(`  ⚠ Skipping G/PG-rated movie: ${movie.title}`);
      continue;
    }
    
    // Check if movie should be deprioritized (anime or horror)
    const isDeprioritized = movieDetails && (
      isAnime(movie) || 
      isHorror(movie)
    );
    
    // Get streaming providers
    const services = await getMovieProviders(tmdbId);
    await delay(250);
    
    // Generate poster filename
    const posterFilename = generatePosterFilename(movie.title, tmdbId);
    
    // Download poster if needed
    if (movie.poster_path) {
      const downloaded = await downloadPosterIfNeeded(movie.poster_path, posterFilename, movie.release_date, posterCount);
      if (downloaded) {
        posterCount++;
      }
      await delay(250);
    }
    
    // Create result object with priority flag
    const result = {
      id: `${posterFilename.replace('.jpg', '')}-${tmdbId}`,
      title: movie.title,
      tmdb_id: tmdbId,
      poster_filename: posterFilename,
      listType: 'top',
      services: services,
      release_date: movie.release_date || null,
      isMovie: true,
      _priority: isDeprioritized ? 0 : 1 // 1 = high priority, 0 = low priority
    };
    
    results.push(result);
  }
  
  // Sort results: high priority first, then low priority
  results.sort((a, b) => (b._priority || 0) - (a._priority || 0));
  
  // Remove the _priority field before saving (it's just for sorting)
  results.forEach(result => delete result._priority);
  
  // Write JSON file
  fs.writeFileSync(MOVIES_JSON, JSON.stringify(results, null, 2));
  fs.chmodSync(MOVIES_JSON, 0o644); // Readable/writable on GoDaddy
  
  console.log(`\n✓ Saved ${results.length} movies to ${path.basename(MOVIES_JSON)}`);
  console.log(`✓ Total posters in database: ${posterCount}`);
  
  return results;
}

/**
 * Process TV shows and generate JSON
 */
async function processShows() {
  console.log('\n=== Fetching Popular TV Shows ===\n');
  const shows = await fetchPopularShows(); // Fetches until we have 200
  
  console.log(`\n=== Processing ${shows.length} Shows ===\n`);
  const results = [];
  let posterCount = 0;
  
  // Count existing posters
  if (fs.existsSync(POSTERS_DIR)) {
    const existingPosters = fs.readdirSync(POSTERS_DIR).filter(f => f.endsWith('.jpg'));
    posterCount = existingPosters.length;
  }
  
  for (let i = 0; i < shows.length; i++) {
    const show = shows[i];
    const tmdbId = show.id;
    
    console.log(`[${i + 1}/${shows.length}] Processing: ${show.name} (ID: ${tmdbId})`);
    
    // Get show details to check rating
    const showDetails = await getShowDetails(tmdbId);
    await delay(250);
    
    // Skip if rated TV-G or TV-PG
    if (showDetails && isShowRatedGOrPG(showDetails)) {
      console.log(`  ⚠ Skipping TV-G/TV-PG rated show: ${show.name}`);
      continue;
    }
    
    // Shows don't need deprioritization (no anime/horror for shows)
    const isDeprioritized = false;
    
    // Get streaming providers
    const services = await getShowProviders(tmdbId);
    await delay(250);
    
    // Generate poster filename
    const posterFilename = generatePosterFilename(show.name, tmdbId);
    
    // Download poster if needed
    if (show.poster_path) {
      const downloaded = await downloadPosterIfNeeded(show.poster_path, posterFilename, show.first_air_date, posterCount);
      if (downloaded) {
        posterCount++;
      }
      await delay(250);
    }
    
    // Create result object with priority flag
    const result = {
      id: `${posterFilename.replace('.jpg', '')}-${tmdbId}`,
      title: show.name,
      tmdb_id: tmdbId,
      poster_filename: posterFilename,
      listType: 'top',
      services: services,
      first_air_date: show.first_air_date || null,
      isMovie: false,
      _priority: isDeprioritized ? 0 : 1 // 1 = high priority, 0 = low priority
    };
    
    results.push(result);
  }
  
  // Sort results: high priority first, then low priority
  results.sort((a, b) => (b._priority || 0) - (a._priority || 0));
  
  // Remove the _priority field before saving (it's just for sorting)
  results.forEach(result => delete result._priority);
  
  // Write JSON file
  fs.writeFileSync(SHOWS_JSON, JSON.stringify(results, null, 2));
  fs.chmodSync(SHOWS_JSON, 0o644); // Readable/writable on GoDaddy
  
  console.log(`\n✓ Saved ${results.length} shows to ${path.basename(SHOWS_JSON)}`);
  console.log(`✓ Total posters in database: ${posterCount}`);
  
  return results;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const moviesOnly = args.includes('--movies-only');
  const showsOnly = args.includes('--shows-only');
  
  // Ensure directories exist
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.chmodSync(DATA_DIR, 0o755); // Readable/writable/executable on GoDaddy
  }
  if (!fs.existsSync(POSTERS_DIR)) {
    fs.mkdirSync(POSTERS_DIR, { recursive: true });
    fs.chmodSync(POSTERS_DIR, 0o755); // Readable/writable/executable on GoDaddy
  }
  
  console.log('🎬 WatchBox Explore Content Generator');
  console.log('=====================================\n');
  
  try {
    if (moviesOnly) {
      await processMovies();
    } else if (showsOnly) {
      await processShows();
    } else {
      await processMovies();
      await processShows();
    }
    
    console.log('\n✅ All done!');
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
main();

