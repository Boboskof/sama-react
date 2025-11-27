// Helpers pour les exercices

export type ExerciseAssignmentStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'REVIEWED';

export interface StatusBadgeConfig {
  label: string;
  color: string;
  icon: string;
  bgColor: string;
  textColor: string;
}

export const EXERCISE_STATUS_CONFIG: Record<ExerciseAssignmentStatus, StatusBadgeConfig> = {
  ASSIGNED: {
    label: 'Assigné',
    color: 'gray',
    icon: '📋',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800',
  },
  IN_PROGRESS: {
    label: 'En cours',
    color: 'blue',
    icon: '✏️',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
  },
  COMPLETED: {
    label: 'Terminé',
    color: 'orange',
    icon: '✅',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-800',
  },
  REVIEWED: {
    label: 'Corrigé',
    color: 'green',
    icon: '✓',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
  },
};

/**
 * Retourne la configuration du badge pour un statut d'exercice
 */
export function getExerciseStatusBadge(status: string | null | undefined): StatusBadgeConfig {
  if (!status || !(status in EXERCISE_STATUS_CONFIG)) {
    return EXERCISE_STATUS_CONFIG.ASSIGNED;
  }
  return EXERCISE_STATUS_CONFIG[status as ExerciseAssignmentStatus];
}

/**
 * Retourne les classes Tailwind pour le badge de statut
 */
export function getExerciseStatusBadgeClasses(status: string | null | undefined): string {
  const config = getExerciseStatusBadge(status);
  return `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`;
}

/**
 * Retourne le label du statut
 */
export function getExerciseStatusLabel(status: string | null | undefined): string {
  const config = getExerciseStatusBadge(status);
  return `${config.icon} ${config.label}`;
}

