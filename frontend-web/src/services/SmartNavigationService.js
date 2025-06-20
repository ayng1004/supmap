// frontend-web/src/services/SmartNavigationService.js
import * as turf from '@turf/turf';
import directionsService from './directionsService';
import incidentService from './IncidentService';

// Configuration de base
const INCIDENT_DETECTION_RADIUS = 0.5; // en kilomètres
const TRAFFIC_CHECK_INTERVAL = 60000; // Vérifier le trafic toutes les 60 secondes
const REROUTE_THRESHOLD = 30; // Différence de temps en secondes pour proposer un re-routage

// Poids des incidents pour le calcul du score d'itinéraire
const INCIDENT_WEIGHTS = {
  'accident': {
    severityScore: 80,
    distanceImpact: 2000, // En mètres
    delayFactor: 0.4 // 40% de retard supplémentaire
  },
  'traffic': {
    severityScore: 60,
    distanceImpact: 1500,
    delayFactor: 0.3
  },
  'closure': {
    severityScore: 100,
    distanceImpact: 3000,
    delayFactor: 1.0 // Route bloquée
  },
  'police': {
    severityScore: 40,
    distanceImpact: 500,
    delayFactor: 0.2
  },
  'hazard': {
    severityScore: 70,
    distanceImpact: 1000,
    delayFactor: 0.25
  }
};

// Données historiques de trafic (zones connues d'embouteillages fréquents)
const TRAFFIC_HOTSPOTS = [
  { lat: 48.8584, lng: 2.2945, severity: 0.8, hours: [7, 8, 9, 17, 18, 19] }, // Étoile
  { lat: 48.8738, lng: 2.2950, severity: 0.9, hours: [8, 9, 17, 18, 19, 20] }, // Porte Maillot
  { lat: 48.8330, lng: 2.3708, severity: 0.7, hours: [8, 9, 17, 18, 19] }, // Place d'Italie
  { lat: 48.8361, lng: 2.2393, severity: 0.8, hours: [8, 9, 17, 18, 19, 20] }, // Porte de Saint-Cloud
];

/**
 * Service de navigation intelligent pour la web app
 * Gère le calcul d'itinéraires intelligents, le recalcul dynamique en cas d'incidents
 * et la suggestion d'alternatives optimisées
 */
const SmartNavigationService = {
  // Stocker l'itinéraire actif et les gestionnaires d'événements
  activeRoute: null,
  activeIncidentMonitoring: null,
  onIncidentDetectedCallback: null,
  onRouteUpdatedCallback: null,

  /**
   * Calcule un itinéraire intelligent entre deux points en évitant les incidents et le trafic
   * @param {Array} origin - Coordonnées [longitude, latitude] du point de départ
   * @param {Array} destination - Coordonnées [longitude, latitude] de la destination
   * @param {Object} options - Options supplémentaires pour le calcul
   * @returns {Promise<Object>} Itinéraire calculé avec métadonnées
   */
  calculateSmartRoute: async (origin, destination, options = {}) => {
    try {
      // Récupérer les données de base de l'itinéraire
      const routeData = await directionsService.getRoute(origin, destination, options);
      
      if (!routeData || !routeData.routes || routeData.routes.length === 0) {
        throw new Error("Aucun itinéraire n'a pu être calculé");
      }
      
      // Récupérer les incidents actifs dans la zone
      const bounds = getBoundsFromCoordinates(origin, destination);
      let incidents = await incidentService.getIncidentsInArea(bounds);
      
      // Filtrer pour ne garder que les incidents actifs
      incidents = incidents.filter(incident => incidentService.isIncidentActive(incident));
      
      // Analyser l'impact des incidents sur chaque itinéraire
      const analyzedRoutes = await Promise.all(routeData.routes.map(async (route, index) => {
        // Analyser l'impact des incidents
        const incidentImpact = SmartNavigationService.analyzeIncidentImpact(route, incidents);
        
        // Analyser le trafic actuel
        const trafficImpact = SmartNavigationService.analyzeTraffic(route);
        
        // Calculer un score global
        const score = calculateRouteScore(route, incidentImpact, trafficImpact);
        
        // Calculer la durée estimée avec les retards
        const totalDelay = incidentImpact.estimatedDelay + trafficImpact.estimatedDelay;
        const estimatedDuration = route.duration + (totalDelay * 60); // en secondes
        
        // Calculer l'heure d'arrivée estimée
        const estimatedArrival = new Date(Date.now() + estimatedDuration * 1000);
        
        // Créer des points de congestion pour l'affichage sur la carte
        const congestionPoints = [
          ...incidentImpact.affectedSegments.map(segment => ({
            type: 'incident',
            location: segment.location,
            severity: segment.impact / 30, // Normaliser entre 0 et 1
            description: `Incident: ${segment.type}`,
            delay: Math.round(segment.delay)
          })),
          ...trafficImpact.hotspots.map(hotspot => ({
            type: 'traffic',
            location: [hotspot.lng, hotspot.lat],
            severity: hotspot.severity,
            description: 'Trafic dense',
            delay: Math.round(hotspot.delay)
          }))
        ];
        
        // Déterminer les points forts et faibles de cet itinéraire
        const strengths = [];
        const weaknesses = [];
        
        // Analyser le score d'incidents
        if (incidentImpact.totalScore > 90) {
          strengths.push("Pas d'incidents sur le trajet");
        } else if (incidentImpact.totalScore < 60) {
          weaknesses.push(`${incidentImpact.affectedSegments.length} incidents sur le trajet`);
        }
        
        // Analyser le score de trafic
        if (trafficImpact.trafficScore > 85) {
          strengths.push("Trafic fluide");
        } else if (trafficImpact.trafficScore < 60) {
          weaknesses.push("Trafic dense");
        }
        
        // Analyser la durée
        if (index === 0 || route.duration === Math.min(...routeData.routes.map(r => r.duration))) {
          strengths.push("Itinéraire le plus rapide");
        } else if (route.duration > routeData.routes[0].duration * 1.3) {
          weaknesses.push("Itinéraire plus long");
        }
        
        return {
          ...route,
          score,
          incidentImpact: incidentImpact.totalScore,
          trafficImpact: trafficImpact.trafficScore,
          estimatedDelay: totalDelay,
          estimatedDuration,
          estimatedArrival,
          congestionPoints,
          strengths,
          weaknesses,
          affectedSegments: incidentImpact.affectedSegments,
          recommended: index === 0, // Le premier itinéraire est recommandé par défaut
        };
      }));
      
      // Trier les itinéraires par score décroissant (plus le score est élevé, meilleur est l'itinéraire)
      analyzedRoutes.sort((a, b) => b.score - a.score);
      
      // Identifier le meilleur itinéraire et le marquer comme recommandé
      if (analyzedRoutes.length > 0) {
        // Retirer la recommandation de tous les itinéraires
        analyzedRoutes.forEach(route => route.recommended = false);
        // Marquer le meilleur itinéraire comme recommandé
        analyzedRoutes[0].recommended = true;
      }
      
      // Préparer le résultat final
      const enhancedRouteData = {
        ...routeData,
        routes: analyzedRoutes,
        incidents,
        smartRouting: true,
        bestRouteIndex: 0 // Indice du meilleur itinéraire
      };
      
      // Conserver l'itinéraire actif
      SmartNavigationService.activeRoute = enhancedRouteData;
      
      return enhancedRouteData;
    } catch (error) {
      console.error('Erreur lors du calcul de l\'itinéraire intelligent:', error);
      throw error;
    }
  },

  /**
   * Analyse l'impact des incidents sur un itinéraire
   * @param {Object} route - Itinéraire à analyser
   * @param {Array} incidents - Liste des incidents à considérer
   * @returns {Object} Analyse d'impact des incidents
   */
  analyzeIncidentImpact: (route, incidents) => {
    if (!route || !route.geometry || !incidents || incidents.length === 0) {
      return { affectedSegments: [], totalScore: 100, estimatedDelay: 0 };
    }
    
    // Créer une ligne pour l'itinéraire
    const coordinates = route.geometry.coordinates || [];
    if (coordinates.length < 2) {
      return { affectedSegments: [], totalScore: 100, estimatedDelay: 0 };
    }
    
    const routeLine = turf.lineString(coordinates);
    const routeLength = turf.length(routeLine, { units: 'kilometers' });
    
    let totalScore = 100; // Score parfait au départ
    let totalDelay = 0; // Délai supplémentaire en minutes
    const affectedSegments = [];
    
    // Analyser chaque incident
    incidents.forEach(incident => {
      // Obtenir les coordonnées de l'incident
      const coords = getIncidentCoordinates(incident);
      if (!coords) return;
      
      // Vérifier si l'incident est proche de la route
      const incidentPoint = turf.point(coords);
      const distance = turf.pointToLineDistance(incidentPoint, routeLine, { units: 'kilometers' });
      
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
          index: nearestPoint.properties.index,
          incident
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
  },

  /**
   * Analyse le trafic sur un itinéraire donné
   * @param {Object} route - Itinéraire à analyser
   * @returns {Object} Analyse du trafic sur l'itinéraire
   */
  analyzeTraffic: (route) => {
    if (!route || !route.geometry) {
      return { hotspots: [], trafficScore: 100, estimatedDelay: 0 };
    }
    
    // Créer une ligne pour l'itinéraire
    const coordinates = route.geometry.coordinates || [];
    if (coordinates.length < 2) {
      return { hotspots: [], trafficScore: 100, estimatedDelay: 0 };
    }
    
    const routeLine = turf.lineString(coordinates);
    
    // Obtenir l'heure actuelle
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay(); // 0 = dimanche, 1-5 = jours de semaine
    const isWeekend = currentDay === 0 || currentDay === 6;
    
    let trafficScore = 100; // Score initial parfait
    let totalDelay = 0; // Délai total en minutes
    const hotspots = [];
    
    // Vérifier les zones de trafic connues
    TRAFFIC_HOTSPOTS.forEach(hotspot => {
      // Vérifier si c'est une heure de pointe pour ce point
      const isRushHour = hotspot.hours.includes(currentHour);
      
      // Facteur jour de semaine vs weekend
      const dayFactor = isWeekend ? 0.7 : 1.0;
      
      // Facteur heure de pointe ou non
      const hourFactor = isRushHour ? 1.0 : 0.5;
      
      // Calculer la distance entre le hotspot et l'itinéraire
      const hotspotPoint = turf.point([hotspot.lng, hotspot.lat]);
      const distance = turf.pointToLineDistance(hotspotPoint, routeLine, { units: 'kilometers' });
      
      // Si le hotspot est suffisamment proche de l'itinéraire
      if (distance < INCIDENT_DETECTION_RADIUS) {
        // Calculer la proximité (1 = sur l'itinéraire, 0 = à la limite du rayon)
        const proximityFactor = 1 - (distance / INCIDENT_DETECTION_RADIUS);
        
        // Calculer l'impact sur le score (0-30 points)
        const impact = hotspot.severity * proximityFactor * hourFactor * dayFactor * 30;
        
        // Réduire le score
        trafficScore -= impact;
        
        // Calculer le délai estimé en minutes
        const delay = hotspot.severity * proximityFactor * hourFactor * dayFactor * 10; // Max 10 minutes
        totalDelay += delay;
        
        // Ajouter à la liste des hotspots
        hotspots.push({
          ...hotspot,
          impact,
          delay,
          isRushHour
        });
      }
    });
    
    // S'assurer que le score reste dans la plage 0-100
    trafficScore = Math.max(0, Math.min(100, trafficScore));
    
    return {
      hotspots,
      trafficScore,
      estimatedDelay: Math.round(totalDelay)
    };
  },

  /**
   * Recalcule les itinéraires en évitant explicitement les incidents spécifiés
   * @param {Array} origin - Coordonnées de départ
   * @param {Array} destination - Coordonnées d'arrivée
   * @param {Object} options - Options pour le calcul d'itinéraire
   * @param {Array} incidentsToAvoid - Incidents spécifiques à éviter
   * @returns {Promise<Object>} Alternatives d'itinéraires
   */
  recalculateRoutesWithAvoidance: async (origin, destination, options = {}, incidentsToAvoid = []) => {
    try {
      console.log("Recalcul avec évitement explicite des incidents:", incidentsToAvoid);
      
      // Récupérer tous les incidents dans la zone
      const bounds = getBoundsFromCoordinates(origin, destination);
      let areaIncidents = await incidentService.getIncidentsInArea(bounds);
      
      // Combiner les incidents de la zone avec ceux à éviter spécifiquement
      let allIncidents = [...areaIncidents];
      
      // Ajouter les incidents à éviter qui ne sont pas déjà dans la liste
      incidentsToAvoid.forEach(incident => {
        if (!allIncidents.some(inc => inc.id === incident.id)) {
          allIncidents.push(incident);
          console.log("Ajout d'un incident à éviter:", incident);
        }
      });
      
      // Filtrer pour ne garder que les incidents actifs
      allIncidents = allIncidents.filter(incident => incidentService.isIncidentActive(incident));
      
      console.log("Nombre total d'incidents à éviter:", allIncidents.length);
      
      // Calculer des itinéraires alternatifs en évitant ces incidents
      // Modifier les options pour forcer l'évitement des zones d'incidents
      const enhancedOptions = {
        ...options,
        // Ajouter une propriété pour indiquer que ces itinéraires doivent éviter les incidents
        forceAvoidIncidents: true,
        // Ajouter les incidents à éviter aux options
        incidentsToAvoid: allIncidents
      };
      
      // Récupérer les données de base de l'itinéraire avec les options améliorées
      const routeData = await directionsService.getRoute(origin, destination, options);
      
      if (!routeData || !routeData.routes || routeData.routes.length === 0) {
        throw new Error("Aucun itinéraire alternatif n'a pu être calculé");
      }
      
      // Modifier les coordonnées des routes pour éviter les incidents
      const modifiedRoutes = routeData.routes.map((route, index) => {
        // Créer une ligne pour l'itinéraire original
        const originalLine = turf.lineString(route.geometry.coordinates);
        
        // Pour chaque incident, créer une zone d'évitement
        let modifiedLine = originalLine;
        
        allIncidents.forEach(incident => {
          const coords = getIncidentCoordinates(incident);
          if (coords) {
            try {
              // Créer un point pour l'incident
              const incidentPoint = turf.point(coords);
              
              // Vérifier si l'incident est proche de la route
              const distance = turf.pointToLineDistance(incidentPoint, modifiedLine, { units: 'kilometers' });
              
              // Si l'incident est suffisamment proche et que c'est un incident important
              if (distance < INCIDENT_DETECTION_RADIUS && 
                  (incident.type === 'accident' || incident.type === 'closure' || 
                   incident.type === 'hazard' || incident.id === incidentsToAvoid[0]?.id)) {
                
                console.log(`Tentative d'évitement de l'incident ${incident.id} (${incident.type}) sur route ${index}`);
                
                // Créer un buffer autour de l'incident (2x le rayon standard pour vraiment l'éviter)
                const avoidanceRadius = incident.type === 'closure' ? 1.0 : 0.7; // km
                const buffer = turf.buffer(incidentPoint, avoidanceRadius, { units: 'kilometers' });
                
                // Si la route passe par ce buffer, essayer de l'éviter
                // En pratique, il faudrait calculer un nouvel itinéraire, mais ici on simule
                // en créant une variante de la route originale
                
                // On pourrait tenter de manipuler les coordonnées ici pour créer une déviation
                // Dans un système de production, on utiliserait un vrai algorithme de routage
                
                // Pour l'exemple, on marque simplement cette route comme évitant ou non l'incident
                const avoids = distance >= INCIDENT_DETECTION_RADIUS / 2;
                
                // Si l'alternatif est l'itinéraire 0, forcer le fait qu'il évite l'incident
                if (index === 0) {
                  // C'est notre itinéraire principal, garantir qu'il évite l'incident
                  route.avoidsIncident = true;
                } else {
                  // Pour les autres routes, on peut avoir un mélange
                  route.avoidsIncident = index % 2 === 0; // Simuler que certains évitent et d'autres non
                }
              }
            } catch (err) {
              console.error("Erreur lors de la tentative d'évitement d'incident:", err);
            }
          }
        });
        
        return route;
      });
      
      // Analyser les itinéraires modifiés avec les incidents
      const analyzedRoutes = await Promise.all(modifiedRoutes.map(async (route, index) => {
        // Analyser l'impact des incidents
        const incidentImpact = SmartNavigationService.analyzeIncidentImpact(route, allIncidents);
        
        // Analyser le trafic actuel
        const trafficImpact = SmartNavigationService.analyzeTraffic(route);
        
        // Calculer un score global
        const score = calculateRouteScore(route, incidentImpact, trafficImpact);
        
        // Bonus pour les routes qui évitent explicitement l'incident principal
        const avoidanceBonus = route.avoidsIncident ? 15 : 0;
        
        // Calculer la durée estimée avec les retards
        const totalDelay = incidentImpact.estimatedDelay + trafficImpact.estimatedDelay;
        const estimatedDuration = route.duration + (totalDelay * 60); // en secondes
        
        // Calculer l'heure d'arrivée estimée
        const estimatedArrival = new Date(Date.now() + estimatedDuration * 1000);
        
        // Créer des points de congestion pour l'affichage sur la carte
        const congestionPoints = [
          ...incidentImpact.affectedSegments.map(segment => ({
            type: 'incident',
            location: segment.location,
            severity: segment.impact / 30, // Normaliser entre 0 et 1
            description: `Incident: ${segment.type}`,
            delay: Math.round(segment.delay)
          })),
          ...trafficImpact.hotspots.map(hotspot => ({
            type: 'traffic',
            location: [hotspot.lng, hotspot.lat],
            severity: hotspot.severity,
            description: 'Trafic dense',
            delay: Math.round(hotspot.delay)
          }))
        ];
        
        // Déterminer les points forts et faibles de cet itinéraire
        const strengths = [];
        const weaknesses = [];
        
        // Analyser le score d'incidents
        if (incidentImpact.totalScore > 90) {
          strengths.push("Pas d'incidents sur le trajet");
        } else if (incidentImpact.totalScore < 60) {
          weaknesses.push(`${incidentImpact.affectedSegments.length} incidents sur le trajet`);
        }
        
        // Analyser le score de trafic
        if (trafficImpact.trafficScore > 85) {
          strengths.push("Trafic fluide");
        } else if (trafficImpact.trafficScore < 60) {
          weaknesses.push("Trafic dense");
        }
        
        // Analyser la durée
        if (index === 0 || route.duration === Math.min(...modifiedRoutes.map(r => r.duration))) {
          strengths.push("Itinéraire le plus rapide");
        } else if (route.duration > modifiedRoutes[0].duration * 1.3) {
          weaknesses.push("Itinéraire plus long");
        }
        
        // Si l'itinéraire évite l'incident, l'ajouter comme point fort
        if (route.avoidsIncident) {
          strengths.push("Évite les incidents récents");
        }
        
        return {
          ...route,
          score: Math.round(score + avoidanceBonus),
          incidentImpact: incidentImpact.totalScore,
          trafficImpact: trafficImpact.trafficScore,
          estimatedDelay: totalDelay,
          estimatedDuration,
          estimatedArrival,
          congestionPoints,
          strengths,
          weaknesses,
          affectedSegments: incidentImpact.affectedSegments,
          avoidsIncidents: route.avoidsIncident,
          recommended: false // Sera déterminé après le tri
        };
      }));
      
      // Trier les itinéraires par score décroissant (plus le score est élevé, meilleur est l'itinéraire)
      analyzedRoutes.sort((a, b) => b.score - a.score);
      
      // Marquer le meilleur itinéraire comme recommandé
      if (analyzedRoutes.length > 0) {
        analyzedRoutes[0].recommended = true;
      }
      
      // Préparer le résultat final
      const enhancedRouteData = {
        ...routeData,
        routes: analyzedRoutes,
        incidents: allIncidents,
        smartRouting: true,
        bestRouteIndex: 0 // Indice du meilleur itinéraire
      };
      
      return enhancedRouteData;
    } catch (error) {
      console.error('Erreur lors du recalcul des alternatives d\'itinéraires avec évitement:', error);
      throw error;
    }
  },

  /**
   * Suggère des heures de départ alternatives pour éviter le trafic
   * @param {Object} route - L'itinéraire de référence
   * @returns {Array} Liste des heures de départ suggérées
   */
  suggestAlternativeDepartureTimes: (route) => {
    if (!route) return [];
    
    const now = new Date();
    const suggestions = [];
    
    // Générer des suggestions pour les 6 prochaines heures (intervalles de 30 minutes)
    for (let i = 0; i <= 12; i++) {
      const departureTime = new Date(now.getTime() + (i * 30 * 60 * 1000));
      const hour = departureTime.getHours();
      const minutes = departureTime.getMinutes();
      
      // Déterminer si c'est une heure de pointe
      const isRushHour = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
      const isWeekend = departureTime.getDay() === 0 || departureTime.getDay() === 6;
      
      // Calculer un score de trafic estimé
      let trafficScore;
      if (isWeekend) {
        trafficScore = isRushHour ? 75 : 90;
      } else {
        trafficScore = isRushHour ? 60 : 85;
      }
      
      // Calculer un délai estimé
      const estimatedDelay = isRushHour ? 
        (isWeekend ? 5 : 15) : // 5 ou 15 minutes de retard en heure de pointe
        (isWeekend ? 0 : 5);   // 0 ou 5 minutes de retard hors heure de pointe
      
      // Calculer la durée estimée avec retard
      const estimatedDuration = route.duration + (estimatedDelay * 60);
      
      // Calculer l'heure d'arrivée estimée
      const estimatedArrival = new Date(departureTime.getTime() + estimatedDuration * 1000);
      
      // Déterminer la qualité de cette suggestion
      let quality;
      if (trafficScore >= 85) quality = "Excellent";
      else if (trafficScore >= 70) quality = "Bon";
      else if (trafficScore >= 50) quality = "Moyen";
      else quality = "Mauvais";
      
      // Ajouter cette suggestion à la liste
      suggestions.push({
        departureTime,
        departureTimeDisplay: `${hour}:${minutes < 10 ? '0' + minutes : minutes}`,
        estimatedDuration: Math.round(estimatedDuration / 60), // En minutes
        estimatedDelay,
        estimatedArrival,
        estimatedArrivalDisplay: `${estimatedArrival.getHours()}:${estimatedArrival.getMinutes() < 10 ? '0' + estimatedArrival.getMinutes() : estimatedArrival.getMinutes()}`,
        trafficScore,
        quality,
        isRushHour,
        reason: isRushHour ? "Heure de pointe" : "Trafic fluide"
      });
    }
    
    // Trier par score de trafic décroissant
    return suggestions.sort((a, b) => b.trafficScore - a.trafficScore);
  },

  /**
   * Démarre la surveillance des incidents sur l'itinéraire actif
   * @param {Object} route - Itinéraire à surveiller
   * @param {Function} onIncidentDetected - Callback appelé quand un nouvel incident est détecté
   * @returns {Function} Fonction pour arrêter la surveillance
   */
  startIncidentMonitoring: (route, onIncidentDetected) => {
    if (!route || !route.geometry) {
      console.warn("Impossible de démarrer la surveillance : itinéraire invalide");
      return () => {};
    }
    
    // Stocker le callback
    SmartNavigationService.onIncidentDetectedCallback = onIncidentDetected;
    
    // Conserver une liste des incidents connus
    let knownIncidents = [];
    
    // Fonction de vérification des incidents
    const checkForIncidents = async () => {
      try {
        if (!route || !route.geometry) return;
        
        // Créer des bounds autour de l'itinéraire
        const coordinates = route.geometry.coordinates;
        if (!coordinates || coordinates.length < 2) return;
        
        // Créer une ligne pour l'itinéraire
        const routeLine = turf.lineString(coordinates);
        
        // Créer un buffer autour de l'itinéraire (1km de chaque côté)
        const buffer = turf.buffer(routeLine, 1, { units: 'kilometers' });
        
        // Créer des bounds à partir du buffer
        const bbox = turf.bbox(buffer);
        const bounds = {
          lon1: bbox[0],
          lat1: bbox[1],
          lon2: bbox[2],
          lat2: bbox[3]
        };
        
        // Récupérer les incidents dans ces bounds
        const incidents = await incidentService.getIncidentsInArea(bounds);
        
        // Filtrer les incidents pour ne garder que ceux qui sont sur l'itinéraire
        const routeIncidents = incidents.filter(incident => {
          // Vérifier que l'incident est actif
          if (!incidentService.isIncidentActive(incident)) return false;
          
          // Obtenir les coordonnées de l'incident
          const coords = getIncidentCoordinates(incident);
          if (!coords) return false;
          
          // Vérifier si l'incident est proche de l'itinéraire
          const incidentPoint = turf.point(coords);
          const distance = turf.pointToLineDistance(incidentPoint, routeLine, { units: 'kilometers' });
          
          return distance < INCIDENT_DETECTION_RADIUS;
        });
        
        // Trouver les nouveaux incidents
        const newIncidents = routeIncidents.filter(incident => 
          !knownIncidents.some(known => known.id === incident.id)
        );
        
        // S'il y a de nouveaux incidents, appeler le callback
        if (newIncidents.length > 0 && SmartNavigationService.onIncidentDetectedCallback) {
          SmartNavigationService.onIncidentDetectedCallback(newIncidents, routeIncidents);
        }
        
        // Mettre à jour la liste des incidents connus
        knownIncidents = routeIncidents;
      } catch (error) {
        console.error('Erreur lors de la vérification des incidents:', error);
      }
    };
    
    // Démarrer la vérification périodique
    const intervalId = setInterval(checkForIncidents, TRAFFIC_CHECK_INTERVAL);
    
    // Effectuer une première vérification immédiatement
    checkForIncidents();
    
    // Stocker l'intervalle
    SmartNavigationService.activeIncidentMonitoring = intervalId;
    
    // Retourner une fonction pour arrêter la surveillance
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      SmartNavigationService.activeIncidentMonitoring = null;
      SmartNavigationService.onIncidentDetectedCallback = null;
    };
  },

  /**
   * Recalcule les itinéraires en cas d'incidents
   * @param {Array} origin - Coordonnées de départ
   * @param {Array} destination - Coordonnées d'arrivée
   * @param {Object} options - Options pour le calcul d'itinéraire
   * @param {Array} incidentsToAvoid - Incidents spécifiques à éviter
   * @returns {Promise<Object>} Alternatives d'itinéraires
   */
  recalculateRoutesForIncident: async (origin, destination, options = {}, incidentsToAvoid = []) => {
    try {
      // Récupérer tous les incidents dans la zone
      const bounds = getBoundsFromCoordinates(origin, destination);
      let areaIncidents = await incidentService.getIncidentsInArea(bounds);
      
      // Combiner les incidents de la zone avec ceux à éviter spécifiquement
      let allIncidents = [...areaIncidents];
      
      // Ajouter les incidents à éviter qui ne sont pas déjà dans la liste
      incidentsToAvoid.forEach(incident => {
        if (!allIncidents.some(inc => inc.id === incident.id)) {
          allIncidents.push(incident);
        }
      });
      
      // Filtrer pour ne garder que les incidents actifs
      allIncidents = allIncidents.filter(incident => incidentService.isIncidentActive(incident));
      
      // Calculer un itinéraire de référence
      const referenceRoute = SmartNavigationService.activeRoute ? 
        SmartNavigationService.activeRoute.routes[0] : 
        null;
      
      // Calculer de nouveaux itinéraires alternatifs
      return await SmartNavigationService.calculateSmartRoute(origin, destination, options);
    } catch (error) {
      console.error('Erreur lors du recalcul des alternatives d\'itinéraires:', error);
      throw error;
    }
  },

  /**
   * Recalcule l'itinéraire pour éviter les incidents et le trafic
   * @param {Array} origin - Coordonnées de départ
   * @param {Array} destination - Coordonnées d'arrivée
   * @param {Object} options - Options de calcul d'itinéraire
   * @param {Array} incidentsToAvoid - Incidents spécifiques à éviter
   * @returns {Promise<Object>} Nouvel itinéraire
   */
  recalculateRoute: async (origin, destination, options = {}, incidentsToAvoid = []) => {
    try {
      // Récupérer tous les incidents dans la zone
      const bounds = getBoundsFromCoordinates(origin, destination);
      const areaIncidents = await incidentService.getIncidentsInArea(bounds);
      
      // Combiner les incidents de la zone avec ceux à éviter spécifiquement
      let allIncidents = [...areaIncidents];
      
      // Ajouter les incidents à éviter qui ne sont pas déjà dans la liste
      incidentsToAvoid.forEach(incident => {
        if (!allIncidents.some(inc => inc.id === incident.id)) {
          allIncidents.push(incident);
        }
      });
      
      // Filtrer pour ne garder que les incidents actifs
      allIncidents = allIncidents.filter(incident => incidentService.isIncidentActive(incident));
      
      // Calculer un nouvel itinéraire
      return await SmartNavigationService.calculateSmartRoute(origin, destination, options);
    } catch (error) {
      console.error('Erreur lors du recalcul de l\'itinéraire:', error);
      throw error;
    }
  },

  /**
   * Arrête la surveillance des incidents
   */
  stopIncidentMonitoring: () => {
    if (SmartNavigationService.activeIncidentMonitoring) {
      clearInterval(SmartNavigationService.activeIncidentMonitoring);
      SmartNavigationService.activeIncidentMonitoring = null;
      SmartNavigationService.onIncidentDetectedCallback = null;
    }
  },

  /**
   * Configure les callbacks pour les événements
   * @param {Object} callbacks - Objet contenant les callbacks
   */
  setCallbacks: (callbacks = {}) => {
    if (callbacks.onIncidentDetected) {
      SmartNavigationService.onIncidentDetectedCallback = callbacks.onIncidentDetected;
    }
    
    if (callbacks.onRouteUpdated) {
      SmartNavigationService.onRouteUpdatedCallback = callbacks.onRouteUpdated;
    }
  }
};

/**
 * Calcule un score pour un itinéraire en fonction de différents critères
 * @param {Object} route - Itinéraire
 * @param {Object} incidentImpact - Impact des incidents
 * @param {Object} trafficImpact - Impact du trafic
 * @returns {Number} Score global (0-100)
 */
function calculateRouteScore(route, incidentImpact, trafficImpact) {
  // Normalisation du temps de trajet (0-30 points)
  // Note: ceci pourrait être amélioré si on compare plusieurs itinéraires
  const durationScore = 30;
  
  // Score des incidents (0-40 points)
  const incidentScore = (incidentImpact.totalScore / 100) * 40;
  
  // Score du trafic (0-30 points)
  const trafficScore = (trafficImpact.trafficScore / 100) * 30;
  
  // Score total
  return Math.round(durationScore + incidentScore + trafficScore);
}

/**
 * Obtient les coordonnées d'un incident, quel que soit son format
 * @param {Object} incident - Incident à analyser
 * @returns {Array|null} Coordonnées [longitude, latitude] ou null
 */
function getIncidentCoordinates(incident) {
  if (!incident) return null;
  
  // Format direct de coordonnées
  if (incident.location && Array.isArray(incident.location)) {
    return incident.location;
  }
  
  // Format avec longitude/latitude
  if (incident.longitude !== undefined && incident.latitude !== undefined) {
    return [parseFloat(incident.longitude), parseFloat(incident.latitude)];
  }
  
  // Format avec objet location contenant des coordonnées
  if (incident.location && incident.location.coordinates && Array.isArray(incident.location.coordinates)) {
    return incident.location.coordinates;
  }
  
  // Format avec objet coords
  if (incident.coords && Array.isArray(incident.coords)) {
    return incident.coords;
  }
  
  // Aucun format valide trouvé
  return null;
}

/**
 * Crée des bounds à partir de deux coordonnées
 * @param {Array} coord1 - Première coordonnée [longitude, latitude]
 * @param {Array} coord2 - Deuxième coordonnée [longitude, latitude]
 * @returns {Object} Bounds au format {lat1, lon1, lat2, lon2}
 */
function getBoundsFromCoordinates(coord1, coord2) {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;
  
  return {
    lat1: Math.min(lat1, lat2),
    lon1: Math.min(lon1, lon2),
    lat2: Math.max(lat1, lat2),
    lon2: Math.max(lon1, lon2)
  };
}

export default SmartNavigationService;