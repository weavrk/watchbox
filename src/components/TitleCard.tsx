import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CircleEllipsis, X, Star, Clock, Play, Users, Film, Tv, Globe, Loader2 } from 'lucide-react';
import type { WatchBoxItem } from '../types';
import { getPosterUrl, getItemDetails } from '../services/api';

interface TitleCardProps {
  item: WatchBoxItem;
  onDelete?: (id: string) => void;
  onMove?: (id: string, newListType: 'top' | 'watch') => void;
}

export function TitleCard({ item }: TitleCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [extendedData, setExtendedData] = useState<Partial<WatchBoxItem> | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const handleDetailsOpen = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Open modal immediately
    setDetailsOpen(true);
    
    // Check if we already have extended data
    const hasExtendedData = item.genres || item.overview || item.cast || item.crew || 
      item.videos || item.recommendations || item.similar || item.keywords;
    
    // If we don't have extended data, fetch it on-demand
    if (!hasExtendedData && item.tmdb_id) {
      setLoadingDetails(true);
      setDetailsError(null);
      setExtendedData(null);
      
      try {
        // Determine if it's a movie or TV show based on item properties
        // TV shows have number_of_seasons or number_of_episodes
        const isMovie = !item.number_of_seasons && !item.number_of_episodes;
        const result = await getItemDetails(item.tmdb_id, isMovie);
        if (result.success && result.data) {
          setExtendedData(result.data);
        } else {
          setDetailsError(result.error || 'Failed to load details');
        }
      } catch (error) {
        setDetailsError('Network error loading details');
        console.error('Error fetching item details:', error);
      } finally {
        setLoadingDetails(false);
      }
    } else {
      // We already have extended data, use it
      setExtendedData(null);
    }
  };

  const handleCloseModal = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setDetailsOpen(false);
    // Reset extended data when closing (will refetch if needed next time)
    setExtendedData(null);
    setLoadingDetails(false);
    setDetailsError(null);
  };

  // Close modal on escape key
  useEffect(() => {
    if (!detailsOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDetailsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [detailsOpen]);


  // Merge extended data from API with item data
  const displayData: WatchBoxItem = {
    ...item,
    ...(extendedData || {}),
    // Prefer extended data over item data, but keep item data as fallback
    genres: extendedData?.genres || item.genres,
    overview: extendedData?.overview || item.overview,
    vote_average: extendedData?.vote_average !== undefined ? extendedData.vote_average : item.vote_average,
    vote_count: extendedData?.vote_count !== undefined ? extendedData.vote_count : item.vote_count,
    runtime: extendedData?.runtime !== undefined ? extendedData.runtime : item.runtime,
    cast: extendedData?.cast || item.cast,
    crew: extendedData?.crew || item.crew,
    keywords: extendedData?.keywords || item.keywords,
    videos: extendedData?.videos || item.videos,
    recommendations: extendedData?.recommendations || item.recommendations,
    similar: extendedData?.similar || item.similar,
    translations: extendedData?.translations || item.translations,
    networks: extendedData?.networks || item.networks,
    number_of_seasons: extendedData?.number_of_seasons !== undefined ? extendedData.number_of_seasons : item.number_of_seasons,
    number_of_episodes: extendedData?.number_of_episodes !== undefined ? extendedData.number_of_episodes : item.number_of_episodes,
  };
  
  // Check if we have any extended data to display
  const hasExtendedData = displayData.genres || displayData.overview || displayData.cast || displayData.crew || 
    displayData.videos || displayData.recommendations || displayData.similar || displayData.keywords;

  // Format runtime
  const formatRuntime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  // Get YouTube URL for trailer
  const getTrailerUrl = (key: string) => `https://www.youtube.com/watch?v=${key}`;

  return (
    <div className="title-card">
      <div className="poster-container">
        <img
          src={getPosterUrl(item.poster_filename || item.poster_id || '1.svg')}
          alt={item.title}
          className="poster-image"
          loading="lazy"
        />
        {/* Info button overlay - always show */}
        <button 
          className="info-button"
          onClick={handleDetailsOpen}
          aria-label="View details"
        >
          <CircleEllipsis size={24} />
        </button>
      </div>
      <div className="title-info">
        <span className="title-text">{item.title}</span>
      </div>

      {/* Details Modal - Rendered via Portal at document root */}
      {detailsOpen && createPortal(
        <div 
          className="details-modal-overlay" 
          onClick={(e) => {
            // Only close if clicking directly on overlay, not modal content
            if (e.target === e.currentTarget) {
              handleCloseModal(e);
            }
          }}
        >
          <div 
            ref={modalRef}
            className="details-modal" 
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              className="details-modal-close"
              onClick={handleCloseModal}
              aria-label="Close"
            >
              <X size={24} />
            </button>

            <div className="details-modal-header">
              <img
                src={getPosterUrl(item.poster_filename || item.poster_id || '1.svg')}
                alt={item.title}
                className="details-modal-poster"
              />
              <div className="details-modal-title-section">
                <h2 className="details-modal-title">{item.title}</h2>
                
                <div className="details-modal-meta">
                  {displayData.vote_average !== undefined && (
                    <span className="details-meta-item">
                      <Star size={16} className="meta-icon" />
                      {displayData.vote_average.toFixed(1)}
                      {displayData.vote_count && <span className="vote-count">({displayData.vote_count.toLocaleString()} votes)</span>}
                    </span>
                  )}
                  {displayData.runtime && (
                    <span className="details-meta-item">
                      <Clock size={16} className="meta-icon" />
                      {formatRuntime(displayData.runtime)}
                    </span>
                  )}
                  {displayData.number_of_seasons !== undefined && (
                    <span className="details-meta-item">
                      <Tv size={16} className="meta-icon" />
                      {displayData.number_of_seasons} season{displayData.number_of_seasons !== 1 ? 's' : ''}
                      {displayData.number_of_episodes && ` · ${displayData.number_of_episodes} episodes`}
                    </span>
                  )}
                </div>

                {displayData.genres && displayData.genres.length > 0 && (
                  <div className="details-genres">
                    {displayData.genres.map(genre => (
                      <span key={genre.id} className="genre-tag">{genre.name}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="details-modal-content">
              {/* Loading state */}
              {loadingDetails && (
                <div className="details-section" style={{ textAlign: 'center', padding: '2rem' }}>
                  <Loader2 size={32} className="spinning" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem', display: 'block' }} />
                  <p style={{ color: 'var(--text-secondary)' }}>Loading details...</p>
                </div>
              )}

              {/* Error state */}
              {detailsError && !loadingDetails && (
                <div className="details-section">
                  <p className="details-overview" style={{ color: 'var(--error)', fontStyle: 'italic' }}>
                    {detailsError}
                  </p>
                </div>
              )}

              {/* Show message if no extended data and not loading */}
              {!hasExtendedData && !loadingDetails && !detailsError && (
                <div className="details-section">
                  <p className="details-overview" style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    Loading extended details...
                  </p>
                </div>
              )}

              {/* Overview */}
              {displayData.overview && (
                <div className="details-section">
                  <h3 className="details-section-title">Overview</h3>
                  <p className="details-overview">{displayData.overview}</p>
                </div>
              )}

              {/* Networks (TV shows) */}
              {displayData.networks && displayData.networks.length > 0 && (
                <div className="details-section">
                  <h3 className="details-section-title">
                    <Globe size={18} className="section-icon" />
                    Networks
                  </h3>
                  <div className="details-networks">
                    {displayData.networks.map(network => (
                      <span key={network.id} className="network-tag">{network.name}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Trailers */}
              {displayData.videos && displayData.videos.length > 0 && (
                <div className="details-section">
                  <h3 className="details-section-title">
                    <Play size={18} className="section-icon" />
                    Trailers
                  </h3>
                  <div className="details-trailers">
                    {displayData.videos.map(video => (
                      <a 
                        key={video.id} 
                        href={getTrailerUrl(video.key)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="trailer-link"
                      >
                        <Play size={16} />
                        {video.name}
                        {video.type !== 'Trailer' && <span className="trailer-type">({video.type})</span>}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Cast */}
              {displayData.cast && displayData.cast.length > 0 && (
                <div className="details-section">
                  <h3 className="details-section-title">
                    <Users size={18} className="section-icon" />
                    Cast
                  </h3>
                  <div className="details-cast">
                    {displayData.cast.slice(0, 10).map(actor => (
                      <div key={actor.id} className="cast-member">
                        <span className="cast-name">{actor.name}</span>
                        {actor.character && (
                          <span className="cast-character">as {actor.character}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Crew */}
              {displayData.crew && displayData.crew.length > 0 && (
                <div className="details-section">
                  <h3 className="details-section-title">
                    <Film size={18} className="section-icon" />
                    Crew
                  </h3>
                  <div className="details-crew">
                    {displayData.crew.map((member, index) => (
                      <div key={`${member.id}-${index}`} className="crew-member">
                        <span className="crew-name">{member.name}</span>
                        <span className="crew-job">{member.job}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Keywords */}
              {displayData.keywords && displayData.keywords.length > 0 && (
                <div className="details-section">
                  <h3 className="details-section-title">Keywords</h3>
                  <div className="details-keywords">
                    {displayData.keywords.map(keyword => (
                      <span key={keyword.id} className="keyword-tag">{keyword.name}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {displayData.recommendations && displayData.recommendations.length > 0 && (
                <div className="details-section">
                  <h3 className="details-section-title">Recommended</h3>
                  <div className="details-related">
                    {displayData.recommendations.slice(0, 6).map(rec => (
                      <div key={rec.id} className="related-item">
                        <span className="related-title">{rec.title}</span>
                        {rec.vote_average !== undefined && (
                          <span className="related-rating">
                            <Star size={12} /> {rec.vote_average.toFixed(1)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Similar */}
              {displayData.similar && displayData.similar.length > 0 && (
                <div className="details-section">
                  <h3 className="details-section-title">Similar</h3>
                  <div className="details-related">
                    {displayData.similar.slice(0, 6).map(sim => (
                      <div key={sim.id} className="related-item">
                        <span className="related-title">{sim.title}</span>
                        {sim.vote_average !== undefined && (
                          <span className="related-rating">
                            <Star size={12} /> {sim.vote_average.toFixed(1)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Translations */}
              {displayData.translations && displayData.translations.length > 0 && (
                <div className="details-section">
                  <h3 className="details-section-title">
                    <Globe size={18} className="section-icon" />
                    Available Languages
                  </h3>
                  <div className="details-translations">
                    {displayData.translations.slice(0, 15).map((trans, index) => (
                      <span key={`${trans.iso_639_1}-${trans.iso_3166_1}-${index}`} className="translation-tag">
                        {trans.english_name}
                      </span>
                    ))}
                    {displayData.translations.length > 15 && (
                      <span className="translation-more">+{displayData.translations.length - 15} more</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

