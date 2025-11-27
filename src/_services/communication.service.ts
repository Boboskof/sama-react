import Axios from "./caller.service";
import { getNotificationMode, simulateSend } from "../utils/notificationMock";
import { safeGetList, safeGetObject, mergePatchHeaders } from "./service.utils";
import { buildCommParams, UICommFilters } from "./query/communications.query";

// Types pour les communications
export interface Communication {
  id: string;
  patient_id: string;
  rendez_vous_id?: string;
  type: 'RAPPEL_RDV' | 'DEMANDE_DOC' | 'ENVOI_DOC' | 'CONFIRMATION_RDV' | 'ANNULATION_RDV' | 'RESULTATS_ANALYSES' | 'RAPPEL_VACCINATION';
  canal: 'EMAIL' | 'SMS' | 'TELEPHONE';
  sujet: string;
  contenu: string;
  statut: 'ENVOYE' | 'EN_ATTENTE' | 'ECHEC' | 'BROUILLON';
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  errorMessage?: string;
}

export interface CommunicationFilters {
  dateDebut?: string;
  dateFin?: string;
  periode?: string;
  type?: string[];
  canal?: string[];
  statut?: string[];
  patient?: string;
  patientNom?: string;
  creePar?: string;
  recherche?: string;
  page?: number;
  limit?: number;
}

export interface CommunicationStats {
  total: number;
  envoyees: number;
  enAttente: number;
  echecs: number;
  aujourdhui: number;
  cetteSemaine: number;
  tauxReussite: number;
  parType: Record<string, { total: number; reussite: number; echec: number }>;
  parCanal: Record<string, { total: number; reussite: number; echec: number }>;
}

export interface CommunicationTemplate {
  id: string;
  nom: string;
  type: string;
  sujet: string;
  contenu: string;
  variables: string[];
}

// Service de communication
export const communicationService = {
  // Récupérer la liste des communications avec mappeur centralisé
  async getCommunications(filters: UICommFilters = {}): Promise<Communication[]> {
    try {
      const params = buildCommParams(filters);
      
      // Filtrer par créateur automatiquement pour les stagiaires (non formateur/admin)
      // SAUF si skipAutoFilter est activé OU si createdBy est explicitement défini
      const skipAutoFilter = filters.skipAutoFilter === true;
      const hasExplicitCreatedBy = filters.createdBy !== undefined;
      
      if (!skipAutoFilter && !hasExplicitCreatedBy) {
      try {
        const userRaw = localStorage.getItem('user');
        if (userRaw) {
          const me = JSON.parse(userRaw);
          const roles: string[] = me?.roles || [];
          const isFormateur = roles.includes('ROLE_FORMATEUR') || roles.includes('ROLE_ADMIN');
          if (!isFormateur && me?.id) {
            const uid = String(me.id);
            const userIri = me['@id'] || `/api/users/${me.id}`;
            // Paramètre exact requis par l'API: created_by = UUID
            params.set('created_by', uid);
            // Compat éventuelle: on ajoute d'autres clés si non présentes
            if (!params.has('createdBy.id')) params.append('createdBy.id', uid);
            if (!params.has('creePar.id')) params.append('creePar.id', uid);
            if (!params.has('uploadedBy.id')) params.append('uploadedBy.id', uid);
            if (!params.has('createdBy')) params.append('createdBy', userIri);
            if (!params.has('creePar')) params.append('creePar', userIri);
            if (!params.has('uploadedBy')) params.append('uploadedBy', userIri);
            if (!params.has('user')) params.append('user', userIri);
            if (!params.has('user.id')) params.append('user.id', uid);
          }
        }
      } catch {}
      }
      
      // Si createdBy est explicitement défini, l'utiliser
      if (hasExplicitCreatedBy) {
        params.set('created_by', String(filters.createdBy));
      }
      
      // Utiliser la forme params pour éviter toute redirection en chaîne
      const resp = await Axios.get('/communications/', { params });
      const payload = resp?.data as any;
      
      // Supporte plusieurs formats de réponse: {data:[...]}, Hydra {"hydra:member":[...]}, ou {member:[...]}
      const list = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.["hydra:member"]) 
          ? payload["hydra:member"]
          : Array.isArray(payload?.member)
            ? payload.member
            : Array.isArray(payload)
              ? payload
              : [];
      
      
      return list as Communication[];
    } catch (error) {
      console.error("Erreur lors de la récupération des communications:", error);
      throw error;
    }
  },

  // Formateur: communications créées par des stagiaires (pagination page/per_page)
  async getFormateurCommunications(page: number = 1, perPage: number = 25): Promise<Communication[]> {
    try {
      const resp = await Axios.get('/formateur/communications', { params: { page, per_page: perPage } });
      const payload = resp?.data as any;
      const list = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.["hydra:member"]) 
          ? payload["hydra:member"]
          : Array.isArray(payload?.member)
            ? payload.member
            : Array.isArray(payload)
              ? payload
              : [];
      return list as Communication[];
    } catch (error) {
      console.error('Erreur lors de la récupération des communications formateur:', error);
      return [];
    }
  },

  // Envoyer un rappel de rendez-vous (backend: POST /communications/rappel-rendez-vous/{rendezVousId})
  async sendAppointmentReminder(rendezVousId: string | number, data?: Record<string, any>): Promise<Communication> {
    try {
      return await safeGetObject<Communication>(Axios.post(`/communications/rappel-rendez-vous/${rendezVousId}`, data ?? {}));
    } catch (error) {
      console.error(`Erreur lors de l'envoi du rappel RDV ${rendezVousId}:`, error);
      throw error;
    }
  },

  // Récupérer une communication par ID
  async getCommunication(id: string): Promise<Communication> {
    try {
      return await safeGetObject<Communication>(Axios.get(`/communications/${id}`));
    } catch (error) {
      console.error(`Erreur lors de la récupération de la communication ${id}:`, error);
      throw error;
    }
  },

  // Créer une nouvelle communication
  async createCommunication(data: Partial<Communication>): Promise<Communication> {
    try {
      // Trailing slash évite la redirection 301 qui casse les POST (→ 405)
      return await safeGetObject<Communication>(Axios.post('/communications/', data));
    } catch (error) {
      console.error("Erreur lors de la création de la communication:", error);
      throw error;
    }
  },

  // Envoyer un rappel de rendez-vous via l'endpoint spécialisé
  async sendRappelRendezVous(rendezVousId: string, data: Partial<Communication>): Promise<Communication> {
    try {
      return await safeGetObject<Communication>(Axios.post(`/communications/rappel-rendez-vous/${rendezVousId}`, data));
    } catch (error) {
      console.error(`Erreur lors de l'envoi du rappel RDV ${rendezVousId}:`, error);
      throw error;
    }
  },

  // Envoyer une confirmation de rendez-vous (endpoint spécialisé)
  async sendConfirmationRendezVous(rendezVousId: string, data: Partial<Communication>): Promise<Communication> {
    try {
      return await safeGetObject<Communication>(Axios.post(`/communications/confirmation-rendez-vous/${rendezVousId}`, data));
    } catch (error) {
      console.error(`Erreur lors de l'envoi de la confirmation RDV ${rendezVousId}:`, error);
      throw error;
    }
  },

  // Envoyer une annulation de rendez-vous (endpoint spécialisé)
  async sendAnnulationRendezVous(rendezVousId: string, data: Partial<Communication>): Promise<Communication> {
    try {
      return await safeGetObject<Communication>(Axios.post(`/communications/annulation-rendez-vous/${rendezVousId}`, data));
    } catch (error) {
      console.error(`Erreur lors de l'envoi de l'annulation RDV ${rendezVousId}:`, error);
      throw error;
    }
  },

  // Envoyer une demande de documents (endpoint dédié)
  async sendDemandeDocuments(data: Partial<Communication>): Promise<Communication> {
    try {
      return await safeGetObject<Communication>(Axios.post(`/communications/demande-documents`, data));
    } catch (error) {
      console.error('Erreur lors de l\'envoi de la demande de documents:', error);
      throw error;
    }
  },

  // Mettre à jour une communication
  async updateCommunication(id: string, data: Partial<Communication>): Promise<Communication> {
    try {
      // Utiliser merge-patch pour éviter 415 Unsupported Media Type
      return await safeGetObject<Communication>(Axios.patch(`/communications/${id}`, data, mergePatchHeaders));
    } catch (error) {
      console.error(`Erreur lors de la mise à jour de la communication ${id}:`, error);
      throw error;
    }
  },

  // Supprimer une communication
  async deleteCommunication(id: string): Promise<void> {
    try {
      await Axios.delete(`/communications/${id}`);
    } catch (error) {
      console.error(`Erreur lors de la suppression de la communication ${id}:`, error);
      throw error;
    }
  },

  // Récupérer les statistiques des communications (supporte dateDebut/dateFin côté UI)
  async getCommunicationStatistics(filters: { dateDebut?: string; dateFin?: string } = {}): Promise<any> {
    try {
      const params: Record<string, string> = {};
      if (filters.dateDebut) params.date_from = filters.dateDebut;
      if (filters.dateFin) params.date_to = filters.dateFin;

      const response = await Axios.get('/communications/statistics', { params });
      return response.data || {};
    } catch (error) {
      console.error("Erreur lors de la récupération des statistiques:", error);
      throw error;
    }
  },

  // Nouveau: endpoint de compteur agrégé (filtré automatiquement par utilisateur si stagiaire)
  async getStatusSummary(): Promise<{ total_envoyees: number; envoyees_aujourdhui: number; echecs: number }>{
    try {
      const resp = await Axios.get('/status/communications');
      const d = (resp.data?.data ?? resp.data) as any;
      return {
        total_envoyees: Number(d?.total_envoyees ?? 0),
        envoyees_aujourdhui: Number(d?.envoyees_aujourdhui ?? 0),
        echecs: Number(d?.echecs ?? 0),
      };
    } catch (error) {
      console.error('Erreur statut communications (status/communications):', error);
      return { total_envoyees: 0, envoyees_aujourdhui: 0, echecs: 0 };
    }
  },

  // Envoyer une communication
  async sendCommunication(id: string): Promise<Communication> {
    const mode = getNotificationMode();
    
    if (mode === 'mock') {
      const sim = await simulateSend({ id, action: 'send' });
      return {
        id: String(id),
        patient_id: '',
        type: 'RAPPEL_RDV',
        canal: 'EMAIL',
        sujet: '',
        contenu: '',
        statut: sim.success ? 'ENVOYE' : 'ECHEC',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sentAt: sim.sentAt,
        errorMessage: sim.errorMessage,
      } as Communication;
    }
    if (mode === 'noop') {
      return {
        id: String(id),
        patient_id: '',
        type: 'RAPPEL_RDV',
        canal: 'EMAIL',
        sujet: '',
        contenu: '',
        statut: 'EN_ATTENTE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Communication;
    }
    
    // Mode API - vrais appels
    try {
      const respPromise = Axios.post(`/communications/${id}/send`);
      // Optionnel: tap response for logging
      const result = await safeGetObject<Communication>(respPromise);
      return result;
    } catch (error) {
      console.error(`Erreur lors de l'envoi de la communication ${id}:`, error);
      throw error;
    }
  },

  // Renvoyer une communication échouée
  async resendCommunication(id: string): Promise<Communication> {
    const mode = getNotificationMode();
    if (mode === 'mock') {
      const sim = await simulateSend({ id, action: 'resend' });
      return {
        id: String(id),
        patient_id: '',
        type: 'RAPPEL_RDV',
        canal: 'EMAIL',
        sujet: '',
        contenu: '',
        statut: sim.success ? 'ENVOYE' : 'ECHEC',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sentAt: sim.sentAt,
        errorMessage: sim.errorMessage,
      } as Communication;
    }
    if (mode === 'noop') {
      return {
        id: String(id),
        patient_id: '',
        type: 'RAPPEL_RDV',
        canal: 'EMAIL',
        sujet: '',
        contenu: '',
        statut: 'EN_ATTENTE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Communication;
    }
    try {
      return await safeGetObject<Communication>(Axios.post(`/communications/${id}/resend`));
    } catch (error) {
      console.error(`Erreur lors du renvoi de la communication ${id}:`, error);
      throw error;
    }
  },

  // Dupliquer une communication
  async duplicateCommunication(id: string): Promise<Communication> {
    try {
      return await safeGetObject<Communication>(Axios.post(`/communications/${id}/duplicate`));
    } catch (error) {
      console.error(`Erreur lors de la duplication de la communication ${id}:`, error);
      throw error;
    }
  },

  // Récupérer les statistiques des communications
  async getCommunicationStats(filters: CommunicationFilters = {}): Promise<CommunicationStats> {
    try {
      const params = new URLSearchParams();
      
      if (filters.dateDebut) params.append('dateDebut', filters.dateDebut);
      if (filters.dateFin) params.append('dateFin', filters.dateFin);
      if (filters.periode) params.append('periode', filters.periode);
      if (filters.creePar) params.append('creePar', filters.creePar);

      return await safeGetObject<CommunicationStats>(Axios.get(`/communications/statistics?${params.toString()}`));
    } catch (error) {
      console.error("Erreur lors de la récupération des statistiques:", error);
      throw error;
    }
  },

  // Récupérer les types de communications disponibles
  async getCommunicationTypes(): Promise<string[]> {
    try {
      return await safeGetList<string>(Axios.get('/communications/types'));
    } catch (error) {
      console.error("Erreur lors de la récupération des types:", error);
      throw error;
    }
  },

  // Récupérer les templates de communications
  async getCommunicationTemplates(): Promise<CommunicationTemplate[]> {
    try {
      return await safeGetList<CommunicationTemplate>(Axios.get('/communications/templates'));
    } catch (error) {
      console.error("Erreur lors de la récupération des templates:", error);
      throw error;
    }
  },

  // Prévisualiser une communication
  async previewCommunication(data: Partial<Communication>): Promise<{ sujet: string; contenu: string }> {
    try {
      return await safeGetObject<{ sujet: string; contenu: string }>(Axios.post('/communications/preview', data));
    } catch (error) {
      console.error("Erreur lors de la prévisualisation:", error);
      throw error;
    }
  },

  // Récupérer les communications d'un patient
  async getPatientCommunications(patientId: string, filters: CommunicationFilters = {}): Promise<Communication[]> {
    try {
      const params = new URLSearchParams();
      params.append('patient', patientId);
      
      if (filters.type && filters.type.length > 0) {
        filters.type.forEach(type => params.append('type[]', type));
      }
      if (filters.canal && filters.canal.length > 0) {
        filters.canal.forEach(canal => params.append('canal[]', canal));
      }
      if (filters.statut && filters.statut.length > 0) {
        filters.statut.forEach(statut => params.append('statut[]', statut));
      }

      return await safeGetList<Communication>(Axios.get(`/communications?${params.toString()}`));
    } catch (error) {
      console.error(`Erreur lors de la récupération des communications du patient ${patientId}:`, error);
      throw error;
    }
  },

  // Récupérer les communications d'un rendez-vous
  async getAppointmentCommunications(appointmentId: string): Promise<Communication[]> {
    try {
      return await safeGetList<Communication>(Axios.get(`/communications?rendez_vous_id=${appointmentId}`));
    } catch (error) {
      console.error(`Erreur lors de la récupération des communications du RDV ${appointmentId}:`, error);
      throw error;
    }
  },

  // Marquer une communication comme lue
  async markAsRead(id: string): Promise<Communication> {
    try {
      return await safeGetObject<Communication>(Axios.patch(`/communications/${id}/read`));
    } catch (error) {
      console.error(`Erreur lors du marquage de la communication ${id} comme lue:`, error);
      throw error;
    }
  },

  // Archiver une communication
  async archiveCommunication(id: string): Promise<Communication> {
    try {
      return await safeGetObject<Communication>(Axios.patch(`/communications/${id}/archive`));
    } catch (error) {
      console.error(`Erreur lors de l'archivage de la communication ${id}:`, error);
      throw error;
    }
  },

  // Restaurer une communication archivée
  async restoreCommunication(id: string): Promise<Communication> {
    try {
      return await safeGetObject<Communication>(Axios.patch(`/communications/${id}/restore`));
    } catch (error) {
      console.error(`Erreur lors de la restauration de la communication ${id}:`, error);
      throw error;
    }
  }
};