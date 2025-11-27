import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import mutuelleService from '../_services/mutuelle.service';
import type { Mutuelle } from '../types/api';

// Lister toutes les mutuelles
export const useMutuelles = () => {
  return useQuery<Mutuelle[], Error>({
    queryKey: ['mutuelles', 'list'],
    queryFn: async () => {
      try {
        // Essayer d'abord la liste simple
        return await mutuelleService.getMutuellesList();
      } catch (err) {
        // Fallback vers getAllMutuelles
        console.warn('Erreur avec getMutuellesList, essai avec getAllMutuelles:', err);
        return await mutuelleService.getAllMutuelles();
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
};

// Rechercher des mutuelles
export const useSearchMutuelles = (query: string, limit: number = 10, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['mutuelles', 'search', query, limit],
    queryFn: () => mutuelleService.searchMutuelles(query, limit),
    enabled: enabled && query.trim().length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  });
};

// Obtenir une mutuelle par ID
export const useMutuelle = (id: string | null, enabled: boolean = true) => {
  return useQuery<Mutuelle, Error>({
    queryKey: ['mutuelles', 'detail', id],
    queryFn: () => mutuelleService.getMutuelleById(id as string),
    enabled: enabled && !!id,
    staleTime: 5 * 60 * 1000,
  });
};

// Obtenir mes mutuelles personnalisées
export const useMyCustomMutuelles = () => {
  return useQuery({
    queryKey: ['mutuelles', 'my-custom'],
    queryFn: () => mutuelleService.getMyCustomMutuelles(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

// Créer une mutuelle personnalisée
export const useCreateCustomMutuelle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (nom: string) => mutuelleService.createCustomMutuelle(nom),
    onSuccess: () => {
      // Invalider les caches concernés
      queryClient.invalidateQueries({ queryKey: ['mutuelles', 'my-custom'] });
      queryClient.invalidateQueries({ queryKey: ['mutuelles', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['mutuelles', 'search'] });
    },
  });
};

// Créer une mutuelle
export const useCreateMutuelle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mutuelleData: Partial<Mutuelle>) => mutuelleService.createMutuelle(mutuelleData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mutuelles'] });
    },
  });
};

// Modifier une mutuelle
export const useUpdateMutuelle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { id: string; mutuelleData: Partial<Mutuelle> }) =>
      mutuelleService.updateMutuelle(params.id, params.mutuelleData),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['mutuelles', 'detail', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['mutuelles', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['mutuelles', 'search'] });
    },
  });
};

// Supprimer une mutuelle
export const useDeleteMutuelle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => mutuelleService.deleteMutuelle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mutuelles'] });
    },
  });
};



