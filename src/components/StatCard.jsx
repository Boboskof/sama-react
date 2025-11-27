import React from 'react';

/**
 * Composant réutilisable pour afficher une carte de statistique
 * Basé sur le style des statistiques de communication
 * 
 * @param {Object} props
 * @param {string} props.icon - Nom de l'icône Material Symbols ou SVG path
 * @param {string} props.label - Label de la statistique
 * @param {string|number} props.value - Valeur à afficher
 * @param {string} props.color - Couleur du thème (purple, green, yellow, red, blue, orange, indigo) - défaut: purple
 * @param {boolean} props.useMaterialIcon - Utiliser Material Symbols au lieu de SVG - défaut: false
 * @param {string} props.className - Classes CSS additionnelles
 */
const StatCard = ({ 
  icon, 
  label, 
  value, 
  color = 'purple',
  useMaterialIcon = false,
  className = '' 
}) => {
  // Mapping des couleurs
  const colorClasses = {
    purple: {
      bg: 'bg-purple-100',
      text: 'text-purple-600',
      border: 'border-purple-200'
    },
    green: {
      bg: 'bg-green-100',
      text: 'text-green-600',
      border: 'border-green-200'
    },
    yellow: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-600',
      border: 'border-yellow-200'
    },
    red: {
      bg: 'bg-red-100',
      text: 'text-red-600',
      border: 'border-red-200'
    },
    blue: {
      bg: 'bg-blue-100',
      text: 'text-blue-600',
      border: 'border-blue-200'
    },
    orange: {
      bg: 'bg-orange-100',
      text: 'text-orange-600',
      border: 'border-orange-200'
    },
    indigo: {
      bg: 'bg-indigo-100',
      text: 'text-indigo-600',
      border: 'border-indigo-200'
    }
  };

  const colors = colorClasses[color] || colorClasses.purple;

  // Icônes SVG par défaut (pour compatibilité avec Communications.jsx)
  const defaultIcons = {
    email: 'M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    check: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z',
    users: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    chart: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    lightning: 'M13 10V3L4 14h7v7l9-11h-7z',
    settings: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    database: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4',
    shield: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    people: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    analytics: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    activity: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6'
  };

  const renderIcon = () => {
    if (useMaterialIcon && icon) {
      return (
        <span className={`material-symbols-rounded ${colors.text} text-2xl`}>
          {icon}
        </span>
      );
    }

    // SVG par défaut
    const svgPath = defaultIcons[icon] || defaultIcons.email;
    return (
      <svg className={`w-6 h-6 ${colors.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={svgPath} />
      </svg>
    );
  };

  return (
    <div className={`bg-white/90 backdrop-blur-sm p-6 rounded-lg shadow-lg border ${colors.border} ${className}`}>
      <div className="flex items-center">
        <div className={`p-2 ${colors.bg} rounded-lg`}>
          {renderIcon()}
        </div>
        <div className="ml-4">
          <p className="text-base font-medium text-gray-600">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value ?? 0}</p>
        </div>
      </div>
    </div>
  );
};

export default StatCard;

