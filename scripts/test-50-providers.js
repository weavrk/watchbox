/**
 * Test 50 movies/shows from actual data to see if TMDB returns provider data
 * Tests both TMDB directly and our PHP endpoint
 */

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TMDB_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2NGEzNjhkMDJlN2Y2NTI0MmU2M2YxMGFhMTMwZTkxZiIsIm5iZiI6MTY1Nzg0MDg4OS44NTY5OTk5LCJzdWIiOiI2MmQwYTRmOTYyZmNkMzAwNTU0NWFjZWEiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.TxRfKQMNiojwSNluc8kpo0SxCev8mwIC_RDQXmvjRAg';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Load actual data files
const moviesFile = path.join(__dirname, '../data/streaming-movies-results.json');
const showsFile = path.join(__dirname, '../data/streaming-shows-results.json');

const movies = JSON.parse(fs.readFileSync(moviesFile, 'utf-8'));
const shows = JSON.parse(fs.readFileSync(showsFile, 'utf-8'));

// Get 25 movies and 25 shows
const testMovies = movies.slice(0, 25).map(m => ({ ...m, isMovie: true }));
const testShows = shows.slice(0, 25).map(s => ({ ...s, isMovie: false }));
const testItems = [...testMovies, ...testShows];

console.log(`Loaded ${testItems.length} items to test (${testMovies.length} movies, ${testShows.length} shows)\n`);

function testTMDBDirect(tmdbId, isMovie, name) {
  return new Promise((resolve) => {
    const type = isMovie ? 'movie' : 'tv';
    const path = `/${type}/${tmdbId}/watch/providers?language=en-US&watch_region=US`;
    
    const options = {
      hostname: 'api.themoviedb.org',
      path: `/3${path}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TMDB_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      rejectUnauthorized: false
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            resolve({
              success: false,
              error: `HTTP ${res.statusCode}`,
              name,
              tmdbId,
              isMovie
            });
            return;
          }
          
          const jsonData = JSON.parse(data);
          const hasResults = jsonData.results && typeof jsonData.results === 'object';
          const hasUS = hasResults && jsonData.results.US;
          const hasFlatrate = hasUS && Array.isArray(jsonData.results.US.flatrate) && jsonData.results.US.flatrate.length > 0;
          const providers = hasFlatrate ? jsonData.results.US.flatrate : [];
          
          resolve({
            success: true,
            name,
            tmdbId,
            isMovie,
            hasProviders: hasFlatrate,
            providerCount: providers.length,
            providers: providers.map(p => p.provider_name),
            hasResults,
            hasUS
          });
        } catch (error) {
          resolve({
            success: false,
            error: `Parse error: ${error.message}`,
            name,
            tmdbId,
            isMovie
          });
        }
      });
    });
    
    req.on('error', (error) => {
      resolve({
        success: false,
        error: error.message,
        name,
        tmdbId,
        isMovie
      });
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({
        success: false,
        error: 'Timeout',
        name,
        tmdbId,
        isMovie
      });
    });
    
    req.end();
  });
}

function testPHPEndpoint(tmdbId, isMovie, name) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 8000,
      path: `/api/get_item_details.php?tmdb_id=${tmdbId}&is_movie=${isMovie}`,
      method: 'GET'
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          const hasProviders = jsonData.data && Array.isArray(jsonData.data.providers) && jsonData.data.providers.length > 0;
          
          resolve({
            success: jsonData.success === true,
            httpStatus: res.statusCode,
            name,
            tmdbId,
            isMovie,
            hasProviders,
            providerCount: jsonData.data?.providers?.length || 0,
            providers: jsonData.data?.providers?.map(p => p.provider_name) || [],
            error: jsonData.error
          });
        } catch (error) {
          resolve({
            success: false,
            httpStatus: res.statusCode,
            error: `Parse error: ${error.message}`,
            rawData: data.substring(0, 200),
            name,
            tmdbId,
            isMovie
          });
        }
      });
    });
    
    req.on('error', (error) => {
      resolve({
        success: false,
        error: error.message,
        name,
        tmdbId,
        isMovie
      });
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({
        success: false,
        error: 'Timeout',
        name,
        tmdbId,
        isMovie
      });
    });
    
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing TMDB Watch Providers API (Direct)...\n');
  
  const tmdbResults = [];
  let count = 0;
  
  for (const item of testItems) {
    count++;
    process.stdout.write(`[${count}/${testItems.length}] Testing TMDB: ${item.title} (${item.isMovie ? 'Movie' : 'TV'}) - ID: ${item.tmdb_id}... `);
    
    const result = await testTMDBDirect(item.tmdb_id, item.isMovie, item.title);
    tmdbResults.push(result);
    
    if (result.success) {
      if (result.hasProviders) {
        console.log(`✅ ${result.providerCount} providers: ${result.providers.slice(0, 3).join(', ')}${result.providers.length > 3 ? '...' : ''}`);
      } else {
        console.log(`⚠️  No providers`);
      }
    } else {
      console.log(`❌ ${result.error}`);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n🔧 Testing PHP Endpoint...\n');
  
  const phpResults = [];
  count = 0;
  
  // Test first 10 items through PHP endpoint
  for (const item of testItems.slice(0, 10)) {
    count++;
    process.stdout.write(`[${count}/10] Testing PHP: ${item.title} (${item.isMovie ? 'Movie' : 'TV'}) - ID: ${item.tmdb_id}... `);
    
    const result = await testPHPEndpoint(item.tmdb_id, item.isMovie, item.title);
    phpResults.push(result);
    
    if (result.success) {
      if (result.hasProviders) {
        console.log(`✅ ${result.providerCount} providers: ${result.providers.slice(0, 3).join(', ')}${result.providers.length > 3 ? '...' : ''}`);
      } else {
        console.log(`⚠️  No providers (HTTP ${result.httpStatus})`);
      }
    } else {
      console.log(`❌ ${result.error || `HTTP ${result.httpStatus}`}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY - TMDB DIRECT API');
  console.log('='.repeat(60));
  
  const tmdbSuccessful = tmdbResults.filter(r => r.success);
  const tmdbWithProviders = tmdbResults.filter(r => r.success && r.hasProviders);
  const tmdbWithoutProviders = tmdbResults.filter(r => r.success && !r.hasProviders);
  const tmdbErrors = tmdbResults.filter(r => !r.success);
  
  console.log(`Total tested: ${tmdbResults.length}`);
  console.log(`✅ Successful API calls: ${tmdbSuccessful.length}`);
  console.log(`✅ With providers: ${tmdbWithProviders.length} (${((tmdbWithProviders.length / tmdbResults.length) * 100).toFixed(1)}%)`);
  console.log(`⚠️  Without providers: ${tmdbWithoutProviders.length} (${((tmdbWithoutProviders.length / tmdbResults.length) * 100).toFixed(1)}%)`);
  console.log(`❌ Errors: ${tmdbErrors.length}\n`);
  
  if (tmdbWithProviders.length > 0) {
    console.log('✅ Items WITH providers (first 10):');
    tmdbWithProviders.slice(0, 10).forEach(r => {
      console.log(`   ${r.name}: ${r.providers.join(', ')}`);
    });
    if (tmdbWithProviders.length > 10) {
      console.log(`   ... and ${tmdbWithProviders.length - 10} more`);
    }
    console.log('');
  }
  
  if (tmdbWithoutProviders.length > 0 && tmdbWithoutProviders.length <= 10) {
    console.log('⚠️  Items WITHOUT providers:');
    tmdbWithoutProviders.forEach(r => {
      console.log(`   ${r.name} (hasResults: ${r.hasResults}, hasUS: ${r.hasUS})`);
    });
    console.log('');
  }
  
  if (tmdbErrors.length > 0) {
    console.log('❌ Items with ERRORS:');
    tmdbErrors.slice(0, 5).forEach(r => {
      console.log(`   ${r.name}: ${r.error}`);
    });
    if (tmdbErrors.length > 5) {
      console.log(`   ... and ${tmdbErrors.length - 5} more errors`);
    }
    console.log('');
  }
  
  console.log('='.repeat(60));
  console.log('📊 SUMMARY - PHP ENDPOINT');
  console.log('='.repeat(60));
  
  const phpSuccessful = phpResults.filter(r => r.success);
  const phpWithProviders = phpResults.filter(r => r.success && r.hasProviders);
  const phpWithoutProviders = phpResults.filter(r => r.success && !r.hasProviders);
  const phpErrors = phpResults.filter(r => !r.success);
  
  console.log(`Total tested: ${phpResults.length}`);
  console.log(`✅ Successful calls: ${phpSuccessful.length}`);
  console.log(`✅ With providers: ${phpWithProviders.length}`);
  console.log(`⚠️  Without providers: ${phpWithoutProviders.length}`);
  console.log(`❌ Errors: ${phpErrors.length}\n`);
  
  if (phpWithProviders.length > 0) {
    console.log('✅ PHP Endpoint - Items WITH providers:');
    phpWithProviders.forEach(r => {
      console.log(`   ${r.name}: ${r.providers.join(', ')}`);
    });
    console.log('');
  }
  
  if (phpErrors.length > 0) {
    console.log('❌ PHP Endpoint - Errors:');
    phpErrors.forEach(r => {
      console.log(`   ${r.name}: ${r.error || `HTTP ${r.httpStatus}`}`);
    });
    console.log('');
  }
  
  // Comparison
  console.log('='.repeat(60));
  console.log('🔍 COMPARISON');
  console.log('='.repeat(60));
  
  const comparisonItems = testItems.slice(0, 10);
  for (const item of comparisonItems) {
    const tmdbResult = tmdbResults.find(r => r.tmdbId === item.tmdb_id);
    const phpResult = phpResults.find(r => r.tmdbId === item.tmdb_id);
    
    if (tmdbResult && phpResult) {
      const tmdbHas = tmdbResult.success && tmdbResult.hasProviders;
      const phpHas = phpResult.success && phpResult.hasProviders;
      
      if (tmdbHas !== phpHas) {
        console.log(`⚠️  MISMATCH: ${item.title}`);
        console.log(`   TMDB Direct: ${tmdbHas ? `${tmdbResult.providerCount} providers` : 'No providers'}`);
        console.log(`   PHP Endpoint: ${phpHas ? `${phpResult.providerCount} providers` : 'No providers'}`);
        if (phpResult.error) {
          console.log(`   PHP Error: ${phpResult.error}`);
        }
        console.log('');
      }
    }
  }
  
  console.log('\n✅ Test complete!');
}

// Run it
runTests().catch(console.error);

