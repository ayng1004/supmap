/**
 * Service d'itinéraires unifié pour le web et le mobile
 * Compatible avec React (web) et React Native (mobile)
 */

// Clé API Mapbox (à placer dans les variables d'environnement en production)
const MAPBOX_ACCESS_TOKEN = "pk.eyJ1IjoidG95Y2FuIiwiYSI6ImNseDNyemg4eTAza2kya3Nhcm40cW5wcGsifQ.O-QayF8YihwNF62txHaOBw";

/**
 * Détecte si l'environnement est mobile (React Native) ou web
 * @returns {boolean} - true si l'environnement est mobile
 */
const isMobileEnvironment = () => {
  return typeof document === 'undefined' && typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
};

/**
 * Récupère la position actuelle de l'utilisateur (compatible web/mobile)
 * @returns {Promise<Object>} - Coordonnées {coordinates: [longitude, latitude], placeName: string}
 */
export const getCurrentPosition = async () => {
  try {
    if (isMobileEnvironment()) {
      // Code pour React Native
      const Location = require('expo-location');
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Permission de localisation refusée');
      }
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      
      return {
        coordinates: [location.coords.longitude, location.coords.latitude],
        placeName: "Votre position actuelle"
      };
    } else {
      // Code pour le web
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("La géolocalisation n'est pas supportée par ce navigateur"));
          return;
        }
        
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              coordinates: [position.coords.longitude, position.coords.latitude],
              placeName: "Votre position actuelle"
            });
          },
          (error) => {
            console.error("Erreur de géolocalisation:", error);
            reject(error);
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      });
    }
  } catch (error) {
    console.error("Erreur lors de la récupération de la position:", error);
    throw error;
  }
};

/**
 * Convertit une adresse en coordonnées géographiques (geocoding)
 * @param {string} address - L'adresse à convertir
 * @returns {Promise<Object>} - Coordonnées {coordinates: [longitude, latitude], placeName: string}
 */
export const geocodeAddress = async (address) => {
  try {
    // URL de l'API Mapbox Geocoding
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      address
    )}.json?access_token=${MAPBOX_ACCESS_TOKEN}&limit=1&country=fr`;
    
    // La façon de faire des requêtes HTTP est compatible entre les deux plateformes
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const [longitude, latitude] = data.features[0].center;
      return {
        coordinates: [longitude, latitude],
        placeName: data.features[0].place_name
      };
    } else {
      throw new Error("Adresse non trouvée");
    }
  } catch (error) {
    console.error("Erreur de géocodage:", error);
    throw error;
  }
};

/**
 * Obtient un itinéraire entre deux points
 * @param {Array} start - Coordonnées du point de départ [longitude, latitude]
 * @param {Array} end - Coordonnées de la destination [longitude, latitude]
 * @param {Object} options - Options d'itinéraire
 * @returns {Promise<Object>} - Données de l'itinéraire
 */
export const getRoute = async (start, end, options = {}) => {
  try {
    const { travelMode = 'driving', avoidTolls = false } = options;
    
    // Déterminer le profil en fonction du mode de transport et des options
    let profile = travelMode;
    if (travelMode === 'driving' && avoidTolls) {
      // Mapbox n'a pas d'option native pour éviter les péages
      // Dans une implémentation complète, vous pourriez utiliser une autre API
      profile = 'driving';
    }
    
    // Construire l'URL de l'API
    const coordinates = `${start.join(',')};${end.join(',')}`;
    const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}?alternatives=true&geometries=geojson&language=fr&overview=full&steps=true&access_token=${MAPBOX_ACCESS_TOKEN}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.code !== 'Ok') {
      throw new Error(data.message || "Erreur lors du calcul de l'itinéraire");
    }
    
    return data;
  } catch (error) {
    console.error("Erreur lors de la récupération de l'itinéraire:", error);
    throw error;
  }
};

/**
 * Formate la durée en format lisible
 * @param {number} seconds - Durée en secondes
 * @returns {string} - Durée formatée
 */
export const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours} h ${minutes} min`;
  } else {
    return `${minutes} min`;
  }
};

/**
 * Formate la distance en format lisible
 * @param {number} meters - Distance en mètres
 * @returns {string} - Distance formatée
 */
export const formatDistance = (meters) => {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  } else {
    const km = meters / 1000;
    return `${km.toFixed(1)} km`;
  }
};

/**
 * Récupère des suggestions d'adresses pour l'autocomplétion
 * @param {string} query - Requête de recherche
 * @returns {Promise<Array>} - Liste des suggestions
 */
export const getAddressSuggestions = async (query) => {
  try {
    if (!query || query.length < 2) {
      return [];
    }
    
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      query
    )}.json?access_token=${MAPBOX_ACCESS_TOKEN}&country=fr&types=address,place,poi&language=fr`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.features) {
      return data.features.map(feature => ({
        id: feature.id,
        text: feature.place_name,
        coordinates: feature.center
      }));
    }
    
    return [];
  } catch (error) {
    console.error("Erreur lors de la récupération des suggestions:", error);
    return [];
  }
};

export default {
  getCurrentPosition,
  geocodeAddress,
  getRoute,
  formatDistance,
  formatDuration,
  getAddressSuggestions
};