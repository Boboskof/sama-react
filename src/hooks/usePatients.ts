import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import patientService from '../_services/patient.service';
import { UIPatientFilters } from '../_services/query/patients.query';

// Hook pour récupérer la liste des patients avec filtres
export const usePatients = (filters: UIPatientFilters = {}, enabled = true) => {
  const isFormateur = typeof window !== 'undefined' && localStorage.getItem('user') 
    ? JSON.parse(localStorage.getItem('user') || '{}').isFormateur 
    : false;

  return useQuery({
    queryKey: ['patients', 'list', filters, { isFormateur }],
    queryFn: async () => {
      if (isFormateur) {
        return await patientService.getFormateurPatients(
          filters.page || 1,
          filters.limit || 20,
          {
            search: filters.search,
            date_from: filters.dateDebut,
            date_to: filters.dateFin,
          }
        );
      } else {
        return await patientService.getStagiairePatients(
          filters.page || 1,
          filters.limit || 20,
          {
            search: filters.search,
            date_from: filters.dateDebut,
            date_to: filters.dateFin,
          }
        );
      }
    },
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });
};

// Hook pour récupérer un patient spécifique
export const usePatient = (id: string | number | null, enabled = true) => {
  return useQuery({
    queryKey: ['patients', 'detail', id],
    queryFn: () => patientService.getOnePatient(id!),
    enabled: enabled && !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Hook pour les statistiques des patients (total, couvertures, etc.)
// ⚠️ IMPORTANT: Ces stats viennent TOUJOURS du backend, jamais de la liste paginée frontend
// Pour les exports ou stats globales, utiliser les endpoints backend dédiés
export const usePatientStats = (enabled = true) => {
  return useQuery({
    queryKey: ['patients', 'stats'],
    queryFn: async () => {
      // Appels backend pour stats globales (ne pas utiliser la liste paginée)
      const [totalCount, coverageStatus] = await Promise.allSettled([
        patientService.countAllPatients().catch(() => 0),
        patientService.getCoverageStatus().catch(() => ({ valides: 0, expirees: 0, manquantes: 0, total: 0 })),
      ]);

      return {
        total: totalCount.status === 'fulfilled' ? totalCount.value : 0,
        coverage: coverageStatus.status === 'fulfilled' ? coverageStatus.value : { valides: 0, expirees: 0, manquantes: 0, total: 0 },
      };
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
};

// Hook pour récupérer les couvertures d'un patient
export const usePatientCouvertures = (patientId: string | number | null, enabled = true) => {
  return useQuery({
    queryKey: ['patients', 'couvertures', patientId],
    queryFn: () => patientService.getPatientCouvertures(String(patientId!)),
    enabled: enabled && !!patientId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Hook pour récupérer les alertes de couverture
export const useCoverageAlerts = (enabled = true) => {
  return useQuery({
    queryKey: ['patients', 'coverage-alerts'],
    queryFn: () => patientService.getCoverageAlerts(),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
};

// Hook pour récupérer toutes les couvertures avec leurs statuts
export const useAllCoverages = (enabled = true) => {
  return useQuery({
    queryKey: ['patients', 'all-coverages'],
    queryFn: () => patientService.getAllCoverages(),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
};

// Hook pour créer un patient
export const useCreatePatient = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: any) => patientService.createPatient(data),
    onSuccess: () => {
      // Invalider et recharger les listes de patients
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
};

// Hook pour mettre à jour un patient
export const useUpdatePatient = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string | number; data: any }) => 
      patientService.patchPatient(id, data),
    onSuccess: (_, variables) => {
      // Invalider la liste et le détail du patient
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['patients', 'detail', variables.id] });
    },
  });
};

// Hook pour supprimer un patient
export const useDeletePatient = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string | number) => patientService.deletePatient(id),
    onSuccess: () => {
      // Invalider et recharger les listes de patients
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
};

