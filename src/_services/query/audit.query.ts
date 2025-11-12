// UI filters → backend params pour les logs d'audit
export type UIAuditFilters = {
  action?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  user_id?: string;
  entity?: string;
  page?: number;
  limit?: number;
};

export function buildAuditParams(f: UIAuditFilters): URLSearchParams {
  const p = new URLSearchParams();

  if (f.action) p.append('action', f.action);
  if (f.search) p.append('search', f.search);
  if (f.date_from) p.append('date_from', f.date_from);
  if (f.date_to) p.append('date_to', f.date_to);
  if (f.user_id) p.append('user_id', f.user_id);
  if (f.entity) p.append('entity', f.entity);
  
  p.append('page', String(f.page ?? 1));
  p.append('limit', String(f.limit ?? 50));
  return p;
}
