/**
 * Test script to check if TMDB watch providers endpoint returns data
 * Tests 20 movies/shows to see if provider data is available
 */

import https from 'https';
import http from 'http';

const TMDB_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2NGEzNjhkMDJlN2Y2NTI0MmU2M2YxMGFhMTMwZTkxZiIsIm5iZiI6MTY1Nzg0MDg4OS44NTY5OTk5LCJzdWIiOiI2MmQwYTRmOTYyZmNkMzAwNTU0NWFjZWEiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.TxRfKQMNiojwSNluc8kpo0SxCev8mwIC_RDQXmvjRAg';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Test movies/shows - mix of popular titles
const testItems = [
  { id: 550, name: 'Fight Club', isMovie: true },
  { id: 1054867, name: 'War of the Worlds', isMovie: true },
  { id: 299536, name: 'Avengers: Infinity War', isMovie: true },
  { id: 603692, name: 'John Wick: Chapter 4', isMovie: true },
  { id: 872585, name: 'Oppenheimer', isMovie: true },
  { id: 346698, name: 'Barbie', isMovie: true },
  { id: 634649, name: 'Spider-Man: No Way Home', isMovie: true },
  { id: 157336, name: 'Interstellar', isMovie: true },
  { id: 238, name: 'The Godfather', isMovie: true },
  { id: 278, name: 'The Shawshank Redemption', isMovie: true },
  { id: 1396, name: 'Breaking Bad', isMovie: false },
  { id: 1399, name: 'Game of Thrones', isMovie: false },
  { id: 66732, name: 'Stranger Things', isMovie: false },
  { id: 1398, name: 'The Office (US)', isMovie: false },
  { id: 60625, name: 'Rick and Morty', isMovie: false },
  { id: 1100, name: 'The Walking Dead', isMovie: false },
  { id: 1399, name: 'Game of Thrones', isMovie: false },
  { id: 66732, name: 'Stranger Things', isMovie: false },
  { id: 1398, name: 'The Office (US)', isMovie: false },
  { id: 1100, name: 'The Walking Dead', isMovie: false },
];

function testProviderEndpoint(tmdbId, isMovie, name) {
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
      rejectUnauthorized: false // For testing only
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
              error: `HTTP ${res.statusCode}: ${res.statusMessage}`,
              name,
              tmdbId,
              isMovie
            });
            return;
          }
          
          const jsonData = JSON.parse(data);
    
          // Check for providers
          const hasResults = jsonData.results && typeof jsonData.results === 'object';
          const hasUS = hasResults && jsonData.results.US;
          const hasFlatrate = hasUS && Array.isArray(jsonData.results.US.flatrate) && jsonData.results.US.flatrate.length > 0;
          const providers = hasFlatrate ? jsonData.results.US.flatrate : [];
          
          resolve({
            success: true,
            name,
            tmdbId,
            isMovie,
            hasResults,
            hasUS,
            hasFlatrate,
            providerCount: providers.length,
            providers: providers.map(p => ({
              id: p.provider_id,
              name: p.provider_name,
              logo: p.logo_path ? `https://image.tmdb.org/t/p/original${p.logo_path}` : null
            })),
            rawResponse: jsonData
          });
        } catch (error) {
          resolve({
            success: false,
            error: `Parse error: ${error.message}`,
            name,
            tmdbId,
            isMovie,
            rawData: data.substring(0, 200)
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
        error: 'Request timeout',
        name,
        tmdbId,
        isMovie
      });
    });
    
    req.end();
  });
}

async function runTests() {
  console.log('Testing TMDB Watch Providers API...\n');
  console.log(`Testing ${testItems.length} items...\n`);
  
  const results = [];
  
  for (const item of testItems) {
    console.log(`Testing: ${item.name} (${item.isMovie ? 'Movie' : 'TV Show'}) - ID: ${item.id}...`);
    const result = await testProviderEndpoint(item.id, item.isMovie, item.name);
    results.push(result);
    
    if (result.success) {
      if (result.hasFlatrate) {
        console.log(`  ✓ Found ${result.providerCount} providers: ${result.providers.map(p => p.name).join(', ')}`);
      } else {
        console.log(`  ⚠ No flatrate providers found (hasResults: ${result.hasResults}, hasUS: ${result.hasUS})`);
      }
    } else {
      console.log(`  ✗ Error: ${result.error}`);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  // Summary
  console.log('\n=== SUMMARY ===\n');
  const successful = results.filter(r => r.success);
  const withProviders = results.filter(r => r.success && r.hasFlatrate);
  const withoutProviders = results.filter(r => r.success && !r.hasFlatrate);
  const errors = results.filter(r => !r.success);
  
  console.log(`Total tested: ${results.length}`);
  console.log(`Successful API calls: ${successful.length}`);
  console.log(`With providers: ${withProviders.length}`);
  console.log(`Without providers: ${withoutProviders.length}`);
  console.log(`Errors: ${errors.length}\n`);
  
  if (withProviders.length > 0) {
    console.log('Items WITH providers:');
    withProviders.forEach(r => {
      console.log(`  - ${r.name}: ${r.providers.map(p => p.name).join(', ')}`);
    });
    console.log('');
  }
  
  if (withoutProviders.length > 0) {
    console.log('Items WITHOUT providers:');
    withoutProviders.forEach(r => {
      console.log(`  - ${r.name} (hasResults: ${r.hasResults}, hasUS: ${r.hasUS})`);
    });
    console.log('');
  }
  
  if (errors.length > 0) {
    console.log('Items with ERRORS:');
    errors.forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
  }
  
  // Test the PHP endpoint too
  console.log('\n=== TESTING PHP ENDPOINT ===\n');
  const phpTestId = 1054867; // War of the Worlds
  console.log(`Testing PHP endpoint with movie ID ${phpTestId}...`);
  
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 8000,
      path: `/api/get_item_details.php?tmdb_id=${phpTestId}&is_movie=true`,
      method: 'GET'
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const phpData = JSON.parse(data);
          console.log(`PHP Response Status: ${res.statusCode}`);
          console.log(`PHP Success: ${phpData.success}`);
          if (phpData.data) {
            console.log(`Has providers in response: ${!!phpData.data.providers}`);
            console.log(`Providers count: ${phpData.data.providers?.length || 0}`);
            if (phpData.data.providers && phpData.data.providers.length > 0) {
              console.log(`Providers: ${phpData.data.providers.map(p => p.provider_name).join(', ')}`);
            }
          }
          if (phpData.error) {
            console.log(`PHP Error: ${phpData.error}`);
          }
        } catch (error) {
          console.log(`PHP Parse Error: ${error.message}`);
          console.log(`Raw response: ${data.substring(0, 500)}`);
        }
        resolve();
      });
    });
    
    req.on('error', (error) => {
      console.log(`PHP Endpoint Error: ${error.message}`);
      console.log('Make sure the dev server is running (npm run dev)');
      resolve();
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      console.log('PHP request timeout');
      resolve();
    });
    
    req.end();
  });
}

// Run the tests
runTests().catch(console.error);

