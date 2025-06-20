import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Ne pas mettre votre clé Mapbox ici dans le code source final
// Utilisez plutôt un fichier .env
// mapboxgl.accessToken = 'VOTRE_CLE_MAPBOX';

const Map = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng, setLng] = useState(2.3488); // Paris longitude par défaut
  const [lat, setLat] = useState(48.8534); // Paris latitude par défaut
  const [zoom, setZoom] = useState(9);

  useEffect(() => {
    if (map.current) return; // La carte est déjà initialisée
    
    // Récupération de la clé Mapbox depuis les variables d'environnement
    mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v11', // Utilisation d'un style standard de Mapbox
      center: [lng, lat],
      zoom: zoom
    });

    // Ajouter des contrôles de navigation
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('move', () => {
      setLng(map.current.getCenter().lng.toFixed(4));
      setLat(map.current.getCenter().lat.toFixed(4));
      setZoom(map.current.getZoom().toFixed(2));
    });

    return () => map.current.remove();
  }, []);

  return (
    <div>
      <div className="map-info">
        Longitude: {lng} | Latitude: {lat} | Zoom: {zoom}
      </div>
      <div ref={mapContainer} className="map-container" style={{ height: "600px" }} />
    </div>
  );
};

export default Map;