// NearbyIncidentsCard.jsx
import React, { useEffect, useState } from 'react';
import { FaBell, FaExclamationTriangle, FaArrowRight } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import './NearbyIncidentsCard.css';

const NearbyIncidentsCard = ({ userLocation, mapBounds }) => {
  const [nearbyIncidents, setNearbyIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchNearbyIncidents = async () => {
      if (!userLocation && !mapBounds) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        let url = '';
        
        if (mapBounds) {
          url = `${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/incidents/area?lat1=${mapBounds.lat1}&lon1=${mapBounds.lon1}&lat2=${mapBounds.lat2}&lon2=${mapBounds.lon2}`;
        } 
        else if (userLocation) {
          const lat = userLocation[1];
          const lng = userLocation[0];
          const latDelta = 0.045; // Roughly 5km
          const lngDelta = 0.045 / Math.cos(lat * Math.PI / 180);
          
          url = `${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/incidents/area?lat1=${lat - latDelta}&lon1=${lng - lngDelta}&lat2=${lat + latDelta}&lon2=${lng + lngDelta}`;
        }

        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error('Failed to fetch nearby incidents');
        }
        
        const data = await response.json();
        
        if (data.success && data.incidents) {
          // Sort incidents by created_at (most recent first)
          const sortedIncidents = data.incidents.sort((a, b) => {
            return new Date(b.created_at) - new Date(a.created_at);
          });
          
          // Take only the 5 most recent
          setNearbyIncidents(sortedIncidents.slice(0, 5));
        } else {
          setNearbyIncidents([]);
        }
      } catch (err) {
        console.error('Error fetching nearby incidents:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchNearbyIncidents();

    // Set up interval to refresh data every 60 seconds
    const interval = setInterval(fetchNearbyIncidents, 60000);
    
    return () => clearInterval(interval);
  }, [userLocation, mapBounds]);

  // Function to format date relative to now (e.g., "2 minutes ago")
  const formatRelativeTime = (dateString) => {
    const now = new Date();
    const incidentDate = new Date(dateString);
    const diffMs = now - incidentDate;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Il y a ${diffHours} heures`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `Il y a ${diffDays} jours`;
  };

  // Get incident type name
  const getIncidentTypeName = (type) => {
    const types = {
      'ACCIDENT': 'Accident',
      'TRAFFIC_JAM': 'Embouteillage',
      'ROAD_CLOSED': 'Route fermée',
      'CONSTRUCTION': 'Travaux',
      'HAZARD': 'Danger',
      'POLICE': 'Police',
      'WEATHER': 'Météo',
      'FOG': 'Brouillard',
      'ICE': 'Verglas',
      'FLOOD': 'Inondation'
    };
    
    return types[type] || type;
  };

  const handleLearnMoreClick = () => {
    navigate('/dashboard?section=recap');
  };

  // Get incidents count by type
  const getTypeCount = () => {
    const counts = {};
    nearbyIncidents.forEach(incident => {
      counts[incident.type] = (counts[incident.type] || 0) + 1;
    });
    return counts;
  };

  // Get most common incident type
  const getMostCommonType = () => {
    const counts = getTypeCount();
    let maxType = '';
    let maxCount = 0;
    
    Object.keys(counts).forEach(type => {
      if (counts[type] > maxCount) {
        maxCount = counts[type];
        maxType = type;
      }
    });
    
    return maxType;
  };

  return (
    <div className="nearby-incidents-card">
      <div className="card-header">
        <FaBell size={18} />
        <h3>Incidents à proximité</h3>
      </div>
      
      <div className="card-content">
        {loading ? (
          <div className="loading">Chargement des incidents...</div>
        ) : error ? (
          <div className="error">Erreur: {error}</div>
        ) : nearbyIncidents.length === 0 ? (
          <div className="no-incidents">
            <p>Aucun incident signalé à proximité</p>
            <span className="safe-area">Zone sécurisée</span>
          </div>
        ) : (
          <>
            <div className="incidents-summary">
              <div className="incident-count">
                <span className="count">{nearbyIncidents.length}</span>
                <span className="label">incidents signalés</span>
              </div>
              {getMostCommonType() && (
                <div className="common-type">
                  <span className="type-name">{getIncidentTypeName(getMostCommonType())}</span>
                  <span className="label">le plus fréquent</span>
                </div>
              )}
            </div>
            
            <ul className="incidents-list">
              {nearbyIncidents.map(incident => (
                <li key={incident.id} className={`incident-item ${incident.type.toLowerCase()}`}>
                  <div className="incident-icon">
                    <FaExclamationTriangle />
                  </div>
                  <div className="incident-details">
                    <div className="incident-type">{getIncidentTypeName(incident.type)}</div>
                    <div className="incident-time">{formatRelativeTime(incident.created_at)}</div>
                  </div>
                </li>
              ))}
            </ul>
            
            <button className="learn-more-btn" onClick={handleLearnMoreClick}>
              En savoir plus
              <FaArrowRight size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default NearbyIncidentsCard;