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
  const [selectedProvider, setSelectedProvider] = useState<TMDBProvider | null>(null);
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
    setSelectedProvider(provider);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleRemoveSelection = () => {
    setSelectedProvider(null);
  };

  const handleAdd = () => {
    if (!selectedProvider) return;

    // Create StreamingService object with temporary logo path
    // The actual download will happen when profile is saved
    const newService: StreamingService = {
      name: selectedProvider.provider_name,
      logo: `${selectedProvider.provider_name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.webp`,
      tmdb_provider_id: selectedProvider.provider_id
    };

    // Store the full logo URL for later download
    (newService as any).logo_url = `${imageBaseUrl}${selectedProvider.logo_path}`;

    onAdd(newService);
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
              disabled={selectedProvider !== null}
            />
            {isSearching && <Loader size={20} className="search-loader spinner" />}
          </div>

          {/* Selected service chip */}
          {selectedProvider && (
            <div className="selected-service-chip">
              <img
                src={`${imageBaseUrl}${selectedProvider.logo_path}`}
                alt={selectedProvider.provider_name}
                className="chip-logo"
              />
              <span className="chip-name">{selectedProvider.provider_name}</span>
              <button
                type="button"
                className="chip-remove"
                onClick={handleRemoveSelection}
                aria-label="Remove selection"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {/* Search results */}
          {searchResults.length > 0 && !selectedProvider && (
            <div className="search-results">
              <h3>Select a service:</h3>
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
            className="ds-button-primary"
            onClick={handleAdd}
            disabled={!selectedProvider}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

