import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import auditService from '../../_services/audit.service';
import LoadingSpinner from '../../components/LoadingSpinner';
import { UIAuditFilters } from '../../_services/query/audit.query';

const LogsAudit = () => {
  const [searchParams] = useSearchParams();
  const [logs, setLogs] = useState([]);
  const [statistics, setStatistics] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({});
  const [selectedLog, setSelectedLog] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Filtres (structure simplifiée avec UIAuditFilters)
  const [filters, setFilters] = useState<UIAuditFilters>({
    action: searchParams.get('action') || undefined,
    search: searchParams.get('search') || undefined,
    date_from: searchParams.get('date_from') || undefined,
    date_to: searchParams.get('date_to') || undefined,
    user_id: searchParams.get('user_id') || undefined,
    page: parseInt(searchParams.get('page')) || 1,
    limit: 50
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      const [logsData, userStats, actionStats, entityStats] = await Promise.all([
        auditService.getAuditLogs(filters),
        auditService.getStatisticsByUser(filters),
        auditService.getStatisticsByAction(filters),
        auditService.getStatisticsByEntity(filters)
      ]);

      const normalizedLogs = (Array.isArray(logsData) ? logsData : []).map((log) => ({
        ...log,
        action: log.action || log.action_type || log.type,
        entityType: log.entityType || log.entity_type || log.entity,
        entityId: log.entityId || log.entity_id,
        createdAt: log.createdAt || log.created_at || log.date || log.timestamp,
        ip: log.ip || log.ip_address || log.payload?.metadata?.ip_address || log.metadata?.ip_address,
        user: log.user || (log.user_id || log.user_email || log.user_prenom || log.user_nom
          ? {
              id: log.user_id,
              email: log.user_email,
              prenom: log.user_prenom,
              nom: log.user_nom,
            }
          : undefined),
      }));

      setLogs(normalizedLogs);
      setStatistics({
        users: Array.isArray(userStats) ? userStats : [],
        actions: Array.isArray(actionStats) ? actionStats : [],
        entities: Array.isArray(entityStats) ? entityStats : []
      });
      
      // Simuler la pagination si l'API ne la retourne pas
      setPagination({
        page: filters.page,
        pages: Math.ceil((Array.isArray(logsData) ? logsData.length : 0) / filters.limit),
        total: Array.isArray(logsData) ? logsData.length : 0
      });
    } catch (err) {
      console.error('Erreur chargement logs audit:', err);
      setError('Impossible de charger les logs d\'audit');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1 // Reset à la première page lors d'un changement de filtre
    }));
  };

  const handlePageChange = (newPage) => {
    setFilters(prev => ({
      ...prev,
      page: newPage
    }));
  };

  const showLogDetails = async (log) => {
    try {
      setDetailLoading(true);
      const full = await auditService.getOneAuditLog(log.id);
      const normalized = {
        ...full,
        action: full.action || full.action_type || full.type,
        entityType: full.entityType || full.entity_type || full.entity,
        entityId: full.entityId || full.entity_id,
        createdAt: full.createdAt || full.created_at || full.date || full.timestamp,
        ip: full.ip || full.ip_address || full.payload?.metadata?.ip_address || full.metadata?.ip_address,
        user: full.user || (full.user_id || full.user_email || full.user_prenom || full.user_nom
          ? {
              id: full.user_id,
              email: full.user_email,
              prenom: full.user_prenom,
              nom: full.user_nom,
            }
          : undefined),
      };
      setSelectedLog(normalized);
    } catch (e) {
    setSelectedLog(log);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeLogDetails = () => {
    setSelectedLog(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString('fr-FR');
  };

  const getActionColor = (action) => {
    return auditService.getActionColor(action);
  };

  const getActionLabel = (action) => {
    return auditService.getActionLabel(action);
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
              <h1 className="text-3xl font-bold text-blue-800">Logs d'audit</h1>
              <p className="text-gray-600">Suivi de l'activité des stagiaires</p>
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filtres */}
        <div className="bg-blue-50 rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Filtres</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Action</label>
              <select
                value={filters.action}
                onChange={(e) => handleFilterChange('action', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Toutes les actions</option>
                <option value="CREATE">Création</option>
                <option value="UPDATE">Modification</option>
                <option value="DELETE">Suppression</option>
                <option value="LOGIN">Connexion</option>
                <option value="LOGOUT">Déconnexion</option>
                <option value="API_REQUEST">Requête API</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Recherche</label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Utilisateur, entité..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date de début</label>
              <input
                type="date"
                value={filters.date_from}
                onChange={(e) => handleFilterChange('date_from', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date de fin</label>
              <input
                type="date"
                value={filters.date_to}
                onChange={(e) => handleFilterChange('date_to', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-blue-50 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 text-sm font-medium">👥</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Utilisateurs actifs</p>
                <p className="text-2xl font-semibold text-gray-900">{statistics.users?.length || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 text-sm font-medium">📊</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total des actions</p>
                <p className="text-2xl font-semibold text-gray-900">{pagination.total || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-purple-600 text-sm font-medium">🔧</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Types d'actions</p>
                <p className="text-2xl font-semibold text-gray-900">{statistics.actions?.length || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                  <span className="text-orange-600 text-sm font-medium">🏗️</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Entités modifiées</p>
                <p className="text-2xl font-semibold text-gray-900">{statistics.entities?.length || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Top utilisateurs */}
        {statistics.users && statistics.users.length > 0 && (
          <div className="bg-blue-50 rounded-lg shadow mb-6">
            <div className="px-6 py-4 border-b border-blue-200">
              <h3 className="text-lg font-medium text-gray-900">Top utilisateurs les plus actifs</h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {statistics.users.slice(0, 5).map((user, index) => (
                  <div key={user.id} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-600">#{index + 1}</span>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">
                          {user.prenom} {user.nom}
                        </p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">{user.total_actions} actions</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Logs d'audit */}
        <div className="bg-blue-50 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-blue-200">
            <h3 className="text-lg font-medium text-gray-900">Logs d'audit récents</h3>
            <p className="text-sm text-gray-500">{pagination.total} logs trouvés</p>
          </div>
          
          {logs.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="text-gray-400 text-4xl mb-4">📋</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun log d'audit trouvé</h3>
              <p className="text-gray-500">Aucun log ne correspond aux critères de recherche.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Utilisateur
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Entité
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Message
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      IP
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.map((log, index) => (
                    <tr
                      key={log.id || `${log.entityId || log.entity_id || 'log'}-${index}`}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => showLogDetails(log)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        {log.user ? (
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {log.user.prenom} {log.user.nom}
                            </div>
                            <div className="text-sm text-gray-500">{log.user.email}</div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500 italic">Anonyme</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-${getActionColor(log.action)}-100 text-${getActionColor(log.action)}-800`}>
                          {getActionLabel(log.action)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {auditService.formatEntityType(log.entityType)}
                        </div>
                        {log.entityId && (
                          <div className="text-sm text-gray-500 font-mono">
                            {log.entityId.substring(0, 8)}...
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate">
                        {log.message || (log.payload && log.payload.message) || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {log.ip || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => showLogDetails(log)}
                          disabled={detailLoading}
                          className="text-blue-600 hover:text-blue-900 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {detailLoading ? 'Chargement…' : 'Voir détails'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Précédent
                </button>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.pages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Suivant
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Page <span className="font-medium">{pagination.page}</span> sur{' '}
                    <span className="font-medium">{pagination.pages}</span>
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Précédent
                    </button>
                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.pages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Suivant
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal détails du log */}
      {selectedLog && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Détails du log d'audit</h3>
                <button
                  onClick={closeLogDetails}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Fermer</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">ID</label>
                    <p className="text-sm text-gray-900 font-mono">{selectedLog.id}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Action</label>
                    <p className="text-sm text-gray-900">{getActionLabel(selectedLog.action)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Entité</label>
                    <p className="text-sm text-gray-900">{selectedLog.entityType}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">ID Entité</label>
                    <p className="text-sm text-gray-900 font-mono">{selectedLog.entityId || '—'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Date</label>
                    <p className="text-sm text-gray-900">{formatDate(selectedLog.createdAt)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">IP</label>
                    <p className="text-sm text-gray-900 font-mono">{selectedLog.ip || 'Non disponible'}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Message</label>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">
                    {selectedLog.message || (selectedLog.payload && selectedLog.payload.message) || '—'}
                  </p>
                </div>

                {selectedLog.user && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Utilisateur</label>
                    <p className="text-sm text-gray-900">
                      {selectedLog.user.prenom} {selectedLog.user.nom} ({selectedLog.user.email})
                    </p>
                  </div>
                )}

                {selectedLog.payload && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Détails</label>
                    <div className="bg-gray-50 p-4 rounded-md">
                      <pre className="text-xs text-gray-800 whitespace-pre-wrap">
                        {JSON.stringify(selectedLog.payload, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={closeLogDetails}
                  className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogsAudit;


