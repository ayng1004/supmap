import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socket } from '../services/socketService';
import { calculateRoute, addRouteToMap, updateNavigationInstructions, notifyUser } from '../services/routeService';
import { usePosition } from '../hooks/usePosition';

const Navigation = () => {
  const [isNavigating, setIsNavigating] = useState(false);
  const [destination, setDestination] = useState(null);
  const [avoidTollsEnabled, setAvoidTollsEnabled] = useState(false);
  const { currentPosition } = usePosition();
  const mapRef = useRef(null);
  
  useEffect(() => {
    // Initialisation de la navigation
    // ...
    
    // Écouter les événements de recalcul d'itinéraire
    socket.on('route:recalculate', async (data) => {
      if (isNavigating && data.affectsCurrentRoute) {
        const newRoute = await calculateRoute(
          currentPosition,
          destination,
          { avoidTolls: avoidTollsEnabled }
        );
        
        addRouteToMap(mapRef.current, newRoute.routes[0]);
        updateNavigationInstructions(newRoute.routes[0]);
        
        // Notification à l'utilisateur
        notifyUser('Itinéraire recalculé en raison d\'un incident');
      }
    });
    
    // Nettoyage lors du démontage du composant
    return () => {
      socket.off('route:recalculate');
    };
  }, [isNavigating, currentPosition, destination, avoidTollsEnabled]);
  
  // Reste du composant...
  
  return (
    <div className="navigation-container">
      {/* Interface de navigation */}
    </div>
  );
};

export default Navigation;