import Axios from './caller.service';
import { mergePatchHeaders } from './service.utils';

export type StatutHospitalisation =
  | 'proposed'
  | 'pre_admission'
  | 'scheduled'
  | 'admitted'
  | 'discharged'
  | 'cancelled';

export interface Hospitalisation {
  id: string;
  patient: string; // uuid
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
    });
    if (!resp || resp.status >= 400) return [];
    const data = resp.data;
    return (data?.['hydra:member'] ?? data?.data ?? data ?? []) as Hospitalisation[];
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
    return (data?.['hydra:member'] ?? data?.data ?? data ?? []) as Hospitalisation[];
  },

  async listAll(params: Record<string, any> = {}): Promise<Hospitalisation[]> {
    const resp = await Axios.get('/hospitalisations', {
      params,
      validateStatus: () => true,
      headers: { 'X-Silent-Errors': '1' },
    });
    if (!resp || resp.status >= 400) return [];
    const data = resp.data;
    return (data?.['hydra:member'] ?? data?.data ?? data ?? []) as Hospitalisation[];
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
};

export default hospitalisationService;


