// services/tomtomService.js

/**
 * Service pour interagir avec les API TomTom
 * Ce fichier contient les fonctions pour récupérer les incidents de trafic
 */

// Clé API TomTom
const API_KEY = 'gRG7hmfbyydRpCyGd9rDtxCRTgwHGYwd';

/**
 * Récupère les incidents de trafic dans une zone géographique
 * Utilise la version 4 (obsolète mais fonctionnelle) de l'API TomTom
 * 
 * @param {Object} bounds - Les limites géographiques pour la recherche
 * @returns {Promise<Array>} - Tableau des incidents formatés
 */
export const getTrafficIncidents = async (bounds = null) => {
  try {
    // Utiliser les limites fournies ou des valeurs par défaut (Paris)
    const { minLon, minLat, maxLon, maxLat } = bounds || {
      minLon: 2.3, 
      minLat: 48.8, 
      maxLon: 2.5, 
      maxLat: 48.9
    };
    
    // Format correct pour l'API v4:
    // /traffic/services/4/incidentDetails/{style}/{boundingBox}/{zoom}/{trafficModelID}/{format}
    
    // Paramètres requis:
    const style = 's3'; // Style des incidents
    // Convertir en format Mercator pour éviter l'erreur "Invalid segments count"
    // Le format pour boundingBox est: minLat,minLon,maxLat,maxLon (oui, latitudes d'abord!)
    const boundingBox = `${minLat},${minLon},${maxLat},${maxLon}`;
    const zoom = '10'; // Niveau de zoom
    const trafficModelID = '-1'; // -1 = modèle de trafic par défaut/actuel
    const format = 'json'; // Format de réponse (xml, json)
    
    // Construire l'URL de l'API
    const url = `https://api.tomtom.com/traffic/services/4/incidentDetails/${style}/${boundingBox}/${zoom}/${trafficModelID}/${format}?key=${API_KEY}&projection=EPSG4326`;
    
    console.log('TomTom: Requête avec URL (format correct v4):', url);
    
    // Effectuer la requête
    const response = await fetch(url);
    
    // Vérifier si la réponse est OK
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur HTTP: ${response.status} - ${errorText}`);
    }
    
    // Analyser la réponse JSON
    const data = await response.json();
    
    // La structure est différente dans l'API v4
    if (!data || !data.tm || !data.tm.poi || !Array.isArray(data.tm.poi)) {
      console.log('TomTom: Aucun incident trouvé dans la zone ou format incorrect');
      return [];
    }
    
    const incidents = data.tm.poi;
    console.log(`TomTom: ${incidents.length} incidents trouvés`);
    
    // Convertir les incidents au format attendu par l'application
    const formattedIncidents = incidents.map((incident, index) => {
      try {
        // Déterminer le type d'incident (format différent dans l'API v4)
        let type = mapTomTomIncidentType(incident);
        
        // Extraire les coordonnées (format différent dans l'API v4)
        let coords = null;
        
        // Format v4: les coordonnées sont généralement dans p.x et p.y
        if (incident.p) {
          // IMPORTANT: Dans EPSG4326, x=longitude et y=latitude
          coords = [parseFloat(incident.p.x), parseFloat(incident.p.y)];
        }
        
        // Si les coordonnées ne sont pas valides, ignorer cet incident
        if (!coords || coords.some(isNaN)) {
          return null;
        }
        
        // Créer un identifiant unique
        const id = `tomtom-${incident.id || index}-${Date.now()}`;
        
        // Obtenir la description (dans d pour l'API v4)
        const description = incident.d || `Incident ${type}`;
        
        // Retourner l'incident formaté
        return {
          id,
          type,
          coords,
          source: 'tomtom',
          description,
          created_at: new Date().toISOString(),
          votes: { up: 2, down: 0 },
          reliability_score: 70
        };
      } catch (error) {
        console.warn(`TomTom: Erreur lors du traitement de l'incident ${index}:`, error);
        return null;
      }
    }).filter(Boolean); // Filtrer les incidents null
    
    return formattedIncidents;
  } catch (error) {
    console.error('TomTom: Erreur lors de la récupération des incidents:', error);
    return []; // Retourner un tableau vide en cas d'erreur
  }
};

/**
 * Mappe les types d'incidents TomTom vers les types utilisés par l'application
 * 
 * @param {Object} incident - L'incident TomTom
 * @returns {string} - Le type d'incident pour l'application
 */
const mapTomTomIncidentType = (incident) => {
  // Par défaut, considérer comme un danger général
  let type = 'hazard';
  
  if (!incident) {
    return type;
  }
  
  // Dans l'API v4, le type est souvent dans c ou t
  const category = (incident.c || incident.t || '').toLowerCase();
  
  // Mapper les types TomTom vers nos types d'incidents
  if (category.includes('accident')) {
    type = 'accident';
  } else if (
    category.includes('congestion') || 
    category.includes('jam') || 
    category.includes('queue') || 
    category.includes('slow')
  ) {
    type = 'traffic';
  } else if (
    category.includes('closure') || 
    category.includes('closed') || 
    category.includes('block')
  ) {
    type = 'closure';
  } else if (
    category.includes('police') || 
    category.includes('control') || 
    category.includes('check')
  ) {
    type = 'police';
  }
  
  return type;
};

/**
 * Récupère les données de segment de trafic pour une coordonnée spécifique
 * 
 * @param {Array} coordinate - Coordonnées [longitude, latitude]
 * @returns {Promise<Object>} - Données du segment de route
 */
export const getFlowSegmentData = async (coordinate) => {
  try {
    if (!coordinate || !Array.isArray(coordinate) || coordinate.length !== 2) {
      throw new Error('Coordonnées invalides');
    }
    
    const [longitude, latitude] = coordinate;
    
    // Construire l'URL pour l'API Flow Segment Data
    const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?key=${API_KEY}&point=${latitude},${longitude}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data || !data.flowSegmentData) {
      throw new Error('Format de réponse invalide');
    }
    
    return data.flowSegmentData;
  } catch (error) {
    console.warn('TomTom: Erreur lors de la récupération des données de segment:', error);
    return null;
  }
};

/**
 * Récupère les données de trafic pour plusieurs points dans une zone
 * 
 * @param {Object} bounds - Les limites géographiques de la zone
 * @returns {Promise<Array>} - Tableau des points de trafic avec leurs niveaux de congestion
 */
export const getTrafficFlowPoints = async (bounds) => {
  try {
    if (!bounds) {
      throw new Error('Limites géographiques non spécifiées');
    }
    
    const { minLon, minLat, maxLon, maxLat } = bounds;
    
    // Générer une grille de points dans la zone
    const gridSize = 0.002; // ~200m
    const points = [];
    
    // Créer une grille de points à échantillonner (pas trop dense pour éviter des appels API excessifs)
    for (let lon = minLon; lon <= maxLon; lon += gridSize) {
      for (let lat = minLat; lat <= maxLat; lat += gridSize) {
        // Ne prendre qu'un point sur 3 pour réduire le nombre de requêtes
        if (Math.random() < 0.3) {
          points.push([lon, lat]);
        }
      }
    }
    
    // Limiter à 20 points maximum pour éviter de surcharger l'API
    const sampledPoints = points.slice(0, 20);
    
    // Traiter les points par lots de 5 pour éviter de surcharger l'API
    const batchSize = 5;
    const trafficFlowData = [];
    
    for (let i = 0; i < sampledPoints.length; i += batchSize) {
      const batch = sampledPoints.slice(i, i + batchSize);
      
      // Traiter chaque point en parallèle
      const batchPromises = batch.map(async (point) => {
        try {
          const segmentData = await getFlowSegmentData(point);
          
          if (!segmentData) return null;
          
          // Calculer le niveau de congestion
          const currentSpeed = segmentData.currentSpeed || 0;
          const freeFlowSpeed = segmentData.freeFlowSpeed || 1; // Éviter division par 0
          const congestion = Math.max(0, Math.min(1, 1 - (currentSpeed / freeFlowSpeed)));
          
          // Extraire les coordonnées de la route
          const coordinates = segmentData.coordinates?.coordinate?.map(c => [
            parseFloat(c.longitude),
            parseFloat(c.latitude)
          ]) || [point];
          
          return {
            coordinates,
            intensity: congestion,
            currentSpeed,
            freeFlowSpeed,
            confidence: segmentData.confidence || 0.5,
            frc: segmentData.frc || 'FRC0'
          };
        } catch (error) {
          console.warn(`Erreur pour le point [${point}]:`, error);
          return null;
        }
      });
      
      try {
        const batchResults = await Promise.all(batchPromises);
        trafficFlowData.push(...batchResults.filter(Boolean));
      } catch (error) {
        console.error('Erreur lors du traitement d\'un lot:', error);
      }
      
      // Petite pause entre les lots pour éviter de surcharger l'API
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    return trafficFlowData;
  } catch (error) {
    console.error('TomTom: Erreur lors de la récupération des données de trafic:', error);
    return [];
  }
};

/**
 * Fonction utilitaire pour obtenir la clé API TomTom
 * @returns {string} - La clé API TomTom
 */
export const getApiKey = () => {
  return API_KEY;
};

export default {
  getTrafficIncidents,
  getFlowSegmentData,
  getTrafficFlowPoints,
  getApiKey
};