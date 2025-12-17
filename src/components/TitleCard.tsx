import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CirclePlus, CheckCircle2, X, Star, Clock, Play, Users, Film, Tv, Globe, Loader2, ArrowLeft, ListOrdered, Trash2, Monitor } from 'lucide-react';
import type { WatchBoxItem } from '../types';
import { getPosterUrl, getItemDetails } from '../services/api';

interface TitleCardProps {
  item: WatchBoxItem;
  onDelete?: (id: string) => void;
  onMove?: (id: string, newListType: 'top' | 'watch') => void;
  onAddToWatchlist?: (item: WatchBoxItem) => void;
  /**
   * Visual/behavior variant for the small grid card:
   * - "add": shows + add button
   * - "manage": shows Move to Queue + Delete
   * Defaults to "add" for explore cards.
   */
  variant?: 'add' | 'manage';
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

type TitleCardVariant = 'add' | 'manage';

interface ReusableTitleCardProps {
  title: string;
  posterSrc?: string;
  /**
   * Optional fallback poster URL for when the main poster fails to load.
   */
  fallbackPosterSrc?: string;
  /**
   * When true and no posterSrc, show a Film icon placeholder.
   */
  showPlaceholderOnMissingPoster?: boolean;
  variant: TitleCardVariant;
  isAdded?: boolean;
  onCardClick?: (e: React.MouseEvent) => void;
  onAddClick?: (e: React.MouseEvent) => void;
  onMoveToQueueClick?: (e: React.MouseEvent) => void;
  onDeleteClick?: (e: React.MouseEvent) => void;
}

/**
 * Reusable small grid card used for:
 * - Main watchlist / explore grids
 * - Cast member filmography grid
 * - Similar items section
 *
 * It only knows about visuals + basic actions; higher level components
 * decide what the handlers do.
 */
function ReusableTitleCard({
  title,
  posterSrc,
  fallbackPosterSrc,
  showPlaceholderOnMissingPoster = false,
  variant,
  isAdded,
  onCardClick,
  onAddClick,
  onMoveToQueueClick,
  onDeleteClick,
}: ReusableTitleCardProps) {
  const [imageError, setImageError] = useState(false);
  const showManageActions = variant === 'manage' && onMoveToQueueClick && onDeleteClick;
  const showAddAction = variant === 'add' && !!onAddClick;

  // Reset error state when posterSrc changes
  useEffect(() => {
    setImageError(false);
  }, [posterSrc]);

  // Determine what to show
  // Show placeholder if: explicitly requested AND (no poster source OR image failed to load)
  const shouldShowPlaceholder = showPlaceholderOnMissingPoster && (!posterSrc || imageError);
  
  // Determine which image source to use
  const currentImageSrc = imageError && fallbackPosterSrc 
    ? fallbackPosterSrc 
    : posterSrc;

  return (
    <div className="title-card" onClick={onCardClick}>
      <div className="poster-container">
        {shouldShowPlaceholder ? (
          <div className="poster-placeholder">
            <Film size={40} />
            <div className="question-mark">?</div>
          </div>
        ) : currentImageSrc ? (
        <img
            src={currentImageSrc}
            alt={title}
          className="poster-image"
          loading="lazy"
            onError={() => {
              // Image failed to load, show placeholder
              setImageError(true);
            }}
          />
        ) : null}

        {/* Action buttons - upper right */}
        <div className="card-actions-container">
          {/* Watchlist card actions: Move to Queue (left) and Delete (right) */}
          {showManageActions && (
            <>
              <CardActionButton
                icon={<ListOrdered size={16} />}
                onClick={onMoveToQueueClick}
                ariaLabel="Move to Queue"
                position="left"
              />
              <CardActionButton
                icon={<Trash2 size={16} />}
                onClick={onDeleteClick}
                ariaLabel="Remove from watchlist"
                position="right"
              />
            </>
          )}

          {/* Explore / filmography card action: Add to watchlist */}
          {showAddAction && (
            <button
              className={`add-to-watchlist-button ${isAdded ? 'added' : ''}`}
              onClick={onAddClick}
              aria-label={isAdded ? 'Added to watchlist' : 'Add to watchlist'}
            >
              {isAdded ? <CheckCircle2 /> : <CirclePlus />}
            </button>
          )}
        </div>
      </div>
      <div className="title-info">
        <span className="title-text">{title}</span>
      </div>
    </div>
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

export function TitleCard({ item, onDelete, onMove, onAddToWatchlist, variant = 'add' }: TitleCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [navigationStack, setNavigationStack] = useState<Array<WatchBoxItem | CastMemberPage>>([]);
  const [currentItem, setCurrentItem] = useState<WatchBoxItem>(item);
  const [currentPage, setCurrentPage] = useState<'item' | 'cast'>('item');
  const [castMemberPage, setCastMemberPage] = useState<CastMemberPage | null>(null);
  const [extendedData, setExtendedData] = useState<Partial<WatchBoxItem> | null>(null);
  const [imageBaseUrl, setImageBaseUrl] = useState<string>('https://image.tmdb.org/t/p/original');
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
          if (result.imageBaseUrl) {
            setImageBaseUrl(result.imageBaseUrl);
          }
          // Update currentItem with poster_path from extended data if available
          if (result.data?.poster_path && !itemToShow.poster_path) {
            setCurrentItem(prev => ({
              ...prev,
              poster_path: result.data?.poster_path
            }));
          }
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
    providers: extendedData?.providers || item.providers,
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

  const cardVariant: TitleCardVariant = variant;

  const posterUrl = getPosterUrl(currentItem.poster_path);
  
  return (
    <>
      <ReusableTitleCard
        title={currentItem.title}
        posterSrc={posterUrl || undefined}
        showPlaceholderOnMissingPoster={!currentItem.poster_path}
        variant={cardVariant}
        isAdded={isAdded}
        onCardClick={handleCardClick}
        onAddClick={
          cardVariant === 'add' && onAddToWatchlist && !isAdded
            ? handleAddToWatchlist
            : undefined
        }
        onMoveToQueueClick={
          cardVariant === 'manage' && onMove && item.listType === 'watch'
            ? handleMoveToQueue
            : undefined
        }
        onDeleteClick={
          cardVariant === 'manage' && onDelete && item.listType === 'watch'
            ? handleDelete
            : undefined
        }
      />

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
                {currentPage === 'item' && cardVariant === 'add' && onAddToWatchlist && (
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
                {currentPage === 'item' && cardVariant === 'manage' && onMove && (
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
                        poster_path: film.poster_path || undefined,
                        listType: 'watch',
                        services: [],
                        isMovie: Boolean(film.isMovie)
                      };

                      return (
                        <ReusableTitleCard
                          key={film.id}
                          title={film.title}
                          posterSrc={getPosterUrl(film.poster_path) || undefined}
                          showPlaceholderOnMissingPoster={!film.poster_path}
                          variant="add"
                          onCardClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            await openDetailsModal(filmItem, true); // Add to navigation stack
                          }}
                          onAddClick={
                            onAddToWatchlist
                              ? async (e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  onAddToWatchlist(filmItem);
                                }
                              : undefined
                          }
                        />
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
                  {getPosterUrl(displayData.poster_path) ? (
                    <img
                      src={getPosterUrl(displayData.poster_path)!}
                      alt={currentItem.title}
                      className="details-modal-poster"
                      onError={(e) => {
                        // Hide image on error, placeholder will show
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="poster-placeholder">
                      <Film size={48} />
                      <div className="question-mark">?</div>
                    </div>
                  )}
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

              {/* Available On (Streaming Providers) */}
              {displayData.providers && displayData.providers.length > 0 && (
                <div className="details-section">
                  <h3 className="details-section-title">
                    <Monitor size={18} className="section-icon" />
                    Available On
                  </h3>
                  <div className="details-providers">
                    {displayData.providers.map(provider => (
                      <div key={provider.provider_id} className="provider-item">
                        {provider.logo_path && (
                          <img
                            src={`${imageBaseUrl}${provider.logo_path}`}
                            alt={provider.provider_name}
                            className="provider-logo"
                          />
                        )}
                        {!provider.logo_path && (
                          <span className="provider-name-fallback">{provider.provider_name}</span>
                        )}
                      </div>
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

              {/* Similar & Recommendations */}
              {(() => {
                // Combine similar and recommendations, deduplicate by ID, filter out items without posters
                const allRelated: Array<{ id: number; title: string; poster_path?: string; vote_average?: number }> = [];
                const seenIds = new Set<number>();
                
                // Add similar items first (prioritize them)
                if (displayData.similar) {
                  displayData.similar.forEach(item => {
                    if (item.poster_path && !seenIds.has(item.id)) {
                      allRelated.push(item);
                      seenIds.add(item.id);
                    }
                  });
                }
                
                // Add recommendations (will skip duplicates)
                if (displayData.recommendations) {
                  displayData.recommendations.forEach(item => {
                    if (item.poster_path && !seenIds.has(item.id)) {
                      allRelated.push(item);
                      seenIds.add(item.id);
                    }
                  });
                }
                
                // Take first 12 items (increased since we're combining two sources)
                const relatedWithPosters = allRelated.slice(0, 12);
                
                return relatedWithPosters.length > 0 ? (
                  <div className="details-section">
                    <h3 className="details-section-title">Similar Recommendations</h3>
                    <div className="explore-grid">
                      {relatedWithPosters.map(item => {
                        // Convert related item to WatchBoxItem for modal
                        const relatedItem: WatchBoxItem = {
                          id: `related-${item.id}`,
                          title: item.title,
                          tmdb_id: item.id,
                          poster_path: item.poster_path || undefined,
                          listType: 'watch',
                          services: [],
                          isMovie: currentItem.isMovie, // Use same type as current item
                          vote_average: item.vote_average
                        };
                        
                        return (
                          <ReusableTitleCard
                            key={item.id}
                            title={item.title}
                            posterSrc={getPosterUrl(item.poster_path) || undefined}
                            showPlaceholderOnMissingPoster={!item.poster_path}
                            variant="add"
                            onCardClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              await openDetailsModal(relatedItem, true); // Add to navigation stack
                            }}
                            onAddClick={onAddToWatchlist ? async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (onAddToWatchlist) {
                                onAddToWatchlist(relatedItem);
                              }
                            } : undefined}
                          />
                        );
                      })}
                    </div>
                  </div>
                ) : null;
              })()}

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
    </>
  );
}

