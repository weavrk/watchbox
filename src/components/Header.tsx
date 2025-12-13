import { useState, useRef, useEffect } from 'react';
import { getAvatarUrl } from '../services/api';
import { extractDominantColor } from '../utils/colorExtraction';
import { Logo } from './Logo';

interface HeaderProps {
  avatarFilename: string;
  userName: string;
  onSwitchAccount: () => void;
  onEditProfile: () => void;
}

export function Header({ avatarFilename, userName, onSwitchAccount, onEditProfile }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarColor, setAvatarColor] = useState<string>('#4A90E2');
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Reset color when avatar changes to force re-extraction
  useEffect(() => {
    setAvatarColor('#4A90E2'); // Reset to default
    // If image is already loaded, extract color immediately
    if (imageRef.current && imageRef.current.complete) {
      const color = extractDominantColor(imageRef.current, avatarFilename);
      setAvatarColor(color);
    }
  }, [avatarFilename]);

  const handleImageLoad = (img: HTMLImageElement) => {
    // Ensure image is fully loaded before extracting
    if (img.complete && img.naturalWidth > 0) {
      const color = extractDominantColor(img, avatarFilename);
      setAvatarColor(color);
    }
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <Logo className="brand-logo-header" />
        <h1 className="app-title">WatchBox</h1>
      </div>
      <div className="header-right">
        <span className="header-user-name">{userName}</span>
        <button
          className="avatar-button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="User menu"
          style={{
            backgroundColor: avatarColor
          }}
        >
          <img
            ref={(img) => {
              if (img) {
                imageRef.current = img;
                // If image is already loaded (cached), extract color immediately
                if (img.complete && img.naturalWidth > 0) {
                  handleImageLoad(img);
                }
              }
            }}
            src={getAvatarUrl(avatarFilename)}
            alt="User avatar"
            className="avatar-image"
            onLoad={(e) => {
              const img = e.target as HTMLImageElement;
              handleImageLoad(img);
            }}
            onError={() => {
              // Keep default color on error
              setAvatarColor('#4A90E2');
            }}
          />
        </button>
        {menuOpen && (
          <>
            <div className="menu-overlay" onClick={() => setMenuOpen(false)} />
            <div className="user-dropdown-menu">
              <button onClick={onEditProfile} className="menu-item">
                Edit Profile
              </button>
              <button onClick={onSwitchAccount} className="menu-item">
                Switch account
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}

