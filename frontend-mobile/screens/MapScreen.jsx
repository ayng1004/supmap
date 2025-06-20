import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  Text, 
  SafeAreaView, 
  Platform, 
  Modal, 
  ScrollView, 
  ActivityIndicator, 
  Image,
  Animated, // Ajout de l'import Animated manquant
  Keyboard,
  Dimensions
} from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { Ionicons, MaterialIcons, FontAwesome5, Feather, MaterialCommunityIcons  } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import apiService from '../services/api';
import { fetchTomTomIncidents, mergeIncidents } from '../services/trafficService';
import axios from 'axios';
import { Linking } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import BottomMenuDrawer from '../components/BottomMenuDrawer'
import SwipeablePopup from '../components/SwipeablePopup'
import tomtomService from '../services/tomtomService';
import authService from '../services/auth/auth';
import TrafficPredictionOverlay from '../components/TrafficPredictionOverlay';
import EnhancedTrafficService from '../services/EnhancedTrafficService';
// Définition des types d'incidents avec les mêmes valeurs que le front web
const INCIDENT_ICONS = {
  'traffic': require('../assets/icons/traffic.png'),
  'accident': require('../assets/icons/accident.png'),
  'hazard': require('../assets/icons/hazard.png'), 
  'police': require('../assets/icons/police.png'),
  'closure': require('../assets/icons/closure.png')
};

// Types d'incidents avec les mêmes données que le front web
const INCIDENT_TYPES = {
  'traffic': { 
    id: 'traffic', 
    title: 'Bouchon', 
    color: '#FF9500', 
    icon: 'traffic-light',
    description: 'Embouteillage important'
  },
  'accident': { 
    id: 'accident', 
    title: 'Accident', 
    color: '#FF3B30', 
    icon: 'car-crash',
    description: 'Accident de circulation' 
  },
  'hazard': { 
    id: 'hazard', 
    title: 'Danger', 
    color: '#FF2D55', 
    icon: 'exclamation-triangle',
    description: 'Obstacle ou danger sur la route' 
  },
  'police': { 
    id: 'police', 
    title: 'Police', 
    color: '#34C759', 
    icon: 'shield-alt',
    description: 'Contrôle policier' 
  },
  'closure': { 
    id: 'closure', 
    title: 'Route fermée', 
    color: '#5856D6', 
    icon: 'road',
    description: 'Route ou voie fermée' 
  }
};

// Fonction pour obtenir les informations d'un type à partir de son ID
const getIncidentTypeInfo = (typeId) => {
  return INCIDENT_TYPES[typeId] || {
    id: 'unknown',
    title: 'Autre',
    color: '#8E8E93',
    icon: 'exclamation',
    description: 'Signalement non catégorisé'
  };
};

// Vérifier si un incident est toujours actif en fonction de sa date de création
const isIncidentActive = (incident) => {
  if (!incident) return false;
  if (incident.active === false) return false;
  
  const now = new Date();
  const createdDate = new Date(incident.created_at || incident.timestamp);
  const age = now - createdDate;
  
  // Définir des durées de vie par type d'incident
  const EXPIRATION_TIMES = {
    'traffic': 3 * 60 * 60 * 1000,  // 3 heures pour embouteillages
    'police': 2 * 60 * 60 * 1000,   // 2 heures pour contrôles policiers
    'closure': 12 * 60 * 60 * 1000, // 12 heures pour routes fermées
    'accident': 6 * 60 * 60 * 1000, // 6 heures pour accidents
    'hazard': 4 * 60 * 60 * 1000    // 4 heures pour obstacles
  };
  
  const expirationTime = EXPIRATION_TIMES[incident.type] || 4 * 60 * 60 * 1000;
  
  // Expiration basée sur le temps
  if (age > expirationTime) return false;
  
  // Expiration basée sur les votes
  const { up = 0, down = 0 } = incident.votes || {};
  if (down > up && down >= 3) return false;
  
  return true;
};

// Fonction pour formater le temps écoulé
const getElapsedTime = (timestamp) => {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMinutes = Math.floor((now - date) / (1000 * 60));
  
  if (diffMinutes < 1) return 'À l\'instant';
  if (diffMinutes < 60) return `Il y a ${diffMinutes} min`;
  
  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  
  const days = Math.floor(hours / 24);
  return `Il y a ${days} jour${days > 1 ? 's' : ''}`;
};

MapboxGL.setAccessToken('pk.eyJ1IjoidG95Y2FuIiwiYSI6ImNtYThhMWR0ZjE0NGIycXM2bG05ZXFxdHoifQ.5HZaIXzWUuPTa6lrSenaGQ');



// 1. Modifier le composant ModernIncidentPopup pour gérer correctement les votes
const ModernIncidentPopup = ({ incident, onClose, onVote }) => {
  if (!incident) return null;
  
  const typeInfo = getIncidentTypeInfo(incident.type);
  const timestamp = incident.created_at || incident.timestamp || new Date();
  
  // Formater l'adresse réelle au lieu de "Position actuelle"
  const locationName = incident.location?.name || 
    (incident.address ? incident.address : 
      (incident.coords ? `${incident.coords[1].toFixed(5)}, ${incident.coords[0].toFixed(5)}` : "Lieu non spécifié"));
  
  // Conversion de l'objet reportedBy en chaîne de caractères
  const reportedByString = (() => {
    const reportedBy = incident.user_id || incident.author || incident.reporter;
    if (!reportedBy) return null;
    
    // Si reportedBy est un objet avec une propriété 'name', utiliser cette valeur
    if (typeof reportedBy === 'object' && reportedBy !== null) {
      if (reportedBy.name) return reportedBy.name;
      if (reportedBy.username) return reportedBy.username;
      if (reportedBy.id) return `Utilisateur #${reportedBy.id}`;
      
      // Si c'est un objet mais qu'on ne peut pas extraire de nom, afficher "Utilisateur"
      return "Utilisateur";
    }
    
    // Si c'est une chaîne ou un nombre, l'utiliser directement
    return String(reportedBy);
  })();
  
  // Fonctions de vote avec vérification de l'existence de l'ID et de onVote
  const handleUpvote = () => {
    if (incident.id && onVote) {
      console.log('Vote positif pour incident:', incident.id);
      onVote(incident.id, true);
    } else {
      console.error('Impossible de voter: ID manquant ou fonction onVote non définie');
    }
  };
  
  const handleDownvote = () => {
    if (incident.id && onVote) {
      console.log('Vote négatif pour incident:', incident.id);
      onVote(incident.id, false);
    } else {
      console.error('Impossible de voter: ID manquant ou fonction onVote non définie');
    }
  };
  
  return (
    <SwipeablePopup onDismiss={onClose} style={styles.modernPopupContainer}>
      <View style={styles.modernPopupContent}>
        <View style={styles.modernPopupHeader}>
          <View style={[styles.modernPopupIconContainer, { backgroundColor: typeInfo.color }]}>
            <Image 
              source={INCIDENT_ICONS[incident.type] || INCIDENT_ICONS['hazard']}
              style={styles.modernPopupIcon}
              resizeMode="contain"
            />
          </View>
          <View style={styles.modernPopupHeaderText}>
            <Text style={styles.modernPopupTitle}>{typeInfo.title}</Text>
            <Text style={styles.modernPopupSubtitle}>{locationName} • {getElapsedTime(timestamp)}</Text>
            {reportedByString && (
              <Text style={styles.modernPopupReporter}>Signalé par: {reportedByString}</Text>
            )}
          </View>
        </View>
        
        <View style={styles.modernPopupVoteContainer}>
          <TouchableOpacity 
            style={styles.modernVoteButton}
            onPress={handleUpvote}
          >
            <Ionicons name="checkmark-circle" size={18} color="#33CC66" />
            <Text style={styles.modernVoteButtonText}>Je le vois</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.modernVoteButton}
            onPress={handleDownvote}
          >
            <Ionicons name="close-circle" size={18} color="#FF3B30" />
            <Text style={styles.modernVoteButtonText}>Pas là</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SwipeablePopup>
  );
};


// Also update the NearbyIncidentsList to be swipeable
const NearbyIncidentsList = ({ incidents, onIncidentSelect, onClose }) => {
  if (!incidents || incidents.length === 0) return null;
  
  return (
    <SwipeablePopup onDismiss={onClose} style={styles.nearbyIncidentsContainer}>
      <View style={styles.nearbyIncidentsHeader}>
        <Text style={styles.nearbyIncidentsTitle}>Incidents proches</Text>
      </View>
      
      {incidents.slice(0, 3).map((incident, index) => {
        const typeInfo = getIncidentTypeInfo(incident.type);
        const timestamp = incident.created_at || incident.timestamp || new Date();
        
        // Format d'adresse amélioré
        const locationName = incident.location?.name || 
          (incident.address ? incident.address : 
            (incident.coords ? `${incident.coords[1].toFixed(5)}, ${incident.coords[0].toFixed(5)}` : "Lieu non spécifié"));
        
        return (
          <TouchableOpacity 
            key={`nearby-${incident.id}-${index}`}
            style={styles.nearbyIncidentItem}
            onPress={() => onIncidentSelect && onIncidentSelect(incident)}
          >
            <View style={[styles.nearbyIncidentIcon, { backgroundColor: typeInfo.color }]}>
              <Image 
                source={INCIDENT_ICONS[incident.type] || INCIDENT_ICONS['hazard']}
                style={styles.nearbyIncidentIconImage}
                resizeMode="contain"
              />
            </View>
            
            <View style={styles.nearbyIncidentInfo}>
              <Text style={styles.nearbyIncidentTitle}>{typeInfo.title}</Text>
              <Text style={styles.nearbyIncidentLocation}>
                {locationName} • {incident.distance ? `${Math.round(incident.distance)} km` : ""}
              </Text>
            </View>
            
            <Text style={styles.nearbyIncidentTime}>
              {getElapsedTime(timestamp)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </SwipeablePopup>
  );
};

const MapScreen = ({ navigation, route }) => {
  const mapRef = useRef(null);
  const cameraRef = useRef(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [visibleBounds, setVisibleBounds] = useState(null);
  const [isLoadingIncidents, setIsLoadingIncidents] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [showNearbyIncidents, setShowNearbyIncidents] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [speedLimit, setSpeedLimit] = useState(50);
  const [showBottomMenu, setShowBottomMenu] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [showSearchResultPopup, setShowSearchResultPopup] = useState(false);
const [showTrafficPredictions, setShowTrafficPredictions] = useState(false);
const [currentRoute, setCurrentRoute] = useState(null);
const [predictionType, setPredictionType] = useState('area'); // 'area' par défaut
const [trafficPoints, setTrafficPoints] = useState([]);
const [showTrafficLegend, setShowTrafficLegend] = useState(true);
const [showTrafficLegendDetails, setShowTrafficLegendDetails] = useState(false);
const [processedTrafficPoints, setProcessedTrafficPoints] = useState([]);
const [trafficGeoJSON, setTrafficGeoJSON] = useState({ type: 'FeatureCollection', features: [] });
const [currentZoom, setCurrentZoom] = useState(15);

const [isMapStyleLoaded, setIsMapStyleLoaded] = useState(false);



const getTrafficLegendHeaderStyle = (showDetails) => {
  return {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: showDetails ? '#f0f0f0' : 'transparent',
  };
};


const filterTrafficPoints = (points) => {
  if (!points || !Array.isArray(points) || points.length === 0) return [];
  
  // D'abord, éliminer les points invalides
  const validPoints = points.filter(p => 
    p && p.coordinate && Array.isArray(p.coordinate) && p.coordinate.length === 2
  );
  
  if (validPoints.length === 0) return [];
  
  // Ensuite, éliminer les doublons proches en utilisant une grille
  const gridSize = 0.0003; // ~30m
  const pointGrid = {};
  
  validPoints.forEach(point => {
    // Vérification supplémentaire (ne devrait pas être nécessaire après le filtre précédent)
    if (!point || !point.coordinate) return;
    
    // Arrondir les coordonnées pour créer des cellules de grille
    const gridX = Math.floor(point.coordinate[0] / gridSize);
    const gridY = Math.floor(point.coordinate[1] / gridSize);
    const cellKey = `${gridX},${gridY}`;
    
    // Si cette cellule n'a pas encore de point, l'ajouter
    if (!pointGrid[cellKey] || point.intensity > pointGrid[cellKey].intensity) {
      pointGrid[cellKey] = point;
    }
  });
  
  // Convertir le grid en liste
  const uniquePoints = Object.values(pointGrid);
  
  // Filtrer ensuite les points isolés
  return uniquePoints.filter(point => {
    if (!point || !point.coordinate) return false;
    
    // Un point est conservé s'il a au moins un voisin proche ou s'il est significatif
    const neighbors = uniquePoints.filter(p => 
      p !== point && 
      p && p.coordinate &&
      distanceBetweenPoints(p.coordinate, point.coordinate) < 0.002
    );
    
    return neighbors.length > 0 || point.intensity > 0.6 || point.isSignificant;
  });
};

const loadTrafficData = useCallback(async () => {
  if (!showTrafficPredictions || !visibleBounds) return;
  
  try {
    console.log('Chargement des données de trafic pour la région visible');
    
    // Utiliser le service amélioré pour récupérer les données
    const trafficData = await EnhancedTrafficService.getTrafficForVisibleRegion(visibleBounds, currentZoom);
    
    console.log(`Récupéré ${trafficData.length} segments de trafic`);
    
    // Mettre à jour l'état avec les segments récupérés
    setProcessedTrafficPoints(trafficData);
   const geoJSON = EnhancedTrafficService.convertToGeoJSON(trafficData);
    setTrafficGeoJSON(geoJSON);
    
  } catch (error) {
    console.error('Erreur lors du chargement des données de trafic:', error);
    // En cas d'erreur, utiliser les points existants
    if (trafficPoints && trafficPoints.length > 0) {
      console.log('Utilisation des points existants comme fallback');
      
      // Traitement minimal des points existants
      const fallbackPoints = trafficPoints
        .filter(p => p && p.coordinate && Array.isArray(p.coordinate) && p.coordinate.length === 2)
        .map(p => ({
          coordinates: [p.coordinate],
          intensity: p.intensity || 0.5
        }));
      
      setProcessedTrafficPoints(fallbackPoints);
      setTrafficGeoJSON(EnhancedTrafficService.convertToGeoJSON(fallbackPoints));
    }
  }
}, [showTrafficPredictions, visibleBounds, currentZoom, trafficPoints]);

useEffect(() => {
  if (showTrafficPredictions) {
    // Charger les données immédiatement
    loadTrafficData();
    
    // Puis rafraîchir toutes les minutes
    const intervalId = setInterval(() => {
      loadTrafficData();
    }, 60000);
    
    return () => clearInterval(intervalId);
  }
}, [showTrafficPredictions, loadTrafficData]);
useEffect(() => {
  if (showTrafficPredictions) {
    // Utiliser un timeout pour éviter de charger à chaque petit mouvement
    const timeoutId = setTimeout(() => {
      loadTrafficData();
    }, 500); // Attendre 500ms après le dernier changement
    
    return () => clearTimeout(timeoutId);
  }
}, [visibleBounds, showTrafficPredictions, loadTrafficData]);
// Composant de légende de trafic amélioré
const TrafficLegendComponent = ({ visible, onToggleDetails, showDetails }) => {
  if (!visible) return null;
  
  return (
    <View style={styles.trafficLegend}>
      <TouchableOpacity 
        style={getTrafficLegendHeaderStyle(showDetails)}
        onPress={onToggleDetails}
      >
        <Text style={styles.trafficLegendTitle}>Conditions de trafic</Text>
        <Ionicons 
          name={showDetails ? "chevron-up" : "chevron-down"} 
          size={16} 
          color="#666"
        />
      </TouchableOpacity>
      
      {showDetails && (
        <View style={styles.trafficLegendContent}>
          <View style={styles.trafficLegendItem}>
            <View style={[styles.trafficLegendLine, {backgroundColor: '#4CD964'}]} />
            <Text style={styles.trafficLegendText}>Fluide</Text>
          </View>
          <View style={styles.trafficLegendItem}>
            <View style={[styles.trafficLegendLine, {backgroundColor: '#FFCC00'}]} />
            <Text style={styles.trafficLegendText}>Modéré</Text>
          </View>
          <View style={styles.trafficLegendItem}>
            <View style={[styles.trafficLegendLine, {backgroundColor: '#FF9500'}]} />
            <Text style={styles.trafficLegendText}>Dense</Text>
          </View>
          <View style={styles.trafficLegendItem}>
            <View style={[styles.trafficLegendLine, {backgroundColor: '#FF3B30'}]} />
            <Text style={styles.trafficLegendText}>Très dense</Text>
          </View>
        </View>
      )}
    </View>
  );
};










// Fonction améliorée pour snapper les points aux routes principales

const snapPointsToMajorRoads = (points) => {
  if (!points || !Array.isArray(points) || points.length === 0) return points;
  
  // Identifier les routes principales (celles avec beaucoup de points)
  const routePointCounts = {};
  points.forEach(point => {
    if (!point) return;
    
    const routeId = point.routeId || 'default';
    routePointCounts[routeId] = (routePointCounts[routeId] || 0) + 1;
  });
  
  // Considérer comme majeures les routes avec au moins 5 points
  const majorRouteIds = Object.keys(routePointCounts).filter(id => 
    routePointCounts[id] >= 5
  );
  
  // Si aucune route majeure, retourner les points d'origine
  if (majorRouteIds.length === 0) return points;
  
  // Pour chaque point isolé (non sur une route majeure), tenter un snapping
  const snappedPoints = [...points]; // Copie pour ne pas modifier l'original
  
  for (let i = 0; i < snappedPoints.length; i++) {
    const point = snappedPoints[i];
    if (!point || !point.coordinate) continue;
    
    const routeId = point.routeId || 'default';
    
    // Si le point est déjà sur une route majeure, le laisser tel quel
    if (majorRouteIds.includes(routeId)) continue;
    
    // Chercher la route majeure la plus proche
    let closestDistance = 0.003; // ~300m max pour le snapping
    let closestRoute = null;
    
    majorRouteIds.forEach(majorRouteId => {
      // Obtenir les points de cette route majeure
      const routePoints = points.filter(p => 
        p && p.coordinate && (p.routeId || 'default') === majorRouteId
      );
      
      // Trouver le point le plus proche sur cette route
      routePoints.forEach(routePoint => {
        if (!routePoint || !routePoint.coordinate) return;
        
        const distance = distanceBetweenPoints(point.coordinate, routePoint.coordinate);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestRoute = {
            routeId: majorRouteId,
            point: routePoint
          };
        }
      });
    });
    
    // Si on a trouvé une route majeure proche, ajuster le point
    if (closestRoute && closestRoute.point && closestRoute.point.coordinate) {
      // Déplacer légèrement le point vers la route majeure (sans le snapper complètement)
      const snapFactor = 0.7; // 70% vers la route, 30% position originale
      
      snappedPoints[i] = {
        ...point,
        coordinate: [
          point.coordinate[0] * (1 - snapFactor) + closestRoute.point.coordinate[0] * snapFactor,
          point.coordinate[1] * (1 - snapFactor) + closestRoute.point.coordinate[1] * snapFactor
        ],
        routeId: closestRoute.routeId, // Assigner à la route majeure
        snapped: true
      };
    }
  }
  
  return snappedPoints;
};



const optimizedGroupPointsIntoRoutes = (points) => {
  // Vérification de base
  if (!points || !Array.isArray(points) || points.length === 0) return [];
  
  // Regrouper par routeId
  const routeGroups = {};
  
  // Utilisation de forEach avec vérification
  points.forEach(point => {
    if (!point) return; // Ignorer les points undefined
    
    const routeId = point.routeId || 'default';
    if (!routeGroups[routeId]) {
      routeGroups[routeId] = {
        id: routeId,
        points: [],
        totalIntensity: 0,
        type: point.routeType || (routeId.includes('h-major') ? 'horizontal' : 
                              routeId.includes('v-major') ? 'vertical' : 'unknown')
      };
    }
    routeGroups[routeId].points.push(point);
    routeGroups[routeId].totalIntensity += point.intensity || 0;
  });
  
  // Ne garder que les routes avec au moins 3 points
  const significantRoutes = Object.values(routeGroups)
    .filter(route => route.points && route.points.length >= 3);
  
  // Pour chaque route, trier les points et créer des segments cohérents
  const finalSegments = [];
  
  significantRoutes.forEach(route => {
    if (!route || !route.points || !Array.isArray(route.points)) return;
    
    // Vérifier s'il y a suffisamment de points pour continuer
    if (route.points.length < 3) return;
    
    // Trier les points selon l'orientation de la route
    if (route.type === 'horizontal') {
      route.points.sort((a, b) => a.coordinate[0] - b.coordinate[0]);
    } else if (route.type === 'vertical') {
      route.points.sort((a, b) => a.coordinate[1] - b.coordinate[1]);
    } else {
      // Pour les routes inconnues, utiliser l'algorithme du plus proche voisin
      const sortedPoints = sortPointsByNearestNeighbor(route.points);
      if (sortedPoints && sortedPoints.length > 0) {
        route.points = sortedPoints;
      }
    }
    
    // Détecter les points de rupture (grandes distances)
    const segments = [];
    let currentSegment = {
      id: `${route.id}-seg-0`,
      points: [route.points[0]],
      type: route.type
    };
    
    for (let i = 1; i < route.points.length; i++) {
      const prevPoint = route.points[i-1];
      const currPoint = route.points[i];
      
      // Vérifier que les points sont valides
      if (!prevPoint || !prevPoint.coordinate || !currPoint || !currPoint.coordinate) {
        continue;
      }
      
      // Si la distance est trop grande, démarrer un nouveau segment
      const distance = distanceBetweenPoints(prevPoint.coordinate, currPoint.coordinate);
      if (distance > 0.002) { // ~200m
        if (currentSegment.points.length >= 3) {
          segments.push(currentSegment);
        }
        currentSegment = {
          id: `${route.id}-seg-${segments.length}`,
          points: [currPoint],
          type: route.type
        };
      } else {
        currentSegment.points.push(currPoint);
      }
    }
    
    // Ajouter le dernier segment s'il a assez de points
    if (currentSegment.points.length >= 3) {
      segments.push(currentSegment);
    }
    
    // Pour chaque segment, calculer l'intensité moyenne
    segments.forEach(segment => {
      if (!segment || !segment.points) return;
      
      segment.totalIntensity = segment.points.reduce((sum, point) => {
        if (!point) return sum;
        return sum + (point.intensity || 0);
      }, 0);
      
      segment.avgIntensity = segment.points.length > 0 ? 
        segment.totalIntensity / segment.points.length : 0;
      
      // Lisser les coordonnées pour un meilleur rendu
      try {
        if (segment.type === 'horizontal') {
          smoothLineCoordinates(segment.points, 1); // Lisser la latitude
        } else if (segment.type === 'vertical') {
          smoothLineCoordinates(segment.points, 0); // Lisser la longitude
        } else {
          smoothLineCoordinates(segment.points, null); // Lisser les deux dimensions
        }
      } catch (error) {
        console.warn('Erreur lors du lissage des coordonnées:', error);
      }
      
      finalSegments.push(segment);
    });
  });
  
  return finalSegments;
};









// Fonction pour lisser les coordonnées d'une ligne
const smoothLineCoordinates = (points, fixedDimension) => {
  if (!points || !Array.isArray(points) || points.length < 3) return; // Pas assez de points pour le lissage
  
  // Vérifier que tous les points ont des coordonnées valides
  const validPoints = points.filter(p => p && p.coordinate && Array.isArray(p.coordinate) && p.coordinate.length === 2);
  if (validPoints.length < 3) return; // Pas assez de points valides
  
  // Appliquer un lissage par moyenne mobile
  const smoothedCoords = validPoints.map(p => [...p.coordinate]); // Copie profonde
  
  for (let i = 1; i < validPoints.length - 1; i++) {
    if (fixedDimension === 0 || fixedDimension === null) {
      // Lisser la longitude (X) - dimension 0
      smoothedCoords[i][0] = (smoothedCoords[i-1][0] + smoothedCoords[i][0] + smoothedCoords[i+1][0]) / 3;
    }
    
    if (fixedDimension === 1 || fixedDimension === null) {
      // Lisser la latitude (Y) - dimension 1
      smoothedCoords[i][1] = (smoothedCoords[i-1][1] + smoothedCoords[i][1] + smoothedCoords[i+1][1]) / 3;
    }
  }
  
  // Mettre à jour les coordonnées uniquement pour les points valides
  for (let i = 0; i < validPoints.length; i++) {
    validPoints[i].coordinate = smoothedCoords[i];
  }
};
const sortPointsByNearestNeighbor = (points) => {
  // Vérification de base - si pas de points ou un seul, retourner directement
  if (!points || points.length <= 1) return points;
  
  const result = [points[0]]; // Commencer par le premier point
  const remaining = [...points.slice(1)]; // Créer une copie pour éviter de modifier l'original
  
  while (remaining.length > 0) {
    const lastPoint = result[result.length - 1];
    
    // Vérification supplémentaire
    if (!lastPoint || !lastPoint.coordinate) {
      console.warn('Point invalide rencontré dans sortPointsByNearestNeighbor');
      break; // Sortir pour éviter les erreurs
    }
    
    // Trouver le point le plus proche
    let minDistIndex = 0;
    let minDist = distanceBetweenPoints(lastPoint.coordinate, remaining[0].coordinate);
    
    for (let i = 1; i < remaining.length; i++) {
      if (!remaining[i] || !remaining[i].coordinate) continue; // Ignorer les points invalides
      
      const dist = distanceBetweenPoints(lastPoint.coordinate, remaining[i].coordinate);
      if (dist < minDist) {
        minDist = dist;
        minDistIndex = i;
      }
    }
    
    // Si la distance est trop grande, stopper cette chaîne
    if (minDist > 0.005) { // ~500m
      break; // Au lieu de créer une récursion, juste terminer la chaîne actuelle
    }
    
    // Ajouter le point le plus proche au résultat
    result.push(remaining.splice(minDistIndex, 1)[0]);
  }
  
  // Retourner les points triés (et non modifiés)
  return result;
};

// Calculer la distance entre deux points (en degrés)
const distanceBetweenPoints = (p1, p2) => {
  return Math.sqrt(
    Math.pow(p1[0] - p2[0], 2) + 
    Math.pow(p1[1] - p2[1], 2)
  );
};



// Ensuite, redéfinissez la fonction groupPointsIntoRoutes pour utiliser ces points prétraités
const groupPointsIntoRoutes = (points) => {
  if (!points || points.length === 0) return [];
  
  // Regrouper par routeId
  const routeGroups = {};
  
  points.forEach(point => {
    const routeId = point.routeId || 'default';
    if (!routeGroups[routeId]) {
      routeGroups[routeId] = {
        id: routeId,
        points: [],
        totalIntensity: 0,
        type: point.routeType || 'unknown'
      };
    }
    routeGroups[routeId].points.push(point);
    routeGroups[routeId].totalIntensity += point.intensity || 0;
  });
  
  // Adapter chaque route en fonction de son type
  Object.values(routeGroups).forEach(route => {
    // Pour les routes non identifiées, essayer de déterminer l'orientation
    if (route.type === 'unknown' && route.points.length > 2) {
      const firstPoint = route.points[0].coordinate;
      const lastPoint = route.points[route.points.length - 1].coordinate;
      
      // Si la différence en longitude est plus grande que la différence en latitude
      if (Math.abs(lastPoint[0] - firstPoint[0]) > Math.abs(lastPoint[1] - firstPoint[1])) {
        route.type = 'horizontal';
      } else {
        route.type = 'vertical';
      }
    }
    
    // Calculer l'intensité moyenne
    route.avgIntensity = route.totalIntensity / route.points.length;
    
    // Diviser les routes trop longues en plusieurs segments plus petits
    // pour un meilleur rendu
    const maxSegmentLength = 20; // Maximum de points par segment
    if (route.points.length > maxSegmentLength) {
      const segments = [];
      for (let i = 0; i < route.points.length; i += maxSegmentLength - 5) { // Chevauchement de 5 points
        segments.push({
          id: `${route.id}-seg-${Math.floor(i/maxSegmentLength)}`,
          points: route.points.slice(i, Math.min(i + maxSegmentLength, route.points.length)),
          avgIntensity: route.avgIntensity,
          type: route.type
        });
      }
      return segments;
    }
  });
  
  // Retourner les routes groupées et améliorées
  return Object.values(routeGroups).filter(r => r.points.length >= 2);
};















const getTrafficColor = (intensity) => {
  if (intensity < 0.3) return '#4CD964'; // Vert - trafic fluide
  if (intensity < 0.5) return '#FFCC00'; // Jaune - trafic modéré
  if (intensity < 0.7) return '#FF9500'; // Orange - trafic dense
  return '#FF3B30'; // Rouge - trafic très dense
};




const findRouteJunctions = (points) => {
  if (!points || points.length === 0) return [];
  
  // Regrouper tous les points par leur position approximative
  const gridSize = 0.0005; // environ 50m
  const gridCells = {};
  
  // Ajouter les points à la grille
  points.forEach(point => {
    // Arrondir les coordonnées pour créer des cellules de grille
    const gridX = Math.floor(point.coordinate[0] / gridSize);
    const gridY = Math.floor(point.coordinate[1] / gridSize);
    const cellKey = `${gridX},${gridY}`;
    
    if (!gridCells[cellKey]) {
      gridCells[cellKey] = [];
    }
    
    gridCells[cellKey].push(point);
  });
  
  // Identifier les intersections potentielles (cellules avec plusieurs routes)
  const junctions = [];
  
  Object.keys(gridCells).forEach(cellKey => {
    const cell = gridCells[cellKey];
    
    // Obtenir les IDs de routes uniques dans cette cellule
    const routeIds = [...new Set(cell.map(p => p.routeId || 'default'))];
    
    // S'il y a plus d'un type de route dans cette cellule, c'est une intersection
    if (routeIds.length > 1) {
      // Calculer la position moyenne et l'intensité moyenne
      let totalLon = 0;
      let totalLat = 0;
      let totalIntensity = 0;
      
      cell.forEach(p => {
        totalLon += p.coordinate[0];
        totalLat += p.coordinate[1];
        totalIntensity += p.intensity || 0;
      });
      
      const avgLon = totalLon / cell.length;
      const avgLat = totalLat / cell.length;
      const avgIntensity = totalIntensity / cell.length;
      
      // Déterminer la couleur en fonction de l'intensité
      let color;
      if (avgIntensity < 0.3) color = '#4CD964'; // Vert
      else if (avgIntensity < 0.5) color = '#FFCC00'; // Jaune
      else if (avgIntensity < 0.7) color = '#FF9500'; // Orange
      else color = '#FF3B30'; // Rouge
      
      junctions.push({
        coordinate: [avgLon, avgLat],
        intensity: avgIntensity,
        color: color,
        routeIds: routeIds
      });
    }
  });
  
  return junctions;
};













  // Déterminer si l'utilisateur est connecté
  const isUserLoggedIn = !!userInfo;

  // Fonctions placées en haut pour être disponibles dans tout le composant
  const getUserInitials = useCallback(() => {
    if (!userInfo || !userInfo.username) return "?";
    
    const username = userInfo.username;
    if (username.length === 0) return "?";
    
    if (username.includes(' ')) {
      const nameParts = username.split(' ');
      return (nameParts[0].charAt(0) + (nameParts[1] ? nameParts[1].charAt(0) : '')).toUpperCase();
    } else {
      return username.substring(0, Math.min(2, username.length)).toUpperCase();
    }
  }, [userInfo]);

const navigateToIncidentList = useCallback(() => {
  // Rediriger vers ReportsScreen au lieu de IncidentDetail
  navigation.navigate('Reports', { 
    incidents: incidents,  // Envoyer la liste complète des incidents
    userLocation: userLocation 
  });
}, [navigation, incidents, userLocation]);




  const getAvatarColor = useCallback(() => {
    if (!userInfo || !userInfo.username) return "#1A73E8";
    
    const username = userInfo.username;
    const colors = ['#1A73E8', '#4CAF50', '#F44336', '#9C27B0', '#FF9800', '#009688'];
    
    let sum = 0;
    for (let i = 0; i < username.length; i++) {
      sum += username.charCodeAt(i);
    }
    
    return colors[sum % colors.length];
  }, [userInfo]);

  // Récupérer les informations de l'utilisateur connecté
  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const userData = await authService.getUserInfo();
        if (userData) {
          setUserInfo(userData);
          console.log('Informations utilisateur chargées:', userData);
        }
      } catch (error) {
        console.error('Erreur lors du chargement des informations utilisateur:', error);
      }
    };

    loadUserInfo();
    
    // Simuler un compteur de vitesse pour démonstration
    const speedInterval = setInterval(() => {
      // Vitesse aléatoire entre 40 et 52 km/h
      setCurrentSpeed(Math.floor(Math.random() * 12) + 40);
    }, 3000);
    
    return () => clearInterval(speedInterval);
  }, []);
  
  // Récupérer le nouvel incident signalé depuis ReportIncidentScreen
  useEffect(() => {
    if (route?.params?.newIncident) {
      // Ajouter le nouvel incident à la liste
      setIncidents(prev => {
        // Vérifier si l'incident existe déjà
        const exists = prev.some(inc => inc.id === route.params.newIncident.id);
        if (!exists) {
          return [...prev, route.params.newIncident];
        }
        return prev;
      });
      
      // Réinitialiser le paramètre pour éviter les doublons
      navigation.setParams({ newIncident: null });
    }
    
    // Si un incident à focus est demandé
    if (route?.params?.focusIncident) {
      setSelectedIncident(route.params.focusIncident);
      setShowPopup(route?.params?.showPopup || false);
      
      // Centrer la caméra sur l'incident
      const coords = route.params.focusIncident.coords || 
                     (Array.isArray(route.params.focusIncident.location) 
                      ? route.params.focusIncident.location 
                      : route.params.focusIncident.location?.coordinates);
                      
      if (coords && cameraRef.current) {
        setTimeout(() => {
          cameraRef.current.setCamera({
            centerCoordinate: coords,
            zoomLevel: 15,
            animationMode: 'flyTo',
            animationDuration: 1000,
          });
        }, 500);
      }
      
      // Réinitialiser le paramètre
      navigation.setParams({ focusIncident: null, showPopup: null });
    }
  }, [route?.params?.newIncident, route?.params?.focusIncident, navigation]);
  useEffect(() => {
    
    if (route?.params?.searchResult) {
      const result = route.params.searchResult;
      setSearchResult(result);
      setShowSearchResultPopup(true);
      
      // Center map on search result
      if (result.coordinates || result.lat) {
        const coords = result.coordinates || [result.lng || result.longitude, result.lat || result.latitude];
        
        if (cameraRef.current && coords) {
          cameraRef.current.setCamera({
            centerCoordinate: coords,
            zoomLevel: 15,
            animationMode: 'flyTo',
            animationDuration: 1000,
          });
        }
      }
      
      // Clear the param to avoid reprocessing
      navigation.setParams({ searchResult: null });
    }
  }, [route?.params?.searchResult]);
  const navigateToSearchResult = (place) => {
    // Hide the popup
    setShowSearchResultPopup(false);
    
    // Start navigation process or open route planner
    if (place.coordinates || place.lat) {
      const coords = place.coordinates || [place.lng || place.longitude, place.lat || place.latitude];
      
      // Use the existing route planner
      navigation.navigate('RouteSearch', {
        destination: {
          name: place.name || "Destination",
          address: place.address || place.formattedAddress || "",
          coordinates: coords
        }
      });
    } else {
      Alert.alert("Erreur", "Coordonnées de destination manquantes.");
    }
  };
  const normalizeIncidentCoordinates = (incident) => {
  if (!incident) return null;
  
  let coords = null;
  
  // Cas 1: Coordonnées directement dans l'objet en tableau
  if (incident.coords && Array.isArray(incident.coords)) {
    coords = incident.coords;
  } 
  // Cas 2: Coordonnées dans la propriété location
  else if (incident.location) {
    // Cas 2.1: Location est un tableau
    if (Array.isArray(incident.location)) {
      coords = incident.location;
    } 
    // Cas 2.2: Location est un objet GeoJSON
    else if (incident.location.coordinates && Array.isArray(incident.location.coordinates)) {
      coords = incident.location.coordinates;
    }
  } 
  // Cas 3: Coordonnées en tant que propriétés distinctes
  else if (incident.longitude !== undefined && incident.latitude !== undefined) {
    coords = [parseFloat(incident.longitude), parseFloat(incident.latitude)];
  }
  // Cas 4: Coordonnées en tant que propriétés lng/lat
  else if (incident.lng !== undefined && incident.lat !== undefined) {
    coords = [parseFloat(incident.lng), parseFloat(incident.lat)];
  }
  
  // Vérifier la validité des coordonnées
  if (!coords || coords.length < 2 || 
      isNaN(parseFloat(coords[0])) || isNaN(parseFloat(coords[1]))) {
    return null;
  }
  
  // S'assurer que les coordonnées sont des nombres
  return [parseFloat(coords[0]), parseFloat(coords[1])];
};
  const renderIncidentAnnotations = useCallback(() => {
  if (!incidents || incidents.length === 0) {
    console.log('Pas d\'incidents à afficher');
    return [];
  }
  
  console.log(`Rendu de ${incidents.length} incidents`);
  
  return incidents.map((incident, index) => {
    try {
      // Normalisation des coordonnées
      let coords = normalizeIncidentCoordinates(incident);
      
      if (!coords) {
        console.log(`Incident ${index} (${incident.id}) sans coordonnées valides`);
        return null;
      }
      
      console.log(`Incident ${index} (${incident.id}) - coords:`, coords);
      
      // Récupérer le type d'incident et ses caractéristiques
      const incidentType = incident.type || 'hazard';
      const typeInfo = INCIDENT_TYPES[incidentType] || INCIDENT_TYPES['hazard'];
      const incidentColor = typeInfo.color;
      
      // ID unique pour l'annotation
      const annotationId = `incident-${incident.id || index}`;
      
      // Léger décalage aléatoire pour éviter les superpositions
      const jitterFactor = 0.00015; // ~15 mètres
      const jitterLng = coords[0] + (Math.random() - 0.5) * jitterFactor;
      const jitterLat = coords[1] + (Math.random() - 0.5) * jitterFactor;
      
      return (
        <MapboxGL.PointAnnotation
          key={annotationId}
          id={annotationId}
          coordinate={[jitterLng, jitterLat]}
          onSelected={() => {
            // Afficher les détails de l'incident au clic
            setSelectedIncident(incident);
            setShowPopup(true);
          }}
        >
          <View style={styles.annotationWrapper}>
            {/* Container extérieur avec effet de halo */}
            <View style={[
              styles.haloContainer, 
              { 
                shadowColor: incidentColor,
                borderColor: incidentColor,
                backgroundColor: `${incidentColor}30` // 30% d'opacité
              }
            ]}>
              {/* Container intérieur pour l'icône */}
              <View style={[styles.annotationContainer, { backgroundColor: incidentColor }]}>
                <Image 
                  source={INCIDENT_ICONS[incidentType] || INCIDENT_ICONS['hazard']}
                  style={styles.annotationIcon}
                  resizeMode="contain"
                />
              </View>
            </View>
          </View>
        </MapboxGL.PointAnnotation>
      );
    } catch (error) {
      console.error(`Erreur lors du rendu de l'incident ${index}:`, error);
      return null;
    }
  }).filter(Boolean); // Filtrer les éléments null
}, [incidents, setSelectedIncident, setShowPopup]);
    // In your render function, add the search result marker and popup
    const renderSearchResultMarker = () => {
      if (!searchResult || !showSearchResultPopup) return null;
      
      const coords = searchResult.coordinates || 
        [searchResult.lng || searchResult.longitude, searchResult.lat || searchResult.latitude];
      
      if (!coords) return null;
      
      return (
        <MapboxGL.PointAnnotation
          key="search-result"
          id="search-result"
          coordinate={coords}
          onSelected={() => setShowSearchResultPopup(true)}
        >
          <View style={styles.searchResultMarker}>
            <View style={styles.searchResultMarkerIcon}>
              <Ionicons name="location" size={24} color="white" />
            </View>
          </View>
        </MapboxGL.PointAnnotation>
      );
    };
    
    // Update the NearbyIncidentsList call to include onClose
    {showNearbyIncidents && !showPopup && !isNavigating && !showSearchResultPopup && incidents.length > 0 && (
      <NearbyIncidentsList 
        incidents={incidents}
        onClose={() => setShowNearbyIncidents(false)}
        onIncidentSelect={(incident) => {
          setSelectedIncident(incident);
          setShowPopup(true);
          
          // Centrer sur l'incident sélectionné
          let coords = incident.coords;
          if (!coords && incident.location) {
            if (Array.isArray(incident.location)) {
              coords = incident.location;
            } else if (incident.location.coordinates && Array.isArray(incident.location.coordinates)) {
              coords = incident.location.coordinates;
            }
          }
          
          if (coords && cameraRef.current) {
            cameraRef.current.setCamera({
              centerCoordinate: coords,
              zoomLevel: 15,
              animationMode: 'flyTo',
              animationDuration: 1000,
            });
          }
        }}
      />
    )}
    
    // Add the search result popup in your return statement
    {showSearchResultPopup && searchResult && (
      <SearchResultPopup
        place={searchResult}
        onClose={() => setShowSearchResultPopup(false)}
        onNavigate={navigateToSearchResult}
      />
    )}
    
    // Add the search result marker to your MapView
    {renderSearchResultMarker()}
  // Demander les permissions de localisation et initialiser le suivi
  useEffect(() => {
    (async () => {
      try {
        // Définir une position par défaut (Paris)
        const defaultLocation = [2.3488, 48.8534];
        
        // Définir immédiatement la position par défaut pour éviter les écrans vides
        setUserLocation(defaultLocation);
        
        // Centrer la carte sur la position par défaut
        if (cameraRef.current) {
          setTimeout(() => {
            cameraRef.current.setCamera({
              centerCoordinate: defaultLocation,
              zoomLevel: 15,
              animationMode: 'flyTo',
              animationDuration: 1000,
            });
          }, 1000);
        }
        
        // Vérifier ensuite si les services de localisation sont activés
        const enabled = await Location.hasServicesEnabledAsync();
        if (!enabled) {
          console.log('Services de localisation désactivés, utilisation de la position par défaut');
          return; // Continuer avec la position par défaut
        }
        
        // Demander les permissions de localisation sans bloquer l'interface
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.warn('Permission de localisation refusée, utilisation de la position par défaut');
          return; // Continuer avec la position par défaut
        }
        
        console.log('Permission de localisation accordée, tentative d\'obtenir la position réelle');
        
        // Essayer d'obtenir la position réelle, mais sans bloquer l'interface
        // Ne pas utiliser Promise.race qui pourrait causer des problèmes
        try {
          // Utiliser une configuration très permissive
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Low, // Basse précision = plus rapide
            maximumAge: 300000, // Accepter une position datant de jusqu'à 5 minutes
            timeout: 5000 // Timeout court de 5 secondes
          });
          
          if (location && location.coords) {
            console.log('Position réelle obtenue:', location.coords);
            const realLocation = [location.coords.longitude, location.coords.latitude];
            setUserLocation(realLocation);
            
            // Mettre à jour la carte avec la vraie position
            if (cameraRef.current) {
              cameraRef.current.setCamera({
                centerCoordinate: realLocation,
                zoomLevel: 15,
                animationMode: 'flyTo',
                animationDuration: 1000,
              });
            }
            
            // Configuration très permissive pour le suivi continu
            Location.watchPositionAsync(
              { 
                accuracy: Location.Accuracy.Low,
                distanceInterval: 50, // Mise à jour tous les 50m seulement
                timeInterval: 15000 // Mise à jour toutes les 15 secondes maximum
              },
              (location) => {
                if (location && location.coords) {
                  setUserLocation([location.coords.longitude, location.coords.latitude]);
                }
              }
            );
          }
        } catch (locError) {
          // En cas d'erreur, continuer avec la position par défaut
          console.log('Impossible d\'obtenir la position réelle, utilisation de la position par défaut');
        }
      } catch (error) {
        console.error('Erreur générale de localisation:', error);
        // Ne pas bloquer l'interface, continuer avec la position par défaut si elle est définie
      }
    })();
  }, []);



const getFallbackIncidents = (userLocation) => {
  // Coordonnées de base (par défaut Paris)
  const baseLat = userLocation ? userLocation[1] : 48.8534;
  const baseLng = userLocation ? userLocation[0] : 2.3488;
  
  // Générer quelques incidents factices autour de cette position
  return [
    {
      id: 'fallback-1',
      type: 'traffic',
      coords: [baseLng + 0.01, baseLat + 0.005],
      created_at: new Date().toISOString(),
      location: { name: 'Avenue proche' },
      votes: { up: 2, down: 0 }
    },
    {
      id: 'fallback-2',
      type: 'accident',
      coords: [baseLng - 0.008, baseLat - 0.003],
      created_at: new Date(Date.now() - 15 * 60000).toISOString(),
      location: { name: 'Carrefour principal' },
      votes: { up: 3, down: 1 }
    },
    {
      id: 'fallback-3',
      type: 'hazard',
      coords: [baseLng + 0.005, baseLat - 0.01],
      created_at: new Date(Date.now() - 30 * 60000).toISOString(),
      location: { name: 'Rue secondaire' },
      votes: { up: 1, down: 0 }
    }
  ];
};



// Fonction pour obtenir les limites géographiques autour de l'utilisateur
const getUserBounds = (userLocation) => {
  if (!userLocation) {
    // Coordonnées par défaut pour Paris
    return {
      minLon: 2.3, 
      minLat: 48.8, 
      maxLon: 2.5, 
      maxLat: 48.9
    };
  }
  
  const [userLng, userLat] = userLocation;
  
  // Créer un rectangle de ~2km autour de l'utilisateur
const offset = 0.02; // ~1km dans chaque direction
  
  return {
    minLon: userLng - offset,
    minLat: userLat - offset,
    maxLon: userLng + offset,
    maxLat: userLat + offset
  };
};
  useEffect(() => {
    const fetchIncidents = async () => {
  try {
    setIsLoadingIncidents(true);
    console.log('Chargement des incidents...');

    // Récupérer les incidents locaux
    console.log('Chargement des incidents locaux...');
    let localIncidents = [];
    
    try {
      // Vérifier si le service API est disponible
      if (apiService && apiService.incidents && typeof apiService.incidents.getAll === 'function') {
        const result = await apiService.incidents.getAll();
        
        if (Array.isArray(result)) {
          localIncidents = result;
          console.log(`Récupéré ${localIncidents.length} incidents locaux`);
        } else {
          console.warn('API: Format de réponse incorrect pour incidents locaux');
          throw new Error('Format de réponse incorrect');
        }
      } else {
        throw new Error('Service API des incidents non disponible');
      }
    } catch (localError) {
      console.warn('Erreur lors du chargement des incidents locaux:', localError);
      // Utiliser des incidents de secours
      localIncidents = getFallbackIncidents(userLocation);
      console.log(`Utilisation de ${localIncidents.length} incidents de secours`);
    }

    // Récupérer les incidents TomTom
    let tomtomIncidents = [];
    try {
      console.log('Chargement des incidents TomTom...');
      
      // Récupérer les limites de la carte autour de l'utilisateur
      const bounds = getUserBounds(userLocation);
      
      // Appeler le service TomTom avec ces limites
      tomtomIncidents = await tomtomService.getTrafficIncidents(bounds);
      
      console.log(`Récupéré ${tomtomIncidents.length} incidents TomTom`);
    } catch (tomtomError) {
      console.error('Erreur lors du chargement des incidents TomTom:', tomtomError);
      tomtomIncidents = []; // En cas d'erreur, utiliser un tableau vide
    }

    // Fusionner les incidents locaux et TomTom
    const allIncidents = mergeIncidents(localIncidents, tomtomIncidents);
    console.log(`Total d'incidents après fusion: ${allIncidents.length}`);

    // Mettre à jour l'état avec les incidents combinés
    setIncidents(allIncidents);
    
    // Activer le panneau d'incidents proches s'il y en a
    if (allIncidents.length > 0 && typeof setShowNearbyIncidents === 'function') {
      setShowNearbyIncidents(true);
    }
  } catch (error) {
    console.error('Erreur générale lors du chargement des incidents:', error);
    
    // En cas d'échec complet, utiliser au moins les incidents de secours
    const fallbackIncidents = getFallbackIncidents(userLocation);
    setIncidents(fallbackIncidents);
    console.log(`Utilisation de ${fallbackIncidents.length} incidents de secours après échec complet`);
  } finally {
    setIsLoadingIncidents(false);
  }
};
  
    fetchIncidents();
  }, [refreshTrigger]);
  // Ajoutez cette fonction et appelez-la à intervalles réguliers
const updateVisibleBounds = useCallback(() => {
  try {
    if (mapRef && mapRef.current) {
      // Tenter d'accéder à la caméra
      const mapCamera = mapRef.current._camera || mapRef.current.camera;
      
      if (mapCamera && mapCamera.centerCoordinate) {
        const [lng, lat] = mapCamera.centerCoordinate;
        const zoomLevel = mapCamera.zoomLevel || 15;
        
        // Mettre à jour le niveau de zoom actuel
        setCurrentZoom(zoomLevel);
        
        // Calculer un offset basé sur le niveau de zoom
        // Plus le zoom est élevé, plus la zone visible est petite
        const offset = 0.01 * Math.pow(2, 15 - zoomLevel);
        
        setVisibleBounds({
          minLat: lat - offset,
          minLon: lng - offset,
          maxLat: lat + offset,
          maxLon: lng + offset
        });
      }
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour des limites:', error);
  }
}, [mapRef]);

// Dans un useEffect pour appeler cette fonction périodiquement
useEffect(() => {
  if (showTrafficPredictions) {
    // Mettre à jour les limites immédiatement
    updateVisibleBounds();
    
    // Puis toutes les 5 secondes
    const intervalId = setInterval(updateVisibleBounds, 5000);
    
    return () => clearInterval(intervalId);
  }
}, [showTrafficPredictions, updateVisibleBounds]);
const handleMapRegionChange = useCallback(() => {
  updateVisibleBounds();
}, [updateVisibleBounds]);

const handleCongestionPointsUpdate = useCallback((points) => {
  console.log(`Reçu ${points?.length || 0} points de congestion dans MapScreen`);
  
  // Optimisation: normaliser les formats des points avant de les stocker
  const normalizedPoints = points.map(point => {
    // S'assurer que chaque point a une structure cohérente
    return {
      coordinate: point.coordinate || [point.longitude || 0, point.latitude || 0],
      intensity: point.intensity || point.congestion/100 || 0.5,
      color: point.color || getTrafficColor(point.intensity || point.congestion/100 || 0.5),
      routeId: point.roadId || point.routeId || null,
      isSignificant: point.isSignificant || point.intensity > 0.65 || false
    };
  }).filter(p => p.coordinate && p.coordinate.length === 2); // Filtrer tout point sans coordonnées valides
  
  setTrafficPoints(normalizedPoints);
}, []);

  const centerOnUser = useCallback(async () => {
    if (userLocation) {
      try {
        if (cameraRef.current) {
          cameraRef.current.setCamera({
            centerCoordinate: userLocation,
            zoomLevel: 15,
            animationMode: 'flyTo',
            animationDuration: 1000,
          });
        }
      } catch (error) {
        console.error('Erreur lors du centrage sur l\'utilisateur:', error);
        Alert.alert("Information", "Centrage sur votre position approximative.");
      }
    } else {
      // Définir une position par défaut (Paris) si aucune position n'est disponible
      const defaultLocation = [2.3488, 48.8534];
      
      if (cameraRef.current) {
        cameraRef.current.setCamera({
          centerCoordinate: defaultLocation,
          zoomLevel: 15,
          animationMode: 'flyTo',
          animationDuration: 1000,
        });
      }
      
      Alert.alert(
        "Position approximative",
        "Utilisation d'une position par défaut. Voulez-vous activer les services de localisation?"
      );
    }
  }, [userLocation]);

const getUserBoundsForTraffic = useCallback(() => {
  if (!userLocation) {
    // Coordonnées par défaut pour Paris
    return {
      minLon: 2.3, 
      minLat: 48.8, 
      maxLon: 2.5, 
      maxLat: 48.9
    };
  }
  
  const [userLng, userLat] = userLocation;
  
  // Créer un rectangle de ~2km autour de l'utilisateur
  const offset = 0.01; // ~1km dans chaque direction
  
  return {
    minLon: userLng - offset,
    minLat: userLat - offset,
    maxLon: userLng + offset,
    maxLat: userLat + offset
  };
}, [userLocation]);



const handleSuggestDepartureTime = useCallback(() => {
  navigation.navigate('RouteSearch', { origin: userLocation });
}, [navigation, userLocation]);

/**
 * Fonction pour aligner les lignes de trafic sur les routes réelles
 * Utilise l'API Map Matching de Mapbox
 */
const alignTrafficToRoads = async (trafficPoints) => {
  // Ne pas essayer d'aligner si nous n'avons pas assez de points
  if (!trafficPoints || trafficPoints.length < 5) return trafficPoints;
  
  try {
    // Regrouper les points par segments cohérents
    const segments = [];
    let currentSegment = [];
    
    // Créer des segments de 100 points maximum (limites d'API)
    trafficPoints.forEach(point => {
      if (!point || !point.coordinate) return;
      
      currentSegment.push(point);
      
      if (currentSegment.length >= 20) {
        segments.push([...currentSegment]);
        currentSegment = [point]; // Commencer un nouveau segment avec le chevauchement
      }
    });
    
    // Ajouter le dernier segment s'il contient des points
    if (currentSegment.length > 0) {
      segments.push(currentSegment);
    }
    
    // Traiter chaque segment séparément
    const alignedPoints = [];
    
    for (const segment of segments) {
      // Préparer les coordonnées pour l'API
      const coordinates = segment
        .map(p => p.coordinate)
        .filter(c => c && c.length === 2);
      
      // Si pas assez de points, passer au segment suivant
      if (coordinates.length < 2) {
        alignedPoints.push(...segment);
        continue;
      }
      
      // Formater les coordonnées pour l'API
      const coordsString = coordinates
        .map(coord => `${coord[0]},${coord[1]}`)
        .join(';');
      
      // Tenter d'appeler l'API Map Matching
      try {
        const response = await fetch(
          `https://api.mapbox.com/matching/v5/mapbox/driving/${coordsString}?geometries=geojson&radiuses=${Array(coordinates.length).fill(50).join(';')}&access_token=${MapboxGL.getAccessToken()}`,
          { method: 'GET' }
        );
        
        const matchData = await response.json();
        
        // Vérifier si nous avons obtenu une correspondance
        if (matchData.code === 'Ok' && matchData.matchings && matchData.matchings.length > 0) {
          const matchedGeometry = matchData.matchings[0].geometry;
          
          // Si nous avons une géométrie, remplacer les coordonnées des points originaux
          if (matchedGeometry && matchedGeometry.coordinates) {
            const matchedCoords = matchedGeometry.coordinates;
            
            // Appliquer les nouvelles coordonnées aux points du segment
            // en conservant les autres propriétés
            for (let i = 0; i < segment.length; i++) {
              // Trouver la coordonnée correspondante (peut nécessiter une adaptation)
              const matchIndex = Math.min(i, matchedCoords.length - 1);
              
              // Créer un nouveau point avec les coordonnées alignées
              alignedPoints.push({
                ...segment[i],
                coordinate: matchedCoords[matchIndex],
                snappedToRoad: true
              });
            }
          } else {
            // Si pas de géométrie correspondante, conserver les points originaux
            alignedPoints.push(...segment);
          }
        } else {
          // Si l'API ne trouve pas de correspondance, conserver les points originaux
          alignedPoints.push(...segment);
        }
      } catch (error) {
        console.warn('Erreur lors de l\'alignement sur les routes:', error);
        // En cas d'erreur, conserver les points originaux
        alignedPoints.push(...segment);
      }
    }
    
    return alignedPoints;
  } catch (error) {
    console.error('Erreur générale dans alignTrafficToRoads:', error);
    return trafficPoints; // Retourner les points originaux en cas d'erreur
  }
};





const fetchRoadSegmentData = async (coordinates) => {
  if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 1) return [];
  
  try {
    // On va traiter les points par lots pour éviter de surcharger l'API
    const batchSize = 5;
    const roadSegments = [];
    
    for (let i = 0; i < Math.min(coordinates.length, 30); i += batchSize) {
      const batch = coordinates.slice(i, i + batchSize);
      
      const batchPromises = batch.map(coord => {
        if (!coord || !Array.isArray(coord) || coord.length !== 2) return null;
        
        // Construction de l'URL pour l'API Flow Segment Data de TomTom
        const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?key=${tomtomService.getApiKey()}&point=${coord[1]},${coord[0]}`;
        
        return fetch(url)
          .then(response => response.json())
          .then(data => {
            if (data && data.flowSegmentData && data.flowSegmentData.coordinates) {
              const segmentData = data.flowSegmentData;
              
              // Extraire les coordonnées de la route
              const segmentCoordinates = segmentData.coordinates.coordinate.map(c => [
                c.longitude,
                c.latitude
              ]);
              
              // Calculer un niveau de congestion en comparant la vitesse actuelle à la vitesse fluide
              const currentSpeed = segmentData.currentSpeed || 0;
              const freeFlowSpeed = segmentData.freeFlowSpeed || 1;
              const congestionLevel = Math.max(0, Math.min(1, 1 - (currentSpeed / freeFlowSpeed)));
              
              return {
                coordinates: segmentCoordinates,
                intensity: congestionLevel,
                currentSpeed,
                freeFlowSpeed,
                confidence: segmentData.confidence || 0.5,
                frc: segmentData.frc || 'FRC0'
              };
            }
            return null;
          })
          .catch(err => {
            console.warn(`Erreur lors de la récupération des données de segment pour ${coord}:`, err);
            return null;
          });
      });
      
      try {
        const batchResults = await Promise.all(batchPromises);
        roadSegments.push(...batchResults.filter(Boolean));
      } catch (batchError) {
        console.error('Erreur lors du traitement d\'un lot de segments:', batchError);
      }
    }
    
    console.log(`Récupéré ${roadSegments.length} segments de route alignés`);
    return roadSegments;
    
  } catch (error) {
    console.error('Erreur générale dans fetchRoadSegmentData:', error);
    return [];
  }
};
useEffect(() => {
  if (processedTrafficPoints && processedTrafficPoints.length > 0) {
    console.log("Points traités disponibles:", processedTrafficPoints.length);
    
    // Vérifier le format des données
    const samplePoint = processedTrafficPoints[0];
    console.log("Format d'un point de trafic:", JSON.stringify(samplePoint, null, 2));
    
    // Vérifier si les coordonnées sont dans le bon format
    if (samplePoint.coordinates) {
      console.log("Premier jeu de coordonnées:", samplePoint.coordinates);
      console.log("Nombre de points dans le premier segment:", samplePoint.coordinates.length);
    }
    
    // Vérifier le GeoJSON généré
    const geoJSON = EnhancedTrafficService.convertToGeoJSON(processedTrafficPoints);
    console.log("Nombre de features dans le GeoJSON:", geoJSON.features.length);
    
    if (geoJSON.features.length > 0) {
      console.log("Premier feature:", JSON.stringify(geoJSON.features[0], null, 2));
    }
  }
}, [processedTrafficPoints]);

useEffect(() => {
  if (processedTrafficPoints && processedTrafficPoints.length > 0) {
    console.log(`Création du GeoJSON à partir de ${processedTrafficPoints.length} points`);
    
    // Création du GeoJSON à partir des points
    const features = processedTrafficPoints.map(segment => {
      if (!segment || !segment.coordinates || !Array.isArray(segment.coordinates) || segment.coordinates.length < 2) {
        return null;
      }

      // Déterminer la couleur
      const intensity = segment.intensity || 0;
      let color;
      if (intensity < 0.3) color = '#4CD964';      // Vert - fluide
      else if (intensity < 0.5) color = '#FFCC00'; // Jaune - modéré
      else if (intensity < 0.7) color = '#FF9500'; // Orange - dense
      else color = '#FF3B30';                      // Rouge - très dense
      
      return {
        type: 'Feature',
        properties: {
          intensity: intensity,
          color: color,
          currentSpeed: segment.currentSpeed,
          freeFlowSpeed: segment.freeFlowSpeed
        },
        geometry: {
          type: 'LineString',
          coordinates: segment.coordinates
        }
      };
    }).filter(Boolean);
    
    console.log(`GeoJSON créé avec ${features.length} features`);
    
    setTrafficGeoJSON({
      type: 'FeatureCollection',
      features: features
    });
  }
}, [processedTrafficPoints]);
// 3. Remplacer l'useEffect qui traite les points de trafic
useEffect(() => {
  const processTrafficData = async () => {
    if (!trafficPoints || trafficPoints.length === 0) {
      setProcessedTrafficPoints([]);
      return;
    }
    
    try {
      // Étape 1: Filtrage basique pour éliminer les points invalides et réduire la densité
      const validPoints = trafficPoints
        .filter(p => p && p.coordinate && Array.isArray(p.coordinate) && p.coordinate.length === 2)
        // Limiter le nombre de points pour éviter de surcharger l'API
        .slice(0, 30);
      
      if (validPoints.length === 0) {
        setProcessedTrafficPoints([]);
        return;
      }
      
      // Étape 2: Récupérer les segments de route alignés auprès de TomTom
      let alignedSegments;
      
      try {
        // Option 1: Utiliser l'API TomTom si elle est disponible
        if (tomtomService && tomtomService.getApiKey) {
          alignedSegments = await fetchRoadSegmentData(validPoints.map(p => p.coordinate));
        } else {
          throw new Error("Service TomTom non disponible");
        }
      } catch (tomTomError) {
        console.warn("Erreur avec l'API TomTom, repli sur l'alignement simple:", tomTomError);
        
        // Option 2: Si l'API TomTom échoue, utiliser l'algorithme de lissage simple
        alignedSegments = validPoints.map(point => ({
          coordinates: [point.coordinate],
          intensity: point.intensity || 0.5,
          currentSpeed: 0,
          freeFlowSpeed: 0,
          confidence: 0.5
        }));
      }
      
      // Mise à jour de l'état avec les segments alignés
      setProcessedTrafficPoints(alignedSegments);
      
    } catch (error) {
      console.error('Erreur lors du traitement des données de trafic:', error);
      // En cas d'erreur, utiliser les points filtrés mais non alignés
      const fallbackPoints = trafficPoints
        .filter(p => p && p.coordinate && Array.isArray(p.coordinate) && p.coordinate.length === 2)
        .map(p => ({
          coordinates: [p.coordinate],
          intensity: p.intensity || 0.5
        }));
      
      setProcessedTrafficPoints(fallbackPoints);
    }
  };
  
  processTrafficData();
}, [trafficPoints, tomtomService]);















  const toggleNavigation = useCallback(() => {
    if (!isNavigating) {
      // Ouvrir le menu du bas au lieu de naviguer directement
      setShowBottomMenu(true);
    } else {
      setIsNavigating(false);
    }
  }, [isNavigating]);

  const navigateToRouteSearch = useCallback(() => {
    setShowBottomMenu(false);
    // Vérifier si la localisation est disponible avant de naviguer
    if (!userLocation) {
      Alert.alert(
        "Position non disponible",
        "Vous devez autoriser l'accès à votre position pour utiliser la navigation.",
        [
          { text: "Annuler", style: "cancel" },
          { 
            text: "Paramètres", 
            onPress: () => {
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:');
              } else {
                Linking.openSettings();
              }
            }
          },
          {
            text: "Continuer quand même",
            onPress: () => navigation.navigate('RouteSearch')
          }
        ]
      );
      return;
    }
    
    navigation.navigate('RouteSearch');
  }, [navigation, userLocation]);

  const signalIncident = useCallback(async () => {
    try {
      // Vérifier si l'utilisateur est connecté
      const userToken = await authService.getToken();      
      if (!userToken) {
        // Si l'utilisateur n'est pas connecté, afficher un dialogue
        Alert.alert(
          "Connexion requise",
          "Vous devez être connecté pour signaler un incident",
          [
            { text: "Annuler", style: "cancel" },
            { 
              text: "Se connecter", 
              onPress: () => navigation.navigate('Login', {
                redirectAfterLogin: 'ReportIncident',
                locationLat: userLocation ? userLocation[1] : null,
                locationLng: userLocation ? userLocation[0] : null
              })
            }
          ]
        );
        return;
      }
      
      // Vérifier que l'API est correctement chargée avant de naviguer
      if (!apiService || !apiService.incidents) {
        console.log('Rechargement des services API...');
        
        try {
          const apiModule = require('../services/api');
          if (apiModule && apiModule.default) {
            // eslint-disable-next-line no-global-assign
            apiService = apiModule.default;
          }
        } catch (importError) {
          console.warn('Erreur lors de la réimportation du service API:', importError);
        }
        
        // Si l'API n'est toujours pas disponible, utiliser une approche alternative
        if (!apiService || !apiService.incidents) {
          console.warn("API non disponible, passage en mode alternatif");
        }
      }
      
      // Vérifier si la localisation de l'utilisateur est disponible
      if (!userLocation) {
        Alert.alert(
          "Position non disponible",
          "Vous devez autoriser l'accès à votre position pour signaler un incident.",
          [
            { text: "Annuler", style: "cancel" },
            { 
              text: "Paramètres", 
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              }
            },
            {
              text: "Utiliser la carte",
              onPress: () => {
                // Option pour signaler à l'emplacement actuel de la carte
                // Au lieu de la position de l'utilisateur
                const centerCoords = mapRef.current?.getCenter();
                if (centerCoords) {
                  navigation.navigate('ReportIncident', { 
                    location: centerCoords,
                    isNavigating: isNavigating
                  });
                } else {
                  Alert.alert("Erreur", "Impossible de déterminer la position sur la carte.");
                }
              }
            }
          ]
        );
        return;
      }
      
      // Si tout est bon, naviguer vers l'écran de signalement
      if (isNavigating) {
        console.log('Signalement pendant la navigation, redirection vers ReportIncident');
        navigation.navigate('ReportIncident', { 
          location: userLocation,
          isNavigating: true,
          returnToNavigation: true
        });
      } else {
        navigation.navigate('ReportIncident', { 
          location: userLocation
        });
      }
    } catch (error) {
      console.error('Erreur lors du signalement:', error);
      Alert.alert("Erreur", "Une erreur est survenue. Veuillez réessayer.");
    }
  }, [userLocation, navigation, isNavigating, mapRef]);

  // Fonction améliorée pour le rendu des icônes d'incidents
  const renderAnnotations = useCallback(() => {
    return incidents.map((incident) => {
      // Vérifier que l'incident est valide
      if (!incident || (!incident.coords && !incident.location)) {
        console.warn('Incident sans coordonnées:', incident);
        return null;
      }
      
      // Déterminer les coordonnées
      let coords = incident.coords;
      
      if (!coords && incident.location) {
        if (Array.isArray(incident.location)) {
          coords = incident.location;
        } else if (incident.location.coordinates && Array.isArray(incident.location.coordinates)) {
          coords = incident.location.coordinates;
        }
      }
      
      if (!coords) {
        console.warn('Impossible de déterminer les coordonnées pour:', incident);
        return null;
      }
      
      // Obtenir les informations de type d'incident
      const typeInfo = getIncidentTypeInfo(incident.type);
      const iconSource = INCIDENT_ICONS[incident.type] || INCIDENT_ICONS['hazard'];
      
      // Couleur néon vibrante
      const neonColor = typeInfo.color;
      
      // Léger décalage aléatoire pour éviter les superpositions exactes
      const jitterFactor = 0.00015; // Environ 15 mètres
      const jitterLng = coords[0] + (Math.random() - 0.5) * jitterFactor;
      const jitterLat = coords[1] + (Math.random() - 0.5) * jitterFactor;
      
      return (
        <MapboxGL.PointAnnotation
          key={incident.id.toString()}
          id={incident.id.toString()}
          coordinate={[jitterLng, jitterLat]} // Utiliser les coordonnées avec jitter
          onSelected={() => {
            // Au lieu de naviguer directement, afficher la popup
            setSelectedIncident(incident);
            setShowPopup(true);
          }}
        >
          <View style={styles.annotationWrapper}>
            {/* Container extérieur avec effet de halo néon */}
            <View style={[
              styles.haloContainer, 
              { 
                shadowColor: neonColor,
                borderColor: neonColor,
                backgroundColor: `${neonColor}30` // Plus visible que 10
              }
            ]}>
              {/* Container intérieur pour l'icône - NON BLANC mais de la couleur du type d'incident */}
              <View style={[styles.annotationContainer, { backgroundColor: neonColor }]}>
                <Image 
                  source={iconSource}
                  style={[styles.annotationIcon]}
                  resizeMode="contain"
                />
              </View>
            </View>
          </View>
          
          {/* Callout qui apparaît au clic */}
          <MapboxGL.Callout title={typeInfo.title} />
        </MapboxGL.PointAnnotation>
      );
    }).filter(Boolean);
  }, [incidents]);
  
 const handleIncidentVote = async (incidentId, isConfirmed) => {
  try {
    console.log(`Vote pour incident ${incidentId}: ${isConfirmed ? 'confirmer' : 'infirmer'}`);
    
    // Appeler l'API pour enregistrer le vote
    let voteResult;
    try {
      voteResult = await apiService.incidents.vote(incidentId, isConfirmed);
      console.log('Résultat du vote API:', voteResult);
    } catch (apiError) {
      console.error('Erreur API lors du vote:', apiError);
      // Continuer malgré l'erreur API pour montrer la réponse à l'utilisateur
      voteResult = { success: false };
    }
    
    // Mettre à jour l'incident dans la liste locale
    setIncidents(prevIncidents => {
      return prevIncidents.map(inc => {
        if (inc.id === incidentId) {
          // Mettre à jour les votes et le score de fiabilité
          const updatedVotes = {
            up: isConfirmed ? (inc.votes?.up || 0) + 1 : inc.votes?.up || 0,
            down: !isConfirmed ? (inc.votes?.down || 0) + 1 : inc.votes?.down || 0
          };
          
          return {
            ...inc,
            votes: updatedVotes,
            reliability_score: voteResult?.reliability || inc.reliability_score,
            active: voteResult?.active !== undefined ? voteResult.active : inc.active
          };
        }
        return inc;
      });
    });
    
    // Fermer la popup après le vote
    setShowPopup(false);
    setSelectedIncident(null);
    
    // Message de confirmation à l'utilisateur
    if (isConfirmed) {
      // Message pour vote positif
      Alert.alert('Merci', 'Vous avez confirmé cet incident');
    } else {
      // Message pour vote négatif
      Alert.alert('Merci', 'Vous avez signalé que cet incident n\'est plus présent');
    }
    
    // Rafraîchir tous les incidents après un vote
    setTimeout(() => {
      setRefreshTrigger(prev => prev + 1);
    }, 2000);
  } catch (error) {
    console.error('Erreur lors du vote:', error);
    Alert.alert('Erreur', 'Une erreur est survenue lors du vote. Veuillez réessayer.');
  }
};

// Partie visuelle (JSX après le return)
return (
  <View style={styles.container}>
 <MapboxGL.MapView
  ref={mapRef}
  style={styles.map}
  styleURL={MapboxGL.StyleURL.Street}
  onDidFinishRenderingMapFully={updateVisibleBounds}
  onDidFinishLoadingStyle={() => setIsMapStyleLoaded(true)}
  onRegionDidChange={handleMapRegionChange}
  compassEnabled={false}
  logoEnabled={false}
  attributionEnabled={false}
>

    <MapboxGL.Camera
      ref={cameraRef}
      zoomLevel={15}
      centerCoordinate={[2.3488, 48.8534]} // Paris
      followUserMode={isNavigating ? MapboxGL.UserTrackingModes.FollowWithHeading : MapboxGL.UserTrackingModes.None}
      followUserLocation={isNavigating}
    />

    {/* Position utilisateur */}
    {userLocation && (
      <MapboxGL.PointAnnotation id="user-location" coordinate={userLocation}>
        <View style={styles.userLocationMarker}>
          <View style={styles.userLocationDot} />
        </View>
      </MapboxGL.PointAnnotation>
    )}

    {/* Incidents */}
    {renderAnnotations()}
    
    {/* Search Result Marker */}
    {renderSearchResultMarker()}
{/* Points de congestion avec alignement sur les routes */}
{showTrafficPredictions && (
  <>
    {/* Debug: Nombre de features dans le GeoJSON */}
    {console.log(`Rendu avec ${trafficGeoJSON.features?.length || 0} features`)}
 
   

{isMapStyleLoaded && showTrafficPredictions && trafficGeoJSON.features?.length > 0 && (      <MapboxGL.ShapeSource
        id="trafficSource"
        shape={trafficGeoJSON}
      >
        <MapboxGL.LineLayer
          id="trafficLineLayer"
          style={{
            lineWidth: 4,
            lineColor: ['get', 'color'],
            lineOpacity: 0.8,
            lineCap: 'round',
            lineJoin: 'round'
          }}
        />
      </MapboxGL.ShapeSource>
    )}
    
    {/* Légende de trafic */}
    {showTrafficLegend && (
      <View style={styles.trafficLegend}>
        <TouchableOpacity 
          style={getTrafficLegendHeaderStyle(showTrafficLegendDetails)}
          onPress={() => setShowTrafficLegendDetails(!showTrafficLegendDetails)}
        >
          <Text style={styles.trafficLegendTitle}>Conditions de trafic</Text>
          <Ionicons 
            name={showTrafficLegendDetails ? "chevron-up" : "chevron-down"} 
            size={16} 
            color="#666"
          />
        </TouchableOpacity>
        
        {showTrafficLegendDetails && (
          <View style={styles.trafficLegendContent}>
            <View style={styles.trafficLegendItem}>
              <View style={[styles.trafficLegendLine, {backgroundColor: '#4CD964'}]} />
              <Text style={styles.trafficLegendText}>Fluide</Text>
            </View>
            <View style={styles.trafficLegendItem}>
              <View style={[styles.trafficLegendLine, {backgroundColor: '#FFCC00'}]} />
              <Text style={styles.trafficLegendText}>Modéré</Text>
            </View>
            <View style={styles.trafficLegendItem}>
              <View style={[styles.trafficLegendLine, {backgroundColor: '#FF9500'}]} />
              <Text style={styles.trafficLegendText}>Dense</Text>
            </View>
            <View style={styles.trafficLegendItem}>
              <View style={[styles.trafficLegendLine, {backgroundColor: '#FF3B30'}]} />
              <Text style={styles.trafficLegendText}>Très dense</Text>
            </View>
          </View>
        )}
      </View>
    )}
  </>
)}
  </MapboxGL.MapView>


  {/* BARRE DE RECHERCHE */}
  <SafeAreaView style={styles.topBarContainer}>
    <View style={styles.searchBarWrapper}>
      <TouchableOpacity style={styles.profileButton} onPress={() => isUserLoggedIn ? navigation.navigate('Dashboard') : navigation.navigate('Login')}>
        <View style={[styles.avatarContainer, { backgroundColor: getAvatarColor() }]}>
          <Text style={styles.avatarText}>{getUserInitials()}</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.wazeSearchBar} 
        onPress={() => navigation.navigate('Search')}
      >
        <Ionicons name="search" size={20} color="#5D5D5D" />
        <Text style={styles.wazeSearchText}>Rechercher une destination</Text>
      </TouchableOpacity>
    </View>
  </SafeAreaView>

  {/* VITESSE */}
  {isNavigating && (
    <View style={styles.currentSpeedContainer}>
      <Text style={styles.currentSpeedValue}>{currentSpeed}</Text>
      <Text style={styles.currentSpeedUnit}>km/h</Text>
      
      <View style={styles.speedLimitBadge}>
        <Text style={styles.speedLimitText}>{speedLimit}</Text>
      </View>
    </View>
  )}

        {/* Boutons secondaires (droite bas) */}
        <View style={styles.rightActionsContainer}>
          <TouchableOpacity style={styles.secondaryButton} onPress={centerOnUser}>
            <Ionicons name="locate" size={24} color="#1A73E8" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.secondaryButton, isNavigating ? styles.activeButton : {}]} 
            onPress={toggleNavigation}
          >
            <MaterialIcons 
              name="directions" 
              size={24} 
              color={isNavigating ? "#FFFFFF" : "#1A73E8"}
            />
          </TouchableOpacity>
          
          {/* Bouton pour les prédictions de trafic */}
          <TouchableOpacity 
            style={[styles.secondaryButton, showTrafficPredictions && styles.activeButton]} 
            onPress={() => setShowTrafficPredictions(!showTrafficPredictions)}
          >
            <MaterialCommunityIcons 
              name="traffic-light" 
              size={24} 
              color={showTrafficPredictions ? "#FFFFFF" : "#1A73E8"} 
            />
          </TouchableOpacity>
          
          {/* Bouton pour accéder à la liste des incidents */}
          <TouchableOpacity 
            style={styles.secondaryButton} 
            onPress={navigateToIncidentList}
          >
            <MaterialCommunityIcons name="format-list-bulleted" size={24} color="#1A73E8" />
          </TouchableOpacity>
        </View>
  {/* Menu inférieur déroulable */}
  <BottomMenuDrawer 
    visible={showBottomMenu}
    onClose={() => setShowBottomMenu(false)}
    onDestinationPress={navigateToRouteSearch}
    userLocation={userLocation}
  />
  
  {/* Boutons d'action en bas */}
  <View style={styles.bottomActionsContainer}>
    {/* Bouton de signalement d'incident avec '+' et à gauche */}
    <TouchableOpacity style={styles.modernReportButton} onPress={signalIncident}>
      <Ionicons name="add" size={30} color="white" />
    </TouchableOpacity>
  </View>
  
  {/* POPUP D'INCIDENT - Maintenant swipeable */}
  {showPopup && selectedIncident && (
    <ModernIncidentPopup 
      incident={selectedIncident}
      onClose={() => {
        setShowPopup(false);
        setSelectedIncident(null);
      }}
      onVote={handleIncidentVote}
    />
  )}
  
  {/* LISTE DES INCIDENTS PROCHES - Maintenant swipeable */}
  {showNearbyIncidents && !showPopup && !showSearchResultPopup && !isNavigating && incidents.length > 0 && (
    <NearbyIncidentsList 
      incidents={incidents}
      onClose={() => setShowNearbyIncidents(false)}
      onIncidentSelect={(incident) => {
        setSelectedIncident(incident);
        setShowPopup(true);
        
        // Centrer sur l'incident sélectionné
        let coords = incident.coords;
        if (!coords && incident.location) {
          if (Array.isArray(incident.location)) {
            coords = incident.location;
          } else if (incident.location.coordinates && Array.isArray(incident.location.coordinates)) {
            coords = incident.location.coordinates;
          }
        }
        
        if (coords && cameraRef.current) {
          cameraRef.current.setCamera({
            centerCoordinate: coords,
            zoomLevel: 15,
            animationMode: 'flyTo',
            animationDuration: 1000,
          });
        }
      }}
    />
  )}
  
  {/* POPUP DE RÉSULTAT DE RECHERCHE - Swipeable */}
  {showSearchResultPopup && searchResult && (
    <SearchResultPopup
      place={searchResult}
      onClose={() => setShowSearchResultPopup(false)}
      onNavigate={navigateToSearchResult}
    />
  )}
{showTrafficPredictions && (
  <TrafficPredictionOverlay
  mapRef={mapRef}
  visible={showTrafficPredictions}
  currentRoute={currentRoute}
  userLocation={userLocation}
  visibleBounds={visibleBounds}
  predictionType={predictionType}
  onSuggestDepartureTime={handleSuggestDepartureTime}
  onCongestionPointsUpdate={setTrafficPoints}
  onToggleLegend={() => setShowTrafficLegend(!showTrafficLegend)} // Nouvelle prop
/>
)}

</View>
);

};





// Styles
const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  map: { 
    flex: 1,
    ...StyleSheet.absoluteFillObject,
  },
  
  // AVATAR ET PROFIL
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A73E8',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
  },
  avatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    marginRight: 10,
  },

  // MARQUEURS D'INCIDENTS
  annotationWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 65,
    height: 65,
    zIndex: 10,
  },
  haloContainer: {
    width: 55, 
    height: 55,
    borderRadius: 27.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1.8,
    shadowRadius: 12,
    elevation: 15,
    borderWidth: 0,
  },
  annotationContainer: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 0,
  },
  annotationIcon: {
    width: 16,
    height: 16,
  },
  // POSITION DE L'UTILISATEUR
  userLocationMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(66, 133, 244, 0.2)',
    borderWidth: 3,
    borderColor: '#4285f4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userLocationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4285f4',
  },
  
  // BARRE DE RECHERCHE WAZE-LIKE
  topBarContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  wazeSearchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 24,
    paddingHorizontal: 15,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 5,
  },
  wazeSearchText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#5D5D5D',
    fontWeight: '400',
  },
  
  // POPUP D'INCIDENT MODERNE (style Waze)
  modernPopupContainer: {
    position: 'absolute',
    top: '10%',
    left: 16,
    right: 16,
    borderRadius: 16,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 100,
    overflow: 'hidden',
  },
  modernPopupContent: {
    padding: 16,
  },
  modernPopupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modernPopupIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modernPopupIcon: {
    width: 26,
    height: 26,
  },
  modernPopupHeaderText: {
    flex: 1,
  },
  modernPopupTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  modernPopupSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  modernPopupVoteContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  modernVoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flex: 1,
    marginHorizontal: 5,
  },
  modernVoteButtonText: {
    marginLeft: 6,
    fontWeight: '500',
    fontSize: 14,
  },
  
  // AFFICHAGE DE LA VITESSE ACTUELLE
  currentSpeedContainer: {
    position: 'absolute',
    top: '25%',
    alignSelf: 'center',
    alignItems: 'center',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(80, 80, 160, 0.85)',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  currentSpeedValue: {
    fontSize: 60,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: -5,
  },
  currentSpeedUnit: {
    fontSize: 18,
    color: 'white',
    opacity: 0.8,
  },
  speedLimitBadge: {
    position: 'absolute',
    bottom: -20,
    backgroundColor: 'white',
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
  },
  speedLimitText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  
  // LISTE DES INCIDENTS PROCHES (style écran de droite)
  nearbyIncidentsContainer: {
    position: 'absolute',
    top:'10%',
    left: 16,
    right: 16,
    backgroundColor: 'white',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 6,
    padding: 0,
    overflow: 'hidden',
  },
  nearbyIncidentsHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nearbyIncidentsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  nearbyIncidentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  nearbyIncidentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  nearbyIncidentIconImage: {
    width: 22,
    height: 22,
  },
  nearbyIncidentInfo: {
    flex: 1,
  },
  nearbyIncidentTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  nearbyIncidentLocation: {
    fontSize: 14,
    color: '#666',
  },
  nearbyIncidentTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginLeft: 8,
  },
  
  // BOUTON PRINCIPAL MODERNE
  modernReportButton: {
    position: 'absolute',
    bottom: 60,
    left: 1,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f5b041', // Bleu au lieu de rouge
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 10,
  },
  
   // Menu du bas
   modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  bottomMenu: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: 300,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  bottomMenu: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 20, // Zéro padding en bas pour éviter la barre blanche
  },
  bottomMenuHandle: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handleBar: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#DDDDDD',
  },
  bottomMenuTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  destinationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12, // Réduit pour donner plus d'espace au contenu
  },
  recentDestinationsScroll: {
    flex: 1, // Permet au ScrollView de prendre tout l'espace disponible
  },
  recentDestinations: {
    paddingBottom: 20, // Ajoute un padding en bas pour éviter que le contenu ne soit coupé
  },

  destinationButtonIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  destinationButtonText: {
    fontSize: 16,
    flex: 1,
  },
  recentDestinations: {
    marginTop: 10,
  },
  recentDestinationsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  recentDestinationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  recentDestinationText: {
    fontSize: 16,
    marginLeft: 12,
  },
  modernPopupReporter: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  bottomActionsContainer: {
  position: 'absolute',
  bottom: 32,
  left: 16,
  right: 16,
  flexDirection: 'row',
  alignItems: 'center', // Centrer verticalement
  padding: 0, // Supprimer le padding par défaut
},
  // BOUTONS DE DROITE
rightActionsContainer: {
  position: 'absolute',
  bottom: 32,
  right: 16,
  flexDirection: 'column',
  gap: 12, // Espacement réduit entre les boutons
},
  secondaryButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
  },
  activeButton: {
    backgroundColor: '#1A73E8',
  },
  annotationWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 60,
  },
  haloContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1.0,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 0,
  },
  annotationContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 0,
  },
  annotationIcon: {
    width: 18,
    height: 18,
  },
trafficLegend: {
  position: 'absolute',
  top: Platform.OS === 'ios' ? 110 : 90,
  right: 10,
  backgroundColor: 'white',
  borderRadius: 8,
  overflow: 'hidden',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.2,
  shadowRadius: 3,
  elevation: 5,
  minWidth: 150,
},
  trafficLegendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0', // Valeur fixe au lieu de dépendre de showTrafficLegendDetails
  },
trafficLegendTitle: {
  fontWeight: 'bold',
  fontSize: 14,
  color: '#333',
},
trafficLegendContent: {
  padding: 8,
},
trafficLegendItem: {
  flexDirection: 'row',
  alignItems: 'center',
  marginVertical: 4,
},
trafficLegendLine: {
  width: 20,
  height: 4,
  borderRadius: 2,
  marginRight: 8,
},
trafficLegendText: {
  fontSize: 12,
  color: '#555',
},
});
export default MapScreen;