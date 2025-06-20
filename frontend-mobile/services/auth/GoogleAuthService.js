import axios from 'axios';
import { API_BASE_URL } from '../config';

/**
 * Service pour gérer l'authentification avec Google
 */
const GoogleAuthService = {
  /**
   * Échanger un token Google contre un token d'application
   * 
   * @param {string} googleToken - Le token d'accès obtenu de Google
   * @returns {Promise} Résultat contenant le token d'application et les infos utilisateur
   */
  exchangeGoogleToken: async (googleToken) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/google/mobile`, {
        token: googleToken
      });
      
      return response.data;
    } catch (error) {
      console.error('Google auth error:', error);
      
      // Gestion des erreurs spécifiques
      if (error.response) {
        // Erreur de réponse du serveur
        const { status, data } = error.response;
        
        if (status === 401) {
          throw new Error('Accès non autorisé');
        } else if (status === 400) {
          throw new Error(data.message || 'Requête invalide');
        } else {
          throw new Error(data.message || 'Erreur de connexion');
        }
      } else if (error.request) {
        // Pas de réponse du serveur
        throw new Error('Serveur indisponible, veuillez réessayer plus tard');
      } else {
        // Autre erreur
        throw new Error('Erreur lors de la connexion avec Google');
      }
    }
  }
};

export default GoogleAuthService;