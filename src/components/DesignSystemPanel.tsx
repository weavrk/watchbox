import React, { useState } from 'react';
import { useDesignSystem } from '../contexts/DesignSystemContext';
import '../styles/design-system.css';

export function DesignSystemPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const { tokens, updateTokens, applyTokens, exportTokens } = useDesignSystem();
  const [localTokens, setLocalTokens] = useState(tokens);
  const [showDestructiveConfirm, setShowDestructiveConfirm] = useState(false);
  const [showExportMessage, setShowExportMessage] = useState(false);
  const [copiedName, setCopiedName] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  
  // Semantic colors order - load from localStorage or use default
  const [semanticColorsOrder, setSemanticColorsOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('semanticColorsOrder');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const handleCopyToClipboard = async (name: string) => {
    try {
      await navigator.clipboard.writeText(name);
      setCopiedName(name);
      setTimeout(() => setCopiedName(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  React.useEffect(() => {
    setLocalTokens(tokens);
  }, [tokens]);

  const handleColorChange = (key: string, value: string) => {
    const updated = { ...localTokens, [key]: value } as typeof tokens;
    setLocalTokens(updated);
    updateTokens(updated);
  };

  const handleApply = () => {
    // Save semantic colors order
    if (semanticColorsOrder) {
      localStorage.setItem('semanticColorsOrder', JSON.stringify(semanticColorsOrder));
    }
    applyTokens();
    setShowExportMessage(true);
    // Auto-hide message after 5 seconds
    setTimeout(() => setShowExportMessage(false), 5000);
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

  // Use exact code names (no formatting)
  const getDisplayName = (name: string): string => {
    return name;
  };


  const primitiveNames = getPrimitiveNames();
  const grayScale = ['gray-100', 'gray-200', 'gray-300', 'gray-400', 'gray-500', 'gray-600', 'gray-700', 'gray-800', 'gray-900'];
  const cmykColors = ['cyan-light', 'cyan-dark', 'magenta-light', 'magenta-dark', 'yellow-light', 'yellow-dark'];
  
  // Default semantic colors order
  const defaultSemanticColors = [
    'brand-primary',
    'primary',
    'secondary',
    'tertiary',
    'accent',
    'accent-2',
    'accent-3',
    'button-primary',
    'background-primary',
    'background-secondary',
    'background-tertiary'
  ];
  
  // Use saved order or default
  const orderedSemanticColors = semanticColorsOrder || defaultSemanticColors;
  
  // Filter to only include keys that exist in tokens
  const semanticColors = orderedSemanticColors
    .filter(key => key in localTokens)
    .map(key => ({ key, label: key }));
  
  // Add any new keys that aren't in the order
  defaultSemanticColors.forEach(key => {
    if (key in localTokens && !orderedSemanticColors.includes(key)) {
      semanticColors.push({ key, label: key });
    }
  });

  const handleStartEdit = (key: string) => {
    setEditingName(key);
    setEditingValue(key);
  };

  const handleFinishEdit = (oldKey: string) => {
    if (editingValue && editingValue !== oldKey && editingValue.trim() !== '') {
      const newKey = editingValue.trim();
      // Check if new key already exists
      if (newKey in localTokens && newKey !== oldKey) {
        alert(`Color name "${newKey}" already exists`);
        setEditingName(null);
        return;
      }
      
      // Rename the key in tokens
      const updated = { ...localTokens };
      const value = updated[oldKey as keyof typeof updated];
      delete updated[oldKey as keyof typeof updated];
      (updated as any)[newKey] = value;
      
      // Update order array
      const newOrder = orderedSemanticColors.map(k => k === oldKey ? newKey : k);
      setSemanticColorsOrder(newOrder);
      
      setLocalTokens(updated);
      updateTokens(updated);
    }
    setEditingName(null);
    setEditingValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, oldKey: string) => {
    if (e.key === 'Enter') {
      handleFinishEdit(oldKey);
    } else if (e.key === 'Escape') {
      setEditingName(null);
      setEditingValue('');
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedIndex === null || draggedIndex === index) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newOrder = [...orderedSemanticColors];
    const [removed] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(index, 0, removed);
    
    setSemanticColorsOrder(newOrder);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleAddNew = () => {
    // Generate a unique key
    let newKey = 'untitled';
    let counter = 1;
    while (newKey in localTokens || orderedSemanticColors.includes(newKey)) {
      newKey = `untitled-${counter}`;
      counter++;
    }
    
    // Add to tokens with default value 'primary' (which maps to gray-900/white)
    const updated = { ...localTokens, [newKey]: 'primary' } as typeof tokens;
    setLocalTokens(updated);
    updateTokens(updated);
    
    // Add to order
    const newOrder = [...orderedSemanticColors, newKey];
    setSemanticColorsOrder(newOrder);
    
    // Start editing the name immediately
    setEditingName(newKey);
    setEditingValue(newKey);
  };

  const handleAddNewPrimitive = () => {
    // Generate a unique key
    let newKey = 'untitled';
    let counter = 1;
    while (newKey in localTokens) {
      newKey = `untitled-${counter}`;
      counter++;
    }
    
    // Add to tokens with default hex color (gray-400 as default)
    const updated = { ...localTokens, [newKey]: '#6B6B6B' } as typeof tokens;
    setLocalTokens(updated);
    updateTokens(updated);
    
    // Start editing the name immediately
    setEditingName(newKey);
    setEditingValue(newKey);
  };

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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                          <span className="color-name">{getDisplayName(grayName)}</span>
                          <button
                            onClick={() => handleCopyToClipboard(grayName)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: copiedName === grayName ? 'var(--color-accent)' : 'var(--color-secondary)',
                              cursor: 'pointer',
                              padding: '2px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'color 0.2s'
                            }}
                            title="Copy to clipboard"
                          >
                            {copiedName === grayName ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M20 6L9 17l-5-5"/>
                              </svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                              </svg>
                            )}
                          </button>
                        </div>
                        <input
                          type="color"
                          value={(localTokens as any)[grayName]}
                          onChange={(e) => handleColorChange(grayName, e.target.value)}
                          className="color-swatch"
                        />
                        <div className="color-info">
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                          <span className="color-name">{getDisplayName(cmykName)}</span>
                          <button
                            onClick={() => handleCopyToClipboard(cmykName)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: copiedName === cmykName ? 'var(--color-accent)' : 'var(--color-secondary)',
                              cursor: 'pointer',
                              padding: '2px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'color 0.2s'
                            }}
                            title="Copy to clipboard"
                          >
                            {copiedName === cmykName ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M20 6L9 17l-5-5"/>
                              </svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                              </svg>
                            )}
                          </button>
                        </div>
                        <input
                          type="color"
                          value={(localTokens as any)[cmykName]}
                          onChange={(e) => handleColorChange(cmykName, e.target.value)}
                          className="color-swatch"
                        />
                        <div className="color-info">
                          <input
                            type="text"
                            value={(localTokens as any)[cmykName]}
                            onChange={(e) => handleColorChange(cmykName, e.target.value)}
                            className="color-hex"
                          />
                        </div>
                      </div>
                    ))}
                    {/* Add New Primitive Color */}
                    <div
                      className="color-swatch-card"
                      onClick={handleAddNewPrimitive}
                      style={{
                        cursor: 'pointer',
                        border: '2px solid var(--color-secondary)',
                        background: 'transparent',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        minHeight: '120px'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-accent)';
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-secondary)';
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--color-secondary)' }}>
                        <path d="M12 5v14M5 12h14"/>
                      </svg>
                      <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.875rem', color: 'var(--color-secondary)' }}>Add</span>
                    </div>
                  </div>
                </section>

                <section className="design-system-section">
                  <h3 className="section-header">Semantic Colors</h3>
                  
                  <div className="semantic-colors-list">
                    {semanticColors.map(({ key, label }, index) => {
                      const currentValue = (localTokens as any)[key];
                      const displayColor = getColorValue(currentValue);
                      const isEditing = editingName === key;
                      const isDragging = draggedIndex === index;
                      const isDragOver = dragOverIndex === index;
                      
                      return (
                        <div
                          key={key}
                          onDragOver={(e) => {
                            if (draggedIndex !== null) {
                              handleDragOver(e, index);
                            }
                          }}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => {
                            if (draggedIndex !== null) {
                              handleDrop(e, index);
                            }
                          }}
                        >
                        <div
                          key={key}
                          className="semantic-color-item"
                          style={{
                            opacity: isDragging ? 0.5 : 1,
                            borderTop: isDragOver ? '2px solid var(--color-accent)' : 'none',
                            padding: '8px',
                            gap: '16px'
                          }}
                        >
                          <div className="semantic-color-preview" style={{ backgroundColor: displayColor }}></div>
                          <div className="semantic-color-info" style={{ flex: 1, padding: 0, width: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  onBlur={() => handleFinishEdit(key)}
                                  onKeyDown={(e) => handleKeyDown(e, key)}
                                  autoFocus
                                  style={{
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--color-accent)',
                                    borderRadius: 'var(--border-radius)',
                                    padding: '4px 8px',
                                    color: 'var(--color-primary)',
                                    fontFamily: 'inherit',
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    outline: 'none',
                                    width: '100%',
                                    maxWidth: '200px'
                                  }}
                                />
                              ) : (
                                <>
                                  <span
                                    className="semantic-color-label"
                                    onClick={() => handleStartEdit(key)}
                                    style={{ cursor: 'text' }}
                                  >
                                    {label}
                                  </span>
                                  <button
                                    onClick={() => handleCopyToClipboard(key)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: copiedName === key ? 'var(--color-accent)' : 'var(--color-secondary)',
                                      cursor: 'pointer',
                                      padding: '2px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      transition: 'color 0.2s'
                                    }}
                                    title="Copy to clipboard"
                                  >
                                    {copiedName === key ? (
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M20 6L9 17l-5-5"/>
                                      </svg>
                                    ) : (
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                      </svg>
                                    )}
                                  </button>
                                </>
                              )}
                            </div>
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
                          <div
                            draggable
                            onDragStart={(e) => {
                              e.stopPropagation();
                              handleDragStart(e, index);
                            }}
                            onDragEnd={handleDragEnd}
                            style={{
                              color: 'var(--color-secondary)',
                              cursor: isDragging ? 'grabbing' : 'grab',
                              padding: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'color 0.2s',
                              userSelect: 'none'
                            }}
                            title="Drag to reorder"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="9" cy="5" r="1"/>
                              <circle cx="9" cy="12" r="1"/>
                              <circle cx="9" cy="19" r="1"/>
                              <circle cx="15" cy="5" r="1"/>
                              <circle cx="15" cy="12" r="1"/>
                              <circle cx="15" cy="19" r="1"/>
                            </svg>
                          </div>
                        </div>
                        </div>
                      );
                    })}
                    <div
                      className="semantic-color-item"
                      onClick={handleAddNew}
                      onDragOver={(e) => {
                        e.preventDefault();
                        const index = semanticColors.length;
                        handleDragOver(e, index);
                      }}
                      onDrop={(e) => {
                        const index = semanticColors.length;
                        handleDrop(e, index);
                      }}
                      style={{
                        cursor: 'pointer',
                        border: '2px solid var(--color-secondary)',
                        background: 'transparent',
                        padding: 0,
                        gap: '16px',
                        alignItems: 'center'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-accent)';
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-secondary)';
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div style={{ width: '48px', height: '48px', flexShrink: 0 }}></div>
                      <div className="semantic-color-info" style={{ flex: 1, display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--color-secondary)', padding: 0, width: '100%' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 5v14M5 12h14"/>
                        </svg>
                        <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.875rem' }}>Add</span>
                      </div>
                      <div style={{ width: '32px', flexShrink: 0 }}></div>
                    </div>
                  </div>
                </section>

                <section className="design-system-section">
                  <h3 className="section-header">Button Components</h3>
                  
                  <div className="button-components-demo">
                    <div className="button-demo-item">
                      <h4 className="button-demo-label">ds-button-primary</h4>
                      <button className="ds-button-primary">
                        Save
                      </button>
                      <p className="button-demo-description">Full-width button with neumorphic styling. Used for primary actions like saving profiles.</p>
                    </div>

                    <div className="button-demo-item">
                      <h4 className="button-demo-label">ds-button-destructive</h4>
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
                      <h4 className="button-demo-label">ds-button-secondary</h4>
                      <button className="ds-button-secondary">
                        Cancel
                      </button>
                      <p className="button-demo-description">Customizable button with same attributes as primary. Colors can be customized in the future.</p>
                    </div>
                  </div>
                </section>
              </div>
              <div className="design-system-actions-bottom-sheet">
                {showExportMessage && (
                  <div style={{ 
                    padding: 'var(--spacing-md)', 
                    marginBottom: 'var(--spacing-md)',
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: 'var(--border-radius)',
                    fontSize: '0.9rem',
                    color: 'var(--text-primary)'
                  }}>
                    <strong>Changes applied!</strong> To make these changes permanent for all users, 
                    <button 
                      onClick={exportTokens}
                      style={{
                        marginLeft: '8px',
                        color: 'var(--accent)',
                        background: 'none',
                        border: 'none',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontSize: 'inherit'
                      }}
                    >
                      export the JSON file
                    </button>
                    {' '}and replace <code style={{ fontSize: '0.85em' }}>public/design-tokens.json</code>
                  </div>
                )}
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
