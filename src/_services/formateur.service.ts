import Axios from './caller.service';
import { buildFormateurLogParams, buildFormateurStatsParams, UIFormateurLogFilters, UIFormateurStatsFilters } from './query/formateur.query';

// Types pour le formateur
export interface Stagiaire {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  derniereActivite: string;
  nbPatients: number;
  nbActions: number;
  roles: string[];
}

export interface DashboardFormateur {
  totalStagiaires: number;
  totalPatients: number;
  totalActions: number;
  activiteAujourdhui: number;
  topStagiaires: StagiaireActivite[];
  alertes: Alerte[];
  evolutionActivite: PointGraphique[];
  repartitionActions: DonneeGraphique[];
}

export interface StagiaireActivite {
  stagiaire: Stagiaire;
  nbActions: number;
  derniereActivite: string;
  progression: number;
}

export interface Alerte {
  id: string;
  type: 'error' | 'warning' | 'info';
  titre: string;
  description: string;
  stagiaire_id?: string;
  created_at: string;
  lu: boolean;
}

export interface PointGraphique {
  date: string;
  valeur: number;
  stagiaire_id?: string;
}

export interface DonneeGraphique {
  label: string;
  valeur: number;
  couleur: string;
}

export interface LogAudit {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  user: Stagiaire;
  payload: any;
  ip: string;
  created_at: string;
}

// Interface legacy - à supprimer progressivement
export interface FiltresLogs {
  user_id?: string;
  action?: string;
  entity_type?: string;
  date_debut?: string;
  date_fin?: string;
  page?: number;
  limit?: number;
}

const formateurService = {
  // ----- Dashboard Formateur -----
  async getDashboardData(): Promise<DashboardFormateur> {
    try {
      const response = await Axios.get('/formateur/dashboard');
      return response.data;
    } catch (error) {
      const status = (error as any)?.response?.status;
      if (status !== 404) {
        console.error('❌ Erreur récupération dashboard formateur:', error);
      } else if (import.meta.env.DEV) {
        console.warn('⚠️ Endpoint /formateur/dashboard non disponible, fallback valeurs vides.');
      }
      // Fallback si l'endpoint n'existe pas encore côté back
      if (status === 404) {
        return {
          totalStagiaires: 0,
          totalPatients: 0,
          totalActions: 0,
          activiteAujourdhui: 0,
          topStagiaires: [],
          alertes: [],
          evolutionActivite: [],
          repartitionActions: []
        } as DashboardFormateur;
      }
      throw error;
    }
  },

  // ----- Stagiaires -----
  async getAllStagiaires(): Promise<Stagiaire[]> {
    try {
      // Endpoint réservé formateur
      const resPrimary = await Axios.get('/users/stagiaires');
      const data = resPrimary.data?.data || resPrimary.data || [];
      return Array.isArray(data) ? data : [];
    } catch (error) {
      // Fallback admin paginé/filtrable
      try {
        const response = await Axios.get('/users', {
          params: { role: 'ROLE_STAGIAIRE', page: 1, limit: 50 }
        });
        const payload = response.data;
        const list = payload?.data || payload?.['hydra:member'] || payload?.member || payload || [];
        return Array.isArray(list) ? list : [];
      } catch (e2) {
        console.error('❌ Erreur récupération stagiaires:', e2);
        return [];
      }
    }
  },

  async getStagiaireDetails(id: string): Promise<{
    stagiaire: any | null;
    logs: any[];
  }>{
    // Try direct user endpoint, then fallback to listing
    let stagiaire: any | null = null;
    try {
      const r = await Axios.get(`/users/${id}`, { validateStatus: () => true });
      if (r.status && r.status < 300 && r.data) {
        stagiaire = r.data;
      }
    } catch {}

    if (!stagiaire) {
      // Try to find in /users/stagiaires (custom endpoint)
      try {
        const listResp = await Axios.get('/users/stagiaires', { validateStatus: () => true });
        const arr = (listResp?.data?.data ?? listResp?.data ?? []) as any[];
        const found = Array.isArray(arr) ? arr.find(u => String(u?.id) === String(id) || String(u?.['@id'] || '').endsWith(`/${id}`)) : undefined;
        if (found) {
          stagiaire = found;
        }
      } catch {}

      if (!stagiaire) {
        // Try API Platform collection with roles[] filter and scan
        try {
          const sr = await Axios.get('/users', { params: { 'roles[]': 'ROLE_STAGIAIRE', itemsPerPage: 100 }, validateStatus: () => true });
          const d = sr?.data as any;
          const arr = (d?.['hydra:member'] ?? d?.member ?? d?.data ?? (Array.isArray(d) ? d : [])) as any[];
          const found = Array.isArray(arr) ? arr.find(u => String(u?.id) === String(id) || String(u?.['@id'] || '').endsWith(`/${id}`)) : undefined;
          if (found) {
            stagiaire = found;
          }
        } catch {}

        // Last resort: broader search parameters when available
        if (!stagiaire) {
          try {
            const sr2 = await Axios.get('/users', { params: { role: 'ROLE_STAGIAIRE', search: id }, validateStatus: () => true });
            const arr2 = (sr2?.data?.data ?? sr2?.data ?? []) as any[];
            const found2 = Array.isArray(arr2) ? arr2.find(u => String(u?.id) === String(id) || String(u?.email || '').includes(String(id)) || String(u?.nom || '').includes(String(id)) || String(u?.prenom || '').includes(String(id))) : undefined;
            if (found2) {
              stagiaire = found2;
            }
          } catch {}
        }
      }
    }

    // Fetch recent audit logs (API Platform only; no legacy fallback)
    let logs: any[] = [];
    let lr1Status: number | undefined;
    // Prefer API Platform collection
    try {
      const lr1 = await Axios.get('/audit_logs', { params: { 'user[exists]': 1, 'user.id': id, 'user.primaryRole': 'ROLE_STAGIAIRE', 'order[createdAt]': 'desc', itemsPerPage: 50 }, validateStatus: () => true });
      lr1Status = lr1?.status;
      if (lr1Status && lr1Status < 300) {
        const d = lr1.data as any;
        const arr = (d?.['hydra:member'] ?? d?.member ?? d?.data ?? []) as any[];
        logs = Array.isArray(arr) ? arr : [];
      }
    } catch {}

    return { stagiaire, logs };
  },

  // ----- Vue globale formateur: actions récentes hors formateur -----
  async getRecentGlobalActionsForFormateur(limit: number = 50): Promise<any[]> {
    try {
      const res = await Axios.get('/audit/search', { params: { exclude_role: 'ROLE_FORMATEUR', limit } });
      const d = res.data as any;
      const arr = (d?.data ?? d ?? []) as any[];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  },

  // ----- Logs d'audit -----
  async getLogsAudit(filtres: UIFormateurLogFilters = {}): Promise<{
    logs: LogAudit[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    // Par défaut: si aucun user ciblé, exclure le rôle formateur via endpoint recherche global
    const page = Number((filtres.page as any) || 1);
    const limit = Number((filtres.limit as any) || 30);

    const hasUser = Boolean((filtres as any).userId);

    // Utiliser API Platform /audit_logs avec user[exists]=1 (et limiter aux stagiaires côté user)
    const params: Record<string, any> = {
      'user[exists]': 1,
      'order[createdAt]': 'desc',
      page,
      itemsPerPage: limit,
    };
    if (!hasUser) params['user.primaryRole'] = 'ROLE_STAGIAIRE';
    if ((filtres as any).userId) params['user.id'] = (filtres as any).userId;
    if ((filtres as any).action) params['action'] = (filtres as any).action;
    if ((filtres as any).entityType) params['entityType'] = (filtres as any).entityType;
    if ((filtres as any).dateDebut) params['createdAt[after]'] = (filtres as any).dateDebut;
    if ((filtres as any).dateFin) params['createdAt[before]'] = (filtres as any).dateFin;

    try {
      const response = await Axios.get('/audit_logs', { params });
      const payload = response.data as any;
      const list = (payload?.['hydra:member'] ?? payload?.member ?? payload?.data ?? (Array.isArray(payload) ? payload : [])) as any[];
      const total = Number(payload?.['hydra:totalItems'] ?? payload?.total ?? list.length ?? 0);
      const totalPages = Math.max(1, Math.ceil((total || 0) / (limit || 50)));
      return { logs: Array.isArray(list) ? list : [], total, page, totalPages };
    } catch (error: any) {
      console.error('❌ Erreur récupération logs audit:', error);
      return { logs: [], total: 0, page: 1, totalPages: 1 };
    }
  },

  async getLogDetails(logId: string): Promise<LogAudit> {
    try {
      const response = await Axios.get(`/audit/${logId}`);
      return response.data;
    } catch (error) {
      console.error('❌ Erreur récupération détails log:', error);
      throw error;
    }
  },

  async rechercherLogs(filtres: UIFormateurLogFilters = {}): Promise<LogAudit[]> {
    try {
      const params = buildFormateurLogParams(filtres);
      const response = await Axios.get(`/audit?${params.toString()}`);
      return response.data.data || [];
    } catch (error) {
      console.error('❌ Erreur recherche logs:', error);
      return [];
    }
  },

  // ----- Graphiques et statistiques -----
  async getStatsActivite(filtres: UIFormateurStatsFilters = {}): Promise<PointGraphique[]> {
    try {
      const params = buildFormateurStatsParams(filtres);
      const response = await Axios.get(`/audit/statistics/period?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('❌ Erreur récupération stats activité:', error);
      return [];
    }
  },

  async getRepartitionActions(filtres: UIFormateurStatsFilters = {}): Promise<DonneeGraphique[]> {
    try {
      const params = buildFormateurStatsParams(filtres);
      const response = await Axios.get(`/audit/statistics/actions?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('❌ Erreur récupération répartition actions:', error);
      return [];
    }
  },

  async getPatternsUtilisation(stagiaireId: string): Promise<any[]> {
    try {
      const response = await Axios.get(`/audit/user/${stagiaireId}/recent`, { params: { limit: 50 } });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur récupération patterns:', error);
      return [];
    }
  },

  // ----- Alertes -----
  async getAlertes(): Promise<Alerte[]> {
    try {
      const response = await Axios.get('/alertes');
      return response.data.data || [];
    } catch (error) {
      console.error('❌ Erreur récupération alertes:', error);
      return [];
    }
  },

  async marquerAlerteLu(alerteId: string): Promise<void> {
    try {
      await Axios.put(`/alertes/${alerteId}/lu`);
    } catch (error) {
      console.error('❌ Erreur marquage alerte:', error);
    }
  },

  // ----- Rapports et exports -----
  async genererRapport(type: string, periode: string, stagiaires: string[]): Promise<any> {
    try {
      const response = await Axios.post('/rapports/generer', {
        type,
        periode,
        stagiaires
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur génération rapport:', error);
      throw error;
    }
  },

  async telechargerRapport(rapportId: string): Promise<void> {
    try {
      const response = await Axios.get(`/rapports/${rapportId}/telecharger`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `rapport-${rapportId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('❌ Erreur téléchargement rapport:', error);
    }
  },

  async exporterLogsCSV(filtres: FiltresLogs): Promise<void> {
    try {
      const response = await Axios.get('/audit/export/csv', {
        params: filtres,
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'logs-audit.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('❌ Erreur export CSV:', error);
    }
  },

  async exporterLogsJSON(filtres: FiltresLogs): Promise<void> {
    try {
      const response = await Axios.get('/audit/export/json', {
        params: filtres,
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'logs-audit.json');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('❌ Erreur export JSON:', error);
    }
  },

  // ----- Configuration -----
  async getParametresFormateur(): Promise<any> {
    try {
      const response = await Axios.get('/formateur/parametres');
      return response.data;
    } catch (error) {
      console.error('❌ Erreur récupération paramètres:', error);
      return {};
    }
  },

  async sauvegarderParametres(parametres: any): Promise<void> {
    try {
      await Axios.put('/formateur/parametres', parametres);
    } catch (error) {
      console.error('❌ Erreur sauvegarde paramètres:', error);
    }
  }
};

export default formateurService;
