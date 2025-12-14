import { useState, useEffect, useRef } from 'react';
import type { User, WatchBoxItem } from '../types';
import type { ExploreItem } from '../services/api';
import { getExploreContent } from '../services/api';
import { TitleCard } from './TitleCard';

interface ExploreTabProps {
  currentUser: User;
  onAddItem: () => void;
}

const ITEMS_PER_LOAD = 20;

export function ExploreTab({ }: ExploreTabProps) {
  const [allContent, setAllContent] = useState<ExploreItem[]>([]);
  const [displayedContent, setDisplayedContent] = useState<ExploreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadedCount, setLoadedCount] = useState(ITEMS_PER_LOAD);
  const [hasMore, setHasMore] = useState(true);
  const observerTarget = useRef<HTMLDivElement>(null);

  const loadInitialContent = async () => {
    setLoading(true);
    try {
      const content = await getExploreContent();
      setAllContent(content);
      setHasMore(content.length > ITEMS_PER_LOAD);
      setDisplayedContent(content.slice(0, ITEMS_PER_LOAD));
    } catch (error) {
      console.error('Failed to load explore content:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    // Simulate a small delay for better UX
    setTimeout(() => {
      const nextCount = loadedCount + ITEMS_PER_LOAD;
      const newItems = allContent.slice(loadedCount, nextCount);
      
      if (newItems.length > 0) {
        setDisplayedContent(prev => [...prev, ...newItems]);
        setLoadedCount(nextCount);
        setHasMore(nextCount < allContent.length);
      } else {
        setHasMore(false);
      }
      setLoadingMore(false);
    }, 100);
  };

  useEffect(() => {
    loadInitialContent();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget && hasMore) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, loadingMore, loadedCount, allContent.length]);

  const convertToWatchBoxItem = (item: ExploreItem): WatchBoxItem => {
    return {
      id: item.id,
      title: item.title,
      tmdb_id: item.tmdb_id,
      poster_filename: item.poster_filename,
      listType: 'watch',
      services: item.services,
      // Include extended TMDB data
      genres: item.genres,
      overview: item.overview,
      vote_average: item.vote_average,
      vote_count: item.vote_count,
      runtime: item.runtime,
      cast: item.cast,
      crew: item.crew,
      keywords: item.keywords,
      videos: item.videos,
      // Additional TMDB data
      recommendations: item.recommendations,
      similar: item.similar,
      translations: item.translations,
      networks: item.networks,
      number_of_seasons: item.number_of_seasons,
      number_of_episodes: item.number_of_episodes
    };
  };

  if (loading) {
    return <div className="loading">Loading explore content...</div>;
  }

  return (
    <div className="explore-tab">
      <div className="explore-grid">
        {displayedContent.map((item) => {
          const watchBoxItem = convertToWatchBoxItem(item);
          return (
            <TitleCard
              key={item.id}
              item={watchBoxItem}
              onDelete={() => {}}
              onMove={() => {}}
            />
          );
        })}
      </div>
      
      {hasMore && (
        <div ref={observerTarget} style={{ height: '20px', marginTop: '20px' }}>
          {loadingMore && <div className="loading-more">Loading more...</div>}
        </div>
      )}
    </div>
  );
}

