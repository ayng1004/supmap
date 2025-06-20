// MapView.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useContext } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import RouteForm from './RouteForm';
import RouteInstructions from './RouteInstructions';
import IncidentForm from './IncidentForm';
import IncidentDetails from './IncidentDetails';
import IncidentList from './IncidentList';
import IncidentsPanel from './IncidentsPanel';
import QRCodeShare from './QRCodeShare';
import RouteAlert from './RouteAlert';
import RouteAlternativesPanel from './RouteAlternativesPanel';
import incidentService from '../../services/IncidentService';
import SmartNavigationService from '../../services/SmartNavigationService';
import RouteNotificationManager from '../../services/RouteNotificationManager';
import NearbyIncidentsCard from './NearbyIncidentsCard';
import { 
  FaRoute, FaListUl, FaTimes, FaEye, FaEyeSlash, 
  FaExclamationTriangle, FaQrcode, FaLocationArrow, FaCog, FaExchangeAlt, FaSearchLocation 
} from 'react-icons/fa';
import { geocodeAddress, getCurrentPosition, getRoute } from '../../services/directionsService';
import { 
  createIncident, 
  addIncident, 
  getAllIncidents, 
  getIncidentsInArea, 
  voteIncident,
  INCIDENT_TYPES
} from '../../services/IncidentService';
import { AuthContext } from '../../context/AuthProvider';
import './MapView.css';

const MapView = () => {
  const { user } = useContext(AuthContext);
  const userLocationMarker = useRef(null);
  // Référence à la carte
  const mapContainer = useRef(null);
  const map = useRef(null);
  
  // États pour la carte
  const [lng, setLng] = useState(2.3488);
  const [lat, setLat] = useState(48.8534);
  const [zoom, setZoom] = useState(9);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState(null);
  
  // États pour les itinéraires
  const [showRouteForm, setShowRouteForm] = useState(false);
  const [routeData, setRouteData] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showQRShare, setShowQRShare] = useState(false);
  const mapCoords = useRef({ lng: 2.3488, lat: 48.8534, zoom: 9 });

  // États pour les incidents
  const [showIncidentForm, setShowIncidentForm] = useState(false);
  const [showIncidentList, setShowIncidentList] = useState(false);
  const [clickedPosition, setClickedPosition] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [showIncidentDetails, setShowIncidentDetails] = useState(false);
  
  // Références pour les marqueurs
  const startMarker = useRef(null);
  const endMarker = useRef(null);
  const incidentMarkers = useRef({});
  const [mapBounds, setMapBounds] = useState(null);
  const [showIncidents, setShowIncidents] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [incidentsInView, setIncidentsInView] = useState([]);
  
  // États pour la navigation intelligente
  const [currentNotification, setCurrentNotification] = useState(null);
  const [autoReroute, setAutoReroute] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // États pour les alternatives d'itinéraires
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [routeAlternatives, setRouteAlternatives] = useState(null);
  const [previewRoute, setPreviewRoute] = useState(null);
  const [originalRoute, setOriginalRoute] = useState(null);

  // Effet pour gérer les notifications d'itinéraire - VERSION CORRIGÉE
  useEffect(() => {
    // Fonction pour gérer les notifications d'incidents
    const handleRouteNotification = async (notification) => {
      console.log('Notification reçue:', notification);
      
      // Conserver la notification
      setCurrentNotification(notification);
      
      // Si la notification contient des incidents
      if (notification.incidents?.length > 0 && routeData) {
        try {
          console.log("Calcul des itinéraires alternatifs...");
          
          // Force le calcul d'alternatives avec évitement des incidents
          const alternatives = await SmartNavigationService.recalculateRoutesWithAvoidance(
            routeData.startPoint.coordinates,
            routeData.endPoint.coordinates,
            routeData.options,
            notification.incidents
          );
          
          console.log("Alternatives calculées:", alternatives);
          
          // Stocker les alternatives
          setRouteAlternatives(alternatives);
          
          // TOUJOURS afficher les alternatives, quel que soit le paramètre autoReroute
          setShowAlternatives(true);
        } catch (error) {
          console.error('Erreur lors du calcul des alternatives:', error);
        }
      }
    };
    
    // Ajouter l'écouteur de notifications
    RouteNotificationManager.addListener(handleRouteNotification);
    
    // Nettoyer l'écouteur lors du démontage du composant
    return () => {
      RouteNotificationManager.removeListener(handleRouteNotification);
      // Arrêter la surveillance si elle est active
      RouteNotificationManager.stop();
    };
  }, [routeData]); // Dépendance seulement sur routeData
  
  const addIncidentToMap = useCallback((incident) => {
    if (!map.current || !mapLoaded) {
      console.log("Carte non chargée, impossible d'ajouter l'incident", incident);
      return;
    }
  
    // Vérifier que l'incident est actif
    if (incident.active === false) {
      console.log("Incident inactif, ne pas ajouter à la carte");
      return;
    }
  
    // Déterminer les coordonnées
    let lng, lat;
    
    if (incident.location && Array.isArray(incident.location)) {
      [lng, lat] = incident.location;
    } else if (incident.longitude !== undefined && incident.latitude !== undefined) {
      lng = incident.longitude;
      lat = incident.latitude;
    } else {
      console.warn('Coordonnées introuvables pour incident:', incident);
      return;
    }
  
    // Vérifier que les coordonnées sont valides
    if (
      typeof lng !== 'number' ||
      typeof lat !== 'number' ||
      isNaN(lng) ||
      isNaN(lat)
    ) {
      console.warn('Coordonnées invalides pour incident:', lng, lat, incident);
      return;
    }
  
    // Vérifier si un marqueur existe déjà pour cet incident
    if (incident.id && incidentMarkers.current[incident.id]) {
      console.log(`Marqueur existe déjà pour incident ${incident.id}, suppression avant recréation`);
      incidentMarkers.current[incident.id].remove();
    }
   
    // Déterminer le type d'icône
    const typeId = incident.type?.toLowerCase();
    const iconPath = `${process.env.PUBLIC_URL}/icons/${typeId}.png`;
    const typeLabel = INCIDENT_TYPES[incident.type?.toUpperCase()]?.label || incident.type;
    const typeInfo = INCIDENT_TYPES[incident.type?.toUpperCase()] ||
                     Object.values(INCIDENT_TYPES).find(type => type.id === incident.type);
    const color = typeInfo?.color || '#ff0000'; 

    // Créer un conteneur pour l'icône et le label
    const el = document.createElement('div');
    el.className = 'custom-marker';
    
    el.style.cssText = `
      background-color: ${color};
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      color: white;
      font-weight: bold;
      box-shadow: 0 0 2px rgba(0,0,0,0.4);
      cursor: pointer;
      transform: translate(-50%, -50%);
    `;

    const iconImg = document.createElement('img');
    iconImg.src = iconPath;
    iconImg.alt = typeLabel;
    iconImg.title = typeLabel;
    iconImg.style.cssText = `
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid white;
      background-color: white;
      box-shadow:
        0 0 6px white,
        0 0 12px ${color},
        0 0 18px ${color},
        0 0 24px ${color};
    `;

    el.appendChild(iconImg);
    
    // Créer le label
    const label = document.createElement('span');
    label.innerText = typeLabel;
    label.style.cssText = `
      font-size: 10px;
      background: rgba(255,255,255,0.8);
      padding: 1px 4px;
      border-radius: 4px;
      margin-top: 2px;
    `;

    const iconWrapper = document.createElement('div');
    iconWrapper.style.cssText = `
      background-color: white;
      border-radius: 50%;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 10px ${color};
    `;

    iconWrapper.appendChild(iconImg);
    el.appendChild(iconWrapper);
    
    // Crée un popup avec le type d'incident
    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 25
    }).setText(typeLabel);
    
    el.addEventListener('mouseenter', () => {
      popup.setLngLat([lng, lat]).addTo(map.current);
    });
    
    el.addEventListener('mouseleave', () => popup.remove());

    // Stocker l'ID de l'incident dans l'élément DOM
    el.dataset.incidentId = incident.id;
    
    // Créer et ajouter le marqueur avec les coordonnées exactes (sans décalage)
    const marker = new mapboxgl.Marker(el)
      .setLngLat([lng, lat])
      .addTo(map.current);
    
    // Gestionnaire de clic
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      setShowIncidentForm(false);
      setShowRouteForm(false);
      setShowInstructions(false);
      setShowQRShare(false);
      
      setSelectedIncident(incident);
      setShowIncidentDetails(true);
    });
  
    // Stocker le marqueur
    if (incident.id) {
      incidentMarkers.current[incident.id] = marker;
    }
  }, [mapLoaded, map]);

  const updateIncidentsOnMap = useCallback(() => {
    if (!map.current || !mapLoaded) return;
    
    console.log("Mise à jour des marqueurs sur la carte...");
    
    // Créer une map des incidents par ID pour vérifier rapidement
    const incidentMap = new Map();
    incidents.forEach(incident => {
      if (incident.active !== false) {
        incidentMap.set(incident.id.toString(), incident);
      }
    });
    
    // Supprimer uniquement les marqueurs qui ne sont plus dans la liste d'incidents
    Object.entries(incidentMarkers.current).forEach(([id, marker]) => {
      if (!incidentMap.has(id.toString())) {
        console.log(`Suppression du marqueur pour l'incident ${id} (n'existe plus)`);
        marker.remove();
        delete incidentMarkers.current[id];
      }
    });
    
    // Ajouter ou mettre à jour uniquement les incidents qui n'ont pas de marqueur
    incidents.forEach(incident => {
      if (incident.active !== false) {
        const id = incident.id.toString();
        if (!incidentMarkers.current[id]) {
          console.log(`Ajout du marqueur pour l'incident ${id} (nouveau)`);
          addIncidentToMap(incident);
        }
      }
    });
  }, [incidents, mapLoaded, addIncidentToMap]);

  // Utiliser un effet pour mettre à jour les bounds de la carte
  useEffect(() => {
    if (map.current && mapLoaded) {
      const handleMove = () => {
        const bounds = map.current.getBounds();
        setMapBounds({
          lat1: bounds.getSouth(),
          lon1: bounds.getWest(),
          lat2: bounds.getNorth(),
          lon2: bounds.getEast()
        });
      };
      
      map.current.on('moveend', handleMove);
      handleMove(); // Initialiser les bounds
      
      return () => {
        if (map.current && map.current.off) {
          map.current.off('moveend', handleMove);
        }
      };
    }
  }, [mapLoaded]);
  
  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        setError(null);
        let data;
  
        if (mapBounds) {
          data = await getIncidentsInArea(mapBounds);
        } else {
          data = await getAllIncidents();
        }
  
        if (data) {
          console.log('Incidents récupérés :', data);
  
          const activeIncidents = data.filter(incident => incident.active !== false);
          setIncidentsInView(activeIncidents);
  
          setIncidents(prev => {
            const prevString = JSON.stringify(prev);
            const newString = JSON.stringify(data);
            return prevString !== newString ? data : prev;
          });
        } else {
          setError('Aucune donnée reçue');
        }
      } catch (err) {
        console.error('Erreur lors du chargement des incidents:', err);
        setError('Erreur lors du chargement des incidents');
      }
    };
  
    const timeout = setTimeout(() => {
      fetchIncidents();
    }, 300);
  
    return () => clearTimeout(timeout);
  }, [mapBounds, refreshTrigger]);
  
  // Mettre à jour les marqueurs quand les incidents changent
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    updateIncidentsOnMap();
  }, [incidents, mapLoaded, updateIncidentsOnMap]);

  // Initialisation de la carte
  useEffect(() => {
    if (map.current) return; // La carte est déjà initialisée
    
    const mapboxToken = "pk.eyJ1IjoidG95Y2FuIiwiYSI6ImNseDNyemg4eTAza2kya3Nhcm40cW5wcGsifQ.O-QayF8YihwNF62txHaOBw";
    
    console.log("Initialisation de la carte avec la clé Mapbox");
    
    // Initialiser Mapbox avec la clé
    mapboxgl.accessToken = mapboxToken;
    
    let mapInstance = null; // Nouvel objet pour stocker l'instance de la carte
    
    try {
      const savedStyle = localStorage.getItem('mapStyle') || 'mapbox://styles/mapbox/streets-v11';
      mapInstance = new mapboxgl.Map({
        container: mapContainer.current,
        style: savedStyle,
        center: [lng, lat],
        zoom: zoom,
        attributionControl: false
      });
      
      // Stocker l'instance
      map.current = mapInstance;
      
      mapInstance.on('load', () => {
        console.log("Carte chargée avec succès");
        setMapLoaded(true);
      
        // Ajouter l'extrusion 3D des bâtiments si la source "composite" est présente
        const layers = mapInstance.getStyle().layers;
        const labelLayerId = layers.find(
          (layer) => layer.type === 'symbol' && layer.layout?.['text-field']
        )?.id;
      
        try {
          mapInstance.addLayer(
            {
              id: '3d-buildings',
              source: 'composite',
              'source-layer': 'building',
              filter: ['==', 'extrude', 'true'],
              type: 'fill-extrusion',
              minzoom: 15,
              paint: {
                'fill-extrusion-color': '#aaa',
                'fill-extrusion-height': ['get', 'height'],
                'fill-extrusion-base': ['get', 'min_height'],
                'fill-extrusion-opacity': 0.6
              }
            },
            labelLayerId // insérer avant les labels pour que les bâtiments apparaissent en dessous
          );
        } catch (e) {
          console.warn("Impossible d'ajouter la couche 3D (peut-être style incompatible) :", e);
        }
      
        // Ajouter les sources et couches pour l'itinéraire
        mapInstance.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: []
            }
          }
        });
      
        mapInstance.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#3887be',
            'line-width': 5,
            'line-opacity': 0.75
          }
        });
      
        // Charger tous les incidents existants
        setRefreshTrigger(prev => prev + 1);
      });
      
      mapInstance.on('error', (e) => {
        console.error("Erreur Mapbox:", e);
        setError("Erreur lors du chargement de la carte");
      });

      mapInstance.on('move', () => {
        const center = mapInstance.getCenter();
        mapCoords.current.lng = center.lng.toFixed(4);
        mapCoords.current.lat = center.lat.toFixed(4);
        mapCoords.current.zoom = mapInstance.getZoom().toFixed(2);
      });
      
      
      // Gérer les clics sur la carte pour ajouter des incidents
      mapInstance.on('click', (e) => {
        if (!showIncidentForm && !showIncidentDetails) {
          setClickedPosition([e.lngLat.lng, e.lngLat.lat]);
          setShowIncidentForm(true);
          // Fermer d'autres panneaux si ouverts
          setShowQRShare(false);
        }
      });
      
      mapInstance.on('styleimagemissing', (e) => {
        const id = e.id;
        console.log(`Image manquante: ${id}, création d'une image de substitution`);
        
        const width = 10;
        const height = 10;
        const data = new Uint8Array(width * height * 4);
        
        for (let i = 0; i < width * height; i++) {
          data[i * 4] = 255;     // rouge
          data[i * 4 + 1] = 204;  // vert
          data[i * 4 + 2] = 0;    // bleu
          data[i * 4 + 3] = 255;  // alpha
        }
        
        mapInstance.addImage(id, { width, height, data });
      });
   
      // Ajouter les contrôles à la carte - placés en bas à gauche
      mapInstance.addControl(new mapboxgl.NavigationControl(), 'bottom-left');
      mapInstance.addControl(new mapboxgl.AttributionControl({
        compact: true
      }), 'bottom-left');
      mapInstance.addControl(new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true
        },
        trackUserLocation: true,
        showUserHeading: true
      }), 'bottom-left');
    } catch (err) {
      console.error("Erreur lors de l'initialisation de la carte:", err);
      setError("Impossible d'initialiser la carte Mapbox");
    }
    
    // Fonction de nettoyage
    return () => {
      if (mapInstance) {
        mapInstance.remove();
        map.current = null;
      }
    };
  }, []); // Ajout des dépendances

  // Fonction utilitaire pour obtenir les coordonnées d'un incident
  const getIncidentCoordinates = (incident) => {
    if (!incident) return null;
    
    if (incident.location && Array.isArray(incident.location)) {
      return incident.location;
    }
    
    if (incident.longitude !== undefined && incident.latitude !== undefined) {
      return [parseFloat(incident.longitude), parseFloat(incident.latitude)];
    }
    
    if (incident.location && incident.location.coordinates && Array.isArray(incident.location.coordinates)) {
      return incident.location.coordinates;
    }
    
    if (incident.coords && Array.isArray(incident.coords)) {
      return incident.coords;
    }
    
    return null;
  };

  // Nouvelle fonction pour vérifier si un incident affecte l'itinéraire actif
  const checkIncidentImpactOnRoute = async (incident) => {
    if (!routeData || !routeData.routes || routeData.routes.length === 0) return;
    
    // Vérifier si l'incident est sur ou près de l'itinéraire
    const currentRoute = routeData.routes.find(r => r.recommended) || routeData.routes[0];
    
    // Utiliser le service pour analyser uniquement ce nouvel incident
    const incidentImpact = SmartNavigationService.analyzeIncidentImpact(currentRoute, [incident]);
    
    // Si l'incident a un impact sur l'itinéraire (est proche ou sur l'itinéraire)
    if (incidentImpact.affectedSegments.length > 0) {
      console.log("Nouvel incident détecté sur l'itinéraire actif:", incident);
      
      // Créer une notification manuelle
      const notification = {
        type: 'incident_detected',
        incidents: [incident],
        impact: incidentImpact,
        time: new Date(),
        isSignificant: incidentImpact.totalScore < 70
      };
      
      // Calculer des alternatives
      try {
        const alternatives = await SmartNavigationService.recalculateRoutesWithAvoidance(
          routeData.startPoint.coordinates,
          routeData.endPoint.coordinates,
          routeData.options,
          [incident]
        );
        
        // Mettre à jour la notification avec les alternatives
        notification.alternativeRoute = alternatives;
        
        // Déclencher manuellement la notification
        RouteNotificationManager.notifyListeners(notification, true);
        
        console.log("Notification d'incident forcée avec alternatives calculées");
      } catch (error) {
        console.error('Erreur lors du calcul des alternatives pour le nouvel incident:', error);
      }
    }
  };

  // Charger les incidents depuis le service
  const loadIncidents = async () => {
    try {
      console.log("Chargement des incidents...");
      const allIncidents = await getAllIncidents();
      console.log("Incidents récupérés:", allIncidents);
      
      if (!Array.isArray(allIncidents)) {
        console.error("Les incidents récupérés ne sont pas un tableau:", allIncidents);
        return;
      }
      
      setIncidents(allIncidents);
      
      if (allIncidents.length > 0) {
        console.log(`Affichage de ${allIncidents.length} incidents sur la carte...`);
        allIncidents.forEach((incident, index) => {
          console.log(`Traitement de l'incident ${index + 1}/${allIncidents.length}:`, incident);
          if (incident && incident.active !== false) {
            addIncidentToMap(incident);
          } else {
            console.log(`Incident ${index + 1} ignoré car inactif:`, incident);
          }
        });
      } else {
        console.log("Aucun incident à afficher");
      }
    } catch (error) {
      console.error("Erreur lors du chargement des incidents:", error);
    }
  };
  
  const handleCloseIncidentDetails = () => {
    setShowIncidentDetails(false);
    setSelectedIncident(null);
  };

  // Prévisualiser un itinéraire alternatif
  const handlePreviewRoute = (route) => {
    if (!map.current || !mapLoaded || !route || !routeData) return;
    
    // Prévisualiser cet itinéraire sur la carte
    setPreviewRoute(route);
    
    // Dessiner l'itinéraire prévisualisé
    const routeSource = map.current.getSource('route');
    if (routeSource) {
      routeSource.setData({
        type: 'Feature',
        properties: {},
        geometry: route.geometry
      });
    }
  };

  // Sélectionner définitivement un itinéraire alternatif
  const handleSelectAlternativeRoute = (selectedRoute) => {
    if (!selectedRoute || !routeData) return;
    
    // Fermer le panneau des alternatives
    setShowAlternatives(false);
    
    // Appliquer l'itinéraire sélectionné
    const updatedRouteData = {
      ...routeData,
      routes: routeData.routes.map(route => ({
        ...route,
        // Marquer l'itinéraire sélectionné comme recommandé
        recommended: route.id === selectedRoute.id
      }))
    };
    
    setRouteData(updatedRouteData);
    
    // Dessiner le nouvel itinéraire
    drawRoute(selectedRoute, routeData.startPoint, routeData.endPoint);
    
    // Réinitialiser la surveillance avec le nouvel itinéraire
    RouteNotificationManager.init(selectedRoute, autoReroute);
    
    // Effacer la notification
    setCurrentNotification(null);
  };

  // Afficher le panneau des alternatives d'itinéraires
  const handleShowAlternatives = () => {
    setCurrentNotification(null);
    setShowAlternatives(true);
  };

  // Calculer l'itinéraire intelligent lorsque le formulaire est soumis
  const handleRouteSubmit = async (formData) => {
    try {
      setRouteLoading(true);
      setError(null);
      setCurrentNotification(null); // Effacer les notifications précédentes
      
      let startCoords, endCoords;
      
      if (formData.startPoint === 'current-location') {
        const position = await getCurrentPosition();
        startCoords = position;
      } else {
        startCoords = await geocodeAddress(formData.startPoint);
      }
      
      endCoords = await geocodeAddress(formData.endPoint);
      
      // Utiliser le service de navigation intelligent
      const routeResult = await SmartNavigationService.calculateSmartRoute(
        startCoords.coordinates,
        endCoords.coordinates,
        formData.options
      );
      
      // Enrichir les données d'itinéraire avec les points de départ/arrivée
      const enhancedRouteData = {
        ...routeResult,
        startPoint: startCoords,
        endPoint: endCoords,
        options: formData.options
      };
      
      setRouteData(enhancedRouteData);
      
      // Dessiner l'itinéraire principal (le premier)
      if (routeResult.routes && routeResult.routes.length > 0) {
        const bestRoute = routeResult.routes[0];
        drawRoute(bestRoute, startCoords, endCoords);
        
        // Stocker l'itinéraire original pour comparaison future
        setOriginalRoute(bestRoute);
        
        // Démarrer la surveillance des incidents sur l'itinéraire
        RouteNotificationManager.init(bestRoute, autoReroute);
      }
      
      setShowRouteForm(false);
      setShowInstructions(true);
      
      // Fermer autres panneaux
      setShowQRShare(false);
    } catch (err) {
      console.error("Erreur lors du calcul de l'itinéraire:", err);
      setError(err.message || "Impossible de calculer l'itinéraire");
    } finally {
      setRouteLoading(false);
    }
  };
  
  // Dessiner l'itinéraire sur la carte
  const drawRoute = (route, startPoint, endPoint) => {
    if (!map.current || !mapLoaded || !route || !route.geometry) {
      return;
    }
    
    const routeSource = map.current.getSource('route');
    if (routeSource) {
      routeSource.setData({
        type: 'Feature',
        properties: {},
        geometry: route.geometry
      });
    }
    
    if (startMarker.current) startMarker.current.remove();
    if (endMarker.current) endMarker.current.remove();
    
    startMarker.current = new mapboxgl.Marker({ color: '#33cc33' })
      .setLngLat(startPoint.coordinates)
      .setPopup(new mapboxgl.Popup().setHTML(`<strong>Départ</strong><br>${startPoint.placeName}`))
      .addTo(map.current);
    
    endMarker.current = new mapboxgl.Marker({ color: '#e74c3c' })
      .setLngLat(endPoint.coordinates)
      .setPopup(new mapboxgl.Popup().setHTML(`<strong>Arrivée</strong><br>${endPoint.placeName}`))
      .addTo(map.current);
    
    const bounds = new mapboxgl.LngLatBounds();
    route.geometry.coordinates.forEach(coord => bounds.extend(coord));
    map.current.fitBounds(bounds, { padding: 50, maxZoom: 15 });
  };
  
  // Effacer l'itinéraire actuel
  const clearRoute = () => {
    if (!map.current || !mapLoaded) return;
    
    const routeSource = map.current.getSource('route');
    if (routeSource) {
      routeSource.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: []
        }
      });
    }
    
    if (startMarker.current) {
      startMarker.current.remove();
      startMarker.current = null;
    }
    
    if (endMarker.current) {
      endMarker.current.remove();
      endMarker.current = null;
    }
    
    // Arrêter la surveillance des incidents
    RouteNotificationManager.stop();
    
    setRouteData(null);
    setShowInstructions(false);
    setShowQRShare(false);
    setCurrentNotification(null);
    setOriginalRoute(null);
    setPreviewRoute(null);
    setRouteAlternatives(null);
    setShowAlternatives(false);
  };
  
  // Recalculer l'itinéraire en cas d'incident
  const handleReroute = async (alternativeRoute) => {
    try {
      setCurrentNotification(null);
      
      if (alternativeRoute) {
        // Utiliser directement l'itinéraire alternatif proposé
        const enhancedRouteData = {
          ...alternativeRoute,
          startPoint: routeData.startPoint,
          endPoint: routeData.endPoint,
          options: routeData.options
        };
        
        setRouteData(enhancedRouteData);
        
        // Dessiner le nouvel itinéraire
        drawRoute(alternativeRoute.routes[0], routeData.startPoint, routeData.endPoint);
        
        // Réinitialiser la surveillance avec le nouvel itinéraire
        RouteNotificationManager.init(alternativeRoute.routes[0], autoReroute);
      } else {
        // Recalculer un nouvel itinéraire
        setRouteLoading(true);
        
        const newRouteData = await SmartNavigationService.recalculateRoute(
          routeData.startPoint.coordinates,
          routeData.endPoint.coordinates,
          routeData.options
        );
        
        // Enrichir les données d'itinéraire
        const enhancedRouteData = {
          ...newRouteData,
          startPoint: routeData.startPoint,
          endPoint: routeData.endPoint,
          options: routeData.options
        };
        
        setRouteData(enhancedRouteData);
        
        // Dessiner le nouvel itinéraire
        if (newRouteData.routes && newRouteData.routes.length > 0) {
          drawRoute(newRouteData.routes[0], routeData.startPoint, routeData.endPoint);
          
          // Réinitialiser la surveillance avec le nouvel itinéraire
          RouteNotificationManager.init(newRouteData.routes[0], autoReroute);
        }
        
        setRouteLoading(false);
      }
    } catch (error) {
      console.error('Erreur lors du recalcul de l\'itinéraire:', error);
      setError("Impossible de recalculer l'itinéraire");
      setRouteLoading(false);
    }
  };

  // Afficher les détails d'un incident
  const handleShowIncident = (incident) => {
    setSelectedIncident(incident);
    setShowIncidentDetails(true);
    
    // Centrer la carte sur l'incident
    const coords = getIncidentCoordinates(incident);
    if (coords && map.current) {
      map.current.flyTo({
        center: coords,
        zoom: 15,
        speed: 1.5
      });
    }
  };
  
  const handleIncidentSubmit = async (incidentData) => {
    try {
      console.log("Tentative de création d'incident avec données:", incidentData);
  
      if (!user) {
        throw new Error('Vous devez être connecté pour signaler un incident');
      }
  
      const newIncident = await addIncident({
        ...incidentData,
        reported_by: user.id
      });
  
      console.log("Incident créé avec succès:", newIncident);
  
      setIncidents(prev => {
        const newList = [...prev.filter(inc => inc.id !== newIncident.id), newIncident];
        console.log("Nouvelle liste d'incidents après ajout:", newList.length);
        return newList;
      });
  
      addIncidentToMap(newIncident);
      
      // NOUVEAU CODE: Vérifier si cet incident affecte l'itinéraire actif
      if (routeData && RouteNotificationManager) {
        // Forcer la vérification immédiate de l'itinéraire avec ce nouvel incident
        checkIncidentImpactOnRoute(newIncident);
      }
      
      setShowIncidentForm(false);
      setClickedPosition(null);
  
      return newIncident;
    } catch (error) {
      console.error('Erreur lors de la création de l\'incident:', error);
      alert(error.message || 'Impossible de créer l\'incident');
      throw error;
    }
  };
  
  // Sélectionner un incident depuis la liste
  const handleSelectIncident = (incident) => {
    console.log("Sélection d'incident:", incident);
    
    if (!incident || !incident.id) {
      console.warn('Tentative de sélection d\'un incident invalide');
      return;
    }
  
    setSelectedIncident(incident);
    setShowIncidentDetails(true);
    // Fermer autres panneaux
    setShowQRShare(false);
    
    let lng, lat;
    
    if (incident.location && Array.isArray(incident.location)) {
      [lng, lat] = incident.location;
    } else if (incident.longitude !== undefined && incident.latitude !== undefined) {
      lng = incident.longitude;
      lat = incident.latitude;
    } else if (incident.coordinates && Array.isArray(incident.coordinates)) {
      [lng, lat] = incident.coordinates;
    }
    
    if (lng !== undefined && lat !== undefined) {
      map.current.flyTo({
        center: [lng, lat],
        zoom: 14,
        speed: 1.5
      });
    }
  };
  
  const handleIncidentVote = async (incidentId, isConfirmed) => {
    try {
      console.log(`Tentative de vote sur incident ${incidentId}: ${isConfirmed ? 'confirmé' : 'infirmé'}`);
      
      if (!user) {
        alert('Vous devez être connecté pour voter');
        return null;
      }
      
      try {
        const updatedIncident = await voteIncident(incidentId, isConfirmed);
        console.log("Vote traité, réponse:", updatedIncident);
        
        const updatedIncidents = await getAllIncidents();
        setIncidents(updatedIncidents);
        
        if (selectedIncident && selectedIncident.id === incidentId) {
          const updatedSelectedIncident = updatedIncidents.find(inc => inc.id === incidentId);
          if (updatedSelectedIncident) {
            setSelectedIncident(updatedSelectedIncident);
          }
        }
        
        setRefreshTrigger(prev => prev + 1);
        
        return updatedIncident;
      } catch (error) {
        throw error;
      }
    } catch (error) {
      console.error('Erreur lors du vote:', error);
      
      let message = error.message || 'Une erreur est survenue lors du vote';
      
      if (message.includes('connecté')) {
        message = 'Vous devez être connecté pour voter sur un incident';
      } else if (message.includes('propre incident')) {
        message = 'Vous ne pouvez pas voter sur votre propre incident';
      } else if (message.includes('déjà voté')) {
        message = 'Vous avez déjà voté sur cet incident';
      }
      
      alert(message);
      return null;
    }
  };

  // Composant pour les paramètres d'itinéraire
  const RouteSettings = ({ autoReroute, onToggleAutoReroute, onClose }) => {
    return (
      <div className="route-settings">
        <div className="route-settings__header">
          <h3>Paramètres d'itinéraire</h3>
          <button className="route-settings__close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        <div className="route-settings__content">
          <div className="route-settings__option">
            <label className="route-settings__switch">
              <input
                type="checkbox"
                checked={autoReroute}
                onChange={() => onToggleAutoReroute(!autoReroute)}
              />
              <span className="route-settings__slider"></span>
            </label>
            <div className="route-settings__label">
              Recalcul automatique en cas d'incident
            </div>
          </div>
          <p className="route-settings__description">
            Si activé, l'itinéraire sera automatiquement recalculé lorsqu'un nouvel incident est détecté sur votre trajet.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="map-container">
      <div 
        ref={mapContainer} 
        className="map"
      />
      
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
              onClick={() => {
                setShowRouteForm(true);
                setShowQRShare(false); // Fermer QR code si ouvert
              }}
              title="Calculer un itinéraire"
            >
              <FaRoute size={22} />
            </button>
          )}
  
          {routeData && !showRouteForm && !showInstructions && (
            <>
              <button 
                className="control-btn instructions-btn"
                onClick={() => {
                  setShowInstructions(true);
                  setShowQRShare(false); // Fermer QR code si ouvert
                }}
                title="Voir les instructions"
              >
                <FaListUl size={22} />
              </button>
              
              {/* Bouton QR code pour partager l'itinéraire */}
              <button 
                className="control-btn qrcode-btn"
                onClick={() => {
                  setShowQRShare(true);
                  setShowInstructions(false);
                }}
                title="Partager l'itinéraire via QR code"
              >
                <FaQrcode size={22} />
              </button>
            </>
          )}
  
          {routeData && (
            <>
              {/* Bouton des paramètres d'itinéraire */}
              <button 
                className="control-btn settings-btn"
                onClick={() => setShowSettings(!showSettings)}
                title="Paramètres d'itinéraire"
              >
                <FaCog size={22} />
              </button>
              
              <button 
                className="control-btn clear-btn"
                onClick={clearRoute}
                title="Effacer l'itinéraire"
              >
                <FaTimes size={22} />
              </button>
            </>
          )}
          
          {/* Bouton de géolocalisation */}
          <button 
            className="control-btn geolocate-btn"
            onClick={async () => {
              try {
                if (!navigator.geolocation) {
                  throw new Error('La géolocalisation n\'est pas supportée par votre navigateur');
                }
                
                const position = await new Promise((resolve, reject) => {
                  navigator.geolocation.getCurrentPosition(
                    position => resolve(position),
                    error => reject(error),
                    {
                      enableHighAccuracy: true,
                      timeout: 5000,
                      maximumAge: 0
                    }
                  );
                });
                
                const { latitude, longitude } = position.coords;
                
                if (map.current) {
                  // Supprimer le marqueur précédent s'il existe
                  if (userLocationMarker.current) {
                    userLocationMarker.current.remove();
                  }
                  
                  // Créer un nouveau marqueur bleu pour la position utilisateur
                  userLocationMarker.current = new mapboxgl.Marker({
                    color: '#3AA9EE'
                  })
                    .setLngLat([longitude, latitude])
                    .setPopup(new mapboxgl.Popup().setHTML('<strong>Votre position</strong>'))
                    .addTo(map.current);
                  
                  // Centrer la carte sur la position
                  map.current.flyTo({
                    center: [longitude, latitude],
                    zoom: 14,
                    speed: 1.5
                  });
                }
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
            onClick={() => {
              setShowIncidentList(!showIncidentList);
              if (!showIncidentList) {
                setShowQRShare(false); // Fermer QR code si ouvert
              }
            }}
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
              onSubmit={handleRouteSubmit} 
              onCancel={() => setShowRouteForm(false)} 
            />
          </div>
        )}
        
        {showInstructions && routeData && (
          <div className="form-container instructions-container">
            <RouteInstructions 
              route={routeData} 
              onClose={() => setShowInstructions(false)}
              onShareQR={() => {
                setShowInstructions(false);
                setShowQRShare(true);
              }}
            />
          </div>
        )}
        
        {/* Composant QR Code pour le partage d'itinéraire */}
        {showQRShare && routeData && (
          <div className="form-container qrcode-container">
            <QRCodeShare 
              routeData={routeData} 
              onClose={() => setShowQRShare(false)} 
            />
          </div>
        )}
        
        {/* Panneau de paramètres */}
        {showSettings && (
          <div className="form-container settings-container">
            <RouteSettings 
              autoReroute={autoReroute}
              onToggleAutoReroute={(value) => {
                setAutoReroute(value);
                RouteNotificationManager.setAutoReroute(value);
              }}
              onClose={() => setShowSettings(false)}
            />
          </div>
        )}
        
        {/* Panneau des alternatives d'itinéraires */}
        {showAlternatives && routeAlternatives && routeAlternatives.routes && (
          <div className="form-container alternatives-container">
            <RouteAlternativesPanel 
              alternatives={routeAlternatives.routes}
              currentRoute={originalRoute}
              onClose={() => {
                setShowAlternatives(false);
                // Restaurer l'itinéraire original si on prévisualisait un itinéraire
                if (previewRoute && originalRoute) {
                  drawRoute(originalRoute, routeData.startPoint, routeData.endPoint);
                  setPreviewRoute(null);
                }
              }}
              onSelectRoute={handleSelectAlternativeRoute}
              onPreviewRoute={handlePreviewRoute}
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
        
        {/* Notification d'incident sur l'itinéraire */}
        {currentNotification && (
          <RouteAlert 
            notification={currentNotification}
            onClose={() => setCurrentNotification(null)}
            onReroute={handleReroute}
            onShowIncident={handleShowIncident}
            onShowAlternatives={handleShowAlternatives}
            hasAlternatives={routeAlternatives && routeAlternatives.routes && routeAlternatives.routes.length > 1}
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
      {/* Nearby Incidents Card */}
<NearbyIncidentsCard 
  userLocation={userLocationMarker.current ? userLocationMarker.current.getLngLat().toArray() : null}
  mapBounds={mapBounds}
/>
    </div>
  );
};

export default MapView;