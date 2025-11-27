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
      if (status !== 404 && import.meta.env.DEV) {
        console.warn('Endpoint /formateur/dashboard non disponible, fallback valeurs vides.');
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
      // Endpoint réservé formateur - retourne directement un tableau JSON
      const resPrimary = await Axios.get('/users/stagiaires');
      // L'endpoint retourne directement un tableau JSON, pas un objet avec une clé 'data'
      if (Array.isArray(resPrimary.data)) {
        return resPrimary.data;
      }
      // Fallback si la structure est différente
      const data = resPrimary.data?.data || resPrimary.data?.users || resPrimary.data || [];
      return Array.isArray(data) ? data : [];
    } catch (error: any) {
      // Ne pas faire de fallback vers /api/users car il nécessite ROLE_ADMIN
      // Les formateurs n'ont accès qu'à /api/users/stagiaires
      if (error?.response?.status === 403) {
        console.warn('Accès refusé: seuls les formateurs peuvent accéder à cette ressource');
      } else if (error?.response?.status === 401) {
        console.warn('Non authentifié: veuillez vous reconnecter');
      } else {
        console.warn('Erreur lors de la récupération des stagiaires:', error?.message || error);
      }
      return [];
    }
  },

  async createStagiaire(stagiaireData: {
    email: string;
    password: string;
    prenom: string;
    nom: string;
    typeStagiaire?: string;
    section?: string;
  }): Promise<Stagiaire> {
    try {
      const response = await Axios.post('/users/stagiaires', stagiaireData);
      return response.data.user;
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error || error?.response?.data?.message || 'Erreur lors de la création du stagiaire';
      throw new Error(errorMessage);
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

    // Fetch recent audit logs - Utiliser /api/audit/logs (recommandé) au lieu de /api/audit_logs (désactivé)
    let logs: any[] = [];
    try {
      // Utiliser l'endpoint recommandé /api/audit/logs selon la documentation
      const lr1 = await Axios.get('/audit/logs', { 
        params: { 
          user_id: id,
          limit: 50,
          page: 1
        }, 
        validateStatus: () => true 
      });
      if (lr1?.status && lr1.status < 300) {
        const d = lr1.data as any;
        // L'endpoint /api/audit/logs retourne { data: [...], pagination: {...} }
        const arr = (d?.data ?? []) as any[];
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
    // Utiliser l'endpoint recommandé /api/audit/logs au lieu de /api/audit_logs (désactivé)
    const page = Number((filtres.page as any) || 1);
    const limit = Number((filtres.limit as any) || 50); // 50 par défaut selon la documentation

    // Construire les paramètres pour /api/audit/logs
    const params: Record<string, any> = {
      page,
      limit,
    };
    if ((filtres as any).userId) params['user_id'] = (filtres as any).userId;
    if ((filtres as any).action) params['action'] = (filtres as any).action;
    if ((filtres as any).entityType) params['entity_class'] = (filtres as any).entityType;
    if ((filtres as any).dateDebut) params['date_from'] = (filtres as any).dateDebut;
    if ((filtres as any).dateFin) params['date_to'] = (filtres as any).dateFin;

    try {
      // ✅ Utiliser /api/audit/logs (recommandé) au lieu de /api/audit_logs (désactivé)
      const response = await Axios.get('/audit/logs', { params });
      const payload = response.data as any;
      // L'endpoint /api/audit/logs retourne { data: [...], pagination: { total: 76, ... } }
      const list = (payload?.data ?? []) as any[];
      const total = Number(payload?.pagination?.total ?? 0); // ✅ Utiliser pagination.total (76, pas 50)
      const totalPages = Number(payload?.pagination?.pages ?? Math.max(1, Math.ceil((total || 0) / limit)));
      return { logs: Array.isArray(list) ? list : [], total, page, totalPages };
    } catch (error: any) {
      return { logs: [], total: 0, page: 1, totalPages: 1 };
    }
  },

  async getLogDetails(logId: string): Promise<LogAudit> {
    try {
      const response = await Axios.get(`/audit/${logId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async rechercherLogs(filtres: UIFormateurLogFilters = {}): Promise<LogAudit[]> {
    try {
      const params = buildFormateurLogParams(filtres);
      const response = await Axios.get(`/audit?${params.toString()}`);
      return response.data.data || [];
    } catch (error) {
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
      return [];
    }
  },

  async getRepartitionActions(filtres: UIFormateurStatsFilters = {}): Promise<DonneeGraphique[]> {
    try {
      const params = buildFormateurStatsParams(filtres);
      const response = await Axios.get(`/audit/statistics/actions?${params.toString()}`);
      return response.data;
    } catch (error) {
      return [];
    }
  },

  async getPatternsUtilisation(stagiaireId: string): Promise<any[]> {
    try {
      const response = await Axios.get(`/audit/user/${stagiaireId}/recent`, { params: { limit: 50 } });
      return response.data;
    } catch (error) {
      return [];
    }
  },

  // ----- Alertes -----
  async getAlertes(): Promise<Alerte[]> {
    try {
      const response = await Axios.get('/alertes');
      return response.data.data || [];
    } catch (error) {
      return [];
    }
  },

  async marquerAlerteLu(alerteId: string): Promise<void> {
    try {
      await Axios.put(`/alertes/${alerteId}/lu`);
    } catch (error) {
      // Erreur silencieuse
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
      // Erreur silencieuse
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
      // Erreur silencieuse
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
      // Erreur silencieuse
    }
  },

  // ----- Configuration -----
  async getParametresFormateur(): Promise<any> {
    try {
      const response = await Axios.get('/formateur/parametres');
      return response.data;
    } catch (error) {
      return {};
    }
  },

  async sauvegarderParametres(parametres: any): Promise<void> {
    try {
      await Axios.put('/formateur/parametres', parametres);
    } catch (error) {
      // Erreur silencieuse
    }
  }
};

export default formateurService;