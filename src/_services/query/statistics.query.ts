// UI filters → backend params pour les statistiques
export type UIStatsFilters = {
  dateDebut?: string;
  dateFin?: string;
  userId?: string;
  entityType?: string;
  page?: number;
  limit?: number;
};

export function buildStatsParams(f: UIStatsFilters): URLSearchParams {
  const p = new URLSearchParams();

  if (f.dateDebut) p.append('date_from', f.dateDebut);
  if (f.dateFin) p.append('date_to', f.dateFin);
  if (f.userId) p.append('user_id', f.userId);
  if (f.entityType) p.append('entity_type', f.entityType);
  
  p.append('page', String(f.page ?? 1));
  p.append('limit', String(f.limit ?? 50));
  return p;
}
