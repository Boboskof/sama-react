import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { communicationService } from '../_services/communication.service';
import { UICommFilters } from '../_services/query/communications.query';

// Hook pour récupérer les communications avec TanStack Query
export const useCommunications = (filters: UICommFilters = {}) => {
  return useQuery({
    queryKey: ['communications', filters],
    queryFn: () => communicationService.getCommunications(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Hook pour les statistiques des communications
export const useCommunicationStats = (filters: UICommFilters = {}) => {
  return useQuery({
    queryKey: ['communications', 'stats', filters],
    queryFn: () => communicationService.getCommunicationStatistics(filters),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Hook pour les types de communications
export const useCommunicationTypes = () => {
  return useQuery({
    queryKey: ['communications', 'types'],
    queryFn: () => communicationService.getCommunicationTypes(),
    staleTime: 30 * 60 * 1000, // 30 minutes (rarement changent)
  });
};

// Hook pour créer une communication
export const useCreateCommunication = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: any) => communicationService.createCommunication(data),
    onSuccess: () => {
      // Invalider et recharger les communications
      queryClient.invalidateQueries({ queryKey: ['communications'] });
    },
  });
};

// Hook pour envoyer une communication
export const useSendCommunication = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => communicationService.sendCommunication(id),
    onSuccess: () => {
      // Invalider et recharger les communications
      queryClient.invalidateQueries({ queryKey: ['communications'] });
    },
  });
};
