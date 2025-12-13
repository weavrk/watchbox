import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, X, Plus } from 'lucide-react';
import { getAvatarUrl, getAvailableAvatars, getDefaultStreamingServices, getServiceLogoUrl, clearAvatarCache } from '../services/api';
import type { UserSummary, StreamingService } from '../types';
import { extractDominantColor } from '../utils/colorExtraction';
import { AddServiceModal } from './AddServiceModal';

interface EditProfileModalProps {
  user: UserSummary;
  onClose: () => void;
  onSave: (userId: string, name: string, avatarFilename: string, streamingServices: StreamingService[], birthday: string) => void;
  onDelete: (userId: string) => void;
}

export function EditProfileModal({ user, onClose, onSave, onDelete }: EditProfileModalProps) {
  const [name, setName] = useState(user.name);
  const [selectedAvatar, setSelectedAvatar] = useState<string>(user.avatar_filename);
  const [selectedServices, setSelectedServices] = useState<StreamingService[]>(user.streaming_services || []);
  const [availableAvatars, setAvailableAvatars] = useState<string[]>([]);
  const [defaultServices, setDefaultServices] = useState<StreamingService[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState<string | null>(null);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
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
    });
    
    // Load default streaming services
    getDefaultStreamingServices().then(services => {
      setDefaultServices(services);
    });
  }, []);

  useEffect(() => {
    setName(user.name);
    setSelectedAvatar(user.avatar_filename);
    setSelectedServices(user.streaming_services || []);
    
    // Parse birthday if it exists
    if (user.birthday) {
      const parts = user.birthday.split('/');
      if (parts.length === 3) {
        setMonth(parts[0]);
        setDay(parts[1]);
        setYear(parts[2]);
      }
    } else {
      setMonth('');
      setDay('');
      setYear('');
    }
  }, [user]);

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

  const handleRemoveService = (serviceName: string) => {
    setShowRemoveConfirm(serviceName);
  };

  const confirmRemoveService = () => {
    if (showRemoveConfirm) {
      setSelectedServices(prev => prev.filter(s => s.name !== showRemoveConfirm));
      setShowRemoveConfirm(null);
    }
  };

  const cancelRemoveService = () => {
    setShowRemoveConfirm(null);
  };

  const handleAddServiceClick = () => {
    setShowAddServiceModal(true);
  };

  const handleServiceAdded = (service: StreamingService) => {
    setSelectedServices(prev => [...prev, service]);
  };

  const formatBirthday = (): string => {
    if (!month && !day && !year) return '';
    
    // Pad month and day with leading zeros if needed
    const paddedMonth = month.padStart(2, '0');
    const paddedDay = day.padStart(2, '0');
    
    return `${paddedMonth}/${paddedDay}/${year}`;
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    if (name.trim() && selectedAvatar) {
      const birthday = formatBirthday();
      onSave(user.user_id, name.trim(), selectedAvatar, selectedServices, birthday);
    }
  };

  const handleDelete = () => {
    if (showDeleteConfirm) {
      onDelete(user.user_id);
    } else {
      setShowDeleteConfirm(true);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  return (
    <div className="create-profile-page">
      <div className="create-profile-content">
        <div className="create-profile-header">
          <button className="back-button" onClick={onClose} aria-label="Back">
            <ArrowLeft size={24} />
          </button>
          <h2>Edit Profile</h2>
        </div>
        <div className="create-profile-scrollable">
          <form id="edit-profile-form" onSubmit={handleSubmit} className="create-profile-form-full">
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
                {/* Show user's selected services */}
                {selectedServices.map((service) => {
                  const isRemoving = showRemoveConfirm === service.name;
                  return (
                    <div key={service.name} className="service-option selected">
                      <img
                        src={getServiceLogoUrl(service.logo)}
                        alt={service.name}
                        className="service-icon-large"
                      />
                      <button
                        type="button"
                        className="service-remove-button"
                        onClick={() => handleRemoveService(service.name)}
                        aria-label={`Remove ${service.name}`}
                      >
                        <X size={12} />
                      </button>
                      <span className="service-label">{service.name}</span>
                      
                      {isRemoving && (
                        <div className="remove-confirm-overlay">
                          <p>Remove?</p>
                          <div className="remove-confirm-buttons">
                            <button 
                              type="button"
                              onClick={confirmRemoveService}
                              className="btn-confirm-remove"
                            >
                              Yes
                            </button>
                            <button 
                              type="button"
                              onClick={cancelRemoveService}
                              className="btn-cancel-remove"
                            >
                              No
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {/* Show default services that aren't selected */}
                {defaultServices
                  .filter(defService => !selectedServices.some(s => s.name === defService.name))
                  .map((service) => (
                    <button
                      key={service.name}
                      type="button"
                      className="service-option"
                      onClick={() => handleServiceToggle(service)}
                    >
                      <img
                        src={getServiceLogoUrl(service.logo)}
                        alt={service.name}
                        className="service-icon-large"
                      />
                      <span className="service-label">{service.name}</span>
                    </button>
                  ))}
                
                {/* Add Service button */}
                <button
                  type="button"
                  className="service-option service-add"
                  onClick={handleAddServiceClick}
                >
                  <div className="service-add-icon">
                    <Plus size={32} />
                  </div>
                  <span className="service-label">Add</span>
                </button>
              </div>
            </div>
            
            {showAddServiceModal && (
              <AddServiceModal
                onClose={() => setShowAddServiceModal(false)}
                onAdd={handleServiceAdded}
              />
            )}
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
            form="edit-profile-form"
            className="ds-button-primary"
            disabled={!name.trim() || !selectedAvatar}
          >
            Save
          </button>
          {!showDeleteConfirm ? (
            <button 
              type="button" 
              onClick={handleDelete} 
              className="ds-button-destructive"
            >
              Delete Profile
            </button>
          ) : (
            <div className="ds-destructive-confirm">
              <span className="ds-destructive-confirm-text">Are you sure?</span>
              <div className="ds-destructive-confirm-buttons">
                <button 
                  type="button" 
                  onClick={handleDelete} 
                  className="ds-button-confirm-destructive"
                >
                  Yes
                </button>
                <button 
                  type="button" 
                  onClick={handleCancelDelete} 
                  className="ds-button-cancel-destructive"
                >
                  No
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

