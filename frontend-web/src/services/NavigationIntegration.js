// NavigationIntegration.js
// Module d'intégration de l'API de navigation dans le frontend web
// Ce fichier sert de pont entre l'API et l'interface utilisateur

import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify'; // Pour les notifications dans le navigateur
import NavigationAPI from './NavigationAPI';

// Composant de navigation dynamique qui peut être intégré dans MapView
const DynamicNavigationProvider = ({ 
  map, 
  mapLoaded,
  onRouteChange,
  onIncidentDetected,
  onAlternativeRoutesCalculated,
  children 
}) => {
  const [currentRoute, setCurrentRoute] = useState(null);
  const [alternativeRoutes, setAlternativeRoutes] = useState([]);
  const [routeMonitor, setRouteMonitor] = useState(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  
  // Référence à la fonction d'arrêt de la surveillance
  const stopMonitoringRef = useRef(null);
  
  // Fonction pour calculer un itinéraire
  const calculateRoute = async (startPoint, endPoint, options = {}) => {
    try {
      // Enregistrer les points de départ et d'arrivée
      setOrigin(startPoint);
      setDestination(endPoint);
      
      // Calculer l'itinéraire
      const routes = await NavigationAPI.calculateRoute(startPoint, endPoint, options);
      
      if (!routes || routes.length === 0) {
        throw new Error('Aucun itinéraire trouvé');
      }
      
      // Vérifier les incidents sur l'itinéraire principal
      const checkedRoute = await NavigationAPI.checkRouteForIncidents(routes[0]);
      
      // Mettre à jour l'état
      setCurrentRoute(checkedRoute.route);
      
      // Si des incidents sont détectés qui nécessitent un reroutage, calculer des alternatives
      if (checkedRoute.requiresRerouting) {
        const alternatives = await NavigationAPI.calculateAlternativeRoutes(
          startPoint,
          endPoint,
          checkedRoute.route,
          checkedRoute.incidents,
          options
        );
        
        setAlternativeRoutes(alternatives);
        
        // Notifier le composant parent des alternatives
        if (onAlternativeRoutesCalculated) {
          onAlternativeRoutesCalculated(alternatives, checkedRoute.incidents);
        }
      }
      
      // Notifier le composant parent du changement d'itinéraire
      if (onRouteChange) {
        onRouteChange(checkedRoute.route);
      }
      
      // Démarrer la surveillance de l'itinéraire si ce n'est pas déjà fait
      startRouteMonitoring(checkedRoute.route, startPoint, endPoint, options);
      
      return checkedRoute.route;
    } catch (error) {
      console.error('Erreur lors du calcul de l\'itinéraire:', error);
      toast.error('Impossible de calculer l\'itinéraire.');
      throw error;
    }
  };
  
  // Fonction pour démarrer la surveillance d'un itinéraire
  const startRouteMonitoring = (route, startPoint, endPoint, options = {}) => {
    // Arrêter la surveillance précédente si elle existe
    if (stopMonitoringRef.current) {
      stopMonitoringRef.current();
      stopMonitoringRef.current = null;
    }
    
    if (!route) return;
    
    // Configurer le callback pour les incidents détectés
    const handleIncidentDetected = (newIncidents, updatedRoute, alternativeRoutes) => {
      console.log(`${newIncidents.length} nouveaux incidents détectés, mise à jour de l'itinéraire`);
      
      // Mettre à jour l'itinéraire actuel
      setCurrentRoute(updatedRoute);
      
      // Mettre à jour les alternatives si elles existent
      if (alternativeRoutes && alternativeRoutes.length > 0) {
        setAlternativeRoutes(alternativeRoutes);
        
        // Notifier le composant parent des alternatives
        if (onAlternativeRoutesCalculated) {
          onAlternativeRoutesCalculated(alternativeRoutes, newIncidents);
        }
      }
      
      // Générer des notifications pour chaque nouvel incident
      newIncidents.forEach(incident => {
        const notification = NavigationAPI.prepareIncidentNotification(incident, updatedRoute);
        
        // Afficher une notification sur le web
        toast.warning(
          <div>
            <strong>{notification.title}</strong>
            <p>{notification.body}</p>
          </div>,
          {
            autoClose: 10000,
            closeOnClick: true,
            draggable: true
          }
        );
      });
      
      // Notifier le composant parent des incidents détectés
      if (onIncidentDetected) {
        onIncidentDetected(newIncidents, updatedRoute, alternativeRoutes);
      }
    };
    
    // Démarrer la surveillance
    const stopMonitoring = NavigationAPI.monitorRoute(
      route,
      handleIncidentDetected,
      {
        interval: 30000, // Vérifier toutes les 30 secondes
        origin: startPoint,
        destination: endPoint,
        ...options
      }
    );
    
    // Stocker la fonction d'arrêt pour pouvoir l'appeler plus tard
    stopMonitoringRef.current = stopMonitoring;
    setIsMonitoring(true);
    
    return stopMonitoring;
  };
  
  // Fonction pour arrêter la surveillance
  const stopRouteMonitoring = () => {
    if (stopMonitoringRef.current) {
      stopMonitoringRef.current();
      stopMonitoringRef.current = null;
      setIsMonitoring(false);
      console.log('Surveillance de l\'itinéraire arrêtée');
    }
  };
  
  // Fonction pour changer d'itinéraire
  const selectRoute = async (route) => {
    if (!route) return;
    
    // Vérifier les incidents sur le nouvel itinéraire
    const checkedRoute = await NavigationAPI.checkRouteForIncidents(route);
    
    // Mettre à jour l'état
    setCurrentRoute(checkedRoute.route);
    
    // Notifier le composant parent du changement d'itinéraire
    if (onRouteChange) {
      onRouteChange(checkedRoute.route);
    }
    
    // Redémarrer la surveillance avec le nouvel itinéraire
    startRouteMonitoring(checkedRoute.route, origin, destination);
    
    return checkedRoute.route;
  };
  
  // Nettoyer les ressources lors du démontage du composant
  useEffect(() => {
    return () => {
      if (stopMonitoringRef.current) {
        stopMonitoringRef.current();
      }
    };
  }, []);
  
  // Fournir le contexte de navigation aux composants enfants
  const navigationContext = {
    currentRoute,
    alternativeRoutes,
    isMonitoring,
    calculateRoute,
    selectRoute,
    startRouteMonitoring,
    stopRouteMonitoring
  };
  
  return (
    <div className="dynamic-navigation-provider">
      {/* Rendre les enfants avec le contexte */}
      {children(navigationContext)}
    </div>
  );
};

// Composant pour afficher une prévisualisation des alternatives
const RouteAlternativesPreview = ({ 
  originalRoute,
  alternativeRoutes,
  onRouteSelected 
}) => {
  const [comparedRoutes, setComparedRoutes] = useState([]);
  
  // Comparer les itinéraires lorsqu'ils changent
  useEffect(() => {
    if (originalRoute && alternativeRoutes) {
      const compared = NavigationAPI.compareRoutes(originalRoute, alternativeRoutes);
      setComparedRoutes(compared);
    } else {
      setComparedRoutes([]);
    }
  }, [originalRoute, alternativeRoutes]);
  
  if (!comparedRoutes || comparedRoutes.length === 0) {
    return null;
  }
  
  return (
    <div className="route-alternatives-preview">
      <h3>Itinéraires alternatifs</h3>
      <p>Un ou plusieurs incidents ont été détectés sur votre route. Voici des alternatives:</p>
      
      <div className="routes-list">
        {comparedRoutes.map((routeInfo, index) => (
          <div 
            key={routeInfo.route.id} 
            className={`route-item ${routeInfo.comparison.isRecommended ? 'recommended' : ''}`}
            onClick={() => onRouteSelected(routeInfo.route)}
          >
            <div className="route-name">
              {routeInfo.comparison.isRecommended && <span className="badge">Recommandé</span>}
              Itinéraire {index + 1}
            </div>
            <div className="route-stats">
              <div className="time-difference">
                {routeInfo.comparison.timeDifferenceText}
              </div>
              <div className="distance-difference">
                {routeInfo.comparison.distanceDifferenceText}
              </div>
            </div>
            <div className="incident-count">
              {routeInfo.comparison.incidentCount} incident(s) sur cette route
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Composant pour afficher les incidents sur un itinéraire
const RouteIncidentsOverview = ({ route }) => {
  if (!route || !route.incidents || route.incidents.length === 0) {
    return null;
  }
  
  // Trier les incidents par distance le long de l'itinéraire
  const sortedIncidents = [...route.incidents].sort((a, b) => {
    return a.distanceAlongRoute - b.distanceAlongRoute;
  });
  
  return (
    <div className="route-incidents-overview">
      <h4>Incidents sur votre route</h4>
      <ul className="incidents-list">
        {sortedIncidents.map(incident => {
          const typeInfo = NavigationAPI.INCIDENT_TYPES[incident.type?.toUpperCase()] || 
                          NavigationAPI.INCIDENT_TYPES.HAZARD;
          
          return (
            <li key={incident.id} className={`incident-item severity-${typeInfo.severity}`}>
              <div className="incident-type">{typeInfo.message}</div>
              <div className="incident-time">
                Dans environ {Math.round(incident.timeToIncident / 60)} minutes
              </div>
              {incident.description && (
                <div className="incident-description">{incident.description}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export { 
  DynamicNavigationProvider,
  RouteAlternativesPreview,
  RouteIncidentsOverview
};