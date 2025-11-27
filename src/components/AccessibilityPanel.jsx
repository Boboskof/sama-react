import React, { useState } from 'react';
import { useAccessibility } from '../contexts/AccessibilityContext';

const AccessibilityPanel = () => {
  const { 
    fontSize, 
    setFontSize, 
    highContrast, 
    setHighContrast,
    keyboardNavigation,
    setKeyboardNavigation
  } = useAccessibility();
  
  const [isOpen, setIsOpen] = useState(false);

  const togglePanel = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      {/* Bouton flottant pour ouvrir le panneau */}
      <button
        onClick={togglePanel}
        className="fixed bottom-6 right-6 z-50 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-300 transition-all duration-200"
        aria-label="Ouvrir les options d'accessibilité"
        aria-expanded={isOpen}
        title="Options d'accessibilité"
      >
        <svg 
          className="w-6 h-6" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" 
          />
        </svg>
      </button>

      {/* Panneau d'options */}
      {isOpen && (
        <div 
          className="fixed bottom-24 right-6 z-50 bg-white rounded-lg shadow-2xl border border-gray-200 p-6 w-80 max-w-[calc(100vw-3rem)]"
          role="dialog"
          aria-labelledby="accessibility-panel-title"
          aria-modal="true"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 
              id="accessibility-panel-title"
              className="text-lg font-semibold text-gray-900"
            >
              Options d'accessibilité
            </h2>
            <button
              onClick={togglePanel}
              className="text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-1"
              aria-label="Fermer les options d'accessibilité"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-6">
            {/* Option 1: Taille du texte */}
            <div>
              <label 
                htmlFor="font-size-select"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Taille du texte
              </label>
              <select
                id="font-size-select"
                value={fontSize}
                onChange={(e) => setFontSize(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                aria-label="Sélectionner la taille du texte"
              >
                <option value="small">Petit</option>
                <option value="medium">Moyen (défaut)</option>
                <option value="large">Grand</option>
                <option value="extra-large">Très grand</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Ajustez la taille du texte pour améliorer la lisibilité
              </p>
            </div>

            {/* Option 2: Contraste élevé */}
            <div>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={highContrast}
                  onChange={(e) => setHighContrast(e.target.checked)}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  aria-label="Activer le mode contraste élevé"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-700">
                    Contraste élevé
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    Améliore la lisibilité avec des couleurs plus contrastées
                  </p>
                </div>
              </label>
            </div>

            {/* Option 3: Navigation au clavier */}
            <div>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={keyboardNavigation}
                  onChange={(e) => setKeyboardNavigation(e.target.checked)}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  aria-label="Activer la navigation au clavier améliorée"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-700">
                    Navigation au clavier
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    Améliore la navigation avec Tab, Entrée et Échap
                  </p>
                </div>
              </label>
            </div>

            {/* Raccourcis clavier */}
            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Raccourcis clavier
              </h3>
              <ul className="text-xs text-gray-600 space-y-1">
                <li><kbd className="px-2 py-1 bg-gray-100 rounded">Tab</kbd> - Naviguer</li>
                <li><kbd className="px-2 py-1 bg-gray-100 rounded">Entrée</kbd> - Activer</li>
                <li><kbd className="px-2 py-1 bg-gray-100 rounded">Échap</kbd> - Fermer</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Overlay pour fermer en cliquant à l'extérieur */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-25"
          onClick={togglePanel}
          aria-hidden="true"
        />
      )}
    </>
  );
};

export default AccessibilityPanel;








