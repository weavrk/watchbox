import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CirclePlus, CheckCircle2, X, Star, Clock, Play, Users, Film, Tv, Globe, Loader2, ArrowLeft, ListOrdered, Trash2 } from 'lucide-react';
import type { WatchBoxItem } from '../types';
import { getPosterUrl, getItemDetails } from '../services/api';

interface TitleCardProps {
  item: WatchBoxItem;
  onDelete?: (id: string) => void;
  onMove?: (id: string, newListType: 'top' | 'watch') => void;
  onAddToWatchlist?: (item: WatchBoxItem) => void;
}

// Reusable Card Action Button Component
interface CardActionButtonProps {
  icon: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  ariaLabel: string;
  className?: string;
  position?: 'left' | 'right';
}

function CardActionButton({ icon, onClick, ariaLabel, className = '', position = 'right' }: CardActionButtonProps) {
  return (
    <button
      className={`card-action-button ${className} ${position}`}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {icon}
    </button>
  );
}

// Reusable Details Modal Action Button Component (for + Add, Move, etc.)
interface DetailsModalActionButtonProps {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  ariaLabel: string;
  className?: string;
}

function DetailsModalActionButton({ label, onClick, ariaLabel, className = '' }: DetailsModalActionButtonProps) {
  return (
    <button
      className={`details-modal-action-button ${className}`}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {label}
    </button>
  );
}

interface CastMemberPage {
  type: 'cast';
  castMember: {
    id: number;
    name: string;
    character: string;
    profile_path?: string;
  };
  filmography: Array<{
    id: number;
    title: string;
    poster_path?: string;
    release_date?: string;
    first_air_date?: string;
    isMovie: boolean;
  }>;
}

export function TitleCard({ item, onDelete, onMove, onAddToWatchlist }: TitleCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [navigationStack, setNavigationStack] = useState<Array<WatchBoxItem | CastMemberPage>>([]);
  const [currentItem, setCurrentItem] = useState<WatchBoxItem>(item);
  const [currentPage, setCurrentPage] = useState<'item' | 'cast'>('item');
  const [castMemberPage, setCastMemberPage] = useState<CastMemberPage | null>(null);
  const [extendedData, setExtendedData] = useState<Partial<WatchBoxItem> | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadingCastPage, setLoadingCastPage] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [isAdded, setIsAdded] = useState(false);
  const [trailerModalOpen, setTrailerModalOpen] = useState(false);
  const [selectedTrailer, setSelectedTrailer] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const handleTrailerClick = (e: React.MouseEvent, videoKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedTrailer(videoKey);
    setTrailerModalOpen(true);
  };

  const handleCloseTrailerModal = () => {
    setTrailerModalOpen(false);
    setSelectedTrailer(null);
  };

  const getTrailerEmbedUrl = (key: string) => `https://www.youtube.com/embed/${key}?autoplay=1`;

  // Update currentItem when item prop changes
  useEffect(() => {
    setCurrentItem(item);
  }, [item]);

  // Reset scroll to top when navigating to a new page
  useEffect(() => {
    if (detailsOpen && modalRef.current) {
      modalRef.current.scrollTop = 0;
    }
  }, [detailsOpen, currentPage, currentItem, castMemberPage]);

  const fetchCastMemberFilmography = async (castId: number): Promise<CastMemberPage['filmography']> => {
    try {
      const response = await fetch(`/api/get_person_filmography.php?person_id=${castId}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to fetch filmography:', response.status, errorText);
        throw new Error('Failed to fetch filmography');
      }
      const result = await response.json();
      console.log('Filmography result:', result);
      if (result.success && result.filmography && Array.isArray(result.filmography)) {
        console.log('Filmography items:', result.filmography.length);
        // Ensure isMovie is a boolean
        const filmography = result.filmography.map((film: any) => ({
          ...film,
          isMovie: Boolean(film.isMovie)
        }));
        return filmography;
      }
      console.warn('No filmography in result:', result);
      return [];
    } catch (error) {
      console.error('Error fetching cast member filmography:', error);
      return [];
    }
  };

  const openCastMemberPage = async (castMember: { id: number; name: string; character: string; profile_path?: string }, addToStack: boolean = false) => {
    if (addToStack) {
      // Add current page to navigation stack
      if (currentPage === 'item' && currentItem) {
        setNavigationStack(prev => [...prev, currentItem]);
      } else if (currentPage === 'cast' && castMemberPage) {
        setNavigationStack(prev => [...prev, castMemberPage]);
      }
    } else if (!addToStack) {
      // Starting fresh, clear the stack
      setNavigationStack([]);
    }
    
    setLoadingCastPage(true);
    setCurrentPage('cast');
    setDetailsOpen(true);
    setDetailsError(null);
    
    // Reset scroll to top
    if (modalRef.current) {
      modalRef.current.scrollTop = 0;
    }
    
    const filmography = await fetchCastMemberFilmography(castMember.id);
    
    setCastMemberPage({
      type: 'cast',
      castMember,
      filmography
    });
    
    setLoadingCastPage(false);
  };

  const openDetailsModal = async (itemToShow: WatchBoxItem, addToStack: boolean = false) => {
    if (addToStack) {
      // Add current page to navigation stack
      if (currentPage === 'item' && currentItem) {
        setNavigationStack(prev => [...prev, currentItem]);
      } else if (currentPage === 'cast' && castMemberPage) {
        setNavigationStack(prev => [...prev, castMemberPage]);
      }
    } else if (!addToStack) {
      // Starting fresh, clear the stack
      setNavigationStack([]);
    }
    
    setCurrentItem(itemToShow);
    setCurrentPage('item');
    setDetailsOpen(true);
    setExtendedData(null);
    setDetailsError(null);
    setIsAdded(false); // Reset added state for new item
    
    // Reset scroll to top
    if (modalRef.current) {
      modalRef.current.scrollTop = 0;
    }
    
    // Check if we already have extended data
    const hasExtendedData = itemToShow.genres || itemToShow.overview || itemToShow.cast || itemToShow.crew || 
      itemToShow.videos || itemToShow.recommendations || itemToShow.similar || itemToShow.keywords;
    
    // If we don't have extended data, fetch it on-demand
    if (!hasExtendedData && itemToShow.tmdb_id) {
      setLoadingDetails(true);
      
      try {
        // Use the isMovie field directly from the item
        const result = await getItemDetails(itemToShow.tmdb_id, itemToShow.isMovie);
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
    }
  };

  const handleCardClick = async (e: React.MouseEvent) => {
    // Don't open modal if clicking on action buttons
    if ((e.target as HTMLElement).closest('.add-to-watchlist-button, .card-action-button')) {
      return;
    }
    
    await openDetailsModal(item);
  };

  const handleAddToWatchlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onAddToWatchlist && !isAdded) {
      onAddToWatchlist(item);
      setIsAdded(true);
    }
  };

  const handleBackClick = () => {
    if (navigationStack.length > 0) {
      // Pop from stack and go back to previous page
      const previousPage = navigationStack[navigationStack.length - 1];
      setNavigationStack(prev => prev.slice(0, -1));
      
      // Reset scroll to top
      if (modalRef.current) {
        modalRef.current.scrollTop = 0;
      }
      
      if ('type' in previousPage && previousPage.type === 'cast') {
        // Restore cast member page
        setCastMemberPage(previousPage);
        setCurrentPage('cast');
        setDetailsOpen(true);
      } else {
        // Restore item page
        openDetailsModal(previousPage as WatchBoxItem, false); // Don't add to stack when going back
      }
    } else {
      // No stack, close modal and return to explore
      handleCloseModal();
    }
  };

  const handleCloseModal = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setDetailsOpen(false);
    setNavigationStack([]); // Clear navigation stack when closing
    setCurrentPage('item');
    setCastMemberPage(null);
    // Reset extended data when closing (will refetch if needed next time)
    setExtendedData(null);
    setLoadingDetails(false);
    setLoadingCastPage(false);
    setDetailsError(null);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDelete && window.confirm(`Are you sure you want to remove "${item.title}" from your list?`)) {
      onDelete(item.id);
      handleCloseModal(e);
    }
  };

  const handleMove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onMove) {
      const newListType = item.listType === 'top' ? 'watch' : 'top';
      onMove(item.id, newListType);
      handleCloseModal(e);
    }
  };

  const handleMoveToQueue = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onMove && item.listType !== 'top') {
      onMove(item.id, 'top');
    }
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


  // Merge extended data from API with current item data
  const displayData: WatchBoxItem = {
    ...currentItem,
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


  return (
    <div className="title-card" onClick={handleCardClick}>
      <div className="poster-container">
        <img
          src={getPosterUrl(currentItem.poster_filename || currentItem.poster_id || '1.svg')}
          alt={currentItem.title}
          className="poster-image"
          loading="lazy"
        />
        {/* Action buttons - upper right */}
        <div className="card-actions-container">
          {/* Watchlist card actions: Move to Queue (left) and Delete (right) */}
          {/* Only show on actual watchlist cards, not explore cards */}
          {onMove && onDelete && item.listType === 'watch' && !onAddToWatchlist && (
            <>
              <CardActionButton
                icon={<ListOrdered size={16} />}
                onClick={handleMoveToQueue}
                ariaLabel="Move to Queue"
                position="left"
              />
              <CardActionButton
                icon={<Trash2 size={16} />}
                onClick={handleDelete}
                ariaLabel="Remove from watchlist"
                position="right"
              />
            </>
          )}
          {/* Explore card action: Add to watchlist */}
          {onAddToWatchlist && (
            <button 
              className={`add-to-watchlist-button ${isAdded ? 'added' : ''}`}
              onClick={handleAddToWatchlist}
              aria-label={isAdded ? "Added to watchlist" : "Add to watchlist"}
            >
              {isAdded ? <CheckCircle2 /> : <CirclePlus />}
            </button>
          )}
        </div>
      </div>
      <div className="title-info">
        <span className="title-text">{currentItem.title}</span>
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
            <div className="details-modal-header-actions">
              <button 
                className="details-modal-back"
                onClick={handleBackClick}
                aria-label="Back"
              >
                <ArrowLeft size={24} />
              </button>
              <div className="details-modal-header-right">
                {currentPage === 'item' && onAddToWatchlist && (
                  <DetailsModalActionButton
                    label="+ Add"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!isAdded) {
                        onAddToWatchlist(currentItem);
                        setIsAdded(true);
                      }
                    }}
                    ariaLabel="Add to watchlist"
                  />
                )}
                {currentPage === 'item' && onMove && !onAddToWatchlist && (
                  <DetailsModalActionButton
                    label={item.listType === 'top' ? 'Move to Watchlist' : 'Move to Queue'}
                    onClick={handleMove}
                    ariaLabel="Move"
                  />
                )}
          <button 
                  className="details-modal-close"
                  onClick={handleCloseModal}
                  aria-label="Close"
                >
                  <X size={24} />
          </button>
        </div>
      </div>

            {currentPage === 'cast' && castMemberPage ? (
              <div className="cast-member-page">
                <div className="cast-member-page-header">
                  <h2 className="cast-member-page-title">{castMemberPage.castMember.name}</h2>
                </div>
                {loadingCastPage ? (
                  <div className="loading" style={{ textAlign: 'center', padding: '2rem' }}>
                    <Loader2 size={32} className="spinning" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem', display: 'block' }} />
                    <p style={{ color: 'var(--text-secondary)' }}>Loading filmography...</p>
                  </div>
                ) : castMemberPage.filmography.length > 0 ? (
                  <div className="explore-grid">
                    {castMemberPage.filmography.map(film => {
                      const filmItem: WatchBoxItem = {
                        id: `film-${film.id}`,
                        title: film.title,
                        tmdb_id: film.id,
                        poster_filename: film.poster_path ? `https://image.tmdb.org/t/p/w500${film.poster_path}` : '',
                        listType: 'watch',
                        services: [],
                        isMovie: Boolean(film.isMovie)
                      };
                      
                      return (
                        <div 
                          key={film.id} 
                          className="title-card"
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            await openDetailsModal(filmItem, true); // Add to navigation stack
                          }}
                        >
                          <div className="poster-container">
                            {film.poster_path ? (
                              <img 
                                src={`https://image.tmdb.org/t/p/w500${film.poster_path}`}
                                alt={film.title}
                                className="poster-image"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  if (target.src !== getPosterUrl('1.svg')) {
                                    target.src = getPosterUrl('1.svg');
                                  }
                                }}
                              />
                            ) : (
                              <div className="poster-placeholder">
                                <Film size={32} />
                              </div>
                            )}
                            {onAddToWatchlist && (
                              <button
                                className="add-to-watchlist-button"
                                onClick={async (e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (onAddToWatchlist) {
                                    onAddToWatchlist(filmItem);
                                  }
                                }}
                                aria-label="Add to watchlist"
                              >
                                <CirclePlus size={16} />
                              </button>
                            )}
                          </div>
                          <div className="title-info">
                            <span className="title-text">{film.title}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="details-section" style={{ textAlign: 'center', padding: '2rem' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>No filmography found.</p>
                  </div>
                )}
              </div>
            ) : (
              <>
            <div className="details-modal-header">
              <div className="details-modal-header-main">
                <div className="details-modal-poster-container">
                  <img
                    src={getPosterUrl(currentItem.poster_filename || currentItem.poster_id || '1.svg')}
                    alt={currentItem.title}
                    className="details-modal-poster"
                    onError={(e) => {
                      // Fallback to default poster if image fails to load
                      const target = e.target as HTMLImageElement;
                      if (target.src !== getPosterUrl('1.svg')) {
                        target.src = getPosterUrl('1.svg');
                      }
                    }}
                  />
                </div>
                <div className="details-modal-title-section">
                  <h2 className="details-modal-title">{currentItem.title}</h2>
                  
                  <div className="details-modal-meta">
                    {displayData.vote_average !== undefined && (
                      <span className="details-meta-item">
                        <Star size={16} className="meta-icon" />
                        <span className="meta-text">{displayData.vote_average.toFixed(1)}</span>
                        {displayData.vote_count && <span className="vote-count">({displayData.vote_count.toLocaleString()} votes)</span>}
                      </span>
                    )}
                    {displayData.runtime && (
                      <span className="details-meta-item">
                        <Clock size={16} className="meta-icon" />
                        <span className="meta-text">{formatRuntime(displayData.runtime)}</span>
                      </span>
                    )}
                    {displayData.number_of_seasons !== undefined && (
                      <span className="details-meta-item">
                        <Tv size={16} className="meta-icon" />
                        <span className="meta-text">{displayData.number_of_seasons} season{displayData.number_of_seasons !== 1 ? 's' : ''}</span>
                        {displayData.number_of_episodes && <span className="meta-text"> · {displayData.number_of_episodes} episodes</span>}
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
              
              {/* Overview below header row */}
              {displayData.overview && (
                <>
                  <p className="details-overview-header">{displayData.overview}</p>
                  {/* Director and Writer below overview */}
                  {displayData.crew && displayData.crew.length > 0 && (
                    <div className="details-director-writer">
                      {(() => {
                        const directors = displayData.crew.filter(member => member.job === 'Director');
                        const writers = displayData.crew.filter(member => member.job === 'Writer' || member.job === 'Screenplay');
                        
                        return (
                          <>
                            {directors.length > 0 && (
                              <p className="details-director-writer-text">Director: {directors.map(d => d.name).join(', ')}</p>
                            )}
                            {writers.length > 0 && (
                              <p className="details-director-writer-text">Writer: {writers.map(w => w.name).join(', ')}</p>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="details-modal-content">
              {/* Loading state */}
              {loadingDetails && (
                <div className="details-section" style={{ textAlign: 'center', padding: '2rem' }}>
                  <Loader2 size={32} className="spinning" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem', display: 'block' }} />
                  <p style={{ color: 'var(--text-secondary)' }}>Loading details...</p>
                </div>
              )}

              {/* Error state - only show if we have no data at all */}
              {detailsError && !loadingDetails && !displayData.overview && !displayData.genres && (
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
                  <div className="details-trailers-grid">
                    {displayData.videos.map(video => (
                      <div 
                        key={video.id} 
                        className="trailer-card"
                        onClick={(e) => handleTrailerClick(e, video.key)}
                      >
                        <div className="trailer-image-container">
                          <div className="trailer-placeholder">
                            <Film size={32} className="trailer-play-icon" />
                          </div>
                        </div>
                        <span className="trailer-name">{video.name}</span>
                      </div>
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
                  <div className="details-cast-grid">
                    {displayData.cast.slice(0, 12).map(actor => (
                      <div 
                        key={actor.id} 
                        className="cast-member-card"
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          await openCastMemberPage({
                            id: actor.id,
                            name: actor.name,
                            character: actor.character,
                            profile_path: actor.profile_path
                          }, true); // Add to navigation stack
                        }}
                      >
                        {actor.profile_path ? (
                          <img 
                            src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`}
                            alt={actor.name}
                            className="cast-profile-image"
                          />
                        ) : (
                          <div className="cast-profile-placeholder">
                            <Users size={24} />
                          </div>
                        )}
                        <span className="cast-name">{actor.name}</span>
                        {actor.character && (
                          <span className="cast-character">{actor.character}</span>
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
                  <div className="details-related-grid">
                    {displayData.similar.slice(0, 8).map(sim => {
                      // Convert similar item to WatchBoxItem for modal
                      const similarItem: WatchBoxItem = {
                        id: `similar-${sim.id}`,
                        title: sim.title,
                        tmdb_id: sim.id,
                        poster_filename: sim.poster_path ? `https://image.tmdb.org/t/p/w500${sim.poster_path}` : '',
                        listType: 'watch',
                        services: [],
                        isMovie: currentItem.isMovie, // Use same type as current item
                        vote_average: sim.vote_average
                      };
                      
                      return (
                        <div 
                          key={sim.id} 
                          className="related-item-card"
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            await openDetailsModal(similarItem, true); // Add to navigation stack
                          }}
                        >
                          {sim.poster_path ? (
                            <img 
                              src={`https://image.tmdb.org/t/p/w185${sim.poster_path}`}
                              alt={sim.title}
                              className="related-poster"
                            />
                          ) : (
                            <div className="related-poster-placeholder">
                              <Film size={24} />
                            </div>
                          )}
                          <span className="related-title">{sim.title}</span>
                          {sim.vote_average !== undefined && (
                            <span className="related-rating">
                              <Star size={12} /> {sim.vote_average.toFixed(1)}
                            </span>
                          )}
                        </div>
                      );
                    })}
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
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Trailer Modal */}
      {trailerModalOpen && selectedTrailer && createPortal(
        <div 
          className="trailer-modal-overlay" 
          onClick={handleCloseTrailerModal}
        >
          <div 
            className="trailer-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              className="trailer-modal-close"
              onClick={handleCloseTrailerModal}
              aria-label="Close"
            >
              <X size={24} />
            </button>
            <iframe
              src={getTrailerEmbedUrl(selectedTrailer)}
              className="trailer-iframe"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="Trailer"
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

