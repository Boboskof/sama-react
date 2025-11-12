import React, { useState } from 'react';
import userService from '../_services/user.service';
import { devConfig } from '../utils/devAuth';

const DevLogin = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [credentials, setCredentials] = useState({
    email: 'admin@example.com',
    password: 'password'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Pour le développement, on simule une connexion réussie
      // En production, vous devriez appeler l'API de login
      const mockToken = devConfig.mockToken;
      
      // Stocker le token
      localStorage.setItem('token', mockToken);
      
      // Simuler des données utilisateur
      const mockUser = devConfig.mockUser;
      localStorage.setItem('user', JSON.stringify(mockUser));
      
      // Recharger la page pour appliquer les changements
      window.location.reload();
      
    } catch (err) {
      setError('Erreur de connexion: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    userService.logout();
    window.location.reload();
  };

  const isLoggedIn = userService.isLogged();

  if (isLoggedIn) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded-lg shadow-lg">
          <div className="flex items-center space-x-2">
            <span className="text-sm">✅ Connecté en mode développement</span>
            <button
              onClick={handleLogout}
              className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      {!isVisible ? (
        <button
          onClick={() => setIsVisible(true)}
          className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm"
        >
          🔑 Connexion Dev
        </button>
      ) : (
        <div className="bg-white border border-gray-300 rounded-lg shadow-lg p-4 w-80">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold text-gray-800">Connexion Développement</h3>
            <button
              onClick={() => setIsVisible(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={credentials.email}
                onChange={(e) => setCredentials({...credentials, email: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe
              </label>
              <input
                type="password"
                value={credentials.password}
                onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            {error && (
              <div className="text-red-600 text-sm">{error}</div>
            )}
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-md transition-colors"
            >
              {loading ? 'Connexion...' : 'Se connecter (Mode Dev)'}
            </button>
          </form>
          
          <div className="mt-3 text-xs text-gray-500">
            <p>⚠️ Mode développement uniquement</p>
            <p>Utilise un token JWT simulé pour tester l'API</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DevLogin;
