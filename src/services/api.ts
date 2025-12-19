// API service layer for WatchBox

import type { User, UserSummary, CreateUserRequest, SaveUserRequest } from '../types';

const API_BASE = '/api';

/**
 * Fetch list of all users
 */
export async function listUsers(): Promise<UserSummary[]> {
  const response = await fetch(`${API_BASE}/list_users.php`);
  if (!response.ok) {
    throw new Error('Failed to fetch users');
  }
  return response.json();
}

/**
 * Get a specific user by ID
 */
export async function getUser(userId: string): Promise<User> {
  const response = await fetch(`${API_BASE}/get_user.php?user_id=${encodeURIComponent(userId)}`);
  if (!response.ok) {
    throw new Error('Failed to fetch user');
  }
  return response.json();
}

/**
 * Create a new user profile
 */
export async function createUser(data: CreateUserRequest): Promise<User> {
  const response = await fetch(`${API_BASE}/create_user.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to create user');
  }
  return response.json();
}

/**
 * Save user data (update items, etc.)
 */
export async function saveUser(data: SaveUserRequest): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/save_user.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to save user');
  }
  return response.json();
}

/**
 * Delete a user profile
 */
export async function deleteUser(userId: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/delete_user.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!response.ok) {
    throw new Error('Failed to delete user');
  }
  return response.json();
}

/**
 * Get poster URL from TMDB poster_path
 * Returns TMDB CDN URL or fallback placeholder
 */
export function getPosterUrl(posterPath?: string | null): string | null {
  if (!posterPath) {
    return null; // Return null to indicate no poster, component should show placeholder
  }
  // If it's already a full URL, return as-is (for backward compatibility during migration)
  if (posterPath.startsWith('http://') || posterPath.startsWith('https://')) {
    return posterPath;
  }
  // Reject invalid poster paths (old local filenames like "1.svg", "1", etc.)
  // Valid TMDB poster paths start with "/" and contain a file extension
  if (!posterPath.startsWith('/') || posterPath.match(/^\/\d+\.(svg|jpg|png)$/i)) {
    return null; // Invalid path, show placeholder instead
  }
  // Build TMDB CDN URL (w500 is a good balance of quality and size)
  return `https://image.tmdb.org/t/p/w500${posterPath}`;
}

/**
 * Get avatar URL by filename
 */
// Cache-busting version that's set once per page load
let avatarCacheVersion = Date.now();

export function getAvatarUrl(filename: string): string {
  // Add cache-busting version to force reload when SVGs are updated
  // Version is set once per page load, so images reload on refresh
  return `/data/avatars/${filename}?v=${avatarCacheVersion}`;
}

export function clearAvatarCache(): void {
  // Increment version to force all avatar images to reload
  avatarCacheVersion = Date.now();
}

/**
 * List available avatar filenames
 * Fetches dynamically from the server to pick up all SVG files
 * Always fetches fresh data on each call to detect new/updated files
 */
export async function getAvailableAvatars(): Promise<string[]> {
  try {
    // Add cache-busting parameter to ensure fresh data
    const response = await fetch(`/api/list_avatars.php?t=${Date.now()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch avatars');
    }
    const avatars = await response.json();
    return avatars;
  } catch (error) {
    console.error('Failed to load avatars:', error);
    // Fallback to empty array
    return [];
  }
}

/**
 * List available streaming service filenames
 * Fetches dynamically from the server to pick up all SVG files
 * Always fetches fresh data on each call to detect new/updated files
 */
export async function getAvailableStreamingServices(): Promise<string[]> {
  try {
    // Add cache-busting parameter to ensure fresh data
    const response = await fetch(`/api/list_streaming_services.php?t=${Date.now()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch streaming services');
    }
    const services = await response.json();
    return services;
  } catch (error) {
    console.error('Failed to load streaming services:', error);
    // Fallback to empty array
    return [];
  }
}

/**
 * Get service label from filename (replace "-" with spaces, remove extension)
 */
export function getServiceLabel(filename: string): string {
  return filename
    .replace(/\.svg$/i, '')
    .replace(/-/g, ' ');
}

/**
 * Get service icon URL from filename or service key
 * Handles both old service keys (like "netflix") and new filenames (like "netflix.svg")
 */
export function getServiceIcon(serviceNameOrFilename: string): string {
  // If it already has .svg extension, use it directly
  if (serviceNameOrFilename.toLowerCase().endsWith('.svg')) {
    return `/data/streaming/${serviceNameOrFilename}`;
  }
  // Otherwise, treat it as a service key and try to find matching file
  // Return the data path (used for streaming service icons)
  return `/data/streaming/${serviceNameOrFilename.toLowerCase()}.svg`;
}

/**
 * Get service key from filename (for matching/identification)
 */
export function getServiceKey(filename: string): string {
  return filename.replace(/\.svg$/i, '').toLowerCase();
}

/**
 * Get default streaming services (available to all users)
 */
export async function getDefaultStreamingServices(): Promise<import('../types').StreamingService[]> {
  try {
    const response = await fetch(`/api/get_default_streaming_services.php?t=${Date.now()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch default streaming services');
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to load default streaming services:', error);
    return [];
  }
}

/**
 * Get streaming service logo URL
 */
export function getServiceLogoUrl(logo: string): string {
  return `/data/streaming/${logo}`;
}

/**
 * Search TMDB for streaming providers
 */
export interface TMDBProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  display_priority: number;
}

export async function searchTMDBProviders(query: string): Promise<{ providers: TMDBProvider[], imageBaseUrl: string }> {
  try {
    const response = await fetch(`/api/search_tmdb_providers.php?query=${encodeURIComponent(query)}`);
    const data = await response.json();
    
    console.log('API Response:', data);
    
    if (!response.ok || !data.success) {
      const errorMsg = data.message || data.error || 'Failed to search TMDB providers';
      console.error('TMDB API Error:', data);
      throw new Error(errorMsg);
    }
    
    return {
      providers: data.providers || [],
      imageBaseUrl: data.tmdb_image_base_url || ''
    };
  } catch (error) {
    console.error('Failed to search TMDB providers:', error);
    throw error;
  }
}

/**
 * Add streaming service to user's profile
 */
export async function addUserStreamingService(
  userId: string,
  serviceName: string,
  logoUrl: string,
  tmdbProviderId?: number
): Promise<{ success: boolean; service?: import('../types').StreamingService; error?: string }> {
  try {
    const response = await fetch('/api/add_user_streaming_service.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        service_name: serviceName,
        logo_url: logoUrl,
        tmdb_provider_id: tmdbProviderId
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to add service' };
    }
    
    return { success: true, service: data.service };
  } catch (error) {
    console.error('Failed to add streaming service:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Explore content types
 */
export interface ExploreItem {
  id: string;
  title: string;
  tmdb_id: number;
  poster_path?: string;
  services: string[];
  first_air_date?: string;
  release_date?: string;
  isMovie: boolean;
  // Extended TMDB data (optional for backward compatibility)
  genres?: import('../types').Genre[];
  overview?: string;
  vote_average?: number;
  vote_count?: number;
  runtime?: number;
  cast?: import('../types').CastMember[];
  crew?: import('../types').CrewMember[];
  keywords?: import('../types').Keyword[];
  videos?: import('../types').Video[]; // Trailers, teasers, etc.
  // Additional TMDB data
  recommendations?: import('../types').RelatedContent[];
  similar?: import('../types').RelatedContent[];
  translations?: import('../types').Translation[];
  networks?: import('../types').Network[]; // TV shows only
  number_of_seasons?: number; // TV shows only
  number_of_episodes?: number; // TV shows only
}

/**
 * Check if content has extended TMDB data
 */
function hasExtendedData(content: ExploreItem[]): boolean {
  if (content.length === 0) return false;
  // Check first few items to see if they have extended data
  const sample = content.slice(0, 5);
  return sample.some(item => 
    item.genres || 
    item.overview || 
    item.cast || 
    item.crew || 
    item.videos
  );
}

/**
 * Fetch top movies and shows for explore tab
 * Optionally triggers background regeneration if extended data is missing
 * Returns content and last updated timestamp
 */
export async function getExploreContent(triggerBackgroundRefresh = true): Promise<{ content: ExploreItem[]; lastUpdated: Date | null }> {
  try {
    // Fetch both movies and shows (with cache-busting to ensure fresh data)
    const cacheBuster = `?t=${Date.now()}`;
    const [moviesResponse, showsResponse] = await Promise.all([
      fetch(`/data/streaming-movies-results.json${cacheBuster}`),
      fetch(`/data/streaming-shows-results.json${cacheBuster}`)
    ]);

    const [movies, shows] = await Promise.all([
      moviesResponse.json(),
      showsResponse.json()
    ]);
    

    // Get last modified timestamps
    // Try API endpoint first (works in production), then fall back to headers
    let lastUpdated: Date | null = null;
    
    try {
      // Try to get timestamp from API endpoint
      const timestampResponse = await fetch('/api/get_content_timestamp.php');
      if (timestampResponse.ok) {
        const data = await timestampResponse.json();
        if (data.timestamp) {
          lastUpdated = new Date(data.timestamp * 1000); // Convert from Unix timestamp
        }
      } else {
        // If API fails, try headers
        const moviesLastModified = moviesResponse.headers.get('Last-Modified');
        const showsLastModified = showsResponse.headers.get('Last-Modified');

        const timestamps: Date[] = [];
        if (moviesLastModified) {
          timestamps.push(new Date(moviesLastModified));
        }
        if (showsLastModified) {
          timestamps.push(new Date(showsLastModified));
        }

        if (timestamps.length > 0) {
          lastUpdated = new Date(Math.max(...timestamps.map(d => d.getTime())));
        }
      }
    } catch (e) {
      // If fetch fails entirely, try headers as fallback
      console.warn('Failed to fetch timestamp from API, trying headers:', e);
      const moviesLastModified = moviesResponse.headers.get('Last-Modified');
      const showsLastModified = showsResponse.headers.get('Last-Modified');

      const timestamps: Date[] = [];
      if (moviesLastModified) {
        timestamps.push(new Date(moviesLastModified));
      }
      if (showsLastModified) {
        timestamps.push(new Date(showsLastModified));
      }

      if (timestamps.length > 0) {
        lastUpdated = new Date(Math.max(...timestamps.map(d => d.getTime())));
      }
    }

    // Combine all content
    const allContent = [...movies, ...shows];
    
    
    // Migrate poster_filename to poster_path (backward compatibility)
    // Old JSON files have poster_filename (local filename), new ones have poster_path (TMDB path)
    // For items with tmdb_id but no poster_path, we'll fetch it on-demand when displayed
    const migratedContent = allContent.map((item: any) => {
      // If already has poster_path (and it's not null or the string "null"), use it (preserve it!)
      if (item.poster_path && 
          item.poster_path !== null && 
          item.poster_path !== 'null' && 
          item.poster_path !== '' &&
          typeof item.poster_path === 'string' &&
          item.poster_path.startsWith('/')) {
        // Ensure poster_path is preserved
        return {
          ...item,
          poster_path: item.poster_path, // Explicitly preserve
        };
      }
      // If has old poster_filename but no valid poster_path, keep tmdb_id for on-demand fetching
      // The poster_path will be fetched when the item is displayed (in TitleCard)
      if (item.poster_filename) {
        return {
          ...item,
          poster_path: null, // Will be fetched on-demand
          // Keep tmdb_id so we can fetch poster_path later
          // Remove old field
          poster_filename: undefined,
          poster_id: undefined,
        };
      }
      // No poster at all - set to null (not the string "null")
      return {
        ...item,
        poster_path: null,
        poster_filename: undefined,
        poster_id: undefined,
      };
    });
    
    
    // If content is missing extended data and background refresh is enabled,
    // trigger regeneration in the background (non-blocking)
    if (triggerBackgroundRefresh && !hasExtendedData(migratedContent)) {
      // Trigger regeneration in background - don't wait for it
      regenerateExploreContent('all').catch(err => {
        console.error('Background content regeneration failed:', err);
      });
    }
    
    return { content: migratedContent, lastUpdated };
  } catch (error) {
    console.error('Failed to fetch explore content:', error);
    return { content: [], lastUpdated: null };
  }
}

/**
 * Regenerate explore content from TMDB API
 * @param type - 'movies' | 'shows' | 'all' (default: 'all')
 */
export async function regenerateExploreContent(type: 'movies' | 'shows' | 'all' = 'all'): Promise<{ success: boolean; results?: any; error?: string }> {
  try {
    const response = await fetch(`/api/regenerate_explore_content.php?type=${type}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const data = await response.json();
    
    if (!response.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to regenerate content' };
    }
    
    return { success: true, results: data.results };
  } catch (error) {
    console.error('Failed to regenerate explore content:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Fetch just the poster_path from TMDB (lightweight call)
 */
export async function fetchPosterPath(tmdbId: number, isMovie: boolean): Promise<string | null> {
  try {
    const response = await fetch(`/api/get_item_details.php?tmdb_id=${tmdbId}&is_movie=${isMovie ? 'true' : 'false'}`);
    
    if (!response.ok) {
      return null;
    }
    
    const result = await response.json();
    if (result.success && result.data?.poster_path) {
      return result.data.poster_path;
    }
    return null;
  } catch (error) {
    console.error('Failed to fetch poster_path:', error);
    return null;
  }
}

/**
 * Get extended TMDB details for a single movie or TV show
 * Fetches on-demand when user clicks the details button
 */
export async function getItemDetails(tmdbId: number, isMovie: boolean): Promise<{ success: boolean; data?: Partial<import('../types').WatchBoxItem>; imageBaseUrl?: string; error?: string }> {
  try {
    const response = await fetch(`/api/get_item_details.php?tmdb_id=${tmdbId}&is_movie=${isMovie ? 'true' : 'false'}`);
    
    if (!response.ok) {
      // Try to parse JSON error response, but handle cases where it might be HTML/text
      let errorMessage = 'Failed to fetch details';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        // If JSON parsing fails, try to get text
        try {
          const errorText = await response.text();
          // Check if it's a PHP error message
          if (errorText.includes('PHP') || errorText.includes('php')) {
            errorMessage = 'Server error: PHP may not be configured correctly';
          } else {
            errorMessage = `Server error (${response.status})`;
          }
        } catch {
          errorMessage = `Server error (${response.status})`;
        }
      }
      return { success: false, error: errorMessage };
    }
    
    const result = await response.json();
    
    console.log('[API] Full result keys:', Object.keys(result));
    console.log('[API] Has providers in result.data:', !!result.data?.providers);
    console.log('[API] Providers value:', result.data?.providers);
    console.log('[API] Providers type:', typeof result.data?.providers);
    console.log('[API] Full result.data keys:', Object.keys(result.data || {}));
    
    if (!result.success) {
      return { success: false, error: result.error || 'Failed to fetch details' };
    }
    
    return { 
      success: true, 
      data: result.data,
      imageBaseUrl: result.tmdb_image_base_url || 'https://image.tmdb.org/t/p/original'
    };
  } catch (error) {
    console.error('Failed to fetch item details:', error);
    return { success: false, error: 'Network error: Unable to connect to server' };
  }
}

