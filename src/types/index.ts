// Type definitions for WatchBox

export interface StreamingService {
  name: string;
  logo: string; // filename in data/streaming/
  tmdb_provider_id?: number;
}

// TMDB Genre
export interface Genre {
  id: number;
  name: string;
}

// TMDB Cast Member
export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path?: string;
}

// TMDB Crew Member
export interface CrewMember {
  id: number;
  name: string;
  job: string;
  profile_path?: string;
}

// TMDB Keyword
export interface Keyword {
  id: number;
  name: string;
}

// TMDB Video (Trailers, Teasers, etc.)
export interface Video {
  id: string;
  key: string; // YouTube/Vimeo video key
  name: string;
  site: string; // "YouTube" or "Vimeo"
  type: string; // "Trailer", "Teaser", "Featurette", "Behind the Scenes", "Clip"
  official: boolean;
  published_at?: string;
}

// TMDB Network (TV shows - where it originally aired)
export interface Network {
  id: number;
  name: string;
  logo_path?: string;
  origin_country?: string;
}

// TMDB Translation
export interface Translation {
  iso_639_1: string; // Language code (e.g., "en", "es", "fr")
  iso_3166_1: string; // Country code (e.g., "US", "ES", "FR")
  name: string; // Language name in that language
  english_name: string; // Language name in English
}

// TMDB Recommendation/Similar item (simplified)
export interface RelatedContent {
  id: number;
  title: string; // 'title' for movies, 'name' for TV
  poster_path?: string;
  vote_average?: number;
  isMovie: boolean;
}

export interface WatchBoxItem {
  id: string;
  title: string;
  tmdb_id: number;
  poster_id?: number; // Deprecated, kept for backward compatibility
  poster_filename: string;
  listType: 'top' | 'watch';
  services: string[];
  // Extended TMDB data (optional for backward compatibility)
  genres?: Genre[];
  overview?: string;
  vote_average?: number;
  vote_count?: number;
  runtime?: number; // Movies: minutes, Shows: average episode runtime
  cast?: CastMember[];
  crew?: CrewMember[];
  keywords?: Keyword[];
  videos?: Video[]; // Trailers, teasers, etc.
  // Additional TMDB data
  recommendations?: RelatedContent[]; // TMDB recommended similar content
  similar?: RelatedContent[]; // Similar movies/shows
  translations?: Translation[]; // Available translations
  networks?: Network[]; // TV shows: original broadcast networks
  number_of_seasons?: number; // TV shows only
  number_of_episodes?: number; // TV shows only
}

export interface User {
  user_id: string;
  name: string;
  avatar_filename: string;
  updated_at?: string;
  items: WatchBoxItem[];
  streaming_services?: StreamingService[];
  birthday?: string; // Format: "MM/DD/YYYY"
}

export interface UserSummary {
  user_id: string;
  name: string;
  avatar_filename: string;
  streaming_services?: StreamingService[];
  birthday?: string; // Format: "MM/DD/YYYY"
}

export interface CreateUserRequest {
  name: string;
  avatar_filename: string;
  streaming_services?: StreamingService[];
  birthday?: string; // Format: "MM/DD/YYYY"
}

export interface SaveUserRequest {
  user_id: string;
  name: string;
  avatar_filename: string;
  items: WatchBoxItem[];
  streaming_services?: StreamingService[];
  birthday?: string; // Format: "MM/DD/YYYY"
}

