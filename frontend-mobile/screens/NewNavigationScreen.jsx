import React, { Component } from 'react';
import { View, StyleSheet, Alert, Image, Text, ActivityIndicator, Platform, StatusBar } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import * as Location from 'expo-location';
import * as turf from '@turf/turf';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import NavigationService from '../services/unified/NavigationService';
import TrafficPredictionService from '../services/TrafficPredictionService';
import apiService from '../services/api';

// Constantes pour vérifier les déviations
const DEVIATION_CHECK_CONSTANTS = {
  DISTANCE_THRESHOLD: 40, // Mètres (réduit)
  TIME_THRESHOLD: 5000,   // 5 secondes (réduit)
  MAX_CHECKS_BEFORE_REROUTE: 2 // Nombre de vérifications avant recalcul (réduit)
};

// Niveau de zoom par défaut
const DEFAULT_ZOOM_LEVEL = 15;

class NewNavigationScreen extends Component {
  constructor(props) {
    super(props);
    this.state = {
      userLocation: null, // Sera stocké comme [longitude, latitude]
      destinationCoords: null,
      currentRoute: null,
      isNavigating: false,
      isRerouting: false,
      routeDeviation: false,
      isNightMode: false,
      isLoadingRoute: false,
      avoidHighways: false,
      avoidTolls: false,
      nextManeuver: null,
      estimatedArrival: null,
      arrowDirection: 0,
    };
    
    this.mapView = null;
    this.mapCamera = null;
    this.deviationCounter = 0;
    this.firstDeviationTimestamp = null;
    this.lastValidLocation = null;
    this.locationWatcher = null;
    this.incidentMonitoringStop = null;
  }

  async componentDidMount() {
    await this.setupPreciseLocationTracking();
    
    // Vérifier s'il fait nuit pour activer automatiquement le mode nuit
    const currentHour = new Date().getHours();
    if (currentHour >= 19 || currentHour <= 6) {
      this.setState({ isNightMode: true });
    }
    
    // Destination depuis les paramètres de navigation
    if (this.props.route?.params?.destination) {
      this.setState({
        destinationCoords: this.props.route.params.destination.coordinates
      });
    }
  }

  componentWillUnmount() {
    // Nettoyer les abonnements
    if (this.locationWatcher) {
      this.locationWatcher.remove();
    }
    
    if (this.incidentMonitoringStop) {
      this.incidentMonitoringStop();
    }
  }

  // Configuration précise de la localisation
  setupPreciseLocationTracking = async () => {
    try {
      console.log('Demande de permission de localisation...');
      // Demander les autorisations avec une explication claire
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'La navigation précise nécessite l\'accès à votre position');
        return;
      }
      
      console.log('Permission accordée, activation du network provider...');
      // Configuration de haute précision
      await Location.enableNetworkProviderAsync();
      
      console.log('Démarrage de la surveillance de position...');
      // Options de surveillance de localisation optimisées pour la navigation
      this.locationWatcher = await Location.watchPositionAsync(
        { 
          accuracy: Location.Accuracy.BestForNavigation, 
          distanceInterval: 5, // Mise à jour tous les 5 mètres
          timeInterval: 1000,  // Maximum 1 mise à jour par seconde
          foregroundService: {
            notificationTitle: 'Navigation en cours',
            notificationBody: 'Votre position est suivie pour la navigation'
          }
        },
        this.handleLocationUpdate
      );
    } catch (error) {
      console.error('Erreur lors de la configuration du suivi de position:', error);
      Alert.alert('Erreur', 'Impossible d\'accéder à votre position');
    }
  }

  // Gestion des mises à jour de position
  handleLocationUpdate = (location) => {
    const { coords } = location;
    
    console.log('Mise à jour position:', coords);
    
    // Convertir en tableau [longitude, latitude] pour MapboxGL
    const locationArray = [coords.longitude, coords.latitude];
    
    // Filtrage des positions erronées (Filtre de Kalman simplifié)
    if (this.lastValidLocation) {
      const timeDelta = (location.timestamp - this.lastValidLocation.timestamp) / 1000;
      const lastSpeed = this.lastValidLocation.coords.speed || 0;
      const maxDistance = (lastSpeed + 5) * timeDelta;
      
      const distance = this.calculateDistance(
        this.lastValidLocation.coords.latitude,
        this.lastValidLocation.coords.longitude,
        coords.latitude,
        coords.longitude
      );
      
      // Si la distance est trop grande pour être réaliste, ignorer cette position
      if (distance > maxDistance && maxDistance > 0) {
        console.log('Position ignorée - déplacement irréaliste');
        return;
      }
    }
    
    // Mise à jour de la position
    this.setState({ userLocation: locationArray }, () => {
      // Initialiser la navigation si on a la position et la destination mais pas encore d'itinéraire
      const { destinationCoords, currentRoute } = this.state;
      if (destinationCoords && !currentRoute) {
        this.initializeNavigation();
      }
      
      // Mettre à jour la direction de la flèche si on a un itinéraire
      if (currentRoute) {
        this.updateArrowDirection(locationArray, currentRoute);
      }
      
      // Vérifier si l'utilisateur s'écarte de l'itinéraire
      if (this.state.isNavigating && currentRoute) {
        this.checkRouteDeviation(locationArray);
      }
    });
    
    this.lastValidLocation = location;
  }

  // Helper pour calculer la distance
  calculateDistance = (lat1, lon1, lat2, lon2) => {
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

  // Démarrer le mode navigation avec un meilleur zoom
  startNavigationMode = async () => {
    const { userLocation } = this.state;
    
    if (!userLocation) {
      console.log('startNavigationMode: position utilisateur manquante');
      return;
    }
    
    console.log('Démarrage du mode navigation avec position:', userLocation);
    
    // Configurer la caméra pour le mode navigation
    if (this.mapCamera) {
      this.mapCamera.setCamera({
        centerCoordinate: userLocation, // Déjà au format [longitude, latitude]
        zoomLevel: 18, // Zoom plus précis
        heading: this.state.arrowDirection,
        pitch: 65, // Angle plus prononcé
        animationDuration: 500,
        paddingBottom: 150 // Plus d'espace pour voir devant
      });
    }
    
    // Activer le suivi utilisateur
    if (this.mapView) {
      this.mapView.setUserTrackingMode(MapboxGL.UserTrackingModes.FollowWithCourse);
    }
    
    this.setState({ isNavigating: true });
  }

  // Initialiser la navigation
  initializeNavigation = async () => {
    const { userLocation, destinationCoords } = this.state;
    
    if (!userLocation || !destinationCoords) {
      console.log('Impossible d\'initialiser la navigation: données manquantes', {userLocation, destinationCoords});
      return;
    }
    
    console.log('Navigation de', userLocation, 'à', destinationCoords);
    
    try {
      this.setState({ isLoadingRoute: true });
      
      // Calculer l'itinéraire - userLocation est déjà au format [longitude, latitude]
      const routes = await NavigationService.calculateRoutes(
        userLocation,
        destinationCoords,
        {
          avoidHighways: this.state.avoidHighways,
          avoidTolls: this.state.avoidTolls
        }
      );
      
      if (routes && routes.length > 0) {
        console.log('Itinéraire calculé avec succès:', routes[0].distance/1000, 'km');
        
        const bestRoute = routes[0];
        
        // Analyser l'itinéraire pour obtenir les manœuvres et l'heure d'arrivée estimée
        const maneuvers = this.extractManeuvers(bestRoute);
        const eta = this.calculateETA(bestRoute);
        
        this.setState({
          currentRoute: bestRoute,
          nextManeuver: maneuvers[0] || null,
          estimatedArrival: eta,
          isLoadingRoute: false
        }, () => {
          // Démarrer le mode navigation
          this.startNavigationMode();
          
          // Démarrer la surveillance des incidents
          this.startIncidentMonitoring(bestRoute);
        });
      } else {
        throw new Error("Aucun itinéraire trouvé");
      }
    } catch (error) {
      console.error('Erreur lors de l\'initialisation de la navigation:', error);
      this.setState({ isLoadingRoute: false });
      Alert.alert('Erreur', 'Impossible de calculer l\'itinéraire');
    }
  }

  // Extraire les manœuvres de l'itinéraire
  extractManeuvers = (route) => {
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
  }

  // Calculer l'heure d'arrivée estimée
  calculateETA = (route) => {
    if (!route || !route.duration) return null;
    
    const now = new Date();
    return new Date(now.getTime() + route.duration * 1000);
  }

  // Démarrer la surveillance des incidents
  startIncidentMonitoring = (route) => {
    this.incidentMonitoringStop = NavigationService.startIncidentMonitoring(
      route,
      this.handleNewIncidents
    );
  }

  // Gérer les nouveaux incidents
  handleNewIncidents = (newIncidents, allIncidents) => {
    // Analyser l'impact et recalculer si nécessaire
    const impact = NavigationService.analyzeIncidentImpact(
      this.state.currentRoute, 
      allIncidents
    );
    
    // Si l'impact est important, proposer un nouvel itinéraire
    if (impact.totalScore < 70) {
      this.suggestAlternativeRoute(impact);
    }
  }

  // Suggérer un itinéraire alternatif
  suggestAlternativeRoute = async (impact) => {
    const { userLocation, destinationCoords, currentRoute } = this.state;
    
    if (!userLocation || !destinationCoords) return;
    
    try {
      // Récupérer tous les incidents actifs
      const incidents = await apiService.incidents.getAll();
      
      // Recalculer les itinéraires en évitant les incidents
      const newRoutes = await NavigationService.recalculateRoutesBasedOnTraffic(
        userLocation, // Déjà au format [longitude, latitude]
        destinationCoords,
        currentRoute,
        incidents
      );
      
      // Si on a un meilleur itinéraire
      if (newRoutes && newRoutes.length > 0 && newRoutes[0].score > impact.totalScore + 15) {
        Alert.alert(
          'Nouvel itinéraire disponible',
          `Route plus rapide trouvée (${Math.round(newRoutes[0].estimatedDelay)} min de moins)`,
          [
            { text: 'Ignorer', style: 'cancel' },
            { 
              text: 'Prendre cette route', 
              onPress: () => {
                this.setState({ 
                  currentRoute: newRoutes[0],
                  isRerouting: false
                });
              } 
            }
          ]
        );
      }
    } catch (error) {
      console.error('Erreur lors de la suggestion d\'un itinéraire alternatif:', error);
    }
  }

  // Vérifier si l'utilisateur s'écarte de l'itinéraire
  checkRouteDeviation = (userLocation) => {
    const { currentRoute, destinationCoords } = this.state;
    
    if (!currentRoute || !currentRoute.geometry) return;
    
    // Créer une ligne à partir de l'itinéraire
    const routeLine = turf.lineString(currentRoute.geometry.coordinates);
    
    // Créer un point à partir de la position utilisateur
    const userPoint = turf.point(userLocation);
    
    // Calculer la distance entre l'utilisateur et l'itinéraire le plus proche
    const distance = turf.pointToLineDistance(userPoint, routeLine, { units: 'meters' });
    
    console.log('Distance de l\'itinéraire:', distance, 'mètres');
    
    // Si l'utilisateur est trop loin de l'itinéraire
    if (distance > DEVIATION_CHECK_CONSTANTS.DISTANCE_THRESHOLD) {
      // Incrémenter le compteur de déviation
      this.deviationCounter += 1;
      console.log('Déviation détectée:', this.deviationCounter);
      
      // Si c'est la première déviation, enregistrer l'horodatage
      if (this.deviationCounter === 1) {
        this.firstDeviationTimestamp = Date.now();
      }
      
      // Vérifier si nous avons dépassé le seuil de temps et de comptage
      const timeElapsed = Date.now() - (this.firstDeviationTimestamp || 0);
      
      if (this.deviationCounter >= DEVIATION_CHECK_CONSTANTS.MAX_CHECKS_BEFORE_REROUTE && 
          timeElapsed > DEVIATION_CHECK_CONSTANTS.TIME_THRESHOLD) {
        
        console.log('Recalcul d\'itinéraire requis');
        
        // Notification à l'utilisateur que l'itinéraire est en cours de recalcul
        this.showRerouteNotification();
        
        // Recalculer l'itinéraire à partir de la position actuelle
        this.recalculateRoute(
          userLocation,
          destinationCoords
        );
      } else if (this.deviationCounter === DEVIATION_CHECK_CONSTANTS.MAX_CHECKS_BEFORE_REROUTE - 1) {
        // Afficher une alerte de déviation imminente
        this.setState({ routeDeviation: true });
      }
    } else {
      // Si l'utilisateur est revenu sur l'itinéraire, réinitialiser le compteur
      if (this.deviationCounter > 0) {
        console.log('Retour sur l\'itinéraire');
        this.deviationCounter = 0;
        this.firstDeviationTimestamp = null;
      }
      
      if (this.state.routeDeviation) {
        this.setState({ routeDeviation: false });
      }
    }
  }

  // Afficher une notification de recalcul d'itinéraire
  showRerouteNotification = () => {
    this.setState({ isRerouting: true });
  }

  // Recalculer l'itinéraire
  recalculateRoute = async (origin, destination) => {
    try {
      // Afficher un indicateur de chargement ou une notification
      this.setState({ isLoadingRoute: true });
      
      console.log('Début du recalcul d\'itinéraire', origin, destination);
      
      // Appeler votre service de navigation existant
      const routes = await NavigationService.calculateRoutes(origin, destination, {
        avoidHighways: this.state.avoidHighways,
        avoidTolls: this.state.avoidTolls
      });
      
      // Masquer l'indicateur de chargement
      this.setState({ isLoadingRoute: false, isRerouting: false, routeDeviation: false });
      
      // Retourner le meilleur itinéraire
      if (routes && routes.length > 0) {
        // Calculer les nouvelles informations
        const maneuvers = this.extractManeuvers(routes[0]);
        const eta = this.calculateETA(routes[0]);
        
        this.setState({
          currentRoute: routes[0],
          nextManeuver: maneuvers[0] || null,
          estimatedArrival: eta
        });
        
        // Réinitialiser les compteurs de déviation
        this.deviationCounter = 0;
        this.firstDeviationTimestamp = null;
        
        return routes[0];
      } else {
        // Gérer l'erreur
        Alert.alert('Erreur', 'Impossible de recalculer l\'itinéraire');
        this.setState({ isRerouting: false });
        return this.state.currentRoute;
      }
    } catch (error) {
      console.error('Erreur lors du recalcul de l\'itinéraire:', error);
      this.setState({ isLoadingRoute: false, isRerouting: false });
      return this.state.currentRoute;
    }
  }

  // Calculer l'orientation de la flèche en fonction du prochain virage
  updateArrowDirection = (currentLocation, route) => {
    if (!route || !route.geometry || !currentLocation) return 0;
    
    const coordinates = route.geometry.coordinates;
    
    // Trouver le segment de route le plus proche
    const nearestPoint = turf.nearestPointOnLine(
      turf.lineString(coordinates),
      turf.point(currentLocation)
    );
    
    // Trouver le prochain point sur l'itinéraire
    const currentIndex = nearestPoint.properties.index;
    const nextIndex = Math.min(currentIndex + 1, coordinates.length - 1);
    const nextPoint = coordinates[nextIndex];
    
    // Calculer l'angle entre position actuelle et prochain point
    const bearing = turf.bearing(
      currentLocation,
      nextPoint
    );
    
    // Mettre à jour l'état pour la rotation de la flèche
    this.setState({ arrowDirection: bearing });
    
    return bearing;
  }

  // Rendu de l'itinéraire avec style Waze (fluorescent)
  renderRoute = () => {
    const { currentRoute, isNightMode, isNavigating } = this.state;
    
    // Si pas de route, ne rien faire
    if (!currentRoute || !currentRoute.geometry) return null;
    
    const coordinates = currentRoute.geometry.coordinates;
    
    return (
      <>
        {/* Contour lumineux pour effet fluorescent */}
        <MapboxGL.ShapeSource id="route-outline" shape={{
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates
          }
        }}>
          <MapboxGL.LineLayer 
            id="route-outline-layer" 
            style={{
              lineColor: '#FFFFFF',
              lineWidth: 12, // Plus épais
              lineCap: 'round',
              lineJoin: 'round',
              lineOpacity: 0.7 // Plus visible
            }} 
          />
        </MapboxGL.ShapeSource>
        
        {/* Ligne principale de l'itinéraire */}
        <MapboxGL.ShapeSource id="route-main" shape={{
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates
          }
        }}>
          <MapboxGL.LineLayer 
            id="route-main-layer" 
            style={{
              lineColor: isNavigating ? '#00FFFF' : (isNightMode ? '#30F3F6' : '#4285F4'),
              lineWidth: 8, // Plus épais
              lineCap: 'round',
              lineJoin: 'round',
              lineOpacity: 1.0 // Opacité maximale
            }} 
            aboveLayerID="route-outline-layer"
          />
        </MapboxGL.ShapeSource>
        
        {/* Effet d'animation si on navigue */}
        {isNavigating && coordinates.length > 20 && (
          <MapboxGL.ShapeSource id="route-animation" shape={{
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: coordinates.slice(0, 20)
            }
          }}>
            <MapboxGL.LineLayer 
              id="route-animation-layer" 
              style={{
                lineColor: '#FFFFFF',
                lineWidth: 3,
                lineOpacity: 0.7,
                lineCap: 'round',
                lineJoin: 'round'
              }}
            />
          </MapboxGL.ShapeSource>
        )}
      </>
    );
  }

  // Rendu de l'indicateur de position utilisateur (flèche Waze-like)
  renderUserLocation = () => {
    const { userLocation, arrowDirection, isNavigating } = this.state;
    
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
            { transform: [{ scale: isNavigating ? 1.2 : 1 }] }
          ]}
        >
          <View 
            style={[
              styles.userArrow,
              { transform: [{ rotate: `${arrowDirection}deg` }] }
            ]}
          >
            <View style={styles.arrowTriangle} />
            <View style={styles.arrowCircle} />
            {isNavigating && (
              <View style={styles.arrowShadow} />
            )}
          </View>
        </View>
      </MapboxGL.PointAnnotation>
    );
  }

  render() {
    const { 
      userLocation, 
      currentRoute, 
      isNavigating,
      isRerouting,
      routeDeviation,
      isNightMode,
      isLoadingRoute,
      nextManeuver,
      estimatedArrival,
      destinationCoords
    } = this.state;
    
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
        
        {/* Carte principale */}
        <MapboxGL.MapView
          ref={ref => this.mapView = ref}
          style={styles.map}
          styleURL={isNightMode ? MapboxGL.StyleURL.Dark : MapboxGL.StyleURL.Street}
          compassEnabled={true}
          logoEnabled={false}
          compassViewMargins={{ x: 16, y: 120 }}
        >
          {/* Caméra - mise à jour avec meilleur zoom et angle */}
          <MapboxGL.Camera
            ref={ref => this.mapCamera = ref}
            followUserLocation={isNavigating}
            followUserMode={isNavigating ? MapboxGL.UserTrackingModes.FollowWithCourse : MapboxGL.UserTrackingModes.None}
            followZoomLevel={isNavigating ? 18 : DEFAULT_ZOOM_LEVEL} // Zoom plus important
            followPitch={isNavigating ? 65 : 0} // Angle plus incliné
            animationDuration={500}
            centerCoordinate={userLocation}
          />
          
          {/* Affichage de l'itinéraire fluorescent */}
          {currentRoute && this.renderRoute()}
          
          {/* Indicateur de position utilisateur amélioré */}
          {this.renderUserLocation()}
          
          {/* Destination */}
          {destinationCoords && (
            <MapboxGL.PointAnnotation
              id="destination"
              coordinate={destinationCoords}
            >
              <View style={styles.destinationMarker}>
                <MaterialIcons name="location-pin" size={30} color="#F44336" />
              </View>
            </MapboxGL.PointAnnotation>
          )}
        </MapboxGL.MapView>
        
        {/* Interface de navigation */}
        {isNavigating && (
          <View style={styles.navigationContainer}>
            {/* Affichage de la prochaine manœuvre */}
            {nextManeuver && (
              <View style={styles.maneuverContainer}>
                <View style={styles.instructionIconContainer}>
                  <Ionicons 
                    name={this.getDirectionIcon(nextManeuver)} 
                    size={24} 
                    color="#FFF" 
                  />
                </View>
                <Text style={styles.maneuverText}>{nextManeuver.instruction}</Text>
                <Text style={styles.maneuverDistance}>
                  {nextManeuver.distance < 1000 
                    ? `${Math.round(nextManeuver.distance)}m` 
                    : `${(nextManeuver.distance / 1000).toFixed(1)}km`}
                </Text>
              </View>
            )}
            
            {/* Affichage de l'heure d'arrivée estimée */}
            {estimatedArrival && (
              <View style={styles.etaContainer}>
                <Text style={styles.etaLabel}>Arrivée prévue</Text>
                <Text style={styles.etaTime}>
                  {estimatedArrival.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </Text>
              </View>
            )}
          </View>
        )}
        
        {/* Indicateur de chargement */}
        {isLoadingRoute && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4285F4" />
            <Text style={styles.loadingText}>Calcul de l'itinéraire...</Text>
          </View>
        )}
        
        {/* Notification de recalcul */}
        {isRerouting && (
          <View style={styles.reroutingContainer}>
            <Text style={styles.reroutingText}>Recalcul de l'itinéraire...</Text>
          </View>
        )}
        
        {/* Alerte de déviation */}
        {routeDeviation && (
          <View style={styles.deviationContainer}>
            <Text style={styles.deviationText}>Vous vous éloignez de l'itinéraire</Text>
          </View>
        )}
      </View>
    );
  }
  
  // Helper pour obtenir l'icône de direction selon le type de manoeuvre
  getDirectionIcon = (step) => {
    if (!step || !step.type) return 'arrow-forward';
    
    switch(step.type) {
      case 'arrive': return 'flag';
      case 'depart': return 'play';
      case 'turn':
        if (step.modifier === 'left') return 'arrow-back';
        if (step.modifier === 'right') return 'arrow-forward';
        if (step.modifier === 'slight left') return 'arrow-back';
        if (step.modifier === 'slight right') return 'arrow-forward';
        if (step.modifier === 'sharp left') return 'arrow-back';
        if (step.modifier === 'sharp right') return 'arrow-forward';
        if (step.modifier === 'uturn') return 'refresh';
        return 'arrow-forward';
      case 'continue': return 'arrow-up';
      case 'merge': return 'git-merge';
      case 'fork': return 'git-branch';
      case 'roundabout': return 'refresh';
      default: return 'arrow-forward';
    }
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  navigationContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  maneuverContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  instructionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00AAFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  maneuverText: {
    flex: 1,
    fontSize: 18,
    fontWeight: '500',
  },
  maneuverDistance: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00AAFF',
  },
  etaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  etaLabel: {
    fontSize: 16,
    color: '#666',
  },
  etaTime: {
    fontSize: 18,
    fontWeight: '600',
  },
  destinationMarker: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  loadingText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  reroutingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(66, 133, 244, 0.9)',
    padding: 12,
    alignItems: 'center',
  },
  reroutingText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  deviationContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 152, 0, 0.9)',
    padding: 12,
    alignItems: 'center',
  },
  deviationText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  // Styles améliorés pour la flèche de direction - comme dans NavigationScreen
  userArrowContainer: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
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
    borderBottomColor: '#00AAFF',
    transform: [{ translateY: -5 }]
  },
  arrowCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'white',
    borderWidth: 4,
    borderColor: '#00AAFF',
    transform: [{ translateY: -15 }]
  },
  arrowShadow: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 170, 255, 0.3)',
    transform: [{ translateY: -10 }]
  },
});

export default NewNavigationScreen;