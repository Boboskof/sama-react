import React, { useState, useEffect } from 'react';
import userService from '../_services/user.service';
import { Link, useLocation } from 'react-router-dom';

const Navbar = () => {
  const location = useLocation();
  const [userLoaded, setUserLoaded] = useState(false);

  useEffect(() => {
    // Vérifier si l'utilisateur est chargé
    const checkUser = () => {
      const user = userService.getUser();
      if (user) {
        setUserLoaded(true);
      }
    };

    checkUser();

    // Écouter les changements d'authentification
    const handleAuthChange = () => {
      checkUser();
    };

    const handleStorageChange = (e) => {
      if (e.key === 'user') {
        checkUser();
      }
    };

    window.addEventListener('authChange', handleAuthChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('authChange', handleAuthChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const isFormateur = userService.isFormateur && userService.isFormateur();
  const user = userService.getUser();
  const isAdmin = user && (user.isAdmin === true || user.primaryRole === 'ROLE_ADMIN');

  const baseNavItems = [
    { path: '/', label: 'Tableau de Bord', bgColor: 'bg-blue-100', textColor: 'text-blue-700' },
    { path: '/patients', label: 'Dossiers Patients', bgColor: 'bg-orange-100', textColor: 'text-orange-700' },
    { path: '/hospitalisations', label: 'Hospitalisations', bgColor: 'bg-indigo-100', textColor: 'text-indigo-700' },
    { path: '/appointments', label: 'Rendez-Vous', bgColor: 'bg-pink-100', textColor: 'text-pink-700' },
    { path: '/exercises', label: 'Mes Exercices', bgColor: 'bg-sky-100', textColor: 'text-sky-700' },
    { path: '/documents', label: 'Documents', bgColor: 'bg-green-100', textColor: 'text-green-700' },
    { path: '/communications', label: 'Communications', bgColor: 'bg-purple-100', textColor: 'text-purple-700' }
  ];

  const adminNavItems = [
    { path: '/admin/dashboard', label: 'Admin', bgColor: 'bg-red-100', textColor: 'text-red-700' }
  ];

  const formateurNavItems = [
    { path: '/formateur/dashboard', label: 'Tableau de Bord', bgColor: 'bg-blue-200', textColor: 'text-blue-800' },
    { path: '/formateur/exercises', label: 'Atelier d\'exercices', bgColor: 'bg-blue-200', textColor: 'text-blue-800' },
    { path: '/formateur/logs', label: 'Logs', bgColor: 'bg-blue-200', textColor: 'text-blue-800' }
  ];

  // Liens: pour admin, afficher le lien admin en premier
  // Pour formateur, garder un seul bouton Tableau de Bord (formateur), retirer le dashboard général '/' et "Mes Exercices"
  const filteredBaseForFormateur = baseNavItems.filter(it => it.path !== '/' && it.path !== '/exercises');
  let navItems;
  if (isAdmin) {
    navItems = [...adminNavItems, ...formateurNavItems, ...filteredBaseForFormateur];
  } else if (isFormateur) {
    navItems = [...formateurNavItems, ...filteredBaseForFormateur];
  } else {
    navItems = baseNavItems;
  }


  const isActivePath = (itemPath, currentPath) => {
    // Exact match
    if (currentPath === itemPath) return true;
    // Pour les chemins racines, vérifier si le chemin actuel commence par ce chemin
    if (itemPath !== '/' && currentPath.startsWith(itemPath + '/')) return true;
    // Pour le dashboard, vérifier si on est à la racine exacte
    if (itemPath === '/' && currentPath === '/') return true;
    return false;
  };

  const getButtonClasses = (item) => {
    const isActive = isActivePath(item.path, location.pathname);
    const baseClasses = "px-4 py-2 rounded-lg font-medium transition-all duration-200";
    
    if (isActive) {
      // Style plus foncé pour l'élément actif
      return `${baseClasses} ${item.bgColor} ${item.textColor} shadow-lg font-bold opacity-100 scale-105`;
    } else {
      return `${baseClasses} ${item.bgColor} ${item.textColor} hover:shadow-md hover:scale-105 opacity-70 hover:opacity-90`;
    }
  };

  return (
    <nav className="bg-gray-50 border-t border-gray-200 shadow-sm">
      <div className="w-full px-4 py-3">
        <div className="flex justify-center space-x-4">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={getButtonClasses(item)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;