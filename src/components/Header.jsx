import React, { useState, useEffect } from 'react';
import userService from '../_services/user.service';
import SearchBar from './SearchBar';

const Header = () => {
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    // Vérifier si l'utilisateur est connecté au chargement
    const checkAuth = async () => {
      const isLogged = userService.isLogged();
      setIsLoggedIn(isLogged);
      
      if (isLogged) {
        try {
          // Récupérer les données utilisateur depuis le serveur
          const userData = await userService.getCurrentUser();
          setUser(userData);
        } catch (error) {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    };

    checkAuth();
  }, []);

  // Fermer le menu déroulant quand on clique à l'extérieur
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isDropdownOpen && !event.target.closest('.relative')) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleLogout = () => {
    userService.logout();
    setIsLoggedIn(false);
    setUser(null);
    setIsDropdownOpen(false);
    // Forcer le rechargement de la page pour déclencher la logique de routage
    window.location.reload();
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm w-full">
      <div className="w-full flex items-center justify-between px-4 py-4">
        {/* Logo SAMA à gauche */}
        <div className="flex items-center space-x-4">
          <img 
            src="/logoSama/sama_logo_ligne.png" 
            alt="SAMA Logo" 
            className="h-20 w-auto"
          />
        </div>

        {/* Titre central */}
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-semibold text-slate-600 font-sans mb-2">
            Gestion des documents médicaux
          </h1>
          
        </div>

        {/* Statut utilisateur à droite */}
        <div className="flex items-center space-x-3">
          {isLoggedIn && user ? (
            <div className="relative">
              <button
                type="button"
                onClick={toggleDropdown}
                className="flex items-center space-x-2 text-sm font-medium text-gray-700 hover:text-gray-900 focus:outline-none"
              >
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
                <span>
                  {userService.isAdmin()
                    ? 'Admin'
                    : userService.isFormateur()
                    ? 'Formateur'
                    : 'Stagiaire AMA'}
                </span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {/* Menu déroulant */}
              {isDropdownOpen && (
                <div className="absolute right-0 z-50 my-4 text-base list-none bg-white divide-y divide-gray-100 rounded-lg shadow-lg border border-gray-200 dark:bg-gray-700 dark:divide-gray-600 animate-in slide-in-from-top-2 duration-200">
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-600 rounded-t-lg">
                  <span className="block text-sm font-medium text-gray-900 dark:text-white">
                    {user.firstName} {user.lastName}
                  </span>
                  <span className="block text-sm text-gray-500 truncate dark:text-gray-400">
                    {user.email}
                  </span>
                </div>
                <ul className="py-2" aria-labelledby="user-menu-button">
                  <li>
                    <a 
                      href="/mon-profil" 
                      className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white dark:hover:bg-white/10 transition-all duration-200 ease-in-out group cursor-pointer rounded-md hover:translate-x-0.5"
                    >
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-rounded text-base group-hover:scale-110 transition-transform duration-200">person</span>
                        <span className="font-medium">Mon profil</span>
                      </div>
                    </a>
                  </li>
                  
                  <li>
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white dark:hover:bg-white/10 transition-all duration-200 ease-in-out group cursor-pointer rounded-md hover:translate-x-0.5"
                    >
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-rounded text-base group-hover:scale-110 transition-transform duration-200">logout</span>
                        <span className="font-medium">Se déconnecter</span>
                      </div>
                    </button>
                  </li>
                </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">Non connecté</span>
              <a 
                href="/login" 
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Se connecter
              </a>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
