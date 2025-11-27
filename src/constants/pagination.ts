/**
 * Constantes de pagination pour éviter la surcharge du backend
 * 
 * ⚠️ IMPORTANT: 
 * - Garder les limites raisonnables (25/50 max recommandé)
 * - Pour les exports ou stats globales, utiliser les endpoints backend dédiés
 * - Ne jamais utiliser les listes paginées pour calculer des stats/exports
 */

export const PAGINATION_LIMITS = {
  // Limites par défaut pour les listes principales
  DEFAULT: 20,
  SMALL: 10,
  MEDIUM: 25,
  LARGE: 50,
  MAX: 50, // Maximum recommandé pour éviter la surcharge
} as const;

// Limites spécifiques par type de ressource
export const RESOURCE_LIMITS = {
  PATIENTS: 20,
  APPOINTMENTS: 25,
  DOCUMENTS: 30,
  COMMUNICATIONS: 25,
  AUDIT_LOGS: 50,
  STAGIAIRES: 30,
} as const;

