import React, { useState, useEffect, useCallback } from 'react';
import IncidentDetails from './IncidentDetails';
import incidentService, { INCIDENT_TYPES } from '../../services/IncidentService';
import './IncidentsPanel.css';
import ReactDOM from 'react-dom';
import ThemeToggle from '../ThemeToggle'; // Chemin relatif correct vers ThemeToggle.js

const IncidentsPanel = ({ visible, onClose, refreshTrigger }) => {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);
  const selectedIncident = incidents.find(inc => inc.id === selectedIncidentId) || null;
  const [localRefreshTrigger, setLocalRefreshTrigger] = useState(0);

  const handleCloseDetails = () => setSelectedIncidentId(null);

  const fetchDetailedIncidents = useCallback(async () => {
    if (!visible) return;
    setLoading(true);
    setError(null);
    try {
      const incidentsList = await incidentService.getAllIncidents();
      if (!Array.isArray(incidentsList)) throw new Error("Format de données invalide reçu du serveur");

      const detailedIncidents = await Promise.all(
        incidentsList.map(async (incident) => {
          try {
            const detailedIncident = await incidentService.getIncidentById(incident.id);
            return detailedIncident || incident;
          } catch (err) {
            console.error(`Erreur lors de la récupération des détails de l'incident ${incident.id}:`, err);
            return incident;
          }
        })
      );

      setIncidents(detailedIncidents);
    } catch (err) {
      console.error('Erreur lors du chargement des incidents:', err);
      setError('Impossible de charger les incidents. Veuillez réessayer plus tard.');
    } finally {
      setLoading(false);
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      fetchDetailedIncidents();
      const refreshInterval = setInterval(() => {
        if (visible) fetchDetailedIncidents();
      }, 30000);
      return () => clearInterval(refreshInterval);
    }
  }, [visible, refreshTrigger, localRefreshTrigger, fetchDetailedIncidents]);

  const handleSelectIncident = useCallback((incident, event) => {
    if (selectedIncident && selectedIncident.id === incident.id) return;
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    setSelectedIncidentId(incident.id);
  }, [selectedIncident]);

  const handleVote = async (incidentId, isConfirmed, event) => {
    if (event) event.stopPropagation();
    try {
      await incidentService.voteIncident(incidentId, isConfirmed);
      const updatedIncident = await incidentService.getIncidentById(incidentId);
      setIncidents(prev =>
        prev.map(inc => (inc.id === incidentId ? { ...inc, ...updatedIncident } : inc))
      );
      setLocalRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error('Erreur lors du vote:', err);
      const message = err.message || 'Erreur lors du vote';
      if (message.includes('déjà voté')) alert('Vous avez déjà voté sur cet incident');
      else if (message.includes('propre incident')) alert('Vous ne pouvez pas voter sur votre propre incident');
      else alert(`Erreur: ${message}`);
    }
  };

  const formatRelativeDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMins = Math.floor((now - date) / (1000 * 60));
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffMins < 1440) return `Il y a ${Math.floor(diffMins / 60)} h`;
    return `Il y a ${Math.floor(diffMins / 1440)} j`;
  };

  const getIncidentTypeInfo = (type) => {
    const upper = type?.toUpperCase();
    return INCIDENT_TYPES[upper] || { label: type, icon: '/icons/unknown.png', color: '#999' };
  };

  const calculateReliability = (incident) => {
    return incidentService.calculateReliability(incident);
  };

  return (
    <>

      <div className={`incidents-overlay ${visible ? 'active' : ''}`} onClick={onClose}></div>
      <div className={`incidents-panel ${visible ? 'active' : ''}`}>
        <button className="panel-close-btn" onClick={onClose}>×</button>

        {loading && incidents.length === 0 ? (
          <div className="incidents-loading">
            <div className="spinner"></div>
            <p>Chargement des incidents...</p>
          </div>
        ) : error ? (
          <div className="incidents-error">
            <span className="error-icon">⚠️</span>
            <p>{error}</p>
            <button onClick={fetchDetailedIncidents}>Réessayer</button>
          </div>
        ) : (
          <div className="incident-list-container">
             <ThemeToggle /> 
            <div className="incident-list">
              {incidents.length === 0 ? (
                <div className="no-incidents">
                  <p>Aucun incident signalé pour le moment</p>
                </div>
              ) : (
                incidents.filter(incident => incident.active !== false)
                  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                  .map(incident => {
                    const typeInfo = getIncidentTypeInfo(incident.type);
                    const reliability = calculateReliability(incident);

                    return (
                      <div key={incident.id} className="incident-item" onClick={(e) => handleSelectIncident(incident, e)}>
                        <div className="incident-item-icon incident-icon-wrapper" style={{ boxShadow: `0 0 10px ${typeInfo.color}`, border: `3px solid ${typeInfo.color}` }}>
                          <img src={typeInfo.icon} alt={typeInfo.label} className="incident-icon-only" />
                        </div>
                        <div className="incident-item-content">
                          <div className="incident-item-header">
                            <div className="incident-item-type">{typeInfo.label}</div>
                            <div className="incident-item-time">{formatRelativeDate(incident.created_at)}</div>
                          </div>
                          <div className="incident-item-description">
                            {incident.description || "Pas de description"}
                          </div>
                          <div className="incident-reliability">
                            <div className="reliability-bar">
                              <div className="reliability-value" style={{ width: `${reliability}%`, backgroundColor: reliability > 50 ? '#33CC66' : '#FF453A' }}></div>
                            </div>
                            <div className="reliability-label">
                              <span>Fiabilité: {reliability}%</span>
                            </div>
                          </div>
                          <div className="incident-item-votes">
                            <div className="vote-count up">
                              <span className="vote-icon">👍</span>
                              <span>{incident.votes?.up || 0}</span>
                            </div>
                            <div className="vote-count down">
                              <span className="vote-icon">👎</span>
                              <span>{incident.votes?.down || 0}</span>
                            </div>
                            <div className="vote-buttons">
                              <button className="vote-button confirm" onClick={(e) => handleVote(incident.id, true, e)}>Confirmer</button>
                              <button className="vote-button reject" onClick={(e) => handleVote(incident.id, false, e)}>Infirmer</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        )}
      </div>

      {selectedIncident && ReactDOM.createPortal(
        <IncidentDetails 
          incident={selectedIncident}
          onClose={handleCloseDetails}
          onVote={(incidentId, isConfirmed) => handleVote(incidentId, isConfirmed)}
          onRefresh={fetchDetailedIncidents}
        />,
        document.body
      )}
    </>
  );
};

export default IncidentsPanel;
