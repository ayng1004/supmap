// services/WaypointsService.js
// Service pour la gestion des points d'arrêt

import { Alert } from 'react-native';

/**
 * Service de gestion des points d'arrêt (waypoints)
 */
class WaypointsService {
  /**
   * Calcule un itinéraire avec des points d'arrêt
   * @param {Array} origin - Coordonnées d'origine [longitude, latitude]
   * @param {Array} destination - Coordonnées de destination [longitude, latitude]
   * @param {Array} waypoints - Liste des points d'arrêt
   * @param {string} accessToken - Token d'accès pour l'API Mapbox
   * @returns {Promise} - Promesse avec les données d'itinéraire
   */
  async calculateRouteWithWaypoints(origin, destination, waypoints = [], accessToken) {
    if (!origin || !destination) {
      throw new Error('Origine et destination requises');
    }
    
    try {
      // Construire l'URL pour l'API Mapbox avec les waypoints
      let waypointsString = '';
      if (waypoints && waypoints.length > 0) {
        waypoints.forEach(wp => {
          if (wp.coords && wp.coords.length === 2) {
            waypointsString += `;${wp.coords[0]},${wp.coords[1]}`;
          }
        });
      }
      
      const originStr = `${origin[0]},${origin[1]}`;
      const destStr = `${destination[0]},${destination[1]}`;
      
      // URL de l'API Mapbox avec les points d'arrêt entre origine et destination
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${originStr}${waypointsString};${destStr}?alternatives=true&geometries=geojson&steps=true&overview=full&annotations=duration,distance,speed&access_token=${accessToken}`;
      
      console.log('Calcul d\'itinéraire avec points d\'arrêt:', url);
      
      const response = await fetch(url);
      const result = await response.json();
      
      if (!result || !result.routes || result.routes.length === 0) {
        throw new Error(`Réponse Mapbox invalide: ${JSON.stringify(result)}`);
      }
      
      // Traiter les itinéraires avec points d'arrêt
      const processedRoutes = result.routes.map((route, index) => {
        const color = index === 0 ? '#3887be' : index === 1 ? '#FF9800' : '#9C27B0';
        const name = index === 0 ? 'Itinéraire optimal' : index === 1 ? 'Alternatif 1' : `Alternatif ${index}`;
        
        // Extraire toutes les étapes de tous les segments (legs)
        const allSteps = [];
        if (route.legs && route.legs.length > 0) {
          route.legs.forEach(leg => {
            if (leg.steps && leg.steps.length > 0) {
              allSteps.push(...leg.steps);
            }
          });
        }
        
        return {
          id: `route-${index}`,
          distance: route.distance,
          duration: route.duration,
          steps: allSteps,
          geometry: route.geometry,
          color: color,
          name: name,
          hasWaypoints: waypoints.length > 0
        };
      });
      
      return processedRoutes;
    } catch (error) {
      console.error('Erreur lors du calcul d\'itinéraire avec points d\'arrêt:', error);
      throw error;
    }
  }

  /**
   * Crée un nouveau point d'arrêt
   * @param {Object} item - Lieu sélectionné
   * @param {string} type - Type de point d'arrêt (restaurant, station...)
   * @returns {Object} - Nouvel objet de point d'arrêt
   */
  createWaypoint(item, type = 'custom') {
    return {
      id: Date.now().toString(),
      name: item.name || item.address,
      address: item.address,
      coords: item.coords,
      type: type
    };
  }

  /**
   * Réorganise les points d'arrêt
   * @param {Array} waypoints - Liste des points d'arrêt
   * @param {number} fromIndex - Index source
   * @param {number} toIndex - Index destination
   * @returns {Array} - Liste mise à jour
   */
  moveWaypoint(waypoints, fromIndex, toIndex) {
    if (fromIndex === toIndex) return waypoints;
    
    // Créer une copie de la liste
    const updatedWaypoints = [...waypoints];
    
    // Extraire l'élément à déplacer
    const movedWaypoint = updatedWaypoints[fromIndex];
    
    // Supprimer l'élément de sa position actuelle
    updatedWaypoints.splice(fromIndex, 1);
    
    // Insérer l'élément à sa nouvelle position
    updatedWaypoints.splice(toIndex, 0, movedWaypoint);
    
    return updatedWaypoints;
  }

  /**
   * Supprime un point d'arrêt
   * @param {Array} waypoints - Liste des points d'arrêt
   * @param {string} waypointId - ID du point d'arrêt à supprimer
   * @returns {Array} - Liste mise à jour
   */
  removeWaypoint(waypoints, waypointId) {
    return waypoints.filter(wp => wp.id !== waypointId);
  }

  /**
   * Types de points d'arrêt prédéfinis
   * @returns {Array} - Liste des types de points d'arrêt
   */
  getWaypointTypes() {
    return [
      { id: 'gas', name: 'Station-service', icon: 'car' },
      { id: 'restaurant', name: 'Restaurant', icon: 'restaurant' },
      { id: 'grocery', name: 'Supermarché', icon: 'basket' },
      { id: 'coffee', name: 'Café', icon: 'cafe' },
      { id: 'custom', name: 'Autre lieu', icon: 'pin' }
    ];
  }
}

// Exporter une instance unique du service
export default new WaypointsService();