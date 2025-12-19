/**
 * Browser-based test script for TMDB watch providers
 * Copy and paste this into your browser console while on the watchbox page
 */

const TMDB_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2NGEzNjhkMDJlN2Y2NTI0MmU2M2YxMGFhMTMwZTkxZiIsIm5iZiI6MTY1Nzg0MDg4OS44NTY5OTk5LCJzdWIiOiI2MmQwYTRmOTYyZmNkMzAwNTU0NWFjZWEiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.TxRfKQMNiojwSNluc8kpo0SxCev8mwIC_RDQXmvjRAg';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Test movies/shows
const testItems = [
  { id: 550, name: 'Fight Club', isMovie: true },
  { id: 1054867, name: 'War of the Worlds', isMovie: true },
  { id: 299536, name: 'Avengers: Infinity War', isMovie: true },
  { id: 603692, name: 'John Wick: Chapter 4', isMovie: true },
  { id: 872585, name: 'Oppenheimer', isMovie: true },
  { id: 346698, name: 'Barbie', isMovie: true },
  { id: 634649, name: 'Spider-Man: No Way Home', isMovie: true },
  { id: 157336, name: 'Interstellar', isMovie: true },
  { id: 1396, name: 'Breaking Bad', isMovie: false },
  { id: 1399, name: 'Game of Thrones', isMovie: false },
  { id: 66732, name: 'Stranger Things', isMovie: false },
];

async function testProvider(tmdbId, isMovie, name) {
  const type = isMovie ? 'movie' : 'tv';
  const url = `${TMDB_BASE_URL}/${type}/${tmdbId}/watch/providers?language=en-US&watch_region=US`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${TMDB_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}`, name, tmdbId };
    }
    
    const data = await response.json();
    const hasResults = data.results && typeof data.results === 'object';
    const hasUS = hasResults && data.results.US;
    const hasFlatrate = hasUS && Array.isArray(data.results.US.flatrate) && data.results.US.flatrate.length > 0;
    const providers = hasFlatrate ? data.results.US.flatrate : [];
    
    return {
      success: true,
      name,
      tmdbId,
      hasProviders: hasFlatrate,
      providerCount: providers.length,
      providers: providers.map(p => p.provider_name),
      hasResults,
      hasUS,
      rawData: data
    };
  } catch (error) {
    return { success: false, error: error.message, name, tmdbId };
  }
}

async function runTests() {
  console.log('🧪 Testing TMDB Watch Providers API...\n');
  
  const results = [];
  
  for (const item of testItems) {
    console.log(`Testing: ${item.name} (ID: ${item.id})...`);
    const result = await testProvider(item.id, item.isMovie, item.name);
    results.push(result);
    
    if (result.success) {
      if (result.hasProviders) {
        console.log(`  ✅ Found ${result.providerCount} providers: ${result.providers.join(', ')}`);
      } else {
        console.log(`  ⚠️  No providers (hasResults: ${result.hasResults}, hasUS: ${result.hasUS})`);
      }
    } else {
      console.log(`  ❌ Error: ${result.error}`);
    }
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  // Summary
  console.log('\n📊 SUMMARY\n');
  const withProviders = results.filter(r => r.success && r.hasProviders);
  const withoutProviders = results.filter(r => r.success && !r.hasProviders);
  const errors = results.filter(r => !r.success);
  
  console.log(`Total: ${results.length}`);
  console.log(`✅ With providers: ${withProviders.length}`);
  console.log(`⚠️  Without providers: ${withoutProviders.length}`);
  console.log(`❌ Errors: ${errors.length}\n`);
  
  if (withProviders.length > 0) {
    console.log('✅ Items WITH providers:');
    withProviders.forEach(r => {
      console.log(`   ${r.name}: ${r.providers.join(', ')}`);
    });
    console.log('');
  }
  
  if (withoutProviders.length > 0) {
    console.log('⚠️  Items WITHOUT providers:');
    withoutProviders.forEach(r => {
      console.log(`   ${r.name} (hasResults: ${r.hasResults}, hasUS: ${r.hasUS})`);
    });
  }
  
  // Test PHP endpoint
  console.log('\n🔧 Testing PHP Endpoint...\n');
  try {
    const phpResponse = await fetch('/api/get_item_details.php?tmdb_id=1054867&is_movie=true');
    const phpData = await phpResponse.json();
    
    console.log(`Status: ${phpResponse.status}`);
    console.log(`Success: ${phpData.success}`);
    if (phpData.data) {
      console.log(`Has providers: ${!!phpData.data.providers}`);
      console.log(`Provider count: ${phpData.data.providers?.length || 0}`);
      if (phpData.data.providers?.length > 0) {
        console.log(`Providers: ${phpData.data.providers.map(p => p.provider_name).join(', ')}`);
      }
    }
    if (phpData.error) {
      console.log(`Error: ${phpData.error}`);
    }
  } catch (error) {
    console.log(`PHP Error: ${error.message}`);
  }
  
  return results;
}

// Run it
runTests();

