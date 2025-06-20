// NavigationScreen.jsx - Enhanced with Waze-like UI
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  SafeAreaView, 
  Platform,
  Alert,
  Dimensions,
  Animated,
  StatusBar,
  Image,
  TextInput,
  Modal,
  FlatList,
  PanResponder,
  ScrollView,
} from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import * as turf from '@turf/turf';
import * as Location from 'expo-location';
import apiService from '../services/api';
import { BlurView } from 'expo-blur';
import NavigationService from '../services/unified/NavigationService';
import SwipeablePopup from '../components/SwipeablePopup';
import tomtomService from '../services/tomtomService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import authService from '../services/auth/auth';
// Définir les constantes d'images en haut de votre fichier
// Constantes pour les icônes de navigation
const NAVIGATION_ICONS = {
  'arrive': require('../assets/arrive-icon.png'),
  'depart': require('../assets/depart-icon.png'),
  'destination': require('../assets/arrive-icon.png'),
  'arrow': require('../assets/navigation-arrow.png'),
  'straight': require('../assets/straight-icon.png'),
  'turn': require('../assets/turn-icon.png'),
    'merge': require('../assets/merge.png'),
  'report': require('../assets/plus.png'),
  'fork': require('../assets/fork.png'),
  'user': require('../assets/navigation-arrow.png') // Ajout pour l'icône utilisateur
};
// Constants
const DEFAULT_ZOOM_LEVEL = 15;
const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoidG95Y2FuIiwiYSI6ImNtYThhMWR0ZjE0NGIycXM2bG05ZXFxdHoifQ.5HZaIXzWUuPTa6lrSenaGQ';
const DEVIATION_CHECK_CONSTANTS = {
  DISTANCE_THRESHOLD: 40, // Mètres
  TIME_THRESHOLD: 5000,   // 5 secondes
  MAX_CHECKS_BEFORE_REROUTE: 2
};

// Screen dimensions
const { width, height } = Dimensions.get('window');
const INCIDENT_ICONS = {
  'traffic': require('../assets/icons/traffic.png'),
  'accident': require('../assets/icons/accident.png'),
  'hazard': require('../assets/icons/hazard.png'), 
  'police': require('../assets/icons/police.png'),
  'closure': require('../assets/icons/closure.png')
};
// Dans NavigationScreen.jsx, définissez directement INCIDENT_WEIGHTS
const INCIDENT_WEIGHTS = {
  'accident': { severityScore: 40, distanceImpact: 800, delayFactor: 0.1 },
  'traffic': { severityScore: 25, distanceImpact: 600, delayFactor: 0.08 },
  'closure': { severityScore: 60, distanceImpact: 1000, delayFactor: 0.3 },
  'police': { severityScore: 15, distanceImpact: 200, delayFactor: 0.05 },
  'hazard': { severityScore: 20, distanceImpact: 300, delayFactor: 0.06 }
};
// Incident types with colors and icons
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

// Fonction helper pour obtenir l'icône de direction appropriée - VERSION AMÉLIORÉE AVEC LOGGING
const getStepIcon = (step) => {
  if (!step || !step.maneuver || !step.maneuver.type) {
    console.log('Step sans maneuver:', step);
    return NAVIGATION_ICONS.straight;
  }
  
  const maneuverType = step.maneuver.type;
  const maneuverModifier = step.maneuver.modifier;
  
  console.log('Maneuver type:', maneuverType, 'modifier:', maneuverModifier);
  
  if (maneuverType === 'arrive') {
    console.log('Returning arrive icon');
    return NAVIGATION_ICONS.arrive;
  }
  
  if (maneuverType === 'depart') {
    console.log('Returning depart icon');
    return NAVIGATION_ICONS.depart;
  }
  
  // Pour les virages
  if (maneuverType === 'turn' || maneuverType.includes('turn')) {
    console.log('Detected turn maneuver');
    return NAVIGATION_ICONS.turn;
  }
  
  // Utiliser l'icône de flèche pour les manœuvres de navigation courantes
  if (maneuverType === 'continue' || maneuverType.includes('continue')) {
    console.log('Detected continue maneuver');
    return NAVIGATION_ICONS.straight;
  }
  
  if (maneuverType === 'merge' || maneuverType.includes('merge')) {
    console.log('Detected merge maneuver');
    return NAVIGATION_ICONS.merge;
  }
  
  if (maneuverType === 'fork' || maneuverType.includes('fork')) {
    console.log('Detected fork maneuver');
    return NAVIGATION_ICONS.fork;
  }
  
  // Par défaut
  console.log('Default case - returning arrow icon');
  return NAVIGATION_ICONS.straight;
};

// Utility functions
const getIncidentColor = (type) => INCIDENT_TYPES[type]?.color || '#8E8E93';
const getIncidentIcon = (type) => INCIDENT_TYPES[type]?.icon || 'exclamation';

// Bottom sliding menu component (Waze-like)
const BottomSlideMenu = ({ 
  visible, 
  routeData, 
  destination, 
  destinationName, 
  eta, 
  distance, 
  onStartNavigation, 
  isNavigating, 
  onShowRouteOptions,
  onRecenterMap,
  selectedRouteIndex,
  routes = [],
  onShowSteps // Cette prop est correcte, gardez-la
}) => {
const [menuHeight, setMenuHeight] = useState(180);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const [isExpanded, setIsExpanded] = useState(false);
  
  const toggleMenu = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    
    Animated.spring(slideAnim, {
      toValue: newState ? 1 : 0,
      friction: 8,
      useNativeDriver: false,
    }).start();
  };
  
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (!isExpanded && gestureState.dy > 0) {
          return;
        }
        if (isExpanded) {
          const newHeight = Math.max(
            180,
            380 - gestureState.dy
          );
          setMenuHeight(newHeight);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 50 && isExpanded) {
          setIsExpanded(false);
          Animated.spring(slideAnim, {
            toValue: 0,
            friction: 8,
            useNativeDriver: false,
          }).start();
        } 
        else if (gestureState.dy < -50 && !isExpanded) {
          setIsExpanded(true);
          Animated.spring(slideAnim, {
            toValue: 1,
            friction: 8,
            useNativeDriver: false,
          }).start();
        }
        else {
          Animated.spring(slideAnim, {
            toValue: isExpanded ? 1 : 0,
            friction: 8,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;
  
  const maxHeight = 500;
  const minHeight = 200;
  
  const menuHeightAnimated = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [minHeight, maxHeight],
  });
  
 if (!visible) return null;
  
  return (
    <Animated.View 
       style={[
    styles.bottomSlideMenu,
    { 
      height: menuHeightAnimated,
      backgroundColor: 'rgba(255, 255, 255, 0.95)', // Légèrement transparent
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -3 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 15,
    }
  ]}
  {...panResponder.panHandlers}
>

      <TouchableOpacity 
        style={styles.menuHandleBar} 
        onPress={toggleMenu}
        activeOpacity={0.7}
      >
        <View style={styles.handleBar} />
        <Ionicons 
          name={isExpanded ? "chevron-down" : "chevron-up"} 
          size={20} 
          color="#999"
          style={{ marginTop: 5 }}
        />
      </TouchableOpacity>
      
      <View style={styles.destinationHeader}>
        <Text style={styles.destinationTitle} numberOfLines={1}>
          {destinationName || "Destination"}
        </Text>
        {eta && (
          <Text style={styles.destinationEta}>
            Arrivée à <Text style={styles.etaHighlight}>{eta}</Text>
          </Text>
        )}
      </View>
      
      <View style={styles.routeInfoContainer}>
        <View style={styles.routeInfoItem}>
          <Text style={styles.routeInfoValue}>
            {routeData ? Math.floor(routeData.duration / 60) : 0}
          </Text>
          <Text style={styles.routeInfoLabel}>min</Text>
        </View>
        
        <View style={styles.routeInfoDivider} />
        
        <View style={styles.routeInfoItem}>
          <Text style={styles.routeInfoValue}>
            {distance || '0.0'}
          </Text>
          <Text style={styles.routeInfoLabel}>km</Text>
        </View>
        
        <TouchableOpacity 
          style={styles.routesButton}
          onPress={onShowRouteOptions}
        >
          <View style={styles.routeCount}>
            <Text style={styles.routeCountText}>{routes.length}</Text>
          </View>
          <Text style={styles.routesButtonText}>Routes</Text>
        </TouchableOpacity>
      </View>
      
     <View style={styles.actionButtonsRow}>
    <TouchableOpacity 
      style={styles.actionButton}
      onPress={onRecenterMap}
    >
      <Ionicons name="locate" size={24} color="#777" />
    </TouchableOpacity>
    
    <TouchableOpacity 
      style={[
        styles.startButton,
        isNavigating ? styles.stopButton : {}
      ]}
      onPress={onStartNavigation}
    >
      <Text style={styles.startButtonText}>
        {isNavigating ? "Arrêter" : "Démarrer"}
      </Text>
      <Ionicons 
        name={isNavigating ? "stop-circle" : "navigate"} 
        size={20} 
        color="#FFF" 
        style={{ marginLeft: 8 }}
      />
    </TouchableOpacity>
    
   <TouchableOpacity 
      style={styles.actionButton}
      onPress={onShowSteps} // Utilise la prop fonction passée depuis le parent
    >
      <Ionicons name="list" size={24} color="#777" />
    </TouchableOpacity>
  </View>
      {isExpanded && (
        <ScrollView 
          style={{ maxHeight: 200 }}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.expandedTitle}>Alternative Routes</Text>
          {routes.map((route, index) => (
            <View 
              key={`route-summary-${index}`}
              style={[
                styles.routeSummary,
                selectedRouteIndex === index && styles.selectedRouteSummary
              ]}
            >
              <View style={[styles.routeColorBar, { backgroundColor: route.color || '#3887be' }]} />
              <View style={styles.routeSummaryDetails}>
                <Text style={styles.routeName}>{route.name || `Route ${index + 1}`}</Text>
                <Text style={styles.routeStats}>
                  {Math.floor(route.duration / 60)} min • {(route.distance / 1000).toFixed(1)} km
                </Text>
              </View>
              {selectedRouteIndex === index && (
                <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </Animated.View>
  );
};
// Modification du composant RoutesOptionsPanel pour mieux afficher les incidents
const RoutesOptionsPanel = ({ 
  visible, 
  onClose, 
  routes = [], 
  selectedRouteIndex, 
  onSelectRoute 
}) => {
  const slideAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 1,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);
  
  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-300, 0],
  });
  
  if (!visible) return null;
  
 // Fonction améliorée pour rendre les icônes d'incidents
const renderIncidentIcons = (route) => {
  // Vérifier si des incidents sont définis sur cet itinéraire
  if (!route.incidentsCount && !route.incidentTypes) {
    console.log('Pas d\'information d\'incidents pour cet itinéraire:', route.id);
    return (
      <View style={styles.noIncidentsContainer}>
        <Ionicons name="checkmark-circle" size={16} color="#34C759" />
        <Text style={styles.noIncidentsText}>Pas d'incidents</Text>
      </View>
    );
  }

  const incidentsCount = route.incidentsCount || 0;
  
  if (incidentsCount === 0) {
    return (
      <View style={styles.noIncidentsContainer}>
        <Ionicons name="checkmark-circle" size={16} color="#34C759" />
        <Text style={styles.noIncidentsText}>Pas d'incidents</Text>
      </View>
    );
  }
  
  // Afficher les détails des incidents par type
  const types = route.incidentTypes || {};
  console.log('Types d\'incidents sur l\'itinéraire:', types);
  const typesArr = Object.entries(types);
  
  return (
    <View style={styles.incidentsIconsContainer}>
      <FontAwesome5 name="exclamation-triangle" size={14} color="#FF3B30" />
      <Text style={styles.incidentsCountText}>
        {incidentsCount} incident{incidentsCount > 1 ? 's' : ''}: 
        {typesArr.length > 0 ? (
          typesArr.map(([type, count], i) => (
            <Text key={type} style={[styles.incidentTypeText, {color: INCIDENT_TYPES[type]?.color || '#FF3B30'}]}>
              {' '}{count} {INCIDENT_TYPES[type]?.title || type}{i < typesArr.length - 1 ? ',' : ''}
            </Text>
          ))
        ) : (
          <Text style={styles.incidentTypeText}> non spécifiés</Text>
        )}
      </Text>
    </View>
  );
};
  
  return (
    <Animated.View 
      style={[
        styles.routesOptionsPanel,
        { transform: [{ translateY }] }
      ]}
    >
      <View style={styles.routesPanelHeader}>
        <Text style={styles.routesPanelTitle}>Itinéraires disponibles</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={routes}
        keyExtractor={(_, index) => `route-option-${index}`}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={[
              styles.routeOption,
              selectedRouteIndex === index && styles.selectedRouteOption
            ]}
            onPress={() => {
              onSelectRoute(index);
              onClose();
            }}
          >
            <View style={[styles.routeColorIndicator, { backgroundColor: item.color || '#3887be' }]} />
            <View style={styles.routeOptionInfo}>
              <View style={styles.routeOptionHeader}>
                <Text style={styles.routeOptionName}>{item.name || `Route ${index + 1}`}</Text>
                <View style={[
                  styles.routeTypeTag, 
                  { backgroundColor: item.trafficCondition === "Fluide" ? '#E3F2FD' : 
                                     item.trafficCondition === "Chargé" ? '#FFF9C4' : '#FFEBEE' }
                ]}>
                  <Text style={styles.routeTypeText}>
                    {item.routeType || (index === 0 ? "Le plus rapide" : index === 1 ? "Le plus court" : "Alternative")}
                  </Text>
                </View>
              </View>
              
              <Text style={styles.routeOptionDetails}>
                {Math.floor(item.duration / 60)} min • {(item.distance / 1000).toFixed(1)} km
                {item.estimatedDelay > 0 ? ` • +${item.estimatedDelay} min de délai` : ''}
              </Text>
              
              {/* Affichage des incidents */}
              {renderIncidentIcons(item)}
              
              {/* Indicateur de trafic */}
              <View style={styles.trafficIndicatorContainer}>
                <View style={[
                  styles.trafficIndicator, 
                  { 
                    backgroundColor: item.trafficCondition === "Fluide" ? '#34C759' : 
                                     item.trafficCondition === "Chargé" ? '#FF9500' : '#FF3B30',
                    width: `${item.score || 70}%`
                  }
                ]} />
                <Text style={styles.trafficConditionText}>{item.trafficCondition}</Text>
              </View>
            </View>
            
            {selectedRouteIndex === index && (
              <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            )}
          </TouchableOpacity>
        )}
      />
    </Animated.View>
  );
};
// Notification component
// Dans la section NotificationPopup de votre NavigationScreen.jsx
const NotificationPopup = ({ notification, onDismiss, onNavigate }) => {
  if (!notification) return null;
  
  const { type, title, description, onAction } = notification;
  const incidentColor = INCIDENT_TYPES[type]?.color || '#FF9500';
  const incidentIcon = INCIDENT_TYPES[type]?.icon || 'exclamation';
  
  return (
    <SwipeablePopup onDismiss={onDismiss} style={styles.notificationContainer}>
      <View style={styles.notificationContent}>
        <View style={[styles.notificationIcon, { backgroundColor: incidentColor }]}>
          <FontAwesome5 name={incidentIcon} size={18} color="#FFF" />
        </View>
        <View style={styles.notificationTextContent}>
          <Text style={styles.notificationTitle}>{title}</Text>
          <Text style={styles.notificationDescription} numberOfLines={2}>
            {description}
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.notificationAction}
          onPress={onAction || onNavigate}  // Utiliser onAction s'il existe, sinon onNavigate
        >
          <Ionicons name="navigate" size={22} color="#007AFF" />
        </TouchableOpacity>
      </View>
    </SwipeablePopup>
  );
};

// Main NavigationScreen component
const NavigationScreen = ({ route, navigation }) => {
  // Parameters & Refs
  const { origin, destination, destinationName, preferences = {} } = route.params || {};
  const lastValidLocation = useRef(null);
  const deviationCounter = useRef(0);
  const firstDeviationTimestamp = useRef(null);
  const mapRef = useRef(null);
  const cameraRef = useRef(null);
  
  // State variables
  const [routes, setRoutes] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [routeStarted, setRouteStarted] = useState(false);
  const [eta, setEta] = useState(null);
  const [distance, setDistance] = useState(null);
  const [currentStep, setCurrentStep] = useState(null);
  const [nextStep, setNextStep] = useState(null);
  const [currentRoute, setCurrentRoute] = useState(null);
  const [userBearing, setUserBearing] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedIncidentType, setSelectedIncidentType] = useState(null);
  const [incidentDescription, setIncidentDescription] = useState('');
  const [showRouteOptions, setShowRouteOptions] = useState(false);
  const [activeNotification, setActiveNotification] = useState(null);
  const [isBottomMenuVisible, setIsBottomMenuVisible] = useState(true);
  const incidentMonitoringStop = useRef(null);
  const [showStepsList, setShowStepsList] = useState(false);
  const [routeSteps, setRouteSteps] = useState([]);
  const [isLoadingIncidents, setIsLoadingIncidents] = useState(false);
const [selectedIncident, setSelectedIncident] = useState(null);
const [showPopup, setShowPopup] = useState(false);
const incidentsRefreshInterval = useRef(null);
  // Inspect maneuver properties when route steps change
  useEffect(() => {
    if (routeSteps && routeSteps.length > 0) {
      console.log('Route steps types:');
      routeSteps.forEach((step, index) => {
        console.log(`Step ${index} - Type: ${step.type}, Modifier: ${step.modifier}`);
      });
    }
  }, [routeSteps]);

const mergeIncidents = (localIncidents = [], externalIncidents = []) => {
  // Vérifier que les arguments sont des tableaux
  if (!Array.isArray(localIncidents)) localIncidents = [];
  if (!Array.isArray(externalIncidents)) externalIncidents = [];
  
  console.log(`Fusion de ${localIncidents.length} incidents locaux et ${externalIncidents.length} incidents externes`);
  
  // Créer un ensemble d'IDs des incidents locaux pour éviter les doublons
  const localIds = new Set(localIncidents.map(inc => inc.id?.toString() || ''));
  
  // Filtrer les incidents externes pour ne garder que ceux qui ne sont pas déjà dans localIncidents
  const uniqueExternalIncidents = externalIncidents.filter(inc => {
    return inc && inc.id && !localIds.has(inc.id.toString());
  });
  
  // Combiner les deux tableaux
  return [...localIncidents, ...uniqueExternalIncidents];
};
// Ajouter cette fonction dans NavigationScreen
const fetchNearbyIncidents = async (location) => {
  if (!location) {
    console.log('Impossible de charger les incidents: position non disponible');
    return;
  }
  
  try {
    console.log('Chargement des incidents près de', location);
    setIsLoadingIncidents(true);
    
    // Vérifier si le service API est disponible
    if (!apiService || !apiService.incidents) {
      console.error('API non disponible pour les incidents');
      return;
    }
    
    // Récupérer les incidents proches de la position actuelle
    const nearbyIncidents = await apiService.incidents.getNearby(location, 10);
    console.log(`Récupéré ${nearbyIncidents?.length || 0} incidents proches`);
    
    if (nearbyIncidents && Array.isArray(nearbyIncidents) && nearbyIncidents.length > 0) {
      console.log('Incidents trouvés:', nearbyIncidents.length);
      
      // Filtrer pour ne conserver que les incidents avec des coordonnées valides
      const validIncidents = nearbyIncidents.filter(inc => {
        const coords = normalizeIncidentCoordinates(inc);
        return coords !== null;
      });
      
      console.log(`${validIncidents.length} incidents valides après filtrage`);
      
      // Mettre à jour l'état
      setIncidents(validIncidents);
    } else {
      console.log('Aucun incident trouvé ou format incorrect');
    }
  } catch (error) {
    console.error('Erreur lors du chargement des incidents:', error);
  } finally {
    setIsLoadingIncidents(false);
  }
};
  // Function to normalize incident coordinates
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
  // Function to calculate distance between coordinates
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
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
  };
  const getFallbackIncidents = (userLocation) => {
  console.log('Génération d\'incidents de secours');
  
  // Si aucune position utilisateur n'est disponible, utiliser une position par défaut (Paris)
  if (!userLocation) {
    userLocation = [2.3488, 48.8534];
  }
  
  const [userLng, userLat] = userLocation;
  
  // Générer des incidents fictifs autour de la position de l'utilisateur
  return [
    {
      id: 'fallback-1',
      type: 'traffic',
      coords: [userLng + 0.005, userLat + 0.002],
      description: 'Embouteillage important',
      created_at: new Date().toISOString(),
      votes: { up: 5, down: 1 }
    },
    {
      id: 'fallback-2',
      type: 'accident',
      coords: [userLng - 0.003, userLat + 0.004],
      description: 'Accident de circulation',
      created_at: new Date().toISOString(),
      votes: { up: 8, down: 0 }
    },
    {
      id: 'fallback-3',
      type: 'police',
      coords: [userLng + 0.001, userLat - 0.002],
      description: 'Contrôle de police',
      created_at: new Date().toISOString(),
      votes: { up: 3, down: 1 }
    },
    {
      id: 'fallback-4',
      type: 'hazard',
      coords: [userLng - 0.002, userLat - 0.003],
      description: 'Débris sur la route',
      created_at: new Date().toISOString(),
      votes: { up: 2, down: 0 }
    },
    {
      id: 'fallback-5',
      type: 'closure',
      coords: [userLng + 0.004, userLat - 0.001],
      description: 'Route fermée pour travaux',
      created_at: new Date().toISOString(),
      votes: { up: 6, down: 1 }
    }
  ];
};
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
  const offset = 0.01; // ~1km dans chaque direction
  
  return {
    minLon: userLng - offset,
    minLat: userLat - offset,
    maxLon: userLng + offset,
    maxLat: userLat + offset
  };
};

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

const startNavigationMode = () => {
  if (!userLocation) {
    console.log('Impossible de démarrer la navigation: position utilisateur non disponible');
    return;
  }
  
  console.log('Démarrage du mode navigation');
  
  if (cameraRef.current) {
    cameraRef.current.setCamera({
      centerCoordinate: userLocation,
      zoomLevel: 19,
      followUserMode: MapboxGL.UserTrackingModes.FollowWithCourse, // Au lieu de followUserMode, utilisez followUserLocation et followUserMode
      heading: userBearing,
      pitch: 75,
      animationDuration: 500,
      paddingBottom: 150
    });
  }
  
  // CORRECTION: mapRef.current.setUserTrackingMode n'existe pas
  // Remplacer par:
  if (mapRef.current) {
    // Utiliser la méthode correcte
    try {
      // Pour les versions récentes de MapboxGL
      if (typeof mapRef.current.setCamera === 'function') {
        mapRef.current.setCamera({
          followUserLocation: true,
          followUserMode: MapboxGL.UserTrackingModes.FollowWithCourse
        });
      }
      // Fallback pour d'autres propriétés
      else if (typeof mapRef.current.props !== 'undefined') {
        console.log('Utilisation de la méthode alternative pour suivre l\'utilisateur');
        // Mise à jour des props est une approche alternative
      }
    } catch (err) {
      console.error('Erreur lors de la configuration du mode de suivi:', err);
    }
  }
  
  setRouteStarted(true);
  
  // Charger les incidents
  fetchIncidents();
  
  // Surveillance des incidents
  if (incidentMonitoringStop.current) {
    incidentMonitoringStop.current();
  }
  
  incidentMonitoringStop.current = startIncidentMonitoring(currentRoute);
  
  // Définir un intervalle pour rafraîchir les incidents
  const intervalId = setInterval(() => {
    console.log('Rafraîchissement des incidents...');
    fetchIncidents();
  }, 60000);
  
  // Stocker l'ID pour le nettoyage ultérieur
  incidentsRefreshInterval.current = intervalId;
}
  // Toggle navigation state
 const toggleNavigation = useCallback(() => {
  if (!routeStarted) {
    console.log('Démarrage de la navigation');
    startNavigationMode();
  } else {
    console.log('Arrêt de la navigation');
    // Arrêter la navigation
    if (cameraRef.current) {
      cameraRef.current.setCamera({
        followUserLocation: false,
        zoomLevel: DEFAULT_ZOOM_LEVEL,
        pitch: 0,
        animationDuration: 500,
      });
    }
    
    // Nettoyer les intervalles et les surveillances
    if (incidentsRefreshInterval.current) {
      clearInterval(incidentsRefreshInterval.current);
      incidentsRefreshInterval.current = null;
    }
    
    if (incidentMonitoringStop.current) {
      incidentMonitoringStop.current();
      incidentMonitoringStop.current = null;
    }
    
    setRouteStarted(false);
  }
}, [routeStarted, userLocation]);

const SearchResultPopup = ({ place, onClose, onNavigate }) => {
  if (!place) return null;
  
  return (
    <SwipeablePopup onDismiss={onClose} style={styles.notificationContainer}>
      <View style={styles.notificationContent}>
        <View style={[styles.notificationIcon, { backgroundColor: '#4285f4' }]}>
          <Ionicons name="location" size={18} color="#FFF" />
        </View>
        <View style={styles.notificationTextContent}>
          <Text style={styles.notificationTitle}>{place.name || "Destination"}</Text>
          <Text style={styles.notificationDescription} numberOfLines={2}>
            {place.address || place.formattedAddress || "Adresse non disponible"}
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.notificationAction}
          onPress={() => onNavigate(place)}
        >
          <Ionicons name="navigate" size={22} color="#007AFF" />
        </TouchableOpacity>
      </View>
    </SwipeablePopup>
  );
};
const extractRouteSteps = useCallback((route) => {
  if (!route || !route.legs || !route.legs[0] || !route.legs[0].steps) {
    return [];
  }
  
  return route.legs[0].steps.map(step => ({
    instruction: step.maneuver?.instruction || "Continuez tout droit",
    type: step.maneuver?.type || "straight",
    modifier: step.maneuver?.modifier,
    distance: step.distance,
    duration: step.duration,
    coordinates: step.maneuver?.location,
    maneuver: step.maneuver // Ajouter l'objet maneuver complet pour le débogage
  }));
}, []);

// Ajouter cette fonction dans votre composant NavigationScreen (avant ou après les autres fonctions utilitaires)
const fetchTomTomIncidents = async (bounds = null) => {
  try {
    // Utiliser les limites fournies ou des valeurs par défaut
    const { minLon, minLat, maxLon, maxLat } = bounds || {
      minLon: 2.3, 
      minLat: 48.8, 
      maxLon: 2.5, 
      maxLat: 48.9
    };
    
    // Créer la chaîne de bounding box pour l'API
    const bboxString = `${minLon},${minLat},${maxLon},${maxLat}`;
    
    // Clé API TomTom (remplacer par votre clé)
    const apiKey = 'gRG7hmfbyydRpCyGd9rDtxCRTgwHGYwd';
    
    console.log('Construction de la requête TomTom avec bbox:', bboxString);
    
    // URL de l'API avec les coordonnées correctes
    const url = `https://api.tomtom.com/traffic/services/5/incidentDetails?key=${apiKey}&bbox=${bboxString}&fields={incidents{type,geometry{type,coordinates},properties{iconCategory}}}&language=fr-FR&t=${Date.now()}&timeValidityFilter=present`;
    
    console.log('Requête TomTom URL:', url);
    
    // Effectuer la requête (utiliser fetch au lieu d'axios si axios n'est pas disponible)
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data || !data.incidents) {
      console.log('Pas d\'incidents TomTom trouvés');
      return [];
    }
    
    console.log(`Reçu ${data.incidents.length} incidents TomTom`);
    
    // Convertir les incidents TomTom dans le format attendu par l'application
    return data.incidents.map((incident, index) => {
      // Déterminer le type d'incident basé sur les propriétés TomTom
      let type = 'hazard'; // type par défaut
      if (incident.properties) {
        const category = incident.properties.iconCategory;
        if (category && typeof category === 'string') {
          if (category.includes('accident')) type = 'accident';
          else if (category.includes('congestion') || category.includes('jam')) type = 'traffic';
          else if (category.includes('closure') || category.includes('closed')) type = 'closure';
          else if (category.includes('police') || category.includes('control')) type = 'police';
        }
      }
      
      // Extraire les coordonnées
      let coords = null;
      if (incident.geometry && incident.geometry.type === 'Point' && Array.isArray(incident.geometry.coordinates)) {
        coords = incident.geometry.coordinates;
      } else if (incident.geometry && incident.geometry.type === 'LineString' && 
                Array.isArray(incident.geometry.coordinates) && 
                incident.geometry.coordinates.length > 0) {
        // Pour les lignes (routes), prendre le premier point
        coords = incident.geometry.coordinates[0];
      }
      
      // Si on n'a pas pu extraire les coordonnées, ignorer cet incident
      if (!coords) return null;
      
      // Créer un ID unique pour cet incident
      const id = `tomtom-${index}-${Date.now()}`;
      
      // Convertir au format attendu par l'application
      return {
        id,
        type,
        coords,
        source: 'tomtom',
        description: incident.properties?.description || `Incident ${type}`,
        created_at: new Date().toISOString(),
        votes: { up: 2, down: 0 }, // Valeurs par défaut
        reliability_score: 70
      };
    }).filter(Boolean); // Filtrer les null
  } catch (error) {
    console.error('Erreur lors de la récupération des incidents TomTom:', error);
    // En cas d'erreur, retourner un tableau vide au lieu de laisser l'erreur se propager
    return [];
  }
};
// Ajoutez cet effet pour mettre à jour les étapes quand un nouvel itinéraire est sélectionné
useEffect(() => {
  if (currentRoute) {
    const steps = extractRouteSteps(currentRoute);
    setRouteSteps(steps);
    console.log(`Itinéraire avec ${steps.length} étapes chargé`);
  }
}, [currentRoute, extractRouteSteps]);
  // Recenter map on user
 // Modification de la fonction recenterMap
const recenterMap = () => {
  console.log('Recentrage sur', userLocation);
  
  if (!userLocation) {
    console.warn('Impossible de recentrer: position utilisateur inconnue');
    return;
  }
  
  if (cameraRef.current) {
    // Utiliser requestAnimationFrame pour s'assurer que la ref est disponible
    requestAnimationFrame(() => {
      cameraRef.current.setCamera({
        centerCoordinate: userLocation,
        zoomLevel: routeStarted ? 18 : DEFAULT_ZOOM_LEVEL,
        pitch: routeStarted ? 45 : 0,
        heading: userBearing || 0,
        animationDuration: 1000,
      });
    });
  } else {
    console.warn('Référence de caméra non disponible');
  }
};
  // Fit map to show entire route
  const fitMapToRoute = (coordinates) => {
    if (!coordinates || coordinates.length === 0 || !mapRef.current) return;
    
    try {
      let bounds = coordinates.reduce(
        (bounds, coord) => {
          return [
            Math.min(bounds[0], coord[0]),
            Math.min(bounds[1], coord[1]),
            Math.max(bounds[2], coord[0]),
            Math.max(bounds[3], coord[1])
          ];
        },
        [coordinates[0][0], coordinates[0][1], coordinates[0][0], coordinates[0][1]]
      );
      
      bounds = [
        bounds[0] - 0.01,
        bounds[1] - 0.01,
        bounds[2] + 0.01,
        bounds[3] + 0.01
      ];
      
      setTimeout(() => {
        if (mapRef.current && mapRef.current.setCamera) {
          const centerLon = (bounds[0] + bounds[2]) / 2;
          const centerLat = (bounds[1] + bounds[3]) / 2;
          
          cameraRef.current.setCamera({
            centerCoordinate: [centerLon, centerLat],
            zoomLevel: 12,
            animationDuration: 1000,
          });
        }
      }, 500);
    } catch (error) {
      console.error('Error adjusting map:', error);
    }
  };
  
  // Update navigation info
  const updateNavigationInfo = (userLocation, route) => {
    if (!route || !route.steps || !userLocation) return;
    
    const eta = new Date(Date.now() + route.duration * 1000);
    const formattedEta = eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setEta(formattedEta);
    
    const distanceInKm = route.distance / 1000;
    setDistance(distanceInKm.toFixed(1));
    
    const userPoint = turf.point(userLocation);
    let minDistance = Infinity;
    let closestStepIndex = 0;
    
    route.steps.forEach((step, index) => {
      if (step.geometry && step.geometry.coordinates) {
        step.geometry.coordinates.forEach(coord => {
          const stepPoint = turf.point(coord);
          const distance = turf.distance(userPoint, stepPoint, { units: 'kilometers' });
          
          if (distance < minDistance) {
            minDistance = distance;
            closestStepIndex = index;
          }
        });
      }
    });
    
    setCurrentStep(route.steps[closestStepIndex]);
    if (closestStepIndex + 1 < route.steps.length) {
      setNextStep(route.steps[closestStepIndex + 1]);
    } else {
      setNextStep(null);
    }
  };
  
  
const startIncidentMonitoring = (route) => {
  console.log('Démarrage de la surveillance des incidents');
  
  if (!NavigationService || typeof NavigationService.startIncidentMonitoring !== 'function') {
    console.error('NavigationService.startIncidentMonitoring non disponible');
    return () => {}; // Fonction vide pour éviter les erreurs
  }

  try {
    // Utiliser le service de navigation pour surveiller les incidents
    return NavigationService.startIncidentMonitoring(
      route, 
      (newIncidents, allIncidents) => {
        console.log(`${newIncidents.length} nouveaux incidents détectés sur l'itinéraire`);
        
        // Ajouter les nouveaux incidents à l'état
        setIncidents(prevIncidents => {
          // Filtrer pour éviter les doublons
          const existingIds = new Set(prevIncidents.map(inc => inc.id));
          const filteredNewIncidents = newIncidents.filter(inc => !existingIds.has(inc.id));
          
          console.log(`Ajout de ${filteredNewIncidents.length} nouveaux incidents à l'état`);
          
          if (filteredNewIncidents.length > 0) {
            return [...prevIncidents, ...filteredNewIncidents];
          }
          
          return prevIncidents;
        });
        
        // DÉSACTIVÉ TEMPORAIREMENT : Analyser l'impact et recalculer si nécessaire
        /* 
        if (NavigationService.analyzeIncidentImpact) {
          const impact = NavigationService.analyzeIncidentImpact(
            currentRoute, 
            allIncidents
          );
          
          // Si l'impact est important, proposer un nouvel itinéraire
          if (impact && impact.totalScore < 70) {
            suggestAlternativeRoute(impact);
          }
        }
        */
      }
    );
  } catch (error) {
    console.error('Erreur lors du démarrage de la surveillance des incidents:', error);
    return () => {}; // Fonction vide pour éviter les erreurs
  }
};

const extractManeuvers = (route) => {
  if (!route || !route.legs || !route.legs[0] || !route.legs[0].steps) {
    return [];
  }
  
  return route.legs[0].steps.map(step => ({
    instruction: step.maneuver?.instruction || "Continuez tout droit",
    type: step.maneuver?.type || "straight",
    modifier: step.maneuver?.modifier,
    distance: step.distance,
    duration: step.duration,
    coordinates: step.maneuver?.location
  }));
};

// Calculer l'heure d'arrivée estimée
const calculateETA = (route) => {
  if (!route || !route.duration) return null;
  
  const now = new Date();
  return new Date(now.getTime() + route.duration * 1000);
};
  // Recalculate route
  const recalculateRoute = async (currentPosition) => {
    console.log('Début du recalcul d\'itinéraire');
    
    if (!currentPosition || !destination) return;
    
    try {
      setLoading(true);
      
      const newRoutes = await NavigationService.calculateRoutes(
        currentPosition, 
        destination,
        { ...preferences, alternatives: true }
      );
      
      if (newRoutes && newRoutes.length > 0) {
        const routesWithColors = newRoutes.map((route, index) => {
          const colors = ['#3887be', '#FF9500', '#34C759', '#5856D6'];
          return {
            ...route,
            color: colors[index % colors.length],
            name: index === 0 ? 'Nouveau' : `Alternative ${index}`
          };
        });
        
        setRoutes(routesWithColors);
        setCurrentRoute(routesWithColors[0]);
        setSelectedRouteIndex(0);
        updateNavigationInfo(currentPosition, routesWithColors[0]);
        
        setActiveNotification({
          id: `reroute-success-${Date.now()}`,
          type: 'success',
          title: 'Itinéraire recalculé',
          description: 'Nouvel itinéraire trouvé'
        });
        
        deviationCounter.current = 0;
        firstDeviationTimestamp.current = null;
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Erreur recalcul itinéraire:', error);
      setLoading(false);
      
      setActiveNotification({
        id: `reroute-error-${Date.now()}`,
        type: 'error',
        title: 'Échec du recalcul',
        description: 'Impossible de trouver un nouvel itinéraire'
      });
    }
  };
  
  // Route selection
  const selectRoute = (index) => {
    if (index >= 0 && index < routes.length) {
      setSelectedRouteIndex(index);
      setCurrentRoute(routes[index]);
      
      if (userLocation) {
        updateNavigationInfo(userLocation, routes[index]);
      }
      
      if (mapRef.current && routes[index] && routes[index].geometry) {
        fitMapToRoute(routes[index].geometry.coordinates);
      }
    }
  };
  // À ajouter dans NavigationScreen
const setupPreciseLocationTracking = async () => {
  try {
    console.log('Demande de permission de localisation...');
    const { status } = await Location.requestForegroundPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'La navigation précise nécessite l\'accès à votre position');
      return;
    }
    
    console.log('Permission accordée, activation du network provider...');
    await Location.enableNetworkProviderAsync();
    
    console.log('Démarrage de la surveillance de position...');
    locationSubscription = await Location.watchPositionAsync(
      { 
        accuracy: Location.Accuracy.BestForNavigation, 
        distanceInterval: 5, // Mise à jour tous les 5 mètres
        timeInterval: 1000,  // Maximum 1 mise à jour par seconde
        foregroundService: {
          notificationTitle: 'Navigation en cours',
          notificationBody: 'Votre position est suivie pour la navigation'
        }
      },
      handleLocationUpdate
    );
  } catch (error) {
    console.error('Erreur lors de la configuration du suivi de position:', error);
    Alert.alert('Erreur', 'Impossible d\'accéder à votre position');
  }
};

// Mise à jour de la fonction renderUserLocationArrow pour utiliser une image avec halo
const renderUserLocationArrow = () => {
  if (!userLocation) return null;
  
  return (
    <MapboxGL.PointAnnotation
      id="userLocationArrow"
      coordinate={userLocation}
      anchor={{x: 0.5, y: 0.5}}
    >
      <View 
        style={[
          styles.userArrowContainer,
          { transform: [{ scale: routeStarted ? 1.2 : 1 }] }
        ]}
      >
        {/* Halo violet néon */}
        <View style={styles.userArrowHalo}>
          {/* Image de flèche */}
          <Image 
            source={NAVIGATION_ICONS.arrow}
            style={[
              styles.userLocationImage,
              { transform: [{ rotate: `${userBearing}deg` }] }
            ]} 
            resizeMode="contain"
          />
        </View>
      </View>
    </MapboxGL.PointAnnotation>
  );
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
}, [incidents, setSelectedIncident, setShowPopup]); // Ajoutez ces dépendances

  // Initialize navigation
  async function startNavigation() {
    try {
      if (!origin || !destination) {
        Alert.alert('Error', 'Incomplete navigation data');
        return;
      }
      
      console.log('Navigation with Mapbox from', origin, 'to', destination);
      
      setLoading(true);
      
      const options = {
        ...preferences,
        alternatives: true
      };
      
      const processedRoutes = await NavigationService.calculateRoutes(origin, destination, options);
      
      if (!processedRoutes || processedRoutes.length === 0) {
        throw new Error('No routes received from API');
      }
      
      console.log(`Received ${processedRoutes.length} routes from Mapbox`);
      
      const routesWithColors = processedRoutes.map((route, index) => {
        const colors = ['#3887be', '#FF9500', '#34C759', '#5856D6'];
        return {
          ...route,
          color: colors[index % colors.length],
          name: index === 0 ? 'Fastest' : index === 1 ? 'Shortest' : `Alternative ${index}`
        };
      });
      
      setRoutes(routesWithColors);
      setCurrentRoute(routesWithColors[0]);
      setSelectedRouteIndex(0);
      
      if (routesWithColors[0]) {
        updateNavigationInfo(userLocation, routesWithColors[0]);
      }
      
      if (mapRef.current && routesWithColors[0] && routesWithColors[0].geometry) {
        fitMapToRoute(routesWithColors[0].geometry.coordinates);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error starting navigation:', error);
      Alert.alert('Error', 'Unable to calculate route. Please try again.');
      setLoading(false);
    }
  }
  
  // Effect for camera tracking
  useEffect(() => {
    if (userLocation && cameraRef.current && routeStarted) {
      cameraRef.current.setCamera({
        centerCoordinate: userLocation,
        zoomLevel: 18,
        heading: userBearing,
        pitch: 65,
        animationDuration: 300,
      });
    }
  }, [userLocation, userBearing, routeStarted]);
  useEffect(() => {
  if (currentRoute && currentRoute.geometry) {
    console.log('Itinéraire prêt à afficher:', {
      coordsCount: currentRoute.geometry.coordinates.length,
      distance: currentRoute.distance,
      duration: currentRoute.duration
    });
  }
}, [currentRoute]);

/**

const suggestAlternativeRoute = async (impact) => {
  if (!userLocation || !destination) {
    console.log("Impossible de suggérer un itinéraire: données manquantes");
    return;
  }
  
  try {
    console.log("Demande de recalcul d'itinéraire avec impact:", impact);
    
    // Récupérer tous les incidents actifs
    const incidents = await apiService.incidents.getAll();
    console.log(`${incidents.length} incidents récupérés pour le recalcul`);
    
    // Recalculer les itinéraires en évitant les incidents
    let newRoutes = [];
    try {
      newRoutes = await NavigationService.recalculateRoutesBasedOnTraffic(
        userLocation,
        destination,
        currentRoute,
        incidents
      );
    } catch (recalcError) {
      console.error("Erreur dans le recalcul:", recalcError);
      return; // Sortir en cas d'erreur
    }
    
    console.log("Résultat du recalcul:", newRoutes?.length || 0, "routes trouvées");
    
    // S'assurer que newRoutes est un tableau valide
    if (!newRoutes || !Array.isArray(newRoutes) || newRoutes.length === 0) {
      console.log("Aucune route alternative trouvée");
      return;
    }
    
    // Si on a un meilleur itinéraire
    const estimatedDelay = Math.min(5, newRoutes[0].estimatedDelay || 2);
    
    console.log("Création d'une notification pour le nouvel itinéraire avec délai:", estimatedDelay);
    
    // Créer la notification
    setActiveNotification({
      id: `new-route-${Date.now()}`,
      type: 'info',
      title: 'Nouvel itinéraire disponible',
      description: `Route plus rapide trouvée (${estimatedDelay} min de moins)`,
      onAction: () => {
        console.log("Application du nouvel itinéraire");
        
        // Mettre à jour l'itinéraire actuel
        setCurrentRoute(newRoutes[0]);
        
        // Mettre à jour l'index de l'itinéraire sélectionné
        setSelectedRouteIndex(0);
        
        // Mettre à jour la liste des itinéraires
        setRoutes(newRoutes);
        
        // Mettre à jour les info de navigation
        if (userLocation) {
          updateNavigationInfo(userLocation, newRoutes[0]);
        }
        
        // Fermer la notification
        setActiveNotification(null);
      },
      actionText: 'Prendre cette route'
    });
  } catch (error) {
    console.error('Erreur lors de la suggestion d\'un itinéraire alternatif:', error);
  }
}; */
  // Main effect - initialize app
  useEffect(() => {
    StatusBar.setBarStyle('dark-content');
    
    if (origin && destination) {
      setTimeout(() => {
        startNavigation();
      }, 500);
    }
    
    // Location tracking setup
    let locationSubscription;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        
        if (status !== 'granted') {
          Alert.alert('Permission refusée', 'La navigation précise nécessite l\'accès à votre position');
          return;
        }
        
        await Location.enableNetworkProviderAsync();
        
        locationSubscription = await Location.watchPositionAsync(
          { 
            accuracy: Location.Accuracy.BestForNavigation, 
            distanceInterval: 5,
            timeInterval: 1000,
            foregroundService: {
              notificationTitle: 'Navigation en cours',
              notificationBody: 'Votre position est suivie pour la navigation'
            }
          },
          (location) => {
            const { longitude, latitude, heading, speed } = location.coords;
            
            if (lastValidLocation.current) {
              const timeDelta = (location.timestamp - lastValidLocation.current.timestamp) / 1000;
              const lastSpeed = lastValidLocation.current.coords.speed || 0;
              const maxDistance = (lastSpeed + 5) * timeDelta;
              
              const distance = calculateDistance(
                lastValidLocation.current.coords.latitude,
                lastValidLocation.current.coords.longitude,
                latitude,
                longitude
              );
              
              if (distance > maxDistance && maxDistance > 0) {
                console.log('Position ignorée - déplacement irréaliste');
                return;
              }
            }
            
            const newUserLocation = [longitude, latitude];
            setUserLocation(newUserLocation);
            
            if (heading !== null) {
              setUserBearing(heading);
            }
            
            lastValidLocation.current = location;
            
           // Dans la fonction de suivi de localisation dans NavigationScreen.jsx
if (routeStarted && currentRoute) {
  updateNavigationInfo(newUserLocation, currentRoute);
  
  // Utiliser la version du service pour vérifier les déviations
  const deviation = NavigationService.checkRouteDeviation(
    {latitude: newUserLocation[1], longitude: newUserLocation[0]}, 
    currentRoute.geometry, 
    DEVIATION_CHECK_CONSTANTS.DISTANCE_THRESHOLD // passer le seuil en paramètre
  );
  
  if (deviation.isDeviated) {
    deviationCounter.current += 1;
    console.log('Déviation détectée:', deviationCounter.current);
    
    if (deviationCounter.current === 1) {
      firstDeviationTimestamp.current = Date.now();
    }
    
    const timeElapsed = Date.now() - (firstDeviationTimestamp.current || 0);
    
    if (deviationCounter.current >= DEVIATION_CHECK_CONSTANTS.MAX_CHECKS_BEFORE_REROUTE && 
        timeElapsed > DEVIATION_CHECK_CONSTANTS.TIME_THRESHOLD) {
      
      console.log('Recalcul d\'itinéraire requis');
      
      setActiveNotification({
        id: `reroute-${Date.now()}`,
        type: 'info',
        title: 'Recalcul d\'itinéraire',
        description: 'Vous vous êtes écarté de l\'itinéraire, recalcul en cours...'
      });
      
      recalculateRoute(newUserLocation);
    }
  } else {
    if (deviationCounter.current > 0) {
      console.log('Retour sur l\'itinéraire');
      deviationCounter.current = 0;
      firstDeviationTimestamp.current = null;
    }
  }
}
          }
        );
      } catch (error) {
        console.error('Erreur suivi de position:', error);
      }
    })();
    
    // Cleanup
    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);
  
  // Loading state
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <ActivityIndicator size="large" color="#3887be" />
        <Text style={styles.loadingText}>Calculating best routes...</Text>
        <Text style={styles.loadingSubtext}>Analyzing traffic conditions</Text>
      </View>
    );
  }
  
  // Error state
  if (error) {
    return (
      <View style={styles.centerContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <Ionicons name="alert-circle-outline" size={60} color="#FF3B30" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.retryButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
return (
  <View style={styles.container}>
    <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
    
    {/* Main map */}
    <View style={styles.mapContainer}>
  {/* Dans la section MapView de votre NavigationScreen.jsx */}
<MapboxGL.MapView
  ref={mapRef}
  style={styles.map}
  styleURL={MapboxGL.StyleURL.Street}
  compassEnabled={true}
  compassViewPosition={3}
  compassViewMargins={{x: 16, y: 140}}
  logoEnabled={false}
  onDidFinishRenderingMapFully={() => {
    console.log('Carte entièrement rendue');
    // Forcer le rechargement des incidents après le rendu complet
    if (routeStarted && userLocation) {
      console.log('Rechargement forcé des incidents après rendu complet');
      
      // Utiliser un délai pour s'assurer que la carte est bien rendue
      setTimeout(() => {
        fetchIncidents();
      }, 1000);
    }
  }}
>
  <MapboxGL.Camera
    ref={cameraRef}
    zoomLevel={DEFAULT_ZOOM_LEVEL}
    centerCoordinate={userLocation || origin || [2.3488, 48.8534]}
    followUserLocation={routeStarted}
    followUserMode={routeStarted ? MapboxGL.UserTrackingModes.FollowWithCourse : MapboxGL.UserTrackingModes.None}
    followZoomLevel={routeStarted ? 18 : DEFAULT_ZOOM_LEVEL}
    followPitch={routeStarted ? 65 : 0}
    animationMode="flyTo"
  />

  {/* Forcer l'affichage des incidents en priorité */}
 {incidents && incidents.length > 0 && (
  <>
    {console.log(`Rendu de ${incidents.length} incidents`)}
    {renderIncidentAnnotations()}
  </>
)}

{/* Puis affichez l'itinéraire */}
{currentRoute && currentRoute.geometry && (
    <>
      {/* Contour lumineux pour effet fluorescent */}
      <MapboxGL.ShapeSource
        id="routeOutlineSource"
        shape={{
          type: 'Feature',
          properties: {},
          geometry: currentRoute.geometry
        }}
      >
        <MapboxGL.LineLayer
          id="routeOutlineLine"
          style={{
            lineColor: '#FFFFFF',
            lineWidth: 16,
            lineCap: 'round',
            lineJoin: 'round',
            lineOpacity: 0.7
          }}
        />
      </MapboxGL.ShapeSource>

      {/* Ligne principale */}
      <MapboxGL.ShapeSource
        id="routeSource"
        shape={{
          type: 'Feature',
          properties: {},
          geometry: currentRoute.geometry
        }}
      >
        <MapboxGL.LineLayer
          id="routeLine"
          style={{
            lineColor: '#8a0590',
            lineWidth: 12,
            lineCap: 'round',
            lineJoin: 'round',
            lineOpacity: 1.0
          }}
        />
      </MapboxGL.ShapeSource>
    </>
  )}
{isLoadingIncidents && (
  <View style={styles.loadingIncidentsIndicator}>
    <ActivityIndicator size="small" color="#3887be" />
    <Text style={styles.loadingIncidentsText}>Chargement des incidents...</Text>
  </View>
)}
  {/* Marqueurs d'origine et destination */}
  {origin && (
    <MapboxGL.PointAnnotation
      id="originMarker"
      coordinate={origin}
    >
      <View style={styles.originMarker}>
        <MaterialIcons name="my-location" size={24} color="#4CAF50" />
      </View>
    </MapboxGL.PointAnnotation>
  )}

  {destination && (
    <MapboxGL.PointAnnotation
      id="destinationMarker"
      coordinate={destination}
    >
      <View style={styles.destinationMarker}>
        <MaterialIcons name="location-pin" size={30} color="#F44336" />
      </View>
    </MapboxGL.PointAnnotation>
  )}

  {/* Utilisateur */}
  {renderUserLocationArrow()}
</MapboxGL.MapView>
    </View>
    
    {/* Top header bar */}
    <SafeAreaView style={styles.headerContainer}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        
       <TouchableOpacity 
  onPress={() => setShowReportModal(true)}
  style={styles.iconReportButton}
>
  <Image 
    source={NAVIGATION_ICONS.report} 
    style={styles.iconImage}
    resizeMode="contain"
  />
</TouchableOpacity>

      </View>
    </SafeAreaView>
    
    {/* Current instruction panel - shown during navigation */}
    {routeStarted && currentStep && (
      <View style={styles.instructionPanel}>
        <View style={styles.instructionContainer}>
          {/* Conteneur avec halo */}
          <View style={styles.instructionIconContainer}>
            <View style={styles.iconHalo}>
              <Image 
                source={getStepIcon(currentStep)} 
                style={styles.navigationArrowImage} 
                resizeMode="contain"
              />
            </View>
          </View>
          <Text style={styles.instructionText} numberOfLines={2}>
            {currentStep.maneuver?.instruction || "Continue on route"}
          </Text>
        </View>
      </View>
    )}
    
    {/* Notification popup for incidents */}
    {activeNotification && (
      <View style={styles.notificationWrapper}>
        <NotificationPopup 
          notification={activeNotification}
          onDismiss={() => setActiveNotification(null)}
          onNavigate={() => {
            // Navigate to incident
            const coords = normalizeIncidentCoordinates(activeNotification.incident);
            if (cameraRef.current && coords) {
              cameraRef.current.setCamera({
                centerCoordinate: coords,
                zoomLevel: 15,
                animationDuration: 1000,
              });
              setActiveNotification(null);
            }
          }}
        />
      </View>
    )}
    
    {/* Bottom sliding menu */}
    <BottomSlideMenu 
      visible={isBottomMenuVisible}
      routeData={currentRoute}
      destination={destination}
      destinationName={destinationName}
      eta={eta}
      distance={distance}
      onStartNavigation={toggleNavigation}
      isNavigating={routeStarted}
      onShowRouteOptions={() => setShowRouteOptions(true)}
      onRecenterMap={recenterMap}
      selectedRouteIndex={selectedRouteIndex}
      routes={routes}
      onShowSteps={() => setShowStepsList(true)} // Ajout de cette prop
    />
    
    {/* Routes options panel */}
    <RoutesOptionsPanel 
      visible={showRouteOptions}
      onClose={() => setShowRouteOptions(false)}
      routes={routes}
      selectedRouteIndex={selectedRouteIndex}
      onSelectRoute={selectRoute}
    />
    
{/* Popup d'incident */}
{showPopup && selectedIncident && (
  <View style={styles.incidentPopupContainer}>
    <TouchableOpacity 
      style={styles.incidentPopupBackground}
      activeOpacity={0.7}
      onPress={() => setShowPopup(false)}
    />
    <View style={styles.incidentPopupContent}>
      <View style={styles.incidentPopupHeader}>
        <Text style={styles.incidentPopupTitle}>
          {INCIDENT_TYPES[selectedIncident.type]?.title || 'Incident'}
        </Text>
        <TouchableOpacity onPress={() => setShowPopup(false)}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
      </View>
      <Text style={styles.incidentPopupDescription}>
        {selectedIncident.description || 'Aucune description disponible'}
      </Text>
      <View style={styles.incidentPopupActions}>
        <TouchableOpacity 
          style={styles.incidentPopupActionButton}
          onPress={() => {
            // Action pour naviguer vers l'incident
            if (cameraRef.current && selectedIncident.coords) {
              cameraRef.current.setCamera({
                centerCoordinate: selectedIncident.coords,
                zoomLevel: 16,
                animationDuration: 1000,
              });
              setShowPopup(false);
            }
          }}
        >
          <Ionicons name="navigate" size={20} color="#007AFF" />
          <Text style={styles.incidentPopupActionText}>Y aller</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
)}
    {/* Report incident modal */}
    <Modal
      visible={showReportModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowReportModal(false)}
    >
      <BlurView intensity={Platform.OS === 'ios' ? 50 : 100} style={styles.modalOverlay}>
        <TouchableOpacity 
          style={styles.modalOverlayTouch}
          activeOpacity={1}
          onPress={() => setShowReportModal(false)}
        />
        
        <View style={styles.reportModalContainer}>
          <View style={styles.reportModalHeader}>
            <Text style={styles.reportModalTitle}>Report an Incident</Text>
            <TouchableOpacity onPress={() => setShowReportModal(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.reportTypeContainer}>
            <Text style={styles.reportTypeLabel}>Incident type:</Text>
            
            <View style={styles.reportTypesGrid}>
              {Object.entries(INCIDENT_TYPES).map(([key, value]) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.reportTypeButton,
                    selectedIncidentType === key && styles.reportTypeButtonSelected,
                    { borderColor: value.color }
                  ]}
                  onPress={() => setSelectedIncidentType(key)}
                >
                  <View 
                    style={[
                      styles.reportTypeIcon, 
                      { backgroundColor: value.color }
                    ]}
                  >
                    <FontAwesome5 name={value.icon} size={18} color="#FFF" />
                  </View>
                  <Text 
                    style={[
                      styles.reportTypeText,
                      selectedIncidentType === key && { color: value.color, fontWeight: 'bold' }
                    ]}
                  >
                    {value.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          <View style={styles.reportDescriptionContainer}>
            <Text style={styles.reportDescriptionLabel}>Description (optional):</Text>
            <TextInput
              style={styles.reportDescriptionInput}
              placeholder="Add more details about the incident..."
              value={incidentDescription}
              onChangeText={setIncidentDescription}
              multiline
              maxLength={200}
            />
          </View>
        <TouchableOpacity
  style={[
    styles.submitReportButton,
    !selectedIncidentType && styles.submitReportButtonDisabled
  ]}
  onPress={async () => {
    try {
      // Récupérer le token depuis AsyncStorage
      const userToken = await authService.getToken();

if (!userToken) {
  setShowReportModal(false);
  Alert.alert("Connexion requise", "Vous devez être connecté pour signaler un incident");
  return;
}
      
      // IMPORTANT: Copier le token vers SecureStore pour que l'API puisse le trouver
await SecureStore.setItemAsync('userToken', userToken);      
      // Maintenant l'API pourra trouver le token
      // Extraire latitude et longitude
      const [longitude, latitude] = userLocation;
      
      // Appeler la méthode report de l'API
      await apiService.incidents.report({
        type: selectedIncidentType,
        description: incidentDescription || '',
        latitude,
        longitude
      });
      
      // Le reste du code reste identique
      setShowReportModal(false);
      
      // Créer un objet incident pour l'affichage local
      const newIncident = {
        id: `new-${Date.now()}`,
        type: selectedIncidentType,
        coords: userLocation,
        description: incidentDescription || INCIDENT_TYPES[selectedIncidentType]?.description,
        created_at: new Date().toISOString(),
        votes: { up: 1, down: 0 }
      };
      
      // Ajouter l'incident à la liste locale
      setIncidents(prev => {
  console.log('Ajout d\'un nouvel incident à la liste', newIncident);
  return [...prev, newIncident];
});

// Forcer un rafraîchissement de la carte
if (mapRef.current) {
  // Forcer un rafraîchissement en changeant légèrement le zoom
  const currentZoom = mapRef.current._getZoom();
  mapRef.current.setZoomLevel(currentZoom + 0.0001);
  setTimeout(() => {
    mapRef.current.setZoomLevel(currentZoom);
  }, 100);
}



      setTimeout(() => {
  setRefreshTrigger(prev => prev + 1);
}, 500);
      // Afficher la notification
      setActiveNotification({
        id: newIncident.id,
        incident: newIncident,
        type: selectedIncidentType,
        title: `${INCIDENT_TYPES[selectedIncidentType]?.title || 'Incident'} signalé`,
        description: incidentDescription || INCIDENT_TYPES[selectedIncidentType]?.description
      });
      
      // Réinitialiser les champs
      setSelectedIncidentType(null);
      setIncidentDescription('');
      
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de l\'incident:', error);
      
      if (error.response && error.response.status === 401) {
        setShowReportModal(false);
        Alert.alert("Session expirée", "Votre session a expiré. Veuillez vous reconnecter.");
      } else {
        Alert.alert("Erreur", "Une erreur est survenue lors de l'enregistrement de l'incident.");
      }
    }
  }}
  disabled={!selectedIncidentType}
>
  <Text style={styles.submitReportButtonText}>Send Report</Text>
</TouchableOpacity>
        </View>
      </BlurView>
    </Modal>

    {/* Modal pour afficher les étapes */}
    <Modal
      visible={showStepsList}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowStepsList(false)}
    >
      <View style={styles.stepsModalContainer}>
        <View style={styles.stepsModalHeader}>
          <Text style={styles.stepsModalTitle}>Étapes de l'itinéraire</Text>
          <TouchableOpacity onPress={() => setShowStepsList(false)}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>
        
        <FlatList
          data={routeSteps}
          keyExtractor={(_, index) => `step-${index}`}
          renderItem={({ item, index }) => (
            <View style={styles.stepItem}>
              {/* Conteneur avec halo */}
              <View style={styles.stepIconContainer}>
                <View style={styles.iconHalo}>
                  <Image 
                    source={getStepIcon(item)} 
                    style={styles.stepIconImage} 
                    resizeMode="contain"
                  />
                </View>
              </View>
              <View style={styles.stepTextContainer}>
                <Text style={styles.stepInstruction}>{item.instruction}</Text>
                <Text style={styles.stepDistance}>
                  {item.distance < 1000 
                    ? `${Math.round(item.distance)}m` 
                    : `${(item.distance / 1000).toFixed(1)}km`}
                </Text>
              </View>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      </View>
    </Modal>
  </View>
);
};

// Helper function to get direction icon based on step
const getDirectionIcon = (step) => {
  if (!step || !step.maneuver || !step.maneuver.type) return 'arrow-forward';
  
  const maneuverType = step.maneuver.type;
  const maneuverModifier = step.maneuver.modifier;
  
  if (maneuverType === 'arrive') return 'flag';
  if (maneuverType === 'depart') return 'play';
  
  if (maneuverType === 'turn') {
    if (maneuverModifier === 'left') return 'arrow-back';
    if (maneuverModifier === 'right') return 'arrow-forward';
    if (maneuverModifier === 'slight left') return 'arrow-back';
    if (maneuverModifier === 'slight right') return 'arrow-forward';
    if (maneuverModifier === 'sharp left') return 'arrow-back';
    if (maneuverModifier === 'sharp right') return 'arrow-forward';
    if (maneuverModifier === 'uturn') return 'refresh';
  }
  
  if (maneuverType === 'continue') return 'arrow-up';
  if (maneuverType === 'merge') return 'git-merge';
  if (maneuverType === 'fork') return 'git-branch';
  if (maneuverType === 'roundabout') return 'refresh';
  
  return 'arrow-forward';
};

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 16,
    marginTop: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#3887be',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: Platform.OS === 'android' ? StatusBar.currentHeight : 44,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF3B30',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  reportButtonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 6,
  },
  originMarker: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destinationMarker: {
    width: 40, // Augmenter si l'icône n'est pas visible
    height: 40, // Augmenter si l'icône n'est pas visible
    alignItems: 'center',
    justifyContent: 'center',
  },
 // Ajoutez ces styles pour améliorer la visibilité des incidents
incidentMarker: {
  width: 50, // Plus grand
  height: 50, // Plus grand
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 20, // Assurez-vous qu'ils sont au-dessus de tout
},
incidentMarkerInner: {
  width: 36, // Plus grand
  height: 36, // Plus grand
  borderRadius: 18,
  alignItems: 'center',
  justifyContent: 'center',
  borderWidth: 3, // Plus épais
  borderColor: 'white',
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.5, // Plus visible
  shadowRadius: 5,
  elevation: 8, // Plus élevé pour Android
},
  // Effet de pulsation pour les incidents
  incidentPulse: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    opacity: 0.5,
    transform: [{ scale: 1.2 }], // Plus grand que le marqueur de base
    zIndex: -1, // Sous le marqueur principal
  },
  userArrowContainer: {
    width: 70,  // Augmenté pour le halo
    height: 70,  // Augmenté pour le halo
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Nouveau style pour le halo violet
  userArrowHalo: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(91, 44, 111, 0.3)', // #5b2c6f avec transparence
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: "#5b2c6f",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
  userArrow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderBottomWidth: 24,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#00AAFF', // Couleur d'origine
    transform: [{ translateY: -5 }]
  },
  arrowCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'white',
    borderWidth: 4,
    borderColor: '#00AAFF', // Couleur d'origine
    transform: [{ translateY: -15 }]
  },
  arrowShadow: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 170, 255, 0.3)', // Couleur d'origine rgba
    transform: [{ translateY: -10 }]
  },
  bottomSlideMenu: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 10,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    zIndex: 5,
  },
  menuHandleBar: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handleBar: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#E0E0E0',
  },
  destinationHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  destinationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  destinationEta: {
    fontSize: 14,
    color: '#666',
  },
  etaHighlight: {
    fontWeight: 'bold',
    color: '#333',
  },
  routeInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  routeInfoItem: {
    alignItems: 'center',
  },
  routeInfoValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  routeInfoLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  routeInfoDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E0E0E0',
  },
  routesButton: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  routeCount: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3887be',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  routeCountText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  routesButtonText: {
    fontSize: 14,
    color: '#666',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3887be',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
  },
  stopButton: {
    backgroundColor: '#FF3B30',
  },
  startButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  expandedTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  routeSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedRouteSummary: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#3887be',
  },
  routeColorBar: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  routeSummaryDetails: {
    flex: 1,
  },
  routeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  routeStats: {
    fontSize: 14,
    color: '#666',
  },
  routesOptionsPanel: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 120,
    left: 16,
    right: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    maxHeight: height * 0.6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 20,
    zIndex: 10,
  },
  routesPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: 12,
  },
  routesPanelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  routeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedRouteOption: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#3887be',
  },
  routeColorIndicator: {
    width: 4,
    height: 50,
    borderRadius: 2,
    marginRight: 12,
  },
  routeOptionInfo: {
    flex: 1,
  },
  routeOptionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  routeOptionDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  routeTypeTag: {
    backgroundColor: '#E0E0E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  routeTypeText: {
    fontSize: 12,
    color: '#666',
  },
  instructionPanel: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 90 : 100,
    left: 16,
    right: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 5,
  },
  instructionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  instructionIconContainer: {
    width: 60, // Augmenté pour le halo
    height: 60, // Augmenté pour le halo
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  // Style pour l'effet de halo sur les icônes
  iconHalo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(91, 44, 111, 0.3)', // #5b2c6f avec transparence
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: "#5b2c6f",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  instructionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  notificationWrapper: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 110,
    left: 16,
    right: 16,
    zIndex: 20,
  },
  notificationContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginHorizontal: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationTextContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  notificationDescription: {
    fontSize: 14,
    color: '#666',
  },
  notificationAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalOverlayTouch: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  reportModalContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: '20%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  reportModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  reportModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  reportTypeContainer: {
    marginBottom: 20,
  },
  reportTypeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  reportTypesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
  },
  reportTypeButton: {
    width: '30%',
    margin: 5,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CCCCCC',
    alignItems: 'center',
  },
  reportTypeButtonSelected: {
    backgroundColor: '#F5F5F5',
    borderWidth: 2,
  },
  reportTypeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  reportTypeText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  reportDescriptionContainer: {
    marginBottom: 20,
  },
  reportDescriptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  reportDescriptionInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 10,
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 14,
    color: '#333',
  },
  submitReportButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  submitReportButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  submitReportButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  stepsModalContainer: {
    flex: 1,
    backgroundColor: 'white',
    marginTop: 50,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  stepsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  stepsModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  stepItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  stepIconContainer: {
    width: 50, // Augmenté pour le halo
    height: 50, // Augmenté pour le halo
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepTextContainer: {
    flex: 1,
  },
  stepInstruction: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  stepDistance: {
    fontSize: 14,
    color: '#666',
  },
  // Styles pour les images
  navigationArrowImage: {
    width: 40,
    height: 40,
  },
  stepIconImage: {
    width: 45,
    height: 45,
  },
  userLocationImage: {
    width: 40,
    height: 40,
  },
 iconReportButton: {
  width: 50,
  height: 50,
  borderRadius: 25,
  alignItems: 'center',
  justifyContent: 'center',

},

iconImage: {
  width: 50,
  height: 50,
},
incidentPulse: {
  position: 'absolute',
  width: 50,
  height: 50,
  borderRadius: 25,
  opacity: 0.5,
  transform: [{ scale: 1.2 }], // Plus grand que le marqueur de base
},

// Amélioration du style des marqueurs d'incident
incidentMarker: {
  width: 40,
  height: 40,
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10,
},
incidentMarkerInner: {
  width: 32,
  height: 32,
  borderRadius: 16,
  alignItems: 'center',
  justifyContent: 'center',
  borderWidth: 2.5,
  borderColor: 'white',
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 3,
  elevation: 5,
},

// Amélioration du menu coulissant
bottomSlideMenu: {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: -3 },
  shadowOpacity: 0.2,
  shadowRadius: 10,
  elevation: 15,
  paddingHorizontal: 16,
  paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  zIndex: 5,
},

// Amélioration du style des boutons
actionButton: {
  width: 50,
  height: 50,
  borderRadius: 25,
  backgroundColor: 'rgba(240, 240, 240, 0.9)',
  alignItems: 'center',
  justifyContent: 'center',
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.15,
  shadowRadius: 3,
  elevation: 4,
},

startButton: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#8a0590', // Violet pour correspondre au thème
  paddingHorizontal: 26,
  paddingVertical: 14,
  borderRadius: 30,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.25,
  shadowRadius: 5,
  elevation: 6,
},
loadingIncidentsIndicator: {
  position: 'absolute',
  top: Platform.OS === 'ios' ? 140 : 160,
  alignSelf: 'center',
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
  borderRadius: 20,
  paddingHorizontal: 16,
  paddingVertical: 8,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.2,
  shadowRadius: 3,
  elevation: 5,
  zIndex: 100,
},
loadingIncidentsText: {
  marginLeft: 8,
  fontSize: 14,
  color: '#333',
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
searchResultMarker: {
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: '#4285f4',
  borderWidth: 3,
  borderColor: 'white',
  alignItems: 'center',
  justifyContent: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 5,
},
searchResultMarkerIcon: {
  width: 24,
  height: 24,
  alignItems: 'center',
  justifyContent: 'center',
},
incidentPopupContainer: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000,
},
incidentPopupBackground: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
},
incidentPopupContent: {
  width: '80%',
  backgroundColor: 'white',
  borderRadius: 12,
  padding: 16,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 3.84,
  elevation: 5,
},
incidentPopupHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 12,
  paddingBottom: 8,
  borderBottomWidth: 1,
  borderBottomColor: '#f0f0f0',
},
incidentPopupTitle: {
  fontSize: 18,
  fontWeight: 'bold',
  color: '#333',
},
incidentPopupDescription: {
  fontSize: 16,
  color: '#666',
  marginBottom: 16,
},
incidentPopupActions: {
  flexDirection: 'row',
  justifyContent: 'flex-end',
},
incidentPopupActionButton: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#f8f8f8',
  paddingVertical: 8,
  paddingHorizontal: 16,
  borderRadius: 20,
},
incidentPopupActionText: {
  marginLeft: 8,
  fontSize: 14,
  fontWeight: '600',
  color: '#007AFF',
},
// Dans la section StyleSheet existante, ajoutez ces styles :
// Ajoutez ces styles dans la section StyleSheet de NavigationScreen.jsx
incidentsIconsContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  marginTop: 4,
  flexWrap: 'wrap', // Pour permettre le retour à la ligne
},
incidentsCountText: {
  fontSize: 12,
  color: '#666',
  marginLeft: 4,
  fontWeight: '500',
},
incidentTypeText: {
  fontSize: 12,
  fontWeight: 'bold',
},
noIncidentsContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  marginTop: 4,
},
noIncidentsText: {
  fontSize: 12,
  color: '#34C759',
  marginLeft: 4,
  fontWeight: '500',
},
routeOptionHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 4,
},
trafficIndicatorContainer: {
  height: 6,
  backgroundColor: '#F0F0F0',
  borderRadius: 3,
  marginTop: 8,
  width: '100%',
  position: 'relative',
},
trafficIndicator: {
  height: 6,
  borderRadius: 3,
  position: 'absolute',
  left: 0,
  top: 0,
},
trafficConditionText: {
  fontSize: 10,
  color: '#666',
  position: 'absolute',
  right: 0,
  top: 8,
},
});

export default NavigationScreen;