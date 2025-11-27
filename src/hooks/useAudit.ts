import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import auditService from '../_services/audit.service';

// Hook pour récupérer les logs d'audit avec filtres
export const useAuditLogs = (filters: {
  page?: number;
  limit?: number;
  user_id?: string;
  action?: string | string[];
  entity_type?: string;
  date_from?: string;
  date_to?: string;
  patient_id?: string;
} = {}) => {
  return useQuery({
    queryKey: ['audit', 'logs', filters],
    queryFn: () => auditService.getAuditLogs(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  });
};

// Hook pour les statistiques d'audit globales
export const useAuditStats = (params: { date_from?: string; date_to?: string } = {}) => {
  return useQuery({
    queryKey: ['audit', 'stats', params],
    queryFn: () => auditService.getAuditStats(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
};

// Hook pour les statistiques d'audit par utilisateur
export const useAuditStatsByUser = (params: {} = {}) => {
  return useQuery({
    queryKey: ['audit', 'stats', 'by-user', params],
    queryFn: () => auditService.getStatisticsByUser(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
};

// Hook pour les statistiques d'audit par action
export const useAuditStatsByAction = (params: {} = {}) => {
  return useQuery({
    queryKey: ['audit', 'stats', 'by-action', params],
    queryFn: () => auditService.getStatisticsByAction(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
};

// Hook pour les statistiques d'audit par entité
export const useAuditStatsByEntity = (params: {} = {}) => {
  return useQuery({
    queryKey: ['audit', 'stats', 'by-entity', params],
    queryFn: () => auditService.getStatisticsByEntity(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
};

// Hook pour les statistiques d'audit par période
export const useAuditStatsByPeriod = (
  timeRange: 'day' | 'week' | 'month' | 'custom',
  params: { date_from?: string; date_to?: string } = {}
) => {
  return useQuery({
    queryKey: ['audit', 'stats', 'by-period', timeRange, params],
    queryFn: () => auditService.getStatisticsByPeriod(timeRange, params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
};

// Hook pour rechercher des logs d'audit
export const useSearchAudit = (params: {
  user_id?: string;
  action?: string;
  entity_type?: string;
  date_from?: string;
  date_to?: string;
  patient_id?: string;
  limit?: number;
} = {}) => {
  return useQuery({
    queryKey: ['audit', 'search', params],
    queryFn: () => auditService.searchAudit(params),
    enabled: Object.keys(params).length > 0, // Ne chercher que si des paramètres sont fournis
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  });
};

