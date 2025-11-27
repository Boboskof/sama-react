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
   * @param silent - Si true, ne log pas l'erreur (pour éviter le spam dans la console)
   */
  async getAllMedecins(silent: boolean = false): Promise<Medecin[]> {
    try {
      const response = await Axios.get('/medecins', {
        timeout: 30000, // Timeout spécifique de 30s pour cette requête
      });
      
      // API Platform retourne les données dans member ou hydra:member
      const medecins = response.data?.member || response.data?.['hydra:member'] || response.data?.data;
      
      return medecins || [];
    } catch (error: any) {
      // Gestion d'erreur améliorée : ne pas bloquer si c'est un timeout
      const isTimeout = error?.code === 'ECONNABORTED' || error?.message?.includes('timeout');
      if (!silent && !isTimeout) {
        console.error('Erreur lors de la récupération des médecins:', error);
      } else if (isTimeout && !silent) {
        console.warn('Timeout lors de la récupération des médecins - retour d\'un tableau vide');
      }
      // Retourner un tableau vide au lieu de throw pour ne pas bloquer l'interface
      return [];
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
      console.error(`Erreur lors de la récupération du médecin ${id}:`, error);
      throw error;
    }
  }
}

export default new MedecinService();
