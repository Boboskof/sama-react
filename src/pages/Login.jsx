import React, { useState, useEffect } from 'react';
import userService from '../_services/user.service';
import { useNavigate, Link, useLocation } from 'react-router-dom';

const Login = () => {
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Afficher le message de succès si présent dans location.state
  useEffect(() => {
    if (location.state?.message) {
      setMessage(location.state.message);
      // Nettoyer l'état de navigation pour éviter de réafficher le message au rafraîchissement
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Connexion (getCurrentUser est appelé automatiquement dans login)
      await userService.login({
        email: credentials.email,
        password: credentials.password,
      });

      // S'assurer que l'utilisateur est bien chargé depuis /api/me
      // TOUJOURS appeler getCurrentUser() pour obtenir les données complètes de /api/me
      let currentUser = await userService.getCurrentUser();
      
      // Si getCurrentUser() ne retourne rien, réessayer depuis localStorage
      if (!currentUser) {
        currentUser = userService.getUser();
      }
      
      // Si toujours pas d'utilisateur, attendre un peu et réessayer
      if (!currentUser) {
        await new Promise(resolve => setTimeout(resolve, 200));
        currentUser = await userService.getCurrentUser();
        if (!currentUser) {
          currentUser = userService.getUser();
        }
      }
      
      // Rediriger selon le rôle - Ordre IMPORTANT : Admin > Formateur > Stagiaire
      if (currentUser) {
        // 1. Vérifier isAdmin en PRIORITÉ (priorité la plus haute)
        if (currentUser.isAdmin === true || currentUser.primaryRole === 'ROLE_ADMIN') {
          window.location.href = '/admin/dashboard';
        }
        // 2. Vérifier isFormateur (priorité moyenne)
        else if (currentUser.isFormateur === true || currentUser.primaryRole === 'ROLE_FORMATEUR') {
          window.location.href = '/formateur/dashboard';
        }
        // 3. Vérifier isStagiaire (priorité la plus basse)
        else if (currentUser.isStagiaire === true || currentUser.primaryRole === 'ROLE_STAGIAIRE') {
          window.location.href = '/';
        }
        // Fallback : utiliser userService comme dernier recours
        else {
          const isAdmin = userService.isAdmin && userService.isAdmin();
          const isFormateur = userService.isFormateur && userService.isFormateur();
          if (isAdmin) {
            window.location.href = '/admin/dashboard';
          } else if (isFormateur) {
            window.location.href = '/formateur/dashboard';
          } else {
            window.location.href = '/';
          }
        }
      } else {
        window.location.href = '/';
      }
    } catch (err) {
      if (err?.code === 'ERR_NETWORK') {
        setError("Impossible de se connecter au serveur. Vérifiez que votre backend est démarré.");
      } else if (err?.response?.status === 401) {
        setError("Identifiant ou mot de passe incorrect.");
      } else {
        setError(err?.response?.data?.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setCredentials({ email: "", password: "" });
    setError("");
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img src="/logoSama/sama_logo.png" alt="SAMA Logo" className="h-80 w-auto" />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Identifiant
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Entrez votre email"
                value={credentials.email}
                onChange={handleChange}
                autoComplete="username"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Mot de passe
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Entrez votre mot de passe"
                value={credentials.password}
                onChange={handleChange}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
                {error}
              </div>
            )}

            {message && (
              <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-md">
                {message}
              </div>
            )}

            <div className="flex space-x-4">
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 bg-white border border-blue-600 text-blue-600 py-2 px-4 rounded-md hover:bg-blue-50 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? "Connexion..." : "Se Connecter"}
              </button>
            </div>

            <div className="text-center">
              <Link
                to="/forgot-password"
                className="inline-block bg-blue-400 text-white py-2 px-6 rounded-md hover:bg-blue-500 transition-colors"
              >
                Mot de passe oublié
              </Link>
            </div>
          </form>
        </div>
      </div>

      <footer className="bg-blue-900 text-white py-6 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="mb-4 md:mb-0">
              <p className="text-sm">© 2025 SAMA - Tous droits réservés</p>
            </div>
            <div className="flex space-x-6 mb-4 md:mb-0">
              <a href="#" className="text-sm hover:underline">Mentions légales</a>
              <a href="#" className="text-sm hover:underline">Contactez-nous</a>
              <a href="#" className="text-sm hover:underline">Politique de confidentialité</a>
            </div>
            <div className="flex items-center space-x-2">
              <img 
                src="/logoSama/Logo-UGECAM.jpg" 
                alt="UGECAM Logo" 
                className="h-8 w-auto"
              />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Login;