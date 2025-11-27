import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import passwordService from '../_services/password.service';
import LoadingSpinner from '../components/LoadingSpinner';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tokenValid, setTokenValid] = useState(null);
  const [verifying, setVerifying] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Vérifier la validité du token au chargement
    const verifyToken = async () => {
      if (!token) {
        setTokenValid(false);
        setError('Token manquant dans l\'URL');
        setVerifying(false);
        return;
      }

      try {
        const data = await passwordService.verifyToken(token);
        setTokenValid(data.valid);
        if (!data.valid) {
          setError(data.error || 'Token invalide ou expiré');
        }
      } catch (err) {
        setTokenValid(false);
        setError(err?.response?.data?.error || 'Impossible de vérifier le token');
      } finally {
        setVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      setLoading(false);
      return;
    }

    if (!token) {
      setError('Token manquant');
      setLoading(false);
      return;
    }

    try {
      const data = await passwordService.resetPassword(token, password);
      // Rediriger vers la page de connexion avec un message de succès
      navigate('/login', { state: { message: data.message } });
    } catch (err) {
      setError(err?.response?.data?.error || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <LoadingSpinner fullPage={true} color="blue" message="Vérification du token..." size="large" />
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="max-w-md w-full text-center">
            <div className="mb-8">
              <img src="/logoSama/sama_logo.png" alt="SAMA Logo" className="h-80 w-auto mx-auto" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Token invalide</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <div className="space-y-4">
              <Link
                to="/forgot-password"
                className="inline-block bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700 transition-colors"
              >
                Demander un nouveau lien
              </Link>
              <div>
                <Link
                  to="/login"
                  className="text-blue-600 hover:underline"
                >
                  Retour à la connexion
                </Link>
              </div>
            </div>
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
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img src="/logoSama/sama_logo.png" alt="SAMA Logo" className="h-80 w-auto" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Réinitialiser votre mot de passe</h1>
            <p className="text-gray-600">Entrez votre nouveau mot de passe</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Nouveau mot de passe
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Entrez votre nouveau mot de passe"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirmer le mot de passe
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Confirmez votre nouveau mot de passe"
                autoComplete="new-password"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
                {error}
              </div>
            )}

            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="flex-1 bg-white border border-blue-600 text-blue-600 py-2 px-4 rounded-md hover:bg-blue-50 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Réinitialisation...' : 'Réinitialiser'}
              </button>
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

export default ResetPassword;

