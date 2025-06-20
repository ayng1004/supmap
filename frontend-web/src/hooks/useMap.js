import { useState, useContext, createContext } from 'react';

// Créer un contexte pour la carte
const MapContext = createContext(null);

// Hook de gestion de la carte
export const useMapProvider = () => {
  const [mapState, setMapState] = useState({
    lng: 2.3488, // Paris longitude par défaut
    lat: 48.8534, // Paris latitude par défaut
    zoom: 9,
    loaded: false
  });

  const [incidents, setIncidents] = useState([]);
  const [showTraffic, setShowTraffic] = useState(true);

  // Fonction pour mettre à jour le centre de la carte
  const setMapCenter = ([lng, lat]) => {
    setMapState(prevState => ({
      ...prevState,
      lng,
      lat
    }));
  };

  // Fonction pour mettre à jour le niveau de zoom
  const setZoom = (zoom) => {
    setMapState(prevState => ({
      ...prevState,
      zoom
    }));
  };

  // Fonction pour ajouter un incident
  const addIncident = (incident) => {
    setIncidents(prevIncidents => [...prevIncidents, incident]);
  };

  // Fonction pour supprimer un incident
  const removeIncident = (incidentId) => {
    setIncidents(prevIncidents => 
      prevIncidents.filter(incident => incident.id !== incidentId)
    );
  };

  // Fonction pour confirmer/infirmer un incident
  const updateIncidentVotes = (incidentId, vote) => {
    setIncidents(prevIncidents => 
      prevIncidents.map(incident => 
        incident.id === incidentId
          ? { 
              ...incident, 
              votes: {
                ...incident.votes,
                [vote]: incident.votes[vote] + 1
              }
            }
          : incident
      )
    );
  };

  // Fonction pour activer/désactiver la couche de trafic
  const toggleTrafficLayer = () => {
    setShowTraffic(prevState => !prevState);
  };

  return {
    mapState,
    incidents,
    showTraffic,
    setMapCenter,
    setZoom,
    addIncident,
    removeIncident,
    updateIncidentVotes,
    toggleTrafficLayer
  };
};

// Hook pour utiliser le contexte de la carte
export const useMap = () => {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error('useMap must be used within a MapProvider');
  }
  return context;
};

// Provider pour le contexte de la carte
export const MapProvider = ({ children }) => {
  const mapContext = useMapProvider();
  
  return (
    <MapContext.Provider value={mapContext}>
      {children}
    </MapContext.Provider>
  );
};

export default useMap;