<?php
/**
 * Get extended TMDB details for a single movie or TV show
 * GET /api/get_item_details.php?tmdb_id=123&is_movie=true
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

// TMDB API configuration
define('TMDB_ACCESS_TOKEN', 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2NGEzNjhkMDJlN2Y2NTI0MmU2M2YxMGFhMTMwZTkxZiIsIm5iZiI6MTY1Nzg0MDg4OS44NTY5OTk5LCJzdWIiOiI2MmQwYTRmOTYyZmNkMzAwNTU0NWFjZWEiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.TxRfKQMNiojwSNluc8kpo0SxCev8mwIC_RDQXmvjRAg');
define('TMDB_BASE_URL', 'https://api.themoviedb.org/3');

// Get parameters
$tmdbId = isset($_GET['tmdb_id']) ? intval($_GET['tmdb_id']) : null;
$isMovie = isset($_GET['is_movie']) ? filter_var($_GET['is_movie'], FILTER_VALIDATE_BOOLEAN) : true;

if (!$tmdbId) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing tmdb_id parameter']);
    exit;
}

/**
 * Get movie details with extended data
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
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        return null;
    }
    
    $data = json_decode($response, true);
    return $data;
}

/**
 * Get TV show details with extended data
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
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        return null;
    }
    
    $data = json_decode($response, true);
    return $data;
}

/**
 * Get watch providers for a movie
 */
function getMovieProviders($tmdbId) {
    try {
        $url = TMDB_BASE_URL . '/movie/' . $tmdbId . '/watch/providers?language=en-US&watch_region=US';
        
        $ch = curl_init();
        if ($ch === false) {
            return [];
        }
        
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . TMDB_ACCESS_TOKEN,
            'Content-Type: application/json'
        ]);
        
        $response = curl_exec($ch);
        $curlError = curl_error($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($curlError) {
            error_log("getMovieProviders curl error for $tmdbId: $curlError");
            return [];
        }
        
        if ($httpCode !== 200) {
            error_log("getMovieProviders HTTP error for $tmdbId: HTTP $httpCode");
            return [];
        }
        
        $data = json_decode($response, true);
        if (json_last_error() !== JSON_ERROR_NONE || !is_array($data)) {
            error_log("getMovieProviders JSON decode error for $tmdbId: " . json_last_error_msg());
            return [];
        }
        
        // Get flatrate (subscription) providers from US region - with proper null checking
        $providers = [];
        if (isset($data['results']) && is_array($data['results']) && 
            isset($data['results']['US']) && is_array($data['results']['US']) &&
            isset($data['results']['US']['flatrate']) && is_array($data['results']['US']['flatrate'])) {
            $providers = $data['results']['US']['flatrate'];
        }
        
        $mappedProviders = array_map(function($provider) {
            return [
                'provider_id' => $provider['provider_id'] ?? 0,
                'provider_name' => $provider['provider_name'] ?? '',
                'logo_path' => $provider['logo_path'] ?? null,
                'display_priority' => $provider['display_priority'] ?? 999
            ];
        }, $providers);
        
        // Sort by display_priority (lower is better)
        usort($mappedProviders, function($a, $b) {
            return $a['display_priority'] - $b['display_priority'];
        });
        
        return $mappedProviders;
    } catch (Exception $e) {
        error_log("getMovieProviders exception: " . $e->getMessage());
        return [];
    }
}

/**
 * Get watch providers for a TV show
 */
function getShowProviders($tmdbId) {
    try {
        $url = TMDB_BASE_URL . '/tv/' . $tmdbId . '/watch/providers?language=en-US&watch_region=US';
        
        $ch = curl_init();
        if ($ch === false) {
            return [];
        }
        
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . TMDB_ACCESS_TOKEN,
            'Content-Type: application/json'
        ]);
        
        $response = curl_exec($ch);
        $curlError = curl_error($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($curlError) {
            error_log("getShowProviders curl error for $tmdbId: $curlError");
            return [];
        }
        
        if ($httpCode !== 200) {
            error_log("getShowProviders HTTP error for $tmdbId: HTTP $httpCode");
            return [];
        }
        
        $data = json_decode($response, true);
        if (json_last_error() !== JSON_ERROR_NONE || !is_array($data)) {
            error_log("getShowProviders JSON decode error for $tmdbId: " . json_last_error_msg());
            return [];
        }
        
        // Get flatrate (subscription) providers from US region - with proper null checking
        $providers = [];
        if (isset($data['results']) && is_array($data['results']) && 
            isset($data['results']['US']) && is_array($data['results']['US']) &&
            isset($data['results']['US']['flatrate']) && is_array($data['results']['US']['flatrate'])) {
            $providers = $data['results']['US']['flatrate'];
        }
        
        $mappedProviders = array_map(function($provider) {
            return [
                'provider_id' => $provider['provider_id'] ?? 0,
                'provider_name' => $provider['provider_name'] ?? '',
                'logo_path' => $provider['logo_path'] ?? null,
                'display_priority' => $provider['display_priority'] ?? 999
            ];
        }, $providers);
        
        // Sort by display_priority (lower is better)
        usort($mappedProviders, function($a, $b) {
            return $a['display_priority'] - $b['display_priority'];
        });
        
        return $mappedProviders;
    } catch (Exception $e) {
        error_log("getShowProviders exception: " . $e->getMessage());
        return [];
    }
}

/**
 * Extract extended data from movie details
 */
function extractMovieExtendedData($movieDetails) {
    if (!$movieDetails) return [];
    
    $extendedData = [];
    
    // Poster path
    if (isset($movieDetails['poster_path'])) {
        $extendedData['poster_path'] = $movieDetails['poster_path'];
    }
    
    // Genres
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
    
    // Runtime
    if (isset($movieDetails['runtime']) && $movieDetails['runtime']) {
        $extendedData['runtime'] = $movieDetails['runtime'];
    }
    
    // Cast (first 15 actors)
    if (isset($movieDetails['credits']['cast'])) {
        $extendedData['cast'] = array_slice(array_map(function($actor) {
            return [
                'id' => $actor['id'],
                'name' => $actor['name'],
                'character' => $actor['character'] ?? '',
                'profile_path' => $actor['profile_path'] ?? null
            ];
        }, $movieDetails['credits']['cast']), 0, 15);
    }
    
    // Crew (director, writer, etc.)
    if (isset($movieDetails['credits']['crew'])) {
        $importantJobs = ['Director', 'Writer', 'Screenplay', 'Producer', 'Executive Producer'];
        $crew = array_filter($movieDetails['credits']['crew'], function($member) use ($importantJobs) {
            return in_array($member['job'], $importantJobs);
        });
        $extendedData['crew'] = array_slice(array_map(function($member) {
            return [
                'id' => $member['id'],
                'name' => $member['name'],
                'job' => $member['job'],
                'profile_path' => $member['profile_path'] ?? null
            ];
        }, array_values($crew)), 0, 10);
    }
    
    // Keywords
    if (isset($movieDetails['keywords']['keywords'])) {
        $extendedData['keywords'] = array_slice(array_map(function($keyword) {
            return [
                'id' => $keyword['id'],
                'name' => $keyword['name']
            ];
        }, $movieDetails['keywords']['keywords']), 0, 15);
    }
    
    // Videos (trailers, teasers, etc.)
    if (isset($movieDetails['videos']['results'])) {
        $extendedData['videos'] = array_map(function($video) {
            return [
                'id' => $video['id'],
                'key' => $video['key'],
                'name' => $video['name'],
                'site' => $video['site'],
                'type' => $video['type'],
                'official' => $video['official'] ?? false,
                'published_at' => $video['published_at'] ?? null
            ];
        }, $movieDetails['videos']['results']);
    }
    
    // Recommendations
    if (isset($movieDetails['recommendations']['results'])) {
        $extendedData['recommendations'] = array_slice(array_map(function($rec) {
            return [
                'id' => $rec['id'],
                'title' => $rec['title'] ?? $rec['name'] ?? '',
                'poster_path' => $rec['poster_path'] ?? null,
                'vote_average' => $rec['vote_average'] ?? null,
                'isMovie' => true
            ];
        }, $movieDetails['recommendations']['results']), 0, 10);
    }
    
    // Similar
    if (isset($movieDetails['similar']['results'])) {
        $extendedData['similar'] = array_slice(array_map(function($sim) {
            return [
                'id' => $sim['id'],
                'title' => $sim['title'] ?? $sim['name'] ?? '',
                'poster_path' => $sim['poster_path'] ?? null,
                'vote_average' => $sim['vote_average'] ?? null,
                'isMovie' => true
            ];
        }, $movieDetails['similar']['results']), 0, 10);
    }
    
    // Translations
    if (isset($movieDetails['translations']['translations'])) {
        $extendedData['translations'] = array_map(function($trans) {
            return [
                'iso_639_1' => $trans['iso_639_1'],
                'iso_3166_1' => $trans['iso_3166_1'],
                'name' => $trans['name'],
                'english_name' => $trans['english_name']
            ];
        }, $movieDetails['translations']['translations']);
    }
    
    return $extendedData;
}

/**
 * Extract extended data from show details
 */
function extractShowExtendedData($showDetails) {
    if (!$showDetails) return [];
    
    $extendedData = [];
    
    // Poster path
    if (isset($showDetails['poster_path'])) {
        $extendedData['poster_path'] = $showDetails['poster_path'];
    }
    
    // Genres
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
    
    // Runtime (use first episode runtime if available)
    if (isset($showDetails['episode_run_time']) && !empty($showDetails['episode_run_time'])) {
        $extendedData['runtime'] = $showDetails['episode_run_time'][0];
    }
    
    // Number of seasons and episodes
    if (isset($showDetails['number_of_seasons'])) {
        $extendedData['number_of_seasons'] = $showDetails['number_of_seasons'];
    }
    if (isset($showDetails['number_of_episodes'])) {
        $extendedData['number_of_episodes'] = $showDetails['number_of_episodes'];
    }
    
    // Networks
    if (isset($showDetails['networks']) && !empty($showDetails['networks'])) {
        $extendedData['networks'] = array_map(function($network) {
            return [
                'id' => $network['id'],
                'name' => $network['name'],
                'logo_path' => $network['logo_path'] ?? null,
                'origin_country' => $network['origin_country'] ?? null
            ];
        }, $showDetails['networks']);
    }
    
    // Cast (first 15 actors)
    if (isset($showDetails['credits']['cast'])) {
        $extendedData['cast'] = array_slice(array_map(function($actor) {
            return [
                'id' => $actor['id'],
                'name' => $actor['name'],
                'character' => $actor['character'] ?? '',
                'profile_path' => $actor['profile_path'] ?? null
            ];
        }, $showDetails['credits']['cast']), 0, 15);
    }
    
    // Crew (creator, executive producer, etc.)
    if (isset($showDetails['credits']['crew'])) {
        $importantJobs = ['Creator', 'Executive Producer', 'Producer', 'Writer'];
        $crew = array_filter($showDetails['credits']['crew'], function($member) use ($importantJobs) {
            return in_array($member['job'], $importantJobs);
        });
        $extendedData['crew'] = array_slice(array_map(function($member) {
            return [
                'id' => $member['id'],
                'name' => $member['name'],
                'job' => $member['job'],
                'profile_path' => $member['profile_path'] ?? null
            ];
        }, array_values($crew)), 0, 10);
    }
    
    // Keywords
    if (isset($showDetails['keywords']['results'])) {
        $extendedData['keywords'] = array_slice(array_map(function($keyword) {
            return [
                'id' => $keyword['id'],
                'name' => $keyword['name']
            ];
        }, $showDetails['keywords']['results']), 0, 15);
    }
    
    // Videos (trailers, teasers, etc.)
    if (isset($showDetails['videos']['results'])) {
        $extendedData['videos'] = array_map(function($video) {
            return [
                'id' => $video['id'],
                'key' => $video['key'],
                'name' => $video['name'],
                'site' => $video['site'],
                'type' => $video['type'],
                'official' => $video['official'] ?? false,
                'published_at' => $video['published_at'] ?? null
            ];
        }, $showDetails['videos']['results']);
    }
    
    // Recommendations
    if (isset($showDetails['recommendations']['results'])) {
        $extendedData['recommendations'] = array_slice(array_map(function($rec) {
            return [
                'id' => $rec['id'],
                'title' => $rec['name'] ?? $rec['title'] ?? '',
                'poster_path' => $rec['poster_path'] ?? null,
                'vote_average' => $rec['vote_average'] ?? null,
                'isMovie' => false
            ];
        }, $showDetails['recommendations']['results']), 0, 10);
    }
    
    // Similar
    if (isset($showDetails['similar']['results'])) {
        $extendedData['similar'] = array_slice(array_map(function($sim) {
            return [
                'id' => $sim['id'],
                'title' => $sim['name'] ?? $sim['title'] ?? '',
                'poster_path' => $sim['poster_path'] ?? null,
                'vote_average' => $sim['vote_average'] ?? null,
                'isMovie' => false
            ];
        }, $showDetails['similar']['results']), 0, 10);
    }
    
    // Translations
    if (isset($showDetails['translations']['translations'])) {
        $extendedData['translations'] = array_map(function($trans) {
            return [
                'iso_639_1' => $trans['iso_639_1'],
                'iso_3166_1' => $trans['iso_3166_1'],
                'name' => $trans['name'],
                'english_name' => $trans['english_name']
            ];
        }, $showDetails['translations']['translations']);
    }
    
    return $extendedData;
}

// Fetch details
if ($isMovie) {
    $details = getMovieDetails($tmdbId);
    if (!$details) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Movie not found']);
        exit;
    }
    $extendedData = extractMovieExtendedData($details);
    // Ensure it's an array
    if (!is_array($extendedData)) {
        $extendedData = [];
    }
    
    // Get watch providers (non-critical, continue even if it fails)
    $providers = getMovieProviders($tmdbId);
    $extendedData['providers'] = is_array($providers) ? $providers : [];
    
    // Debug logging - also log to response for debugging
    if (empty($providers)) {
        error_log("get_item_details: No providers returned for movie $tmdbId");
        // Add debug info to response (remove in production)
        $extendedData['_debug_providers'] = [
            'function_called' => 'getMovieProviders',
            'tmdb_id' => $tmdbId,
            'returned_count' => 0,
            'returned_type' => gettype($providers),
            'is_array' => is_array($providers)
        ];
    } else {
        error_log("get_item_details: Found " . count($providers) . " providers for movie $tmdbId");
        $extendedData['_debug_providers'] = [
            'function_called' => 'getMovieProviders',
            'tmdb_id' => $tmdbId,
            'returned_count' => count($providers),
            'providers' => array_map(function($p) {
                return $p['provider_name'];
            }, $providers)
        ];
    }
} else {
    $details = getShowDetails($tmdbId);
    if (!$details) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'TV show not found']);
        exit;
    }
    $extendedData = extractShowExtendedData($details);
    // Ensure it's an array
    if (!is_array($extendedData)) {
        $extendedData = [];
    }
    
    // Get watch providers (non-critical, continue even if it fails)
    $providers = getShowProviders($tmdbId);
    $extendedData['providers'] = is_array($providers) ? $providers : [];
    
    // Debug logging - also log to response for debugging
    if (empty($providers)) {
        error_log("get_item_details: No providers returned for show $tmdbId");
        // Add debug info to response (remove in production)
        $extendedData['_debug_providers'] = [
            'function_called' => 'getShowProviders',
            'tmdb_id' => $tmdbId,
            'returned_count' => 0,
            'returned_type' => gettype($providers),
            'is_array' => is_array($providers)
        ];
    } else {
        error_log("get_item_details: Found " . count($providers) . " providers for show $tmdbId");
        $extendedData['_debug_providers'] = [
            'function_called' => 'getShowProviders',
            'tmdb_id' => $tmdbId,
            'returned_count' => count($providers),
            'providers' => array_map(function($p) {
                return $p['provider_name'];
            }, $providers)
        ];
    }
}

echo json_encode([
    'success' => true,
    'data' => $extendedData,
    'tmdb_image_base_url' => 'https://image.tmdb.org/t/p/original'
]);
