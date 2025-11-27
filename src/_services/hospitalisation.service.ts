import Axios from './caller.service';
import { mergePatchHeaders, unwrapList } from './service.utils';

export type StatutHospitalisation =
  | 'proposed'
  | 'pre_admission'
  | 'scheduled'
  | 'admitted'
  | 'discharged'
  | 'cancelled';

export interface Hospitalisation {
  id: string;
  patient: string | { id: string; nom?: string; prenom?: string; genre?: string }; // uuid ou objet patient
  statut: StatutHospitalisation;
  motifAdministratif?: string;
  preAdmissionDate?: string;
  plannedAdmissionDate?: string;
  plannedDischargeDate?: string;
  admittedAt?: string;
  dischargedAt?: string;
  uniteService?: string;
  chambre?: string;
  lit?: string;
  mutuelleSnapshot?: Record<string, unknown>;
  checklist?: Record<string, boolean>;
  contactUrgenceNom?: string;
  contactUrgenceTelephone?: string;
  decisionPar?: string;
  decisionAt?: string;
  rendezVousPreAdmission?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type SearchHospitalisationsQuery = {
  patient_id?: string;
  status?: string;
  date_from?: string; // ISO date
  date_to?: string;   // ISO date
};

const hospitalisationService = {
  async list(patientId: string, params: Record<string, any> = {}): Promise<Hospitalisation[]> {
    // Toujours résoudre la promesse (même en 4xx/5xx) pour garder l'UI silencieuse
    const q = { 'patient.id': patientId, ...params };
    const resp = await Axios.get('/hospitalisations', {
      params: q,
      validateStatus: () => true,
      headers: { 'X-Silent-Errors': '1' },
      timeout: 30000, // OPTIMISATION: Timeout augmenté à 30 secondes
    });
    if (!resp || resp.status >= 400) return [];
    const data = resp.data;
    return unwrapList<Hospitalisation>(data);
  },

  // Unified search endpoint (maps to /hospitalisations/search with custom params)
  async search(params: SearchHospitalisationsQuery = {}): Promise<Hospitalisation[]> {
    const p = new URLSearchParams();
    if (params.patient_id) p.set('patient_id', params.patient_id);
    if (params.status) p.set('status', params.status);
    if (params.date_from) p.set('date_from', params.date_from);
    if (params.date_to) p.set('date_to', params.date_to);
    const resp = await Axios.get(`/hospitalisations/search?${p.toString()}`, {
      validateStatus: () => true,
      headers: { 'X-Silent-Errors': '1' },
    });
    if (!resp || resp.status >= 400) return [];
    const data = resp.data;
    return unwrapList<Hospitalisation>(data);
  },

  async listAll(params: Record<string, any> = {}, userId?: string | number): Promise<Hospitalisation[]> {
    // OPTIMISATION: Utiliser l'endpoint optimisé pour éviter les timeouts
    const optimizedParams: Record<string, any> = {
      limit: 10, // OPTIMISATION: Limite réduite à 10 pour chargement très rapide
      page: 1,
      ...params
    };
    
    // Si userId est fourni, filtrer par créateur
    // API Platform accepte plusieurs formats pour le filtrage
    if (userId) {
      const userIdStr = String(userId);
      const userIri = typeof userId === 'number' ? `/api/users/${userId}` : (userId.startsWith('/api/') ? userId : `/api/users/${userId}`);
      // Ajouter plusieurs formats pour compatibilité avec API Platform
      optimizedParams['createdBy'] = userIri;
      optimizedParams['createdBy.id'] = userIdStr;
      optimizedParams['created_by'] = userIdStr;
    }
    
    // OPTIMISATION: Utiliser l'endpoint optimisé /hospitalisations/list au lieu de /hospitalisations
    const resp = await Axios.get('/hospitalisations/list', {
      params: optimizedParams,
      validateStatus: () => true,
      headers: { 'X-Silent-Errors': '1' },
      timeout: 30000, // OPTIMISATION: Timeout augmenté à 30 secondes pour les hospitalisations
    });
    if (!resp || resp.status >= 400) {
      // Fallback sur l'endpoint standard si l'optimisé n'existe pas
      const fallbackResp = await Axios.get('/hospitalisations', {
        params: { ...optimizedParams, 'order[createdAt]': 'desc' },
        validateStatus: () => true,
        headers: { 'X-Silent-Errors': '1' },
        timeout: 30000,
      });
      if (!fallbackResp || fallbackResp.status >= 400) {
        return [];
      }
      const fallbackData = fallbackResp.data;
      return unwrapList<Hospitalisation>(fallbackData);
    }
    const data = resp.data;
    // L'endpoint optimisé retourne hydra:member directement
    if (data['hydra:member']) {
      return data['hydra:member'] as Hospitalisation[];
    }
    // Fallback sur unwrapList si le format est différent
    return unwrapList<Hospitalisation>(data);
  },

  // OPTIMISATION: Méthode pour récupérer une seule hospitalisation
  async getOne(id: string): Promise<Hospitalisation | null> {
    try {
      const resp = await Axios.get(`/hospitalisations/${id}`, {
        validateStatus: () => true,
        headers: { 'X-Silent-Errors': '1' },
      });
      if (!resp || resp.status >= 400) {
        return null;
      }
      return resp.data as Hospitalisation;
    } catch {
      return null;
    }
  },

  async create(payload: Partial<Hospitalisation> & { patient: string }): Promise<Hospitalisation> {
    const patientValue = payload.patient?.startsWith?.('/api/') ? payload.patient : `/api/patients/${payload.patient}`;
    const body = { ...payload, patient: patientValue };
    const { data } = await Axios.post('/hospitalisations', body);
    return (data?.data ?? data) as Hospitalisation;
  },

  async patch(id: string, patch: Partial<Hospitalisation>): Promise<Hospitalisation> {
    const { data } = await Axios.patch(`/hospitalisations/${id}`, patch, mergePatchHeaders);
    return data as Hospitalisation;
  },

  // Actions
  async postPreAdmission(id: string, body: { checklist?: Record<string, boolean>; preAdmissionDate?: string }) {
    const { data } = await Axios.post(`/hospitalisations/${id}/pre-admission`, body);
    return data;
  },

  async postSchedule(id: string, body: { plannedAdmissionDate: string; plannedDischargeDate?: string; uniteService?: string; createRdvPreAdmission?: boolean; rdv?: { startAt?: string; endAt?: string; motif?: string; lieu?: string }; force?: boolean; }) {
    const { data } = await Axios.post(`/hospitalisations/${id}/schedule`, body);
    return data;
  },

  async postAdmit(id: string, body: { admittedAt?: string; chambre?: string; lit?: string; force?: boolean }) {
    const { data } = await Axios.post(`/hospitalisations/${id}/admit`, body);
    return data;
  },

  async postDischarge(id: string, body: { dischargedAt?: string; force?: boolean }) {
    const { data } = await Axios.post(`/hospitalisations/${id}/discharge`, body);
    return data;
  },

  async postCancel(id: string, body: { motifAdministratif: string; force?: boolean }) {
    const { data } = await Axios.post(`/hospitalisations/${id}/cancel`, body);
    return data;
  },

  async delete(id: string): Promise<void> {
    const { data } = await Axios.delete(`/hospitalisations/${id}`);
    return data;
  },
};

export default hospitalisationService;

