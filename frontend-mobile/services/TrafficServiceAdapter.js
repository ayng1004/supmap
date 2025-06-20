// services/TrafficServiceAdapter.js
import TrafficPredictionService from './TrafficPredictionService';

// Définition des constantes requises directement dans ce fichier
const KNOWN_CONGESTION_ZONES = [
  {
    name: "Place de l'Étoile",
    type: "urban_center",
    coordinates: [2.2950, 48.8738],
    radius: 0.5,
    baseIntensity: 0.9
  },
  {
    name: "Porte de Bercy",
    type: "major_highway_entry",
    coordinates: [2.4105, 48.8312],
    radius: 0.7,
    baseIntensity: 0.85
  },
  {
    name: "Place d'Italie",
    type: "urban_center",
    coordinates: [2.3561, 48.8322],
    radius: 0.4,
    baseIntensity: 0.75
  },
  {
    name: "La Défense",
    type: "business_district",
    coordinates: [2.2375, 48.8918],
    radius: 1.0,
    baseIntensity: 0.8
  }
];

// Fonction utilitaire pour calculer la distance entre deux points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Rayon de la Terre en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; // Distance en km
}

// Fonction pour déterminer le type de trafic en fonction du score
function getTrafficTypeByCongestion(score) {
  if (score >= 80) return 'FLUIDE';
  if (score >= 60) return 'MOYEN';
  if (score >= 40) return 'DENSE';
  if (score >= 20) return 'TRÈS_DENSE';
  return 'BLOQUÉ';
}

// Ajouter la fonction manquante au service
if (!TrafficPredictionService.getHistoricalPredictions) {
  TrafficPredictionService.getHistoricalPredictions = function(bounds, time = new Date()) {
    console.log('Utilisation des prédictions historiques de secours pour', bounds);
    
    // Déterminer le jour et l'heure
    const dayOfWeek = time.getDay(); // 0 = dimanche, 1-5 = jours de semaine, 6 = samedi
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const hour = time.getHours() + (time.getMinutes() / 60);
    
    // Déterminer la période du jour selon le jour de la semaine et l'heure
    const isRushHour = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
    const baseCongestionFactor = isWeekend ? 
      (isRushHour ? 0.6 : 0.3) : // Week-end
      (isRushHour ? 0.8 : 0.4);  // Semaine
    
    // Créer une grille de prédictions de secours
    const predictions = [];
    const GRID_SIZE = 15;
    
    if (!bounds || !bounds.minLat || !bounds.maxLat || !bounds.minLon || !bounds.maxLon) {
      console.error('Limites géographiques non valides pour les prédictions:', bounds);
      // Retourner quelques prédictions par défaut autour de Paris
      return [
        {
          latitude: 48.8534,
          longitude: 2.3488,
          intensity: 0.5,
          probability: 0.7,
          score: 50,
          type: 'MOYEN'
        }
      ];
    }
    
    const latStep = (bounds.maxLat - bounds.minLat) / GRID_SIZE;
    const lonStep = (bounds.maxLon - bounds.minLon) / GRID_SIZE;
    
    // Pour chaque cellule de la grille
    for (let latIdx = 0; latIdx < GRID_SIZE; latIdx++) {
      for (let lonIdx = 0; lonIdx < GRID_SIZE; lonIdx++) {
        // Calculer les coordonnées du centre de la cellule
        const lat = bounds.minLat + (latIdx + 0.5) * latStep;
        const lon = bounds.minLon + (lonIdx + 0.5) * lonStep;
        
        // Vérifier les zones connues pour ce point
        let zoneCongestion = 0;
        
        // Vérifier la proximité avec des zones de congestion connues
        KNOWN_CONGESTION_ZONES.forEach(zone => {
          const distance = calculateDistance(lat, lon, zone.coordinates[1], zone.coordinates[0]);
          
          if (distance <= zone.radius) {
            // Plus on est proche du centre, plus la congestion est forte
            const proximityFactor = 1 - (distance / zone.radius);
            
            // Vérifier si cette zone est particulièrement affectée pendant cette période
            const zoneFactor = isRushHour ? 1.2 : 1.0;
            
            // Calculer le score de congestion pour cette zone
            const congestionScore = zone.baseIntensity * proximityFactor * baseCongestionFactor * zoneFactor;
            
            // Garder le plus haut score de congestion
            zoneCongestion = Math.max(zoneCongestion, congestionScore);
          }
        });
        
        // Si aucune zone spécifique n'est trouvée, utiliser une valeur de base
        if (zoneCongestion === 0) {
          // Congestion de base selon la période et un facteur aléatoire léger
          zoneCongestion = baseCongestionFactor * (0.2 + Math.random() * 0.1);
        }
        
        // Ajouter un facteur aléatoire pour une variation naturelle
        const randomFactor = Math.random() * 0.2 - 0.1; // -0.1 à 0.1
        zoneCongestion = Math.max(0, Math.min(1, zoneCongestion + randomFactor));
        
        // Convertir la congestion (0-1) en score (0-100, où 0 est complètement congestionné)
        const congestionScore = Math.max(0, Math.min(100, Math.round((1 - zoneCongestion) * 100)));
        
        // Ajouter la prédiction
        predictions.push({
          latitude: lat,
          longitude: lon,
          intensity: zoneCongestion,
          probability: 0.7 + (Math.random() * 0.2), // 0.7-0.9
          score: congestionScore,
          type: getTrafficTypeByCongestion(congestionScore)
        });
      }
    }
    
    return predictions;
  };
}

// Ajouter une fonction de visualisation simplifiée si elle n'existe pas
if (!TrafficPredictionService.visualizePredictions) {
  TrafficPredictionService.visualizePredictions = function(map, predictions) {
    console.log(`Visualisation simplifiée de ${predictions?.length || 0} prédictions`);
    // Fonction vide pour éviter les erreurs - dans une implémentation réelle,
    // cette fonction ajouterait des éléments visuels à la carte
  };
}

export default TrafficPredictionService;