import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import passwordService from '../_services/password.service';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const data = await passwordService.forgotPassword(email);
      setMessage(data.message);
    } catch (err) {
      setError(err?.response?.data?.error || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img src="/logoSama/sama_logo.png" alt="SAMA Logo" className="h-80 w-auto" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Mot de passe oublié</h1>
            <p className="text-gray-600">Entrez votre adresse email pour recevoir un lien de réinitialisation</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Entrez votre email"
                autoComplete="email"
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
                onClick={() => navigate('/login')}
                className="flex-1 bg-white border border-blue-600 text-blue-600 py-2 px-4 rounded-md hover:bg-blue-50 transition-colors"
              >
                Retour à la connexion
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Envoi...' : 'Envoyer'}
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

export default ForgotPassword;

