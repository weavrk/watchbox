import { useState, useEffect, useRef } from 'react';
import type { UserSummary } from '../types';
import { listUsers, createUser, saveUser, deleteUser, getAvatarUrl, getUser, clearAvatarCache } from '../services/api';
import { useUser } from '../contexts/UserContext';
import { CreateProfilePage } from './CreateProfilePage';
import { EditProfileModal } from './EditProfileModal';
import { extractDominantColor } from '../utils/colorExtraction';
import { Logo } from './Logo';

export function ProfileSelectionScreen() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserSummary | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [avatarColors, setAvatarColors] = useState<Record<string, string>>({});
  const imageRefs = useRef<Record<string, HTMLImageElement>>({});
  const gridRef = useRef<HTMLDivElement>(null);
  const actionsGridRef = useRef<HTMLDivElement>(null);
  const { loadUser } = useUser();

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    const updateGridLayout = () => {
      if (gridRef.current) {
        const userCount = users.length;
        const width = window.innerWidth;
        const isMobile = width < 480;
        const isMedium = width >= 960;
        const isLarge = width >= 1280;
        
        // Determine avatar size
        let avatarWidth = 120; // Default mobile
        if (isMobile) {
          // Mobile: if 3 or more, use 96px
          if (userCount >= 3) {
            avatarWidth = 96;
          }
        } else {
          // 480px+: use 160px (no increase at 1280px)
          avatarWidth = 160;
        }
        
        // Set avatar size
        gridRef.current.style.setProperty('--avatar-size', `${avatarWidth}px`);
        // Set action button size (50% of avatar size)
        gridRef.current.style.setProperty('--action-avatar-size', `${avatarWidth * 0.5}px`);
        
        // Smart layout rules
        let gridTemplateColumns = '';
        let gridTemplateRows = '';
        
        if (userCount === 1) {
          // 1 column
          gridTemplateColumns = '1fr';
        } else if (userCount === 2) {
          // 2 columns
          gridTemplateColumns = 'repeat(2, 1fr)';
        } else if (userCount === 3) {
          // 3 columns
          gridTemplateColumns = 'repeat(3, 1fr)';
        } else if (userCount === 4) {
          if (isMobile) {
            // Mobile: 3 columns (with 1 wrapping)
            gridTemplateColumns = 'repeat(3, 1fr)';
            gridTemplateRows = 'repeat(2, auto)';
          } else if (isMedium) {
            // 960px+: 4 columns (1 row - cleaner layout)
            gridTemplateColumns = 'repeat(4, 1fr)';
            gridTemplateRows = ''; // Clear rows for single row layout
          } else {
            // 480px-959px: 3 columns (2 rows - cleaner layout)
            gridTemplateColumns = 'repeat(3, 1fr)';
            gridTemplateRows = 'repeat(2, auto)';
          }
        } else if (userCount === 5) {
          if (isMobile) {
            // Mobile: 3 columns (2 rows - cleaner layout)
            gridTemplateColumns = 'repeat(3, 1fr)';
            gridTemplateRows = 'repeat(2, auto)';
          } else if (isLarge) {
            // 1280px+: 5 columns (1 row - cleaner layout)
            gridTemplateColumns = 'repeat(5, 1fr)';
            gridTemplateRows = ''; // Clear rows for single row layout
          } else if (isMedium) {
            // 960px-1279px: 4 columns (2 rows - cleaner layout)
            gridTemplateColumns = 'repeat(4, 1fr)';
            gridTemplateRows = 'repeat(2, auto)';
          } else {
            // 480px-959px: 3 columns (2 rows - cleaner layout)
            gridTemplateColumns = 'repeat(3, 1fr)';
            gridTemplateRows = 'repeat(2, auto)';
          }
        } else if (userCount === 6) {
          if (isMobile) {
            // Mobile: 3 columns
            gridTemplateColumns = 'repeat(3, 1fr)';
            gridTemplateRows = 'repeat(2, auto)';
          } else if (isLarge) {
            // 1280px+: 5 columns (2 rows, last one wraps)
            gridTemplateColumns = 'repeat(5, 1fr)';
            gridTemplateRows = 'repeat(2, auto)';
          } else if (isMedium) {
            // 960px-1279px: 4 columns
            gridTemplateColumns = 'repeat(4, 1fr)';
            gridTemplateRows = 'repeat(2, auto)';
          } else {
            // 480px-959px: 3 columns
            gridTemplateColumns = 'repeat(3, 1fr)';
            gridTemplateRows = 'repeat(2, auto)';
          }
        } else if (userCount >= 7) {
          if (isMobile) {
            // Mobile: 3 columns
            const rows = Math.ceil(userCount / 3);
            gridTemplateColumns = 'repeat(3, 1fr)';
            gridTemplateRows = `repeat(${rows}, auto)`;
          } else if (isLarge) {
            // 1280px+: Use 5 columns (or smart layout if more than 5 would be better)
            // For 7-10: use 5 columns, for 11+: calculate optimal
            const cols = userCount <= 10 ? 5 : Math.min(5, Math.ceil(Math.sqrt(userCount)));
            const rows = Math.ceil(userCount / cols);
            gridTemplateColumns = `repeat(${cols}, 1fr)`;
            gridTemplateRows = `repeat(${rows}, auto)`;
          } else if (isMedium) {
            // 960px-1279px: Use 4 columns (or smart layout if more than 4 would be better)
            // For 7-8: use 4 columns, for 9+: calculate optimal but cap at 4
            const cols = userCount <= 8 ? 4 : Math.min(4, Math.ceil(Math.sqrt(userCount)));
            const rows = Math.ceil(userCount / cols);
            gridTemplateColumns = `repeat(${cols}, 1fr)`;
            gridTemplateRows = `repeat(${rows}, auto)`;
          } else {
            // 480px-959px: 3 columns
            const rows = Math.ceil(userCount / 3);
            gridTemplateColumns = 'repeat(3, 1fr)';
            gridTemplateRows = `repeat(${rows}, auto)`;
          }
        }
        
        // Set layout class for CSS targeting
        gridRef.current.className = `profiles-grid layout-${userCount} ${isMobile ? 'mobile' : 'desktop'}`;
        
        // Apply grid template AFTER setting className (use setProperty with important to override CSS classes)
        if (gridTemplateColumns) {
          gridRef.current.style.setProperty('grid-template-columns', gridTemplateColumns, 'important');
        }
        if (gridTemplateRows) {
          gridRef.current.style.setProperty('grid-template-rows', gridTemplateRows, 'important');
        } else {
          // Clear rows if not set (for single-row layouts)
          gridRef.current.style.setProperty('grid-template-rows', 'none', 'important');
        }
      }
      
      // Also update the profiles-actions container with the same avatar size
      if (actionsGridRef.current) {
        const width = window.innerWidth;
        const isMobile = width < 480;
        let avatarWidth = 120; // Default mobile
        
        if (isMobile) {
          // Mobile: if 3 or more users, use 96px
          if (users.length >= 3) {
            avatarWidth = 96;
          }
        } else {
          // 480px+: use 160px (no increase at 1280px)
          avatarWidth = 160;
        }
        
        actionsGridRef.current.style.setProperty('--avatar-size', `${avatarWidth}px`);
        // Set action button size (50% of avatar size)
        actionsGridRef.current.style.setProperty('--action-avatar-size', `${avatarWidth * 0.5}px`);
      }
    };

    updateGridLayout();
    
    // Update layout on window resize
    const handleResize = () => {
      updateGridLayout();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [users, editMode, showCreateModal]);

  const loadUsers = async () => {
    try {
      // Clear avatar cache and colors to force re-extraction from updated SVGs
      clearAvatarCache();
      setAvatarColors({});
      
      const userList = await listUsers();
      setUsers(userList);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = async (userId: string) => {
    try {
      await loadUser(userId);
    } catch (error) {
      console.error('Failed to load user:', error);
      alert('Failed to load profile. Please try again.');
    }
  };

  const handleCreateProfile = async (name: string, avatarFilename: string, streamingServices: import('../types').StreamingService[], birthday: string) => {
    try {
      await createUser({ 
        name, 
        avatar_filename: avatarFilename,
        streaming_services: streamingServices,
        birthday: birthday || undefined
      });
      setShowCreateModal(false);
      setEditMode(false); // Exit edit mode and return to normal landing screen
      await loadUsers(); // Refresh list
    } catch (error) {
      console.error('Failed to create user:', error);
      alert('Failed to create profile. Please try again.');
    }
  };

  const handleEditProfile = async (userId: string, name: string, avatarFilename: string, streamingServices: import('../types').StreamingService[], birthday: string) => {
    try {
      // Get current user data to preserve items
      const currentUser = await getUser(userId);
      await saveUser({
        user_id: userId,
        name,
        avatar_filename: avatarFilename,
        items: currentUser.items,
        streaming_services: streamingServices,
        birthday: birthday || undefined
      });
      setEditingUser(null);
      setEditMode(false); // Exit edit mode
      await loadUsers(); // Refresh list
    } catch (error) {
      console.error('Failed to update user:', error);
      alert('Failed to update profile. Please try again.');
    }
  };

  const handleDeleteProfile = async (userId: string) => {
    try {
      await deleteUser(userId);
      setEditingUser(null);
      setEditMode(false); // Exit edit mode
      await loadUsers(); // Refresh list
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert('Failed to delete profile. Please try again.');
    }
  };

  const handleProfileClick = async (user: UserSummary, e: React.MouseEvent) => {
    if (editMode) {
      e.stopPropagation();
      // Load full user data to get streaming_services
      try {
        const fullUser = await getUser(user.user_id);
        setEditingUser({
          user_id: fullUser.user_id,
          name: fullUser.name,
          avatar_filename: fullUser.avatar_filename,
          streaming_services: fullUser.streaming_services,
          birthday: fullUser.birthday
        });
      } catch (error) {
        console.error('Failed to load user data:', error);
        // Fallback to summary if full load fails
        setEditingUser(user);
      }
    } else {
      handleSelectUser(user.user_id);
    }
  };

  const handleImageLoad = (userId: string, img: HTMLImageElement) => {
    // Always re-extract color to pick up changes in updated SVGs
    const user = users.find(u => u.user_id === userId);
    const avatarFilename = user?.avatar_filename;
    const color = extractDominantColor(img, avatarFilename);
    setAvatarColors(prev => ({ ...prev, [userId]: color }));
  };

  if (loading) {
    return (
      <div className="profile-selection-screen">
        <div className="loading">Loading profiles...</div>
      </div>
    );
  }

  if (showCreateModal) {
    return (
      <CreateProfilePage
        onBack={() => setShowCreateModal(false)}
        onCreate={handleCreateProfile}
      />
    );
  }

  if (editingUser) {
    return (
      <EditProfileModal
        user={editingUser}
        onClose={() => {
          setEditingUser(null);
          setEditMode(false);
        }}
        onSave={handleEditProfile}
        onDelete={handleDeleteProfile}
      />
    );
  }

  return (
    <div className="profile-selection-screen gradient-background">
      {editMode && (
        <button
          className="done-button"
          onClick={() => setEditMode(false)}
        >
          Done
        </button>
      )}
      <div className="profile-container">
        <div className="brand-header">
          <Logo className="brand-logo-large" />
          <h1 className="app-title-large">WatchBox</h1>
        </div>
        <div className={`profiles-wrapper ${editMode ? 'edit-mode' : ''}`}>
          <div className="profiles-grid" ref={gridRef}>
            {users.map((user, index) => (
              <button
                key={user.user_id}
                className="profile-card"
                onClick={(e) => handleProfileClick(user, e)}
                style={
                  users.length === 5 && index === 3
                    ? { gridColumn: '1' }
                    : users.length === 5 && index === 4
                    ? { gridColumn: '2' }
                    : undefined
                }
              >
                <div 
                  className="profile-avatar"
                  style={{
                    backgroundColor: avatarColors[user.user_id] || '#4A90E2',
                    outlineColor: editMode ? undefined : (avatarColors[user.user_id] || '#4A90E2')
                  }}
                >
                  <img
                    ref={(img) => {
                      if (img) {
                        imageRefs.current[user.user_id] = img;
                      }
                    }}
                    src={getAvatarUrl(user.avatar_filename)}
                    alt={user.name}
                    className="profile-image"
                    onLoad={(e) => {
                      const img = e.target as HTMLImageElement;
                      handleImageLoad(user.user_id, img);
                    }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      console.error(`Failed to load avatar ${user.avatar_filename} from:`, target.src);
                    }}
                  />
                  {editMode && (
                    <div className="edit-overlay">
                      <span className="edit-icon">✎</span>
                    </div>
                  )}
                </div>
                <span className="profile-name">{user.name}</span>
              </button>
            ))}
          </div>
          <div className="profiles-actions" ref={actionsGridRef}>
            <button
              className="profile-card create-profile"
              onClick={() => setShowCreateModal(true)}
            >
              <div className="profile-avatar add-avatar">
                <span className="plus-icon">+</span>
              </div>
              <span className="profile-name">Add</span>
            </button>
            {!editMode && (
              <button
                className="profile-card edit-profiles"
                onClick={() => setEditMode(true)}
              >
                <div className="profile-avatar add-avatar">
                  <span className="edit-icon-large">✎</span>
                </div>
                <span className="profile-name">Edit</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

