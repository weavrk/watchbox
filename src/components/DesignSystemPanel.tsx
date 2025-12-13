import React, { useState } from 'react';
import { useDesignSystem } from '../contexts/DesignSystemContext';
import '../styles/design-system.css';

export function DesignSystemPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const { tokens, updateTokens, applyTokens } = useDesignSystem();
  const [localTokens, setLocalTokens] = useState(tokens);
  const [showDestructiveConfirm, setShowDestructiveConfirm] = useState(false);

  React.useEffect(() => {
    setLocalTokens(tokens);
  }, [tokens]);

  const handleColorChange = (key: string, value: string) => {
    const updated = { ...localTokens, [key]: value } as typeof tokens;
    setLocalTokens(updated);
    updateTokens(updated);
  };

  const handleApply = () => {
    applyTokens();
    setIsOpen(false);
  };

  // Get all primitive color names
  const getPrimitiveNames = (): string[] => {
    return [
      'gray-100', 'gray-200', 'gray-300', 'gray-400', 'gray-500',
      'gray-600', 'gray-700', 'gray-800', 'gray-900',
      'cyan-light', 'cyan-dark',
      'magenta-light', 'magenta-dark',
      'yellow-light', 'yellow-dark'
    ];
  };

  // Get the actual color value for display
  const getColorValue = (primitiveName: string): string => {
    if (primitiveName.startsWith('#')) {
      return primitiveName;
    }
    return (tokens as any)[primitiveName] || '#000000';
  };

  // Get display name for primitive
  const getDisplayName = (name: string): string => {
    return name.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const primitiveNames = getPrimitiveNames();
  const grayScale = ['gray-100', 'gray-200', 'gray-300', 'gray-400', 'gray-500', 'gray-600', 'gray-700', 'gray-800', 'gray-900'];
  const cmykColors = ['cyan-light', 'cyan-dark', 'magenta-light', 'magenta-dark', 'yellow-light', 'yellow-dark'];
  const semanticColors = [
    { key: 'brand-primary', label: 'Brand Primary' },
    { key: 'primary', label: 'Primary' },
    { key: 'secondary', label: 'Secondary' },
    { key: 'tertiary', label: 'Tertiary' },
    { key: 'accent', label: 'Accent' },
    { key: 'accent-2', label: 'Accent 2' },
    { key: 'accent-3', label: 'Accent 3' },
    { key: 'button-primary', label: 'Button Primary' },
    { key: 'background-primary', label: 'Background Primary' },
    { key: 'background-secondary', label: 'Background Secondary' },
    { key: 'background-tertiary', label: 'Background Tertiary' }
  ];

  return (
    <>
      <button
        className="design-system-toggle"
        onClick={() => setIsOpen(true)}
        aria-label="Open Design System"
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="4" cy="4" r="3" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="design-system-overlay" onClick={() => setIsOpen(false)} />
          <div className="design-system-panel">
            <div className="design-system-header">
              <h2 className="page-header">Design System</h2>
              <button
                className="design-system-close"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="design-system-content">
              <div className="design-system-scrollable">
                <section className="design-system-section">
                  <h3 className="section-header">Primitive Colors</h3>
                  
                  <div className="color-grid">
                    {/* Gray Scale */}
                    {grayScale.map((grayName) => (
                      <div key={grayName} className="color-swatch-card">
                        <input
                          type="color"
                          value={(localTokens as any)[grayName]}
                          onChange={(e) => handleColorChange(grayName, e.target.value)}
                          className="color-swatch"
                        />
                        <div className="color-info">
                          <span className="color-name">{getDisplayName(grayName)}</span>
                          <input
                            type="text"
                            value={(localTokens as any)[grayName]}
                            onChange={(e) => handleColorChange(grayName, e.target.value)}
                            className="color-hex"
                          />
                        </div>
                      </div>
                    ))}

                    {/* CMYK Colors */}
                    {cmykColors.map((cmykName) => (
                      <div key={cmykName} className="color-swatch-card">
                        <input
                          type="color"
                          value={(localTokens as any)[cmykName]}
                          onChange={(e) => handleColorChange(cmykName, e.target.value)}
                          className="color-swatch"
                        />
                        <div className="color-info">
                          <span className="color-name">{getDisplayName(cmykName)}</span>
                          <input
                            type="text"
                            value={(localTokens as any)[cmykName]}
                            onChange={(e) => handleColorChange(cmykName, e.target.value)}
                            className="color-hex"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="design-system-section">
                  <h3 className="section-header">Semantic Colors</h3>
                  
                  <div className="semantic-colors-list">
                    {semanticColors.map(({ key, label }) => {
                      const currentValue = (localTokens as any)[key];
                      const displayColor = getColorValue(currentValue);
                      
                      return (
                        <div key={key} className="semantic-color-item">
                          <div className="semantic-color-preview" style={{ backgroundColor: displayColor }}></div>
                          <div className="semantic-color-info">
                            <span className="semantic-color-label">{label}</span>
                            <select
                              value={currentValue}
                              onChange={(e) => handleColorChange(key, e.target.value)}
                              className="semantic-color-select"
                            >
                              {primitiveNames.map((primitiveName) => (
                                <option key={primitiveName} value={primitiveName}>
                                  {getDisplayName(primitiveName)}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="design-system-section">
                  <h3 className="section-header">Button Components</h3>
                  
                  <div className="button-components-demo">
                    <div className="button-demo-item">
                      <h4 className="button-demo-label">Primary Button</h4>
                      <button className="ds-button-primary">
                        Save
                      </button>
                      <p className="button-demo-description">Full-width button with neumorphic styling. Used for primary actions like saving profiles.</p>
                    </div>

                    <div className="button-demo-item">
                      <h4 className="button-demo-label">Destructive Button</h4>
                      {!showDestructiveConfirm ? (
                        <button 
                          className="ds-button-destructive"
                          onClick={() => setShowDestructiveConfirm(true)}
                        >
                          Delete Profile
                        </button>
                      ) : (
                        <div className="ds-destructive-confirm">
                          <span className="ds-destructive-confirm-text">Are you sure?</span>
                          <div className="ds-destructive-confirm-buttons">
                            <button 
                              className="ds-button-confirm-destructive"
                              onClick={() => {
                                setShowDestructiveConfirm(false);
                              }}
                            >
                              Yes
                            </button>
                            <button 
                              className="ds-button-cancel-destructive"
                              onClick={() => setShowDestructiveConfirm(false)}
                            >
                              No
                            </button>
                          </div>
                        </div>
                      )}
                      <p className="button-demo-description">Button with built-in "Are you sure?" confirmation. Used for destructive actions like deleting profiles.</p>
                    </div>

                    <div className="button-demo-item">
                      <h4 className="button-demo-label">Secondary Button</h4>
                      <button className="ds-button-secondary">
                        Cancel
                      </button>
                      <p className="button-demo-description">Customizable button with same attributes as primary. Colors can be customized in the future.</p>
                    </div>
                  </div>
                </section>
              </div>
              <div className="design-system-actions-bottom-sheet">
                <button
                  className="create-button-full"
                  onClick={handleApply}
                >
                  Apply Changes
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
