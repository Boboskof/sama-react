import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import formateurService from '../../_services/formateur.service';
import userService from '../../_services/user.service';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatDateTime } from '../../utils/dateHelpers';

const Stagiaires = () => {
  const [stagiaires, setStagiaires] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 30;
  const [user, setUser] = useState(null);
  
  // État pour le formulaire d'ajout
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    prenom: '',
    nom: '',
    typeStagiaire: '',
    section: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const loadStagiaires = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await formateurService.getAllStagiaires();
      // Normaliser les données : peut être un tableau ou un objet avec data
      const normalized = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
      setStagiaires(normalized);
    } catch (err) {
      console.error('Erreur chargement stagiaires:', err);
      setError('Impossible de charger la liste des stagiaires');
      setStagiaires([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStagiaires();
    // Charger l'utilisateur connecté pour afficher sa section
    const loadUser = async () => {
      try {
        const storedUser = userService.getUser?.() || null;
        if (storedUser) setUser(storedUser);
        const currentUser = await userService.getCurrentUser().catch(() => storedUser || null);
        setUser(currentUser);
      } catch (err) {
        console.error('Erreur chargement utilisateur:', err);
      }
    };
    loadUser();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    setSubmitSuccess(false);

    try {
      // Validation côté client
      if (!formData.email || !formData.password || !formData.prenom || !formData.nom) {
        setSubmitError('Tous les champs obligatoires doivent être remplis');
        setSubmitting(false);
        return;
      }

      if (formData.password.length < 6) {
        setSubmitError('Le mot de passe doit contenir au moins 6 caractères');
        setSubmitting(false);
        return;
      }

      // Préparer les données pour l'API
      const payload = {
        email: formData.email.trim(),
        password: formData.password,
        prenom: formData.prenom.trim(),
        nom: formData.nom.trim(),
      };

      if (formData.typeStagiaire) {
        payload.typeStagiaire = formData.typeStagiaire;
      }
      if (formData.section) {
        payload.section = formData.section.trim();
      }

      await formateurService.createStagiaire(payload);
      
      // Réinitialiser le formulaire
      setFormData({
        email: '',
        password: '',
        prenom: '',
        nom: '',
        typeStagiaire: '',
        section: ''
      });
      setSubmitSuccess(true);
      setShowAddForm(false);
      
      // Recharger la liste des stagiaires
      await loadStagiaires();
      
      // Masquer le message de succès après 3 secondes
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (err) {
      const errorMessage = err?.message || err?.response?.data?.error || 'Erreur lors de la création du stagiaire';
      setSubmitError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setSubmitError(''); // Effacer l'erreur lors de la modification
  };

  const filteredStagiaires = (Array.isArray(stagiaires) ? stagiaires : []).filter(stagiaire => {
    if (!stagiaire) return false;
    const fullName = `${stagiaire.prenom || ''} ${stagiaire.nom || ''}`.toLowerCase();
    const email = (stagiaire.email || '').toLowerCase();
    const search = searchTerm.toLowerCase();
    return fullName.includes(search) || email.includes(search);
  });

  const totalPages = Math.max(1, Math.ceil(filteredStagiaires.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filteredStagiaires.slice((currentPage - 1) * perPage, currentPage * perPage);


  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-500 text-center p-4">{error}</div>;

  return (
    <div className="space-y-6 bg-indigo-100 min-h-screen w-[95%] md:w-[90%] lg:w-[80%] mx-auto px-2 md:px-4 py-6">
      {/* Titre avec icône */}
      <div className="text-center py-6 mb-6">
        <div className="bg-blue-200 rounded-lg shadow p-6 max-w-xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center shadow-sm">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-blue-800">Gestion des stagiaires</h1>
          </div>
          <p className="text-blue-700 text-sm">
            Supervision et suivi des stagiaires
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Statistiques */}
        <div className="flex justify-center mb-8">
          <div className="bg-white/90 backdrop-blur-sm p-6 rounded-lg shadow-lg border border-blue-200">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-base font-medium text-gray-600">Total stagiaires</p>
                <p className="text-2xl font-bold text-gray-900">{stagiaires.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Liste des stagiaires */}
        <div className="bg-blue-50 shadow rounded-lg">
          <div className="px-6 py-4 border-b border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Liste des stagiaires
                </h3>
                {user?.section && (
                  <span className="text-sm text-blue-700 font-medium">
                    Section: {user.section}
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowAddForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Ajouter un stagiaire
              </button>
            </div>
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
                        </div>
                        <p className="text-sm text-gray-500">{stagiaire.email}</p>
                        {stagiaire.section && (
                          <p className="text-xs text-gray-500 mt-1">
                            Section: <span className="font-medium">{stagiaire.section}</span>
                          </p>
                        )}
                        {stagiaire.derniereActivite && (
                          <p className="text-xs text-gray-400">
                            Dernière activité: {formatDateTime(stagiaire.derniereActivite)}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-6">
                      {(stagiaire.nbPatients > 0 || stagiaire.nbActions > 0) && (
                        <>
                          {stagiaire.nbPatients > 0 && (
                            <div className="text-center">
                              <p className="text-sm font-medium text-gray-900">{stagiaire.nbPatients}</p>
                              <p className="text-xs text-gray-500">Patients</p>
                            </div>
                          )}
                          {stagiaire.nbActions > 0 && (
                            <div className="text-center">
                              <p className="text-sm font-medium text-gray-900">{stagiaire.nbActions}</p>
                              <p className="text-xs text-gray-500">Actions</p>
                            </div>
                          )}
                        </>
                      )}
                      <div className="flex space-x-2">
                        <Link
                          to={`/formateur/stagiaires/${stagiaire.id}`}
                          className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-blue-700 transition-colors"
                        >
                          Voir détails
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

      {/* Modal formulaire d'ajout de stagiaire */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Ajouter un nouveau stagiaire</h3>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setFormData({
                    email: '',
                    password: '',
                    prenom: '',
                    nom: '',
                    typeStagiaire: '',
                    section: ''
                  });
                  setSubmitError('');
                  setSubmitSuccess(false);
                }}
                className="p-2 rounded hover:bg-gray-100"
              >
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {submitSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded">
                  Stagiaire créé avec succès !
                </div>
              )}
              
              {submitError && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
                  {submitError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Prénom */}
                <div>
                  <label htmlFor="prenom" className="block text-sm font-medium text-gray-700 mb-1">
                    Prénom <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="prenom"
                    name="prenom"
                    value={formData.prenom}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Prénom du stagiaire"
                  />
                </div>

                {/* Nom */}
                <div>
                  <label htmlFor="nom" className="block text-sm font-medium text-gray-700 mb-1">
                    Nom <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="nom"
                    name="nom"
                    value={formData.nom}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nom du stagiaire"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="email@example.com"
                />
              </div>

              {/* Mot de passe */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Mot de passe <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Minimum 6 caractères"
                />
                <p className="mt-1 text-xs text-gray-500">Le mot de passe doit contenir au moins 6 caractères</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Type de stagiaire */}
                <div>
                  <label htmlFor="typeStagiaire" className="block text-sm font-medium text-gray-700 mb-1">
                    Type de stagiaire
                  </label>
                  <select
                    id="typeStagiaire"
                    name="typeStagiaire"
                    value={formData.typeStagiaire}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sélectionner un type</option>
                    <option value="SECRETAIRE_MEDICAL">Secrétaire médical</option>
                    <option value="AMA">Assistant médico-administratif (AMA)</option>
                    <option value="AUTRE">Autre type de stagiaire</option>
                  </select>
                </div>

                {/* Section */}
                <div>
                  <label htmlFor="section" className="block text-sm font-medium text-gray-700 mb-1">
                    Section de formation
                  </label>
                  <input
                    type="text"
                    id="section"
                    name="section"
                    value={formData.section}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: BTS, BAC PRO, etc."
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setFormData({
                      email: '',
                      password: '',
                      prenom: '',
                      nom: '',
                      typeStagiaire: '',
                      section: ''
                    });
                    setSubmitError('');
                    setSubmitSuccess(false);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  disabled={submitting}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Création...' : 'Créer le stagiaire'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Stagiaires;