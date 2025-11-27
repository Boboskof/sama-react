import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import formateurService from '../_services/formateur.service';

// Hook pour récupérer la liste des stagiaires
export const useStagiaires = () => {
  return useQuery<any[]>({
    queryKey: ['stagiaires', 'list'],
    queryFn: async () => {
      const raw: any = await formateurService.getAllStagiaires();
      const list = Array.isArray(raw)
        ? raw
        : (Array.isArray(raw?.data) ? raw.data : []);
      return list as any[];
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

// Hook pour récupérer les détails d'un stagiaire
export const useStagiaireDetails = (stagiaireId: string | number | null, enabled = true) => {
  return useQuery({
    queryKey: ['stagiaires', 'detail', stagiaireId],
    queryFn: () => formateurService.getStagiaireDetails(String(stagiaireId)),
    enabled: enabled && stagiaireId != null,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Hook pour créer un stagiaire
export const useCreateStagiaire = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: {
      email: string;
      password: string;
      prenom: string;
      nom: string;
      typeStagiaire?: string;
      section?: string;
    }) => formateurService.createStagiaire(data),
    onSuccess: () => {
      // Invalider et recharger la liste des stagiaires
      queryClient.invalidateQueries({ queryKey: ['stagiaires'] });
    },
  });
};

// Hook pour récupérer les données du dashboard formateur
export const useDashboardFormateur = () => {
  return useQuery({
    queryKey: ['formateur', 'dashboard'],
    queryFn: () => formateurService.getDashboardData(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  });
};

