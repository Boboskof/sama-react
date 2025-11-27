// src/_services/audit.service.ts
import Axios from './caller.service';

export type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  user?: { 
    id: string; 
    email?: string; 
    prenom?: string; 
    nom?: string;
    full_name?: string; // Nom complet formaté (selon API_AUDIT_FRONTEND.md)
  };
  ip?: string;
  createdAt: string;
  payload?: any;
  message?: string; // Message formaté par l'API (selon API_AUDIT_FRONTEND.md)
};

// 1) Collection via API Platform filters - ⚠️ DÉSACTIVÉ selon la documentation
// Ne plus utiliser cet endpoint, utiliser getAuditLogs() à la place
export async function listAuditWithFilters(params: {
  userId?: string;
  action?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
}) {
  // ⚠️ DÉPRÉCIÉ : Utiliser getAuditLogs() à la place
  // Convertir les paramètres vers le format de getAuditLogs
  return getAuditLogs({
    page: params.page,
    user_id: params.userId,
    action: params.action,
    entity_class: params.entityType,
    date_from: params.dateFrom,
    date_to: params.dateTo
  });
}

// 2) Recherche custom (params en snake_case)
export async function searchAudit(params: {
  user_id?: string;
  action?: string;
  entity_type?: string;
  date_from?: string;
  date_to?: string;
  patient_id?: string;
  limit?: number;
}): Promise<AuditLog[]> {
  const q = new URLSearchParams();
  (Object.entries(params) as [string, unknown][]).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  });
  const { data } = await Axios.get(`/audit/search?${q.toString()}`);
  return (data?.data ?? data ?? []) as AuditLog[];
}

// 3) Statistiques agrégées (selon API_AUDIT_FRONTEND.md)
export async function getAuditStats(params: { date_from?: string; date_to?: string }): Promise<{
  total: number;
  by_user: Array<{ id: string; email: string; prenom: string; nom: string; total_actions: number }>;
  by_action: Array<{ action: string; count: number }>;
  by_entity: Array<{ entityType: string; count: number }>;
  by_period: Array<{ period: string; count: number }>;
  filters: {
    date_from?: string;
    action: string[];
    only_stagiaires: boolean;
  };
}> {
  try {
    const q = new URLSearchParams();
    if (params.date_from) q.set('date_from', params.date_from);
    if (params.date_to) q.set('date_to', params.date_to);
    // Utiliser /api/audit/statistics selon la documentation FRONTEND_AUDIT_ENDPOINTS.md
    const response = await Axios.get(`/audit/statistics?${q.toString()}`, {
      headers: { 'X-Silent-Errors': '1' },
      validateStatus: (status: number) => status < 500,
      silent: true
    } as any);
    return response.data;
  } catch (error: any) {
    const status = error?.response?.status;
    // Gérer silencieusement les erreurs serveur avec fallback
    if (status === 404 || status === 500 || status === 501) {
      return {
        total: 0,
        by_user: [],
        by_action: [],
        by_entity: [],
        by_period: [],
        filters: {
          action: [],
          only_stagiaires: true
        }
      };
    }
    throw error;
  }
}

// 4) Liste des logs d'audit (selon API_AUDIT_FRONTEND.md)
export async function getAuditLogs(params: {
  page?: number;
  limit?: number;
  date_from?: string;
  date_to?: string;
  user_id?: string;
  action?: string | string[]; // Supporte une chaîne ou un tableau d'actions
  entity_class?: string;
  search?: string;
}): Promise<{
  data: AuditLog[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  filters?: {
    date_from?: string;
    action: string[];
    only_stagiaires: boolean;
  };
}> {
  try {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    // S'assurer que limit est bien envoyé (50 par défaut selon la documentation)
    const limit = params.limit || 50;
    q.set('limit', String(limit));
    if (params.date_from) q.set('date_from', params.date_from);
    if (params.date_to) q.set('date_to', params.date_to);
    if (params.user_id) q.set('user_id', params.user_id);
    if (params.action) {
      // Si c'est un tableau, le convertir en chaîne séparée par des virgules
      if (Array.isArray(params.action)) {
        q.set('action', params.action.join(','));
      } else {
        q.set('action', params.action);
      }
    }
    if (params.entity_class) q.set('entity_class', params.entity_class);
    if (params.search) q.set('search', params.search);
    
    // ✅ Utiliser UNIQUEMENT l'endpoint recommandé /api/audit/logs
    // ❌ Ne PAS utiliser /api/audit_logs (désactivé selon la documentation)
    const url = `/audit/logs?${q.toString()}`;
    
    const response = await Axios.get(url, {
      headers: { 'X-Silent-Errors': '1' },
      validateStatus: (status: number) => status < 500,
      silent: true
    } as any);
    
    const data = response.data;
    
    // L'endpoint /api/audit/logs retourne la structure avec pagination.total
    // Format attendu selon FRONTEND_AUDIT_ENDPOINTS.md :
    // { data: [...], pagination: { page, limit, total: 76, pages } }
    if (data?.pagination?.total !== undefined) {
      return {
        data: (data?.data || []) as AuditLog[],
        pagination: {
          page: data.pagination.page || params.page || 1,
          limit: data.pagination.limit || limit,
          total: data.pagination.total, // ✅ Utiliser pagination.total pour le compteur (76, pas 50)
          pages: data.pagination.pages || 1
        },
        filters: data?.filters
      };
    }
    
    // ⚠️ Si on reçoit une structure API Platform (hydra), c'est une erreur
    // car /api/audit_logs est désactivé et ne doit pas être utilisé
    if (data?.totalItems !== undefined || data?.['hydra:totalItems'] !== undefined || data?.['@type'] === 'Collection') {
      throw new Error('L\'endpoint /api/audit/logs doit être utilisé. /api/audit_logs est désactivé.');
    }
    
    // Fallback si la structure n'est pas celle attendue
    return {
      data: (data?.data || []) as AuditLog[],
      pagination: data?.pagination || {
        page: params.page || 1,
        limit: limit,
        total: 0,
        pages: 0
      },
      filters: data?.filters
    };
  } catch (error: any) {
    const status = error?.response?.status;
    // Gérer silencieusement les erreurs serveur avec fallback
    if (status === 404 || status === 500 || status === 501) {
      // Si l'endpoint /api/audit/logs n'existe pas (404), retourner une erreur vide
      // Ne pas utiliser /api/audit_logs car selon la documentation, il ne doit pas être utilisé
      return {
        data: [],
        pagination: {
          page: params.page || 1,
          limit: params.limit || 50,
          total: 0,
          pages: 0
        }
      };
    }
    throw error;
  }
}

// 5) Export CSV
export async function exportAuditCsv(params: { date_from?: string; date_to?: string }): Promise<Blob> {
  const q = new URLSearchParams();
  if (params.date_from) q.set('date_from', params.date_from);
  if (params.date_to) q.set('date_to', params.date_to);
  const { data } = await Axios.get(`/audit/export?${q.toString()}`, { responseType: 'blob' });
  return data as Blob;
}

// 6) Détail d'un log
export async function getOneAuditLog(id: string): Promise<AuditLog> {
  const { data } = await Axios.get(`/audit_logs/${id}`);
  return (data?.data ?? data) as AuditLog;
}

// Helpers pour compatibilité avec les anciennes méthodes utilisées dans les pages
export async function getStatisticsByUser(params: { date_from?: string; date_to?: string }) {
  const stats = await getAuditStats(params);
  return stats.by_user || [];
}

export async function getStatisticsByAction(params: { date_from?: string; date_to?: string }) {
  const stats = await getAuditStats(params);
  return stats.by_action || [];
}

export async function getStatisticsByEntity(params: { date_from?: string; date_to?: string }) {
  const stats = await getAuditStats(params);
  return stats.by_entity || [];
}

// Helpers UI
export function getActionColor(action?: string): string {
  const map: Record<string, string> = {
    CREATE: 'green',
    UPDATE: 'blue',
    DELETE: 'red',
    LOGIN: 'purple',
    LOGOUT: 'gray',
    VIEW: 'yellow',
    API_REQUEST: 'indigo',
  };
  return map[action || ''] || 'gray';
}

export function getActionLabel(action?: string): string {
  const map: Record<string, string> = {
    CREATE: 'Création',
    UPDATE: 'Modification',
    DELETE: 'Suppression',
    LOGIN: 'Connexion',
    LOGOUT: 'Déconnexion',
    VIEW: 'Consultation',
    API_REQUEST: 'Requête API',
  };
  return map[action || ''] || (action || 'Action');
}

export function formatEntityType(entity?: string): string {
  if (!entity) return '—';
  return String(entity).replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

// Retourne le nom de l'icône Material Symbols pour une action
export function getActionIcon(action?: string): string {
  const map: Record<string, string> = {
    CREATE: 'add_circle',
    UPDATE: 'edit',
    DELETE: 'delete',
    LOGIN: 'login',
    LOGOUT: 'logout',
    VIEW: 'visibility',
    API_REQUEST: 'api',
  };
  return map[action || ''] || 'description';
}

export async function getRecentActionsByUser(userId: string, limit: number = 50): Promise<AuditLog[]> {
  return await searchAudit({ user_id: userId, limit });
}

// Default export for legacy imports (auditService)
const auditService = {
  listAuditWithFilters,
  searchAudit,
  getAuditStats,
  getAuditLogs,
  exportAuditCsv,
  getOneAuditLog,
  getActionColor,
  getActionLabel,
  formatEntityType,
  getActionIcon,
  getRecentActionsByUser,
  getStatisticsByUser,
  getStatisticsByAction,
  getStatisticsByEntity,
  // Simple wrapper used by dashboard; passes through to stats
  async getStatisticsByPeriod(_period: 'day' | 'week' | 'month' | 'custom', params: { date_from?: string; date_to?: string }) {
    try {
      const stats = await getAuditStats(params);
      return {
        ...stats,
        total_actions_today: stats.total || 0,
        active_users_today: stats.by_user?.length || 0,
        most_common_action: stats.by_action?.[0]?.action || '—'
      };
    } catch (error) {
      // Retourner des stats vides si l'endpoint n'est pas disponible
      return {
        total: 0,
        by_user: [],
        by_action: [],
        by_entity: [],
        by_period: [],
        total_actions_today: 0,
        active_users_today: 0,
        most_common_action: '—',
        filters: {
          action: [],
          only_stagiaires: true
        }
      };
    }
  },
};

export default auditService;