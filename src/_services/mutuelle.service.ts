import Axios from './caller.service';
import { unwrapList } from './service.utils';

export interface Mutuelle {
  id: string;
  nom: string;
  code?: string;
  userCreated?: boolean;
  createdBy?: string;
  active?: boolean;
  createdAt?: string;
}

export interface SearchMutuellesResponse {
  mutuelles: Mutuelle[];
}

export interface CreateCustomMutuelleResponse {
  message: string;
  mutuelle: Mutuelle;
}

const mutuelleService = {
  // Rechercher des mutuelles existantes
  searchMutuelles(query: string, limit: number = 10): Promise<SearchMutuellesResponse> {
    // Essai 1: endpoint de recherche dédié; ne pas déclencher l'interceptor sur 404
    return Axios.get(`/mutuelles/search`, { 
      params: { q: query, limit },
      validateStatus: (status) => status === 200 || status === 404
    }).then(async (r) => {
      if (r.status === 200) return r.data as SearchMutuellesResponse;
      // 404 -> fallback local (liste complète filtrée côté client)
      try {
        const all = await mutuelleService.getAllMutuelles();
        const q = (query || '').toLowerCase();
        const filtered = all.filter(m =>
          (m.nom || '').toLowerCase().includes(q) || (m.code || '').toLowerCase().includes(q)
        ).slice(0, limit);
        return { mutuelles: filtered } as SearchMutuellesResponse;
      } catch {
        return { mutuelles: [] } as SearchMutuellesResponse;
      }
    });
  },

  // Créer une mutuelle personnalisée
  createCustomMutuelle(nom: string): Promise<CreateCustomMutuelleResponse> {
    return Axios.post('/mutuelles/create-custom', { nom })
      .then(r => r.data as CreateCustomMutuelleResponse);
  },

  // Obtenir mes mutuelles personnalisées
  getMyCustomMutuelles(): Promise<SearchMutuellesResponse> {
    return Axios.get('/mutuelles/my-custom')
      .then(r => r.data as SearchMutuellesResponse);
  },

  // Obtenir toutes les mutuelles (API Platform)
  getAllMutuelles(): Promise<Mutuelle[]> {
    return Axios.get('/mutuelles')
      .then(r => {
        if (import.meta.env.DEV) {
        }
        return unwrapList<Mutuelle>(r.data);
      })
      .catch(error => {
        throw error;
      });
  },

  // Obtenir la liste simple des mutuelles
  getMutuellesList(): Promise<Mutuelle[]> {
    return Axios.get('/mutuelles-list')
      .then(r => {
        if (import.meta.env.DEV) {
        }
        return unwrapList<Mutuelle>(r.data);
      })
      .catch(error => {
        throw error;
      });
  },

  // Obtenir une mutuelle par ID
  getMutuelleById(id: string): Promise<Mutuelle> {
    return Axios.get(`/mutuelles/${id}`)
      .then(r => r.data as Mutuelle);
  },

  // Créer une mutuelle
  createMutuelle(mutuelleData: Partial<Mutuelle>): Promise<Mutuelle> {
    return Axios.post('/mutuelles', mutuelleData)
      .then(r => r.data as Mutuelle);
  },

  // Modifier une mutuelle
  updateMutuelle(id: string, mutuelleData: Partial<Mutuelle>): Promise<Mutuelle> {
    return Axios.patch(`/mutuelles/${id}`, mutuelleData)
      .then(r => r.data as Mutuelle);
  },

  // Supprimer une mutuelle
  deleteMutuelle(id: string): Promise<void> {
    return Axios.delete(`/mutuelles/${id}`)
      .then(() => {});
  }
};

export default mutuelleService;
