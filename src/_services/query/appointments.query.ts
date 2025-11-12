// UI filters → backend params pour les rendez-vous
export type UIAppointmentFilters = {
  search?: string;
  statut?: string[];
  medecin?: string;
  patientId?: string|number;
  dateDebut?: string;      // YYYY-MM-DD
  dateFin?: string;        // YYYY-MM-DD
  page?: number;
  limit?: number;
  skipAutoFilter?: boolean; // Si true, désactive le filtre automatique par created_by (pour voir tous les rendez-vous)
  createdBy?: string;      // Filtrer explicitement par créateur (UUID)
  useHistoryEndpoint?: boolean; // Si true, utilise /rendez-vous/tous au lieu de /rendez-vous/
  includePast?: boolean;  // Si true, inclut les rendez-vous passés (désactive le filtre "futurs uniquement")
};

export function buildAppointmentParams(f: UIAppointmentFilters): URLSearchParams {
  const p = new URLSearchParams();

  if (f.search) p.append('q', f.search);
  
  // ⚠️ IMPORTANT : Le backend attend "praticien" (nom) et non "medecin" (ID)
  // Si f.medecin est un ID, il faudra le convertir en nom côté frontend avant d'appeler cette fonction
  // Pour l'instant, on envoie tel quel (le backend pourra gérer ou non)
  if (f.medecin) {
    // Le backend attend le nom du praticien, pas l'ID
    // Si c'est un ID UUID, on ne l'envoie pas (le backend ne le gère pas)
    // Si c'est un nom, on l'envoie comme "praticien"
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(f.medecin);
    if (!isUUID) {
      p.append('praticien', f.medecin);
    }
    // Si c'est un UUID, on ne l'envoie pas car le backend ne filtre que par nom
  }
  
  if (f.patientId) p.append('patient_id', String(f.patientId));
  
  // Format de date attendu par le backend : date_debut et date_fin (YYYY-MM-DD)
  if (f.dateDebut) {
    p.append('date_debut', f.dateDebut);
  }
  if (f.dateFin) {
    p.append('date_fin', f.dateFin);
  }
  
  // ⚠️ Paramètres NON supportés par le backend (selon API_RENDEZ_VOUS_GUIDE.md)
  // - skip_auto_filter : Non géré par le backend
  // - created_by : Le backend filtre automatiquement par createdBy selon le rôle
  // - include_past : Le backend filtre automatiquement par start_at >= NOW()
  
  // Statut : le backend attend un seul statut, pas un tableau
  // Si plusieurs statuts sont fournis, on prend le premier
  if (f.statut && f.statut.length > 0 && f.statut[0]) {
    p.append('statut', f.statut[0]);
  }

  // ⚠️ IMPORTANT : order[start_at] n'est PAS supporté par le backend
  // Le tri est automatique (ASC par défaut) - NE PAS ENVOYER ce paramètre

  p.append('page', String(f.page ?? 1));
  p.append('per_page', String(f.limit ?? 25));
  return p;
}
