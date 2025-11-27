import { useQuery } from '@tanstack/react-query';
import documentService from '../_services/document.service';
import Axios from '../_services/caller.service';

export interface DocumentFilters {
  type?: string;
  date_from?: string; // Format: YYYY-MM-DD
  date_to?: string;   // Format: YYYY-MM-DD
  archived?: boolean;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface DocumentListResponse {
  data: any[];
  pagination: {
    current_page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
  filters?: DocumentFilters;
  statistics?: {
    total_documents: number;
    total_size: number;
    archived_count: number;
    active_count: number;
    by_type: Record<string, number>;
  };
  quota?: {
    total_size: number;
    max_quota: number;
    remaining_quota: number;
    percentage_used: number;
  };
}

/**
 * Hook pour récupérer les documents avec filtres selon la documentation
 * @param patientId - ID du patient (optionnel)
 * @param filters - Filtres à appliquer
 */
export function useDocuments(
  patientId?: string | number,
  filters: DocumentFilters = {}
) {
  const endpoint = patientId 
    ? `/api/documents/patient/${patientId}`
    : '/api/documents';

  return useQuery<DocumentListResponse>({
    queryKey: ['documents', patientId, filters],
    queryFn: async () => {
      const response = await Axios.get(endpoint, {
        params: filters
      });
      return response.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook pour récupérer les documents (version compatible avec l'ancien code)
 * Utilise l'endpoint /documents avec les paramètres API Platform
 */
export function useDocumentsLegacy(params: Record<string, any> = {}) {
  return useQuery({
    queryKey: ['documents', 'legacy', params],
    queryFn: () => documentService.getDocuments(params),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

