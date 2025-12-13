import { useState, useEffect } from 'react';
import { X, Loader } from 'lucide-react';
import { searchTMDBProviders, type TMDBProvider } from '../services/api';
import type { StreamingService } from '../types';

interface AddServiceModalProps {
  onClose: () => void;
  onAdd: (service: StreamingService) => void;
}

export function AddServiceModal({ onClose, onAdd }: AddServiceModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TMDBProvider[]>([]);
  const [imageBaseUrl, setImageBaseUrl] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProviders, setSelectedProviders] = useState<TMDBProvider[]>([]);
  const [error, setError] = useState('');

  // Debounced search effect
  useEffect(() => {
    const searchProviders = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        setError('');
        return;
      }

      setIsSearching(true);
      setError('');
      
      try {
        const result = await searchTMDBProviders(searchQuery);
        console.log('TMDB search result:', result);
        
        if (result.providers && result.providers.length > 0) {
          setSearchResults(result.providers);
          setImageBaseUrl(result.imageBaseUrl);
          setError('');
        } else {
          setSearchResults([]);
          setError('No streaming services found. Try a different search term.');
        }
      } catch (err: any) {
        setSearchResults([]);
        const errorMsg = err?.message || 'Failed to search TMDB. Please try again.';
        setError(errorMsg);
        console.error('TMDB search error:', err);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(searchProviders, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectProvider = (provider: TMDBProvider) => {
    // Add to selected providers (create chips)
    if (!selectedProviders.some(p => p.provider_id === provider.provider_id)) {
      setSelectedProviders(prev => [...prev, provider]);
    }
    
    // Clear search to allow adding another service
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleRemoveChip = (providerId: number) => {
    setSelectedProviders(prev => prev.filter(p => p.provider_id !== providerId));
  };

  const handleAddAll = () => {
    // Convert all selected providers to StreamingService objects and add them
    selectedProviders.forEach(provider => {
      const newService: StreamingService = {
        name: provider.provider_name,
        logo: `${provider.provider_name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.webp`,
        tmdb_provider_id: provider.provider_id
      };

      // Store the full logo URL so we can display it immediately
      (newService as any).logo_url = `${imageBaseUrl}${provider.logo_path}`;

      onAdd(newService);
    });
    
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content add-service-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Streaming Service</h2>
          <button className="close-button" onClick={onClose} aria-label="Close">
            <X size={24} />
          </button>
        </div>

        <div className="add-service-body">
          <div className="search-input-wrapper">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for streaming service (e.g., HBO, Paramount+)"
              className="search-input"
              autoFocus
            />
            {isSearching && <Loader size={20} className="search-loader spinner" />}
          </div>

          {/* Selected service chips */}
          {selectedProviders.length > 0 && (
            <div className="chips-container">
              {selectedProviders.map((provider) => (
                <div key={provider.provider_id} className="selected-service-chip">
                  <img
                    src={`${imageBaseUrl}${provider.logo_path}`}
                    alt={provider.provider_name}
                    className="chip-logo"
                  />
                  <span className="chip-name">{provider.provider_name}</span>
                  <button
                    type="button"
                    className="chip-remove"
                    onClick={() => handleRemoveChip(provider.provider_id)}
                    aria-label="Remove selection"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="search-results">
              <h3>Select services to add:</h3>
              <div className="results-grid">
                {searchResults.map((provider) => (
                  <button
                    key={provider.provider_id}
                    className="result-option"
                    onClick={() => handleSelectProvider(provider)}
                  >
                    <img
                      src={`${imageBaseUrl}${provider.logo_path}`}
                      alt={provider.provider_name}
                      className="result-logo"
                    />
                    <span className="result-name">{provider.provider_name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Add button at bottom */}
        <div className="modal-footer">
          <button
            type="button"
            className="btn-add-full"
            onClick={handleAddAll}
            disabled={selectedProviders.length === 0}
          >
            Add {selectedProviders.length > 0 && `(${selectedProviders.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}

