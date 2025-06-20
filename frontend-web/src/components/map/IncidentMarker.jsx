import React from 'react';
import { INCIDENT_TYPES } from '../../services/IncidentService';
import './IncidentMarker.css';

/**
 * Composant pour afficher un marqueur d'incident sur la carte
 */
const IncidentMarker = ({ incident, onClick }) => {
  // Récupérer les informations du type d'incident
  const incidentInfo = INCIDENT_TYPES[incident.type.toUpperCase()] || INCIDENT_TYPES.HAZARD;
  
  // Calculer le temps écoulé depuis la création de l'incident
  const getTimeElapsed = () => {
    const now = new Date();
    const createdAt = new Date(incident.createdAt);
    const diffMs = now - createdAt;
    
    // Convertir en minutes
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 60) {
      return `${diffMinutes} min`;
    } else {
      const hours = Math.floor(diffMinutes / 60);
      if (hours < 24) {
        return `${hours} h`;
      } else {
        const days = Math.floor(hours / 24);
        return `${days} j`;
      }
    }
  };
  
  return (
    <div 
      className={`incident-marker type-${incident.type}`}
      style={{ backgroundColor: incidentInfo.color }}
      onClick={() => onClick && onClick(incident)}
    >
      <div className="incident-icon">{incidentInfo.icon}</div>
      <div className="incident-time">{getTimeElapsed()}</div>
      {incident.votes && (
        <div className="incident-votes">
          <span className="vote-up">+{incident.votes.up}</span>
          <span className="vote-down">-{incident.votes.down}</span>
        </div>
      )}
    </div>
  );
};

export default IncidentMarker;