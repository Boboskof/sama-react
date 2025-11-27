// UI filters → backend params pour les patients
export type UIPatientFilters = {
  search?: string;
  genre?: string;
  ville?: string;
  page?: number;
  limit?: number;
  // Filtres de date utilisés côté front (optionnels pour certains endpoints)
  dateDebut?: string;
  dateFin?: string;
};

export function buildPatientParams(f: UIPatientFilters): URLSearchParams {
  const p = new URLSearchParams();

  if (f.search) p.append('q', f.search);
  if (f.genre) p.append('genre', f.genre);
  if (f.ville) p.append('ville', f.ville);
  
  p.append('page', String(f.page ?? 1));
  p.append('per_page', String(f.limit ?? 25));
  return p;
}
