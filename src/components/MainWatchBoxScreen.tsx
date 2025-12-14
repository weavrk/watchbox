import { useEffect, useState, useRef } from 'react';
import { CopyPlus, Funnel, Tv, Search, ChevronDown, Sparkles } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { Header } from './Header';
import { SectionList } from './SectionList';
import { ExploreTab } from './ExploreTab';
import { EditProfileModal } from './EditProfileModal';
import { saveUser, getUser, getAvatarUrl } from '../services/api';
import { extractDominantColor } from '../utils/colorExtraction';
import type { WatchBoxItem, UserSummary } from '../types';

export function MainWatchBoxScreen() {
  const { currentUser, logout, loadUser } = useUser();
  const [items, setItems] = useState<WatchBoxItem[]>([]);
  const [activeTab, setActiveTab] = useState<'watchlist' | 'explore'>('watchlist');
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editingUser, setEditingUser] = useState<UserSummary | null>(null);
  const [mobileFilterType, setMobileFilterType] = useState<'all' | 'shows' | 'movies'>('all');
  const [showCategoriesDropdown, setShowCategoriesDropdown] = useState(false);
  const [sparkleActive, setSparkleActive] = useState(false);
  const [filterButtonActive, setFilterButtonActive] = useState(false);
  const [avatarColor, setAvatarColor] = useState<string>('#4A90E2');
  const avatarImageRef = useRef<HTMLImageElement | null>(null);
  const categoriesDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentUser) {
      setItems(currentUser.items);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      setAvatarColor('#4A90E2'); // Reset to default
      if (avatarImageRef.current && avatarImageRef.current.complete) {
        const color = extractDominantColor(avatarImageRef.current, currentUser.avatar_filename);
        setAvatarColor(color);
      }
    }
  }, [currentUser?.avatar_filename]);

  const handleAvatarImageLoad = (img: HTMLImageElement) => {
    if (currentUser && img.complete && img.naturalWidth > 0) {
      const color = extractDominantColor(img, currentUser.avatar_filename);
      setAvatarColor(color);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoriesDropdownRef.current && !categoriesDropdownRef.current.contains(event.target as Node)) {
        setShowCategoriesDropdown(false);
      }
    };

    if (showCategoriesDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCategoriesDropdown]);

  const handleEditProfile = async () => {
    if (!currentUser) return;
    try {
      const userData = await getUser(currentUser.user_id);
      setEditingUser({
        user_id: userData.user_id,
        name: userData.name,
        avatar_filename: userData.avatar_filename,
        streaming_services: userData.streaming_services,
        birthday: userData.birthday
      });
      setShowEditProfile(true);
    } catch (error) {
      console.error('Failed to load user data:', error);
    }
  };

  const handleSaveProfile = async (userId: string, name: string, avatarFilename: string, streamingServices: import('../types').StreamingService[], birthday: string) => {
    if (!currentUser) return;
    try {
      await saveUser({
        user_id: userId,
        name,
        avatar_filename: avatarFilename,
        items: currentUser.items,
        streaming_services: streamingServices,
        birthday: birthday || undefined
      });
      setShowEditProfile(false);
      setEditingUser(null);
      // Reload user to get updated data
      await loadUser(userId);
    } catch (error) {
      console.error('Failed to save profile:', error);
      alert('Failed to update profile. Please try again.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!currentUser) return;
    
    const updatedItems = items.filter(item => item.id !== id);
    setItems(updatedItems);
    
    // Save to backend
    await saveUser({
      user_id: currentUser.user_id,
      name: currentUser.name,
      avatar_filename: currentUser.avatar_filename,
      items: updatedItems,
      streaming_services: currentUser.streaming_services,
      birthday: currentUser.birthday
    });
  };

  const handleMove = async (id: string, newListType: 'top' | 'watch') => {
    if (!currentUser) return;
    
    const updatedItems = items.map(item =>
      item.id === id ? { ...item, listType: newListType } : item
    );
    setItems(updatedItems);
    
    // Save to backend
    await saveUser({
      user_id: currentUser.user_id,
      name: currentUser.name,
      avatar_filename: currentUser.avatar_filename,
      items: updatedItems,
      streaming_services: currentUser.streaming_services,
      birthday: currentUser.birthday
    });
  };

  const handleAddClick = () => {
    alert('Add flow coming soon!');
  };

  if (!currentUser) {
    return <div>Loading...</div>;
  }

  // Show edit profile modal as full page (like create profile)
  if (showEditProfile && editingUser) {
    return (
      <EditProfileModal
        user={editingUser}
        onClose={() => {
          setShowEditProfile(false);
          setEditingUser(null);
        }}
        onSave={handleSaveProfile}
        onDelete={async () => {
          // Handle delete - switch to profile selection
          setShowEditProfile(false);
          setEditingUser(null);
          logout();
        }}
      />
    );
  }

  const queueItems = items.filter(item => item.listType === 'top');
  const watchlistItems = items.filter(item => item.listType === 'watch');

  return (
    <div className="main-screen gradient-background">
      <Header
        avatarFilename={currentUser.avatar_filename}
        userName={currentUser.name}
        onSwitchAccount={logout}
        onEditProfile={handleEditProfile}
      />
      
      {/* Mobile Filter Bar */}
      {activeTab === 'explore' && (
        <div className="mobile-filter-bar">
          <div className="mobile-filters">
            <button 
              className={`filter-chip filter-icon-button ${sparkleActive ? 'active' : ''}`}
              onClick={() => setSparkleActive(!sparkleActive)}
              aria-label="Sparkle"
            >
              <Sparkles className="filter-icon" size={16} />
            </button>
            <button
              className={`filter-chip ${mobileFilterType === 'movies' ? 'active' : ''}`}
              onClick={() => {
                if (mobileFilterType === 'movies') {
                  // If movies is active, turn it off
                  setMobileFilterType('all');
                } else {
                  // If movies is off, turn it on and turn shows off
                  setMobileFilterType('movies');
                }
              }}
            >
              Movies
            </button>
            <button
              className={`filter-chip ${mobileFilterType === 'shows' ? 'active' : ''}`}
              onClick={() => {
                if (mobileFilterType === 'shows') {
                  // If shows is active, turn it off
                  setMobileFilterType('all');
                } else {
                  // If shows is off, turn it on and turn movies off
                  setMobileFilterType('shows');
                }
              }}
            >
              Shows
            </button>
            <div className="filter-dropdown-container" ref={categoriesDropdownRef}>
              <button
                className={`filter-chip filter-dropdown ${showCategoriesDropdown ? 'active' : ''}`}
                onClick={() => setShowCategoriesDropdown(!showCategoriesDropdown)}
              >
                Categories
                <ChevronDown className="dropdown-icon" size={14} />
              </button>
              {showCategoriesDropdown && (
                <div className="filter-dropdown-menu">
                  <button className="dropdown-item">All Categories</button>
                  <button className="dropdown-item">Action</button>
                  <button className="dropdown-item">Comedy</button>
                  <button className="dropdown-item">Drama</button>
                  <button className="dropdown-item">Horror</button>
                  <button className="dropdown-item">Sci-Fi</button>
                </div>
              )}
            </div>
          </div>
          <button 
            className={`mobile-filter-button ${filterButtonActive ? 'active' : ''}`}
            onClick={() => setFilterButtonActive(!filterButtonActive)}
            aria-label="Filter"
          >
            <Funnel className="filter-icon" size={16} />
          </button>
        </div>
      )}
      
      <main className="content">
        <div className="tabs-container">
          <div className="tabs-group">
            <button
              className={`tab-button ${activeTab === 'watchlist' ? 'active' : ''}`}
              onClick={() => setActiveTab('watchlist')}
            >
              Watchlist
            </button>
            <button
              className={`tab-button ${activeTab === 'explore' ? 'active' : ''}`}
              onClick={() => setActiveTab('explore')}
            >
              Explore
            </button>
          </div>
          {activeTab === 'explore' && (
            <div className="desktop-filters">
              <button 
                className={`filter-chip filter-icon-button ${sparkleActive ? 'active' : ''}`}
                onClick={() => setSparkleActive(!sparkleActive)}
                aria-label="Sparkle"
              >
                <Sparkles className="filter-icon" size={16} />
              </button>
              <button
                className={`filter-chip ${mobileFilterType === 'movies' ? 'active' : ''}`}
                onClick={() => {
                  if (mobileFilterType === 'movies') {
                    setMobileFilterType('all');
                  } else {
                    setMobileFilterType('movies');
                  }
                }}
              >
                Movies
              </button>
              <button
                className={`filter-chip ${mobileFilterType === 'shows' ? 'active' : ''}`}
                onClick={() => {
                  if (mobileFilterType === 'shows') {
                    setMobileFilterType('all');
                  } else {
                    setMobileFilterType('shows');
                  }
                }}
              >
                Shows
              </button>
              <div className="filter-dropdown-container" ref={categoriesDropdownRef}>
                <button
                  className={`filter-chip filter-dropdown ${showCategoriesDropdown ? 'active' : ''}`}
                  onClick={() => setShowCategoriesDropdown(!showCategoriesDropdown)}
                >
                  Categories
                  <ChevronDown className="dropdown-icon" size={14} />
                </button>
                {showCategoriesDropdown && (
                  <div className="filter-dropdown-menu">
                    <button className="dropdown-item">All Categories</button>
                    <button className="dropdown-item">Action</button>
                    <button className="dropdown-item">Comedy</button>
                    <button className="dropdown-item">Drama</button>
                    <button className="dropdown-item">Horror</button>
                    <button className="dropdown-item">Sci-Fi</button>
                  </div>
                )}
              </div>
              <button 
                className={`mobile-filter-button ${filterButtonActive ? 'active' : ''}`}
                onClick={() => setFilterButtonActive(!filterButtonActive)}
                aria-label="Filter"
              >
                <Funnel className="filter-icon" size={16} />
              </button>
            </div>
          )}
        </div>
        
        {activeTab === 'watchlist' ? (
          <>
            <SectionList
              title="Queue"
              items={queueItems}
              onDelete={handleDelete}
              onMove={handleMove}
            />
            <SectionList
              title="Watchlist"
              items={watchlistItems}
              onDelete={handleDelete}
              onMove={handleMove}
            />
            <button className="fab" onClick={handleAddClick} aria-label="Add item">
              <CopyPlus className="fab-icon" />
            </button>
          </>
        ) : (
          <ExploreTab currentUser={currentUser} onAddItem={handleAddClick} />
        )}
      </main>
      
      {/* Mobile Bottom Navigation */}
      <nav className="bottom-nav">
        <button
          className={`bottom-nav-item ${activeTab === 'watchlist' ? 'active' : ''}`}
          onClick={() => setActiveTab('watchlist')}
        >
          <Tv className="bottom-nav-icon" size={20} />
          <span className="bottom-nav-label">Watchlist</span>
        </button>
        <button
          className={`bottom-nav-item ${activeTab === 'explore' ? 'active' : ''}`}
          onClick={() => setActiveTab('explore')}
        >
          <Search className="bottom-nav-icon" size={20} />
          <span className="bottom-nav-label">Explore</span>
        </button>
        <button
          className="bottom-nav-item"
          onClick={handleEditProfile}
        >
          <div 
            className="bottom-nav-avatar-container"
            style={{ backgroundColor: avatarColor }}
          >
            <img
              ref={(img) => {
                if (img) {
                  avatarImageRef.current = img;
                  if (img.complete && img.naturalWidth > 0) {
                    handleAvatarImageLoad(img);
                  }
                }
              }}
              src={getAvatarUrl(currentUser.avatar_filename)}
              alt={currentUser.name}
              className="bottom-nav-avatar"
              onLoad={(e) => {
                const img = e.target as HTMLImageElement;
                handleAvatarImageLoad(img);
              }}
              onError={() => {
                setAvatarColor('#4A90E2');
              }}
            />
          </div>
          <span className="bottom-nav-label">My Watchbox</span>
        </button>
      </nav>
    </div>
  );
}

