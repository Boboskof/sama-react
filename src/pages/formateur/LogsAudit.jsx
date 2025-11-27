import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import StatCard from '../../components/StatCard';
import { formatDateTime } from '../../utils/dateHelpers';
import '../../styles/audit-logs.css';
import { useAuditLogs, useAuditStats } from '../../hooks/useAudit';
import { useStagiaires } from '../../hooks/useStagiaires';
import auditService from '../../_services/audit.service';

const LogsAudit = () => {
  const [searchParams] = useSearchParams();
  const [selectedLog, setSelectedLog] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [uiError, setUiError] = useState(null);
  
  // Filtres
  const [filters, setFilters] = useState({
    action: searchParams.get('action') || undefined,
    date_from: searchParams.get('date_from') || undefined,
    date_to: searchParams.get('date_to') || undefined,
    user_id: searchParams.get('user_id') || undefined,
    page: parseInt(searchParams.get('page')) || 1,
    limit: 50
  });
  
  // État pour le filtre regroupé "Connexions/Déconnexions"
  const [showAuthActions, setShowAuthActions] = useState(false);

  // Construire l'action envoyée au backend en fonction du filtre "Connexions/Déconnexions"
  const backendAction = showAuthActions ? ['LOGIN', 'LOGOUT'] : filters.action;

  // Chargement des logs via React Query
  const {
    data: logsResult,
    isLoading: logsLoading,
    error: logsError,
  } = useAuditLogs({
    page: filters.page,
    limit: filters.limit,
    date_from: filters.date_from,
    date_to: filters.date_to,
    user_id: filters.user_id,
    action: backendAction,
  });

  // Chargement des stats via React Query
  const {
    data: statsResult,
    isLoading: statsLoading,
    error: statsError,
  } = useAuditStats({
    date_from: filters.date_from,
    date_to: filters.date_to,
  });

  // Chargement des stagiaires via React Query
  const {
    data: stagiairesData,
    isLoading: stagiairesLoading,
    error: stagiairesError,
  } = useStagiaires();

  // Normalisation des données
  const rawLogsData = logsResult?.data || [];

  let logs = Array.isArray(rawLogsData) ? rawLogsData : [];

  // Si le filtre "Connexions/Déconnexions" est actif, filtrer côté frontend également
  if (showAuthActions) {
    logs = logs.filter((log) => log.action === 'LOGIN' || log.action === 'LOGOUT');
  }

  const normalizedLogs = logs
    .map((log) => {
      if (!log) return null;

      return {
        ...log,
        action: log.action || 'UNKNOWN',
        entityType: log.entityType || 'UNKNOWN',
        entityId: log.entityId || '',
        createdAt: log.createdAt || new Date().toISOString(),
        ip: log.ip || '',
        user: log.user
          ? {
              ...log.user,
              // Le backend fournit maintenant user.full_name, avec fallback pour compatibilité
              full_name:
                log.user.full_name ||
                (log.user.prenom && log.user.nom
                  ? `${log.user.prenom} ${log.user.nom}`.trim()
                  : undefined),
            }
          : null,
        message: log.message || '', // Message formaté par AuditMessageBuilder (inclut le nom du patient)
        payload: log.payload || null,
      };
    })
    .filter(Boolean);

  const statistics = {
    users: Array.isArray(statsResult?.by_user) ? statsResult.by_user : [],
    actions: Array.isArray(statsResult?.by_action) ? statsResult.by_action : [],
    entities: Array.isArray(statsResult?.by_entity) ? statsResult.by_entity : [],
  };

  const pagination = logsResult?.pagination
    ? {
        page: logsResult.pagination.page || filters.page,
        pages: logsResult.pagination.pages || 1,
        total: logsResult.pagination.total || 0,
      }
    : {
        page: filters.page,
        pages: Math.ceil(normalizedLogs.length / (filters.limit || 50)) || 1,
        total: normalizedLogs.length,
      };

  const loading = logsLoading || statsLoading || stagiairesLoading;
  const error = logsError || statsError || stagiairesError || uiError;

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1 // Reset à la première page lors d'un changement de filtre
    }));
    // Si on change le filtre action, désactiver le filtre regroupé
    if (key === 'action') {
      setShowAuthActions(false);
    }
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
      // Charger les détails complets du log côté backend uniquement pour ce log
      // (pas besoin de React Query ici car c'est une action ponctuelle sur clic)
      const full = await import('../../_services/audit.service').then((m) =>
        m.default ? m.default.getOneAuditLog(log.id) : m.getOneAuditLog(log.id)
      );
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

  // Boutons rapides pour les filtres
  const quickFilters = [
    { label: 'Aujourd\'hui', action: () => {
      const today = new Date().toISOString().split('T')[0];
      const isActive = filters.date_from === today && filters.date_to === today;
      setFilters(prev => ({
        ...prev,
        date_from: isActive ? undefined : today,
        date_to: isActive ? undefined : today,
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
      const isActive = filters.date_from === weekStartStr && filters.date_to === weekEndStr;
      setFilters(prev => ({
        ...prev,
        date_from: isActive ? undefined : weekStartStr,
        date_to: isActive ? undefined : weekEndStr,
        page: 1
      }));
    }},
    { 
      label: 'Créations', 
      isActive: () => filters.action === 'CREATE',
      action: () => {
        const isActive = filters.action === 'CREATE';
        setFilters(prev => ({
          ...prev,
          action: isActive ? undefined : 'CREATE',
          page: 1
        }));
        setShowAuthActions(false); // Désactiver le filtre regroupé si on sélectionne une autre action
      }
    },
    { 
      label: 'Modifications', 
      isActive: () => filters.action === 'UPDATE',
      action: () => {
        const isActive = filters.action === 'UPDATE';
        setFilters(prev => ({
          ...prev,
          action: isActive ? undefined : 'UPDATE',
          page: 1
        }));
        setShowAuthActions(false); // Désactiver le filtre regroupé si on sélectionne une autre action
      }
    },
    { 
      label: 'Suppressions', 
      isActive: () => filters.action === 'DELETE',
      action: () => {
        const isActive = filters.action === 'DELETE';
        setFilters(prev => ({
          ...prev,
          action: isActive ? undefined : 'DELETE',
          page: 1
        }));
        setShowAuthActions(false); // Désactiver le filtre regroupé si on sélectionne une autre action
      }
    },
    { 
      label: 'Connexions/Déconnexions', 
      isActive: () => showAuthActions,
      action: () => {
        const isActive = showAuthActions;
        setShowAuthActions(!isActive);
        setFilters(prev => ({
          ...prev,
          action: undefined, // Réinitialiser le filtre action pour éviter les conflits
          page: 1
        }));
      }
    },
    { 
      label: 'Tous', 
      isActive: () => !filters.action && !filters.date_from && !filters.date_to && !filters.user_id && !showAuthActions,
      action: () => {
        setShowAuthActions(false); // Désactiver le filtre regroupé
        setFilters({
          action: undefined,
          date_from: undefined,
          date_to: undefined,
          user_id: undefined,
          page: 1,
          limit: 50
        });
      }
    }
  ];

  const getActionColor = (action) => {
    switch (action) {
      case 'CREATE':
        return 'green';
      case 'UPDATE':
        return 'blue';
      case 'DELETE':
        return 'red';
      case 'LOGIN':
        return 'indigo';
      case 'LOGOUT':
        return 'gray';
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
      case 'LOGIN':
        return 'Connexion';
      case 'LOGOUT':
        return 'Déconnexion';
      default:
        return action || 'Action';
    }
  };

  const getActionIconClass = (action) => {
    const color = getActionColor(action);
    return `audit-icon-${color}`;
  };

  const getActionRowClass = (action) => {
    const color = getActionColor(action);
    return `audit-row-${color}`;
  };

  const getActionRowClassWithBg = (action) => {
    const color = getActionColor(action);
    // Mapping des couleurs vers les classes Tailwind
    const colorMap = {
      green: 'bg-green-50 border-l-green-500 hover:bg-green-100',
      blue: 'bg-blue-50 border-l-blue-500 hover:bg-blue-100',
      red: 'bg-red-50 border-l-red-500 hover:bg-red-100',
      purple: 'bg-purple-50 border-l-purple-500 hover:bg-purple-100',
      gray: 'bg-gray-50 border-l-gray-500 hover:bg-gray-100',
      yellow: 'bg-yellow-50 border-l-yellow-500 hover:bg-yellow-100',
      indigo: 'bg-indigo-50 border-l-indigo-500 hover:bg-indigo-100'
    };
    return colorMap[color] || 'bg-gray-50 border-l-gray-500 hover:bg-gray-100';
  };

  const getActionBadgeClass = (action) => {
    const color = getActionColor(action);
    return `audit-badge-${color}`;
  };

  // Formater le nom de l'entité (enlever "App\Entity\" et formater)
  const formatEntityName = (entityType) => {
    if (!entityType) return '—';
    // Enlever "App\Entity\" si présent
    let name = entityType.replace(/^App\\Entity\\/, '');
    // Formater en PascalCase si nécessaire
    return name;
  };

  // Récupérer le nom du patient depuis le log (depuis payload/métadonnées uniquement)
  // Le backend inclut maintenant le nom du patient dans les messages, donc cette fonction
  // sert principalement pour les anciens logs ou pour extraire depuis les métadonnées
  const getPatientName = (log) => {
    if (!log) return null;
    
    // 1. Depuis metadata.patient_name (si disponible)
    const metaName = log?.payload?.metadata?.patient_name || log?.metadata?.patient_name;
    if (metaName && String(metaName).trim()) return metaName;
    
    // 2. Depuis payload.after ou payload.before (pour les actions sur Patient)
    const prenom = (log?.payload?.after?.prenom || log?.payload?.before?.prenom || '').trim();
    const nom = (log?.payload?.after?.nom || log?.payload?.before?.nom || '').trim();
    const composed = `${nom} ${prenom}`.trim(); // Format: "nom prénom"
    if (composed) return composed;
    
    // 3. Depuis payload.after.patient ou payload.before.patient
    const patientAfter = log?.payload?.after?.patient;
    const patientBefore = log?.payload?.before?.patient;
    
    if (patientAfter && typeof patientAfter === 'object') {
      const patientPrenom = patientAfter.prenom || '';
      const patientNom = patientAfter.nom || '';
      const patientFull = `${patientNom} ${patientPrenom}`.trim(); // Format: "nom prénom"
      if (patientFull) return patientFull;
    }
    if (patientBefore && typeof patientBefore === 'object') {
      const patientPrenom = patientBefore.prenom || '';
      const patientNom = patientBefore.nom || '';
      const patientFull = `${patientNom} ${patientPrenom}`.trim(); // Format: "nom prénom"
      if (patientFull) return patientFull;
    }
    
    // 4. Depuis payload.metadata.patient (si c'est un objet)
    const payloadMetadataPatient = log?.payload?.metadata?.patient;
    if (payloadMetadataPatient && typeof payloadMetadataPatient === 'object') {
      const patientPrenom = payloadMetadataPatient.prenom || '';
      const patientNom = payloadMetadataPatient.nom || '';
      const patientFull = `${patientNom} ${patientPrenom}`.trim(); // Format: "nom prénom"
      if (patientFull) return patientFull;
    }
    
    return null;
  };

  // Vérifier si le log concerne un patient ou un rendez-vous
  const hasPatientInfo = (log) => {
    const entityType = log?.entityType || '';
    return entityType.includes('Patient') || entityType.includes('RendezVous') || 
           log?.payload?.metadata?.patient_id || log?.metadata?.patient_id ||
           getPatientName(log) !== null;
  };

  // Enrichir le message : enlever la date/heure car elle est déjà affichée à droite
  // Le backend inclut maintenant le nom du patient dans tous les messages (régénération automatique)
  const getEnrichedMessage = (log) => {
    let message = log?.message || '';
    
    // Si pas de message, ne rien faire
    if (!message) return message;
    
    // Enlever la date/heure du message (format: " à DD/MM/YYYY HH:MM" ou " à YYYY-MM-DD HH:MM:SS")
    // Patterns possibles: " à 17/11/2025 14:35.", " à 2025-11-17 14:35:25.", etc.
    message = message.replace(/\s+à\s+\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}\.?/g, ''); // Format DD/MM/YYYY HH:MM
    message = message.replace(/\s+à\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.?/g, ''); // Format YYYY-MM-DD HH:MM:SS
    message = message.replace(/\s+à\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\.?/g, ''); // Format YYYY-MM-DD HH:MM
    message = message.replace(/\s+à\s+\d{2}\/\d{2}\/\d{4}\.?/g, ''); // Format DD/MM/YYYY seulement
    message = message.trim();
    
    // Le backend régénère automatiquement les messages avec le nom du patient
    // On retourne le message tel quel (sans la date/heure)
    return message;
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-500 text-center p-4">{String(error)}</div>;

  return (
    <div className="space-y-6 bg-indigo-100 min-h-screen w-[95%] md:w-[90%] lg:w-[80%] mx-auto px-2 md:px-4 py-6">
      {/* Titre avec icône */}
      <div className="text-center py-6 mb-6">
        <div className="bg-blue-200 rounded-lg shadow p-6 max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center shadow-sm">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-blue-800">Logs d'audit</h1>
          </div>
          <p className="text-blue-700 text-sm">
            Suivi de l'activité des stagiaires
          </p>
        </div>
      </div>

      <div className="w-full px-2 md:px-4 py-6">
        {error && (
          <div className="mb-6">
            <ErrorMessage 
              message={error} 
              title="Erreur de chargement"
              dismissible={true}
              onDismiss={() => setUiError(null)}
            />
          </div>
        )}
        

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <StatCard
            icon="users"
            label="Utilisateurs actifs"
            value={statistics.users?.length || 0}
            color="blue"
          />
          <StatCard
            icon="chart"
            label="Total des actions"
            value={pagination.total || 0}
            color="green"
          />
          <StatCard
            icon="settings"
            label="Types d'actions"
            value={statistics.actions?.length || 0}
            color="purple"
          />
          <StatCard
            icon="database"
            label="Entités modifiées"
            value={statistics.entities?.length || 0}
            color="orange"
          />
        </div>

        {/* Top utilisateurs */}
        {statistics.users && statistics.users.length > 0 && (
          <div className="bg-blue-50 rounded-lg shadow mb-6">
            <div className="px-6 py-4 border-b border-blue-200">
              <h3 className="text-2xl font-medium text-gray-900">Top utilisateurs les plus actifs</h3>
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
                          {user?.full_name || (user?.prenom || user?.nom ? `${user.prenom || ''} ${user.nom || ''}`.trim() : 'Anonyme')}
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
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-2xl font-medium text-gray-900">Logs d'audit ({logs.length})</h3>
                <p className="text-sm text-gray-500">{pagination.total} logs trouvés</p>
              </div>
            </div>
            
            {/* Filtres dans l'en-tête de la liste */}
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-end gap-4">
                {/* Stagiaire */}
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Stagiaire</label>
                  <select
                    value={filters.user_id || ''}
                    onChange={(e) => handleFilterChange('user_id', e.target.value || undefined)}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      filters.user_id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-300'
                    }`}
                  >
                    <option value="">Tous les stagiaires</option>
                    {(stagiairesData || []).map((stagiaire) => (
                      <option key={stagiaire.id} value={stagiaire.id}>
                        {stagiaire.prenom} {stagiaire.nom}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date de début */}
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date de début</label>
                  <input
                    type="date"
                    value={filters.date_from || ''}
                    onChange={(e) => handleFilterChange('date_from', e.target.value || undefined)}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      filters.date_from 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-300'
                    }`}
                  />
                </div>

                {/* Date de fin */}
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date de fin</label>
                  <input
                    type="date"
                    value={filters.date_to || ''}
                    onChange={(e) => handleFilterChange('date_to', e.target.value || undefined)}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      filters.date_to 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-300'
                    }`}
                  />
                </div>
              </div>
              
              {/* Boutons rapides */}
              <div className="flex flex-wrap gap-2">
                {quickFilters.map((filter, index) => {
                  const isActive = filter.isActive ? filter.isActive() : false;
                  return (
                    <button
                      key={index}
                      onClick={filter.action}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        isActive 
                          ? 'bg-blue-700 text-white shadow-lg ring-2 ring-blue-300' 
                          : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      }`}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          
          {logs.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="text-gray-400 text-4xl mb-4">📋</div>
              <h3 className="text-2xl font-medium text-gray-900 mb-2">Aucun log trouvé</h3>
              <p className="text-gray-500">
                Aucun log ne correspond aux filtres sélectionnés.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {logs.map((log, index) => (
                <div
                  key={log.id || `${log.entityId || log.entity_id || 'log'}-${index}`}
                  className={`px-6 py-4 cursor-pointer border-l-4 ${getActionRowClassWithBg(log.action)}`}
                  onClick={() => showLogDetails(log)}
                >
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <span className={`material-symbols-rounded text-2xl ${getActionIconClass(log.action)}`}>
                        {auditService.getActionIcon(log.action)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-shrink-0">
                          <p className="text-sm font-medium text-gray-900">
                            {log.user?.full_name || (log.user?.prenom || log.user?.nom ? `${log.user.prenom || ''} ${log.user.nom || ''}`.trim() : 'Anonyme')}
                          </p>
                          <p className="text-sm text-gray-500">{log.user?.email || ''}</p>
                        </div>
                        <div className="flex-1 flex flex-col justify-center mx-4 min-w-0">
                          {getEnrichedMessage(log) && (
                            <p className="text-sm text-gray-900 text-center break-words whitespace-normal">{getEnrichedMessage(log)}</p>
                          )}
                          <div className="text-center mt-1">
                            <p className="text-xs text-gray-500">
                              {formatEntityName(log.entityType)} {log.entityId && `(ID: ${log.entityId.substring(0, 8)}...)`}
                            </p>
                            {getPatientName(log) && (
                              <p className="text-xs text-gray-600 font-medium mt-0.5">
                                Patient: {getPatientName(log)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 flex-shrink-0">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionBadgeClass(log.action)}`}>
                            {getActionLabel(log.action)}
                          </span>
                          <span className="text-xs text-gray-400 whitespace-nowrap">
                            {formatDateTime(log.createdAt)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="mt-2">
                        {hasPatientInfo(log) && getPatientName(log) && (
                          <p className="text-sm text-gray-600">
                            <strong>Patient:</strong> {getPatientName(log)}
                          </p>
                        )}
                        {log.id && (
                          <p className="text-sm text-gray-600">
                            <strong>ID:</strong> {log.id}
                          </p>
                        )}
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
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Page {pagination.page} sur {pagination.pages}
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
                    disabled={pagination.page >= pagination.pages}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Suivant
                  </button>
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
                <h3 className="text-2xl font-medium text-gray-900">Détails du log d'audit</h3>
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
                    <div className="flex items-center space-x-2">
                      <span className={`material-symbols-rounded text-2xl ${getActionIconClass(selectedLog.action)}`}>
                        {auditService.getActionIcon(selectedLog.action)}
                      </span>
                      <p className="text-sm text-gray-900">{getActionLabel(selectedLog.action)}</p>
                    </div>
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
                    <p className="text-sm text-gray-900">{formatDateTime(selectedLog.createdAt)}</p>
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
                      {selectedLog.user?.full_name || (selectedLog.user?.prenom || selectedLog.user?.nom ? `${selectedLog.user.prenom || ''} ${selectedLog.user.nom || ''}`.trim() : 'Anonyme')} ({selectedLog.user?.email || ''})
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

