// UI filters → backend params pour les logs d'audit du formateur
export type UIFormateurLogFilters = {
  userId?: string;
  action?: string;
  entityType?: string;
  dateDebut?: string;
  dateFin?: string;
  search?: string;
  page?: number;
  limit?: number;
};

export function buildFormateurLogParams(f: UIFormateurLogFilters): URLSearchParams {
  const p = new URLSearchParams();

  if (f.userId) p.append('user_id', f.userId);
  if (f.action) p.append('action', f.action);
  if (f.entityType) p.append('entity_type', f.entityType);
  if (f.dateDebut) p.append('date_debut', f.dateDebut);
  if (f.dateFin) p.append('date_fin', f.dateFin);
  if (f.search) p.append('q', f.search);
  
  p.append('page', String(f.page ?? 1));
  p.append('limit', String(f.limit ?? 50));
  return p;
}

// UI filters → backend params pour les statistiques d'activité
export type UIFormateurStatsFilters = {
  stagiaireId?: string;
  periode?: string;
  dateDebut?: string;
  dateFin?: string;
};

export function buildFormateurStatsParams(f: UIFormateurStatsFilters): URLSearchParams {
  const p = new URLSearchParams();

  if (f.stagiaireId) p.append('stagiaire_id', f.stagiaireId);
  if (f.periode) p.append('periode', f.periode);
  if (f.dateDebut) p.append('date_debut', f.dateDebut);
  if (f.dateFin) p.append('date_fin', f.dateFin);
  
  return p;
}
