import React from 'react';
import userService from '../_services/user.service';
import { Link, useLocation } from 'react-router-dom';

const Navbar = () => {
  const location = useLocation();

  const isFormateur = userService.isFormateur && userService.isFormateur();

  const baseNavItems = [
    { path: '/', label: 'Tableau de Bord', bgColor: 'bg-blue-100', textColor: 'text-blue-700' },
    { path: '/patients', label: 'Dossiers Patients', bgColor: 'bg-orange-100', textColor: 'text-orange-700' },
    { path: '/hospitalisations', label: 'Hospitalisations', bgColor: 'bg-indigo-100', textColor: 'text-indigo-700' },
    { path: '/appointments', label: 'Rendez-Vous', bgColor: 'bg-pink-100', textColor: 'text-pink-700' },
    { path: '/documents', label: 'Documents', bgColor: 'bg-green-100', textColor: 'text-green-700' },
    { path: '/communications', label: 'Communications', bgColor: 'bg-purple-100', textColor: 'text-purple-700' }
  ];

  const formateurNavItems = [
    { path: '/formateur/dashboard', label: 'Tableau de Bord', bgColor: 'bg-indigo-100', textColor: 'text-indigo-700' },
    { path: '/formateur/stagiaires', label: 'Stagiaires', bgColor: 'bg-indigo-100', textColor: 'text-indigo-700' },
    { path: '/formateur/logs', label: 'Logs', bgColor: 'bg-indigo-100', textColor: 'text-indigo-700' }
  ];

  // Liens: pour formateur, garder un seul bouton Tableau de Bord (formateur) et retirer le dashboard général '/'
  const filteredBaseForFormateur = baseNavItems.filter(it => it.path !== '/');
  const navItems = isFormateur ? [...formateurNavItems, ...filteredBaseForFormateur] : baseNavItems;


  const getButtonClasses = (item) => {
    const isActive = location.pathname === item.path;
    const baseClasses = "px-4 py-2 rounded-lg font-medium transition-all duration-200";
    
    if (isActive) {
      return `${baseClasses} ${item.bgColor} ${item.textColor} shadow-sm`;
    } else {
      return `${baseClasses} ${item.bgColor} ${item.textColor} hover:shadow-md hover:scale-105 opacity-80 hover:opacity-100`;
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
