// UI filters → backend params
export type UICommFilters = {
  type?: string[];         // ex: ['RAPPEL_RDV']
  statut?: string[];       // ex: ['EN_ATTENTE', 'ECHEC']
  canal?: string[];        // ex: ['SMS']
  patientId?: string|number;
  dateDebut?: string;      // YYYY-MM-DD
  dateFin?: string;        // YYYY-MM-DD
  page?: number;
  limit?: number;
  skipAutoFilter?: boolean; // Si true, désactive le filtre automatique par created_by (pour voir toutes les communications)
  createdBy?: string;      // Filtrer explicitement par créateur (UUID)
};

export function buildCommParams(f: UICommFilters): URLSearchParams {
  const p = new URLSearchParams();

  // normalisation des noms
  if (f.patientId) p.append('patient_id', String(f.patientId));
  if (f.dateDebut) p.append('date_from', f.dateDebut);
  if (f.dateFin)   p.append('date_to',   f.dateFin);

  // Backend attend des tableaux pour les filtres multi-valeurs
  (f.type ?? []).forEach(v => p.append('type[]', v));
  (f.statut ?? []).forEach(v => p.append('statut[]', v));
  (f.canal ?? []).forEach(v => p.append('canal[]', v));

  p.append('page', String(f.page ?? 1));
  p.append('per_page', String(f.limit ?? 25));
  return p;
}
