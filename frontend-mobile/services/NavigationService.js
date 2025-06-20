// services/NavigationService.js
// Ce service gère toute la logique de navigation et de prédiction

import * as turf from '@turf/turf';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import mapboxSdk from '@mapbox/mapbox-sdk';
import MapboxDirections from '@mapbox/mapbox-sdk/services/directions';
import apiService from './api';
import MapboxGL from '@rnmapbox/maps';
const MAPBOX_ACCESS_TOKEN = MapboxGL.accessToken;
// Configuration de base
const INCIDENT_DETECTION_RADIUS = 0.5; // en kilomètres
const TRAFFIC_CHECK_INTERVAL = 60000; // Vérifier le trafic toutes les 60 secondes
const REROUTE_THRESHOLD = 30; // Différence de temps en secondes pour proposer un re-routage
const directionsClient = MapboxDirections({
    accessToken: 'pk.eyJ1IjoidG95Y2FuIiwiYSI6ImNtYThhMWR0ZjE0NGIycXM2bG05ZXFxdHoifQ.5HZaIXzWUuPTa6lrSenaGQ'
  });
// Constantes pour les types d'incidents
const INCIDENT_TYPES = {
  ACCIDENT: 'accident',
  TRAFFIC: 'traffic',
  CLOSURE: 'road_closed',
  POLICE: 'police',
  HAZARD: 'hazard'
};

// Poids des incidents pour le calcul du score d'itinéraire
const INCIDENT_WEIGHTS = {
  [INCIDENT_TYPES.ACCIDENT]: {
    severityScore: 80,
    distanceImpact: 2000, // En mètres
    delayFactor: 0.4 // 40% de retard supplémentaire
  },
  [INCIDENT_TYPES.TRAFFIC]: {
    severityScore: 60,
    distanceImpact: 1500,
    delayFactor: 0.3
  },
  [INCIDENT_TYPES.CLOSURE]: {
    severityScore: 100,
    distanceImpact: 3000,
    delayFactor: 1.0 // Route bloquée
  },
  [INCIDENT_TYPES.POLICE]: {
    severityScore: 40,
    distanceImpact: 500,
    delayFactor: 0.2
  },
  [INCIDENT_TYPES.HAZARD]: {
    severityScore: 70,
    distanceImpact: 1000,
    delayFactor: 0.25
  }
};

// Données historiques de trafic (normalement provenant d'une API)
const TRAFFIC_HISTORY = [
  // Paris - zones connues d'embouteillages fréquents
  { lat: 48.8584, lng: 2.2945, severity: 0.8, hours: [7, 8, 9, 17, 18, 19] }, // Étoile
  { lat: 48.8738, lng: 2.2950, severity: 0.9, hours: [8, 9, 17, 18, 19, 20] }, // Porte Maillot
  { lat: 48.8330, lng: 2.3708, severity: 0.7, hours: [8, 9, 17, 18, 19] }, // Place d'Italie
  { lat: 48.8361, lng: 2.2393, severity: 0.8, hours: [8, 9, 17, 18, 19, 20] }, // Porte de Saint-Cloud
  // Ajouter plus de points chauds de trafic selon les besoins
];

// Utilise l'API Mapbox pour calculer des itinéraires
const calculateRoutes = async (origin, destination, options = {}) => {
  try {
    // Construire les options de la requête
    const requestParams = {
      waypoints: [
        { coordinates: origin },
        { coordinates: destination }
      ],
      profile: 'driving',
      alternatives: true,
      geometries: 'geojson',
      steps: true,
      overview: 'full',
      annotations: ['duration', 'distance', 'speed', 'congestion']
    };
    
    // Ajouter les options d'évitement
    const excludes = [];
    if (options.avoidTolls) excludes.push('toll');
    if (options.avoidHighways) excludes.push('motorway');
    if (options.avoidFerries) excludes.push('ferry');
    
    if (excludes.length > 0) {
      requestParams.exclude = excludes;
    }
    
    // Obtenir les itinéraires
    const response = await directionsClient.getDirections(requestParams).send();
    
    if (response.body.routes && response.body.routes.length > 0) {
      return response.body.routes.map((route, index) => ({
        ...route,
        id: `route-${index}`,
        name: `Itinéraire ${index + 1}`,
        color: getRouteColor(index)
      }));
    }
    
    throw new Error('Aucun itinéraire trouvé');
  } catch (error) {
    console.error('Erreur lors du calcul des itinéraires:', error);
    throw error;
  }
};

// Analyse le trafic basée sur des données historiques et en temps réel
const analyzeTraffic = async (routes) => {
  try {
    // Obtenir l'heure actuelle
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay(); // 0 = dimanche, 1-5 = jours de semaine
    const isWeekend = currentDay === 0 || currentDay === 6;
    
    // Obtenir les données de trafic en temps réel (simulées ici)
    const liveTrafficData = await fetchLiveTrafficData();
    
    // Analyser chaque itinéraire
    return routes.map(route => {
      const routeLine = turf.lineString(route.geometry.coordinates);
      let trafficScore = 100; // Score initial, 100 = parfait
      let predictedDelayMinutes = 0;
      const trafficPoints = []; // Points de congestion sur l'itinéraire
      
      // Vérifier les données historiques de trafic
      TRAFFIC_HISTORY.forEach(point => {
        // Vérifier si c'est une heure de pointe pour ce point
        const isRushHour = point.hours.includes(currentHour);
        
        // Si c'est le week-end, réduire l'impact (sauf pour certaines zones touristiques)
        const impactMultiplier = isWeekend ? 0.7 : 1;
        
        // Calculer la distance entre le point de congestion et l'itinéraire
        const pointGeo = turf.point([point.lng, point.lat]);
        const distance = turf.pointToLineDistance(pointGeo, routeLine, { units: 'kilometers' });
        
        // Si le point est suffisamment proche de l'itinéraire
        if (distance < INCIDENT_DETECTION_RADIUS) {
          // Calculer l'impact sur le score
          const impact = isRushHour ? 
            point.severity * impactMultiplier * 20 : // Réduction max de 20 points en heure de pointe
            point.severity * impactMultiplier * 5;   // Réduction plus faible hors heure de pointe
          
          trafficScore -= impact;
          
          // Calculer le délai supplémentaire prévu
          const delay = isRushHour ? 
            (point.severity * 5) : // Jusqu'à 5 minutes de retard en heure de pointe
            (point.severity * 2);  // Moins de retard hors heures de pointe
          
          predictedDelayMinutes += delay;
          
          // Ajouter ce point aux points de congestion
          trafficPoints.push({
            location: [point.lng, point.lat],
            severity: point.severity,
            isRushHour,
            predictedDelay: delay
          });
        }
      });
      
      // Vérifier aussi les données de trafic en temps réel
      liveTrafficData.forEach(trafficSpot => {
        const pointGeo = turf.point([trafficSpot.lng, trafficSpot.lat]);
        const distance = turf.pointToLineDistance(pointGeo, routeLine, { units: 'kilometers' });
        
        if (distance < INCIDENT_DETECTION_RADIUS) {
          trafficScore -= trafficSpot.intensity * 15;
          predictedDelayMinutes += trafficSpot.intensity * 4;
          
          trafficPoints.push({
            location: [trafficSpot.lng, trafficSpot.lat],
            severity: trafficSpot.intensity,
            isLive: true,
            predictedDelay: trafficSpot.intensity * 4
          });
        }
      });
      
      // S'assurer que le score reste entre 0 et 100
      trafficScore = Math.max(0, Math.min(100, trafficScore));
      
      // Calculer l'heure d'arrivée estimée avec le retard
      const estimatedDuration = route.duration + (predictedDelayMinutes * 60);
      const eta = new Date(Date.now() + estimatedDuration * 1000);
      
      return {
        ...route,
        trafficScore,
        predictedDelayMinutes,
        trafficPoints,
        estimatedArrival: eta,
        estimatedDuration
      };
    });
  } catch (error) {
    console.error('Erreur lors de l\'analyse du trafic:', error);
    return routes.map(route => ({
      ...route,
      trafficScore: 80, // Score par défaut modéré
      predictedDelayMinutes: 0,
      trafficPoints: [],
      estimatedArrival: new Date(Date.now() + route.duration * 1000),
      estimatedDuration: route.duration
    }));
  }
};

// Simule la récupération de données de trafic en temps réel
// Dans une application réelle, cette fonction appellerait une API externe
const fetchLiveTrafficData = async () => {
  // Simuler un délai réseau
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Renvoyer des données simulées de trafic en temps réel
  const now = new Date();
  const hour = now.getHours();
  const isRushHour = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
  
  // Simuler différentes conditions de trafic selon l'heure
  return [
    // Place de l'Étoile
    {
      lat: 48.8738,
      lng: 2.2950,
      intensity: isRushHour ? 0.9 : 0.4,
      updatedAt: new Date()
    },
    // Porte de la Chapelle
    {
      lat: 48.8995,
      lng: 2.3594,
      intensity: isRushHour ? 0.8 : 0.3,
      updatedAt: new Date()
    },
    // Place d'Italie
    {
      lat: 48.8322,
      lng: 2.3561,
      intensity: isRushHour ? 0.7 : 0.3,
      updatedAt: new Date()
    }
    // D'autres points peuvent être ajoutés selon les besoins
  ];
};

// Analyse l'impact des incidents sur un itinéraire
const analyzeIncidentImpact = (route, incidents) => {
  if (!route || !route.geometry || !incidents || incidents.length === 0) {
    return { 
      affectedSegments: [], 
      totalScore: 100,
      estimatedDelay: 0 
    };
  }
  
  const routeLine = turf.lineString(route.geometry.coordinates);
  const routeLength = turf.length(routeLine, { units: 'kilometers' });
  
  let totalScore = 100; // Score parfait au départ
  let totalDelay = 0; // Délai supplémentaire en minutes
  const affectedSegments = [];
  
  // Analyser chaque incident
  incidents.forEach(incident => {
    // Obtenir les coordonnées de l'incident
    let coords;
    if (incident.coords) {
      coords = incident.coords;
    } else if (incident.location && Array.isArray(incident.location)) {
      coords = incident.location;
    } else if (incident.location && incident.location.coordinates) {
      coords = incident.location.coordinates;
    } else {
      return; // Ignorer cet incident s'il n'a pas de coordonnées
    }
    
    // Vérifier si l'incident est proche de la route
    const incidentPoint = turf.point(coords);
    const distance = turf.pointLineDistance(incidentPoint, routeLine, { units: 'kilometers' });
    
    // Si l'incident est suffisamment proche de la route
    if (distance < INCIDENT_DETECTION_RADIUS) {
      // Récupérer le poids de l'incident
      const weight = INCIDENT_WEIGHTS[incident.type] || {
        severityScore: 20,
        distanceImpact: 500,
        delayFactor: 0.1
      };
      
      // Calculer l'impact sur le score
      // Plus l'incident est proche, plus l'impact est important
      const proximityFactor = 1 - (distance / INCIDENT_DETECTION_RADIUS);
      const impactScore = weight.severityScore * proximityFactor;
      
      // Réduire le score en fonction de la gravité de l'incident
      totalScore -= Math.min(impactScore, 30); // Max 30 points par incident
      
      // Calculer le délai supplémentaire estimé en minutes
      const segmentLength = Math.min(weight.distanceImpact / 1000, routeLength);
      const segmentPercentage = segmentLength / routeLength;
      const segmentDuration = route.duration * segmentPercentage;
      const delay = segmentDuration * weight.delayFactor;
      
      totalDelay += delay / 60; // Convertir en minutes
      
      // Trouver le point le plus proche sur l'itinéraire
      const nearestPoint = turf.nearestPointOnLine(routeLine, incidentPoint);
      
      // Ajouter ce segment à la liste des segments affectés
      affectedSegments.push({
        type: incident.type,
        location: coords,
        distance,
        impact: impactScore,
        delay: delay / 60,
        nearestPoint: nearestPoint.geometry.coordinates,
        index: nearestPoint.properties.index
      });
    }
  });
  
  // S'assurer que le score reste dans la plage 0-100
  totalScore = Math.max(0, Math.min(100, totalScore));
  
  return {
    affectedSegments,
    totalScore,
    estimatedDelay: Math.round(totalDelay)
  };
};

// Recalcule les itinéraires en fonction des incidents en cours
const recalculateRoutesBasedOnTraffic = async (origin, destination, currentRoute, incidents) => {
  try {
    // Obtenir les itinéraires alternatifs
    const routes = await calculateRoutes(origin, destination, {
      avoidHighways: false,
      avoidTolls: false
    });
    
    // Si nous n'avons pas pu obtenir d'itinéraires, retourner l'itinéraire actuel
    if (!routes || routes.length === 0) {
      return [currentRoute];
    }
    
    // Analyser l'impact du trafic sur chaque itinéraire
    const analyzedRoutes = await Promise.all(
      routes.map(async (route) => {
        const analysis = analyzeIncidentImpact(route, incidents);
        
        // Obtenir des données de trafic en temps réel (si disponibles)
        const trafficData = await fetchLiveTrafficData();
        
        // Analyser l'impact du trafic en temps réel
        const trafficAnalysis = analyzeTrafficImpact(route, trafficData);
        
        // Combiner les analyses
        const combinedScore = (analysis.totalScore * 0.7) + (trafficAnalysis.score * 0.3);
        const totalDelay = analysis.estimatedDelay + trafficAnalysis.delay;
        
        return {
          ...route,
          score: Math.round(combinedScore),
          estimatedDelay: totalDelay,
          affectedSegments: [...analysis.affectedSegments, ...trafficAnalysis.affectedSegments],
          estimatedDuration: route.duration + (totalDelay * 60),
          estimatedArrival: new Date(Date.now() + (route.duration + totalDelay * 60) * 1000)
        };
      })
    );
    
    // Trier les itinéraires par score (le plus élevé en premier)
    return analyzedRoutes.sort((a, b) => b.score - a.score);
  } catch (error) {
    console.error('Erreur lors du recalcul des itinéraires:', error);
    // En cas d'erreur, retourner l'itinéraire actuel
    return [currentRoute];
  }
};

// Analyse l'impact du trafic en temps réel sur un itinéraire
const analyzeTrafficImpact = (route, trafficData) => {
  if (!route || !route.geometry || !trafficData || trafficData.length === 0) {
    return {
      affectedSegments: [],
      score: 100,
      delay: 0
    };
  }
  
  const routeLine = turf.lineString(route.geometry.coordinates);
  let score = 100;
  let totalDelay = 0;
  const affectedSegments = [];
  
  trafficData.forEach(trafficSpot => {
    const point = turf.point([trafficSpot.lng, trafficSpot.lat]);
    const distance = turf.pointToLineDistance(point, routeLine, { units: 'kilometers' });
    
    // Si le point est suffisamment proche de la route
    if (distance < INCIDENT_DETECTION_RADIUS) {
      // Réduire le score en fonction de l'intensité du trafic
      const impact = trafficSpot.intensity * 20; // Réduction maximale de 20 points
      score -= impact;
      
      // Calculer le délai en minutes
      const delay = trafficSpot.intensity * 5; // Max 5 minutes de retard pour un trafic intense
      totalDelay += delay;
      
      // Trouver le point le plus proche sur l'itinéraire
      const nearestPoint = turf.nearestPointOnLine(routeLine, point);
      
      // Ajouter ce segment à la liste des segments affectés
      affectedSegments.push({
        type: 'traffic',
        location: [trafficSpot.lng, trafficSpot.lat],
        distance,
        impact,
        delay,
        intensity: trafficSpot.intensity,
        nearestPoint: nearestPoint.geometry.coordinates,
        index: nearestPoint.properties.index
      });
    }
  });
  
  // S'assurer que le score reste dans la plage 0-100
  score = Math.max(0, Math.min(100, score));
  
  return {
    affectedSegments,
    score,
    delay: Math.round(totalDelay)
  };
};

// Vérifie périodiquement s'il y a de nouveaux incidents sur l'itinéraire
const startIncidentMonitoring = (route, onNewIncidents) => {
  // Intervalle ID pour pouvoir l'arrêter plus tard
  let monitoringInterval;
  
  // Derniers incidents connus
  let knownIncidents = [];
  
  // Fonction qui sera exécutée à intervalles réguliers
  const checkForIncidents = async () => {
    try {
      // Récupérer tous les incidents actifs
      const allIncidents = await apiService.incidents.getAll();
      
      if (!allIncidents || !Array.isArray(allIncidents)) {
        return;
      }
      
      // Filtrer pour ne garder que les incidents actifs
      const activeIncidents = allIncidents.filter(incident => incident.active !== false);
      
      // Si nous n'avons pas de route, ne rien faire
      if (!route || !route.geometry) {
        return;
      }
      
      // Créer une ligne pour la route
      const routeLine = turf.lineString(route.geometry.coordinates);
      
      // Trouver les incidents qui sont sur notre itinéraire
      const routeIncidents = activeIncidents.filter(incident => {
        // Obtenir les coordonnées de l'incident
        let coords;
        if (incident.coords) {
          coords = incident.coords;
        } else if (incident.location && Array.isArray(incident.location)) {
          coords = incident.location;
        } else if (incident.location && incident.location.coordinates) {
          coords = incident.location.coordinates;
        } else {
          return false; // Ignorer cet incident s'il n'a pas de coordonnées
        }
        
        // Vérifier si l'incident est proche de la route
        const incidentPoint = turf.point(coords);
        const distance = turf.pointToLineDistance(incidentPoint, routeLine, { units: 'kilometers' });
        
        return distance < INCIDENT_DETECTION_RADIUS;
      });
      
      // Vérifier s'il y a de nouveaux incidents par rapport à la dernière vérification
      const newIncidents = routeIncidents.filter(incident => 
        !knownIncidents.some(known => known.id === incident.id)
      );
      
      // Si nous avons de nouveaux incidents, appeler le callback
      if (newIncidents.length > 0) {
        onNewIncidents(newIncidents, routeIncidents);
      }
      
      // Mettre à jour les incidents connus
      knownIncidents = routeIncidents;
    } catch (error) {
      console.error('Erreur lors de la vérification des incidents:', error);
    }
  };
  
  // Démarrer la vérification périodique
  monitoringInterval = setInterval(checkForIncidents, TRAFFIC_CHECK_INTERVAL);
  
  // Effectuer une première vérification immédiatement
  checkForIncidents();
  
  // Retourner une fonction pour arrêter la surveillance
  return () => {
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
    }
  };
};

// Analyse une route pour déterminer les zones à risque d'embouteillages
const predictTrafficHotspots = async (route) => {
  try {
    // Obtenir l'heure actuelle
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay(); // 0 = dimanche, 1-5 = jours de semaine
    const isWeekend = currentDay === 0 || currentDay === 6;
    const isRushHour = (currentHour >= 7 && currentHour <= 9) || (currentHour >= 17 && currentHour <= 19);
    
    // Si nous n'avons pas de route, retourner une prédiction vide
    if (!route || !route.geometry) {
      return [];
    }
    
    // Créer une ligne pour la route
    const routeLine = turf.lineString(route.geometry.coordinates);
    const routeLength = turf.length(routeLine, { units: 'kilometers' });
    
    // Nombre de points à analyser le long de la route
    const numPoints = Math.max(10, Math.ceil(routeLength / 2)); // Un point tous les 2 km environ
    
    // Obtenir des points équidistants le long de la route
    const points = [];
    for (let i = 0; i <= numPoints; i++) {
      const fraction = i / numPoints;
      const point = turf.along(routeLine, routeLength * fraction, { units: 'kilometers' });
      points.push(point);
    }
    
    // Prédire les points chauds de trafic
    const hotspots = [];
    
    // Vérifier chaque point le long de la route
    points.forEach((point, index) => {
      // Coordonnées du point
      const [lng, lat] = point.geometry.coordinates;
      
      // Distance parcourue jusqu'à ce point (en km)
      const distance = (index / numPoints) * routeLength;
      
      // Temps estimé pour atteindre ce point (en secondes)
      const timeToReach = (index / numPoints) * route.duration;
      
      // Moment prévu à ce point
      const estimatedArrival = new Date(now.getTime() + timeToReach * 1000);
      const arrivalHour = estimatedArrival.getHours();
      
      // Vérifier si c'est une heure de pointe à l'arrivée
      const isRushHourAtArrival = (arrivalHour >= 7 && arrivalHour <= 9) || (arrivalHour >= 17 && arrivalHour <= 19);
      
      // Facteur pour le jour de la semaine à l'arrivée
      const arrivalDay = estimatedArrival.getDay();
      const isWeekendAtArrival = arrivalDay === 0 || arrivalDay === 6;
      
      // Score de base pour ce point (0-100, 100 = trafic fluide)
      let trafficScore = 100;
      
      // Rechercher les points chauds connus à proximité
      TRAFFIC_HISTORY.forEach(hotspot => {
        const hotspotDistance = turf.distance(
          point,
          turf.point([hotspot.lng, hotspot.lat]),
          { units: 'kilometers' }
        );
        
        // Si nous sommes près d'un point chaud connu
        if (hotspotDistance < INCIDENT_DETECTION_RADIUS) {
          // Vérifier si c'est une heure de pointe pour ce point chaud
          const isHotspotRushHour = hotspot.hours.includes(arrivalHour);
          
          // Facteur de réduction du score en fonction du jour et de l'heure
          let impactFactor = 1.0;
          
          if (isWeekendAtArrival) {
            impactFactor *= 0.7; // Moins de trafic le weekend
          }
          
          if (isHotspotRushHour) {
            impactFactor *= 1.5; // Plus de trafic aux heures de pointe
          }
          
          // Réduire le score en fonction de la sévérité connue et de la proximité
          const proximity = 1 - (hotspotDistance / INCIDENT_DETECTION_RADIUS);
          const reduction = hotspot.severity * 50 * proximity * impactFactor;
          
          trafficScore -= reduction;
          
          // Si le score est suffisamment bas, ajouter ce point comme un hotspot potentiel
          if (trafficScore < 70) {
            hotspots.push({
              location: [lng, lat],
              distance: distance,
              timeToReach: Math.round(timeToReach / 60), // En minutes
              estimatedArrival: estimatedArrival,
              trafficScore: Math.max(0, Math.min(100, trafficScore)),
              rushHour: isHotspotRushHour,
              severity: (100 - trafficScore) / 100, // 0-1, 1 = très congestionné
              reason: 'Zone à fort trafic'
            });
          }
        }
      });
    });
    
    // Filtrer pour éviter les hotspots trop proches les uns des autres
    const filteredHotspots = [];
    hotspots.forEach(hotspot => {
      // Vérifier si ce hotspot est proche d'un autre déjà ajouté
      const isDuplicate = filteredHotspots.some(existing => {
        const distance = turf.distance(
          turf.point(hotspot.location),
          turf.point(existing.location),
          { units: 'kilometers' }
        );
        return distance < 1; // Moins de 1 km
      });
      
      // Si ce n'est pas un doublon, l'ajouter
      if (!isDuplicate) {
        filteredHotspots.push(hotspot);
      }
    });
    
    return filteredHotspots;
  } catch (error) {
    console.error('Erreur lors de la prédiction des points chauds de trafic:', error);
    return [];
  }
};

// Suggère un meilleur moment pour partir en fonction des prévisions de trafic
const suggestBetterDepartureTime = async (origin, destination, preferences = {}) => {
  try {
    // Obtenir l'heure actuelle
    const now = new Date();
    const currentHour = now.getHours();
    
    // Tableau pour stocker les résultats pour différentes heures de départ
    const timeSuggestions = [];
    
    // Tester différentes heures de départ (jusqu'à 6 heures plus tard)
    for (let hourOffset = 0; hourOffset <= 6; hourOffset++) {
      // Heure de départ testée
      const departureTime = new Date(now.getTime() + hourOffset * 60 * 60 * 1000);
      const departureHour = departureTime.getHours();
      
      // Calculer l'itinéraire pour cette heure de départ
      const routes = await calculateRoutes(origin, destination, preferences);
      
      if (!routes || routes.length === 0) continue;
      
      // Prendre le meilleur itinéraire
      const route = routes[0];
      
      // Analyser le trafic prévu pour cette heure
      const trafficAnalysis = await analyzeTrafficAtTime(route, departureTime);
      
      // Calculer la durée estimée avec le trafic
      const estimatedDuration = route.duration + (trafficAnalysis.predictedDelayMinutes * 60);
      
      // Calculer l'heure d'arrivée estimée
      const estimatedArrival = new Date(departureTime.getTime() + estimatedDuration * 1000);
      
      // Ajouter cette suggestion au tableau
      timeSuggestions.push({
        departureTime,
        departureHour,
        estimatedDuration,
        estimatedArrival,
        trafficScore: trafficAnalysis.trafficScore,
        predictedDelayMinutes: trafficAnalysis.predictedDelayMinutes,
        congestionPoints: trafficAnalysis.trafficPoints.length
      });
    }
    
    // Trier les suggestions par score de trafic décroissant
    timeSuggestions.sort((a, b) => b.trafficScore - a.trafficScore);
    
    return timeSuggestions;
  } catch (error) {
    console.error('Erreur lors de la suggestion de meilleure heure de départ:', error);
    return [];
  }
};

// Analyse le trafic prévu pour une heure de départ spécifique
const analyzeTrafficAtTime = async (route, departureTime) => {
  try {
    const departureHour = departureTime.getHours();
    const departureDay = departureTime.getDay();
    const isWeekend = departureDay === 0 || departureDay === 6;
    
    // Score initial de trafic
    let trafficScore = 100;
    let predictedDelayMinutes = 0;
    const trafficPoints = [];
    
    // Si nous n'avons pas de route, retourner une analyse par défaut
    if (!route || !route.geometry) {
      return { trafficScore, predictedDelayMinutes, trafficPoints };
    }
    
    // Créer une ligne pour la route
    const routeLine = turf.lineString(route.geometry.coordinates);
    
    // Vérifier les points chauds connus
    TRAFFIC_HISTORY.forEach(hotspot => {
      // Vérifier si c'est une heure de pointe pour ce point chaud
      const isHotspotRushHour = hotspot.hours.includes(departureHour);
      
      // Facteur d'impact en fonction du jour et de l'heure
      let impactFactor = 1.0;
      
      if (isWeekend) {
        impactFactor *= 0.7; // Moins de trafic le weekend
      }
      
      if (isHotspotRushHour) {
        impactFactor *= 1.5; // Plus de trafic aux heures de pointe
      }
      
      // Calculer la distance entre le point chaud et la route
      const hotspotPoint = turf.point([hotspot.lng, hotspot.lat]);
      const nearestPoint = turf.nearestPointOnLine(routeLine, hotspotPoint);
      const distance = turf.distance(hotspotPoint, nearestPoint, { units: 'kilometers' });
      
      // Si le point chaud est suffisamment proche de la route
      if (distance < INCIDENT_DETECTION_RADIUS) {
        // Réduire le score en fonction de la sévérité et de la proximité
        const proximity = 1 - (distance / INCIDENT_DETECTION_RADIUS);
        const reduction = hotspot.severity * 30 * proximity * impactFactor;
        
        trafficScore -= reduction;
        
        // Calculer le délai estimé en minutes
        const delay = hotspot.severity * 3 * impactFactor;
        predictedDelayMinutes += delay;
        
        // Ajouter ce point à la liste des points de congestion
        trafficPoints.push({
          location: [hotspot.lng, hotspot.lat],
          severity: hotspot.severity,
          delay,
          isRushHour: isHotspotRushHour,
          reason: 'Point de congestion connu'
        });
      }
    });
    
    // S'assurer que le score reste dans la plage 0-100
    trafficScore = Math.max(0, Math.min(100, trafficScore));
    
    return {
      trafficScore,
      predictedDelayMinutes,
      trafficPoints
    };
  } catch (error) {
    console.error('Erreur lors de l\'analyse du trafic prévu:', error);
    return {
      trafficScore: 80,
      predictedDelayMinutes: 0,
      trafficPoints: []
    };
  }
};

// Obtient une couleur pour un itinéraire en fonction de son index
const getRouteColor = (index) => {
  const colors = ['#3887be', '#FF9500', '#34C759', '#5856D6', '#FF2D55'];
  return colors[index % colors.length];
};

// Exporter toutes les fonctions utiles
export default {
  // Calcul d'itinéraire
  calculateRoutes,
  
  // Analyse du trafic et des incidents
  analyzeTraffic,
  analyzeIncidentImpact,
  recalculateRoutesBasedOnTraffic,
  
  // Surveillance des incidents
  startIncidentMonitoring,
  
  // Prédictions et suggestions
  predictTrafficHotspots,
  suggestBetterDepartureTime,
  
  // Utilitaires
  getRouteColor
};