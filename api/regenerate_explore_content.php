<?php
/**
 * Regenerate explore content JSON files from TMDB API
 * POST /api/regenerate_explore_content.php
 * 
 * Optional parameters:
 *   - type: "movies" | "shows" | "all" (default: "all")
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET');
header('Access-Control-Allow-Headers: Content-Type');

// TMDB API configuration
define('TMDB_ACCESS_TOKEN', 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2NGEzNjhkMDJlN2Y2NTI0MmU2M2YxMGFhMTMwZTkxZiIsIm5iZiI6MTY1Nzg0MDg4OS44NTY5OTk5LCJzdWIiOiI2MmQwYTRmOTYyZmNkMzAwNTU0NWFjZWEiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.TxRfKQMNiojwSNluc8kpo0SxCev8mwIC_RDQXmvjRAg');
define('TMDB_BASE_URL', 'https://api.themoviedb.org/3');
define('TMDB_IMAGE_BASE', 'https://image.tmdb.org/t/p/w500');

// Paths (relative to this file)
$baseDir = dirname(__DIR__);
$dataDir = $baseDir . '/data';
$postersDir = $dataDir . '/posters';
$moviesJson = $dataDir . '/streaming-movies-results.json';
$showsJson = $dataDir . '/streaming-shows-results.json';
$maxPosters = 1000;

// Service name mapping
$serviceMap = [
    'Netflix' => 'netflix',
    'Hulu' => 'hulu',
    'Disney Plus' => 'disneyplus',
    'Apple TV Plus' => 'appletv',
    'HBO Max' => 'hbomax',
    'Max' => 'hbomax',
    'Amazon Prime Video' => 'prime',
    'Peacock' => 'peacock',
    'Paramount Plus' => 'paramount',
    'Paramount+' => 'paramount'
];

// Get request type
$type = isset($_GET['type']) ? $_GET['type'] : (isset($_POST['type']) ? $_POST['type'] : 'all');

/**
 * Generate filename-safe string from title
 */
function generatePosterFilename($title) {
    $filename = strtolower($title);
    $filename = preg_replace('/[^a-z0-9\s-]/', '', $filename);
    $filename = preg_replace('/\s+/', '-', $filename);
    $filename = preg_replace('/-+/', '-', $filename);
    $filename = trim($filename, '-');
    return $filename . '.jpg';
}

/**
 * Get service key from provider name
 */
function getServiceKey($providerName, $serviceMap) {
    return isset($serviceMap[$providerName]) ? $serviceMap[$providerName] : strtolower(str_replace(' ', '', $providerName));
}

/**
 * Check if a movie is anime
 */
function isAnime($movie) {
    // Check if it's Japanese animation
    if (isset($movie['original_language']) && $movie['original_language'] === 'ja' && 
        isset($movie['genre_ids']) && in_array(16, $movie['genre_ids'])) {
        return true;
    }
    // Check title for common anime indicators
    $titleLower = strtolower($movie['title'] ?? '');
    $animeKeywords = ['anime', 'ghibli', 'studio ghibli', 'pokemon', 'dragon ball', 'naruto', 'one piece', 'attack on titan'];
    foreach ($animeKeywords as $keyword) {
        if (strpos($titleLower, $keyword) !== false) {
            return true;
        }
    }
    return false;
}

/**
 * Check if a movie is horror
 */
function isHorror($movie) {
    // Horror genre ID in TMDB is 27
    if (isset($movie['genre_ids']) && in_array(27, $movie['genre_ids'])) {
        return true;
    }
    return false;
}

/**
 * Check if movie is from last 10 years
 */
function isRecentMovie($movie) {
    if (!isset($movie['release_date']) || empty($movie['release_date'])) {
        return false;
    }
    $releaseYear = (int)date('Y', strtotime($movie['release_date']));
    $currentYear = (int)date('Y');
    $tenYearsAgo = $currentYear - 10;
    return $releaseYear >= $tenYearsAgo;
}

/**
 * Fetch popular movies from TMDB (last 10 years)
 * Fetches until we have 400 items
 */
function fetchPopularMovies() {
    $movies = [];
    $currentYear = (int)date('Y');
    $tenYearsAgo = $currentYear - 10;
    $startDate = $tenYearsAgo . '-01-01';
    $endDate = $currentYear . '-12-31';
    $targetCount = 400;
    $page = 1;
    $maxPages = 50; // Safety limit
    
    // Use discover endpoint to filter by date range
    while (count($movies) < $targetCount && $page <= $maxPages) {
        // Discover movies from last 10 years, sorted by popularity, English language
        $url = TMDB_BASE_URL . '/discover/movie?language=en-US&page=' . $page . '&region=US&sort_by=popularity.desc&primary_release_date.gte=' . $startDate . '&primary_release_date.lte=' . $endDate . '&with_original_language=en';
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . TMDB_ACCESS_TOKEN,
            'Content-Type: application/json'
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 200) {
            break;
        }
        
        $data = json_decode($response, true);
        if (!isset($data['results']) || empty($data['results'])) {
            break; // No more results
        }
        
        // Filter to only recent movies (keep all, including anime/horror/G-rated)
        $filteredMovies = array_filter($data['results'], function($movie) {
            return isRecentMovie($movie);
        });
        
        // Add movies up to target count
        $remaining = $targetCount - count($movies);
        $movies = array_merge($movies, array_slice($filteredMovies, 0, $remaining));
        
        if (count($movies) >= $targetCount) {
            break; // We have enough
        }
        
        $page++;
        usleep(250000); // 250ms delay
    }
    
    return array_slice($movies, 0, $targetCount); // Ensure exactly 400
}

/**
 * Fetch popular TV shows from TMDB
 * Fetches until we have 400 items
 */
function fetchPopularShows() {
    $shows = [];
    $targetCount = 400;
    $page = 1;
    $maxPages = 40; // Safety limit (40 pages * 20 items = 800 max)
    
    while (count($shows) < $targetCount && $page <= $maxPages) {
        $url = TMDB_BASE_URL . '/tv/popular?language=en-US&page=' . $page;
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . TMDB_ACCESS_TOKEN,
            'Content-Type: application/json'
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 200) {
            break;
        }
        
        $data = json_decode($response, true);
        if (!isset($data['results']) || empty($data['results'])) {
            break; // No more results
        }
        
        // Add shows up to target count
        $remaining = $targetCount - count($shows);
        $shows = array_merge($shows, array_slice($data['results'], 0, $remaining));
        
        if (count($shows) >= $targetCount) {
            break; // We have enough
        }
        
        $page++;
        usleep(250000); // 250ms delay
    }
    
    return array_slice($shows, 0, $targetCount); // Ensure exactly 400
}

/**
 * Get movie details including certification, credits, keywords, videos, recommendations, similar, and translations
 */
function getMovieDetails($tmdbId) {
    $url = TMDB_BASE_URL . '/movie/' . $tmdbId . '?language=en-US&append_to_response=release_dates,credits,keywords,videos,recommendations,similar,translations';
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . TMDB_ACCESS_TOKEN,
        'Content-Type: application/json'
    ]);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    $data = json_decode($response, true);
    return $data;
}

/**
 * Extract extended data from movie details
 */
function extractMovieExtendedData($movieDetails) {
    if (!$movieDetails) return [];
    
    $extendedData = [];
    
    // Genres (full objects with id and name)
    if (isset($movieDetails['genres']) && !empty($movieDetails['genres'])) {
        $extendedData['genres'] = array_map(function($g) {
            return ['id' => $g['id'], 'name' => $g['name']];
        }, $movieDetails['genres']);
    }
    
    // Overview
    if (isset($movieDetails['overview']) && $movieDetails['overview']) {
        $extendedData['overview'] = $movieDetails['overview'];
    }
    
    // Ratings
    if (isset($movieDetails['vote_average'])) {
        $extendedData['vote_average'] = $movieDetails['vote_average'];
    }
    if (isset($movieDetails['vote_count'])) {
        $extendedData['vote_count'] = $movieDetails['vote_count'];
    }
    
    // Runtime (in minutes)
    if (isset($movieDetails['runtime']) && $movieDetails['runtime']) {
        $extendedData['runtime'] = $movieDetails['runtime'];
    }
    
    // Cast (first 15 actors)
    if (isset($movieDetails['credits']['cast'])) {
        $extendedData['cast'] = array_map(function($c) {
            return [
                'id' => $c['id'],
                'name' => $c['name'],
                'character' => $c['character'] ?? '',
                'profile_path' => $c['profile_path'] ?? null
            ];
        }, array_slice($movieDetails['credits']['cast'], 0, 15));
    }
    
    // Crew (directors, writers, producers - key roles)
    if (isset($movieDetails['credits']['crew'])) {
        $keyRoles = ['Director', 'Writer', 'Screenplay', 'Producer', 'Executive Producer'];
        $filteredCrew = array_filter($movieDetails['credits']['crew'], function($c) use ($keyRoles) {
            return in_array($c['job'] ?? '', $keyRoles);
        });
        $extendedData['crew'] = array_map(function($c) {
            return [
                'id' => $c['id'],
                'name' => $c['name'],
                'job' => $c['job'],
                'profile_path' => $c['profile_path'] ?? null
            ];
        }, array_slice(array_values($filteredCrew), 0, 10));
    }
    
    // Keywords (first 15)
    if (isset($movieDetails['keywords']['keywords'])) {
        $extendedData['keywords'] = array_map(function($k) {
            return ['id' => $k['id'], 'name' => $k['name']];
        }, array_slice($movieDetails['keywords']['keywords'], 0, 15));
    }
    
    // Videos (trailers and teasers, prefer official YouTube)
    if (isset($movieDetails['videos']['results'])) {
        $trailerTypes = ['Trailer', 'Teaser'];
        $filteredVideos = array_filter($movieDetails['videos']['results'], function($v) use ($trailerTypes) {
            return in_array($v['type'] ?? '', $trailerTypes) && ($v['site'] ?? '') === 'YouTube';
        });
        $extendedData['videos'] = array_map(function($v) {
            return [
                'id' => $v['id'],
                'key' => $v['key'],
                'name' => $v['name'],
                'site' => $v['site'],
                'type' => $v['type'],
                'official' => $v['official'] ?? false,
                'published_at' => $v['published_at'] ?? null
            ];
        }, array_slice(array_values($filteredVideos), 0, 5));
    }
    
    // Recommendations (first 10)
    if (isset($movieDetails['recommendations']['results'])) {
        $extendedData['recommendations'] = array_map(function($r) {
            return [
                'id' => $r['id'],
                'title' => $r['title'],
                'poster_path' => $r['poster_path'] ?? null,
                'vote_average' => $r['vote_average'] ?? null,
                'isMovie' => true
            ];
        }, array_slice($movieDetails['recommendations']['results'], 0, 10));
    }
    
    // Similar movies (first 10)
    if (isset($movieDetails['similar']['results'])) {
        $extendedData['similar'] = array_map(function($s) {
            return [
                'id' => $s['id'],
                'title' => $s['title'],
                'poster_path' => $s['poster_path'] ?? null,
                'vote_average' => $s['vote_average'] ?? null,
                'isMovie' => true
            ];
        }, array_slice($movieDetails['similar']['results'], 0, 10));
    }
    
    // Translations (limit to 20)
    if (isset($movieDetails['translations']['translations'])) {
        $extendedData['translations'] = array_map(function($t) {
            return [
                'iso_639_1' => $t['iso_639_1'],
                'iso_3166_1' => $t['iso_3166_1'],
                'name' => $t['name'],
                'english_name' => $t['english_name']
            ];
        }, array_slice($movieDetails['translations']['translations'], 0, 20));
    }
    
    return $extendedData;
}

/**
 * Check if movie is rated G or PG
 */
function isMovieRatedGOrPG($movieDetails) {
    if (!$movieDetails || !isset($movieDetails['release_dates'])) {
        return false;
    }
    
    $usRelease = null;
    foreach ($movieDetails['release_dates']['results'] ?? [] as $release) {
        if ($release['iso_3166_1'] === 'US') {
            $usRelease = $release;
            break;
        }
    }
    
    if ($usRelease && isset($usRelease['release_dates'])) {
        foreach ($usRelease['release_dates'] as $rd) {
            if (isset($rd['certification']) && ($rd['certification'] === 'G' || $rd['certification'] === 'PG')) {
                return true;
            }
        }
    }
    
    return false;
}

/**
 * Get streaming providers for a movie
 */
function getMovieProviders($tmdbId) {
    $url = TMDB_BASE_URL . '/movie/' . $tmdbId . '/watch/providers?language=en-US&watch_region=US';
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . TMDB_ACCESS_TOKEN,
        'Content-Type: application/json'
    ]);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    $data = json_decode($response, true);
    $providers = [];
    
    if (isset($data['results']['US']['flatrate'])) {
        foreach ($data['results']['US']['flatrate'] as $provider) {
            $key = getServiceKey($provider['provider_name'], $GLOBALS['serviceMap']);
            if ($key) {
                $providers[] = $key;
            }
        }
    }
    
    return $providers;
}

/**
 * Get TV show details including content ratings, credits, keywords, videos, recommendations, similar, and translations
 */
function getShowDetails($tmdbId) {
    $url = TMDB_BASE_URL . '/tv/' . $tmdbId . '?language=en-US&append_to_response=content_ratings,credits,keywords,videos,recommendations,similar,translations';
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . TMDB_ACCESS_TOKEN,
        'Content-Type: application/json'
    ]);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    $data = json_decode($response, true);
    return $data;
}

/**
 * Extract extended data from show details
 */
function extractShowExtendedData($showDetails) {
    if (!$showDetails) return [];
    
    $extendedData = [];
    
    // Genres (full objects with id and name)
    if (isset($showDetails['genres']) && !empty($showDetails['genres'])) {
        $extendedData['genres'] = array_map(function($g) {
            return ['id' => $g['id'], 'name' => $g['name']];
        }, $showDetails['genres']);
    }
    
    // Overview
    if (isset($showDetails['overview']) && $showDetails['overview']) {
        $extendedData['overview'] = $showDetails['overview'];
    }
    
    // Ratings
    if (isset($showDetails['vote_average'])) {
        $extendedData['vote_average'] = $showDetails['vote_average'];
    }
    if (isset($showDetails['vote_count'])) {
        $extendedData['vote_count'] = $showDetails['vote_count'];
    }
    
    // Runtime (average episode runtime - take first value if array)
    if (isset($showDetails['episode_run_time']) && !empty($showDetails['episode_run_time'])) {
        $extendedData['runtime'] = $showDetails['episode_run_time'][0];
    }
    
    // Cast (first 15 actors)
    if (isset($showDetails['credits']['cast'])) {
        $extendedData['cast'] = array_map(function($c) {
            return [
                'id' => $c['id'],
                'name' => $c['name'],
                'character' => $c['character'] ?? '',
                'profile_path' => $c['profile_path'] ?? null
            ];
        }, array_slice($showDetails['credits']['cast'], 0, 15));
    }
    
    // Start with created_by if available (TV shows have this)
    $crew = [];
    if (isset($showDetails['created_by']) && !empty($showDetails['created_by'])) {
        foreach ($showDetails['created_by'] as $creator) {
            $crew[] = [
                'id' => $creator['id'],
                'name' => $creator['name'],
                'job' => 'Creator',
                'profile_path' => $creator['profile_path'] ?? null
            ];
        }
    }
    
    // Crew (executive producers, showrunners - key roles)
    if (isset($showDetails['credits']['crew'])) {
        $keyRoles = ['Creator', 'Executive Producer', 'Showrunner', 'Director', 'Writer'];
        $filteredCrew = array_filter($showDetails['credits']['crew'], function($c) use ($keyRoles) {
            return in_array($c['job'] ?? '', $keyRoles);
        });
        foreach (array_slice(array_values($filteredCrew), 0, 10 - count($crew)) as $c) {
            $crew[] = [
                'id' => $c['id'],
                'name' => $c['name'],
                'job' => $c['job'],
                'profile_path' => $c['profile_path'] ?? null
            ];
        }
    }
    if (!empty($crew)) {
        $extendedData['crew'] = array_slice($crew, 0, 10);
    }
    
    // Keywords (TV shows use 'results' instead of 'keywords')
    if (isset($showDetails['keywords']['results'])) {
        $extendedData['keywords'] = array_map(function($k) {
            return ['id' => $k['id'], 'name' => $k['name']];
        }, array_slice($showDetails['keywords']['results'], 0, 15));
    }
    
    // Videos (trailers and teasers, prefer official YouTube)
    if (isset($showDetails['videos']['results'])) {
        $trailerTypes = ['Trailer', 'Teaser'];
        $filteredVideos = array_filter($showDetails['videos']['results'], function($v) use ($trailerTypes) {
            return in_array($v['type'] ?? '', $trailerTypes) && ($v['site'] ?? '') === 'YouTube';
        });
        $extendedData['videos'] = array_map(function($v) {
            return [
                'id' => $v['id'],
                'key' => $v['key'],
                'name' => $v['name'],
                'site' => $v['site'],
                'type' => $v['type'],
                'official' => $v['official'] ?? false,
                'published_at' => $v['published_at'] ?? null
            ];
        }, array_slice(array_values($filteredVideos), 0, 5));
    }
    
    // Networks (where the show originally aired)
    if (isset($showDetails['networks']) && !empty($showDetails['networks'])) {
        $extendedData['networks'] = array_map(function($n) {
            return [
                'id' => $n['id'],
                'name' => $n['name'],
                'logo_path' => $n['logo_path'] ?? null,
                'origin_country' => $n['origin_country'] ?? null
            ];
        }, $showDetails['networks']);
    }
    
    // Number of seasons and episodes
    if (isset($showDetails['number_of_seasons'])) {
        $extendedData['number_of_seasons'] = $showDetails['number_of_seasons'];
    }
    if (isset($showDetails['number_of_episodes'])) {
        $extendedData['number_of_episodes'] = $showDetails['number_of_episodes'];
    }
    
    // Recommendations (first 10)
    if (isset($showDetails['recommendations']['results'])) {
        $extendedData['recommendations'] = array_map(function($r) {
            return [
                'id' => $r['id'],
                'title' => $r['name'], // TV shows use 'name' instead of 'title'
                'poster_path' => $r['poster_path'] ?? null,
                'vote_average' => $r['vote_average'] ?? null,
                'isMovie' => false
            ];
        }, array_slice($showDetails['recommendations']['results'], 0, 10));
    }
    
    // Similar shows (first 10)
    if (isset($showDetails['similar']['results'])) {
        $extendedData['similar'] = array_map(function($s) {
            return [
                'id' => $s['id'],
                'title' => $s['name'], // TV shows use 'name' instead of 'title'
                'poster_path' => $s['poster_path'] ?? null,
                'vote_average' => $s['vote_average'] ?? null,
                'isMovie' => false
            ];
        }, array_slice($showDetails['similar']['results'], 0, 10));
    }
    
    // Translations (limit to 20)
    if (isset($showDetails['translations']['translations'])) {
        $extendedData['translations'] = array_map(function($t) {
            return [
                'iso_639_1' => $t['iso_639_1'],
                'iso_3166_1' => $t['iso_3166_1'],
                'name' => $t['name'],
                'english_name' => $t['english_name']
            ];
        }, array_slice($showDetails['translations']['translations'], 0, 20));
    }
    
    return $extendedData;
}

/**
 * Check if TV show is rated TV-G or TV-PG
 */
function isShowRatedGOrPG($showDetails) {
    if (!$showDetails || !isset($showDetails['content_ratings'])) {
        return false;
    }
    
    $usRating = null;
    foreach ($showDetails['content_ratings']['results'] ?? [] as $rating) {
        if ($rating['iso_3166_1'] === 'US') {
            $usRating = $rating;
            break;
        }
    }
    
    if ($usRating && isset($usRating['rating']) && ($usRating['rating'] === 'TV-G' || $usRating['rating'] === 'TV-PG')) {
        return true;
    }
    
    return false;
}

/**
 * Get streaming providers for a TV show
 */
function getShowProviders($tmdbId) {
    $url = TMDB_BASE_URL . '/tv/' . $tmdbId . '/watch/providers?language=en-US&watch_region=US';
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . TMDB_ACCESS_TOKEN,
        'Content-Type: application/json'
    ]);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    $data = json_decode($response, true);
    $providers = [];
    
    if (isset($data['results']['US']['flatrate'])) {
        foreach ($data['results']['US']['flatrate'] as $provider) {
            $key = getServiceKey($provider['provider_name'], $GLOBALS['serviceMap']);
            if ($key) {
                $providers[] = $key;
            }
        }
    }
    
    return $providers;
}

/**
 * Get poster metadata with release dates for replacement logic
 */
function getPosterMetadata() {
    global $postersDir, $moviesJson, $showsJson;
    $metadata = [];
    
    // Read JSON files to get release dates
    if (file_exists($moviesJson) && file_exists($showsJson)) {
        $movies = json_decode(file_get_contents($moviesJson), true);
        $shows = json_decode(file_get_contents($showsJson), true);
        $all = array_merge($movies ?? [], $shows ?? []);
        
        // Get existing poster files
        $existingFiles = [];
        if (is_dir($postersDir)) {
            $files = scandir($postersDir);
            foreach ($files as $file) {
                if (pathinfo($file, PATHINFO_EXTENSION) === 'jpg') {
                    $existingFiles[] = $file;
                }
            }
        }
        
        // Create a map of filename to release date
        $filenameToDate = [];
        foreach ($all as $item) {
            $date = isset($item['isMovie']) && $item['isMovie'] 
                ? ($item['release_date'] ?? null)
                : ($item['first_air_date'] ?? null);
            if ($date && isset($item['poster_filename'])) {
                $filenameToDate[$item['poster_filename']] = $date;
            }
        }
        
        // Build metadata for existing posters
        foreach ($existingFiles as $filename) {
            $date = $filenameToDate[$filename] ?? null;
            if ($date) {
                $metadata[] = [
                    'filename' => $filename,
                    'date' => $date,
                    'timestamp' => strtotime($date)
                ];
            } else {
                // For posters not in current JSON, use file modification time as fallback
                $filepath = $postersDir . '/' . $filename;
                $metadata[] = [
                    'filename' => $filename,
                    'date' => date('Y-m-d', filemtime($filepath)),
                    'timestamp' => filemtime($filepath)
                ];
            }
        }
    }
    
    return $metadata;
}

/**
 * Get oldest posters to replace
 */
function getOldestPosters($count = 1) {
    $metadata = getPosterMetadata();
    // Sort by timestamp (oldest first)
    usort($metadata, function($a, $b) {
        return $a['timestamp'] - $b['timestamp'];
    });
    return array_slice(array_column($metadata, 'filename'), 0, $count);
}

/**
 * Download poster, replacing oldest if at limit
 */
function downloadPosterIfNeeded($posterPath, $filename, $releaseDate, $currentPosterCount) {
    global $postersDir, $maxPosters;
    
    $filepath = $postersDir . '/' . $filename;
    
    // Check if poster already exists
    if (file_exists($filepath)) {
        return true;
    }
    
    if (!$posterPath) {
        return false;
    }
    
    // If at limit, replace oldest poster
    if ($currentPosterCount >= $maxPosters) {
        $oldestPosters = getOldestPosters(1);
        if (!empty($oldestPosters)) {
            $oldestFile = $oldestPosters[0];
            $oldestPath = $postersDir . '/' . $oldestFile;
            
            // Only replace if new poster is newer than oldest
            if ($releaseDate) {
                $metadata = getPosterMetadata();
                $oldestMeta = null;
                foreach ($metadata as $meta) {
                    if ($meta['filename'] === $oldestFile) {
                        $oldestMeta = $meta;
                        break;
                    }
                }
                if ($oldestMeta && strtotime($releaseDate) > $oldestMeta['timestamp']) {
                    unlink($oldestPath);
                } else {
                    return false; // Newer than oldest, skip
                }
            } else {
                // No release date, just replace oldest
                unlink($oldestPath);
            }
        } else {
            return false;
        }
    }
    
    $imageUrl = TMDB_IMAGE_BASE . $posterPath;
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $imageUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    
    $imageData = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200 || !$imageData) {
        return false;
    }
    
    file_put_contents($filepath, $imageData);
    chmod($filepath, 0644); // Readable/writable on GoDaddy
    
    return true;
}

/**
 * Process movies
 */
function processMovies() {
    global $moviesJson, $postersDir, $serviceMap;
    
    $movies = fetchPopularMovies();
    $results = [];
    
    // Count existing posters
    $posterCount = 0;
    if (is_dir($postersDir)) {
        $files = scandir($postersDir);
        foreach ($files as $file) {
            if (pathinfo($file, PATHINFO_EXTENSION) === 'jpg') {
                $posterCount++;
            }
        }
    }
    
    foreach ($movies as $movie) {
        $tmdbId = $movie['id'];
        
        // Get movie details to check rating and genre
        $movieDetails = getMovieDetails($tmdbId);
        usleep(250000); // 250ms delay
        
        // Skip if rated G or PG
        if ($movieDetails && isMovieRatedGOrPG($movieDetails)) {
            continue;
        }
        
        // Check if movie should be deprioritized (anime or horror)
        $isDeprioritized = false;
        if ($movieDetails) {
            $isDeprioritized = isAnime($movie) || isHorror($movie);
        }
        
        $services = getMovieProviders($tmdbId);
        usleep(250000); // 250ms delay
        
        $posterFilename = generatePosterFilename($movie['title']);
        
        if (isset($movie['poster_path'])) {
            if (downloadPosterIfNeeded($movie['poster_path'], $posterFilename, $movie['release_date'] ?? null, $posterCount)) {
                $posterCount++;
            }
        }
        
        // Extract extended TMDB data
        $extendedData = extractMovieExtendedData($movieDetails);
        
        $result = [
            'id' => str_replace('.jpg', '', $posterFilename) . '-' . $tmdbId,
            'title' => $movie['title'],
            'tmdb_id' => $tmdbId,
            'poster_filename' => $posterFilename,
            'listType' => 'top',
            'services' => $services,
            'release_date' => $movie['release_date'] ?? null,
            'isMovie' => true,
            '_priority' => $isDeprioritized ? 0 : 1 // 1 = high priority, 0 = low priority
        ];
        
        // Merge extended data
        $result = array_merge($result, $extendedData);
        
        $results[] = $result;
    }
    
    // Sort results: high priority first, then low priority
    usort($results, function($a, $b) {
        return ($b['_priority'] ?? 0) - ($a['_priority'] ?? 0);
    });
    
    // Remove the _priority field before saving (it's just for sorting)
    foreach ($results as &$result) {
        unset($result['_priority']);
    }
    
    file_put_contents($moviesJson, json_encode($results, JSON_PRETTY_PRINT));
    chmod($moviesJson, 0644);
    
    return ['count' => count($results), 'posters' => $posterCount];
}

/**
 * Process TV shows
 */
function processShows() {
    global $showsJson, $postersDir, $serviceMap;
    
    $shows = fetchPopularShows();
    $results = [];
    
    // Count existing posters
    $posterCount = 0;
    if (is_dir($postersDir)) {
        $files = scandir($postersDir);
        foreach ($files as $file) {
            if (pathinfo($file, PATHINFO_EXTENSION) === 'jpg') {
                $posterCount++;
            }
        }
    }
    
    foreach ($shows as $show) {
        $tmdbId = $show['id'];
        
        // Get show details to check rating
        $showDetails = getShowDetails($tmdbId);
        usleep(250000); // 250ms delay
        
        // Skip if rated TV-G or TV-PG
        if ($showDetails && isShowRatedGOrPG($showDetails)) {
            continue;
        }
        
        // Shows don't need deprioritization (no anime/horror for shows)
        $isDeprioritized = false;
        
        $services = getShowProviders($tmdbId);
        usleep(250000); // 250ms delay
        
        $posterFilename = generatePosterFilename($show['name']);
        
        if (isset($show['poster_path'])) {
            if (downloadPosterIfNeeded($show['poster_path'], $posterFilename, $show['first_air_date'] ?? null, $posterCount)) {
                $posterCount++;
            }
        }
        
        // Extract extended TMDB data
        $extendedData = extractShowExtendedData($showDetails);
        
        $result = [
            'id' => str_replace('.jpg', '', $posterFilename) . '-' . $tmdbId,
            'title' => $show['name'],
            'tmdb_id' => $tmdbId,
            'poster_filename' => $posterFilename,
            'listType' => 'top',
            'services' => $services,
            'first_air_date' => $show['first_air_date'] ?? null,
            'isMovie' => false,
            '_priority' => $isDeprioritized ? 0 : 1 // 1 = high priority, 0 = low priority
        ];
        
        // Merge extended data
        $result = array_merge($result, $extendedData);
        
        $results[] = $result;
    }
    
    // Sort results: high priority first, then low priority
    usort($results, function($a, $b) {
        return ($b['_priority'] ?? 0) - ($a['_priority'] ?? 0);
    });
    
    // Remove the _priority field before saving (it's just for sorting)
    foreach ($results as &$result) {
        unset($result['_priority']);
    }
    
    file_put_contents($showsJson, json_encode($results, JSON_PRETTY_PRINT));
    chmod($showsJson, 0644);
    
    return ['count' => count($results), 'posters' => $posterCount];
}

// Main execution
try {
    // Ensure directories exist
    if (!is_dir($dataDir)) {
        mkdir($dataDir, 0755, true);
    }
    if (!is_dir($postersDir)) {
        mkdir($postersDir, 0755, true);
    }
    
    $response = ['success' => true, 'results' => []];
    
    if ($type === 'movies' || $type === 'all') {
        $moviesResult = processMovies();
        $response['results']['movies'] = $moviesResult;
    }
    
    if ($type === 'shows' || $type === 'all') {
        $showsResult = processShows();
        $response['results']['shows'] = $showsResult;
    }
    
    echo json_encode($response);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

