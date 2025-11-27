import Axios from './caller.service';

export interface JustificatifStatut {
  type: string;
  label: string;
  present: boolean;
}

export interface JustificatifManquant {
  type: string;
  label: string;
}

export interface PatientIncomplet {
  id: string;
  nom: string;
  prenom: string;
  genre?: string;
  email?: string;
  telephone?: string;
  dateNaissance?: string;
  createdAt: string;
  dossierComplet: boolean;
  justificatifsManquants: JustificatifManquant[];
  statutJustificatifs: JustificatifStatut[];
  totalManquants: number;
}

export interface DashboardData {
  notes: any[];
  totalNotes: number;
  patientsIncomplets: PatientIncomplet[];
  totalPatientsIncomplets: number;
}

export interface PatientJustificatifsStatus {
  patientId: string;
  patientNom: string;
  patientPrenom: string;
  dossierComplet: boolean;
  justificatifs: JustificatifStatut[];
  justificatifsManquants: JustificatifManquant[];
  totalRequis: number;
  totalPresents: number;
  totalManquants: number;
}

class JustificatifService {
  /**
   * Récupère les données du dashboard (inclut les patients incomplets)
   */
  async getDashboard(): Promise<DashboardData> {
    try {
      const response = await Axios.get('/me/dashboard');
      return response.data;
    } catch (error: any) {
      console.error('Erreur lors de la récupération du dashboard:', error);
      // Retourner une structure vide en cas d'erreur
      return {
        notes: [],
        totalNotes: 0,
        patientsIncomplets: [],
        totalPatientsIncomplets: 0
      };
    }
  }

  /**
   * Récupère le statut des justificatifs pour un patient
   */
  async getPatientStatus(patientId: string): Promise<PatientJustificatifsStatus> {
    try {
      const response = await Axios.get(`/justificatifs/patient/${patientId}`);
      return response.data;
    } catch (error: any) {
      console.error(`Erreur lors de la récupération du statut des justificatifs pour le patient ${patientId}:`, error);
      throw error;
    }
  }

  /**
   * Récupère la liste des patients avec dossiers incomplets
   */
  async getPatientsIncomplets(): Promise<{ data: PatientIncomplet[]; total: number }> {
    try {
      const response = await Axios.get('/justificatifs/patients-incomplets');
      const data = response.data?.data || response.data?.['hydra:member'] || response.data?.member || response.data || [];
      const total = response.data?.total || (Array.isArray(data) ? data.length : 0);
      return {
        data: Array.isArray(data) ? data : [],
        total
      };
    } catch (error: any) {
      console.error('Erreur lors de la récupération des patients incomplets:', error);
      return { data: [], total: 0 };
    }
  }
}

export default new JustificatifService();

