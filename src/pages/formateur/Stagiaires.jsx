import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import formateurService from '../../_services/formateur.service';
import LoadingSpinner from '../../components/LoadingSpinner';

const Stagiaires = () => {
  const [stagiaires, setStagiaires] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 30;

  useEffect(() => {
    const loadStagiaires = async () => {
      try {
        setLoading(true);
        const data = await formateurService.getAllStagiaires();
        setStagiaires(data);
      } catch (err) {
        console.error('Erreur chargement stagiaires:', err);
        setError('Impossible de charger la liste des stagiaires');
      } finally {
        setLoading(false);
      }
    };

    loadStagiaires();
  }, []);

  const filteredStagiaires = stagiaires.filter(stagiaire =>
    `${stagiaire.prenom} ${stagiaire.nom}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    stagiaire.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredStagiaires.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filteredStagiaires.slice((currentPage - 1) * perPage, currentPage * perPage);

  const formatDate = (dateString) => {
    if (!dateString) return 'Jamais';
    return new Date(dateString).toLocaleString('fr-FR');
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-500 text-center p-4">{error}</div>;

  return (
    <div className="space-y-6 bg-indigo-100 min-h-screen p-6">
      {/* Header */}
      <div className="bg-blue-200 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-blue-800">Gestion des stagiaires</h1>
              <p className="text-gray-600">Supervision et suivi des stagiaires</p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/formateur/dashboard"
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                to="/formateur/stagiaires"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Stagiaires
              </Link>
              <Link
                to="/formateur/logs"
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Logs Audit
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Recherche + Résumé */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-blue-50 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Rechercher un stagiaire</h3>
            <div className="max-w-xl">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">🔎</span>
                <input
                  type="text"
                  id="search"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Nom, prénom ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">Filtre en temps réel sur nom, prénom et email.</p>
            </div>
          </div>
          <div className="bg-blue-50 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Résumé</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-xs text-gray-500">Total</p>
                <p className="text-xl font-semibold text-gray-900">{stagiaires.length}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Affichés</p>
                <p className="text-xl font-semibold text-gray-900">{filteredStagiaires.length}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Page</p>
                <p className="text-xl font-semibold text-gray-900">{currentPage}/{totalPages}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-blue-50 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 text-sm font-medium">👥</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total stagiaires</p>
                <p className="text-2xl font-semibold text-gray-900">{stagiaires.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 text-sm font-medium">🏥</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Patients créés</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {stagiaires.reduce((total, s) => total + (s.nbPatients || 0), 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-purple-600 text-sm font-medium">📊</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Actions totales</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {stagiaires.reduce((total, s) => total + (s.nbActions || 0), 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Liste des stagiaires */}
        <div className="bg-blue-50 shadow rounded-lg">
          <div className="px-6 py-4 border-b border-blue-200">
            <h3 className="text-lg font-medium text-gray-900">
              Liste des stagiaires ({filteredStagiaires.length})
            </h3>
          </div>
          
          {filteredStagiaires.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {pageItems.map((stagiaire) => (
                <div key={stagiaire.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-600">
                            {stagiaire.prenom.charAt(0)}{stagiaire.nom.charAt(0)}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center">
                          <h4 className="text-sm font-medium text-gray-900">
                            {stagiaire.prenom} {stagiaire.nom}
                          </h4>
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">Stagiaire</span>
                        </div>
                        <p className="text-sm text-gray-500">{stagiaire.email}</p>
                        <p className="text-xs text-gray-400">
                          Dernière activité: {formatDate(stagiaire.derniereActivite)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-6">
                      <div className="text-center">
                        <p className="text-sm font-medium text-gray-900">{stagiaire.nbPatients || 0}</p>
                        <p className="text-xs text-gray-500">Patients</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-gray-900">{stagiaire.nbActions || 0}</p>
                        <p className="text-xs text-gray-500">Actions</p>
                      </div>
                      <div className="flex space-x-2">
                        <Link
                          to={`/formateur/stagiaires/${stagiaire.id}`}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
                        >
                          Voir détails
                        </Link>
                        <Link
                          to={`/formateur/logs?user_id=${stagiaire.id}`}
                          className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                        >
                          Voir logs
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <div className="text-gray-400 text-4xl mb-4">👥</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun stagiaire trouvé</h3>
              <p className="text-gray-500">
                {searchTerm ? 'Aucun stagiaire ne correspond à votre recherche.' : 'Aucun stagiaire enregistré.'}
              </p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-blue-200 flex items-center justify-between">
              <div className="text-sm text-gray-600">Page {currentPage} / {totalPages}</div>
              <div className="space-x-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
                >Précédent</button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
                >Suivant</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Stagiaires;
