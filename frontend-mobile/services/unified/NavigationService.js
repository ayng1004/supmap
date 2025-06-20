// services/unified/NavigationService.js

import * as turf from '@turf/turf';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import apiService from '../api';

// Constants
const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoidG95Y2FuIiwiYSI6ImNtYThhMWR0ZjE0NGIycXM2bG05ZXFxdHoifQ.5HZaIXzWUuPTa6lrSenaGQ';
const INCIDENT_DETECTION_RADIUS = 0.5; // km
const TRAFFIC_CHECK_INTERVAL = 60000; // ms

// Types d'incidents et leurs poids
const INCIDENT_TYPES = {
  ACCIDENT: 'accident',
  TRAFFIC: 'traffic',
  CLOSURE: 'closure',
  POLICE: 'police',
  HAZARD: 'hazard'
};

// Dans NavigationService.js, remplacez ces constantes
const INCIDENT_WEIGHTS = {
  [INCIDENT_TYPES.ACCIDENT]: { severityScore: 40, distanceImpact: 800, delayFactor: 0.1 },
  [INCIDENT_TYPES.TRAFFIC]: { severityScore: 25, distanceImpact: 600, delayFactor: 0.08 },
  [INCIDENT_TYPES.CLOSURE]: { severityScore: 60, distanceImpact: 1000, delayFactor: 0.3 },
  [INCIDENT_TYPES.POLICE]: { severityScore: 15, distanceImpact: 200, delayFactor: 0.05 },
  [INCIDENT_TYPES.HAZARD]: { severityScore: 20, distanceImpact: 300, delayFactor: 0.06 }
};
// Données historiques de trafic (pour les prédictions)
const TRAFFIC_HISTORY = [
  // Paris - zones connues d'embouteillages fréquents
  { lat: 48.8584, lng: 2.2945, severity: 0.8, hours: [7, 8, 9, 17, 18, 19] }, // Étoile
  { lat: 48.8738, lng: 2.2950, severity: 0.9, hours: [8, 9, 17, 18, 19, 20] }, // Porte Maillot
  { lat: 48.8330, lng: 2.3708, severity: 0.7, hours: [8, 9, 17, 18, 19] }, // Place d'Italie
  { lat: 48.8361, lng: 2.2393, severity: 0.8, hours: [8, 9, 17, 18, 19, 20] }, // Porte de Saint-Cloud
];

// Fonctions utilitaires
// Fonction helper pour normaliser les coordonnées d'un incident
const normalizeIncidentCoordinates = (incident) => {
  if (!incident) return null;
  
  let coords = null;
  
  if (incident.coords && Array.isArray(incident.coords)) {
    coords = incident.coords;
  } else if (incident.location) {
    if (Array.isArray(incident.location)) {
      coords = incident.location;
    } else if (incident.location.coordinates && Array.isArray(incident.location.coordinates)) {
      coords = incident.location.coordinates;
    }
  } else if (incident.longitude !== undefined && incident.latitude !== undefined) {
    coords = [parseFloat(incident.longitude), parseFloat(incident.latitude)];
  } else if (incident.lng !== undefined && incident.lat !== undefined) {
    coords = [parseFloat(incident.lng), parseFloat(incident.lat)];
  }
  
  if (!coords || !coords[0] || !coords[1] || isNaN(coords[0]) || isNaN(coords[1])) {
    return null;
  }
  
  return [parseFloat(coords[0]), parseFloat(coords[1])];
};

// Fonction utilitaire pour calculer la distance d'un point à un segment
function distanceToSegment(lat, lng, lat1, lng1, lat2, lng2) {
  // Convertir en radians
  const R = 6371; // Rayon de la Terre en km
  
  const p = [lng, lat];
  const v = [lng1, lat1];
  const w = [lng2, lat2];
  
  // Calcul de distance Haversine simplifié
  function haversineDistance(p1, p2) {
    const dLat = (p2[1] - p1[1]) * Math.PI / 180;
    const dLon = (p2[0] - p1[0]) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(p1[1] * Math.PI / 180) * Math.cos(p2[1] * Math.PI / 180) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
  
  // Distance directe entre les points
  const l2 = haversineDistance(v, w);
  
  // Point est sur le segment
  if (l2 === 0) return haversineDistance(p, v);
  
  // Projection sur le segment (simplifié)
  const t = Math.max(0, Math.min(1, 
    ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) / 
    ((w[0] - v[0]) * (w[0] - v[0]) + (w[1] - v[1]) * (w[1] - v[1]))
  ));
  
  const projection = [
    v[0] + t * (w[0] - v[0]),
    v[1] + t * (w[1] - v[1])
  ];
  
  return haversineDistance(p, projection);
}
// Service unifié
const NavigationService = {
  // Calcul d'itinéraires
 // Dans NavigationService.js - Fonction corrigée
calculateRoutes: async (origin, destination, options = {}) => {
    try {
      // Construction de l'URL pour l'API Mapbox Directions
      let url = `https://api.mapbox.com/directions/v5/mapbox/driving/`;
      url += `${origin[0]},${origin[1]};${destination[0]},${destination[1]}`;
      url += `?alternatives=true&geometries=geojson&steps=true&overview=full`;
      url += `&annotations=duration,distance,speed`;
      
      // Ajouter les options d'évitement
      const excludes = [];
      if (options.avoidTolls) excludes.push('toll');
      if (options.avoidHighways) excludes.push('motorway');
      if (options.avoidFerries) excludes.push('ferry');
      
      if (excludes.length > 0) {
        url += `&exclude=${excludes.join(',')}`;
      }
      
      url += `&access_token=${MAPBOX_ACCESS_TOKEN}`;
  
      console.log('Calcul d\'itinéraire:', url);
  
      // Faire la requête à l'API
      const response = await fetch(url);
      const data = await response.json();
  
      console.log('Réponse de l\'API Mapbox:', data.routes?.length, 'itinéraires');
  
      if (data.routes && data.routes.length > 0) {
        return data.routes.map((route, index) => ({
          ...route,
          id: `route-${index}`,
          geometry: route.geometry,
          duration: route.duration,
          distance: route.distance,
          steps: route.legs[0].steps,
          name: index === 0 ? 'Itinéraire optimal' : `Alternative ${index}`,
          color: getRouteColor(index)
        }));
      } else {
        console.warn('API Mapbox n\'a pas retourné d\'itinéraires:', data);
      }
      
      throw new Error('Aucun itinéraire trouvé');
    } catch (error) {
      console.error('Erreur lors du calcul des itinéraires:', error);
      throw error;
    }
  },

  // Analyse de l'impact des incidents sur un itinéraire
  analyzeIncidentImpact: (route, incidents) => {
    if (!route || !route.geometry || !incidents || incidents.length === 0) {
      return { affectedSegments: [], totalScore: 100, estimatedDelay: 0 };
    }
    
    const routeLine = turf.lineString(route.geometry.coordinates);
    const routeLength = turf.length(routeLine, { units: 'kilometers' });
    
    let totalScore = 100;
    let totalDelay = 0;
    const affectedSegments = [];
    
    incidents.forEach(incident => {
      // Normaliser les coordonnées
      let coords = normalizeIncidentCoordinates(incident);
      if (!coords) return;
      
      // Vérifier si l'incident est proche de la route
      const incidentPoint = turf.point(coords);
      const distance = turf.pointToLineDistance(incidentPoint, routeLine, { units: 'kilometers' });
      
      if (distance < INCIDENT_DETECTION_RADIUS) {
        // Récupérer le poids de l'incident
        const weight = INCIDENT_WEIGHTS[incident.type] || {
          severityScore: 20,
          distanceImpact: 500,
          delayFactor: 0.1
        };
        
        // Calculer l'impact sur le score
        const proximityFactor = 1 - (distance / INCIDENT_DETECTION_RADIUS);
        const impactScore = weight.severityScore * proximityFactor;
        
        // Réduire le score en fonction de la gravité
        totalScore -= Math.min(impactScore, 30);
        
        // Calculer le délai estimé
        const segmentLength = Math.min(weight.distanceImpact / 1000, routeLength);
        const segmentPercentage = segmentLength / routeLength;
        const segmentDuration = route.duration * segmentPercentage;
        const delay = segmentDuration * weight.delayFactor;
        
        totalDelay += delay / 60; // Convertir en minutes
        
        // Trouver le point le plus proche sur l'itinéraire
        const nearestPoint = turf.nearestPointOnLine(routeLine, incidentPoint);
        
        // Ajouter ce segment à la liste
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
      totalScore: Math.round(totalScore),
      estimatedDelay: Math.round(totalDelay)
    };
  },

  // Surveillance des incidents sur un itinéraire
  startIncidentMonitoring: (route, onNewIncidents) => {
    let monitoringInterval;
    let knownIncidents = [];
    
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
          let coords = normalizeIncidentCoordinates(incident);
          if (!coords) return false;
          
          // Vérifier si l'incident est proche de la route
          const incidentPoint = turf.point(coords);
          const distance = turf.pointToLineDistance(incidentPoint, routeLine, { units: 'kilometers' });
          
          return distance < INCIDENT_DETECTION_RADIUS;
        });
        
        // Vérifier s'il y a de nouveaux incidents
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
  },

  // Analyse du trafic actuel
  analyzeCurrentTraffic: (route) => {
    if (!route || !route.geometry) {
      return { trafficScore: 100, hotspots: [], estimatedDelay: 0 };
    }
    
    // Obtenir l'heure actuelle
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay(); // 0 = dimanche, 1-5 = jours de semaine, 6 = samedi
    const isWeekend = currentDay === 0 || currentDay === 6;
    const isRushHour = (currentHour >= 7 && currentHour <= 9) || (currentHour >= 17 && currentHour <= 19);
    
    // Créer une ligne pour l'itinéraire
    const routeLine = turf.lineString(route.geometry.coordinates);
    
    // Points chauds de trafic
    const hotspots = [];
    let totalTrafficScore = 100;
    let totalDelay = 0;
    
    // Vérifier les zones de trafic connues
    TRAFFIC_HISTORY.forEach(point => {
      // Vérifier si c'est une heure de pointe pour ce point
      const isPointRushHour = point.hours.includes(currentHour);
      
      // Réduire l'impact pendant le weekend
      const dayFactor = isWeekend ? 0.7 : 1.0;
      
      // Calculer la distance entre le point et l'itinéraire
      const trafficPoint = turf.point([point.lng, point.lat]);
      const distance = turf.pointToLineDistance(trafficPoint, routeLine, { units: 'kilometers' });
      
      // Si le point est suffisamment proche de l'itinéraire
      if (distance < INCIDENT_DETECTION_RADIUS) {
        // Calculer l'impact
        const proximityFactor = 1 - (distance / INCIDENT_DETECTION_RADIUS);
        const hourFactor = isPointRushHour ? 1.5 : 0.8;
        const impact = point.severity * proximityFactor * hourFactor * dayFactor * 30; // Max 30 points
        
        // Réduire le score
        totalTrafficScore -= impact;
        
        // Calculer le délai
        const delay = isPointRushHour ? 
          (point.severity * 5) : // Jusqu'à 5 minutes à l'heure de pointe
          (point.severity * 2);  // Moins de retard hors heure de pointe
        
        totalDelay += delay * proximityFactor;
        
        // Trouver le point le plus proche sur l'itinéraire
        const nearestPoint = turf.nearestPointOnLine(routeLine, trafficPoint);
        
        // Ajouter ce point chaud
        hotspots.push({
          location: [point.lng, point.lat],
          severity: point.severity,
          impact: impact,
          delay: delay * proximityFactor,
          isRushHour: isPointRushHour,
          nearestPoint: nearestPoint.geometry.coordinates
        });
      }
    });
    
    // S'assurer que le score reste dans la plage 0-100
    totalTrafficScore = Math.max(0, Math.min(100, Math.round(totalTrafficScore)));
    
    return {
      trafficScore: totalTrafficScore,
      hotspots: hotspots,
      estimatedDelay: Math.round(totalDelay),
      isRushHour: isRushHour,
      isWeekend: isWeekend
    };
  },

  // Suggère un meilleur moment pour partir
  suggestBetterDepartureTime: (route) => {
    try {
      // Obtenir l'heure actuelle
      const now = new Date();
      const currentHour = now.getHours();
      
      // Tableau pour stocker les résultats
      const timeSuggestions = [];
      
      // Tester différentes heures de départ (jusqu'à 6 heures plus tard)
      for (let hourOffset = 0; hourOffset <= 6; hourOffset++) {
        // Heure de départ testée
        const departureTimeObj = new Date(now.getTime() + hourOffset * 60 * 60 * 1000);
        const departureTime = departureTimeObj.toISOString();
        const departureHour = departureTimeObj.getHours();
        
        // Vérifier si c'est une heure de pointe
        const isRushHour = (departureHour >= 7 && departureHour <= 9) || 
                           (departureHour >= 17 && departureHour <= 19);
        
        // Estimer le score de trafic
        let trafficScore;
        if (isRushHour) {
          trafficScore = 50 + Math.floor(Math.random() * 30); // 50-80 durant heures de pointe
        } else {
          trafficScore = 70 + Math.floor(Math.random() * 30); // 70-100 hors heures de pointe
        }
        
        // Estimer le délai
        const predictedDelayMinutes = isRushHour ? 
                                    10 + Math.floor(Math.random() * 20) : // 10-30 min en heure de pointe
                                    Math.floor(Math.random() * 10);       // 0-10 min hors heure de pointe
        
        // Temps de trajet estimé
        const estimatedDuration = (route && route.duration) ? 
                                route.duration + (predictedDelayMinutes * 60) : 
                                1800 + (predictedDelayMinutes * 60); // 30 min + délai
        
        // Calculer l'heure d'arrivée estimée
        const estimatedArrival = new Date(departureTimeObj.getTime() + estimatedDuration * 1000).toISOString();
        
        // Ajouter cette suggestion
        timeSuggestions.push({
          departureTime, 
          departureTimeDisplay: departureTimeObj.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}),
          departureHour,
          estimatedDuration: Math.floor(estimatedDuration / 60), // En minutes
          estimatedArrival,
          estimatedArrivalDisplay: new Date(departureTimeObj.getTime() + estimatedDuration * 1000)
                                  .toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}),
          trafficScore,
          predictedDelayMinutes,
          congestionPoints: isRushHour ? 3 : 1,
          quality: trafficScore > 80 ? "Excellent" : trafficScore > 60 ? "Bon" : "Moyen",
          reason: isRushHour ? "Heure de pointe" : "Hors heure de pointe"
        });
      }
      
      // Trier les suggestions par score de trafic décroissant
      return timeSuggestions.sort((a, b) => b.trafficScore - a.trafficScore);
    } catch (error) {
      console.error('Erreur lors de la suggestion de meilleure heure de départ:', error);
      return [];
    }
  },

  // Recalcule un itinéraire pour éviter certaines zones
  // Remplacer entièrement la fonction recalculateRoutesBasedOnTraffic par cette version
recalculateRoutesBasedOnTraffic: async (origin, destination, currentRoute, incidents) => {
  try {
    console.log('Recalcul intelligent des itinéraires avec', incidents?.length || 0, 'incidents');
    
    // Validation des entrées
    if (!origin || !destination) {
      console.error('Origine ou destination invalide pour le recalcul');
      return [currentRoute]; // Retour sécurisé
    }
    
    // Obtenir les routes alternatives 
    let routes;
    try {
      routes = await NavigationService.calculateRoutes(origin, destination);
      console.log('Routes calculées:', routes?.length || 0);
    } catch (error) {
      console.error('Erreur lors du calcul initial des routes:', error);
      return [currentRoute];
    }
    
    // Vérifier que les routes existent
    if (!routes || !Array.isArray(routes) || routes.length === 0) {
      console.log('Pas de routes alternatives trouvées');
      return [currentRoute];
    }
    
    // Enrichir les routes avec des informations supplémentaires
    let processedRoutes = [];
    
    // Make sure incidents is an array
    const validIncidents = Array.isArray(incidents) ? incidents : [];
    console.log('Nombre d\'incidents valides:', validIncidents.length);
    
    // Log some incident examples to verify format
    if (validIncidents.length > 0) {
      console.log('Exemple d\'incident:', validIncidents[0]);
    }
    
    for (let i = 0; i < routes.length; i++) {
      try {
        const route = routes[i];
        console.log(`Analyse de la route ${i+1} - distance: ${route.distance}, durée: ${route.duration}`);
        
        // Compteur simple d'incidents sur cette route
        let incidentsOnRoute = 0;
        let routeImpactScore = 100; // Score parfait au départ
        let incidentTypes = {}; // Pour compter les incidents par type
        
        // VERSION SIMPLIFIÉE: Compter les incidents proches de la route manuellement
        if (validIncidents.length > 0 && route.geometry && route.geometry.coordinates) {
          // Convertir en LineString pour Turf
          const routeCoords = route.geometry.coordinates;
          
          // Pour chaque incident, vérifier sa proximité à l'itinéraire
          validIncidents.forEach(incident => {
            try {
              // Essayer d'extraire les coordonnées
              const incidentCoords = normalizeIncidentCoordinates(incident);
              if (!incidentCoords) return;
              
              // Version simplifiée: vérifier la proximité avec chaque segment de la route
              let minDistance = Infinity;
              
              // Parcourir les segments de route
              for (let j = 0; j < routeCoords.length - 1; j++) {
                const start = routeCoords[j];
                const end = routeCoords[j + 1];
                
                // Calculer la distance (méthode simplifiée)
                const distance = distanceToSegment(
                  incidentCoords[1], incidentCoords[0], // lat, lng de l'incident
                  start[1], start[0], // lat, lng du début du segment
                  end[1], end[0] // lat, lng de la fin du segment
                );
                
                minDistance = Math.min(minDistance, distance);
              }
              
              // Si l'incident est proche de la route (< 500m)
              if (minDistance < 0.5) {
                incidentsOnRoute++;
                incidentTypes[incident.type] = (incidentTypes[incident.type] || 0) + 1;
                
                // Réduire le score en fonction du type
                switch (incident.type) {
                  case 'accident': 
                    routeImpactScore -= 15; 
                    break;
                  case 'traffic': 
                    routeImpactScore -= 10; 
                    break;
                  case 'closure': 
                    routeImpactScore -= 25; 
                    break;
                  case 'police': 
                    routeImpactScore -= 5; 
                    break;
                  case 'hazard': 
                    routeImpactScore -= 10; 
                    break;
                  default: 
                    routeImpactScore -= 5;
                }
              }
            } catch (err) {
              console.log('Erreur analyse incident:', err);
            }
          });
        }
        
        console.log(`Route ${i+1} - incidents trouvés: ${incidentsOnRoute}, score: ${routeImpactScore}`);
        console.log('Types d\'incidents:', incidentTypes);
        
        // Garantir un score positif
        routeImpactScore = Math.max(20, routeImpactScore);
        
        // Calcul du délai estimé basé sur les incidents
        const estimatedDelay = Math.min(20, Math.ceil(incidentsOnRoute * 1.5));
        
        // Déterminer le type de route
        let routeType;
        
        if (i === 0) {
          routeType = "Plus rapide";
        } else if (route.distance < routes[0].distance * 0.9) {
          routeType = "Plus court";
        } else if (incidentsOnRoute === 0) {
          routeType = "Sans incidents";
        } else if (processedRoutes.length > 0 && incidentsOnRoute < (processedRoutes[0]?.incidentsCount || 999)) {
          routeType = "Moins d'incidents";
        } else {
          routeType = `Alternative ${i+1}`;
        }
        
        // Créer une route enrichie
        const enrichedRoute = {
          ...route,
          score: routeImpactScore,
          incidentsCount: incidentsOnRoute,
          incidentTypes: incidentTypes,
          routeType: routeType,
          estimatedDelay: estimatedDelay,
          trafficCondition: routeImpactScore > 80 ? "Fluide" : routeImpactScore > 60 ? "Chargé" : "Congestionné",
          hasTraffic: incidentsOnRoute > 0,
          estimatedDuration: route.duration + (estimatedDelay * 60),
          estimatedArrival: new Date(Date.now() + (route.duration + estimatedDelay * 60) * 1000),
          summary: `${Math.floor(route.duration / 60)} min | ${(route.distance / 1000).toFixed(1)} km | ${incidentsOnRoute} incidents`
        };
        
        processedRoutes.push(enrichedRoute);
      } catch (routeError) {
        console.error(`Erreur lors de l'analyse de la route ${i}:`, routeError);
        // Si l'analyse échoue, ajouter la route non enrichie
        processedRoutes.push(routes[i]);
      }
    }
    
    // TRÈS IMPORTANT: Cette partie est critique - c'est ici que l'erreur se produit
    // Assurez-vous que processedRoutes est un tableau valide avant le tri
    if (processedRoutes && Array.isArray(processedRoutes) && processedRoutes.length > 1) {
      try {
        console.log('Tri des', processedRoutes.length, 'routes calculées');
        processedRoutes.sort((a, b) => {
          // S'assurer que les propriétés existent pour éviter les erreurs
          const aTime = a && a.duration ? a.duration + ((a.estimatedDelay || 0) * 60) : Infinity;
          const bTime = b && b.duration ? b.duration + ((b.estimatedDelay || 0) * 60) : Infinity;
          return aTime - bTime;
        });
        console.log('Routes triées avec succès');
      } catch (error) {
        console.error('Erreur de tri:', error);
        // Si le tri échoue, ne pas planter
      }
    } else {
      console.log('Pas de tri nécessaire:', processedRoutes ? `${processedRoutes.length} routes` : 'routes invalides');
    }
    
    // RECHERCHER CES VARIABLES spécifiquement dans votre code:
    // Cherchez "analyzedRoutes" et assurez-vous qu'il n'y a pas d'autres variables
    // qui pourraient être renommées
    
    // ⭐ IMPORTANT: Si votre code contient "analyzedRoutes" ailleurs, 
    // cherchez-le et appliquez les mêmes vérifications
    
    console.log('Routes traitées, retour de', processedRoutes.length, 'routes');
    return processedRoutes;
    
  } catch (error) {
    console.error('Erreur générale lors du recalcul intelligent:', error);
    // Assurer un retour sécurisé même en cas d'erreur
    return currentRoute ? [currentRoute] : [];
  }
},

  // Ajouter ces méthodes à NavigationService
calculateDistance: (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Rayon de la Terre en mètres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // en mètres
},

// Vérifier si un utilisateur s'écarte de l'itinéraire
checkRouteDeviation: (userCoords, routeGeometry, deviationThreshold = 50) => {
  if (!routeGeometry || !routeGeometry.coordinates) return { isDeviated: false, distance: 0 };
  
  // Créer une ligne à partir de l'itinéraire
  const routeLine = turf.lineString(routeGeometry.coordinates);
  
  // Créer un point à partir de la position de l'utilisateur
  const userPoint = turf.point([userCoords.longitude, userCoords.latitude]);
  
  // Calculer la distance entre l'utilisateur et l'itinéraire le plus proche
  const distance = turf.pointToLineDistance(userPoint, routeLine, { units: 'meters' });
  
  return {
    isDeviated: distance > deviationThreshold,
    distance: distance
  };
},

// Obtenir une configuration caméra optimisée pour la navigation
getNavigationCameraConfig: (zoomLevel = 17) => {
  return {
    zoomLevel: zoomLevel,
    minZoomLevel: 15,
    maxZoomLevel: 19,
    animationDuration: 500,
    followUserMode: 3, // UserTrackingModes.FollowWithCourse
    followPitch: 60,
    paddingBottom: 120
  };
},

// Améliorer la précision de localisation
getPreciseLocationOptions: () => {
  return {
    accuracy: 5, // HIGH_ACCURACY
    distanceInterval: 5, // Mettre à jour tous les 5 mètres
    timeInterval: 1000, // Maximum 1 mise à jour par seconde
    foregroundService: {
      notificationTitle: 'Navigation en cours',
      notificationBody: 'Votre position est suivie pour la navigation'
    }
  };
}
};

// Obtient une couleur pour un itinéraire en fonction de son index
const getRouteColor = (index) => {
  const colors = ['#3887be', '#FF9500', '#34C759', '#5856D6', '#FF2D55'];
  return colors[index % colors.length];
};

export default NavigationService;