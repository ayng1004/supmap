import axios from 'axios';

/**
 * Service pour gérer les itinéraires via l'API Mapbox
 */
export const routeService = {
  /**
   * Obtient les itinéraires entre deux points
   * @param {Array} start - Coordonnées de départ [longitude, latitude]
   * @param {Array} end - Coordonnées d'arrivée [longitude, latitude]
   * @param {Object} preferences - Préférences d'itinéraire (mode, éviter les péages, etc.)
   * @returns {Promise} - Promise avec les données d'itinéraire
   */
  getRoutes: async (start, end, preferences = {}) => {
    try {
      const { mode = 'driving', avoidTolls = false, alternative = true } = preferences;
      
      // Formatage des coordonnées pour l'API Mapbox
      const startCoord = Array.isArray(start) ? start.join(',') : `${start.longitude},${start.latitude}`;
      const endCoord = Array.isArray(end) ? end.join(',') : `${end.longitude},${end.latitude}`;
      
      // Construction de l'URL de l'API Mapbox Directions
      const baseUrl = 'https://api.mapbox.com/directions/v5/mapbox';
      const profile = avoidTolls ? `${mode}-toll-avoided` : mode;
      const url = `${baseUrl}/${profile}/${startCoord};${endCoord}`;
      
      // Paramètres de la requête
      const params = {
        access_token: process.env.REACT_APP_MAPBOX_ACCESS_TOKEN,
        geometries: 'geojson',
        steps: true,
        overview: 'full',
        alternatives: alternative,
        language: 'fr' // Langue des instructions
      };
      
      // Appel à l'API Mapbox
      const response = await axios.get(url, { params });
      
      // Transformation des données pour notre application
      return {
        routes: response.data.routes.map(route => ({
          id: route.uuid || Math.random().toString(36).substring(2, 9),
          distance: route.distance,
          duration: route.duration,
          geometry: route.geometry,
          legs: route.legs.map(leg => ({
            distance: leg.distance,
            duration: leg.duration,
            steps: leg.steps.map(step => ({
              distance: step.distance,
              duration: step.duration,
              instruction: step.maneuver.instruction,
              type: step.maneuver.type,
              name: step.name,
              coordinates: step.maneuver.location
            }))
          })),
          hasTolls: route.toll === true,
          tollCost: route.toll_cost || 0
        }))
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des itinéraires:', error);
      throw new Error(error.response?.data?.message || 'Erreur de service d\'itinéraire');
    }
  },
  
  /**
   * Recalcule un itinéraire en fonction des incidents
   * @param {Array} currentRoute - Route actuelle
   * @param {Array} incidents - Liste des incidents à éviter
   * @returns {Promise} - Promise avec le nouvel itinéraire
   */
  recalculateRoute: async (currentRoute, incidents) => {
    try {
      // À implémenter: Logique pour éviter les zones d'incidents
      // Dans un premier temps, on pourrait simplement recalculer l'itinéraire
      // en évitant les zones où il y a des incidents
      
      // Exemple d'appel à l'API backend
      const response = await axios.post('/api/routes/recalculate', {
        currentRoute,
        incidents
      });
      
      return response.data;
    } catch (error) {
      console.error('Erreur lors du recalcul de l\'itinéraire:', error);
      throw new Error('Impossible de recalculer l\'itinéraire');
    }
  },
  
  /**
   * Génère un QR code pour partager un itinéraire
   * @param {Object} route - Données de l'itinéraire
   * @returns {Promise} - Promise avec l'URL du QR code
   */
  generateQRCode: async (route) => {
    try {
      // Préparer les données pour le QR code
      const routeData = {
        start: route.legs[0]?.steps[0]?.coordinates,
        end: route.legs[route.legs.length - 1]?.steps[route.legs[route.legs.length - 1]?.steps.length - 1]?.coordinates,
        id: route.id
      };
      
      // Encoder les données en JSON
      const encodedData = encodeURIComponent(JSON.stringify(routeData));
      
      // Créer une URL qui peut être ouverte dans l'application mobile
      const deepLink = `supmap://route?data=${encodedData}`;
      
      // Cette fonction peut retourner directement la chaîne pour le QR
      // Dans une implémentation réelle, vous pourriez vouloir appeler une API 
      // ou utiliser une bibliothèque côté client pour générer le QR code
      return deepLink;
    } catch (error) {
      console.error('Erreur lors de la génération du QR code:', error);
      throw new Error('Impossible de générer le QR code');
    }
  }
};

export default routeService;