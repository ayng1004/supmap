import React, { useMemo } from 'react';
import { INCIDENT_TYPES } from '../../services/IncidentService';
import './IncidentList.css';

const IncidentList = ({ incidents = [], onSelectIncident, onVote }) => {
  // Fonction pour obtenir les informations du type d'incident
  const getIncidentTypeInfo = (typeId) => {
    // Parcourir les types d'incidents pour trouver celui qui correspond
    for (const key in INCIDENT_TYPES) {
      if (INCIDENT_TYPES[key].id === typeId) {
        return INCIDENT_TYPES[key];
      }
    }
    // Type par défaut si non trouvé
    return INCIDENT_TYPES.HAZARD;
  };

  // Fonction pour calculer le taux de fiabilité
  const calculateReliability = (incident) => {
    // S'assurer que l'incident et ses votes existent
    if (!incident || !incident.votes) {
      return 50; // Valeur par défaut
    }
    
    const up = incident.votes.up || 0;
    const down = incident.votes.down || 0;
    const total = up + down;
    
    if (total === 0) return 50; // Aucun vote
    
    return Math.round((up / total) * 100);
  };

  // Fonction pour formater la durée écoulée depuis la date de l'incident
  const getTimeAgo = (dateString) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);
      
      if (diffMins < 1) return 'À l\'instant';
      if (diffMins < 60) return `${diffMins} min`;
      if (diffHours < 24) return `${diffHours} h`;
      return `${diffDays} j`;
    } catch (e) {
      return '';
    }
  };
  
  // Fonction de vérification des incidents
  const isValidIncident = (incident) => {
    return incident 
      && typeof incident === 'object' 
      && incident.id !== undefined;
  };

  // Mémoriser les incidents valides pour éviter des re-rendus inutiles
  const validIncidents = useMemo(() => {
    // Créer un ensemble d'IDs uniques
    const uniqueIds = new Set();
    return incidents
      .filter(incident => {
        // Vérifier la validité et l'unicité de l'incident
        if (!isValidIncident(incident)) return false;
        
        // Si l'ID est déjà vu, ignorer cet incident
        if (uniqueIds.has(incident.id)) return false;
        
        // Ajouter l'ID à l'ensemble des IDs uniques
        uniqueIds.add(incident.id);
        
        return true;
      });
  }, [incidents]);

  // Afficher un message si aucun incident
  if (validIncidents.length === 0) {
    return (
      <div className="incidents-container">
        <div className="incidents-header">
          <h2>Incidents signalés</h2>
          <span className="incidents-count">0 incident</span>
        </div>
        <div className="no-incidents">
          <span className="no-incidents-icon">📋</span>
          <p>Aucun incident signalé.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="incidents-container">
      <div className="incidents-header">
        <h2>Incidents signalés</h2>
        <span className="incidents-count">{validIncidents.length} incident{validIncidents.length > 1 ? 's' : ''}</span>
      </div>
      
      <div className="incidents-list">
        {validIncidents.map((incident) => {
          // S'assurer que les votes existent
          const votes = incident.votes || { up: 0, down: 0 };
          const typeInfo = getIncidentTypeInfo(incident.type);
          const reliability = calculateReliability(incident);
          const timeAgo = getTimeAgo(incident.created_at || incident.createdAt);
          
          return (
            <div 
              key={`unique-incident-${incident.id}`} 
              className="incident-card"
            >
              <div 
                className="incident-type-indicator" 
                style={{ backgroundColor: typeInfo.color }}
              ></div>
              
              <div 
                className="incident-card-content" 
                onClick={() => onSelectIncident && onSelectIncident(incident)}
              >
                <div className="incident-header">
                  <div className="incident-type">
                    <span className="incident-icon">{typeInfo.icon}</span>
                    <span className="incident-type-name">{typeInfo.label}</span>
                  </div>
                  
                  <div className="incident-time">
                    {timeAgo}
                  </div>
                </div>
                
                <div className="incident-body">
                  <p className="incident-description">
                    {incident.description || 'Pas de description'}
                  </p>
                </div>
                
                <div className="incident-footer">
                  <div className="incident-reliability">
                    <div className="reliability-bar">
                      <div 
                        className="reliability-value" 
                        style={{ 
                          width: `${reliability}%`, 
                          backgroundColor: reliability > 50 ? '#33CC66' : '#FF453A' // Couleurs Waze
                        }}
                      ></div>
                    </div>
                    <span className="reliability-percent">{reliability}% fiable</span>
                  </div>
                  
                  <div className="incident-votes">
                    <span className="vote up">👍 {votes.up || 0}</span>
                    <span className="vote down">👎 {votes.down || 0}</span>
                  </div>
                </div>
              </div>
              
              <div className="incident-actions">
                <button 
                  className="incident-action-btn view"
                  onClick={() => onSelectIncident && onSelectIncident(incident)}
                >
                  Détails
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default IncidentList;