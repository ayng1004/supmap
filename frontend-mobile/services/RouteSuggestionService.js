// services/RouteSuggestionService.js
// Service pour générer des suggestions d'itinéraires intelligentes

import * as turf from '@turf/turf';
import NavigationService from './NavigationService';
import TrafficPredictionService from './TrafficPredictionService';
import apiService from './api';

// Configuration
const MAX_ROUTE_ALTERNATIVES = 3;
const MAX_INCIDENTS_TO_CONSIDER = 20;
const DEPARTURE_TIME_SLOTS = 6; // Nombre de créneaux horaires à suggérer

/**
 * Service de suggestion d'itinéraires intelligent
 */
const RouteSuggestionService = {
  /**
   * Génère plusieurs suggestions d'itinéraires optimisées
   * @param {Array} origin - Coordonnées [longitude, latitude] du point de départ
   * @param {Array} destination - Coordonnées [longitude, latitude] de la destination
   * @param {Object} options - Options et préférences
   * @returns {Promise<Object>} Suggestions d'itinéraires
   */
  generateRouteSuggestions: async (origin, destination, options = {}) => {
    try {
      // Obtenir les incidents actifs
      const incidents = await fetchActiveIncidents();
      
      // Calculer les itinéraires alternatifs de base
      const routes = await NavigationService.calculateRoutes(origin, destination, options);
      
      if (!routes || routes.length === 0) {
        throw new Error("Impossible de calculer des itinéraires");
      }
      
      // Limiter le nombre d'alternatives
      const limitedRoutes = routes.slice(0, MAX_ROUTE_ALTERNATIVES);
      
      // Analyser les conditions de trafic actuelles pour tous les itinéraires
      const departureTime = options.departureTime || new Date();
      const routesWithTraffic = TrafficPredictionService.analyzeAndPredictTraffic(limitedRoutes, departureTime);
      
      // Trouver le meilleur itinéraire parmi les alternatives
      const bestRouteAnalysis = TrafficPredictionService.findBestRoute(routesWithTraffic, incidents, options);
      
      // Générer des suggestions d'heures de départ alternatives pour le meilleur itinéraire
      const departureSuggestions = TrafficPredictionService.suggestOptimalDepartureTime(
        bestRouteAnalysis.best.route,
        new Date(),
        new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 heures max
        30  // Intervalle de 30 minutes
      );
      
      // Filtrer pour ne garder que les meilleures suggestions d'heures de départ
      const topDepartureSuggestions = departureSuggestions
        .filter(suggestion => suggestion.trafficScore >= 60)  // Seulement les bons scores
        .slice(0, DEPARTURE_TIME_SLOTS);                      // Limiter le nombre de suggestions
      
      // Prédire l'évolution du trafic pour le meilleur itinéraire
      const trafficEvolution = TrafficPredictionService.predictTrafficEvolution(
        bestRouteAnalysis.best.route,
        departureTime
      );
      
      // Retourner les suggestions complètes
      return {
        // Itinéraire recommandé
        recommended: {
          ...bestRouteAnalysis.best,
          trafficEvolution: trafficEvolution
        },
        
        // Itinéraires alternatifs
        alternatives: bestRouteAnalysis.alternatives,
        
        // Statistiques comparatives
        comparison: bestRouteAnalysis.comparison,
        
        // Suggestions d'heures de départ
        departureSuggestions: topDepartureSuggestions,
        
      // Incidents pouvant affecter les itinéraires
      incidents: filterRelevantIncidents(incidents, limitedRoutes),
        
      // Métadonnées
      metadata: {
        origin,
        destination,
        departureTime,
        options
      }
    };
  } catch (error) {
    console.error('Erreur lors de la génération des suggestions d\'itinéraires:', error);
    throw error;
  }
},

/**
 * Calcule un itinéraire intelligent qui évite au maximum les incidents et le trafic
 * @param {Array} origin - Coordonnées du point de départ
 * @param {Array} destination - Coordonnées de la destination
 * @param {Object} options - Options et préférences
 * @returns {Promise<Object>} Itinéraire optimisé
 */
calculateSmartRoute: async (origin, destination, options = {}) => {
  try {
    // Récupérer les incidents actifs
    const incidents = await fetchActiveIncidents();
    
    // Récupérer les données de trafic en temps réel (si disponibles)
    // Pour l'exemple, nous utilisons une simulation
    const liveTrafficData = options.useTrafficData !== false ? 
      await simulateLiveTrafficData() : [];
    
    // Générer un itinéraire initial
    let routes = await NavigationService.calculateRoutes(origin, destination, options);
    
    if (!routes || routes.length === 0) {
      throw new Error("Impossible de calculer l'itinéraire initial");
    }
    
    // Mettre en évidence les incidents et le trafic sur chaque itinéraire
    const analyzedRoutes = routes.map(route => {
      // Analyse des incidents sur cet itinéraire
      const incidentAnalysis = analyzeIncidentsOnRoute(route, incidents);
      
      // Analyse du trafic sur cet itinéraire
      const trafficAnalysis = analyzeLiveTrafficOnRoute(route, liveTrafficData);
      
      // Prédiction du trafic futur
      const trafficPrediction = TrafficPredictionService.analyzeAndPredictTraffic(
        [route], 
        options.departureTime || new Date()
      )[0];
      
      // Retourner l'itinéraire enrichi
      return {
        ...route,
        incidents: incidentAnalysis.incidents,
        incidentImpact: incidentAnalysis.impactScore,
        trafficCongestion: trafficAnalysis.congestionLevel,
        trafficDelayMinutes: trafficAnalysis.estimatedDelay,
        trafficPrediction: trafficPrediction.trafficPrediction
      };
    });
    
    // Calcul du score global pour chaque itinéraire
    const scoredRoutes = analyzedRoutes.map(route => {
      // Récupérer les différents scores
      const incidentScore = 100 - route.incidentImpact;
      const trafficScore = 100 - route.trafficCongestion;
      const predictionScore = route.trafficPrediction?.score || 80;
      
      // Normaliser la durée par rapport à l'itinéraire le plus rapide
      const fastestDuration = Math.min(...analyzedRoutes.map(r => r.duration));
      const durationScore = 100 - ((route.duration - fastestDuration) / fastestDuration * 100);
      
      // Calcul du score combiné (pondération des différents facteurs)
      const combinedScore = (
        incidentScore * 0.3 +    // 30% pour les incidents
        trafficScore * 0.25 +    // 25% pour le trafic actuel
        predictionScore * 0.25 + // 25% pour la prédiction
        durationScore * 0.2      // 20% pour la durée
      );
      
      // Facteurs qui contribuent à la recommandation de cet itinéraire
      const strengths = [];
      if (incidentScore > 80) strengths.push("Peu d'incidents sur le trajet");
      if (trafficScore > 80) strengths.push("Trafic fluide actuellement");
      if (predictionScore > 80) strengths.push("Bonnes conditions de trafic prévues");
      if (durationScore > 90) strengths.push("Itinéraire le plus rapide");
      
      // Facteurs qui pénalisent cet itinéraire
      const weaknesses = [];
      if (incidentScore < 60) weaknesses.push("Incidents signalés sur le trajet");
      if (trafficScore < 60) weaknesses.push("Trafic dense actuellement");
      if (predictionScore < 60) weaknesses.push("Embouteillages prévus");
      if (durationScore < 80) weaknesses.push("Itinéraire plus long");
      
      return {
        ...route,
        score: Math.round(combinedScore),
        strengths,
        weaknesses
      };
    });
    
    // Trier les itinéraires par score
    scoredRoutes.sort((a, b) => b.score - a.score);
    
    // Obtenir l'itinéraire avec le meilleur score
    const bestRoute = scoredRoutes[0];
    
    // Si l'itinéraire comporte trop d'incidents ou de congestion, essayer de générer un meilleur itinéraire
    if (bestRoute.score < 65 && options.findAlternative !== false) {
      // Essayer de calculer un itinéraire alternatif en évitant les zones problématiques
      const alternativeRoute = await calculateAlternativeRoute(
        origin, 
        destination, 
        incidents, 
        liveTrafficData,
        options
      );
      
      // Si un meilleur itinéraire a été trouvé, l'utiliser
      if (alternativeRoute && alternativeRoute.score > bestRoute.score) {
        return {
          route: alternativeRoute,
          alternatives: scoredRoutes.slice(0, 3),
          isOptimized: true,
          improvementScore: alternativeRoute.score - bestRoute.score,
          avoidedIssues: {
            incidents: bestRoute.incidents.length - alternativeRoute.incidents.length,
            trafficImprovementPercent: Math.round((alternativeRoute.trafficScore - bestRoute.trafficScore) / bestRoute.trafficScore * 100)
          }
        };
      }
    }
    
    // Retourner le meilleur itinéraire trouvé
    return {
      route: bestRoute,
      alternatives: scoredRoutes.slice(1, 4), // Jusqu'à 3 alternatives
      isOptimized: false
    };
  } catch (error) {
    console.error('Erreur lors du calcul de l\'itinéraire intelligent:', error);
    throw error;
  }
},

/**
 * Suggère un meilleur moment pour partir en fonction des prévisions de trafic
 * @param {Object} route - Itinéraire pour lequel on veut des suggestions
 * @param {Object} options - Options supplémentaires
 * @returns {Promise<Array>} Suggestions de départ
 */
suggestBetterDepartureTime: async (route, options = {}) => {
  try {
    // Heure de départ au plus tôt (maintenant par défaut)
    const earliestDeparture = options.earliestDeparture || new Date();
    
    // Heure de départ au plus tard (6 heures plus tard par défaut)
    const latestDeparture = options.latestDeparture || 
      new Date(earliestDeparture.getTime() + (6 * 60 * 60 * 1000));
    
    // Intervalle entre les heures de départ (15 minutes par défaut)
    const intervalMinutes = options.intervalMinutes || 15;
    
    // Générer les suggestions d'heures de départ
    return TrafficPredictionService.suggestOptimalDepartureTime(
      route,
      earliestDeparture,
      latestDeparture,
      intervalMinutes
    );
  } catch (error) {
    console.error('Erreur lors de la suggestion de meilleure heure de départ:', error);
    return [];
  }
},

/**
 * Calcule l'impact des incidents et des embouteillages sur un trajet habituel
 * @param {Object} regularRoute - Itinéraire habituel de l'utilisateur
 * @returns {Promise<Object>} Analyse de l'impact
 */
analyzeRegularCommuteImpact: async (regularRoute) => {
  try {
    if (!regularRoute || !regularRoute.geometry) {
      throw new Error("Itinéraire invalide");
    }
    
    // Récupérer les incidents actifs
    const incidents = await fetchActiveIncidents();
    
    // Récupérer les données de trafic en temps réel
    const liveTrafficData = await simulateLiveTrafficData();
    
    // Analyser l'impact des incidents sur l'itinéraire
    const incidentImpact = analyzeIncidentsOnRoute(regularRoute, incidents);
    
    // Analyser l'impact du trafic actuel sur l'itinéraire
    const trafficImpact = analyzeLiveTrafficOnRoute(regularRoute, liveTrafficData);
    
    // Prédire le trafic futur sur l'itinéraire
    const trafficPrediction = TrafficPredictionService.analyzeAndPredictTraffic(
      [regularRoute], 
      new Date()
    )[0].trafficPrediction;
    
    // Calculer le temps de trajet normal (sans incidents ni trafic)
    const normalDuration = regularRoute.duration || 0;
    
    // Calculer le temps de trajet estimé avec les conditions actuelles
    const estimatedDuration = normalDuration + 
      (incidentImpact.estimatedDelay * 60) + 
      (trafficImpact.estimatedDelay * 60);
    
    // Calculer le pourcentage d'augmentation du temps de trajet
    const durationIncrease = Math.round((estimatedDuration - normalDuration) / normalDuration * 100);
    
    // Retourner l'analyse complète
    return {
      normalDuration: Math.round(normalDuration / 60), // En minutes
      estimatedDuration: Math.round(estimatedDuration / 60), // En minutes
      durationIncrease: durationIncrease,
      delayMinutes: Math.round((estimatedDuration - normalDuration) / 60),
      incidents: incidentImpact.incidents,
      trafficHotspots: trafficImpact.hotspots,
      trafficTrend: trafficPrediction.trend,
      severity: determineTripSeverity(durationIncrease),
      recommendation: generateCommuteRecommendation(
        durationIncrease, 
        incidentImpact.incidents, 
        trafficImpact.hotspots
      )
    };
  } catch (error) {
    console.error('Erreur lors de l\'analyse du trajet habituel:', error);
    throw error;
  }
}
};

// Fonction d'aide pour récupérer les incidents actifs
async function fetchActiveIncidents() {
try {
  const incidents = await apiService.incidents.getAll();
  
  // Filtrer pour ne garder que les incidents actifs
  return incidents
    .filter(incident => incident.active !== false)
    .slice(0, MAX_INCIDENTS_TO_CONSIDER); // Limiter le nombre d'incidents à traiter
} catch (error) {
  console.error('Erreur lors de la récupération des incidents:', error);
  return [];
}
}

// Fonction d'aide pour simuler des données de trafic en temps réel
// Dans une application réelle, ces données viendraient d'une API externe
async function simulateLiveTrafficData() {
// Simuler un délai réseau
await new Promise(resolve => setTimeout(resolve, 200));

// Zones de trafic dense simulées (Paris)
return [
  { 
    id: 'traffic-1',
    location: [2.2950, 48.8738], // Place de l'Étoile
    radius: 0.7, // km
    intensity: 0.8, // 0-1
    type: 'congestion',
    timestamp: new Date()
  },
  { 
    id: 'traffic-2',
    location: [2.3709, 48.8677], // Place de la Bastille
    radius: 0.5,
    intensity: 0.7,
    type: 'slowdown',
    timestamp: new Date()
  },
  { 
    id: 'traffic-3',
    location: [2.3522, 48.8566], // Notre-Dame
    radius: 0.4,
    intensity: 0.6,
    type: 'congestion',
    timestamp: new Date()
  },
  { 
    id: 'traffic-4',
    location: [2.3488, 48.8534], // Boulevard Saint-Germain
    radius: 0.6,
    intensity: 0.6,
    type: 'slowdown',
    timestamp: new Date()
  }
];
}

// Fonction d'aide pour analyser les incidents sur un itinéraire
function analyzeIncidentsOnRoute(route, incidents) {
if (!route || !route.geometry || !incidents || incidents.length === 0) {
  return { incidents: [], impactScore: 0, estimatedDelay: 0 };
}

// Créer une ligne pour l'itinéraire
const routeLine = turf.lineString(route.geometry.coordinates);
const routeLength = turf.length(routeLine, { units: 'kilometers' });

// Buffer autour de l'itinéraire (500 mètres de chaque côté)
const buffer = turf.buffer(routeLine, 0.5, { units: 'kilometers' });

// Incidents affectant l'itinéraire
const affectingIncidents = [];
let totalImpact = 0;
let totalDelay = 0;

// Vérifier chaque incident
incidents.forEach(incident => {
  // Obtenir les coordonnées de l'incident
  let coords = null;
  
  if (incident.coords) {
    coords = incident.coords;
  } else if (incident.location && Array.isArray(incident.location)) {
    coords = incident.location;
  } else if (incident.location && incident.location.coordinates) {
    coords = incident.location.coordinates;
  }
  
  if (!coords) return; // Ignorer cet incident s'il n'a pas de coordonnées
  
  // Vérifier si l'incident est dans le buffer de l'itinéraire
  const point = turf.point(coords);
  const isInBuffer = turf.booleanPointInPolygon(point, buffer);
  
  if (isInBuffer) {
    // Calculer la distance exacte entre l'incident et l'itinéraire
    const distance = turf.pointToLineDistance(point, routeLine, { units: 'kilometers' });
    
    // Calculer l'impact en fonction du type d'incident et de la distance
    let impactFactor;
    let delayMinutes;
    
    switch (incident.type) {
      case 'accident':
        impactFactor = 0.8;
        delayMinutes = 5 + Math.round(Math.random() * 15); // 5-20 minutes
        break;
      case 'closure':
        impactFactor = 1.0;
        delayMinutes = 15 + Math.round(Math.random() * 30); // 15-45 minutes
        break;
      case 'hazard':
        impactFactor = 0.6;
        delayMinutes = 3 + Math.round(Math.random() * 7); // 3-10 minutes
        break;
      case 'traffic':
        impactFactor = 0.7;
        delayMinutes = 5 + Math.round(Math.random() * 15); // 5-20 minutes
        break;
      case 'police':
        impactFactor = 0.5;
        delayMinutes = 2 + Math.round(Math.random() * 8); // 2-10 minutes
        break;
      default:
        impactFactor = 0.4;
        delayMinutes = 2 + Math.round(Math.random() * 8); // 2-10 minutes
    }
    
    // Ajuster l'impact en fonction de la distance
    const proximityFactor = 1 - (distance / 0.5); // 0.5 km est le rayon du buffer
    const finalImpact = impactFactor * proximityFactor * 100; // Score d'impact de 0 à 100
    
    // Ajuster le délai en fonction de la distance
    const finalDelay = delayMinutes * proximityFactor;
    
    // Trouver la position relative sur l'itinéraire
    const nearestPoint = turf.nearestPointOnLine(routeLine, point);
    const distanceFromStart = turf.length(
      turf.lineSlice(
        turf.point(routeLine.geometry.coordinates[0]),
        nearestPoint,
        routeLine
      ),
      { units: 'kilometers' }
    );
    
    const positionPercent = Math.round((distanceFromStart / routeLength) * 100);
    
    // Ajouter l'incident à la liste
    affectingIncidents.push({
      ...incident,
      distance: distance,
      impact: Math.round(finalImpact),
      estimatedDelay: Math.round(finalDelay),
      position: positionPercent // Position en pourcentage du trajet
    });
    
    // Ajouter à l'impact total
    totalImpact += finalImpact;
    totalDelay += finalDelay;
  }
});

// Limiter l'impact total à 100
totalImpact = Math.min(100, totalImpact);

return {
  incidents: affectingIncidents,
  impactScore: Math.round(totalImpact),
  estimatedDelay: Math.round(totalDelay)
};
}

// Fonction d'aide pour analyser le trafic en temps réel sur un itinéraire
function analyzeLiveTrafficOnRoute(route, trafficData) {
if (!route || !route.geometry || !trafficData || trafficData.length === 0) {
  return { hotspots: [], congestionLevel: 0, estimatedDelay: 0 };
}

// Créer une ligne pour l'itinéraire
const routeLine = turf.lineString(route.geometry.coordinates);
const routeLength = turf.length(routeLine, { units: 'kilometers' });

// Points chauds de trafic sur l'itinéraire
const trafficHotspots = [];
let totalCongestion = 0;
let totalDelay = 0;

// Vérifier chaque point de trafic
trafficData.forEach(trafficSpot => {
  // Vérifier si le point de trafic est proche de l'itinéraire
  const point = turf.point(trafficSpot.location);
  const distance = turf.pointToLineDistance(point, routeLine, { units: 'kilometers' });
  
  // Si le point est suffisamment proche de l'itinéraire (dans le rayon d'influence)
  if (distance <= trafficSpot.radius) {
    // Calculer l'impact en fonction de l'intensité et de la distance
    const proximityFactor = 1 - (distance / trafficSpot.radius);
    const impact = trafficSpot.intensity * proximityFactor * 100; // Score d'impact de 0 à 100
    
    // Calculer le délai en fonction de l'intensité du trafic
    // Plus l'intensité est élevée, plus le délai est important
    const baseDelay = trafficSpot.intensity * 20; // Jusqu'à 20 minutes pour une intensité maximale
    const finalDelay = baseDelay * proximityFactor;
    
    // Trouver la position relative sur l'itinéraire
    const nearestPoint = turf.nearestPointOnLine(routeLine, point);
    const distanceFromStart = turf.length(
      turf.lineSlice(
        turf.point(routeLine.geometry.coordinates[0]),
        nearestPoint,
        routeLine
      ),
      { units: 'kilometers' }
    );
    
    const positionPercent = Math.round((distanceFromStart / routeLength) * 100);
    
    // Ajouter le point chaud à la liste
    trafficHotspots.push({
      id: trafficSpot.id,
      type: trafficSpot.type,
      location: trafficSpot.location,
      intensity: trafficSpot.intensity,
      impact: Math.round(impact),
      estimatedDelay: Math.round(finalDelay),
      position: positionPercent // Position en pourcentage du trajet
    });
    
    // Ajouter à la congestion totale et au délai total
    totalCongestion += impact;
    totalDelay += finalDelay;
  }
});

// Limiter la congestion totale à 100
totalCongestion = Math.min(100, totalCongestion);

return {
  hotspots: trafficHotspots,
  congestionLevel: Math.round(totalCongestion),
  estimatedDelay: Math.round(totalDelay)
};
}

// Fonction d'aide pour calculer un itinéraire alternatif qui évite les zones problématiques
async function calculateAlternativeRoute(origin, destination, incidents, trafficData, options = {}) {
try {
  // Identifier les zones à éviter
  const areasToAvoid = [];
  
  // Ajouter les incidents graves comme zones à éviter
  incidents.forEach(incident => {
    if (!incident.coords && !incident.location) return;
    
    // Déterminer les coordonnées
    let coords = incident.coords;
    if (!coords && incident.location) {
      if (Array.isArray(incident.location)) {
        coords = incident.location;
      } else if (incident.location.coordinates && Array.isArray(incident.location.coordinates)) {
        coords = incident.location.coordinates;
      }
    }
    
    if (!coords) return;
    
    // Seuls les incidents graves sont pris en compte
    if (incident.type === 'accident' || incident.type === 'closure') {
      areasToAvoid.push({
        center: coords,
        radius: 0.5, // km
        weight: incident.type === 'closure' ? 0.9 : 0.7
      });
    }
  });
  
  // Ajouter les zones de trafic dense comme zones à éviter
  trafficData.forEach(trafficSpot => {
    if (trafficSpot.intensity >= 0.7) {
      areasToAvoid.push({
        center: trafficSpot.location,
        radius: trafficSpot.radius,
        weight: trafficSpot.intensity
      });
    }
  });
  
  // Si aucune zone à éviter, retourner null (pas besoin d'alternative)
  if (areasToAvoid.length === 0) {
    return null;
  }
  
  // Créer un itinéraire alternatif qui évite ces zones
  // Dans une application réelle, cette fonction appellerait une API avec des waypoints supplémentaires
  // ou des zones à éviter. Pour cet exemple, nous simulons en appelant l'API standard
  // avec des options supplémentaires.
  
  // Ajouter des waypoints intermédiaires pour éviter les zones problématiques
  const waypointsOptions = {
    ...options,
    avoidAreas: areasToAvoid
  };
  
  // Calculer l'itinéraire alternatif
  const alternativeRoutes = await NavigationService.calculateRoutes(origin, destination, waypointsOptions);
  
  if (!alternativeRoutes || alternativeRoutes.length === 0) {
    return null;
  }
  
  // Analyser le meilleur itinéraire alternatif
  const bestAlternative = alternativeRoutes[0];
  
  // Analyser les incidents sur cet itinéraire
  const incidentAnalysis = analyzeIncidentsOnRoute(bestAlternative, incidents);
  
  // Analyser le trafic sur cet itinéraire
  const trafficAnalysis = analyzeLiveTrafficOnRoute(bestAlternative, trafficData);
  
  // Calculer le score combiné
  const incidentScore = 100 - incidentAnalysis.impactScore;
  const trafficScore = 100 - trafficAnalysis.congestionLevel;
  
  // Combiner les scores (70% incidents, 30% trafic)
  const combinedScore = incidentScore * 0.7 + trafficScore * 0.3;
  
  // Retourner l'itinéraire alternatif avec les scores
  return {
    ...bestAlternative,
    incidents: incidentAnalysis.incidents,
    incidentImpact: incidentAnalysis.impactScore,
    trafficCongestion: trafficAnalysis.congestionLevel,
    trafficDelayMinutes: trafficAnalysis.estimatedDelay,
    score: Math.round(combinedScore),
    incidentScore,
    trafficScore,
    isAlternative: true
  };
} catch (error) {
  console.error('Erreur lors du calcul de l\'itinéraire alternatif:', error);
  return null;
}
}

// Fonction d'aide pour filtrer les incidents pertinents pour un ensemble d'itinéraires
function filterRelevantIncidents(incidents, routes) {
if (!incidents || incidents.length === 0 || !routes || routes.length === 0) {
  return [];
}

// Créer un buffer combiné pour tous les itinéraires
const routeLines = routes.map(route => turf.lineString(route.geometry.coordinates));
const buffers = routeLines.map(line => turf.buffer(line, 1, { units: 'kilometers' }));

// Combiner tous les buffers en un seul polygone
const buffersCollection = turf.featureCollection(buffers);
const combinedBuffer = turf.union(...buffers);

// Filtre pour ne garder que les incidents dans le buffer combiné
return incidents.filter(incident => {
  // Obtenir les coordonnées de l'incident
  let coords = null;
  
  if (incident.coords) {
    coords = incident.coords;
  } else if (incident.location && Array.isArray(incident.location)) {
    coords = incident.location;
  } else if (incident.location && incident.location.coordinates) {
    coords = incident.location.coordinates;
  }
  
  if (!coords) return false;
  
  // Vérifier si l'incident est dans le buffer combiné
  const point = turf.point(coords);
  return turf.booleanPointInPolygon(point, combinedBuffer);
});
}

// Fonction d'aide pour déterminer la gravité d'un trajet en fonction du retard
function determineTripSeverity(durationIncrease) {
if (durationIncrease < 10) return 'normal';
if (durationIncrease < 30) return 'minor';
if (durationIncrease < 50) return 'moderate';
if (durationIncrease < 100) return 'severe';
return 'critical';
}

// Fonction d'aide pour générer une recommandation pour un trajet habituel
function generateCommuteRecommendation(durationIncrease, incidents, trafficHotspots) {
if (durationIncrease < 10 && incidents.length === 0 && trafficHotspots.length === 0) {
  return {
    type: 'proceed',
    message: 'Conditions normales, vous pouvez partir maintenant.'
  };
}

if (durationIncrease >= 100 || (incidents.length > 0 && incidents.some(i => i.type === 'closure'))) {
  return {
    type: 'avoid',
    message: 'Évitez ce trajet aujourd\'hui si possible. Conditions très difficiles.'
  };
}

if (durationIncrease >= 50 || incidents.length > 2 || trafficHotspots.length > 3) {
  return {
    type: 'delay',
    message: 'Retardez votre départ de 1-2 heures si possible. Trafic dense et/ou incidents.'
  };
}

if (durationIncrease >= 30) {
  return {
    type: 'prepare',
    message: 'Prévoyez plus de temps pour votre trajet aujourd\'hui. Trafic modéré.'
  };
}

return {
  type: 'normal',
  message: 'Conditions habituelles avec légers ralentissements possibles.'
};
}

export default RouteSuggestionService;