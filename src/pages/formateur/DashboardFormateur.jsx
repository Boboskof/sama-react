import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import formateurService from '../../_services/formateur.service';
import auditService from '../../_services/audit.service';
import userService from '../../_services/user.service';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatCard from '../../components/StatCard';
import { formatDateTime } from '../../utils/dateHelpers';

const DashboardFormateur = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // États pour la gestion des stagiaires
  const [stagiaires, setStagiaires] = useState([]);
  const [stagiairesLoading, setStagiairesLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 30;
  
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
      setStagiairesLoading(true);
      const data = await formateurService.getAllStagiaires();
      const normalized = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
      setStagiaires(normalized);
    } catch (err) {
      console.error('Erreur chargement stagiaires:', err);
      setStagiaires([]);
    } finally {
      setStagiairesLoading(false);
    }
  };

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        // Charger l'utilisateur courant (avec fallback localStorage)
        const storedUser = userService.getUser?.() || null;
        if (storedUser) setUser(storedUser);
        const currentUser = await userService.getCurrentUser().catch(() => storedUser || null);
        setUser(currentUser);
        
        const [dashResult, statsResult] = await Promise.allSettled([
          formateurService.getDashboardData(),
          auditService.getStatisticsByPeriod('day', {})
        ]);

        const dashboard = dashResult.status === 'fulfilled' ? (dashResult.value || {}) : {
          totalStagiaires: 0,
          totalPatients: 0,
          totalActions: 0,
          activiteAujourdhui: 0,
          topStagiaires: [],
          alertes: [],
          evolutionActivite: [],
          repartitionActions: []
        };

        const auditStats = statsResult.status === 'fulfilled' ? (statsResult.value || {}) : {};

        const enrichedData = { ...dashboard, auditStats };
        setDashboardData(enrichedData);
        setError(null);
      } catch (err) {
        setError('Impossible de charger les données du dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
    loadStagiaires();
  }, []);

  const handleSubmitStagiaire = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    setSubmitSuccess(false);

    try {
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
      
      await loadStagiaires();
      
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
    setSubmitError('');
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
  if (!dashboardData) return <div className="text-center p-4">Aucune donnée disponible</div>;

  return (
    <div className="space-y-6 bg-indigo-100 min-h-screen w-[95%] md:w-[90%] lg:w-[80%] mx-auto px-2 md:px-4 py-6">
      {/* Titre centré avec icône et description (style global) */}
      <div className="text-center py-6 mb-0">
        <div className="bg-blue-200 rounded-lg shadow p-6 max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center shadow-sm">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-blue-800">Tableau de Bord</h1>
          </div>
          <p className="text-blue-700 text-sm">
            Supervision des stagiaires et analyse des activités
          </p>
        </div>
      </div>

      {/* Header style identique au Tableau de bord stagiaire */}
      <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold text-indigo-600">
                {user?.prenom?.[0] || 'F'}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Bonjour formateur {user?.prenom} {user?.nom}
              </h1>
              <p className="text-gray-600">Espace formateur — supervision et analyse</p>
              <p className="text-sm text-gray-500">
                Dernière connexion : {new Date().toLocaleString('fr-FR')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-2 md:px-4 py-8">
        {/* Statistiques générales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon="users"
            label="Stagiaires actifs"
            value={dashboardData.totalStagiaires}
            color="indigo"
          />
          <StatCard
            icon="users"
            label="Patients créés"
            value={dashboardData.totalPatients}
            color="green"
          />
          <StatCard
            icon="chart"
            label="Actions totales"
            value={dashboardData.totalActions}
            color="purple"
          />
          <StatCard
            icon="lightning"
            label="Activité aujourd'hui"
            value={dashboardData.activiteAujourdhui}
            color="orange"
          />
        </div>

        {/* Section Gestion des Stagiaires */}
        <div className="mb-8">
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
            
            {stagiairesLoading ? (
              <div className="px-6 py-12 text-center">
                <LoadingSpinner />
              </div>
            ) : filteredStagiaires.length > 0 ? (
              <>
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
              </>
            ) : (
              <div className="px-6 py-12 text-center">
                <div className="text-gray-400 text-4xl mb-4">👥</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun stagiaire trouvé</h3>
                <p className="text-gray-500">
                  {searchTerm ? 'Aucun stagiaire ne correspond à votre recherche.' : 'Aucun stagiaire enregistré.'}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Top stagiaires */}
          {/* <div className="bg-blue-50 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-blue-200">
              <h3 className="text-lg font-medium text-gray-900">Top stagiaires</h3>
              <p className="text-sm text-gray-500">Classement par activité</p>
            </div>
            <div className="p-6">
              {(dashboardData.topStagiaires?.length ?? 0) > 0 ? (
                <div className="space-y-4">
                  {(dashboardData.topStagiaires ?? []).map((item, index) => (
                    <div key={item.stagiaire.id} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-600">#{index + 1}</span>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">
                            {item.stagiaire.prenom} {item.stagiaire.nom}
                          </p>
                          <p className="text-sm text-gray-500">{item.nbActions} actions</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">{item.progression}%</p>
                        <p className="text-xs text-gray-500">progression</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">Aucun stagiaire actif</p>
              )}
            </div>
          </div> */}

          {/* Alertes récentes - TEMPORAIREMENT DÉSACTIVÉ */}
          {/* <div className="bg-blue-50 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-blue-200">
              <h3 className="text-lg font-medium text-gray-900">Alertes récentes</h3>
              <p className="text-sm text-gray-500">Notifications importantes</p>
            </div>
            <div className="p-6">
              {(dashboardData.alertes?.length ?? 0) > 0 ? (
                <div className="space-y-4">
                  {(dashboardData.alertes ?? []).slice(0, 5).map((alerte) => (
                    <div key={alerte.id} className={`p-3 rounded-lg border-l-4 ${
                      alerte.type === 'error' ? 'border-red-400 bg-red-50' :
                      alerte.type === 'warning' ? 'border-yellow-400 bg-yellow-50' :
                      'border-blue-400 bg-blue-50'
                    }`}>
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <span className={`text-sm ${
                            alerte.type === 'error' ? 'text-red-600' :
                            alerte.type === 'warning' ? 'text-yellow-600' :
                            'text-blue-600'
                          }`}>
                            {alerte.type === 'error' ? '🚨' : alerte.type === 'warning' ? '⚠️' : 'ℹ️'}
                          </span>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">{alerte.titre}</p>
                          <p className="text-sm text-gray-600">{alerte.description}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(alerte.created_at).toLocaleString('fr-FR')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">Aucune alerte récente</p>
              )}
            </div>
          </div> */}
        </div>

        {/* Graphiques - TEMPORAIREMENT DÉSACTIVÉ */}
        {/* <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Évolution de l'activité */}
          {/* <div className="bg-blue-50 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-blue-200">
              <h3 className="text-lg font-medium text-gray-900">Évolution de l'activité</h3>
              <p className="text-sm text-gray-500">7 derniers jours</p>
            </div>
            <div className="p-6">
              {(dashboardData.evolutionActivite?.length ?? 0) > 0 ? (
                <div className="h-64 flex items-center justify-center">
                  <p className="text-gray-500">Graphique d'évolution (à implémenter)</p>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">Aucune donnée d'activité</p>
              )}
            </div>
          </div> */}

          {/* Répartition des actions */}
          {/* <div className="bg-blue-50 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-blue-200">
              <h3 className="text-lg font-medium text-gray-900">Répartition des actions</h3>
              <p className="text-sm text-gray-500">Par type d'action</p>
            </div>
            <div className="p-6">
              {(dashboardData.repartitionActions?.length ?? 0) > 0 ? (
                <div className="h-64 flex items-center justify-center">
                  <p className="text-gray-500">Graphique de répartition (à implémenter)</p>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">Aucune donnée de répartition</p>
              )}
            </div>
          </div>
        </div> */}

        {/* Section Audit */}
        <div className="mt-8 bg-green-50 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-green-200">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Surveillance d'audit</h3>
                <p className="text-sm text-gray-500">Activité récente des stagiaires</p>
              </div>
              <Link
                to="/formateur/logs"
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                Voir tous les logs
              </Link>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {dashboardData.auditStats?.total_actions_today || 0}
                </div>
                <div className="text-sm text-gray-500">Actions aujourd'hui</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {dashboardData.auditStats?.active_users_today || 0}
                </div>
                <div className="text-sm text-gray-500">Utilisateurs actifs</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {dashboardData.auditStats?.most_common_action || '—'}
                </div>
                <div className="text-sm text-gray-500">Action la plus fréquente</div>
              </div>
            </div>
          </div>
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
            
            <form onSubmit={handleSubmitStagiaire} className="p-6 space-y-4">
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <LoadingSpinner color="white" size="small" inline={true} />
                      Création...
                    </>
                  ) : (
                    'Créer le stagiaire'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardFormateur;