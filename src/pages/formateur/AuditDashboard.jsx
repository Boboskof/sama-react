import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import auditService from '../../_services/audit.service';
import LoadingSpinner from '../../components/LoadingSpinner';

const AuditDashboard = () => {
  const [statistics, setStatistics] = useState({});
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('day');

  const loadAuditData = useCallback(async () => {
    try {
      setLoading(true);
      
      const [userStats, actionStats, entityStats, periodStats, recentLogsData] = await Promise.all([
        auditService.getStatisticsByUser({}),
        auditService.getStatisticsByAction({}),
        auditService.getStatisticsByEntity({}),
        auditService.getStatisticsByPeriod(timeRange, {}),
        auditService.getAuditLogs({ limit: 10 })
      ]);

      setStatistics({
        users: userStats || [],
        actions: actionStats || [],
        entities: entityStats || [],
        period: periodStats || {}
      });
      
      setRecentLogs(Array.isArray(recentLogsData) ? recentLogsData : []);
    } catch (err) {
      console.error('Erreur chargement données audit:', err);
      setError('Impossible de charger les données d\'audit');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    loadAuditData();
  }, [loadAuditData]);

  const handleTimeRangeChange = (newRange) => {
    setTimeRange(newRange);
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
      <div className="bg-green-200 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-green-800">Tableau de bord d'audit</h1>
              <p className="text-gray-600">Surveillance et analyse de l'activité des stagiaires</p>
            </div>
            <div className="flex space-x-4">
              <select
                value={timeRange}
                onChange={(e) => handleTimeRangeChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="day">Aujourd'hui</option>
                <option value="week">Cette semaine</option>
                <option value="month">Ce mois</option>
                <option value="year">Cette année</option>
              </select>
              <Link
                to="/formateur/dashboard"
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Retour au dashboard
              </Link>
              <Link
                to="/formateur/logs"
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                Voir tous les logs
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistiques générales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-green-50 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 text-sm font-medium">👥</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Utilisateurs actifs</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {statistics.users?.length || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 text-sm font-medium">📊</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Actions totales</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {statistics.period?.total_actions || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-purple-600 text-sm font-medium">🔧</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Types d'actions</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {statistics.actions?.length || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                  <span className="text-orange-600 text-sm font-medium">🏗️</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Entités modifiées</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {statistics.entities?.length || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Top utilisateurs */}
          <div className="bg-green-50 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-green-200">
              <h3 className="text-lg font-medium text-gray-900">Top utilisateurs les plus actifs</h3>
              <p className="text-sm text-gray-500">Classement par nombre d'actions</p>
            </div>
            <div className="p-6">
              {statistics.users && statistics.users.length > 0 ? (
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
                        <p className="text-sm font-medium text-gray-900">{user.total_actions}</p>
                        <p className="text-xs text-gray-500">actions</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">Aucune donnée d'utilisateur</p>
              )}
            </div>
          </div>

          {/* Répartition des actions */}
          <div className="bg-green-50 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-green-200">
              <h3 className="text-lg font-medium text-gray-900">Répartition des actions</h3>
              <p className="text-sm text-gray-500">Par type d'action</p>
            </div>
            <div className="p-6">
              {statistics.actions && statistics.actions.length > 0 ? (
                <div className="space-y-3">
                  {statistics.actions.map((action) => (
                    <div key={action.action} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-${getActionColor(action.action)}-100 text-${getActionColor(action.action)}-800 mr-3`}>
                          {getActionLabel(action.action)}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">{action.count}</p>
                        <p className="text-xs text-gray-500">actions</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">Aucune donnée d'action</p>
              )}
            </div>
          </div>
        </div>

        {/* Entités les plus modifiées */}
        {statistics.entities && statistics.entities.length > 0 && (
          <div className="mt-8 bg-green-50 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-green-200">
              <h3 className="text-lg font-medium text-gray-900">Entités les plus modifiées</h3>
              <p className="text-sm text-gray-500">Par type d'entité</p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {statistics.entities.map((entity) => (
                  <div key={entity.entity_type} className="text-center p-4 bg-white rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{entity.count}</div>
                    <div className="text-sm text-gray-500">
                      {auditService.formatEntityType(entity.entity_type)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Logs récents */}
        <div className="mt-8 bg-green-50 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-green-200">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Activité récente</h3>
                <p className="text-sm text-gray-500">10 dernières actions</p>
              </div>
              <Link
                to="/formateur/logs"
                className="text-green-600 hover:text-green-800 text-sm font-medium"
              >
                Voir tous les logs →
              </Link>
            </div>
          </div>
          <div className="p-6">
            {recentLogs.length > 0 ? (
              <div className="space-y-4">
                {recentLogs.map((log) => (
                  <div key={log.id} className="flex items-start space-x-3 p-3 bg-white rounded-lg">
                    <div className="flex-shrink-0">
                      <span className="text-lg">
                        {log.action === 'CREATE' ? '➕' : 
                         log.action === 'UPDATE' ? '✏️' : 
                         log.action === 'DELETE' ? '🗑️' : 
                         log.action === 'LOGIN' ? '🔐' : 
                         log.action === 'LOGOUT' ? '🚪' : '📝'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-gray-900">
                          {getActionLabel(log.action)}
                        </p>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-${getActionColor(log.action)}-100 text-${getActionColor(log.action)}-800`}>
                          {auditService.formatEntityType(log.entityType)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {log.user ? `${log.user.prenom} ${log.user.nom}` : 'Système'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDate(log.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">Aucune activité récente</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditDashboard;


