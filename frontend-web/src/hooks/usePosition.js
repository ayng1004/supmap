import { useState, useEffect } from 'react';

export const usePosition = () => {
  const [currentPosition, setCurrentPosition] = useState(null);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const geo = navigator.geolocation;
    
    if (!geo) {
      setError('La géolocalisation n\'est pas supportée par votre navigateur');
      return;
    }
    
    // Suivre la position en temps réel
    const watcher = geo.watchPosition(
      (position) => {
        setCurrentPosition([
          position.coords.longitude,
          position.coords.latitude
        ]);
        setError(null);
      },
      (err) => {
        setError(err.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000
      }
    );
    
    // Nettoyage
    return () => geo.clearWatch(watcher);
  }, []);
  
  return { currentPosition, error };
};