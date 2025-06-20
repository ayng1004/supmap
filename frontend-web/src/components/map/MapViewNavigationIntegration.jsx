// MapViewNavigationIntegration.jsx
// Exemple d'intégration de l'API de navigation dans MapView.jsx

import React, { useState, useEffect, useRef } from 'react';
import { 
  DynamicNavigationProvider, 
  RouteAlternativesPreview, 
  RouteIncidentsOverview 
} from './NavigationIntegration';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import NavigationAPI from '../../services/NavigationAPI';

// Exemple d'intégration dans MapView.jsx
const MapViewWithNavigation = () => {
  // Tous les states et refs de votre MapView original
  const { user } = useContext(AuthContext);
  const userLocationMarker = useRef(null);
  const mapContainer = useRef(null);
  const map = useRef(null);
  
  const [lng, setLng] = useState(2.3488);
  const [lat, setLat] = useState(48.8534);
  const [zoom, setZoom] = useState(9);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState(null);
  
  const [showRouteForm, setShowRouteForm] = useState(false);
  const [routeData, setRouteData] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const mapCoords = useRef({ lng: 2.3488, lat: 48.8534, zoom: 9 });
  
  const [showIncidentForm, setShowIncidentForm] = useState(false);
  const [showIncidentList, setShowIncidentList] = useState(false);
  const [clickedPosition, setClickedPosition] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [showIncidentDetails, setShowIncidentDetails] = useState(false);
  
  const startMarker = useRef(null);
  const endMarker = useRef(null);
  const incidentMarkers = useRef({});
  const [mapBounds, setMapBounds] = useState(null);
  const [showIncidents, setShowIncidents] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [incidentsInView, setIncidentsInView] = useState([]);
  
  // Nouveaux états pour la navigation dynamique
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [alternativeRoutes, setAlternativeRoutes] = useState([]);
  const [detectedIncidents, setDetectedIncidents] = useState([]);
  
  // Initialisation de la carte (code existant)
  // ... Votre code existant pour initialiser la carte ...
  
  // Fonction pour gérer le changement d'itinéraire
  const handleRouteChange = (route) => {
    setRouteData({
      ...route,
      routes: [route]
    });
    
    // Dessiner l'itinéraire sur la carte
    drawRoute({
      routes: [route]
    }, { 
      coordinates: route.origin || route.legs[0].steps[0].geometry.coordinates[0]
    }, { 
      coordinates: route.destination || route.legs[route.legs.length - 1].steps.slice(-1)[0].geometry.coordinates.slice(-1)[0]
    });
  };
  
  // Fonction pour gérer la détection d'incidents
  const handleIncidentDetected = (newIncidents, updatedRoute, alternatives) => {
    // Mettre à jour les données d'itinéraire
    setRouteData({
      ...updatedRoute,
      routes: [updatedRoute]
    });
    
    // Stocker les incidents détectés
    setDetectedIncidents(newIncidents);
    
    // Vérifier si des alternatives sont disponibles
    if (alternatives && alternatives.length > 0) {
      setAlternativeRoutes(alternatives);
      setShowAlternatives(true);
    }
    
    // Notifier l'utilisateur
    toast.warning(
      <div>
        <strong>Incident détecté sur votre itinéraire</strong>
        <p>Des options alternatives sont disponibles.</p>
      </div>,
      {
        autoClose: 8000,
        closeOnClick: true,
        position: "top-right"
      }
    );
  };
  
  // Fonction pour gérer les itinéraires alternatifs calculés
  const handleAlternativeRoutesCalculated = (alternatives, incidents) => {
    setAlternativeRoutes(alternatives);
    
    // Si des incidents nécessitent un reroutage, montrer les alternatives
    const requiresRerouting = incidents.some(incident => {
      const type = incident.type?.toUpperCase();
      return type === 'ACCIDENT' || type === 'CLOSURE' || type === 'TRAFFIC';
    });
    
    if (requiresRerouting) {
      setShowAlternatives(true);
    }
  };
  
  // Fonction pour gérer la sélection d'un itinéraire alternatif
  const handleRouteSelected = (route) => {
    // Mettre à jour l'itinéraire actuel
    setRouteData({
      ...route,
      routes: [route]
    });
    
    // Dessiner le nouvel itinéraire
    const startPoint = {
      coordinates: route.legs[0].steps[0].geometry.coordinates[0]
    };
    
    const endPoint = {
      coordinates: route.legs[route.legs.length - 1].steps.slice(-1)[0].geometry.coordinates.slice(-1)[0]
    };
    
    drawRoute({ routes: [route] }, startPoint, endPoint);
    
    // Masquer le panneau des alternatives
    setShowAlternatives(false);
    
    // Montrer les instructions si elles ne sont pas déjà visibles
    if (!showInstructions) {
      setShowInstructions(true);
    }
  };
  
  // Version modifiée de votre handleRouteSubmit existant
  const handleRouteSubmit = async (formData) => {
    try {
      setRouteLoading(true);
      setError(null);
      
      let startCoords, endCoords;
      
      if (formData.startPoint === 'current-location') {
        const position = await getCurrentPosition();
        startCoords = position;
      } else {
        startCoords = await geocodeAddress(formData.startPoint);
      }
      
      endCoords = await geocodeAddress(formData.endPoint);
      
      // Les coordonnées sont déjà prêtes, pas besoin d'appeler getRoute
      // directement car la navigation le fera pour nous
      
      setShowRouteForm(false);
      setShowInstructions(true);
      
      // Note: le calcul de l'itinéraire se fait maintenant via le DynamicNavigationProvider
      // qui s'occupera d'appeler NavigationAPI.calculateRoute
      
      return {
        origin: startCoords.coordinates,
        destination: endCoords.coordinates,
        options: formData.options,
        startPoint: startCoords,
        endPoint: endCoords
      };
    } catch (err) {
      console.error("Erreur lors du calcul de l'itinéraire:", err);
      setError(err.message || "Impossible de calculer l'itinéraire");
      return null;
    } finally {
      setRouteLoading(false);
    }
  };
  
  return (
    <div className="map-container">
      <ToastContainer /> {/* Pour les notifications */}
      <div ref={mapContainer} className="map" />
      
      <DynamicNavigationProvider
        map={map.current}
        mapLoaded={mapLoaded}
        onRouteChange={handleRouteChange}
        onIncidentDetected={handleIncidentDetected}
        onAlternativeRoutesCalculated={handleAlternativeRoutesCalculated}
      >
        {(navigation) => (
          <div className="control-elements-container">
            <div className="coordinates-box">
              Longitude: {lng} | Latitude: {lat} | Zoom: {zoom}
              {!mapLoaded && !error && <div>Chargement de la carte...</div>}
              {error && <div className="error-message">{error}</div>}
            </div>
            
            <div className="controls-top">
              {!showRouteForm && !showInstructions && (
                <button 
                  className="control-btn route-btn"
                  onClick={() => setShowRouteForm(true)}
                  title="Calculer un itinéraire"
                >
                  <FaRoute size={22} />
                </button>
              )}
              
              {routeData && !showRouteForm && !showInstructions && (
                <button 
                  className="control-btn instructions-btn"
                  onClick={() => setShowInstructions(true)}
                  title="Voir les instructions"
                >
                  <FaListUl size={22} />
                </button>
              )}
              
              {routeData && (
                <button 
                  className="control-btn clear-btn"
                  onClick={() => {
                    clearRoute();
                    navigation.stopRouteMonitoring();
                    setShowAlternatives(false);
                  }}
                  title="Effacer l'itinéraire"
                >
                  <FaTimes size={22} />
                </button>
              )}
              
              {/* Bouton de géolocalisation existant */}
              <button 
                className="control-btn geolocate-btn"
                onClick={async () => {
                  try {
                    // Votre code existant de géolocalisation
                  } catch (error) {
                    console.error('Erreur de géolocalisation:', error);
                    alert('Impossible d\'obtenir votre position actuelle. Veuillez vérifier les permissions de géolocalisation.');
                  }
                }}
                title="Localisation actuelle"
              >
                <FaLocationArrow size={22} />
              </button>
            </div>
            
            <div className="controls-incidents">
              <button 
                className="control-btn incidents-btn"
                onClick={() => setShowIncidentList(!showIncidentList)}
                title={showIncidentList ? "Masquer les incidents" : "Voir les incidents"}
              >
                {showIncidentList ? <FaEyeSlash size={22} /> : <FaEye size={22} />}
              </button>
              
              {showIncidentForm && (
                <button 
                  className="control-btn cancel-btn"
                  onClick={() => {
                    setShowIncidentForm(false);
                    setClickedPosition(null);
                  }}
                  title="Annuler le signalement"
                >
                  <FaTimes size={22} />
                </button>
              )}
            </div>
            
            {showRouteForm && (
              <div className="form-container route-form-container">
                <RouteForm 
                  onSubmit={async (formData) => {
                    const routeParams = await handleRouteSubmit(formData);
                    if (routeParams) {
                      // Utiliser la navigation dynamique pour calculer l'itinéraire
                      await navigation.calculateRoute(
                        routeParams.origin,
                        routeParams.destination,
                        routeParams.options
                      );
                    }
                  }} 
                  onCancel={() => setShowRouteForm(false)} 
                />
              </div>
            )}
            
            {showInstructions && routeData && (
              <div className="form-container instructions-container">
                <>
                  <RouteInstructions 
                    route={routeData} 
                    onClose={() => setShowInstructions(false)} 
                  />
                  
                  {/* Afficher les incidents sur l'itinéraire actuel */}
                  {routeData.incidents && routeData.incidents.length > 0 && (
                    <RouteIncidentsOverview route={routeData} />
                  )}
                </>
              </div>
            )}
            
            {/* Panneau des itinéraires alternatifs */}
            {showAlternatives && alternativeRoutes.length > 0 && (
              <div className="form-container alternatives-container">
                <RouteAlternativesPreview
                  originalRoute={routeData}
                  alternativeRoutes={alternativeRoutes}
                  onRouteSelected={(route) => {
                    handleRouteSelected(route);
                    navigation.selectRoute(route);
                  }}
                />
              </div>
            )}
            
            {showIncidentForm && clickedPosition && (
              <div className="form-container incident-form-container">
                <IncidentForm 
                  position={clickedPosition}
                  onSubmit={handleIncidentSubmit}
                  onCancel={() => {
                    setShowIncidentForm(false);
                    setClickedPosition(null);
                  }}
                />
              </div>
            )}
            
            {showIncidentList && (
              <IncidentsPanel 
                visible={showIncidentList}
                onClose={() => setShowIncidentList(false)}
                refreshTrigger={refreshTrigger}
              />
            )}
            
            {/* Détails d'un incident */}
            {showIncidentDetails && selectedIncident && (
              <IncidentDetails 
                incident={selectedIncident}
                onVote={handleIncidentVote}
                onClose={handleCloseIncidentDetails}
                onRefresh={() => setRefreshTrigger(prev => prev + 1)}
              />
            )}
            
            {/* Indicateur de chargement de l'itinéraire */}
            {routeLoading && (
              <div className="loading-overlay">
                <div className="loading-content">
                  <div className="loading-spinner"></div>
                  <div>Calcul de l'itinéraire en cours...</div>
                </div>
              </div>
            )}
          </div>
        )}
      </DynamicNavigationProvider>
    </div>

    
  );
};

export default MapViewWithNavigation;