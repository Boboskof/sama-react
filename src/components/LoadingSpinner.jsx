import React from 'react';

/**
 * Composant de chargement standardisé pour toute l'application
 * 
 * @param {string} message - Message à afficher sous le spinner (optionnel)
 * @param {string} size - Taille: "small" (h-4 w-4), "medium" (h-8 w-8), "large" (h-12 w-12)
 * @param {string} color - Couleur: "blue", "green", "pink", "purple", "orange", "gray", "white"
 * @param {boolean} inline - Si true, affiche juste le spinner sans wrapper ni message (pour intégration dans du texte/boutons)
 * @param {boolean} fullPage - Si true, occupe toute la page (centré verticalement et horizontalement)
 */
const LoadingSpinner = ({ 
  message = "Chargement...", 
  size = "medium",
  color = "blue",
  inline = false,
  fullPage = false
}) => {
  const sizeClasses = {
    small: "h-4 w-4",
    medium: "h-8 w-8",
    large: "h-12 w-12"
  };

  const colorClasses = {
    blue: "border-blue-600",
    green: "border-green-600",
    pink: "border-pink-600",
    purple: "border-purple-600",
    orange: "border-orange-600",
    gray: "border-gray-600",
    white: "border-white"
  };

  const spinner = (
    <div className={`animate-spin rounded-full border-b-2 ${colorClasses[color] || colorClasses.blue} ${sizeClasses[size] || sizeClasses.medium} mx-auto`}></div>
  );

  // Mode inline: juste le spinner, pas de wrapper
  if (inline) {
    return spinner;
  }

  // Mode fullPage: centré sur toute la page
  if (fullPage) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          {spinner}
          {message && <p className="mt-4 text-gray-600">{message}</p>}
        </div>
      </div>
    );
  }

  // Mode par défaut: centré dans son conteneur
  return (
    <div className="flex items-center justify-center py-8">
      <div className="text-center">
        {spinner}
        {message && <p className="mt-4 text-gray-600">{message}</p>}
      </div>
    </div>
  );
};

export default LoadingSpinner;

