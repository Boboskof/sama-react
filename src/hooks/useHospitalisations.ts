import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import hospitalisationService from '../_services/hospitalisation.service';

// Hook pour récupérer toutes les hospitalisations (vue globale)
export const useAllHospitalisations = (
  params: Record<string, any> = {},
  userId?: string | number
) => {
  return useQuery({
    queryKey: ['hospitalisations', 'all', params, userId],
    queryFn: () => hospitalisationService.listAll(params, userId),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  });
};

// Hook pour supprimer une hospitalisation et invalider le cache
export const useDeleteHospitalisation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string | number) => hospitalisationService.delete(String(id)),
    onSuccess: (_data, id) => {
      // Nettoyer les listes en cache qui contiennent cette hospitalisation
      queryClient.setQueriesData(
        { queryKey: ['hospitalisations', 'all'] },
        (old: any) => {
          if (!old) return old;
          if (Array.isArray(old)) {
            return old.filter((h) => h.id !== id);
          }
          return old;
        }
      );
    },
  });
};


