import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import userService from '../../_services/user.service';
import adminService from '../../_services/admin.service';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import { useAdminAuditStats, useUsers, useToggleUserStatus } from '../../hooks/useUsers';
import { useQueryClient } from '@tanstack/react-query';

const DashboardAdmin = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [clearingLogs, setClearingLogs] = useState(false);
  const [uiError, setUiError] = useState(null);

  // Filtres utilisateurs
  const [userFilters, setUserFilters] = useState({
    search: '',
    role: '',
    page: 1
  });

  // Utiliser React Query pour charger les stats d'audit
  const { 
    data: auditStats, 
    isLoading: auditStatsLoading, 
    error: auditStatsError 
  } = useAdminAuditStats();

  // Utiliser React Query pour charger les utilisateurs
  const { 
    data: usersResponse,
    isLoading: usersLoading,
    error: usersError
  } = useUsers({
    page: userFilters.page,
    limit: 10,
    search: userFilters.search || undefined,
    role: userFilters.role || undefined
  });

  // Extraire les données des réponses
  const users = usersResponse?.users || [];
  const usersPagination = usersResponse?.pagination || { page: 1, limit: 10, total: 0, pages: 1 };

  // Mutation pour activer/désactiver utilisateur
  const toggleUserStatusMutation = useToggleUserStatus();

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const currentUser = await userService.getCurrentUser();
      if (!currentUser || (!currentUser.isAdmin && currentUser.primaryRole !== 'ROLE_ADMIN')) {
        navigate('/formateur/dashboard');
        return;
      }
      setUser(currentUser);
    } catch (err) {
      console.error('Erreur vérification admin:', err);
      navigate('/login');
    }
  };

  // Gérer les erreurs
  useEffect(() => {
    if (usersError?.response?.status === 403) {
      // Erreur gérée par ErrorMessage
    } else if (usersError?.response?.status === 401) {
      navigate('/login');
    }
  }, [usersError, navigate]);

  const handleToggleUserStatus = async (userId, currentStatus) => {
    const action = currentStatus ? 'désactiver' : 'réactiver';
    const message = currentStatus
      ? 'Désactiver cet utilisateur ?\n\nIl ne pourra plus se connecter au système.'
      : 'Réactiver cet utilisateur ?\n\nIl pourra à nouveau se connecter au système.';
    
    if (!window.confirm(message)) {
      return;
    }

    try {
      await toggleUserStatusMutation.mutateAsync({ 
        userId, 
        status: !currentStatus 
      });
      // React Query invalide automatiquement la liste des utilisateurs
    } catch (err) {
      console.error('Erreur modification statut utilisateur:', err);
      alert(`Erreur lors de la ${action} de l'utilisateur`);
    }
  };

  const handleSendReminders = async () => {
    if (!window.confirm('Envoyer les rappels de rendez-vous maintenant ?')) {
      return;
    }

    try {
      setRemindersLoading(true);
      const result = await adminService.sendReminders({ dry_run: false, limit: 100 });
      alert(`${result.processed} rappels envoyés avec succès`);
    } catch (err) {
      console.error('Erreur envoi rappels:', err);
      alert('Erreur lors de l\'envoi des rappels');
    } finally {
      setRemindersLoading(false);
    }
  };

  const handleClearLogs = async () => {
    const message = '⚠️ ATTENTION : Cette action est irréversible !\n\n' +
      'Tous les logs d\'audit seront définitivement supprimés.\n\n' +
      'Êtes-vous sûr de vouloir continuer ?';
    
    if (!window.confirm(message)) {
      return;
    }

    // Double confirmation
    if (!window.confirm('Dernière confirmation : Supprimer TOUS les logs d\'audit ?')) {
      return;
    }

    try {
      setClearingLogs(true);
      const result = await adminService.clearAuditLogs();
      alert(`✅ ${result.deleted || 0} logs supprimés avec succès`);
      // Invalider les queries pour recharger les stats automatiquement
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit-stats'] });
    } catch (err) {
      console.error('Erreur suppression logs:', err);
      alert('Erreur lors de la suppression des logs');
    } finally {
      setClearingLogs(false);
    }
  };

  // Utiliser les états de React Query
  const loading = auditStatsLoading && !auditStats;
  const error = auditStatsError || usersError || uiError;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner message="Chargement du dashboard admin..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      {/* En-tête */}
      <div className="mb-6">
        <div className="bg-red-50 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <span className="material-symbols-rounded text-red-600 text-4xl">admin_panel_settings</span>
                Dashboard Administrateur
              </h1>
              <p className="text-gray-600 mt-2">
                Bonjour {user?.prenom} {user?.nom} - Gestion complète du système
              </p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6">
          <ErrorMessage
            message={error}
            dismissible={true}
            onDismiss={() => setUiError(null)}
          />
        </div>
      )}

      {/* Statistiques d'audit */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total d'actions</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{auditStats?.total || 0}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="material-symbols-rounded text-blue-600 text-2xl">analytics</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total utilisateurs</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{usersPagination.total || 0}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <span className="material-symbols-rounded text-green-600 text-2xl">people</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Actions aujourd'hui</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {auditStats?.by_period?.find(p => p.period === new Date().toISOString().split('T')[0])?.count || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <span className="material-symbols-rounded text-purple-600 text-2xl">today</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Utilisateurs actifs</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {users.filter(u => (u.statut ?? true)).length}
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <span className="material-symbols-rounded text-orange-600 text-2xl">check_circle</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions par type */}
      {auditStats?.by_action && auditStats.by_action.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Répartition par action</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {auditStats.by_action.map((action) => (
              <div key={action.action} className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">{action.action}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{action.count}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gestion des rappels */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Rappels de Rendez-vous</h2>
        <div className="flex gap-4">
          <button
            onClick={handleSendReminders}
            disabled={remindersLoading}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg disabled:opacity-50 flex items-center gap-2"
          >
            {remindersLoading ? (
              <>
                <LoadingSpinner color="white" size="small" inline={true} />
                Envoi...
              </>
            ) : (
              <>
                <span className="material-symbols-rounded">send</span>
                Envoyer les rappels
              </>
            )}
          </button>
        </div>
      </div>

      {/* Gestion des logs d'audit */}
      <div className="bg-white rounded-lg shadow p-6 mb-6 border-l-4 border-red-500">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Gestion des Logs d'Audit</h2>
        <div className="mb-4 text-sm text-gray-600 bg-red-50 px-4 py-2 rounded-lg">
          <p className="font-medium mb-1">⚠️ Attention :</p>
          <p>La suppression des logs est une action irréversible. Tous les logs d'audit seront définitivement supprimés.</p>
        </div>
        <button
          onClick={handleClearLogs}
          disabled={clearingLogs}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg disabled:opacity-50 flex items-center gap-2"
        >
          {clearingLogs ? (
            <>
              <LoadingSpinner color="white" size="small" inline={true} />
              Suppression...
            </>
          ) : (
            <>
              <span className="material-symbols-rounded">delete_forever</span>
              Effacer tous les logs
            </>
          )}
        </button>
      </div>

      {/* Liste des utilisateurs */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Gestion des Utilisateurs</h2>
          <div className="mb-4 text-sm text-gray-600 bg-blue-50 px-4 py-2 rounded-lg">
            <p className="font-medium mb-1">💡 Explication du statut :</p>
            <ul className="list-disc list-inside space-y-1">
              <li><span className="font-semibold text-green-700">Actif</span> : L'utilisateur peut se connecter au système</li>
              <li><span className="font-semibold text-red-700">Inactif</span> : L'utilisateur ne peut pas se connecter (compte désactivé)</li>
              <li><span className="font-semibold text-green-600">Réactiver</span> : Permet à un utilisateur inactif de se connecter à nouveau</li>
            </ul>
          </div>
          
          {/* Filtres */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <input
              type="text"
              placeholder="Rechercher par nom, prénom, email..."
              value={userFilters.search}
              onChange={(e) => setUserFilters({ ...userFilters, search: e.target.value, page: 1 })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={userFilters.role}
              onChange={(e) => setUserFilters({ ...userFilters, role: e.target.value, page: 1 })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tous les rôles</option>
              <option value="ROLE_STAGIAIRE">Stagiaire</option>
              <option value="ROLE_FORMATEUR">Formateur</option>
              <option value="ROLE_ADMIN">Admin</option>
            </select>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2"
            >
              <span className="material-symbols-rounded text-2xl">refresh</span>
              Actualiser
            </button>
          </div>
        </div>

        {/* Tableau */}
        <div className="overflow-x-auto">
          {usersLoading ? (
            <div className="p-8 text-center">
              <LoadingSpinner message="Chargement des utilisateurs..." />
            </div>
          ) : (
            <>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rôle</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                        Aucun utilisateur trouvé
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{u.prenom} {u.nom}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{u.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            {u.primaryRole || u.roles[0] || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {(() => {
                            const statut = u.statut ?? true; // Gestion défensive : par défaut actif si absent
                            return (
                              <>
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                  statut ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {statut ? 'Actif' : 'Inactif'}
                                </span>
                                {!statut && (
                                  <p className="text-xs text-gray-500 mt-1">Ne peut pas se connecter</p>
                                )}
                              </>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {(() => {
                            const statut = u.statut ?? true; // Gestion défensive : par défaut actif si absent
                            return (
                              <button
                                onClick={() => handleToggleUserStatus(u.id, statut)}
                                className={`px-3 py-1 rounded-lg text-white text-xs font-medium ${
                                  statut
                                    ? 'bg-red-600 hover:bg-red-700'
                                    : 'bg-green-600 hover:bg-green-700'
                                }`}
                                title={statut ? 'Désactiver le compte (empêche la connexion)' : 'Réactiver le compte (permet la connexion)'}
                              >
                                {statut ? 'Désactiver' : 'Réactiver'}
                              </button>
                            );
                          })()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Pagination */}
              {usersPagination.pages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Page {usersPagination.page} sur {usersPagination.pages} ({usersPagination.total} utilisateurs)
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setUserFilters({ ...userFilters, page: userFilters.page - 1 })}
                      disabled={userFilters.page === 1}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Précédent
                    </button>
                    <button
                      onClick={() => setUserFilters({ ...userFilters, page: userFilters.page + 1 })}
                      disabled={userFilters.page >= usersPagination.pages}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Suivant
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardAdmin;

