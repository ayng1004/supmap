// NavigationAPI.js
// API unifiée pour la navigation et la détection d'incidents
// Utilisable à la fois par le frontend web et mobile

import * as turf from '@turf/turf';
import mapboxSdk from '@mapbox/mapbox-sdk';
import MapboxDirections from '@mapbox/mapbox-sdk/services/directions';
import { getAllIncidents, getIncidentsInArea } from './IncidentService';

// Configuration
const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoidG95Y2FuIiwiYSI6ImNseDNyemg4eTAza2kya3Nhcm40cW5wcGsifQ.O-QayF8YihwNF62txHaOBw';
const INCIDENT_DETECTION_RADIUS = 0.5; // en kilomètres
const REROUTE_THRESHOLD = 30; // Différence de temps en secondes pour proposer un re-routage

// Initialisation du client Mapbox Directions
const directionsClient = MapboxDirections({
  accessToken: MAPBOX_ACCESS_TOKEN
});

// Types d'incidents et leur impact sur la navigation
const INCIDENT_TYPES = {
  ACCIDENT: {
    id: 'accident',
    severity: 4, // Échelle 1-5
    requiresRerouting: true,
    delayFactor: 0.4, // 40% de retard supplémentaire
    message: "Accident détecté sur votre route. Itinéraire alternatif recommandé."
  },
  TRAFFIC: {
    id: 'traffic',
    severity: 3,
    requiresRerouting: true,
    delayFactor: 0.3,
    message: "Embouteillage détecté sur votre route. Itinéraire alternatif disponible."
  },
  CLOSURE: {
    id: 'closure',
    severity: 5,
    requiresRerouting: true, 
    delayFactor: 1.0, // Route bloquée
    message: "Route fermée détectée. Recalcul de l'itinéraire nécessaire."
  },
  POLICE: {
    id: 'police',
    severity: 2,
    requiresRerouting: false, // Pas besoin de dérouter, juste notifier
    delayFactor: 0.1,
    message: "Contrôle policier signalé sur votre route."
  },
  HAZARD: {
    id: 'hazard',
    severity: 3,
    requiresRerouting: true,
    delayFactor: 0.25,
    message: "Obstacle détecté sur votre route. Soyez prudent."
  }
};

// Calcule un itinéraire entre deux points
const calculateRoute = async (origin, destination, options = {}) => {
  try {
    console.log('Calcul d\'itinéraire:', { origin, destination, options });
    
    // Construction des paramètres de la requête
    const requestParams = {
      waypoints: [
        { coordinates: origin },
        { coordinates: destination }
      ],
      profile: options.travelMode || 'driving',
      alternatives: true, // Toujours demander des alternatives pour pouvoir les proposer en cas d'incident
      geometries: 'geojson',
      steps: true,
      overview: 'full',
      annotations: ['duration', 'distance', 'speed', 'congestion']
    };
    
    // Ajout des options d'évitement
    const excludes = [];
    if (options.avoidTolls) excludes.push('toll');
    if (options.avoidHighways) excludes.push('motorway');
    if (options.avoidFerries) excludes.push('ferry');
    
    if (excludes.length > 0) {
      requestParams.exclude = excludes;
    }
    
    // Appel à l'API Mapbox
    const response = await directionsClient.getDirections(requestParams).send();
    
    if (!response.body.routes || response.body.routes.length === 0) {
      throw new Error('Aucun itinéraire trouvé');
    }
    
    // Formatage des résultats
    const routes = response.body.routes.map((route, index) => ({
      ...route,
      id: `route-${index}`,
      name: `Itinéraire ${index + 1}`,
      color: getRouteColor(index),
      estimatedArrival: new Date(Date.now() + route.duration * 1000),
      incidents: [] // Sera rempli par checkRouteForIncidents
    }));
    
    console.log(`${routes.length} itinéraires calculés`);
    return routes;
  } catch (error) {
    console.error('Erreur lors du calcul d\'itinéraire:', error);
    throw error;
  }
};

// Vérifie si un itinéraire comporte des incidents
const checkRouteForIncidents = async (route, options = {}) => {
  if (!route || !route.geometry) {
    return { route, incidents: [], requiresRerouting: false };
  }
  
  try {
    // Création d'une ligne pour l'itinéraire avec turf.js
    const routeLine = turf.lineString(route.geometry.coordinates);
    const routeBoundingBox = turf.bbox(routeLine);
    
    // Récupération des incidents dans la zone de l'itinéraire
    const bounds = {
      lat1: routeBoundingBox[1],
      lon1: routeBoundingBox[0],
      lat2: routeBoundingBox[3],
      lon2: routeBoundingBox[2]
    };
    
    // Récupération des incidents dans la zone
    let incidents;
    if (options.allIncidents) {
      incidents = options.allIncidents;
    } else {
      incidents = await getIncidentsInArea(bounds);
    }
    
    if (!incidents || incidents.length === 0) {
      return { route, incidents: [], requiresRerouting: false };
    }
    
    // Filtrer les incidents qui sont sur l'itinéraire
    const routeIncidents = incidents.filter(incident => {
      let incidentCoords;
      
      if (incident.location && Array.isArray(incident.location)) {
        incidentCoords = incident.location;
      } else if (incident.longitude !== undefined && incident.latitude !== undefined) {
        incidentCoords = [incident.longitude, incident.latitude];
      } else if (incident.coordinates && Array.isArray(incident.coordinates)) {
        incidentCoords = incident.coordinates;
      } else {
        return false;
      }
      
      // Vérifier si l'incident est proche de l'itinéraire
      const point = turf.point(incidentCoords);
      const distance = turf.pointToLineDistance(point, routeLine, { units: 'kilometers' });
      
      return distance <= INCIDENT_DETECTION_RADIUS;
    });
    
    // Vérifier si un reroutage est nécessaire
    let requiresRerouting = false;
    let totalDelay = 0;
    
    // Créer une copie de l'itinéraire avec les infos sur les incidents
    const routeWithIncidents = { ...route };
    routeWithIncidents.incidents = routeIncidents.map(incident => {
      let incidentType = incident.type?.toUpperCase();
      const typeInfo = INCIDENT_TYPES[incidentType] || INCIDENT_TYPES.HAZARD;
      
      // Calcul du retard estimé causé par cet incident
      const incidentCoords = incident.location || [incident.longitude, incident.latitude];
      const point = turf.point(incidentCoords);
      const nearestPoint = turf.nearestPointOnLine(routeLine, point);
      
      // Déterminer à quel moment de l'itinéraire cet incident se produit
      const totalDistance = route.distance;
      const distanceToIncident = nearestPoint.properties.location * totalDistance;
      const percentageComplete = distanceToIncident / totalDistance;
      const timeToIncident = route.duration * percentageComplete;
      
      // Calculer le retard causé par cet incident
      const segmentDuration = route.duration * 0.2; // Supposons que l'incident affecte 20% de l'itinéraire
      const delay = segmentDuration * typeInfo.delayFactor;
      totalDelay += delay;
      
      // Déterminer si cet incident nécessite un reroutage
      if (typeInfo.requiresRerouting && delay > REROUTE_THRESHOLD) {
        requiresRerouting = true;
      }
      
      return {
        ...incident,
        typeInfo,
        nearestPoint: nearestPoint.geometry.coordinates,
        distanceFromRoute: turf.pointToLineDistance(point, routeLine, { units: 'kilometers' }),
        distanceAlongRoute: distanceToIncident,
        timeToIncident,
        estimatedDelay: delay,
        requiresRerouting: typeInfo.requiresRerouting
      };
    });
    
    // Mettre à jour la durée estimée et l'heure d'arrivée
    routeWithIncidents.originalDuration = route.duration;
    routeWithIncidents.adjustedDuration = route.duration + totalDelay;
    routeWithIncidents.estimatedArrival = new Date(Date.now() + routeWithIncidents.adjustedDuration * 1000);
    routeWithIncidents.requiresRerouting = requiresRerouting;
    
    return { 
      route: routeWithIncidents, 
      incidents: routeIncidents,
      requiresRerouting
    };
  } catch (error) {
    console.error('Erreur lors de la vérification des incidents sur l\'itinéraire:', error);
    return { route, incidents: [], requiresRerouting: false };
  }
};

// Calcule des itinéraires alternatifs en cas d'incidents
const calculateAlternativeRoutes = async (origin, destination, originalRoute, incidents, options = {}) => {
  try {
    // Vérifier si le reroutage est nécessaire
    const requiresRerouting = incidents.some(incident => {
      const typeInfo = INCIDENT_TYPES[incident.type?.toUpperCase()] || INCIDENT_TYPES.HAZARD;
      return typeInfo.requiresRerouting;
    });
    
    if (!requiresRerouting) {
      return [originalRoute]; // Pas besoin de recalculer si aucun incident ne nécessite de reroutage
    }
    
    // Calcul des itinéraires alternatifs
    console.log('Calcul d\'itinéraires alternatifs suite à la détection d\'incidents');
    
    // Récupération de tous les itinéraires possibles
    const alternativeRoutes = await calculateRoute(origin, destination, {
      ...options,
      alternatives: true
    });
    
    // Analyse des incidents sur chaque itinéraire
    const analyzedRoutes = await Promise.all(
      alternativeRoutes.map(async route => {
        const analysis = await checkRouteForIncidents(route, { allIncidents: incidents });
        return analysis.route;
      })
    );
    
    // Tri des itinéraires par ajustement de durée (du plus rapide au plus lent)
    analyzedRoutes.sort((a, b) => {
      return a.adjustedDuration - b.adjustedDuration;
    });
    
    return analyzedRoutes;
  } catch (error) {
    console.error('Erreur lors du calcul des itinéraires alternatifs:', error);
    return [originalRoute]; // En cas d'erreur, retourner l'itinéraire original
  }
};

// Surveille un itinéraire et notifie des incidents
const monitorRoute = (route, onIncidentDetected, options = {}) => {
  let intervalId;
  const monitoringInterval = options.interval || 60000; // Par défaut toutes les 60 secondes
  
  // Fonction qui sera exécutée à intervalles réguliers
  const checkForNewIncidents = async () => {
    try {
      const { route: updatedRoute, incidents, requiresRerouting } = await checkRouteForIncidents(route);
      
      // Si aucun incident ou si les incidents sont déjà connus, ne rien faire
      if (!incidents || incidents.length === 0) {
        return;
      }
      
      // Filtrer pour ne garder que les nouveaux incidents
      const knownIncidentIds = (route.incidents || []).map(inc => inc.id);
      const newIncidents = incidents.filter(inc => !knownIncidentIds.includes(inc.id));
      
      if (newIncidents.length > 0) {
        console.log(`${newIncidents.length} nouveaux incidents détectés sur l'itinéraire`);
        
        // Calculer des itinéraires alternatifs si nécessaire
        let alternativeRoutes = [];
        if (requiresRerouting && options.origin && options.destination) {
          alternativeRoutes = await calculateAlternativeRoutes(
            options.origin,
            options.destination,
            updatedRoute,
            incidents,
            options
          );
        }
        
        // Appeler le callback avec les nouveaux incidents et les itinéraires alternatifs
        onIncidentDetected(newIncidents, updatedRoute, alternativeRoutes);
      }
    } catch (error) {
      console.error('Erreur lors de la surveillance de l\'itinéraire:', error);
    }
  };
  
  // Lancer la vérification immédiatement puis à intervalles réguliers
  checkForNewIncidents();
  intervalId = setInterval(checkForNewIncidents, monitoringInterval);
  
  // Retourner une fonction pour arrêter la surveillance
  return () => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  };
};

// Prépare une notification pour un incident
const prepareIncidentNotification = (incident, route) => {
  const typeInfo = INCIDENT_TYPES[incident.type?.toUpperCase()] || INCIDENT_TYPES.HAZARD;
  
  return {
    id: `notification-${incident.id}`,
    title: `${typeInfo.message}`,
    body: `À environ ${Math.round(incident.timeToIncident / 60)} minutes de votre position.`,
    data: {
      incidentId: incident.id,
      incidentType: incident.type,
      requiresRerouting: typeInfo.requiresRerouting,
      routeId: route.id,
      severity: typeInfo.severity
    }
  };
};

// Compare des itinéraires pour afficher les différences
const compareRoutes = (originalRoute, alternativeRoutes) => {
  if (!alternativeRoutes || alternativeRoutes.length === 0) {
    return [{
      route: originalRoute,
      comparison: {
        timeDifference: 0,
        distanceDifference: 0,
        incidentCount: originalRoute.incidents?.length || 0,
        isRecommended: true
      }
    }];
  }
  
  // Déterminer la meilleure alternative
  let bestAlternative = alternativeRoutes[0];
  for (const route of alternativeRoutes) {
    if (route.adjustedDuration < bestAlternative.adjustedDuration) {
      bestAlternative = route;
    }
  }
  
  // Comparer chaque itinéraire avec l'original
  return alternativeRoutes.map(route => {
    const timeDifference = route.adjustedDuration - originalRoute.originalDuration;
    const distanceDifference = route.distance - originalRoute.distance;
    
    return {
      route,
      comparison: {
        timeDifference,
        distanceDifference,
        incidentCount: route.incidents?.length || 0,
        isRecommended: route.id === bestAlternative.id,
        timeDifferenceText: formatTimeDifference(timeDifference),
        distanceDifferenceText: formatDistanceDifference(distanceDifference)
      }
    };
  });
};

// Format la différence de temps pour l'affichage
const formatTimeDifference = (seconds) => {
  if (seconds === 0) return "Même durée";
  
  const minutes = Math.abs(Math.round(seconds / 60));
  if (seconds < 0) {
    return `${minutes} min. plus rapide`;
  } else {
    return `${minutes} min. plus lent`;
  }
};

// Format la différence de distance pour l'affichage
const formatDistanceDifference = (meters) => {
  if (meters === 0) return "Même distance";
  
  const km = Math.abs(Math.round(meters / 100) / 10);
  if (meters < 0) {
    return `${km} km plus court`;
  } else {
    return `${km} km plus long`;
  }
};

// Obtient une couleur pour un itinéraire en fonction de son index
const getRouteColor = (index) => {
  const colors = ['#3887be', '#FF9500', '#34C759', '#5856D6', '#FF2D55'];
  return colors[index % colors.length];
};

// Expose l'API publique
const NavigationAPI = {
  calculateRoute,
  checkRouteForIncidents,
  calculateAlternativeRoutes,
  monitorRoute,
  prepareIncidentNotification,
  compareRoutes,
  INCIDENT_TYPES
};

export default NavigationAPI;