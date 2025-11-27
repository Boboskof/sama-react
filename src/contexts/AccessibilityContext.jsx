import { createContext, useContext, useState, useEffect } from 'react';

const AccessibilityContext = createContext();

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
};

export const AccessibilityProvider = ({ children }) => {
  // État initial depuis localStorage ou valeurs par défaut
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('accessibility_fontSize');
    return saved || 'medium';
  });

  const [highContrast, setHighContrast] = useState(() => {
    const saved = localStorage.getItem('accessibility_highContrast');
    return saved === 'true';
  });

  const [keyboardNavigation, setKeyboardNavigation] = useState(() => {
    const saved = localStorage.getItem('accessibility_keyboardNavigation');
    return saved !== 'false'; // true par défaut
  });

  // Appliquer les styles au chargement et lors des changements
  useEffect(() => {
    const root = document.documentElement;
    
    // Taille de texte
    const fontSizeMap = {
      small: '0.875rem',    // 14px
      medium: '1rem',       // 16px (défaut)
      large: '1.125rem',    // 18px
      'extra-large': '1.25rem' // 20px
    };
    
    root.style.setProperty('--accessibility-font-size', fontSizeMap[fontSize] || fontSizeMap.medium);
    root.classList.toggle('font-size-small', fontSize === 'small');
    root.classList.toggle('font-size-medium', fontSize === 'medium');
    root.classList.toggle('font-size-large', fontSize === 'large');
    root.classList.toggle('font-size-extra-large', fontSize === 'extra-large');
    
    // Contraste élevé
    root.classList.toggle('high-contrast', highContrast);
    
    // Navigation clavier (toujours activée, mais on peut ajouter des styles spécifiques)
    root.classList.toggle('keyboard-navigation', keyboardNavigation);
    
  }, [fontSize, highContrast, keyboardNavigation]);

  // Sauvegarder dans localStorage
  useEffect(() => {
    localStorage.setItem('accessibility_fontSize', fontSize);
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem('accessibility_highContrast', highContrast.toString());
  }, [highContrast]);

  useEffect(() => {
    localStorage.setItem('accessibility_keyboardNavigation', keyboardNavigation.toString());
  }, [keyboardNavigation]);

  // Gestion de la navigation clavier globale
  useEffect(() => {
    if (!keyboardNavigation) return;

    const handleKeyDown = (e) => {
      // Échap pour fermer les modales/menus
      if (e.key === 'Escape') {
        const modals = document.querySelectorAll('[role="dialog"]');
        const dropdowns = document.querySelectorAll('[aria-expanded="true"]');
        
        // Fermer les modales
        modals.forEach(modal => {
          const closeButton = modal.querySelector('[aria-label*="fermer"], [aria-label*="close"]');
          if (closeButton) closeButton.click();
        });
        
        // Fermer les menus déroulants
        dropdowns.forEach(dropdown => {
          const button = dropdown.querySelector('button');
          if (button) button.click();
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [keyboardNavigation]);

  const value = {
    fontSize,
    setFontSize,
    highContrast,
    setHighContrast,
    keyboardNavigation,
    setKeyboardNavigation,
  };

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
};








