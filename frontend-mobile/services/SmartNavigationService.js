// services/SmartNavigationService.js - Compatible avec l'existant
import * as turf from '@turf/turf';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { fetchTomTomIncidents } from '../services/trafficService';
import apiService from '../services/api';

// Configuration de base
const INCIDENT_DETECTION_RADIUS = 0.5; // en kilomètres
const TRAFFIC_CHECK_INTERVAL = 60000; // Vérifier le trafic toutes les 60 secondes
const REROUTE_THRESHOLD = 30; // Différence de temps en secondes pour proposer un re-routage

// Utiliser une chaîne d'accès MapBox directement
const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoidG95Y2FuIiwiYSI6ImNtYThhMWR0ZjE0NGIycXM2bG05ZXFxdHoifQ.5HZaIXzWUuPTa6lrSenaGQ';

// Constantes pour les types d'incidents
const INCIDENT_TYPES = {
  ACCIDENT: 'accident',
  TRAFFIC: 'traffic',
  CLOSURE: 'closure',
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

// Données historiques de trafic
const TRAFFIC_HISTORY = [
  // Paris - zones connues d'embouteillages fréquents
  { lat: 48.8584, lng: 2.2945, severity: 0.8, hours: [7, 8, 9, 17, 18, 19] }, // Étoile
  { lat: 48.8738, lng: 2.2950, severity: 0.9, hours: [8, 9, 17, 18, 19, 20] }, // Porte Maillot
  { lat: 48.8330, lng: 2.3708, severity: 0.7, hours: [8, 9, 17, 18, 19] }, // Place d'Italie
  { lat: 48.8361, lng: 2.2393, severity: 0.8, hours: [8, 9, 17, 18, 19, 20] }, // Porte de Saint-Cloud
];

// Utilise directement l'API Mapbox via fetch
const calculateRoutes = async (origin, destination, options = {}) => {
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

    if (data.routes && data.routes.length > 0) {
      return data.routes.map((route, index) => ({
        ...route,
        id: `route-${index}`,
        geometry: route.geometry,
        duration: route.duration,
        distance: route.distance,
        steps: route.legs[0].steps,
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

// Évaluer les itinéraires en fonction des incidents et du trafic
const evaluateRoutes = async (routes, incidents = []) => {
  if (!routes || routes.length === 0) {
    return { routes: [], scores: [], bestRouteIndex: -1 };
  }

  // Si aucun incident n'est signalé, sélectionner la route la plus rapide
  if (!incidents || incidents.length === 0) {
    const fastestRouteIndex = routes.findIndex(r => 
      r.duration === Math.min(...routes.map(route => route.duration))
    );
    
    return { 
      routes,
      scores: routes.map(r => ({ score: 100, incidents: [] })),
      bestRouteIndex: fastestRouteIndex 
    };
  }

  try {
    // Tableau pour stocker les scores et les incidents par route
    const scores = routes.map(() => ({ score: 100, incidents: [] }));

    // Calculer un score pour chaque route en fonction des incidents à proximité
    routes.forEach((route, routeIndex) => {
      // Créer un buffer autour de la route (500 mètres de chaque côté)
      const routeLine = turf.lineString(route.geometry.coordinates);
      const bufferedRoute = turf.buffer(routeLine, 0.5, { units: 'kilometers' });

      // Vérifier quels incidents se trouvent à proximité de cette route
      const nearbyIncidents = incidents.filter(incident => {
        // Vérifier que l'incident a des coordonnées valides
        if (!incident.coords && !incident.location) return false;
        
        // Déterminer les coordonnées de l'incident
        let coords = incident.coords;
        if (!coords && incident.location) {
          if (Array.isArray(incident.location)) {
            coords = incident.location;
          } else if (incident.location.coordinates && Array.isArray(incident.location.coordinates)) {
            coords = incident.location.coordinates;
          }
        }
        
        if (!coords) return false;
        
        // Vérifier si l'incident est dans le buffer de la route
        const point = turf.point(coords);
        return turf.booleanPointInPolygon(point, bufferedRoute);
      });

      // Affecter un score en fonction des incidents à proximité
      if (nearbyIncidents.length > 0) {
        // Calculer une pénalité en fonction du nombre et du type d'incidents
        const scoreReduction = nearbyIncidents.reduce((total, incident) => {
          // Utiliser un poids par défaut pour les incidents sans type spécifié
          const weight = INCIDENT_WEIGHTS[incident.type] || { severityScore: 15 };
          return total + weight.severityScore;
        }, 0);
        
        // Limiter la réduction de score à 80 points au maximum
        const finalScore = Math.max(20, 100 - Math.min(80, scoreReduction));
        
        scores[routeIndex] = {
          score: finalScore,
          incidents: nearbyIncidents
        };
      }
    });

    // Ajouter l'analyse de trafic basée sur l'heure
    const trafficScores = predictTraffic(routes);
    
    // Combiner les scores d'incidents et de trafic
    const combinedScores = routes.map((route, index) => {
      const incidentScore = scores[index].score;
      const trafficScore = trafficScores[index];
      
      // Pondération : 70% incidents, 30% prédictions de trafic
      return incidentScore * 0.7 + trafficScore * 0.3;
    });
    
    // L'index de la route avec le meilleur score combiné
    const bestRouteIndex = combinedScores.indexOf(Math.max(...combinedScores));
    
    return { routes, scores, bestRouteIndex };
  } catch (error) {
    console.error('Erreur lors de l\'évaluation des routes:', error);
    
    // En cas d'erreur, retourner un résultat par défaut
    const fastestRouteIndex = routes.findIndex(r => 
      r.duration === Math.min(...routes.map(route => route.duration))
    );
    
    return { 
      routes,
      scores: routes.map(r => ({ score: 100, incidents: [] })),
      bestRouteIndex: fastestRouteIndex 
    };
  }
};

// Prédire les conditions de trafic pour chaque itinéraire
const predictTraffic = (routes) => {
  // Récupérer l'heure actuelle
  const now = new Date();
  const currentHour = now.getHours();
  const currentDay = now.getDay(); // 0 = dimanche, 1-5 = lundi-vendredi, 6 = samedi
  const isWeekend = currentDay === 0 || currentDay === 6;
  
  // Déterminer si c'est une heure de pointe
  const isRushHour = (currentHour >= 7 && currentHour <= 9) || (currentHour >= 17 && currentHour <= 19);
  
  // Base pour le score de trafic
  const baseScore = isWeekend ? 80 : (isRushHour ? 60 : 70);
  
  // Calculer un score de trafic pour chaque itinéraire
  return routes.map(route => {
    // Plus la route est longue, plus elle est susceptible d'être affectée par le trafic
    const distanceFactor = Math.min(1, route.distance / 30000); // Normalisé pour 30km
    
    // Calculer le score final (0-100, 100 = parfait)
    const score = baseScore - (distanceFactor * 20);
    
    return Math.max(30, Math.min(100, score));
  });
};

// Suggère un meilleur moment pour partir en fonction des prévisions de trafic
const suggestBetterDepartureTime = (route) => {
    try {
        // Obtenir l'heure actuelle
        const now = new Date();
        const currentHour = now.getHours();
        
        // Tableau pour stocker les résultats
        const timeSuggestions = [];
        
        // Tester différentes heures de départ (jusqu'à 6 heures plus tard)
        for (let hourOffset = 0; hourOffset <= 6; hourOffset++) {
          // Heure de départ testée - STOCKER EN CHAÎNE DE CARACTÈRES
          const departureTimeObj = new Date(now.getTime() + hourOffset * 60 * 60 * 1000);
          const departureTime = departureTimeObj.toISOString(); // Format sérialisable
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
          
          // Calculer l'heure d'arrivée estimée - AUSSI EN CHAÎNE
          const estimatedArrival = new Date(departureTimeObj.getTime() + estimatedDuration * 1000).toISOString();
          
          // Ajouter cette suggestion
          timeSuggestions.push({
            departureTime, // Chaîne de caractères, pas objet Date
            departureTimeDisplay: departureTimeObj.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}),
            departureHour,
            estimatedDuration: Math.floor(estimatedDuration / 60), // En minutes
            estimatedArrival, // Chaîne de caractères
            estimatedArrivalDisplay: new Date(departureTimeObj.getTime() + estimatedDuration * 1000).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}),
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
        // Retourner au moins un tableau vide en cas d'erreur pour éviter les crashes
        return [];
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
  
  // Évaluation d'itinéraires
  evaluateRoutes,
  
  // Analyse du trafic
  predictTraffic,
  
  // Prédictions et suggestions
  suggestBetterDepartureTime,
  
  // Utilitaires
  getRouteColor
};