import Axios from './caller.service';
import { StagiaireNote } from '../types/api';

class StagiaireNoteService {
  /**
   * Récupérer les notes de l'utilisateur connecté (stagiaire uniquement)
   * Utilise /api/me/notes
   */
  async getMyNotes(order: 'ASC' | 'DESC' = 'DESC'): Promise<StagiaireNote[]> {
    try {
      const response = await Axios.get('/me/notes', {
        params: { order }
      });
      
      // Log de débogage pour voir la structure de la réponse
      if (import.meta.env.DEV) {
        console.log('📝 Réponse /api/me/notes:', response.data);
      }
      
      // L'endpoint retourne { data: [...], total: ... }
      // Essayer d'abord response.data.data (format standard)
      let data = response.data?.data;
      
      // Si ce n'est pas un tableau, essayer les autres formats API Platform
      if (!Array.isArray(data)) {
        data = response.data?.['hydra:member'] || response.data?.member;
      }
      
      // Si toujours pas un tableau, vérifier si response.data est directement un tableau
      if (!Array.isArray(data)) {
        data = Array.isArray(response.data) ? response.data : null;
      }
      
      // Log de débogage pour voir ce qui a été extrait
      if (import.meta.env.DEV) {
        console.log('📝 Notes extraites:', data);
      }
      
      return Array.isArray(data) ? data : [];
    } catch (error: any) {
      const status = error?.response?.status;
      
      // Log de débogage pour les erreurs
      if (import.meta.env.DEV) {
        console.error('❌ Erreur lors de la récupération des notes (me/notes):', {
          status,
          url: error?.config?.url,
          message: error?.message,
          response: error?.response?.data
        });
      }
      
      // 403 ou 404 : retourner un tableau vide (pas d'accès ou pas de notes)
      if (status === 403 || status === 404) {
        return [];
      }
      // 401 : laisser caller.service gérer la redirection
      if (status === 401) {
        throw error;
      }
      console.error('❌ Erreur lors de la récupération des notes (me/notes):', error);
      return [];
    }
  }

  /**
   * Récupérer toutes les notes d'un utilisateur (formateur uniquement)
   * Utilise /api/users/{userId}/notes avec fallback vers /api/stagiaires/{id}/notes
   */
  async getNotes(userId: string, order: 'ASC' | 'DESC' = 'DESC'): Promise<StagiaireNote[]> {
    try {
      // Essayer d'abord /users/{id}/notes (recommandé pour formateurs)
      let response;
      try {
        response = await Axios.get(`/users/${userId}/notes`, {
          params: { order }
        });
      } catch (err: any) {
        const status = err?.response?.status;
        // 403 ou 404 : essayer le fallback /stagiaires/{id}/notes
        if (status === 403 || status === 404) {
          try {
            response = await Axios.get(`/stagiaires/${userId}/notes`, {
              params: { order }
            });
          } catch (fallbackErr: any) {
            // Si le fallback échoue aussi avec 403/404, retourner []
            if (fallbackErr?.response?.status === 403 || fallbackErr?.response?.status === 404) {
              return [];
            }
            throw fallbackErr;
          }
        } else {
          throw err;
        }
      }
      
      // API Platform retourne les données dans member ou hydra:member
      const data = response.data?.data || response.data?.['hydra:member'] || response.data?.member || response.data;
      
      return Array.isArray(data) ? data : [];
    } catch (error: any) {
      const status = error?.response?.status;
      // 403 ou 404 : retourner un tableau vide
      if (status === 403 || status === 404) {
        return [];
      }
      // 401 : laisser caller.service gérer la redirection
      if (status === 401) {
        throw error;
      }
      console.error(`❌ Erreur lors de la récupération des notes pour l'utilisateur ${userId}:`, error);
      return [];
    }
  }

  /**
   * Récupérer une note spécifique
   * Utilise /api/users/{userId}/notes/{noteId} avec fallback
   */
  async getNote(userId: string, noteId: string): Promise<StagiaireNote> {
    try {
      let response;
      try {
        response = await Axios.get(`/users/${userId}/notes/${noteId}`);
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 404 || status === 403) {
          response = await Axios.get(`/stagiaires/${userId}/notes/${noteId}`);
        } else {
          throw err;
        }
      }
      return response.data?.data || response.data;
    } catch (error: any) {
      const status = error?.response?.status;
      // 401 : laisser caller.service gérer la redirection
      if (status === 401) {
        throw error;
      }
      console.error(`❌ Erreur lors de la récupération de la note ${noteId}:`, error);
      throw error;
    }
  }

  /**
   * Créer une note pour un utilisateur (formateur uniquement)
   * Utilise /api/users/{userId}/notes avec fallback
   */
  async createNote(userId: string, note: Partial<StagiaireNote>): Promise<StagiaireNote> {
    try {
      const payload = {
        contenu: note.contenu,
        categorie: note.categorie || 'GENERAL',
        importance: note.importance || 'INFO'
      };
      
      let response;
      try {
        response = await Axios.post(`/users/${userId}/notes`, payload);
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 404 || status === 403) {
          response = await Axios.post(`/stagiaires/${userId}/notes`, payload);
        } else {
          throw err;
        }
      }
      return response.data?.data || response.data;
    } catch (error: any) {
      const status = error?.response?.status;
      // 401 : laisser caller.service gérer la redirection
      if (status === 401) {
        throw error;
      }
      console.error(`❌ Erreur lors de la création de la note pour l'utilisateur ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Supprimer une note (formateur uniquement)
   * Utilise /api/users/{userId}/notes/{noteId} avec fallback
   */
  async deleteNote(userId: string, noteId: string): Promise<void> {
    try {
      try {
        await Axios.delete(`/users/${userId}/notes/${noteId}`);
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 404 || status === 403) {
          await Axios.delete(`/stagiaires/${userId}/notes/${noteId}`);
        } else {
          throw err;
        }
      }
    } catch (error: any) {
      const status = error?.response?.status;
      // 401 : laisser caller.service gérer la redirection
      if (status === 401) {
        throw error;
      }
      console.error(`❌ Erreur lors de la suppression de la note ${noteId}:`, error);
      throw error;
    }
  }
}

export default new StagiaireNoteService();

