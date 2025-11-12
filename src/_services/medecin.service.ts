import Axios from './caller.service';

export interface Medecin {
  id: string;
  nom: string;
  prenom: string;
  specialite?: string;
  email?: string;
  telephone?: string;
}

class MedecinService {
  /**
   * Récupérer tous les médecins
   */
  async getAllMedecins(): Promise<Medecin[]> {
    try {
      const response = await Axios.get('/medecins');
      
      if (import.meta.env.DEV) {
        // Médecins récupérés avec succès
      }
      
      // API Platform retourne les données dans member ou hydra:member
      const medecins = response.data?.member || response.data?.['hydra:member'] || response.data?.data;
      
      return medecins || [];
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des médecins:', error);
      throw error;
    }
  }

  /**
   * Récupérer un médecin par ID
   */
  async getOneMedecin(id: string): Promise<Medecin> {
    try {
      const response = await Axios.get(`/medecins/${id}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur lors de la récupération du médecin ${id}:`, error);
      throw error;
    }
  }
}

export default new MedecinService();
