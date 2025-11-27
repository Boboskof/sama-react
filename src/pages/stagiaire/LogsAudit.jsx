import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import formateurService from '../../_services/formateur.service';
import auditService from '../../_services/audit.service';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';

const LogsAudit = () => {
  const [logs, setLogs] = useState([]);
  const [stagiaires, setStagiaires] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [filters, setFilters] = useState({
    userId: undefined,
    action: undefined,
    entityType: undefined,
    dateDebut: undefined,
    dateFin: undefined,
    page: 1,
    limit: 30
  });
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    totalPages: 1
  });

  // Boutons rapides pour les filtres
  const quickFilters = [
    { label: 'Aujourd\'hui', action: () => {
      const today = new Date().toISOString().split('T')[0];
      const isActive = filters.dateDebut === today && filters.dateFin === today;
      setFilters(f => ({ 
        ...f, 
        dateDebut: isActive ? undefined : today, 
        dateFin: isActive ? undefined : today,
        page: 1
      }));
    }},
    { label: 'Cette semaine', action: () => {
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const weekStartStr = weekStart.toISOString().split('T')[0];
      const weekEndStr = weekEnd.toISOString().split('T')[0];
      const isActive = filters.dateDebut === weekStartStr && filters.dateFin === weekEndStr;
      setFilters(f => ({ 
        ...f, 
        dateDebut: isActive ? undefined : weekStartStr, 
        dateFin: isActive ? undefined : weekEndStr,
        page: 1
      }));
    }},
    { label: 'Créations', action: () => {
      const isActive = filters.action === 'CREATE';
      setFilters(f => ({ 
        ...f, 
        action: isActive ? undefined : 'CREATE',
        page: 1
      }));
    }},
    { label: 'Modifications', action: () => {
      const isActive = filters.action === 'UPDATE';
      setFilters(f => ({ 
        ...f, 
        action: isActive ? undefined : 'UPDATE',
        page: 1
      }));
    }},
    { label: 'Suppressions', action: () => {
      const isActive = filters.action === 'DELETE';
      setFilters(f => ({ 
        ...f, 
        action: isActive ? undefined : 'DELETE',
        page: 1
      }));
    }},
    { label: 'Tous', action: () => {
      setFilters(f => ({ 
        ...f, 
        userId: undefined,
        action: undefined,
        entityType: undefined,
        dateDebut: undefined,
        dateFin: undefined,
        page: 1
      }));
    }}
  ];

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [logsData, stagiairesData] = await Promise.all([
          formateurService.getLogsAudit(filters),
          formateurService.getAllStagiaires()
        ]);
        
        setLogs(logsData.logs);
        setPagination({
          total: logsData.total,
          page: logsData.page,
          totalPages: logsData.totalPages
        });
        setStagiaires(stagiairesData);
      } catch (err) {
        console.error('Erreur chargement logs:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [filters]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1 // Reset to first page when filters change
    }));
  };

  const handlePageChange = (newPage) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('fr-FR');
  };

  const getActionIcon = (action) => {
    return auditService.getActionIcon(action);
  };

  const getActionIconClass = (action) => {
    const color = auditService.getActionColor(action);
    return `audit-icon-${color}`;
  };

  const getActionRowClass = (action) => {
    const color = auditService.getActionColor(action);
    return `audit-row-${color}`;
  };

  const getActionBadgeClass = (action) => {
    const color = auditService.getActionColor(action);
    return `audit-badge-${color}`;
  };

  const getPatientName = (log) => {
    const metaName = log?.payload?.metadata?.patient_name;
    if (metaName && String(metaName).trim()) return metaName;
    const entityLabel = log?.entityLabel;
    if (entityLabel && String(entityLabel).trim()) return entityLabel;
    const fullName = log?.patient?.fullName;
    if (fullName && String(fullName).trim()) return fullName;
    const prenom = (log?.payload?.after?.prenom || log?.payload?.before?.prenom || '').trim();
    const nom = (log?.payload?.after?.nom || log?.payload?.before?.nom || '').trim();
    const composed = `${nom} ${prenom}`.trim(); // Format: "nom prénom"
    if (composed) return composed;
    return null;
  };

  const exportCSV = async () => {
    try {
      await formateurService.exporterLogsCSV(filters);
    } catch (err) {
      console.error('Erreur export CSV:', err);
    }
  };

  const exportJSON = async () => {
    try {
      await formateurService.exporterLogsJSON(filters);
    } catch (err) {
      console.error('Erreur export JSON:', err);
    }
  };

  const showLogDetails = async (log) => {
    try {
      setDetailLoading(true);
      const full = await auditService.getOneAuditLog(log.id);
      setSelectedLog(full);
    } catch (e) {
      setSelectedLog(log);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeLogDetails = () => setSelectedLog(null);

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
              <p className="text-gray-600">Suivi des activités des stagiaires</p>
            </div>
            <div className="flex space-x-4">
              <Link
                to="/formateur/dashboard"
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Retour au dashboard
              </Link>
              <button
                onClick={exportCSV}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                Exporter CSV
              </button>
              <button
                onClick={exportJSON}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Exporter JSON
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6">
            <ErrorMessage 
              message={error} 
              title="Erreur de chargement"
              dismissible={true}
              onDismiss={() => setError(null)}
            />
          </div>
        )}
        {/* Bandeau résumé */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-blue-50 rounded-lg shadow p-4 text-center">
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-2xl font-semibold text-gray-900">{pagination.total}</p>
          </div>
          <div className="bg-blue-50 rounded-lg shadow p-4 text-center">
            <p className="text-xs text-gray-500">Page</p>
            <p className="text-2xl font-semibold text-gray-900">{pagination.page}/{pagination.totalPages}</p>
          </div>
          <div className="bg-blue-50 rounded-lg shadow p-4 text-center">
            <p className="text-xs text-gray-500">Affichés</p>
            <p className="text-2xl font-semibold text-gray-900">{logs.length}</p>
          </div>
        </div>

        {/* Filtres */}
        <div className="bg-blue-50 rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-blue-200">
            <h3 className="text-lg font-medium text-gray-900">Filtres</h3>
          </div>
          <div className="p-6">
            {/* Boutons rapides */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Filtres rapides</h4>
              <div className="flex flex-wrap gap-2">
                {quickFilters.map((filter, index) => (
                  <button
                    key={index}
                    onClick={filter.action}
                    className="px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Stagiaire */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stagiaire
                </label>
                <select
                  value={filters.userId || ''}
                  onChange={(e) => handleFilterChange('userId', e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Tous les stagiaires</option>
                  {stagiaires.map((stagiaire) => (
                    <option key={stagiaire.id} value={stagiaire.id}>
                      {stagiaire.prenom} {stagiaire.nom}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Action
                </label>
                <select
                  value={filters.action || ''}
                  onChange={(e) => handleFilterChange('action', e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Toutes les actions</option>
                  <option value="CREATE">CREATE</option>
                  <option value="UPDATE">UPDATE</option>
                  <option value="DELETE">DELETE</option>
                  <option value="LOGIN">LOGIN</option>
                  <option value="LOGOUT">LOGOUT</option>
                  <option value="VIEW">VIEW</option>
                </select>
              </div>

              {/* Type d'entité */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Entité
                </label>
                <select
                  value={filters.entityType || ''}
                  onChange={(e) => handleFilterChange('entityType', e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Toutes les entités</option>
                  <option value="Patient">Patient</option>
                  <option value="User">User</option>
                  <option value="Appointment">Appointment</option>
                  <option value="Document">Document</option>
                </select>
              </div>

              {/* Date début */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date début
                </label>
                <input
                  type="date"
                  value={filters.dateDebut || ''}
                  onChange={(e) => handleFilterChange('dateDebut', e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Date fin */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date fin
                </label>
                <input
                  type="date"
                  value={filters.dateFin || ''}
                  onChange={(e) => handleFilterChange('dateFin', e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-between">
              <button
                onClick={() => setFilters({
                  user_id: '',
                  action: '',
                  entity_type: '',
                  date_debut: '',
                  date_fin: '',
                  page: 1,
                  limit: 50
                })}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Réinitialiser
              </button>
              <p className="text-sm text-gray-500">
                {pagination.total} logs trouvés
              </p>
            </div>
          </div>
        </div>

        {/* Liste des logs */}
        <div className="bg-blue-50 shadow rounded-lg">
          <div className="px-6 py-4 border-b border-blue-200">
            <h3 className="text-lg font-medium text-gray-900">
              Logs d'audit ({logs.length})
            </h3>
          </div>
          
          {logs.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {logs.map((log, index) => (
                <div
                  key={log.id || `${log.entity_id || log.entityId || 'log'}-${index}`}
                  className={`px-6 py-4 hover:bg-gray-50 cursor-pointer ${getActionRowClass(log.action)}`}
                  onClick={() => showLogDetails(log)}
                >
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <span className={`material-symbols-rounded text-2xl ${getActionIconClass(log.action)}`}>
                        {getActionIcon(log.action)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {log.user?.full_name || (log.user?.prenom || log.user?.nom ? `${log.user.prenom || ''} ${log.user.nom || ''}`.trim() : 'Anonyme')}
                          </p>
                          <p className="text-sm text-gray-500">{log.user?.email}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionBadgeClass(log.action)}`}>
                            {log.action}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatDate(log.created_at)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="mt-2">
                        {log.message && (
                          <p className="text-sm text-gray-900">{log.message}</p>
                        )}
                        {log.entity_type === 'Patient' && (
                          <p className="text-sm text-gray-600">
                            <strong>Patient:</strong>{' '}
                            {getPatientName(log) || '—'}
                          </p>
                        )}
                        <p className="text-sm text-gray-600">
                          <strong>Entité:</strong> {log.entity_type} (ID: {log.entity_id})
                        </p>
                        <p className="text-sm text-gray-600">
                          <strong>IP:</strong> {log.ip}
                        </p>
                        {log.payload && (
                          <details className="mt-2">
                            <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                              Voir les détails
                            </summary>
                            <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                              {JSON.stringify(log.payload, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <div className="text-gray-400 text-4xl mb-4">📋</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun log trouvé</h3>
              <p className="text-gray-500">
                Aucun log ne correspond aux filtres sélectionnés.
              </p>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Page {pagination.page} sur {pagination.totalPages}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Précédent
                  </button>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Modal détails du log */}
        {selectedLog && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Détails du log d'audit</h3>
                  <button onClick={closeLogDetails} className="text-gray-400 hover:text-gray-600" disabled={detailLoading}>
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
                      <p className="text-sm text-gray-900">{selectedLog.action}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Entité</label>
                      <p className="text-sm text-gray-900">{selectedLog.entityType || selectedLog.entity_type}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">ID Entité</label>
                      <p className="text-sm text-gray-900 font-mono">{selectedLog.entityId || selectedLog.entity_id || '—'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Date</label>
                      <p className="text-sm text-gray-900">{formatDate(selectedLog.createdAt || selectedLog.created_at)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">IP</label>
                      <p className="text-sm text-gray-900 font-mono">{selectedLog.ip || 'Non disponible'}</p>
                    </div>
                  </div>

                  {selectedLog.user && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Utilisateur</label>
                      <p className="text-sm text-gray-900">
                        {selectedLog.user.full_name || `${selectedLog.user.prenom || ''} ${selectedLog.user.nom || ''}`.trim()} ({selectedLog.user.email})
                      </p>
                    </div>
                  )}

                  {(selectedLog.entityType === 'Patient' || selectedLog.entity_type === 'Patient') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Patient</label>
                      <p className="text-sm text-gray-900">
                        {getPatientName(selectedLog) || '—'}
                      </p>
                    </div>
                  )}

                  {selectedLog.message && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                      <div className="bg-gray-50 p-3 rounded-md text-[15px] font-serif leading-relaxed text-gray-900">{selectedLog.message}</div>
                    </div>
                  )}
                  {selectedLog.payload && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Détails</label>
                      <div className="bg-gray-50 p-4 rounded-md">
                        <pre className="text-xs text-gray-800 whitespace-pre-wrap">{JSON.stringify(selectedLog.payload, null, 2)}</pre>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end">
                  <button onClick={closeLogDetails} className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors" disabled={detailLoading}>
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LogsAudit;
