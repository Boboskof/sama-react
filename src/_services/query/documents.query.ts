// UI filters → backend params pour les documents
export type UIDocumentFilters = {
  search?: string;
  type?: string[];
  statut?: string[];
  patientId?: string|number;
  dateDebut?: string;      // YYYY-MM-DD
  dateFin?: string;        // YYYY-MM-DD
  page?: number;
  limit?: number;
};

export function buildDocumentParams(f: UIDocumentFilters): URLSearchParams {
  const p = new URLSearchParams();

  if (f.search) p.append('q', f.search);
  if (f.patientId) p.append('patient_id', String(f.patientId));
  if (f.dateDebut) p.append('date_from', f.dateDebut);
  if (f.dateFin) p.append('date_to', f.dateFin);

  // tableaux → type[]=A&type[]=B
  (f.type ?? []).forEach(v => p.append('type[]', v));
  (f.statut ?? []).forEach(v => p.append('statut[]', v));

  p.append('page', String(f.page ?? 1));
  p.append('per_page', String(f.limit ?? 25));
  return p;
}
