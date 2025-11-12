// src/_services/audit.service.ts
import Axios from './caller.service';

export type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  user?: { id: string; email?: string; prenom?: string; nom?: string };
  ip?: string;
  createdAt: string;
  payload?: any;
  message?: string;
};

// 1) Collection via API Platform filters
export async function listAuditWithFilters(params: {
  userId?: string;
  action?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
}) {
  const q = new URLSearchParams();
  if (params.userId) q.set('user.id', params.userId);
  if (params.action) q.set('action', params.action);
  if (params.entityType) q.set('entityType', params.entityType);
  if (params.dateFrom) q.set('createdAt[after]', params.dateFrom);
  if (params.dateTo) q.set('createdAt[before]', params.dateTo);
  if (params.page) q.set('page', String(params.page));
  const { data } = await Axios.get(`/audit_logs?${q.toString()}`);
  return data;
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

// 3) Statistiques agrégées
export async function getAuditStats(params: { date_from?: string; date_to?: string }): Promise<{
  by_action_entity: Array<{ action: string; entity_type: string; cnt: number }>;
  by_user: Array<{ user_id: string; cnt: number }>;
}> {
  const q = new URLSearchParams();
  if (params.date_from) q.set('date_from', params.date_from);
  if (params.date_to) q.set('date_to', params.date_to);
  const { data } = await Axios.get(`/audit/stats?${q.toString()}`);
  return data as any;
}

// 4) Export CSV
export async function exportAuditCsv(params: { date_from?: string; date_to?: string }): Promise<Blob> {
  const q = new URLSearchParams();
  if (params.date_from) q.set('date_from', params.date_from);
  if (params.date_to) q.set('date_to', params.date_to);
  const { data } = await Axios.get(`/audit/export?${q.toString()}`, { responseType: 'blob' });
  return data as Blob;
}

// 5) Détail d'un log
export async function getOneAuditLog(id: string): Promise<AuditLog> {
  const { data } = await Axios.get(`/audit_logs/${id}`);
  return (data?.data ?? data) as AuditLog;
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

export async function getRecentActionsByUser(userId: string, limit: number = 50): Promise<AuditLog[]> {
  return await searchAudit({ user_id: userId, limit });
}

// Default export for legacy imports (auditService)
const auditService = {
  listAuditWithFilters,
  searchAudit,
  getAuditStats,
  exportAuditCsv,
  getOneAuditLog,
  getActionColor,
  getActionLabel,
  formatEntityType,
  getRecentActionsByUser,
  // Simple wrapper used by dashboard; passes through to stats
  async getStatisticsByPeriod(_period: 'day' | 'week' | 'month' | 'custom', params: { date_from?: string; date_to?: string }) {
    return await getAuditStats(params);
  },
};

export default auditService;