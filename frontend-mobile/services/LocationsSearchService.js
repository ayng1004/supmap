// services/LocationsSearchService.js
// Service centralisé pour la recherche d'adresses et le géocodage
import MapboxGL from '@rnmapbox/maps';

// Clé d'accès Mapbox - à déplacer dans un fichier de configuration en production
const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoidG95Y2FuIiwiYSI6ImNtYThhMWR0ZjE0NGIycXM2bG05ZXFxdHoifQ.5HZaIXzWUuPTa6lrSenaGQ';

/**
 * Service de recherche d'adresses et de géocodage
 */
class LocationsSearchService {
  /**
   * Recherche d'adresses via l'API Mapbox
   * @param {string} query - Texte de recherche
   * @param {Object} options - Options supplémentaires
   * @returns {Promise<Array>} - Tableau des résultats trouvés
   */
  async searchAddress(query, options = {}) {
    if (!query || query.length < 2) {
      return [];
    }
    
    try {
      // Construire l'URL de l'API avec les options
      const encodedQuery = encodeURIComponent(query);
      
      // Options par défaut pour la recherche
      const defaultOptions = {
        country: 'fr',
        types: 'address,place,locality,postcode',
        fuzzyMatch: true,
        proximity: 'ip'
      };
      
      // Fusionner avec les options personnalisées
      const searchOptions = { ...defaultOptions, ...options };
      
      // Construire les paramètres de l'URL
      let params = Object.entries(searchOptions)
        .map(([key, value]) => `${key}=${value}`)
        .join('&');
      
      // URL complète
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?${params}&access_token=${MapboxGL.accessToken || MAPBOX_ACCESS_TOKEN}`;
      
      console.log('Recherche Mapbox:', url);
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        // Transformer les résultats dans un format standardisé
        return data.features.map((feature, index) => ({
          id: `search-${index}`,
          name: feature.text || feature.place_name.split(',')[0],
          address: feature.place_name,
          coords: feature.center, // [longitude, latitude]
          properties: feature.properties // Propriétés additionnelles
        }));
      }
      
      // Renvoyer un tableau vide si aucun résultat n'est trouvé
      return [];
    } catch (error) {
      console.error('Erreur lors de la recherche d\'adresse:', error);
      return [];
    }
  }

  /**
   * Recherche d'adresses avec feedback de chargement
   * @param {string} query - Texte de recherche
   * @param {Function} setLoading - Fonction pour mettre à jour l'état de chargement
   * @param {Object} options - Options supplémentaires
   * @returns {Promise<Array>} - Tableau des résultats trouvés
   */
  async searchAddressWithLoading(query, setLoading, options = {}) {
    if (!query || query.length < 2) {
      return [];
    }
    
    if (setLoading) setLoading(true);
    
    try {
      const results = await this.searchAddress(query, options);
      return results;
    } catch (error) {
      console.error('Erreur lors de la recherche d\'adresse:', error);
      return [];
    } finally {
      if (setLoading) setLoading(false);
    }
  }

  /**
   * Géocodage d'adresse en coordonnées
   * @param {string} address - Adresse à géocoder
   * @returns {Promise<Array|null>} - Coordonnées [longitude, latitude] ou null
   */
  async geocodeAddress(address) {
    if (!address) return null;
    
    try {
      const results = await this.searchAddress(address);
      if (results && results.length > 0) {
        return results[0].coords;
      }
      return null;
    } catch (error) {
      console.error('Erreur lors du géocodage:', error);
      return null;
    }
  }

  /**
   * Recherche de lieux autour d'une position
   * @param {string} query - Type de lieu recherché (restaurant, station...)
   * @param {Array} location - Coordonnées [longitude, latitude]
   * @param {number} radius - Rayon de recherche en mètres (défaut: 5000m)
   * @returns {Promise<Array>} - Tableau des résultats trouvés
   */
  async searchNearbyPlaces(query, location, radius = 5000) {
    if (!query || !location) {
      return [];
    }
    
    try {
      // Construire l'URL de l'API avec la position
      const encodedQuery = encodeURIComponent(query);
      
      // Options spécifiques pour la recherche à proximité
      const searchOptions = {
        proximity: `${location[0]},${location[1]}`, // longitude,latitude
        limit: 10,
        radius: radius
      };
      
      // Utiliser la fonction standard avec ces options
      return await this.searchAddress(encodedQuery, searchOptions);
    } catch (error) {
      console.error('Erreur lors de la recherche de lieux à proximité:', error);
      return [];
    }
  }
}

// Exporter une instance unique du service
export default new LocationsSearchService();