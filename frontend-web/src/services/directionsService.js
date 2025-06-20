// frontend-web/src/services/directionsService.js
import api from './api';

// Fonctions utilitaires pour le formatage
const formatDistance = (meters) => {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  } else {
    return `${(meters / 1000).toFixed(1)} km`;
  }
};

const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours} h ${minutes} min`;
  } else {
    return `${minutes} min`;
  }
};

// Service pour les itinéraires et la géolocalisation
const directionsService = {
  // Géocoder une adresse (conversion adresse -> coordonnées)
  geocodeAddress: async (address) => {
    try {
      const response = await api.get(`/api/routes/geocode?query=${encodeURIComponent(address)}`);
      
      if (!response.data.success || !response.data.features || response.data.features.length === 0) {
        throw new Error("Aucun résultat trouvé pour cette adresse");
      }
      
      const firstResult = response.data.features[0];
      
      return {
        coordinates: firstResult.geometry.coordinates,
        placeName: firstResult.place_name,
        placeType: firstResult.place_type[0]
      };
    } catch (error) {
      console.error('Erreur lors du géocodage:', error);
      throw error;
    }
  },
  
  // Obtenir la position actuelle de l'utilisateur
  getCurrentPosition: () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("La géolocalisation n'est pas supportée par votre navigateur"));
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            coordinates: [position.coords.longitude, position.coords.latitude],
            placeName: "Votre position actuelle",
            placeType: "current-location"
          });
        },
        (error) => {
          let errorMessage = "Erreur de géolocalisation";
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = "Vous avez refusé l'accès à votre position";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Les informations de localisation ne sont pas disponibles";
              break;
            case error.TIMEOUT:
              errorMessage = "La demande de localisation a expiré";
              break;
            default:
              errorMessage = "Une erreur inconnue s'est produite";
          }
          
          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  },
  
  // Calculer un itinéraire entre deux points
  getRoute: async (origin, destination, options = {}) => {
    try {
      const response = await api.post('/api/routes/calculate', {

        origin: {
          coordinates: origin
        },
        destination: {
          coordinates: destination
        },
        options
      });
      
      if (!response.data.success || !response.data.routes || response.data.routes.length === 0) {
        throw new Error("Aucun itinéraire trouvé");
      }
      
      return response.data;
    } catch (error) {
      console.error('Erreur lors du calcul de l\'itinéraire:', error);
      throw error;
    }
  },
  
  // Fonctions utilitaires pour le formatage
  formatDistance,
  formatDuration,
  
  // Sauvegarder un itinéraire
  saveRoute: async (name, origin, destination, routeData, options = {}) => {
    try {
      const response = await api.post('/api/routes/save', {
        name,
        origin,
        destination,
        waypoints: options.waypoints || [],
        options: {
          avoidTolls: options.avoidTolls || false
        },
        routeData
      });
      
      return response.data.route;
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de l\'itinéraire:', error);
      throw error;
    }
  }
};

// Exporter le service et ses méthodes
export default directionsService;
// Exportation directe des fonctions pour compatibilité avec le code existant
export const { getCurrentPosition, geocodeAddress, getRoute } = directionsService;
export { formatDistance, formatDuration };