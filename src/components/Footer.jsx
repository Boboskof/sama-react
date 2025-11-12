import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-gray-800 text-white">
      <div className="max-w-screen-xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Logo SAMA */}
          <div className="space-y-4">
            <div className="flex items-center">
              <img 
                src="/logoSama/sama_logo.png" 
                alt="SAMA Logo" 
                className="h-28 md:h-36 w-auto"
              />
            </div>
            <p className="text-sm text-gray-300">
              Système de gestion des documents médicaux pour une meilleure organisation des soins.
            </p>
          </div>

          {/* Liens utiles */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Liens utiles</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="text-gray-300 hover:text-white transition-colors">
                  Tableau de bord
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-300 hover:text-white transition-colors">
                  Dossiers patients
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-300 hover:text-white transition-colors">
                  Rendez-vous
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-300 hover:text-white transition-colors">
                  Documents
                </a>
              </li>
            </ul>
          </div>

          {/* Logo UGECAM et informations */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <a href="https://www.groupe-ugecam.fr/" target="_blank" rel="noopener noreferrer">
                <img 
                  src="/logoSama/Logo-UGECAM.jpg" 
                  alt="UGECAM Logo" 
                  className="h-12 w-auto"
                />
              </a>
            </div>
            <div className="text-sm text-gray-300">
              <p className="font-medium">UGECAM</p>
              <p>Union de Gestion des Établissements</p>
              <p>des Caisses d'Assurance Maladie</p>
            </div>
          </div>
        </div>

        {/* Ligne de séparation */}
        <div className="border-t border-gray-700 mt-8 pt-6">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="text-sm text-gray-400">
              © 2025 SAMA - Tous droits réservés
            </div>
            <div className="flex space-x-6 text-sm">
              <Link to="/mentions-legales" className="text-gray-400 hover:text-white transition-colors">
                Mentions légales
              </Link>
              <Link to="/politique-de-confidentialite" className="text-gray-400 hover:text-white transition-colors">
                Politique de confidentialité
              </Link>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                Contact
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
