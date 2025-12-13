import { useEffect, useState } from 'react';
import { CopyPlus } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { Header } from './Header';
import { SectionList } from './SectionList';
import { ExploreTab } from './ExploreTab';
import { EditProfileModal } from './EditProfileModal';
import { saveUser, getUser } from '../services/api';
import type { WatchBoxItem, UserSummary } from '../types';

export function MainWatchBoxScreen() {
  const { currentUser, logout, loadUser } = useUser();
  const [items, setItems] = useState<WatchBoxItem[]>([]);
  const [activeTab, setActiveTab] = useState<'watchlist' | 'explore'>('watchlist');
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editingUser, setEditingUser] = useState<UserSummary | null>(null);

  useEffect(() => {
    if (currentUser) {
      setItems(currentUser.items);
    }
  }, [currentUser]);

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
      <main className="content">
        <div className="tabs-container">
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
    </div>
  );
}

