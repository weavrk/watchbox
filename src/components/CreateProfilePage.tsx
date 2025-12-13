import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { getAvatarUrl, getAvailableAvatars, getDefaultStreamingServices, getServiceLogoUrl, clearAvatarCache } from '../services/api';
import { extractDominantColor } from '../utils/colorExtraction';
import type { StreamingService } from '../types';

interface CreateProfilePageProps {
  onBack: () => void;
  onCreate: (name: string, avatarFilename: string, streamingServices: StreamingService[], birthday: string) => void;
}

export function CreateProfilePage({ onBack, onCreate }: CreateProfilePageProps) {
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [selectedServices, setSelectedServices] = useState<StreamingService[]>([]);
  const [availableAvatars, setAvailableAvatars] = useState<string[]>([]);
  const [defaultServices, setDefaultServices] = useState<StreamingService[]>([]);
  const [avatarColors, setAvatarColors] = useState<Record<string, string>>({});
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [year, setYear] = useState('');
  const imageRefs = useRef<Record<string, HTMLImageElement>>({});

  useEffect(() => {
    // Clear avatar cache and colors to force re-extraction from updated SVGs
    clearAvatarCache();
    setAvatarColors({});
    
    // Load avatars on mount - always fetch fresh
    getAvailableAvatars().then(avatars => {
      setAvailableAvatars(avatars);
      // Set first avatar as default
      if (avatars.length > 0 && !selectedAvatar) {
        setSelectedAvatar(avatars[0]);
      }
    });
    
    // Load default streaming services
    getDefaultStreamingServices().then(services => {
      setDefaultServices(services);
    });
  }, []);

  useEffect(() => {
    // Set first avatar as default when avatars load
    if (availableAvatars.length > 0 && !selectedAvatar) {
      setSelectedAvatar(availableAvatars[0]);
    }
  }, [availableAvatars, selectedAvatar]);

  const handleImageLoad = (avatarFilename: string, img: HTMLImageElement) => {
    // Always re-extract color to pick up changes in updated SVGs
    const color = extractDominantColor(img, avatarFilename);
    setAvatarColors(prev => ({ ...prev, [avatarFilename]: color }));
  };

  const handleServiceToggle = (service: StreamingService) => {
    const isSelected = selectedServices.some(s => s.name === service.name);
    
    if (isSelected) {
      setSelectedServices(prev => prev.filter(s => s.name !== service.name));
    } else {
      setSelectedServices(prev => [...prev, service]);
    }
  };

  const formatBirthday = (): string => {
    if (!month && !day && !year) return '';
    
    // Pad month and day with leading zeros if needed
    const paddedMonth = month.padStart(2, '0');
    const paddedDay = day.padStart(2, '0');
    
    return `${paddedMonth}/${paddedDay}/${year}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && selectedAvatar) {
      const birthday = formatBirthday();
      onCreate(name.trim(), selectedAvatar, selectedServices, birthday);
    }
  };

  return (
    <div className="create-profile-page">
      <div className="create-profile-content">
        <div className="create-profile-header">
          <button className="back-button" onClick={onBack} aria-label="Back">
            <ArrowLeft size={24} />
          </button>
          <h2>Create Profile</h2>
        </div>
        <div className="create-profile-scrollable">
          <form id="create-profile-form" onSubmit={handleSubmit} className="create-profile-form-full">
            <div className="form-group">
              <label htmlFor="profile-name">Name</label>
              <input
                id="profile-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter profile name"
                autoFocus
                required
              />
            </div>
            <div className="form-group">
              <label>Choose Avatar</label>
              <div className="avatar-grid">
                {availableAvatars.map((avatarFilename) => (
                  <button
                    key={avatarFilename}
                    type="button"
                    className={`avatar-option ${selectedAvatar === avatarFilename ? 'selected' : ''}`}
                    onClick={() => setSelectedAvatar(avatarFilename)}
                    style={{
                      backgroundColor: avatarColors[avatarFilename] || '#cccccc'
                    }}
                  >
                    <img
                      ref={(img) => {
                        if (img) {
                          imageRefs.current[avatarFilename] = img;
                        }
                      }}
                      src={getAvatarUrl(avatarFilename)}
                      alt={`Avatar ${avatarFilename}`}
                      className="avatar-thumbnail"
                      onLoad={(e) => {
                        const img = e.target as HTMLImageElement;
                        handleImageLoad(avatarFilename, img);
                      }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        console.error(`Failed to load avatar ${avatarFilename} from:`, target.src);
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Streaming Service Subscriptions</label>
              <div className="services-grid">
                {defaultServices.map((service) => {
                  const isSelected = selectedServices.some(s => s.name === service.name);
                  // Use TMDB logo URL if available, otherwise use local
                  const logoUrl = (service as any).logo_url || getServiceLogoUrl(service.logo);
                  return (
                    <button
                      key={service.name}
                      type="button"
                      className={`service-option ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleServiceToggle(service)}
                    >
                      <img
                        src={logoUrl}
                        alt={service.name}
                        className="service-icon-large"
                      />
                      <span className="service-label">{service.name}</span>
                    </button>
                  );
                })}
                
                {/* Add Service button - disabled during creation */}
                <button
                  type="button"
                  className="service-option service-add service-add-disabled"
                  onClick={() => alert('Create your profile first, then you can add custom services by editing your profile.')}
                  title="Add custom services after creating your profile"
                >
                  <div className="service-add-icon">
                    <Plus size={32} />
                  </div>
                  <span className="service-label">Add</span>
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>Birthday</label>
              <div className="birthday-fields">
                <input
                  type="text"
                  value={month}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                    setMonth(val);
                  }}
                  placeholder="MM"
                  className="birthday-input"
                  maxLength={2}
                />
                <span className="birthday-separator">/</span>
                <input
                  type="text"
                  value={day}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                    setDay(val);
                  }}
                  placeholder="DD"
                  className="birthday-input"
                  maxLength={2}
                />
                <span className="birthday-separator">/</span>
                <input
                  type="text"
                  value={year}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setYear(val);
                  }}
                  placeholder="YYYY"
                  className="birthday-input birthday-year"
                  maxLength={4}
                />
              </div>
              <p className="help-text">Enter birthday as MM/DD/YYYY</p>
            </div>
          </form>
        </div>
        <div className="profile-actions-bottom-sheet">
          <button 
            type="submit"
            form="create-profile-form"
            className="ds-button-primary"
            disabled={!name.trim() || !selectedAvatar}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

