import { useState, useEffect } from 'react';
import { routeService } from '../services/routeService';

export const useRoutes = () => {
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [activeRoute, setActiveRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [preferences, setPreferences] = useState({
    avoidTolls: false,
    mode: 'driving', // driving, walking, cycling
    alternative: true // demander des itinéraires alternatifs
  });

  // Fonction pour calculer un itinéraire
  const calculateRoute = async (start, end, prefs = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      // Mettre à jour les points de départ et d'arrivée
      if (start) setOrigin(start);
      if (end) setDestination(end);
      
      // Combiner les préférences par défaut avec celles fournies
      const routePreferences = { ...preferences, ...prefs };
      
      // Vérifier que les points de départ et d'arrivée sont définis
      const startCoords = start || origin;
      const endCoords = end || destination;
      
      if (!startCoords || !endCoords) {
        throw new Error('Les points de départ et d\'arrivée sont requis');
      }
      
      // Appeler le service d'itinéraire
      const response = await routeService.getRoutes(
        startCoords,
        endCoords,
        routePreferences
      );
      
      // Mettre à jour les itinéraires
      setRoutes(response.routes);
      
      // Définir l'itinéraire actif (par défaut, le premier)
      if (response.routes.length > 0 && !activeRoute) {
        setActiveRoute(response.routes[0]);
      }
      
      return response.routes;
    } catch (err) {
      setError(err.message || 'Erreur lors du calcul de l\'itinéraire');
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour mettre à jour les préférences d'itinéraire
  const updatePreferences = (newPrefs) => {
    setPreferences(prev => ({
      ...prev,
      ...newPrefs
    }));
  };

  // Recalculer l'itinéraire lorsque les préférences changent
  useEffect(() => {
    if (origin && destination) {
      calculateRoute(origin, destination, preferences);
    }
  }, [preferences]);

  return {
    origin,
    destination,
    routes,
    activeRoute,
    loading,
    error,
    preferences,
    setOrigin,
    setDestination,
    setActiveRoute,
    calculateRoute,
    updatePreferences
  };
};

export default useRoutes;