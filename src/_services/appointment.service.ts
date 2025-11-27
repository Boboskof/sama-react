// src/_services/appointment.service.ts
import Axios from "./caller.service";
import type { RendezVous } from "../types/api";
import { unwrapList, safeGetList, safeGetObject, enc, mergePatchHeaders } from './service.utils';
import { buildAppointmentParams, UIAppointmentFilters } from "./query/appointments.query";

// Normalise les paramètres front vers API Platform
function normalizeApptParams(params: Record<string, any>) {
  const p = { ...params };

  if (p.date) {
    // journée entière -> [after, before)
    p['start_at[after]'] = p.date;
    const d = new Date(p.date);
    d.setDate(d.getDate() + 1);
    p['start_at[before]'] = d.toISOString().slice(0,10);
    delete p.date;
  }
  if (p.dateFrom) { p['start_at[after]'] = p.dateFrom; delete p.dateFrom; }
  if (p.dateTo)   { p['start_at[before]'] = p.dateTo;  delete p.dateTo; }

  return p;
}

// Normalise la forme d'un RDV API (snake_case) vers un objet compatible UI
function normalizeRdvItem(item: any): RendezVous {
  if (!item || typeof item !== 'object') return item as RendezVous;
  const start_at = item.start_at ?? item.startAt ?? null;
  const end_at = item.end_at ?? item.endAt ?? null;
  const created_at = item.created_at ?? item.createdAt ?? null;
  const patient = item.patient ?? null;
  // Fournir les deux variantes pour compatibilité ascendante
  return {
    ...(item as any),
    start_at,
    end_at,
    created_at,
    startAt: start_at,
    endAt: end_at,
    createdAt: created_at,
    patient_id: patient?.id ?? item.patient_id ?? null,
  } as unknown as RendezVous;
}

const appointmentService = {
  /** Statistiques agrégées RDV (today, upcoming_7d, totaux par statut) */
  async getRendezVousStatus(): Promise<{ today: any; upcoming_7d: any; total_par_statut?: any; total_par_mention?: any }>{
    try {
      const resp = await Axios.get('/status/rendez-vous');
      const d: any = resp?.data?.data ?? resp?.data ?? {};
      return d;
    } catch (error) {
      // En cas d'indispo back, on laisse le composant retomber en fallback local sans bruit console
      return null as any;
    }
  },
  /** Liste générale (utilise l'endpoint par défaut) */
  getAppointments: async (params: Record<string, any> = {}): Promise<RendezVous[]> => {
    try {
      // OPTIMISATION: Utiliser sans slash final pour éviter les erreurs 502
      const response = await Axios.get("/rendez-vous", { params: normalizeApptParams(params) });
      
      // Supporte plusieurs formats: {data: [...]}, Hydra, tableau direct
      const data = response.data;
      const listRaw: any[] = Array.isArray(data)
        ? data
        : (data?.data
            || (Array.isArray(data?.["hydra:member"]) ? data["hydra:member"] : [])
            || []);
      const list = (listRaw as any[]).map(normalizeRdvItem);
      return list as RendezVous[];
    } catch (error) {
      throw error;
    }
  },

  /** Formateur: rendez-vous créés par des stagiaires (pagination page/per_page) 
   * Utilise l'endpoint principal /api/rendez-vous qui filtre automatiquement selon le rôle
   * Retourne { data: RendezVous[], pagination?: { total, page, per_page, total_pages } }
   */
  getFormateurAppointments: async (page: number = 1, perPage: number = 100): Promise<{ data: RendezVous[]; pagination?: { total: number; page: number; per_page: number; total_pages: number } }> => {
    try {
      // Utiliser l'endpoint principal recommandé pour le formateur
      // Le backend applique automatiquement le filtre selon le rôle (formateur voit tous)
      const response = await Axios.get('/rendez-vous', { 
        params: { 
          page, 
          per_page: perPage 
        } 
      });
      const data = response.data;
      const listRaw: any[] = Array.isArray(data)
        ? data
        : (data?.data
            || (Array.isArray(data?.["hydra:member"]) ? data["hydra:member"] : [])
            || []);
      
      const list = (listRaw as any[]).map(normalizeRdvItem);
      const pagination = data?.pagination || data?.meta || null;
      
      return {
        data: list as RendezVous[],
        pagination: pagination ? {
          total: pagination.total || list.length,
          page: pagination.page || pagination.current_page || page,
          per_page: pagination.per_page || pagination.perPage || perPage,
          total_pages: pagination.total_pages || pagination.totalPages || Math.ceil((pagination.total || list.length) / (pagination.per_page || pagination.perPage || perPage))
        } : undefined
      };
    } catch (error) {
      return { data: [] };
    }
  },

  /** Rendez-vous passés (start_at < NOW()) - Tri décroissant (plus récents en premier)
   * Filtre automatique par rôle : formateurs voient tous, stagiaires voient les leurs
   * Supporte pagination et filtres optionnels
   * Retourne { data: RendezVous[], pagination?: { total, page, per_page, total_pages } }
   */
  getPastAppointments: async (params: {
    page?: number;
    per_page?: number;
    date_debut?: string;
    date_fin?: string;
    patient_id?: string;
    praticien?: string;
    statut?: string;
  } = {}): Promise<{ data: RendezVous[]; pagination?: { total: number; page: number; per_page: number; total_pages: number; showing_from?: number; showing_to?: number } }> => {
    try {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.set('page', String(params.page));
      if (params.per_page) queryParams.set('per_page', String(params.per_page));
      if (params.date_debut) queryParams.set('date_debut', params.date_debut);
      if (params.date_fin) queryParams.set('date_fin', params.date_fin);
      if (params.patient_id) queryParams.set('patient_id', params.patient_id);
      if (params.praticien) queryParams.set('praticien', params.praticien);
      if (params.statut) queryParams.set('statut', params.statut);

      const response = await Axios.get('/rendez-vous/passes', { 
        params: queryParams 
      });
      const data = response.data;
      const listRaw: any[] = Array.isArray(data)
        ? data
        : (data?.data
            || (Array.isArray(data?.["hydra:member"]) ? data["hydra:member"] : [])
            || []);
      
      const list = (listRaw as any[]).map(normalizeRdvItem);
      const pagination = data?.pagination || data?.meta || null;
      
      return {
        data: list as RendezVous[],
        pagination: pagination ? {
          total: pagination.total || list.length,
          page: pagination.page || pagination.current_page || params.page || 1,
          per_page: pagination.per_page || pagination.perPage || params.per_page || 20,
          total_pages: pagination.total_pages || pagination.totalPages || Math.ceil((pagination.total || list.length) / (pagination.per_page || pagination.perPage || params.per_page || 20)),
          showing_from: pagination.showing_from,
          showing_to: pagination.showing_to
        } : undefined
      };
    } catch (error) {
      return { data: [] };
    }
  },

  /** Rendez-vous futurs (recommandé pour l'agenda) */
  getFutureAppointments: async (params: Record<string, any> = {}): Promise<RendezVous[]> => {
    try {
      const response = await Axios.get("/rendez-vous/futurs", { params: normalizeApptParams(params) });
      
      const data = response.data;
      const listRaw: any[] = Array.isArray(data)
        ? data
        : (data?.data
            || (Array.isArray(data?.["hydra:member"]) ? data["hydra:member"] : [])
            || []);
      const list = (listRaw as any[]).map(normalizeRdvItem);
      return list as RendezVous[];
    } catch (error) {
      throw error;
    }
  },

  /** Tous les rendez-vous (historique complet) - OPTIMISÉ: limite le nombre de pages chargées */
  getAllAppointmentsHistory: async (filters: UIAppointmentFilters = {}): Promise<RendezVous[]> => {
    try {
      // IMPORTANT : Supprimer les filtres de date pour voir TOUS les rendez-vous
      const cleanFilters: UIAppointmentFilters = {
        ...filters,
        dateDebut: undefined,
        dateFin: undefined,
        // OPTIMISATION: Limite par défaut réduite pour chargement plus rapide
        limit: filters.limit || 30, // Réduit de 200 à 30 par défaut
        page: filters.page || 1,
      };
      
      // Utiliser buildAppointmentParams pour construire correctement les paramètres
      const params = buildAppointmentParams(cleanFilters);
      
      // S'assurer qu'aucun paramètre de date n'est présent (pour voir TOUS les rendez-vous)
      params.delete('date_debut');
      params.delete('date_fin');
      
      // Supprimer les paramètres non supportés
      params.delete('date_from');
      params.delete('date_to');
      params.delete('start_at[after]');
      params.delete('start_at[before]');
      params.delete('order[start_at]'); // Non supporté par le backend
      params.delete('skip_auto_filter'); // Non supporté par le backend
      params.delete('include_past'); // Non supporté par le backend
      
      const response = await Axios.get("/rendez-vous/tous", { params });
      
      const data = response.data;
      
      // Extraire les données et les informations de pagination
      let listRaw: any[] = Array.isArray(data)
        ? data
        : (data?.data
            || (Array.isArray(data?.["hydra:member"]) ? data["hydra:member"] : [])
            || []);
      
      const pagination = data?.pagination || data?.meta || null;
      const total = pagination?.total || listRaw.length;
      const perPage = pagination?.per_page || pagination?.perPage || cleanFilters.limit || 30;
      const currentPage = pagination?.current_page || pagination?.currentPage || 1;
      const totalPages = pagination?.total_pages || pagination?.totalPages || Math.ceil(total / perPage);
      
      // OPTIMISATION: Limiter à maximum 2 pages pour éviter les appels multiples lents
      // Si l'utilisateur a besoin de plus, il peut utiliser la pagination
      const maxPagesToLoad = 2;
      if (totalPages > 1 && currentPage === 1 && listRaw.length < total && totalPages <= maxPagesToLoad) {
        const allPages: Promise<any[]>[] = [Promise.resolve(listRaw)];
        
        // Récupérer seulement les pages suivantes (max 2 pages au total)
        for (let page = 2; page <= Math.min(totalPages, maxPagesToLoad); page++) {
          const pageParams = buildAppointmentParams({
            ...cleanFilters,
            page,
            limit: perPage,
          });
          // Supprimer les dates et paramètres non supportés
          pageParams.delete('date_debut');
          pageParams.delete('date_fin');
          pageParams.delete('date_from');
          pageParams.delete('date_to');
          pageParams.delete('order[start_at]');
          pageParams.delete('skip_auto_filter');
          pageParams.delete('include_past');
          
          allPages.push(
            Axios.get("/rendez-vous/tous", { params: pageParams })
              .then(res => {
                const pageData = res.data;
                return Array.isArray(pageData)
                  ? pageData
                  : (pageData?.data || (Array.isArray(pageData?.["hydra:member"]) ? pageData["hydra:member"] : []) || []);
              })
              .catch(err => {
                console.warn(`Erreur lors de la récupération de la page ${page}:`, err);
                return [];
              })
          );
        }
        
        const allResults = await Promise.all(allPages);
        listRaw = allResults.flat();
      }
      
      const list = (listRaw as any[]).map(normalizeRdvItem);
      
      return list as RendezVous[];
    } catch (error) {
      throw error;
    }
  },

  /** Agenda par médecin et période */
  getAgenda: async (params: { medecin_id: string; from: string; to: string; statut?: string }): Promise<RendezVous[]> => {
    const query = new URLSearchParams();
    query.set('medecin_id', params.medecin_id);
    query.set('from', params.from);
    query.set('to', params.to);
    if (params.statut) query.set('statut', params.statut);
    const response = await Axios.get(`/rendez-vous/agenda?${query.toString()}`);
    const data = response.data?.data || [];
    // normaliser pour UI (ajoute startAt/endAt alias)
    const list = (Array.isArray(data) ? data : []).map(normalizeRdvItem);
    return list as RendezVous[];
  },

  /** Raccourci RDV du jour */
  getTodayAppointments: (): Promise<RendezVous[]> => {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    return appointmentService.getFutureAppointments({ date: today });
  },

  /** Raccourci RDV à venir sur N jours (défaut: 7) – utilise la liste générique pour inclure médecin et statut normalisé */
  getUpcomingAppointments: (days: number = 7): Promise<RendezVous[]> => {
    const from = new Date();
    const to = new Date(from);
    to.setDate(from.getDate() + days);
    const dateDebut = from.toISOString().slice(0, 10);
    const dateFin = to.toISOString().slice(0, 10);
    // Côté back, ces valeurs en clair sont mappées vers l'enum
    const statut = ['planifié', 'confirmé', 'annulé', 'absent'];
    return appointmentService.getAllAppointments({ dateDebut, dateFin, statut, limit: 50 });
  },

  // ----- CRUD standard -----
  getAllAppointments: (filters: UIAppointmentFilters = {}): Promise<RendezVous[]> => {
    const params = buildAppointmentParams(filters);
    return appointmentService.getAppointments(params);
  },

  getOneAppointment: (id: string | number): Promise<RendezVous> =>
    safeGetObject<RendezVous>(Axios.get(`/rendez-vous/${enc(id)}`)),

  createAppointment: async (payload: Partial<RendezVous>): Promise<RendezVous> => {
    try {
      const response = await Axios.post("/rendez-vous", payload, { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } });
      
      const createdRdv = response.data as RendezVous;
      
      return createdRdv;
    } catch (error) {
      throw error;
    }
  },

  updateAppointment: async (id: string | number, payload: Partial<RendezVous>): Promise<RendezVous> => {
    try {
      const r = await Axios.patch(`/rendez-vous/${enc(id)}`, payload, mergePatchHeaders);
      return r.data as RendezVous;
    } catch (e: any) {
      if (e?.response?.status === 502) {
        // Retry once with JSON header in case gateway strips merge-patch
        const r2 = await Axios.patch(`/rendez-vous/${enc(id)}`, payload, { headers: { 'Content-Type': 'application/json' } });
        return r2.data as RendezVous;
      }
      throw e;
    }
  },

  deleteAppointment: (id: string | number): Promise<any> =>
    Axios.delete(`/rendez-vous/${enc(id)}`).then(r => r.data),

  /** Suppression multiple de rendez-vous (réservé aux formateurs/admins)
   * @param ids Array d'IDs de rendez-vous à supprimer
   * @returns { message, deleted_count, skipped_count, requested_count, errors? }
   */
  bulkDeleteAppointments: async (ids: (string | number)[]): Promise<{
    message: string;
    deleted_count: number;
    skipped_count: number;
    requested_count: number;
    errors?: string[];
  }> => {
    try {
      const response = await Axios.post('/rendez-vous/bulk-delete', { ids });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  // ----- Actions métier (PATCH merge-patch) -----
  confirmAppointment: (id: string | number): Promise<RendezVous> =>
    Axios.patch(`/rendez-vous/${enc(id)}`, { statut: "CONFIRME" }, mergePatchHeaders)
      .then(r => r.data as RendezVous),

  cancelAppointment: (id: string | number): Promise<RendezVous> =>
    Axios.patch(`/rendez-vous/${enc(id)}`, { statut: "ANNULE" }, mergePatchHeaders)
      .then(r => r.data as RendezVous),

  markAsAbsent: (id: string | number): Promise<RendezVous> => {
    
    return Axios.post(`/rendez-vous/${enc(id)}/absent`, {}, mergePatchHeaders)
      .then(r => {
        return r.data as RendezVous;
      })
      .catch(error => {
        throw error;
      });
  },

  /** Modifier le statut arbitrairement (PLANIFIE | CONFIRME | ANNULE | ABSENT ...) */
  updateStatus: (id: string | number, statut: string): Promise<RendezVous> =>
    Axios.patch(`/rendez-vous/${enc(id)}`, { statut }, mergePatchHeaders)
      .then(r => r.data as RendezVous),

  // Vérifier conflit d'horaires
  verifyConflict: async (params: { patient_id: string; medecin_id?: string; start_at: string; end_at: string; exclude_id?: string }): Promise<{ conflict: boolean; message?: string }> => {
    try {
      const { data } = await Axios.post(`/rendez-vous/verifier-conflit`, params);
      // Le backend peut renvoyer soit {conflict:true/false} soit un message
      const conflict = !!(data?.conflict);
      const message = data?.message;
      return { conflict, message };
    } catch (e: any) {
      // En cas d'erreur 409 on considère qu'il y a conflit
      const is409 = e?.response?.status === 409;
      const message = e?.response?.data?.message || e?.message;
      return { conflict: is409, message };
    }
  },
};

export default appointmentService;