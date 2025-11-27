// src/_services/admin.service.ts
import Axios from "./caller.service";
import { unwrapList } from "./service.utils";

export interface User {
  id: string;
  email: string;
  prenom: string;
  nom: string;
  roles: string[];
  primaryRole?: string;
  typeStagiaire?: string;
  section?: string;
  isStagiaire?: boolean;
  isFormateur?: boolean;
  isAdmin?: boolean;
  createdAt: string;
  statut: boolean;
}

export interface UsersResponse {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface AuditStatistics {
  total: number;
  by_user?: Array<{
    user_id: string;
    user_email: string;
    user_name: string;
    count: number;
  }>;
  by_action?: Array<{
    action: string;
    count: number;
  }>;
  by_entity?: Array<{
    entity_type: string;
    count: number;
  }>;
  by_period?: Array<{
    period: string;
    count: number;
  }>;
  filters?: {
    date_from?: string;
    only_stagiaires?: boolean;
  };
}

export interface ReminderResponse {
  processed: number;
  dry_run: boolean;
  canal: string;
  items: Array<{
    rdv_id: string;
    start_at: string;
    patient: string;
    email: string;
    dry_run: boolean;
  }>;
  errors: any[];
  total: number;
}

const adminService = {
  /**
   * Récupérer la liste des utilisateurs
   */
  async getUsers(params: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    typeStagiaire?: string;
  } = {}): Promise<UsersResponse> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.search) queryParams.append('search', params.search);
    if (params.role) queryParams.append('role', params.role);
    if (params.typeStagiaire) queryParams.append('typeStagiaire', params.typeStagiaire);

    const response = await Axios.get(`/users?${queryParams.toString()}`);
    const data = response.data;
    
    // Gérer le format API Platform (Hydra) ou le format personnalisé
    let usersList: User[] = [];
    let total = 0;
    
    if (data.users && Array.isArray(data.users)) {
      // Format personnalisé : { users: [...], pagination: {...} }
      usersList = data.users;
      total = data.pagination?.total || data.users.length;
    } else {
      // Format API Platform (Hydra) : { member: [...], totalItems: ... }
      usersList = unwrapList(data);
      total = data.totalItems || data['hydra:totalItems'] || usersList.length;
    }
    
    // Normaliser le champ statut : gestion défensive (le backend devrait toujours retourner statut)
    // Par défaut, si absent, considérer comme actif (true)
    usersList = usersList.map((user: User) => ({
      ...user,
      statut: user.statut ?? true // Par défaut actif si absent
    }));
    
    const page = params.page || 1;
    const limit = params.limit || 20;
    const pages = Math.ceil(total / limit);
    
    return {
      users: usersList,
      pagination: {
        page,
        limit,
        total,
        pages
      }
    };
  },

  /**
   * Récupérer un utilisateur par ID
   */
  async getUserById(id: string): Promise<User> {
    const response = await Axios.get(`/users/${id}`);
    return response.data;
  },

  /**
   * Désactiver un utilisateur
   */
  async disableUser(id: string): Promise<{ message: string }> {
    const response = await Axios.post(`/users/${id}/disable`);
    return response.data;
  },

  /**
   * Réactiver un utilisateur
   */
  async enableUser(id: string): Promise<{ message: string }> {
    const response = await Axios.post(`/users/${id}/enable`);
    return response.data;
  },

  /**
   * Activer / désactiver un utilisateur (wrapper utilisé par les hooks React Query)
   */
  async toggleUserStatus(id: string, status: boolean): Promise<{ message: string }> {
    // Si status === true → utilisateur actif, donc appeler l'endpoint d'activation
    // Si status === false → utilisateur inactif, donc appeler l'endpoint de désactivation
    if (status) {
      return this.enableUser(id);
    }
    return this.disableUser(id);
  },

  /**
   * Supprimer un utilisateur
   */
  async deleteUser(id: string): Promise<{ message?: string }> {
    const response = await Axios.delete(`/users/${id}`);
    return response.data;
  },

  /**
   * Récupérer les statistiques d'audit
   */
  async getAuditStatistics(params: {
    date_from?: string;
    date_to?: string;
    action?: string;
    user_id?: string;
    entity_type?: string;
  } = {}): Promise<AuditStatistics> {
    const queryParams = new URLSearchParams();
    if (params.date_from) queryParams.append('date_from', params.date_from);
    if (params.date_to) queryParams.append('date_to', params.date_to);
    if (params.action) queryParams.append('action', params.action);
    if (params.user_id) queryParams.append('user_id', params.user_id);
    if (params.entity_type) queryParams.append('entity_type', params.entity_type);

    const response = await Axios.get(`/audit/statistics?${queryParams.toString()}`);
    return response.data;
  },

  /**
   * Envoyer des rappels de rendez-vous
   */
  async sendReminders(params: {
    dry_run?: boolean;
    limit?: number;
    canal?: string;
  } = {}): Promise<ReminderResponse> {
    const queryParams = new URLSearchParams();
    queryParams.append('dry_run', (params.dry_run ?? false).toString());
    queryParams.append('limit', (params.limit ?? 100).toString());
    queryParams.append('canal', params.canal || 'EMAIL');

    const response = await Axios.post(`/admin/reminders/rendez-vous?${queryParams.toString()}`);
    return response.data;
  },

  /**
   * Récupérer les statistiques des communications
   */
  async getCommunicationStatistics(params: {
    date_from?: string;
    date_to?: string;
  } = {}): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params.date_from) queryParams.append('date_from', params.date_from);
    if (params.date_to) queryParams.append('date_to', params.date_to);

    const response = await Axios.get(`/communications/statistics?${queryParams.toString()}`);
    return response.data;
  },

  /**
   * Effacer les logs d'audit
   */
  async clearAuditLogs(params: {
    date_from?: string;
    date_to?: string;
    action?: string;
    user_id?: string;
    entity_type?: string;
  } = {}): Promise<{ message: string; deleted: number }> {
    const queryParams = new URLSearchParams();
    if (params.date_from) queryParams.append('date_from', params.date_from);
    if (params.date_to) queryParams.append('date_to', params.date_to);
    if (params.action) queryParams.append('action', params.action);
    if (params.user_id) queryParams.append('user_id', params.user_id);
    if (params.entity_type) queryParams.append('entity_type', params.entity_type);

    const response = await Axios.delete(`/audit/logs?${queryParams.toString()}`);
    return response.data;
  },
};

export default adminService;

