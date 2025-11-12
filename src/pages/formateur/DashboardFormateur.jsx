import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import formateurService from '../../_services/formateur.service';
import auditService from '../../_services/audit.service';
import userService from '../../_services/user.service';
import LoadingSpinner from '../../components/LoadingSpinner';

const DashboardFormateur = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

        const dashboard = dashResult.status === 'fulfilled' ? dashResult.value : {
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
        console.error('Erreur chargement dashboard formateur:', err);
        setError('Impossible de charger les données du dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-500 text-center p-4">{error}</div>;
  if (!dashboardData) return <div className="text-center p-4">Aucune donnée disponible</div>;

  return (
    <div className="space-y-6 bg-indigo-100 min-h-screen p-6">
      {/* Titre centré avec icône et description (style global) */}
      <div className="text-center py-6 mb-0">
        <div className="bg-indigo-200 rounded-lg shadow p-6 max-w-xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center shadow-sm">
              <span className="material-symbols-rounded text-indigo-600 text-2xl">dashboard</span>
            </div>
            <h1 className="text-2xl font-bold text-indigo-800">Tableau de Bord</h1>
          </div>
          <p className="text-indigo-700 text-sm">
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistiques générales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-blue-50 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 text-sm font-medium">👥</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Stagiaires actifs</p>
                <p className="text-2xl font-semibold text-gray-900">{dashboardData.totalStagiaires}</p>
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
                <p className="text-2xl font-semibold text-gray-900">{dashboardData.totalPatients}</p>
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
                <p className="text-2xl font-semibold text-gray-900">{dashboardData.totalActions}</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                  <span className="text-orange-600 text-sm font-medium">⚡</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Activité aujourd'hui</p>
                <p className="text-2xl font-semibold text-gray-900">{dashboardData.activiteAujourdhui}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Top stagiaires */}
          <div className="bg-blue-50 rounded-lg shadow">
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
          </div>

          {/* Alertes récentes */}
          <div className="bg-blue-50 rounded-lg shadow">
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
          </div>
        </div>

        {/* Graphiques */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Évolution de l'activité */}
          <div className="bg-blue-50 rounded-lg shadow">
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
          </div>

          {/* Répartition des actions */}
          <div className="bg-blue-50 rounded-lg shadow">
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
        </div>

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
    </div>
  );
};

export default DashboardFormateur;
