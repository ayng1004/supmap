// StatsPage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './StatsPage.css';
import { FaExclamationTriangle, FaThumbsUp, FaMapMarkedAlt } from 'react-icons/fa';

const StatsPage = ({ stats = { incidents: 0, votes: 0, badges: [] }, userId }) => {
  const [incidentTypes, setIncidentTypes] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [incidentCount, setIncidentCount] = useState(0);
  const [voteCount, setVoteCount] = useState(0);
  const earnedIncidentBadges = ["10+ incidents", "20+ incidents", "30+ incidents"].filter(label => {
    const num = parseInt(label);
    return incidentCount >= num;
  });
  
  const earnedVoteBadges = ["10+ votes", "20+ votes", "30+ votes"].filter(label => {
    const num = parseInt(label);
    return voteCount >= num;
  });
  useEffect(() => {
    const fetchAdditionalStats = async () => {
      if (!userId) return;
  
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
  
        const incidentsResponse = await axios.get(`http://localhost:3001/api/incidents`, {
          headers: { Authorization: `Bearer ${token}` }
        });
  
        const votesResponse = await axios.get(`http://localhost:3001/api/incidents/votes/count/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
  
        if (votesResponse.data?.count !== undefined) {
          setVoteCount(votesResponse.data.count);
        }
  
        if (incidentsResponse.data?.incidents) {
          const allIncidents = incidentsResponse.data.incidents;
  
          // 🔥 Filtrer uniquement les incidents signalés par cet utilisateur
          const myIncidents = allIncidents.filter(
            (incident) => incident.reporter?.id === userId
          );
  
          // Répartition des types
          const types = {};
          myIncidents.forEach((incident) => {
            types[incident.type] = (types[incident.type] || 0) + 1;
          });
  
          const typesArray = Object.entries(types).map(([type, count]) => ({
            name: type,
            value: count,
            color: getColorForType(type),
          }));
  
          setIncidentCount(myIncidents.length);
          setIncidentTypes(typesArray);
  
          // Activité récente
          const sorted = [...myIncidents]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 5);
  
          setRecentActivity(sorted);
        }
      } catch (error) {
        console.error('Erreur lors de la récupération des statistiques détaillées:', error);
      } finally {
        setLoading(false);
      }
    };
  
    fetchAdditionalStats();
  }, [userId]);
  
  
  // Fonction pour obtenir une couleur selon le type d'incident
  const getColorForType = (type) => {
    const typeColors = {
     'accident': '#FF3B30',
      'traffic': '#FF9500', 
      'closure': '#34C759',
      'police': '#007AFF',
      'hazard': '#8E8E93'
    };
    
    return typeColors[type.toLowerCase()] || '#555555';
  };
  
  // Calculer la valeur max pour les barres
  const maxValue = incidentTypes.length > 0 
    ? Math.max(...incidentTypes.map(item => item.value))
    : 1;

  return (
    <div className="stats-content">
      <div className="stats-summary">
        <div className="stat-card">
          <h3>Incidents signalés</h3>
          <div className="stat-value">{stats.incidents}</div>
        </div>
        
        <div className="stat-card">
          <h3>Votes soumis</h3>
          <div className="stat-value">{stats.votes}</div>
        </div>
        
        <div className="stat-card">
          <h3>Badges obtenus</h3>
          <div className="stat-value">{stats.badges.length}</div>
        </div>
      </div>
      
      <div className="stats-row">
        <div className="stats-card">
          <h3>Répartition des types d'incidents</h3>
          {loading ? (
            <div className="loading-indicator">Chargement...</div>
          ) : incidentTypes.length > 0 ? (
            <div className="simple-chart">
              {incidentTypes.map((type, index) => (
                <div key={index} className="chart-item">
                  <div className="chart-label">
                    <span className="color-dot" style={{ backgroundColor: type.color }}></span>
                    <span>{type.name}: {type.value}</span>
                  </div>
                  <div className="chart-bar-container">
                    <div 
                      className="chart-bar" 
                      style={{ 
                        width: `${(type.value / maxValue) * 100}%`,
                        backgroundColor: type.color 
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-data">Vous n'avez pas encore signalé d'incidents.</p>
          )}
        </div>
        
        <div className="stats-card">
          <h3>Derniers incidents signalés</h3>
          {loading ? (
            <div className="loading-indicator">Chargement...</div>
          ) : recentActivity.length > 0 ? (
            <div className="recent-activity">
              <table className="activity-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivity.map((incident, index) => (
                    <tr key={index}>
                      <td>{incident.type}</td>
                      <td>{new Date(incident.created_at).toLocaleDateString()}</td>
                      <td>{incident.active ? "Actif" : "Inactif"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="no-data">Vous n'avez pas encore signalé d'incidents.</p>
          )}
        </div>
      </div>
      
      <div className="stats-row badge-row">
  {/* Carte Contributions */}
<div className="stats-card badges-container large">
  <h3>Badges de contribution</h3>
  <div className="badges-group">
    <h4>Incidents</h4>
    <div className="badges-list">
      {["10+ incidents", "20+ incidents", "30+ incidents"].map((badge, index) => {
const obtained = earnedIncidentBadges.includes(badge);
// Calculer dynamiquement les badges incidents et votes à partir des compteurs

  
return (
          <div key={index} className={`badge-item ${obtained ? 'success' : 'disabled'}`}>
            <FaExclamationTriangle />
            <span>{badge}</span>
          </div>
        );
      })}
    </div>

    <h4>Votes</h4>
    <div className="badges-list">
      {["10+ votes", "20+ votes", "30+ votes"].map((badge, index) => {
const obtained = earnedVoteBadges.includes(badge);
return (
          <div key={index} className={`badge-item ${obtained ? 'info' : 'disabled'}`}>
            <FaThumbsUp />
            <span>{badge}</span>
          </div>
        );
      })}
    </div>
  </div>
</div>


  {/* Carte Ancienneté */}
  <div className="stats-card badges-container small">
    <h3>Ancienneté</h3>
    <div className="badges-list">
      {["Membre depuis 6 mois", "Membre depuis 1 an"].map((badge, index) => {
const obtained = stats.badges.some(b => b.label === badge && b.category === 'anciennete');
return (
          <div key={index} className={`badge-item ${obtained ? 'warning' : 'disabled'}`}>
            <FaMapMarkedAlt />
            <span>{badge}</span>
          </div>
        );
      })}
    </div>
  </div>
</div>


    </div>
  );
};

export default StatsPage;