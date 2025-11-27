import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatDateTime } from '../../utils/dateHelpers';
import {
  useAuditStatsByUser,
  useAuditStatsByAction,
  useAuditStatsByEntity,
  useAuditStatsByPeriod,
  useAuditLogs,
} from '../../hooks/useAudit';

const AuditDashboard = () => {
  const [timeRange, setTimeRange] = useState('day');

  // Chargement des statistiques via React Query
  const {
    data: usersStats,
    isLoading: usersLoading,
    error: usersError,
  } = useAuditStatsByUser({});

  const {
    data: actionsStats,
    isLoading: actionsLoading,
    error: actionsError,
  } = useAuditStatsByAction({});

  const {
    data: entitiesStats,
    isLoading: entitiesLoading,
    error: entitiesError,
  } = useAuditStatsByEntity({});

  const {
    data: periodStats,
    isLoading: periodLoading,
    error: periodError,
  } = useAuditStatsByPeriod(timeRange, {});

  const {
    data: recentLogsData,
    isLoading: recentLogsLoading,
    error: recentLogsError,
  } = useAuditLogs({ limit: 10, page: 1 });

  const statistics = {
    users: usersStats || [],
    actions: actionsStats || [],
    entities: entitiesStats || [],
    period: periodStats || {},
  };

  const recentLogs = Array.isArray(recentLogsData?.data)
    ? recentLogsData.data
    : Array.isArray(recentLogsData)
      ? recentLogsData
      : [];

  const loading =
    usersLoading ||
    actionsLoading ||
    entitiesLoading ||
    periodLoading ||
    recentLogsLoading;

  const error =
    usersError || actionsError || entitiesError || periodError || recentLogsError;

  const handleTimeRangeChange = (newRange) => {
    setTimeRange(newRange);
  };


  const getActionColor = (action) => {
    // Couleurs cohérentes avec les classes Tailwind utilisées plus bas
    switch (action) {
      case 'CREATE':
        return 'green';
      case 'UPDATE':
        return 'blue';
      case 'DELETE':
        return 'red';
      default:
        return 'gray';
    }
  };

  const getActionLabel = (action) => {
    switch (action) {
      case 'CREATE':
        return 'Création';
      case 'UPDATE':
        return 'Modification';
      case 'DELETE':
        return 'Suppression';
      default:
        return action || 'Action';
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-500 text-center p-4">{error}</div>;

  return (
    <div className="space-y-6 bg-indigo-100 min-h-screen w-[95%] md:w-[90%] lg:w-[80%] mx-auto px-2 md:px-4 py-6">
      {/* Header */}
      <div className="bg-blue-200 shadow-sm border-b">
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

      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistiques générales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/90 backdrop-blur-sm p-6 rounded-lg shadow-lg border border-green-200">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-base font-medium text-gray-600">Utilisateurs actifs</p>
                <p className="text-2xl font-bold text-gray-900">
                  {statistics.users?.length || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-sm p-6 rounded-lg shadow-lg border border-green-200">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-base font-medium text-gray-600">Actions totales</p>
                <p className="text-2xl font-bold text-gray-900">
                  {statistics.period?.total_actions || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-sm p-6 rounded-lg shadow-lg border border-green-200">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-base font-medium text-gray-600">Types d'actions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {statistics.actions?.length || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-sm p-6 rounded-lg shadow-lg border border-green-200">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-base font-medium text-gray-600">Entités modifiées</p>
                <p className="text-2xl font-bold text-gray-900">
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
              <h3 className="text-2xl font-medium text-gray-900">Top utilisateurs les plus actifs</h3>
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
                            {user.full_name || `${user.prenom || ''} ${user.nom || ''}`.trim()}
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
              <h3 className="text-2xl font-medium text-gray-900">Répartition des actions</h3>
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
              <h3 className="text-2xl font-medium text-gray-900">Entités les plus modifiées</h3>
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
                <h3 className="text-2xl font-medium text-gray-900">Activité récente</h3>
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
                      <span className="material-symbols-rounded text-2xl text-gray-600">
                        {/* Icône générique basée sur l'action */}
                        {log.action === 'CREATE'
                          ? 'add_circle'
                          : log.action === 'UPDATE'
                          ? 'edit'
                          : log.action === 'DELETE'
                          ? 'delete'
                          : 'info'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-gray-900">
                          {getActionLabel(log.action)}
                        </p>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-${getActionColor(log.action)}-100 text-${getActionColor(log.action)}-800`}>
                          {log.entityType || 'Entité'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {log.user ? (log.user.full_name || `${log.user.prenom || ''} ${log.user.nom || ''}`.trim()) : 'Système'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDateTime(log.createdAt)}
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
