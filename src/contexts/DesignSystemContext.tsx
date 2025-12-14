import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface DesignTokens {
  // Primitive Colors - Gray Scale (100-900, where 900 is white)
  'gray-100': string;
  'gray-200': string;
  'gray-300': string;
  'gray-400': string;
  'gray-500': string;
  'gray-600': string;
  'gray-700': string;
  'gray-800': string;
  'gray-900': string;
  // CMYK Colors
  'cyan-light': string;
  'cyan-dark': string;
  'magenta-light': string;
  'magenta-dark': string;
  'yellow-light': string;
  'yellow-dark': string;
  
  // Semantic Colors (reference primitive names)
  'brand-primary': string;
  'primary': string;
  'secondary': string;
  'tertiary': string;
  'accent': string;
  'accent-2': string;
  'accent-3': string;
  'button-primary': string;
  'background-primary': string;
  'background-secondary': string;
  'background-tertiary': string;
}

interface DesignSystemContextType {
  tokens: DesignTokens;
  updateTokens: (tokens: Partial<DesignTokens>) => void;
  applyTokens: () => void;
  exportTokens: () => void;
}

const defaultTokens: DesignTokens = {
  // Primitive Colors - Gray Scale (100-900, where 900 is white)
  'gray-100': '#141414',  // Darkest (background-primary, background-secondary)
  'gray-200': '#1A1A1A',  // Very dark (tertiary, gray-dark)
  'gray-300': '#2a2a2a',  // Dark (button-primary)
  'gray-400': '#6B6B6B',  // Medium (secondary, gray-light)
  'gray-500': '#808080',  // Mid-gray
  'gray-600': '#999999',  // Light gray
  'gray-700': '#B3B3B3',  // Lighter gray
  'gray-800': '#CCCCCC',  // Very light gray
  'gray-900': '#FFFFFF',  // White (primary, background-tertiary)
  // CMYK Colors
  'cyan-light': '#7EC8E3',
  'cyan-dark': '#4A90E2',
  'magenta-light': '#F06292',
  'magenta-dark': '#D81B60',
  'yellow-light': '#FFD54F',
  'yellow-dark': '#FFA000',
  
  // Semantic Colors (reference primitive names)
  'brand-primary': 'cyan-light',
  'primary': 'gray-900',
  'secondary': 'gray-400',
  'tertiary': 'gray-200',
  'accent': 'cyan-light',
  'accent-2': 'magenta-light',
  'accent-3': 'yellow-light',
  'button-primary': 'gray-300',
  'background-primary': 'gray-100',
  'background-secondary': 'gray-100',
  'background-tertiary': 'gray-900',
};

const DesignSystemContext = createContext<DesignSystemContextType | undefined>(undefined);

export function DesignSystemProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<DesignTokens>(defaultTokens);
  const [pendingTokens, setPendingTokens] = useState<DesignTokens>(defaultTokens);

  // Load tokens: first from JSON file (for all users), then localStorage (for overrides)
  useEffect(() => {
    const loadTokens = async () => {
      try {
        // First, try to load from the JSON file (source of truth for all users)
        const response = await fetch('/design-tokens.json');
        let loadedTokens = defaultTokens;
        
        if (response.ok) {
          const fileTokens = await response.json();
          loadedTokens = { ...defaultTokens, ...fileTokens } as DesignTokens;
        }
        
        // Then check localStorage for any user-specific overrides (for testing/preview)
        const saved = localStorage.getItem('designTokens');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            // Merge: file tokens as base, localStorage as override
            loadedTokens = { ...loadedTokens, ...parsed } as DesignTokens;
          } catch (e) {
            console.error('Failed to parse localStorage tokens:', e);
          }
        }
        
        setTokens(loadedTokens);
        setPendingTokens(loadedTokens);
        applyTokensToDOM(loadedTokens);
      } catch (e) {
        console.error('Failed to load design tokens:', e);
        // Fallback to defaults
        applyTokensToDOM(defaultTokens);
      }
    };
    
    loadTokens();
  }, []);

  const getPrimitiveValue = (primitiveName: string, tokens: DesignTokens): string => {
    // Check if it's a direct hex value or a primitive reference
    if (primitiveName.startsWith('#')) {
      return primitiveName;
    }
    // Get the primitive color value
    return (tokens as any)[primitiveName] || primitiveName;
  };

  const applyTokensToDOM = (tokensToApply: DesignTokens) => {
    const root = document.documentElement;
    
    // Primitive Colors - Gray Scale
    root.style.setProperty('--gray-100', tokensToApply['gray-100']);
    root.style.setProperty('--gray-200', tokensToApply['gray-200']);
    root.style.setProperty('--gray-300', tokensToApply['gray-300']);
    root.style.setProperty('--gray-400', tokensToApply['gray-400']);
    root.style.setProperty('--gray-500', tokensToApply['gray-500']);
    root.style.setProperty('--gray-600', tokensToApply['gray-600']);
    root.style.setProperty('--gray-700', tokensToApply['gray-700']);
    root.style.setProperty('--gray-800', tokensToApply['gray-800']);
    root.style.setProperty('--gray-900', tokensToApply['gray-900']);
    // CMYK Colors
    root.style.setProperty('--cyan-light', tokensToApply['cyan-light']);
    root.style.setProperty('--cyan-dark', tokensToApply['cyan-dark']);
    root.style.setProperty('--magenta-light', tokensToApply['magenta-light']);
    root.style.setProperty('--magenta-dark', tokensToApply['magenta-dark']);
    root.style.setProperty('--yellow-light', tokensToApply['yellow-light']);
    root.style.setProperty('--yellow-dark', tokensToApply['yellow-dark']);
    
    // Semantic Colors (resolve primitive references)
    const brandPrimaryValue = getPrimitiveValue(tokensToApply['brand-primary'], tokensToApply);
    const primaryValue = getPrimitiveValue(tokensToApply['primary'], tokensToApply);
    const secondaryValue = getPrimitiveValue(tokensToApply['secondary'], tokensToApply);
    const tertiaryValue = getPrimitiveValue(tokensToApply['tertiary'], tokensToApply);
    const accentValue = getPrimitiveValue(tokensToApply['accent'], tokensToApply);
    const accent2Value = getPrimitiveValue(tokensToApply['accent-2'], tokensToApply);
    const accent3Value = getPrimitiveValue(tokensToApply['accent-3'], tokensToApply);
    const buttonPrimaryValue = getPrimitiveValue(tokensToApply['button-primary'], tokensToApply);
    const backgroundPrimaryValue = getPrimitiveValue(tokensToApply['background-primary'], tokensToApply);
    const backgroundSecondaryValue = getPrimitiveValue(tokensToApply['background-secondary'], tokensToApply);
    const backgroundTertiaryValue = getPrimitiveValue(tokensToApply['background-tertiary'], tokensToApply);
    
    root.style.setProperty('--color-brand-primary', brandPrimaryValue);
    root.style.setProperty('--color-primary', primaryValue);
    root.style.setProperty('--color-secondary', secondaryValue);
    root.style.setProperty('--color-tertiary', tertiaryValue);
    root.style.setProperty('--color-accent', accentValue);
    root.style.setProperty('--color-accent-2', accent2Value);
    root.style.setProperty('--color-accent-3', accent3Value);
    root.style.setProperty('--color-background-primary', backgroundPrimaryValue);
    root.style.setProperty('--color-background-secondary', backgroundSecondaryValue);
    root.style.setProperty('--color-background-tertiary', backgroundTertiaryValue);
    
    // Legacy mappings for existing CSS
    root.style.setProperty('--accent', accentValue);
    root.style.setProperty('--accent-hover', accent2Value);
    root.style.setProperty('--text-primary', primaryValue);
    root.style.setProperty('--text-secondary', secondaryValue);
    root.style.setProperty('--accent-secondary', accent2Value);
    root.style.setProperty('--accent-tertiary', accent3Value);
    root.style.setProperty('--button-primary', buttonPrimaryValue);
  };

  const updateTokens = (newTokens: Partial<DesignTokens> | DesignTokens) => {
    const updated = { ...pendingTokens, ...newTokens } as DesignTokens;
    setPendingTokens(updated);
    // Apply changes immediately for real-time preview
    applyTokensToDOM(updated);
  };

  const applyTokens = () => {
    setTokens(pendingTokens);
    applyTokensToDOM(pendingTokens);
    // Save to localStorage for immediate persistence (overrides JSON file for this user)
    localStorage.setItem('designTokens', JSON.stringify(pendingTokens));
  };

  const exportTokens = () => {
    // Create a downloadable JSON file for the user to update public/design-tokens.json
    const jsonString = JSON.stringify(pendingTokens, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'design-tokens.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <DesignSystemContext.Provider value={{ tokens, updateTokens, applyTokens, exportTokens }}>
      {children}
    </DesignSystemContext.Provider>
  );
}

export function useDesignSystem() {
  const context = useContext(DesignSystemContext);
  if (context === undefined) {
    throw new Error('useDesignSystem must be used within a DesignSystemProvider');
  }
  return context;
}

