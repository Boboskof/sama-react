// src/_services/password.service.ts
import Axios from "./caller.service";

const passwordService = {
  /**
   * Demander une réinitialisation de mot de passe
   * @param email - L'adresse email de l'utilisateur
   * @returns Promise avec le message de succès
   */
  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const response = await Axios.post("/password/forgot", { email });
    return response.data;
  },

  /**
   * Vérifier la validité d'un token de réinitialisation
   * @param token - Le token à vérifier
   * @returns Promise avec { valid: boolean, message?: string, error?: string }
   */
  verifyToken: async (token: string): Promise<{ valid: boolean; message?: string; error?: string }> => {
    try {
      const response = await Axios.get(`/password/verify/${token}`);
      return response.data;
    } catch (error: any) {
      // Si erreur 400, le token est invalide
      if (error?.response?.status === 400) {
        return error.response?.data || { valid: false, error: "Token invalide ou expiré" };
      }
      throw error;
    }
  },

  /**
   * Réinitialiser le mot de passe avec un token
   * @param token - Le token de réinitialisation
   * @param password - Le nouveau mot de passe
   * @returns Promise avec le message de succès
   */
  resetPassword: async (token: string, password: string): Promise<{ message: string }> => {
    const response = await Axios.post("/password/reset", { token, password });
    return response.data;
  },
};

export default passwordService;

