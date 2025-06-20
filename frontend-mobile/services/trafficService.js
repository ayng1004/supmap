// ../services/trafficService.js

import AsyncStorage from '@react-native-async-storage/async-storage';

// Fonction robuste pour récupérer les incidents depuis TomTom
// Correction de la fonction fetchTomTomIncidents pour résoudre l'erreur 400
// Fonction améliorée pour récupérer les incidents TomTom avec l'API V5
export const fetchTomTomIncidents = async (bounds = null) => {
  try {
    // Utiliser les limites fournies ou des valeurs par défaut
    const { minLon, minLat, maxLon, maxLat } = bounds || {
      minLon: 2.3, 
      minLat: 48.8, 
      maxLon: 2.5, 
      maxLat: 48.9
    };
    
    // Créer la chaîne de bounding box pour l'API
    const bboxString = `${minLon},${minLat},${maxLon},${maxLat}`;
    
    // Clé API TomTom
    const apiKey = 'gRG7hmfbyydRpCyGd9rDtxCRTgwHGYwd';
    
    console.log('TomTom: Construction de la requête avec bbox:', bboxString);
    
    // ÉTAPE 1: D'abord obtenir le Traffic Model ID actuel
    const trafficModelUrl = `https://api.tomtom.com/traffic/services/5/incidentViewport?key=${apiKey}&bbox=${bboxString}&zoom=10`;
    
    console.log('TomTom: Récupération du Traffic Model ID depuis:', trafficModelUrl);
    
    const modelResponse = await fetch(trafficModelUrl);
    if (!modelResponse.ok) {
      const errorText = await modelResponse.text();
      throw new Error(`Erreur HTTP lors de la récupération du Traffic Model ID: ${modelResponse.status} - ${errorText}`);
    }
    
    const modelData = await modelResponse.json();
    const trafficModelId = modelData?.tm?.id;
    
    if (!trafficModelId) {
      console.warn('TomTom: Impossible de récupérer le Traffic Model ID');
      throw new Error('Traffic Model ID non disponible');
    }
    
    console.log(`TomTom: Traffic Model ID récupéré: ${trafficModelId}`);
    
    // ÉTAPE 2: Maintenant utiliser l'API incidents avec le bon Traffic Model ID
    const url = `https://api.tomtom.com/traffic/services/5/incidentDetails?key=${apiKey}&bbox=${bboxString}&fields={incidents{type,geometry{type,coordinates},properties{iconCategory,description}}}&language=fr-FR&t=${trafficModelId}&timeValidityFilter=present`;
    
    console.log('TomTom: URL de requête avec Traffic Model ID:', url);
    
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur HTTP lors de la récupération des incidents: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    
    if (!data || !data.incidents || !Array.isArray(data.incidents)) {
      console.log('TomTom: Pas d\'incidents trouvés ou format de réponse incorrect');
      return [];
    }
    
    console.log(`TomTom: Reçu ${data.incidents.length} incidents`);
    
    // Convertir les incidents TomTom dans le format attendu par l'application
    return data.incidents.map((incident, index) => {
      try {
        // Déterminer le type d'incident basé sur les propriétés TomTom
        let type = 'hazard'; // type par défaut
        
        if (incident.type) {
          // Dans l'API V5, le type est directement disponible
          const incidentType = incident.type.toLowerCase();
          if (incidentType.includes('accident')) type = 'accident';
          else if (incidentType.includes('congestion') || incidentType.includes('jam')) type = 'traffic';
          else if (incidentType.includes('closure') || incidentType.includes('closed')) type = 'closure';
          else if (incidentType.includes('police') || incidentType.includes('control')) type = 'police';
        } else if (incident.properties && incident.properties.iconCategory) {
          // Utiliser iconCategory comme alternative
          const category = incident.properties.iconCategory.toLowerCase();
          if (category.includes('accident')) type = 'accident';
          else if (category.includes('congestion') || category.includes('jam')) type = 'traffic';
          else if (category.includes('closure') || category.includes('closed')) type = 'closure';
          else if (category.includes('police') || category.includes('control')) type = 'police';
        }
        
        // Extraire les coordonnées - la structure est différente dans l'API V5
        let coords = null;
        
        if (incident.geometry && incident.geometry.type === 'Point' && 
            Array.isArray(incident.geometry.coordinates) && 
            incident.geometry.coordinates.length >= 2) {
          // Point GeoJSON (format standard)
          coords = incident.geometry.coordinates;
        } else if (incident.geometry && incident.geometry.type === 'LineString' && 
                  Array.isArray(incident.geometry.coordinates) && 
                  incident.geometry.coordinates.length > 0 &&
                  Array.isArray(incident.geometry.coordinates[0]) &&
                  incident.geometry.coordinates[0].length >= 2) {
          // Première coordonnée d'une LineString
          coords = incident.geometry.coordinates[0];
        }
        
        // Si on n'a pas pu extraire les coordonnées, ignorer cet incident
        if (!coords || coords.length < 2 || 
            isNaN(parseFloat(coords[0])) || isNaN(parseFloat(coords[1]))) {
          console.warn(`TomTom: Coordonnées invalides pour l'incident ${index}:`, incident.geometry);
          return null;
        }
        
        // Créer un ID unique pour cet incident
        // Utiliser l'ID fourni par TomTom si disponible
        const id = incident.id ? `tomtom-${incident.id}` : `tomtom-${index}-${Date.now()}`;
        
        // Extraire la description
        let description = 'Incident de circulation';
        if (incident.properties && incident.properties.description) {
          description = incident.properties.description;
        }
        
        // Convertir au format attendu par l'application
        return {
          id,
          type,
          coords,
          source: 'tomtom',
          description,
          created_at: new Date().toISOString(),
          votes: { up: 2, down: 0 }, // Valeurs par défaut
          reliability_score: 70
        };
      } catch (err) {
        console.warn(`TomTom: Erreur lors du traitement de l'incident ${index}:`, err);
        return null;
      }
    }).filter(Boolean); // Filtrer les null
  } catch (error) {
    console.error('TomTom: Erreur lors de la récupération des incidents:', error);
    // En cas d'erreur, retourner un tableau vide au lieu de laisser l'erreur se propager
    return [];
  }
};

// Fonction pour fusionner les incidents de différentes sources sans doublons
export const mergeIncidents = (localIncidents = [], externalIncidents = []) => {
  // S'assurer que les deux arguments sont des tableaux
  if (!Array.isArray(localIncidents)) {
    console.warn('mergeIncidents: localIncidents n\'est pas un tableau:', localIncidents);
    localIncidents = [];
  }
  if (!Array.isArray(externalIncidents)) {
    console.warn('mergeIncidents: externalIncidents n\'est pas un tableau:', externalIncidents);
    externalIncidents = [];
  }
  
  console.log(`mergeIncidents: Fusion de ${localIncidents.length} incidents locaux et ${externalIncidents.length} incidents externes`);
  
  try {
    // Vérifier et normaliser les incidents locaux
    const validLocalIncidents = localIncidents
      .filter(incident => {
        return incident && incident.id && (
          incident.coords || 
          incident.location || 
          (incident.latitude && incident.longitude) || 
          (incident.lat && incident.lng)
        );
      })
      .map(incident => ({
        ...incident,
        // Garantir un ID valide
        id: incident.id.toString(),
        // S'assurer que les votes sont présents
        votes: incident.votes || { up: 0, down: 0 }
      }));
    
    // Créer un ensemble d'IDs pour les incidents locaux
    const localIds = new Set(validLocalIncidents.map(inc => inc.id));
    
    // Filtrer les incidents externes pour éviter les doublons
    const filteredExternalIncidents = externalIncidents
      .filter(incident => {
        // Vérifier si l'incident est valide
        const isValid = incident && incident.id && (
          incident.coords || 
          incident.location || 
          (incident.latitude && incident.longitude) || 
          (incident.lat && incident.lng)
        );
        
        // Ne pas inclure des incidents déjà dans localIncidents
        const isUnique = !localIds.has(incident.id?.toString());
        
        return isValid && isUnique;
      })
      .map(incident => ({
        ...incident,
        // Garantir un ID valide
        id: incident.id.toString(),
        // S'assurer que les votes sont présents
        votes: incident.votes || { up: 0, down: 0 }
      }));
    
    console.log(`mergeIncidents: Après filtrage - ${validLocalIncidents.length} incidents locaux et ${filteredExternalIncidents.length} incidents externes`);
    
    // Combiner les deux tableaux
    return [...validLocalIncidents, ...filteredExternalIncidents];
  } catch (error) {
    console.error('mergeIncidents: Erreur lors de la fusion des incidents:', error);
    // En cas d'erreur, retourner la combinaison simple des tableaux d'origine
    return [...localIncidents, ...externalIncidents];
  }
};

// Fonction pour normaliser les coordonnées d'un incident
export const normalizeIncidentCoordinates = (incident) => {
  if (!incident) {
    console.log('normalizeIncidentCoordinates: Incident null passé');
    return null;
  }
  
  let coords = null;
  
  // Cas 1: Coordonnées directement dans l'objet sous forme de tableau
  if (incident.coords && Array.isArray(incident.coords)) {
    coords = incident.coords;
    console.log('normalizeIncidentCoordinates: Coords trouvées dans incident.coords:', coords);
  } 
  // Cas 2: Coordonnées dans incident.location
  else if (incident.location) {
    // Cas 2.1: Location est un tableau
    if (Array.isArray(incident.location)) {
      coords = incident.location;
      console.log('normalizeIncidentCoordinates: Coords trouvées dans incident.location (tableau):', coords);
    } 
    // Cas 2.2: Location est un objet GeoJSON
    else if (incident.location.coordinates && Array.isArray(incident.location.coordinates)) {
      coords = incident.location.coordinates;
      console.log('normalizeIncidentCoordinates: Coords trouvées dans incident.location.coordinates:', coords);
    }
  } 
  // Cas 3: Latitude et longitude sous forme de propriétés distinctes
  else if (incident.longitude !== undefined && incident.latitude !== undefined) {
    coords = [parseFloat(incident.longitude), parseFloat(incident.latitude)];
    console.log('normalizeIncidentCoordinates: Coords trouvées dans incident.longitude/latitude:', coords);
  }
  // Cas 4: Lat et lng sous forme de propriétés distinctes
  else if (incident.lng !== undefined && incident.lat !== undefined) {
    coords = [parseFloat(incident.lng), parseFloat(incident.lat)];
    console.log('normalizeIncidentCoordinates: Coords trouvées dans incident.lng/lat:', coords);
  }
  
  // Vérifier que les coordonnées sont valides
  if (!coords || coords.length < 2 || !coords[0] || !coords[1] || 
      isNaN(parseFloat(coords[0])) || isNaN(parseFloat(coords[1]))) {
    console.warn('normalizeIncidentCoordinates: Coordonnées invalides pour incident:', incident);
    return null;
  }
  
  // Assurez-vous que les coordonnées sont des nombres
  return [parseFloat(coords[0]), parseFloat(coords[1])];
};

// Obtenir les limites de la carte autour de l'utilisateur
export const getUserBounds = (userLocation, radius = 0.01) => {
  if (!userLocation) {
    // Coordonnées par défaut pour Paris
    return {
      minLon: 2.3, 
      minLat: 48.8, 
      maxLon: 2.5, 
      maxLat: 48.9
    };
  }
  
  const [userLng, userLat] = userLocation;
  
  // Créer un rectangle autour de l'utilisateur
  // radius = 0.01 équivaut à environ 1km
  return {
    minLon: userLng - radius,
    minLat: userLat - radius,
    maxLon: userLng + radius,
    maxLat: userLat + radius
  };
};

// Générer des incidents de secours autour de la position utilisateur
export const getFallbackIncidents = (userLocation) => {
  console.log('Génération d\'incidents de secours');
  
  // Si aucune position utilisateur n'est disponible, utiliser une position par défaut (Paris)
  if (!userLocation) {
    userLocation = [2.3488, 48.8534];
  }
  
  const [userLng, userLat] = userLocation;
  
  // Générer des incidents fictifs autour de la position de l'utilisateur
  return [
    {
      id: 'fallback-1',
      type: 'traffic',
      coords: [userLng + 0.005, userLat + 0.002],
      description: 'Embouteillage important',
      created_at: new Date().toISOString(),
      votes: { up: 5, down: 1 }
    },
    {
      id: 'fallback-2',
      type: 'accident',
      coords: [userLng - 0.003, userLat + 0.004],
      description: 'Accident de circulation',
      created_at: new Date().toISOString(),
      votes: { up: 8, down: 0 }
    },
    {
      id: 'fallback-3',
      type: 'police',
      coords: [userLng + 0.001, userLat - 0.002],
      description: 'Contrôle de police',
      created_at: new Date().toISOString(),
      votes: { up: 3, down: 1 }
    },
    {
      id: 'fallback-4',
      type: 'hazard',
      coords: [userLng - 0.002, userLat - 0.003],
      description: 'Débris sur la route',
      created_at: new Date().toISOString(),
      votes: { up: 2, down: 0 }
    },
    {
      id: 'fallback-5',
      type: 'closure',
      coords: [userLng + 0.004, userLat - 0.001],
      description: 'Route fermée pour travaux',
      created_at: new Date().toISOString(),
      votes: { up: 6, down: 1 }
    }
  ];
};

// Vérifier si un incident est toujours actif (pas expiré)
export const isIncidentActive = (incident) => {
  if (!incident) return false;
  if (incident.active === false) return false;
  
  const now = new Date();
  const createdDate = new Date(incident.created_at || incident.timestamp);
  const age = now - createdDate;
  
  // Définir des durées de vie par type d'incident
  const EXPIRATION_TIMES = {
    'traffic': 3 * 60 * 60 * 1000,  // 3 heures pour embouteillages
    'police': 2 * 60 * 60 * 1000,   // 2 heures pour contrôles policiers
    'closure': 12 * 60 * 60 * 1000, // 12 heures pour routes fermées
    'accident': 6 * 60 * 60 * 1000, // 6 heures pour accidents
    'hazard': 4 * 60 * 60 * 1000    // 4 heures pour obstacles
  };
  
  const expirationTime = EXPIRATION_TIMES[incident.type] || 4 * 60 * 60 * 1000;
  
  // Expiration basée sur le temps
  if (age > expirationTime) return false;
  
  // Expiration basée sur les votes
  const { up = 0, down = 0 } = incident.votes || {};
  if (down > up && down >= 3) return false;
  
  return true;
};

// Fonction pour formater le temps écoulé
export const getElapsedTime = (timestamp) => {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMinutes = Math.floor((now - date) / (1000 * 60));
  
  if (diffMinutes < 1) return 'À l\'instant';
  if (diffMinutes < 60) return `Il y a ${diffMinutes} min`;
  
  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  
  const days = Math.floor(hours / 24);
  return `Il y a ${days} jour${days > 1 ? 's' : ''}`;
};

// Export par défaut pour tous les utilitaires liés au trafic
export default {
  fetchTomTomIncidents,
  mergeIncidents,
  normalizeIncidentCoordinates,
  getUserBounds,
  getFallbackIncidents,
  isIncidentActive,
  getElapsedTime
};