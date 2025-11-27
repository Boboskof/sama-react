import Axios from "./caller.service";

// Types pour les résultats de recherche
export interface SearchResult {
  id: string;
  type: 'patient' | 'rendez_vous' | 'document' | 'communication';
  title: string;
  subtitle?: string;
  metadata?: {
    patient_name?: string;
    patient_id?: string;
    created_at?: string;
    statut?: string;
    canal?: string;
    [key: string]: any;
  };
}

export interface SearchResponse {
  data: SearchResult[];
  total: number;
  has_more: boolean;
  categories?: {
    [key: string]: {
      results: SearchResult[];
      total: number;
      has_more: boolean;
    };
  };
}

export interface SearchFilters {
  date_from?: string;
  date_to?: string;
  statut?: string;
  type?: string;
  canal?: string;
  patient_id?: string;
  page?: number;
  per_page?: number;
}

class SearchService {
  /**
   * Nettoie et valide les filtres pour n'envoyer que des paramètres scalaires
   */
  private sanitizeFilters(filters?: SearchFilters): Record<string, string | number> {
    if (!filters) return {};
    
    const sanitized: Record<string, string | number> = {};
    
    // Paramètres scalaires uniquement
    if (filters.date_from) sanitized.date_from = filters.date_from;
    if (filters.date_to) sanitized.date_to = filters.date_to;
    if (filters.statut) sanitized.statut = filters.statut;
    if (filters.type) sanitized.type = filters.type;
    if (filters.canal) sanitized.canal = filters.canal;
    if (filters.patient_id) sanitized.patient_id = filters.patient_id;
    if (filters.page) sanitized.page = filters.page;
    if (filters.per_page) sanitized.per_page = filters.per_page;
    
    return sanitized;
  }
  /**
   * Recherche globale multi-entités
   */
  async searchGlobal(query: string, options: {
    limit?: number;
    offset?: number;
    categories?: string[];
    filters?: SearchFilters;
  } = {}): Promise<SearchResponse> {
    const params = {
      q: query,
      per_page: options.limit || 10,
      page: Math.floor((options.offset || 0) / (options.limit || 10)) + 1,
      ...(options.categories && { categories: options.categories.join(',') }),
      ...this.sanitizeFilters(options.filters)
    };

    const response = await Axios.get('/search', { params });
    return response.data;
  }

  /**
   * Recherche rapide avec autocomplétion
   */
  async quickSearch(query: string, maxResults: number = 5): Promise<SearchResponse> {
    const params = {
      q: query,
      per_page: maxResults,
      page: 1
    };

    const response = await Axios.get('/search/quick', { params });
    return response.data;
  }

  /**
   * Recherche par catégorie
   */
  async searchByCategory(category: string, query: string, options: {
    limit?: number;
    offset?: number;
    filters?: SearchFilters;
  } = {}): Promise<SearchResponse> {
    const params = {
      q: query,
      per_page: options.limit || 25,
      page: Math.floor((options.offset || 0) / (options.limit || 25)) + 1,
      ...this.sanitizeFilters(options.filters)
    };

    const response = await Axios.get(`/search/${category}`, { params });
    return response.data;
  }

  /**
   * Recherche de patients
   */
  async searchPatients(query: string, options: {
    limit?: number;
    offset?: number;
    filters?: SearchFilters;
  } = {}): Promise<SearchResponse> {
    return this.searchByCategory('patients', query, options);
  }

  /**
   * Recherche de rendez-vous
   */
  async searchRendezVous(query: string, options: {
    limit?: number;
    offset?: number;
    filters?: SearchFilters;
  } = {}): Promise<SearchResponse> {
    return this.searchByCategory('rendez_vous', query, options);
  }

  /**
   * Recherche de documents
   */
  async searchDocuments(query: string, options: {
    limit?: number;
    offset?: number;
    filters?: SearchFilters;
  } = {}): Promise<SearchResponse> {
    return this.searchByCategory('documents', query, options);
  }

  /**
   * Recherche de communications
   */
  async searchCommunications(query: string, options: {
    limit?: number;
    offset?: number;
    filters?: SearchFilters;
  } = {}): Promise<SearchResponse> {
    return this.searchByCategory('communications', query, options);
  }

  /**
   * Lister les communications avec filtres simples (MVP)
   * 
   * Paramètres supportés (tous scalaires) :
   * - patient_id: ID du patient (UUID)
   * - type: Type de communication (string)
   * - statut: Statut de la communication (string)
   * - canal: Canal d'envoi (string)
   * - date_from: Date de début (Y-m-d)
   * - date_to: Date de fin (Y-m-d)
   * - page: Numéro de page (int, défaut: 1)
   * - per_page: Éléments par page (int, défaut: 25, max: 100)
   */
  async listCommunications(filters: SearchFilters = {}): Promise<{
    data: any[];
    pagination: {
      page: number;
      per_page: number;
      total: number;
      total_pages: number;
    };
  }> {
    const params = this.sanitizeFilters(filters);
    
    try {
      const response = await Axios.get('/communications/', { params });
      return response.data;
    } catch (error) {
      console.error("Erreur lors de la récupération des communications:", error);
      throw error;
    }
  }

  /**
   * Obtenir les types et canaux de communication disponibles
   */
  async getCommunicationTypes(): Promise<{
    types: Array<{ value: string; label: string; icon?: string; description?: string; template?: string }>;
    canals: Array<{ value: string; label: string; icon?: string }>;
  }> {
    try {
      const response = await Axios.get('/communications/types');
      return response.data;
    } catch (error) {
      // Types de fallback
      return {
        types: [
          { value: 'RAPPEL_RDV', label: 'Rappel de Rendez-vous', icon: 'calendar' },
          { value: 'DEMANDE_DOC', label: 'Demande de Document', icon: 'file-text' },
          { value: 'CONFIRMATION_RDV', label: 'Confirmation de Rendez-vous', icon: 'check-circle' },
          { value: 'ANNULATION_RDV', label: 'Annulation de Rendez-vous', icon: 'x-circle' },
          { value: 'RESULTATS_ANALYSES', label: 'Résultats d\'Analyses', icon: 'activity' },
          { value: 'RAPPEL_VACCINATION', label: 'Rappel de Vaccination', icon: 'shield' }
        ],
        canals: [
          { value: 'EMAIL', label: 'Email', icon: 'mail' },
          { value: 'SMS', label: 'SMS', icon: 'message-square' },
          { value: 'TELEPHONE', label: 'Téléphone', icon: 'phone' }
        ]
      };
    }
  }

  /**
   * Obtenir les statistiques des communications
   */
  async getCommunicationStatistics(filters: SearchFilters = {}): Promise<{
    total?: number;
    byStatus?: { [status: string]: number };
    byType?: { [type: string]: number };
    byCanal?: { [canal: string]: number };
  }> {
    try {
      const params: Record<string, string> = {};
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      
      const response = await Axios.get('/communications/statistics', { params });
      return response.data;
    } catch (error) {
      return {};
    }
  }

  /**
   * Recherche de mutuelles (utilise le service existant)
   */
  async searchMutuelles(query: string, limit: number = 10): Promise<any> {
    try {
      const response = await Axios.get('/mutuelles/search', { 
        params: { q: query, limit } 
      });
      return response.data;
    } catch (error) {
      return { results: [], total: 0 };
    }
  }
}

export const searchService = new SearchService();
