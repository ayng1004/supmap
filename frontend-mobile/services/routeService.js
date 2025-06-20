// services/routeService.js - Service pour les itinéraires intelligents

import axios from 'axios';
import * as turf from '@turf/turf';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import MapboxGL from '@rnmapbox/maps';

// Configuration de l'API
const API_BASE_URL = Platform.OS === 'android'
  ? 'http://10.0.2.2:3001/api'  // Émulateur Android
  : 'http://localhost:3001/api'; // iOS

// Configuration Mapbox
const MAPBOX_ACCESS_TOKEN = MapboxGL.accessToken;
const MAPBOX_DIRECTIONS_URL = 'https://api.mapbox.com/directions/v5';
const MAPBOX_DRIVING_PROFILE = 'mapbox/driving';

// Constantes pour les prédictions et l'analyse de trafic
const TRAFFIC_ANALYSIS_RANGE = {
  WORKDAY_MORNING_RUSH: { start: 7, end: 10 },  // Heures de pointe du matin (7h-10h)
  WORKDAY_EVENING_RUSH: { start: 16, end: 19 }, // Heures de pointe du soir (16h-19h)
  WEEKEND_MIDDAY: { start: 11, end: 15 },       // Milieu de journée le weekend (11h-15h)
};

// Service pour les itinéraires
const routeService = {
  /**
   * Calcule plusieurs itinéraires alternatifs entre deux points
   * @param {Array} origin - Coordonnées [longitude, latitude] du point de départ
   * @param {Array} destination - Coordonnées [longitude, latitude] de la destination
   * @param {Object} options - Options pour le calcul d'itinéraire
   * @returns {Promise} - Promise contenant les itinéraires
   */
  calculateRoutes: async (origin, destination, options = {}) => {
    try {
      // Configuration pour l'API Mapbox Directions
      const queryParams = new URLSearchParams({
        alternatives: 'true',
        geometries: 'geojson',
        steps: 'true',
        overview: 'full',
        annotations: 'duration,distance,speed,congestion',
        language: 'fr',
        access_token: MAPBOX_ACCESS_TOKEN
      });

      // Ajouter les options d'évitement si nécessaires
      if (options.avoidTolls) queryParams.append('exclude', 'toll');
      if (options.avoidHighways) queryParams.append('exclude', options.avoidTolls ? 'toll,motorway' : 'motorway');
      if (options.avoidFerries) queryParams.append('exclude', queryParams.get('exclude') ? queryParams.get('exclude') + ',ferry' : 'ferry');

      // Construire l'URL complète
      const url = `${MAPBOX_DIRECTIONS_URL}/${MAPBOX_DRIVING_PROFILE}/${origin[0]},${origin[1]};${destination[0]},${destination[1]}?${queryParams.toString()}`;

      // Faire la requête à l'API
      const response = await axios.get(url);

      if (response.data.routes && response.data.routes.length > 0) {
        return response.data.routes.map((route, index) => ({
          ...route,
          id: `route-${index}`,
          name: `Itinéraire ${index + 1}`,
          color: routeService.getRouteColor(index)
        }));
      } else {
        throw new Error('Aucun itinéraire trouvé');
      }
    } catch (error) {
      console.error('Erreur lors du calcul des itinéraires:', error);
      throw error;
    }
  },

  /**
   * Évalue les itinéraires en fonction des incidents et des prédictions de trafic
   * @param {Array} routes - Liste des itinéraires à évaluer
   * @param {Array} incidents - Liste des incidents à prendre en compte
   * @returns {Object} - Objet contenant les routes évaluées et le meilleur choix
   */
  evaluateRoutes: async (routes, incidents) => {
    try {
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
            const severityPenalty = routeService.getIncidentSeverityPenalty(incident.type);
            return total + severityPenalty;
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
      const trafficScores = await routeService.analyzeTrafficPatterns(routes);
      
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
      console.error('Erreur lors de l\'évaluation des itinéraires:', error);
      // En cas d'erreur, retourner les routes sans évaluation
      return { 
        routes, 
        scores: routes.map(() => ({ score: 100, incidents: [] })),
        bestRouteIndex: 0 
      };
    }
  },

  /**
   * Analyse les schémas de trafic en fonction de l'heure actuelle
   * @param {Array} routes - Liste des itinéraires à analyser
   * @returns {Array} - Tableau de scores de trafic pour chaque itinéraire
   */
  analyzeTrafficPatterns: async (routes) => {
    try {
      // Récupérer l'heure et le jour actuels
      const now = new Date();
      const hour = now.getHours();
      const day = now.getDay(); // 0 = dimanche, 1-5 = lundi-vendredi, 6 = samedi
      const isWeekend = day === 0 || day === 6;
      
      // Déterminer si nous sommes dans une période de pointe
      let isRushHour = false;
      if (!isWeekend) {
        // Jours de semaine
        if (hour >= TRAFFIC_ANALYSIS_RANGE.WORKDAY_MORNING_RUSH.start && 
            hour <= TRAFFIC_ANALYSIS_RANGE.WORKDAY_MORNING_RUSH.end) {
          isRushHour = true;
        } else if (hour >= TRAFFIC_ANALYSIS_RANGE.WORKDAY_EVENING_RUSH.start && 
                   hour <= TRAFFIC_ANALYSIS_RANGE.WORKDAY_EVENING_RUSH.end) {
          isRushHour = true;
        }
      } else {
        // Weekend
        if (hour >= TRAFFIC_ANALYSIS_RANGE.WEEKEND_MIDDAY.start && 
            hour <= TRAFFIC_ANALYSIS_RANGE.WEEKEND_MIDDAY.end) {
          isRushHour = true;
        }
      }
      
      // Récupérer les données historiques de trafic (simulées ici)
      const trafficHistoryData = await routeService.fetchHistoricalTrafficData();
      
      // Calculer un score de trafic pour chaque itinéraire
      return routes.map(route => {
        // Vérifier si la route passe par des zones de trafic dense en période de pointe
        if (isRushHour) {
          // Pénaliser les routes principales pendant les heures de pointe
          const mainRoadPenalty = route.distance > 10000 ? 20 : 10;
          
          // Vérifier si la route passe par des zones connues pour être congestionnées
          const congestionPoints = route.geometry.coordinates.filter(coord => {
            return trafficHistoryData.some(point => {
              // Vérifier si les coordonnées sont proches d'un point de congestion connu
              const distance = turf.distance(
                turf.point(coord),
                turf.point([point.lng, point.lat]),
                { units: 'kilometers' }
              );
              return distance < 0.5; // Moins de 500 mètres
            });
          });
          
          // Calculer une pénalité basée sur le nombre de points de congestion
          const congestionPenalty = congestionPoints.length * 5;
          
          // Calculer le score final
          return Math.max(50, 100 - mainRoadPenalty - congestionPenalty);
        }
        
        // En dehors des heures de pointe, score élevé pour toutes les routes
        return 90;
      });
    } catch (error) {
      console.error('Erreur lors de l\'analyse des schémas de trafic:', error);
      // En cas d'erreur, retourner des scores neutres
      return routes.map(() => 80);
    }
  },

  /**
   * Récupère les données historiques de trafic (simulation)
   * @returns {Array} - Données de trafic
   */
  fetchHistoricalTrafficData: async () => {
    // Dans une application réelle, ces données viendraient d'une API
    // Pour l'exemple, nous utilisons des points de congestion fictifs
    return [
      { lat: 48.8567, lng: 2.3508, congestionLevel: 8 }, // Paris
      { lat: 48.8667, lng: 2.3333, congestionLevel: 7 }, // Paris Nord
      { lat: 48.8710, lng: 2.3491, congestionLevel: 9 }, // Grand Boulevard
      { lat: 48.8552, lng: 2.3708, congestionLevel: 6 }, // Bastille
      { lat: 48.8738, lng: 2.2950, congestionLevel: 8 }, // Arc de Triomphe
      { lat: 48.8810, lng: 2.3558, congestionLevel: 7 }, // Montmartre
    ];
  },

  /**
   * Analyse l'impact des incidents sur un itinéraire
   * @param {Object} route - Route à analyser
   * @param {Array} incidents - Incidents à évaluer
   * @returns {Object} - Analyse des impacts
   */
  analyzeIncidentImpact: (route, incidents) => {
    if (!route || !incidents || incidents.length === 0) {
      return { impactLevel: 'none', estimatedDelay: 0 };
    }
    
    // Créer une ligne pour la route
    const routeLine = turf.lineString(route.geometry.coordinates);
    
    // Trouver les incidents qui ont un impact sur cet itinéraire
    const relevantIncidents = incidents.filter(incident => {
      // Vérifier que l'incident a des coordonnées valides
      if (!incident.coords && !incident.location) return false;
      
      // Obtenir les coordonnées
      let coords = incident.coords;
      if (!coords && incident.location) {
        if (Array.isArray(incident.location)) {
          coords = incident.location;
        } else if (incident.location.coordinates && Array.isArray(incident.location.coordinates)) {
          coords = incident.location.coordinates;
        }
      }
      
      if (!coords) return false;
      
      // Calculer la distance entre l'incident et la route
      const point = turf.point(coords);
      const distance = turf.pointToLineDistance(point, routeLine, { units: 'kilometers' });
      
      // Considérer l'incident comme pertinent s'il est à moins de 500 mètres de la route
      return distance < 0.5;
    });
    
    if (relevantIncidents.length === 0) {
      return { impactLevel: 'none', estimatedDelay: 0 };
    }
    
    // Calculer l'impact total
    let totalSeverity = 0;
    relevantIncidents.forEach(incident => {
      totalSeverity += routeService.getIncidentSeverityPenalty(incident.type);
    });
    
    // Déterminer le niveau d'impact
    let impactLevel, estimatedDelay;
    if (totalSeverity < 20) {
      impactLevel = 'faible';
      estimatedDelay = Math.ceil(route.duration * 0.1 / 60); // 10% de retard en minutes
    } else if (totalSeverity < 40) {
      impactLevel = 'modéré';
      estimatedDelay = Math.ceil(route.duration * 0.25 / 60); // 25% de retard en minutes
    } else {
      impactLevel = 'élevé';
      estimatedDelay = Math.ceil(route.duration * 0.5 / 60); // 50% de retard en minutes
    }
    
    return {
      impactLevel,
      estimatedDelay,
      incidents: relevantIncidents
    };
  },

  /**
   * Obtient la pénalité de sévérité pour un type d'incident
   * @param {string} incidentType - Type d'incident
   * @returns {number} - Pénalité de sévérité
   */
  getIncidentSeverityPenalty: (incidentType) => {
    const penalties = {
      'accident': 30, // Les accidents sont graves
      'closure': 40,  // Fermetures de routes très graves
      'hazard': 25,   // Dangers modérément graves
      'police': 15,   // Contrôles de police moins graves
      'traffic': 20,  // Embouteillages modérément graves
    };
    
    return penalties[incidentType] || 15; // Pénalité par défaut
  },

  /**
   * Obtient une couleur pour un itinéraire en fonction de son index
   * @param {number} index - Index de l'itinéraire
   * @returns {string} - Couleur au format hexadécimal
   */
  getRouteColor: (index) => {
    const colors = ['#3887be', '#FF9500', '#34C759', '#5856D6', '#FF2D55'];
    return colors[index % colors.length];
  }
};

export default routeService;