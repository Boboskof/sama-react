import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import appointmentService from '../_services/appointment.service';

// Hook pour récupérer les rendez-vous d'aujourd'hui
export const useTodayAppointments = () => {
  return useQuery({
    queryKey: ['appointments', 'today'],
    queryFn: () => appointmentService.getTodayAppointments(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false, // Éviter les refetch trop fréquents
    refetchOnMount: true,
    refetchOnReconnect: true,
  });
};

// Hook pour récupérer les rendez-vous à venir
export const useUpcomingAppointments = () => {
  return useQuery({
    queryKey: ['appointments', 'upcoming'],
    queryFn: () => appointmentService.getUpcomingAppointments(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });
};

// Hook pour récupérer les rendez-vous avec filtres
export const useAppointments = (filters: any = {}) => {
  return useQuery({
    queryKey: ['appointments', 'list', filters],
    queryFn: () => appointmentService.getAllAppointments(filters),
    keepPreviousData: true,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: true,
  });
};

// Hook pour récupérer les statistiques des rendez-vous
export const useAppointmentStats = () => {
  return useQuery({
    queryKey: ['appointments', 'stats'],
    queryFn: () => appointmentService.getRendezVousStatus(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Hook pour créer un rendez-vous
export const useCreateAppointment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: any) => appointmentService.createAppointment(data),
    onSuccess: () => {
      // Invalider et recharger les rendez-vous
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
};

// Hook pour mettre à jour un rendez-vous
export const useUpdateAppointment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      appointmentService.updateAppointment(id, data),
    onSuccess: () => {
      // Invalider et recharger les rendez-vous
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
};

// Hook pour supprimer un rendez-vous
export const useDeleteAppointment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => appointmentService.deleteAppointment(id),
    onSuccess: () => {
      // Invalider et recharger les rendez-vous
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
};

