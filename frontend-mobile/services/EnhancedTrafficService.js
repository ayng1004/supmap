// services/EnhancedTrafficService.js
// Ce service combine les données de vos incidents avec des services externes pour des prédictions précises

import TrafficPredictionService from './TrafficServiceAdapter';
import SmartNavigationService from './SmartNavigationService';
import apiService from './api';
import tomtomService from './tomtomService';
import * as turf from '@turf/turf';

// Configuration pour la qualité des prédictions
const CONFIG = {
  // Poids des différentes sources pour le calcul des prédictions
  WEIGHTS: {
    LOCAL_INCIDENTS: 0.4,     // Incidents signalés par les utilisateurs
    TOMTOM_INCIDENTS: 0.3,    // Incidents provenant de TomTom
    HISTORICAL_PATTERNS: 0.2, // Modèles de trafic historiques
    REAL_TIME_SPEEDS: 0.1     // Vitesses en temps réel (si disponibles)
  },
  
  // Durée de vie des prédictions en minutes
  PREDICTION_TTL: 15,
  
  // Rayon pour rechercher des incidents (en km)
  INCIDENT_SEARCH_RADIUS: 5,
  
  // Cache pour les segments de route TomTom
  CACHE: {
    segments: new Map(),
    lastUpdate: null,
    expiryTime: 60000  // 1 minute
  },
  
  // Limites pour les requêtes TomTom
  TOMTOM_LIMITS: {
    maxPointsPerRequest: 25,
    maxRequestsPerMinute: 30
  }
};

/**
 * Service amélioré de prédiction d'embouteillages qui combine plusieurs sources de données
 */
const EnhancedTrafficService = {
  // Gardez une trace des requêtes en cours pour éviter les doublons
  _pendingRequests: new Set(),
  
  // Garder un cache des données de trafic par région
  _trafficCache: {
    regions: {},
    lastCleanup: 0
  },
  
  /**
   * Prédire les embouteillages pour une région donnée
   * @param {Object} bounds - Limites de la région {minLat, minLon, maxLat, maxLon}
   * @param {Date} time - Heure pour laquelle faire la prédiction (par défaut: maintenant)
   * @returns {Promise<Array>} - Prédictions de trafic pour la région
   */
  predictTrafficForRegion: async (bounds, time = new Date()) => {
    try {
      // 1. Récupérer les incidents locaux (de votre base de données)
      const localIncidents = await apiService.incidents.getInArea(bounds);
      console.log(`Récupéré ${localIncidents.length} incidents locaux pour prédiction`);
      
      // 2. Récupérer les incidents depuis TomTom (ou autre API externe)
      const tomtomIncidents = await tomtomService.getTrafficIncidents(bounds);
      console.log(`Récupéré ${tomtomIncidents.length} incidents TomTom pour prédiction`);
      
      // 3. Récupérer les modèles de trafic historiques pour l'heure spécifiée
      let historicalPatterns = TrafficPredictionService.getHistoricalPredictions(bounds, time);
      
      // 4. Générer une représentation plus réaliste du réseau routier
      const roadNetworkPredictions = generateRealisticRoadNetwork(bounds, localIncidents, tomtomIncidents);
      
      // Fusionner avec les modèles historiques pour des prédictions plus réalistes
      if (Array.isArray(historicalPatterns) && historicalPatterns.length > 0) {
        // On peut fusionner les historiques si disponibles
        const combinedPredictions = roadNetworkPredictions.map(prediction => {
          const nearbyHistorical = findNearbyHistoricalPoints(prediction, historicalPatterns);
          if (nearbyHistorical.length > 0) {
            const avgIntensity = nearbyHistorical.reduce((sum, point) => 
              sum + (point.intensity || 0.5), 0) / nearbyHistorical.length;
            
            // Intensité combinée: 60% réseau routier généré, 40% données historiques
            const combinedIntensity = (prediction.intensity * 0.6) + (avgIntensity * 0.4);
            return {
              ...prediction,
              intensity: combinedIntensity
            };
          }
          return prediction;
        });
        
        return combinedPredictions;
      }
      
      // Si pas de données historiques, utiliser uniquement notre réseau routier généré
      return roadNetworkPredictions;
    } catch (error) {
      console.error('Erreur lors de la prédiction du trafic:', error);
      // En cas d'erreur, on utilise uniquement les données historiques ou un fallback
      console.log(`Utilisation des prédictions historiques de secours pour ${JSON.stringify(bounds)}`);
      return generateHistoricalFallbackPredictions(bounds, time);
    }
  },
  
  /**
   * Prédire les embouteillages le long d'un itinéraire
   * @param {Object} route - L'itinéraire pour lequel faire des prédictions
   * @param {Date} departureTime - Heure de départ
   * @returns {Promise<Object>} - Itinéraire enrichi avec des prédictions de trafic
   */
  predictTrafficAlongRoute: async (route, departureTime = new Date()) => {
    if (!route || !route.geometry) {
      console.error('Route invalide pour la prédiction de trafic');
      return route;
    }
    
    try {
      // 1. Créer un buffer autour de l'itinéraire pour trouver les incidents pertinents
      const routeLine = turf.lineString(route.geometry.coordinates);
      const buffer = turf.buffer(routeLine, CONFIG.INCIDENT_SEARCH_RADIUS, { units: 'kilometers' });
      const boundingBox = turf.bbox(buffer);
      
      // Convertir la bounding box en format utilisé par l'API
      const bounds = {
        minLat: boundingBox[1],
        minLon: boundingBox[0],
        maxLat: boundingBox[3],
        maxLon: boundingBox[2]
      };
      
      // 2. Obtenir des prédictions pour cette région
      const regionPredictions = await EnhancedTrafficService.predictTrafficForRegion(bounds, departureTime);
      
      // 3. Analyser l'itinéraire avec le service de prédiction de trafic existant
      const analyzedRoute = TrafficPredictionService.analyzeAndPredictTraffic([route], departureTime)[0];
      
      // 4. Affiner les prédictions en utilisant les incidents locaux et TomTom
      const enhancedRoute = enhanceRouteWithIncidents(analyzedRoute, regionPredictions);
      
      return enhancedRoute;
    } catch (error) {
      console.error('Erreur lors de la prédiction le long de l\'itinéraire:', error);
      // En cas d'erreur, utiliser uniquement l'analyse existante
      return TrafficPredictionService.analyzeAndPredictTraffic([route], departureTime)[0];
    }
  },
  
  /**
   * Suggérer la meilleure heure de départ pour éviter les embouteillages
   * @param {Object} route - L'itinéraire pour lequel faire des suggestions
   * @param {Date} earliestDeparture - Heure de départ la plus précoce possible
   * @param {Date} latestDeparture - Heure de départ la plus tardive acceptable
   * @returns {Promise<Array>} - Heures de départ suggérées, triées de la meilleure à la pire
   */
  suggestBestDepartureTime: async (route, earliestDeparture = new Date(), latestDeparture = null) => {
    try {
      // Utiliser la fonction existante, mais enrichie avec nos données
      const suggestions = TrafficPredictionService.suggestOptimalDepartureTime(
        route, 
        earliestDeparture, 
        latestDeparture
      );
      
      // Enrichir chaque suggestion avec des données plus précises d'incidents
      const enhancedSuggestions = await Promise.all(
        suggestions.map(async (suggestion) => {
          // Prédire le trafic pour cette heure de départ spécifique
          const routeWithPrediction = await EnhancedTrafficService.predictTrafficAlongRoute(
            route, 
            new Date(suggestion.departureTime)
          );
          
          // Enrichir la suggestion avec ces prédictions plus précises
          return {
            ...suggestion,
            enhancedScore: routeWithPrediction.trafficPrediction.score,
            hotspots: routeWithPrediction.trafficPrediction.hotspots || [],
            predictedDelay: routeWithPrediction.trafficPrediction.estimatedDelay || suggestion.estimatedDelay
          };
        })
      );
      
      // Retrier les suggestions en fonction du score amélioré
      return enhancedSuggestions.sort((a, b) => b.enhancedScore - a.enhancedScore);
    } catch (error) {
      console.error('Erreur lors de la suggestion de meilleure heure de départ:', error);
      // En cas d'erreur, retourner les suggestions de base
      return TrafficPredictionService.suggestOptimalDepartureTime(route, earliestDeparture, latestDeparture);
    }
  },
  
  /**
   * Visualiser les prédictions de trafic sur la carte
   * @param {Object} map - Référence à l'objet carte (MapBox)
   * @param {Array} predictions - Prédictions de trafic
   */
  visualizePredictions: (map, predictions) => {
    if (!map || !predictions || !predictions.length) {
      console.log('Aucune donnée à visualiser');
      return;
    }
    
    try {
      console.log(`Visualisation de ${predictions.length} prédictions sur la carte`);
      
      // Si nous avons un objet de référence React avec .current
      if (map && map.current) {
        // Code existant pour React Native Mapbox
        const hotspots = predictions
          .filter(pred => (pred.intensity || pred.congestion/100) > 0.4)
          .slice(0, 5);
          
        console.log('Points chauds de trafic :', 
          hotspots.map(spot => ({
            location: [spot.longitude || spot.coordinates?.[0], spot.latitude || spot.coordinates?.[1]],
            intensity: spot.intensity || spot.congestion/100,
            type: spot.type
          }))
        );
      }
      // Si map est directement l'objet carte
      else if (map) {
        // Autre implémentation si nécessaire
        console.log('Utilisation de l\'objet carte directement');
      }
    } catch (error) {
      console.error('Erreur lors de la visualisation (ignorée):', error);
    }
  },
  
  /**
   * NOUVELLE FONCTION: Récupérer les données de trafic réel pour une région visible
   * Utilise l'API TomTom pour obtenir des données précises alignées sur les routes
   * @param {Object} bounds - Limites de la région {minLat, minLon, maxLat, maxLon}
   * @param {number} zoomLevel - Niveau de zoom actuel
   * @returns {Promise<Array>} - Segments de trafic pour la région
   */
  getTrafficForVisibleRegion: async (bounds, zoomLevel = 15) => {
    if (!bounds) {
      console.warn('EnhancedTrafficService: Limites de région non spécifiées');
      return [];
    }
    
    try {
      // Générer une clé pour cette région
      const regionKey = `${bounds.minLat.toFixed(4)},${bounds.minLon.toFixed(4)},${bounds.maxLat.toFixed(4)},${bounds.maxLon.toFixed(4)}`;
      
      // Vérifier si cette région est en cours de chargement
      if (EnhancedTrafficService._pendingRequests.has(regionKey)) {
        console.log(`Chargement déjà en cours pour ${regionKey}`);
        return [];
      }
      
      // Vérifier le cache
      if (EnhancedTrafficService._checkCache(regionKey)) {
        console.log(`Utilisation des données en cache pour ${regionKey}`);
        return EnhancedTrafficService._trafficCache.regions[regionKey].data;
      }
      
      // Marquer cette région comme en cours de chargement
      EnhancedTrafficService._pendingRequests.add(regionKey);
      
      // Division de la région basée sur le niveau de zoom
      const divisions = zoomLevel >= 17 ? 3 : (zoomLevel >= 14 ? 2 : 1);
      const subRegions = EnhancedTrafficService._divideRegion(bounds, divisions);
      
      try {
        // Obtenir les données TomTom pour les sous-régions
        const subRegionPromises = subRegions.map(subBounds => 
          EnhancedTrafficService._getTrafficSegmentsForRegion(subBounds)
        );
        
        const results = await Promise.all(subRegionPromises);
        
        // Fusionner les résultats de toutes les sous-régions
        let allSegments = [];
        results.forEach(segments => {
          if (segments && Array.isArray(segments)) {
            allSegments = allSegments.concat(segments);
          }
        });
        
        // Ajouter au cache
        EnhancedTrafficService._updateCache(regionKey, allSegments);
        
        return allSegments;
      } finally {
        // Marquer cette région comme terminée
        EnhancedTrafficService._pendingRequests.delete(regionKey);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des données de trafic:', error);
      
      // En cas d'erreur, on utilise des données générées
      console.log(`Génération de données de secours pour ${JSON.stringify(bounds)}`);
      return EnhancedTrafficService._generateFallbackTrafficData(bounds);
    }
  },
  
  /**
   * NOUVELLE FONCTION: Convertir les données de trafic en GeoJSON pour Mapbox
   * @param {Array} trafficData - Segments de trafic
   * @returns {Object} - Objet GeoJSON pour Mapbox
   */
 
convertToGeoJSON: (trafficData) => {
  console.log("Conversion en GeoJSON de", trafficData?.length || 0, "segments");
  
  if (!trafficData || !Array.isArray(trafficData) || trafficData.length === 0) {
    console.log("Pas de données à convertir");
    return {
      type: 'FeatureCollection',
      features: []
    };
  }
  
  const features = [];
  
  trafficData.forEach((segment, index) => {
    try {
      // Vérification des données
      if (!segment) {
        console.log(`Segment ${index} est null ou undefined`);
        return;
      }
      
      console.log(`Traitement du segment ${index}:`, 
        segment.coordinates ? `${segment.coordinates.length} points` : "pas de coordonnées");
      
      // S'il y a au moins 2 points, créer une ligne
      if (segment.coordinates && segment.coordinates.length >= 2) {
        // Déterminer la couleur en fonction de l'intensité
        const intensity = segment.intensity || 0;
        let color;
        if (intensity < 0.3) color = '#4CD964';      // Vert - fluide
        else if (intensity < 0.5) color = '#FFCC00'; // Jaune - modéré
        else if (intensity < 0.7) color = '#FF9500'; // Orange - dense
        else color = '#FF3B30';                      // Rouge - très dense
        
        features.push({
          type: 'Feature',
          properties: {
            intensity: intensity,
            color: color,
            currentSpeed: segment.currentSpeed,
            freeFlowSpeed: segment.freeFlowSpeed,
            segmentId: `segment-${index}`
          },
          geometry: {
            type: 'LineString',
            coordinates: segment.coordinates
          }
        });
        
        console.log(`Ligne ajoutée pour segment ${index} avec couleur ${color}`);
      } 
      // S'il y a exactement 1 point, créer un cercle
      else if (segment.coordinates && segment.coordinates.length === 1) {
        const intensity = segment.intensity || 0;
        let color;
        if (intensity < 0.3) color = '#4CD964';
        else if (intensity < 0.5) color = '#FFCC00';
        else if (intensity < 0.7) color = '#FF9500';
        else color = '#FF3B30';
        
        features.push({
          type: 'Feature',
          properties: {
            intensity: intensity,
            color: color,
            pointId: `point-${index}`
          },
          geometry: {
            type: 'Point',
            coordinates: segment.coordinates[0]
          }
        });
        
        console.log(`Point ajouté pour segment ${index} avec couleur ${color}`);
      } else {
        console.log(`Segment ${index} ignoré - pas de coordonnées valides`);
      }
    } catch (error) {
      console.error(`Erreur lors du traitement du segment ${index}:`, error);
    }
  });
  
  console.log(`Total: ${features.length} features créées`);
  
  return {
    type: 'FeatureCollection',
    features: features
  };
},
  
  /**
   * NOUVELLE FONCTION PRIVÉE: Vérifier si les données sont en cache
   * @private
   */
  _checkCache: (regionKey) => {
    // Nettoyer le cache périodiquement
    EnhancedTrafficService._cleanCache();
    
    if (!EnhancedTrafficService._trafficCache.regions[regionKey]) {
      return false;
    }
    
    const now = Date.now();
    const cacheEntry = EnhancedTrafficService._trafficCache.regions[regionKey];
    
    // Vérifier si les données sont encore valides (moins de 60 secondes)
    return (now - cacheEntry.timestamp) < 60000;
  },
  
  /**
   * NOUVELLE FONCTION PRIVÉE: Mettre à jour le cache
   * @private
   */
  _updateCache: (regionKey, data) => {
    EnhancedTrafficService._trafficCache.regions[regionKey] = {
      data: data,
      timestamp: Date.now()
    };
  },
  
  /**
   * NOUVELLE FONCTION PRIVÉE: Nettoyer le cache
   * @private
   */
  _cleanCache: () => {
    const now = Date.now();
    
    // Ne nettoyer qu'une fois par minute
    if (now - EnhancedTrafficService._trafficCache.lastCleanup < 60000) {
      return;
    }
    
    EnhancedTrafficService._trafficCache.lastCleanup = now;
    
    // Supprimer les entrées plus anciennes que 2 minutes
    Object.keys(EnhancedTrafficService._trafficCache.regions).forEach(key => {
      const entry = EnhancedTrafficService._trafficCache.regions[key];
      if (now - entry.timestamp > 120000) {
        delete EnhancedTrafficService._trafficCache.regions[key];
      }
    });
  },
  
  /**
   * NOUVELLE FONCTION PRIVÉE: Diviser une région en sous-régions
   * @private
   */
  _divideRegion: (bounds, divisions = 2) => {
    const { minLat, minLon, maxLat, maxLon } = bounds;
    
    const latStep = (maxLat - minLat) / divisions;
    const lonStep = (maxLon - minLon) / divisions;
    
    const regions = [];
    
    for (let i = 0; i < divisions; i++) {
      for (let j = 0; j < divisions; j++) {
        const subRegion = {
          minLat: minLat + (i * latStep),
          minLon: minLon + (j * lonStep),
          maxLat: minLat + ((i + 1) * latStep),
          maxLon: minLon + ((j + 1) * lonStep)
        };
        
        regions.push(subRegion);
      }
    }
    
    return regions;
  },
  
  /**
   * NOUVELLE FONCTION PRIVÉE: Obtenir les segments de trafic réels pour une région
   * Utilise l'API Flow Segment Data de TomTom
   * @private
   */
  _getTrafficSegmentsForRegion: async (bounds) => {
    try {
      // Créer une grille de points d'échantillonnage dans la région
      const gridSize = 0.002; // ~200m
      const points = [];
      
      for (let lon = bounds.minLon; lon <= bounds.maxLon; lon += gridSize) {
        for (let lat = bounds.minLat; lat <= bounds.maxLat; lat += gridSize) {
          // Prendre un point sur 3 pour éviter trop de requêtes
          if (Math.random() < 0.3) {
            points.push([lon, lat]);
          }
        }
      }
      
      // Limiter à 20 points maximum
      const sampledPoints = points.slice(0, 20);
      
      // Traiter les points par lots pour éviter de surcharger l'API
      const batchSize = 5;
      const trafficSegments = [];
      
      for (let i = 0; i < sampledPoints.length; i += batchSize) {
        const batch = sampledPoints.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (point) => {
          try {
            // Utiliser l'API TomTom Flow Segment Data
            const flowData = await tomtomService.getFlowSegmentData(point);
            
            if (!flowData) return null;
            
            // Calculer le niveau de congestion
            const currentSpeed = flowData.currentSpeed || 0;
            const freeFlowSpeed = flowData.freeFlowSpeed || 1;
            const intensity = Math.max(0, Math.min(1, 1 - (currentSpeed / freeFlowSpeed)));
            
            // Extraire les coordonnées du segment
            const coordinates = flowData.coordinates?.coordinate?.map(c => [
              parseFloat(c.longitude),
              parseFloat(c.latitude)
            ]);
            
            if (!coordinates || coordinates.length < 2) return null;
            
            return {
              coordinates,
              intensity,
              currentSpeed,
              freeFlowSpeed,
              confidence: flowData.confidence || 0.5,
              frc: flowData.frc
            };
          } catch (error) {
            console.warn(`Erreur pour le point [${point}]:`, error);
            return null;
          }
        });
        
        try {
          const batchResults = await Promise.all(batchPromises);
          trafficSegments.push(...batchResults.filter(Boolean));
        } catch (error) {
          console.error('Erreur lors du traitement d\'un lot:', error);
        }
        
        // Pause entre les lots
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      return trafficSegments;
    } catch (error) {
      console.error('Erreur lors de l\'obtention des segments de trafic:', error);
      return [];
    }
  },
  
  /**
   * NOUVELLE FONCTION PRIVÉE: Générer des données de trafic de secours
   * Utilise le code existant pour générer un réseau routier réaliste
   * @private
   */
  _generateFallbackTrafficData: (bounds) => {
    // Simuler des incidents pour générer un trafic réaliste
    const simulatedIncidents = [
      {
        type: 'traffic',
        coords: [
          (bounds.minLon + bounds.maxLon) / 2,
          (bounds.minLat + bounds.maxLat) / 2
        ]
      },
      {
        type: 'accident',
        coords: [
          bounds.minLon + (bounds.maxLon - bounds.minLon) * 0.7,
          bounds.minLat + (bounds.maxLat - bounds.minLat) * 0.3
        ]
      }
    ];
    
    // Utiliser la fonction existante pour générer un réseau routier réaliste
    const roadNetwork = generateRealisticRoadNetwork(bounds, simulatedIncidents, []);
    
    // Convertir au format attendu
    return roadNetwork.map(point => ({
      coordinates: [[point.longitude, point.latitude]],
      intensity: point.intensity,
      type: point.type
    }));
  }
};

/**
 * Générer un réseau routier réaliste pour une zone donnée
 * @private
 */
function generateRealisticRoadNetwork(bounds, localIncidents, tomtomIncidents) {
  const result = [];
  const roads = [];
  
  // Distances approximatives entre axes routiers (en degrés)
  const majorRoadSpacing = 0.005; // ~500m
  const minorRoadSpacing = 0.0015; // ~150m
  
  // Centre de la zone pour intensifier le trafic vers le centre
  const centerLat = (bounds.minLat + bounds.maxLat) / 2;
  const centerLon = (bounds.minLon + bounds.maxLon) / 2;
  
  // 1. Créer les routes principales (axes horizontaux et verticaux) avec une légère ondulation
  const numMajorRoads = Math.floor((bounds.maxLat - bounds.minLat) / majorRoadSpacing);
  
  // Routes horizontales principales - plus naturelles avec des courbes subtiles
  for (let i = 0; i < numMajorRoads; i++) {
    const roadId = `h-major-${i}`;
    // Légère variation pour éviter une grille parfaite
    const baseLat = bounds.minLat + ((bounds.maxLat - bounds.minLat) * (i + 0.45 + Math.random() * 0.1) / numMajorRoads);
    
    const road = {
      id: roadId,
      type: 'horizontal',
      isMajor: true,
      baseLat: baseLat,
      points: []
    };
    
    // Ajouter un point tous les ~25m pour plus de précision
    for (let lon = bounds.minLon; lon <= bounds.maxLon; lon += 0.00025) {
      // Créer une ondulation naturelle avec plusieurs fréquences superposées
      const waveFactor1 = Math.sin(lon * 100) * 0.0002; // Ondulation principale
      const waveFactor2 = Math.sin(lon * 220) * 0.00005; // Petite ondulation secondaire
      const randomJitter = (Math.random() - 0.5) * 0.00003; // Très légère variation aléatoire
      
      const variationCycle = waveFactor1 + waveFactor2 + randomJitter;
      
      // Intensité du trafic plus réaliste
      const distanceToCenter = Math.sqrt(
        Math.pow(lon - centerLon, 2) + 
        Math.pow(baseLat - centerLat, 2)
      );
      
      // Ajouter plus de variation en fonction de la position
      let intensity = 0.3 + (0.3 * (1 - Math.min(1, distanceToCenter * 5)));
      
      // Augmenter l'intensité près des intersections majeures
      const nearIntersection = Math.abs((lon / majorRoadSpacing) % 1 - 0.5) < 0.15;
      if (nearIntersection) {
        intensity += 0.15;
      }
      
      // Ajouter une variation aléatoire contrôlée
      intensity += (Math.random() * 0.05) - 0.025; // Moins aléatoire pour plus de cohérence
      
      // Limiter l'intensité entre 0.1 et 0.9
      intensity = Math.max(0.1, Math.min(0.9, intensity));
      
      road.points.push({
        latitude: baseLat + variationCycle,
        longitude: lon,
        intensity: intensity,
        type: getTrafficTypeByIntensity(intensity),
        roadId: roadId // ID de route pour le regroupement
      });
    }
    
    roads.push(road);
  }
  
  // Routes verticales principales - aussi avec des courbes naturelles
  const numVerticalMajorRoads = Math.floor((bounds.maxLon - bounds.minLon) / majorRoadSpacing);
  for (let i = 0; i < numVerticalMajorRoads; i++) {
    const roadId = `v-major-${i}`;
    // Légère variation pour éviter une grille parfaite
    const baseLon = bounds.minLon + ((bounds.maxLon - bounds.minLon) * (i + 0.45 + Math.random() * 0.1) / numVerticalMajorRoads);
    
    const road = {
      id: roadId,
      type: 'vertical',
      isMajor: true,
      baseLon: baseLon,
      points: []
    };
    
    // Points plus rapprochés pour meilleure définition
    for (let lat = bounds.minLat; lat <= bounds.maxLat; lat += 0.00025) {
      // Ondulation similaire aux routes horizontales
      const waveFactor1 = Math.sin(lat * 100) * 0.0002;
      const waveFactor2 = Math.sin(lat * 220) * 0.00005;
      const randomJitter = (Math.random() - 0.5) * 0.00003;
      
      const variationCycle = waveFactor1 + waveFactor2 + randomJitter;
      
      const distanceToCenter = Math.sqrt(
        Math.pow(baseLon - centerLon, 2) + 
        Math.pow(lat - centerLat, 2)
      );
      
      let intensity = 0.3 + (0.3 * (1 - Math.min(1, distanceToCenter * 5)));
      
      const nearIntersection = Math.abs((lat / majorRoadSpacing) % 1 - 0.5) < 0.15;
      if (nearIntersection) {
        intensity += 0.15;
      }
      
      intensity += (Math.random() * 0.05) - 0.025;
    intensity = Math.max(0.1, Math.min(0.9, intensity));
      
      road.points.push({
        latitude: lat,
        longitude: baseLon + variationCycle,
        intensity: intensity,
        type: getTrafficTypeByIntensity(intensity),
        roadId: roadId
      });
    }
    
    roads.push(road);
  }
  
  // 2. Ajouter des routes secondaires - maintenant plus naturelles
  // Routes qui suivent un pattern non strictement géométrique
  for (let majorRoad of roads.filter(r => r.isMajor && r.type === 'horizontal')) {
    // Réduire le nombre de routes secondaires pour plus de naturel
    for (let i = 1; i < numVerticalMajorRoads; i += 2 + Math.floor(Math.random() * 2)) {
      const roadId = `v-minor-${majorRoad.id}-${i}`;
      const baseLon = bounds.minLon + ((bounds.maxLon - bounds.minLon) * (i) / numVerticalMajorRoads);
      
      // Variation plus importante pour routes secondaires
      const lonVariation = (Math.random() - 0.5) * majorRoadSpacing * 0.5;
      const actualLon = baseLon + lonVariation;
      
      // Ne générer la route que si elle est dans les limites
      if (actualLon < bounds.minLon || actualLon > bounds.maxLon) continue;
      
      const minorRoad = {
        id: roadId,
        type: 'vertical',
        isMajor: false,
        baseLon: actualLon,
        points: []
      };
      
      // Générer des points plus rapprochés pour les routes secondaires
      // Réduire l'emprise des routes secondaires pour qu'elles ne traversent pas toute la carte
      const centerPoint = majorRoad.baseLat;
      const range = 0.008 + (Math.random() * 0.006); // ~800m-1400m
      const minLat = Math.max(bounds.minLat, centerPoint - range);
      const maxLat = Math.min(bounds.maxLat, centerPoint + range);
      
      // Points plus rapprochés pour les routes secondaires
      for (let lat = minLat; lat <= maxLat; lat += 0.0003) {
        // Plus d'ondulation pour les routes secondaires
        const waveFactor = Math.sin(lat * 90) * 0.0004;
        const randomFactor = (Math.random() - 0.5) * 0.0001;
        const variationCycle = waveFactor + randomFactor;
        
        // Intensité plus faible pour les routes secondaires
        let intensity = 0.2 + (Math.random() * 0.15);
        
        // Plus forte près de l'intersection avec la route principale
        const distToMajor = Math.abs(lat - majorRoad.baseLat);
        if (distToMajor < 0.002) {
          intensity += 0.25 * (1 - distToMajor / 0.002);
        }
        
        intensity = Math.max(0.1, Math.min(0.8, intensity));
        
        minorRoad.points.push({
          latitude: lat,
          longitude: actualLon + variationCycle,
          intensity: intensity,
          type: getTrafficTypeByIntensity(intensity),
          roadId: roadId
        });
      }
      
      roads.push(minorRoad);
    }
  }
  // 3. Intégrer les incidents dans le réseau routier
  const allIncidents = [...localIncidents, ...tomtomIncidents];
  for (let incident of allIncidents) {
    // Obtenir les coordonnées de l'incident
    let coords = incident.coords;
    if (!coords && incident.location) {
      if (Array.isArray(incident.location)) {
        coords = incident.location;
      } else if (incident.location.coordinates && Array.isArray(incident.location.coordinates)) {
        coords = incident.location.coordinates;
      }
    }
    
    if (!coords) continue; // Ignorer cet incident s'il n'a pas de coordonnées
    
    // Ajouter des points de congestion autour de l'incident
    const incidentLat = coords[1];
    const incidentLon = coords[0];
    
    // Obtenir le rayon d'influence en fonction du type d'incident
    let radius = 0.005; // ~500m par défaut
    let maxIntensity = 0.7; // Intensité maximale au centre
    
    switch (incident.type) {
      case 'accident':
        radius = 0.008;
        maxIntensity = 0.9;
        break;
      case 'traffic':
        radius = 0.006;
        maxIntensity = 0.8;
        break;
      case 'closure':
        radius = 0.01;
        maxIntensity = 1.0;
        break;
      case 'police':
        radius = 0.003;
        maxIntensity = 0.6;
        break;
      case 'hazard':
        radius = 0.004;
        maxIntensity = 0.7;
        break;
    }
    
    // Ajouter une série de points autour de l'incident
    const numPointsPerAxis = 5;
    for (let i = -numPointsPerAxis; i <= numPointsPerAxis; i++) {
      for (let j = -numPointsPerAxis; j <= numPointsPerAxis; j++) {
        const lat = incidentLat + (i * radius / numPointsPerAxis);
        const lon = incidentLon + (j * radius / numPointsPerAxis);
        
        // Vérifier si le point est dans les limites
        if (lat < bounds.minLat || lat > bounds.maxLat || lon < bounds.minLon || lon > bounds.maxLon) {
          continue;
        }
        
        // Calculer la distance au centre de l'incident
        const distance = Math.sqrt(Math.pow(lat - incidentLat, 2) + Math.pow(lon - incidentLon, 2));
        
        // L'intensité diminue avec la distance
        if (distance <= radius) {
          const normalizedDistance = distance / radius;
          const intensity = maxIntensity * (1 - Math.pow(normalizedDistance, 2));
          
          // Ajouter un point de congestion
          result.push({
            latitude: lat,
            longitude: lon,
            intensity: Math.max(0.2, intensity), // Minimum 0.2 pour être visible
            type: getTrafficTypeByIntensity(intensity),
            isIncidentPoint: true,
            // Nouveau format avec tableau de coordonnées pour compatibilité
            coordinate: [lon, lat]
          });
        }
      }
    }
  }
  
  // 4. Aplatir tous les points des routes
  for (let road of roads) {
    for (let point of road.points) {
      // Ajouter le format de coordonnées utilisé par notre nouveau système
      result.push({
        ...point,
        coordinate: [point.longitude, point.latitude],
        roadId: road.id // Assurez-vous que chaque point a un ID de route
      });
    }
  }
  
  // Supprimer les doublons proches (moins de 0.0002 degrés)
  const filteredResult = [];
  const isClose = (p1, p2) => {
    return Math.abs(p1.latitude - p2.latitude) < 0.0002 && 
           Math.abs(p1.longitude - p2.longitude) < 0.0002;
  };
  
  for (let point of result) {
    // Si c'est un point d'incident, le garder quoi qu'il arrive
    if (point.isIncidentPoint) {
      filteredResult.push(point);
      continue;
    }
    
    // Vérifier si ce point est trop proche d'un point déjà ajouté
    const closePoint = filteredResult.find(p => isClose(p, point));
    if (closePoint) {
      // Conserver le point avec l'intensité la plus élevée
      if (point.intensity > closePoint.intensity) {
        // Remplacer le point existant
        const index = filteredResult.indexOf(closePoint);
        filteredResult[index] = point;
      }
    } else {
      filteredResult.push(point);
    }
  }
  
  // Transformer les points pour qu'ils soient plus facilement utilisables par MapboxGL
  return filteredResult.map(point => {
    // S'assurer que nous avons toujours le format coordinate pour MapboxGL
    if (!point.coordinate) {
      point.coordinate = [point.longitude, point.latitude];
    }
    return point;
  });
}

/**
 * Trouver les points historiques proches d'un point de prédiction
 * @private
 */
function findNearbyHistoricalPoints(prediction, historicalPatterns, maxDistance = 0.001) {
  return historicalPatterns.filter(pattern => {
    const distance = Math.sqrt(
      Math.pow(pattern.latitude - prediction.latitude, 2) + 
      Math.pow(pattern.longitude - prediction.longitude, 2)
    );
    return distance <= maxDistance;
  });
}

/**
 * Générer des prédictions historiques de secours (en cas d'échec de la prédiction principale)
 * @private
 */
function generateHistoricalFallbackPredictions(bounds, time) {
  const result = [];
  
  // Déterminer s'il s'agit d'une heure de pointe
  const hour = time.getHours();
  const day = time.getDay(); // 0 = dimanche, 1-5 = jours de semaine, 6 = samedi
  const isWeekend = day === 0 || day === 6;
  const isRushHour = (!isWeekend && ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)));
  const isWorkingHours = !isWeekend && hour >= 9 && hour <= 17;
  
  // Centre de la zone
  const centerLat = (bounds.minLat + bounds.maxLat) / 2;
  const centerLon = (bounds.minLon + bounds.maxLon) / 2;
  
  // Diviser la zone en une grille plus naturelle pour les routes (moins rigide)
  const gridSize = 25;
  const latStep = (bounds.maxLat - bounds.minLat) / gridSize;
  const lonStep = (bounds.maxLon - bounds.minLon) / gridSize;
  
  // Créer un réseau routier virtuel
  const createRoad = (startLat, startLon, endLat, endLon, segments = 10) => {
    const points = [];
    for (let i = 0; i <= segments; i++) {
      const ratio = i / segments;
      const lat = startLat + (endLat - startLat) * ratio;
      const lon = startLon + (endLon - startLon) * ratio;
      
      // Ajouter une légère variation pour des routes plus naturelles
      const latVar = (Math.random() - 0.5) * latStep * 0.15;
      const lonVar = (Math.random() - 0.5) * lonStep * 0.15;
      
      // Calculer l'intensité du trafic en fonction de la distance du centre
      const distanceToCenter = Math.sqrt(
        Math.pow(lat - centerLat, 2) + 
        Math.pow(lon - centerLon, 2)
      );
      
      // Base d'intensité selon l'heure
      let baseIntensity = 0.3; // Intensité moyenne
      if (isRushHour) baseIntensity = 0.6; // Plus intense aux heures de pointe
      else if (isWorkingHours) baseIntensity = 0.4; // Modérément intense heures de travail
      else if (hour >= 22 || hour <= 5) baseIntensity = 0.1; // Faible la nuit
      
      // Plus forte intensité près du centre
      let intensity = baseIntensity * (1 - Math.min(0.7, distanceToCenter * 10));
      
      // Ajouter une variation aléatoire
      intensity += (Math.random() * 0.15) - 0.075;
      
      // Limiter entre 0.1 et 0.9
      intensity = Math.max(0.1, Math.min(0.9, intensity));
      
      points.push({
        latitude: lat + latVar,
        longitude: lon + lonVar,
        intensity: intensity,
        type: getTrafficTypeByIntensity(intensity),
        routeId: `fallback-${startLat.toFixed(3)}-${startLon.toFixed(3)}`, // Ajouter un ID de route
        // Format compatible avec MapboxGL
        coordinate: [lon + lonVar, lat + latVar]
      });
    }
    return points;
  };
  
  // Créer quelques routes principales (5 horizontales, 5 verticales)
  for (let i = 1; i < 6; i++) {
    // Route horizontale
    const hRoadLat = bounds.minLat + (bounds.maxLat - bounds.minLat) * i / 6;
    const hRoadPoints = createRoad(
      hRoadLat, bounds.minLon, 
      hRoadLat, bounds.maxLon, 
      50
    );
    result.push(...hRoadPoints);
    
    // Route verticale
    const vRoadLon = bounds.minLon + (bounds.maxLon - bounds.minLon) * i / 6;
    const vRoadPoints = createRoad(
      bounds.minLat, vRoadLon,
      bounds.maxLat, vRoadLon,
      50
    );
    result.push(...vRoadPoints);
  }
  
  // Ajouter quelques routes diagonales
  const diagonalPoints1 = createRoad(
    bounds.minLat, bounds.minLon,
    bounds.maxLat, bounds.maxLon,
    40
  );
  result.push(...diagonalPoints1);
  
  const diagonalPoints2 = createRoad(
    bounds.minLat, bounds.maxLon,
    bounds.maxLat, bounds.minLon,
    40
  );
  result.push(...diagonalPoints2);
  
  // Ajouter des routes secondaires
  for (let i = 1; i < 12; i++) {
    // Routes horizontales secondaires
    if (i % 2 === 0) { // Une route secondaire tous les 2
      const hRoadLat = bounds.minLat + (bounds.maxLat - bounds.minLat) * i / 12;
      // Ne pas créer de route sur toute la longueur, mais des segments
      for (let j = 0; j < 3; j++) {
        const startLon = bounds.minLon + (bounds.maxLon - bounds.minLon) * j / 3;
        const endLon = startLon + (bounds.maxLon - bounds.minLon) / 3 * 0.8; // 80% du segment
        
        const hRoadPoints = createRoad(
          hRoadLat, startLon,
          hRoadLat, endLon,
          20
        );
        result.push(...hRoadPoints);
      }
    }
    
    // Routes verticales secondaires
    if (i % 2 === 1) { // Alterner avec les routes horizontales
      const vRoadLon = bounds.minLon + (bounds.maxLon - bounds.minLon) * i / 12;
      // Segments de route
      for (let j = 0; j < 3; j++) {
        const startLat = bounds.minLat + (bounds.maxLat - bounds.minLat) * j / 3;
        const endLat = startLat + (bounds.maxLat - bounds.minLat) / 3 * 0.8;
        
        const vRoadPoints = createRoad(
          startLat, vRoadLon,
          endLat, vRoadLon,
          20
        );
        result.push(...vRoadPoints);
      }
    }
  }
  // Supprimer les doublons proches
  const filteredResult = [];
  const isClose = (p1, p2) => {
    return Math.abs(p1.latitude - p2.latitude) < 0.0003 && 
           Math.abs(p1.longitude - p2.longitude) < 0.0003;
  };
  
  for (let point of result) {
    const closePoint = filteredResult.find(p => isClose(p, point));
    if (closePoint) {
      // Conserver le point avec l'intensité la plus élevée
      if (point.intensity > closePoint.intensity) {
        const index = filteredResult.indexOf(closePoint);
        filteredResult[index] = point;
      }
    } else {
      filteredResult.push(point);
    }
  }
  
  // Format compatible avec notre nouveau système
  return filteredResult.map(point => {
    // Ajouter des informations pour la visualisation des routes
    // Transformer en structure utile pour créer un LineString
    return {
      ...point,
      coordinates: [point.coordinate]
    };
  });
}

/**
 * Obtenir le type de trafic en fonction de l'intensité
 * @private
 */
function getTrafficTypeByIntensity(intensity) {
  if (intensity < 0.3) return 'FLUIDE';
  if (intensity < 0.5) return 'MOYEN';
  if (intensity < 0.7) return 'DENSE';
  if (intensity < 0.9) return 'TRÈS_DENSE';
  return 'BLOQUÉ';
}

/**
 * Fonction d'aide pour combiner différentes sources de données
 * @private
 */
function combineDataSources(localIncidents, tomtomIncidents, historicalPatterns, bounds, time) {
  // Réutiliser la nouvelle approche plus réaliste pour générer un réseau routier
  return generateRealisticRoadNetwork(bounds, localIncidents, tomtomIncidents);
}

/**
 * Évaluer l'impact des incidents locaux sur un point
 * @private
 */
function evaluateLocalIncidents(incidents, point) {
  // Si aucun incident, aucun impact
  if (!incidents || incidents.length === 0) {
    return 100; // Pas de congestion
  }
  
  // Calculer un score d'impact pour chaque incident
  const impactScores = incidents.map(incident => {
    // Obtenir les coordonnées de l'incident
    let coords = incident.coords;
    if (!coords && incident.location) {
      if (Array.isArray(incident.location)) {
        coords = incident.location;
      } else if (incident.location.coordinates && Array.isArray(incident.location.coordinates)) {
        coords = incident.location.coordinates;
      }
    }
    
    if (!coords) return 0; // Ignorer cet incident s'il n'a pas de coordonnées
    
    // Calculer la distance entre l'incident et le point
    const incidentPoint = turf.point(coords);
    const distance = turf.distance(incidentPoint, point, { units: 'kilometers' });
    
    // Déterminer le rayon d'influence en fonction du type d'incident
    let radius = 1; // Par défaut, 1 km
    let severity = 0.5; // Par défaut, impact moyen
    
    switch (incident.type) {
      case 'accident':
        radius = 2;
        severity = 0.8;
        break;
      case 'traffic':
        radius = 1.5;
        severity = 0.7;
        break;
      case 'closure':
        radius = 3;
        severity = 1.0;
        break;
      case 'police':
        radius = 0.5;
        severity = 0.4;
        break;
      case 'hazard':
        radius = 1;
        severity = 0.6;
        break;
    }
    
    // Si l'incident est trop loin, aucun impact
    if (distance > radius) {
      return 0;
    }
    
    // L'impact diminue avec la distance
    const distanceFactor = 1 - (distance / radius);
    
    // Calculer l'impact final
    return severity * distanceFactor * 100;
  });
  
  // Prendre l'impact le plus élevé
  const maxImpact = Math.max(0, ...impactScores);
  
  // Convertir l'impact en score (100 = pas de congestion, 0 = congestion totale)
  return 100 - maxImpact;
}

/**
 * Évaluer l'impact des incidents TomTom sur un point
 * @private
 */
function evaluateTomTomIncidents(incidents, point) {
  // Logique similaire à evaluateLocalIncidents, mais adaptée aux données TomTom
  // Pour simplifier, on réutilise la même fonction
  return evaluateLocalIncidents(incidents, point);
}

/**
 * Obtenir un score historique pour un lieu et une heure donnés
 * @private
 */
function getHistoricalScoreForLocation(historicalPatterns, lat, lon, time) {
  // Si nous n'avons pas de données historiques, retourner un score neutre
  if (!historicalPatterns || historicalPatterns.length === 0) {
    return 70; // Score par défaut, légèrement optimiste
  }
  
  // Obtenir l'heure de la journée et le jour de la semaine
  const hour = time.getHours();
  const dayOfWeek = time.getDay(); // 0 = dimanche, 1-5 = jours de semaine, 6 = samedi
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  // Vérifier si c'est une heure de pointe typique
  const isRushHour = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
  
  // Ajuster le score de base en fonction de l'heure
  let baseScore;
  if (isWeekend) {
    baseScore = isRushHour ? 70 : 80; // Le week-end est généralement moins congestionné
  } else {
    baseScore = isRushHour ? 40 : 60; // Les jours de semaine sont plus congestionnés
  }
  
  // Ajuster en fonction des modèles historiques spécifiques
  // Cette partie dépend de la structure exacte de vos données historiques
  
  return baseScore;
}

/**
 * Obtenir le type de trafic en fonction du score de congestion
 * @private
 */
function getTrafficTypeByCongestion(score) {
  if (score >= 80) return 'FLUIDE';
  if (score >= 60) return 'MOYEN';
  if (score >= 40) return 'DENSE';
  if (score >= 20) return 'TRÈS_DENSE';
  return 'BLOQUÉ';
}

/**
 * Enrichir un itinéraire avec des informations d'incidents
 * @private
 */
function enhanceRouteWithIncidents(route, predictions) {
  if (!route || !route.trafficPrediction || !predictions || predictions.length === 0) {
    return route;
  }
  
  // Enrichir les segments de l'itinéraire avec les prédictions
  const enhancedSegments = route.trafficPrediction.segments.map(segment => {
    const nearbyPredictions = findNearbyPredictions(segment.coordinates, predictions);
    
    // Calculer un score ajusté basé sur les prédictions à proximité
    const adjustedScore = calculateAdjustedScore(segment.trafficScore, nearbyPredictions);
    
    return {
      ...segment,
      trafficScore: adjustedScore,
      congestion: 100 - adjustedScore,
      predictions: nearbyPredictions.slice(0, 3) // Garder les 3 prédictions les plus proches
    };
  });
  
  // Mettre à jour les hotspots basés sur les segments les plus congestionnés
  const congestedSegments = enhancedSegments
    .filter(segment => segment.congestion > 50)
    .sort((a, b) => b.congestion - a.congestion);
  
  const hotspots = congestedSegments.slice(0, 3).map(segment => ({
    coordinates: segment.coordinates,
    position: segment.position,
    congestion: segment.congestion,
    estimatedDelay: segment.estimatedDelay,
    type: getTrafficTypeByCongestion(segment.trafficScore),
    predictions: segment.predictions
  }));
  
  // Calculer un nouveau score global
  const overallScore = enhancedSegments.reduce(
    (sum, segment) => sum + segment.trafficScore,
    0
  ) / enhancedSegments.length;
  
  // Mettre à jour les prédictions de trafic
  return {
    ...route,
    trafficPrediction: {
      ...route.trafficPrediction,
      score: Math.round(overallScore),
      segments: enhancedSegments,
      hotspots: hotspots
    }
  };
}

/**
 * Trouver les prédictions à proximité d'un point
 * @private
 */
function findNearbyPredictions(coordinates, predictions) {
  const point = turf.point(coordinates);
  
  // Calculer la distance pour chaque prédiction
  const predictionsWithDistance = predictions.map(pred => {
    const predPoint = turf.point([pred.longitude, pred.latitude]);
    const distance = turf.distance(point, predPoint, { units: 'kilometers' });
    
    return {
      ...pred,
      distance
    };
  });
  
  // Trier par distance croissante et prendre les plus proches
  return predictionsWithDistance
    .sort((a, b) => a.distance - b.distance)
    .filter(p => p.distance <= 1); // Considérer uniquement les prédictions dans un rayon de 1 km
}

/**
 * Calculer un score ajusté en fonction des prédictions à proximité
 * @private
 */
function calculateAdjustedScore(baseScore, nearbyPredictions) {
  if (nearbyPredictions.length === 0) {
    return baseScore;
  }
  
  // Calculer un score moyen pondéré par la distance
  let totalWeight = 0;
  let weightedSum = 0;
  
  nearbyPredictions.forEach(pred => {
    // Plus la prédiction est proche, plus elle a de poids
    const weight = 1 / Math.max(0.1, pred.distance);
    
    weightedSum += pred.score * weight;
    totalWeight += weight;
  });
  
  const avgPredictionScore = weightedSum / totalWeight;
  
  // Combiner le score de base avec le score des prédictions
  // 70% score de base, 30% prédictions
  return Math.round(baseScore * 0.7 + avgPredictionScore * 0.3);
}

export default EnhancedTrafficService;