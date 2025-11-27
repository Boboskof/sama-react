import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import adminService from '../_services/admin.service';

// Hook pour récupérer la liste des utilisateurs
export const useUsers = (filters: {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
} = {}) => {
  return useQuery({
    queryKey: ['users', 'list', filters],
    queryFn: () => adminService.getUsers(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  });
};

// Hook pour les statistiques d'audit (admin)
export const useAdminAuditStats = () => {
  return useQuery({
    queryKey: ['admin', 'audit-stats'],
    queryFn: () => adminService.getAuditStatistics(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
};

// Hook pour activer/désactiver un utilisateur
export const useToggleUserStatus = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: boolean }) =>
      adminService.toggleUserStatus(userId, status),
    onSuccess: () => {
      // Invalider et recharger la liste des utilisateurs
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};

// Hook pour supprimer un utilisateur
export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (userId: string) => adminService.deleteUser(userId),
    onSuccess: () => {
      // Invalider et recharger la liste des utilisateurs
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};

