// RecapPredictionPage.jsx
import React, { useState, useEffect } from 'react';
import { 
  FaChartBar, FaExclamationTriangle, FaClock, FaMapMarkedAlt, 
  FaCarAlt, FaTrafficLight, FaRoad, FaCalendarAlt, FaInfoCircle, 
  FaUser, FaThumbsUp, FaChevronDown, FaChevronUp, FaEye, FaEyeSlash, 
  FaChartPie, FaChartLine
} from 'react-icons/fa';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import './RecapPredictionPage.css';
// Importer les services au lieu d'utiliser axios directement
import { getStats, getAreaIncidents } from '../services/statsService';

// Couleurs pour le diagramme camembert
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#F44336', '#E91E63', '#9C27B0', '#673AB7'];

const RecapPredictionPage = ({ userId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [predictions, setPredictions] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [areaIncidents, setAreaIncidents] = useState([]);
  // État pour suivre quelles sections sont visibles (ouvertes) ou cachées
  const [visibleSections, setVisibleSections] = useState({
    situation: true,
    forecast: true,
    hotspots: true,
    globalStats: true
  });
  // État pour les données du diagramme camembert
  const [pieChartData, setPieChartData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Get user's current location
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
          });
          
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          
          // Get incidents around user - utilisation du service
          const boundingBox = {
            lat1: position.coords.latitude - 0.045,
            lon1: position.coords.longitude - 0.045 / Math.cos(position.coords.latitude * Math.PI / 180),
            lat2: position.coords.latitude + 0.045,
            lon2: position.coords.longitude + 0.045 / Math.cos(position.coords.latitude * Math.PI / 180)
          };
          
          const areaResponse = await getAreaIncidents(boundingBox);
          
          if (areaResponse.success) {
            setAreaIncidents(areaResponse.incidents);
          }
        } catch (locError) {
          console.error('Error getting location:', locError);
          // Continue without location
        }
        
        // Get global statistics - utilisation du service
        const statsResponse = await getStats();
        
        if (statsResponse.success) {
          setStats(statsResponse.stats);
          
          // Préparer les données pour le diagramme camembert
          if (statsResponse.stats.incidentTypes && statsResponse.stats.incidentTypes.length > 0) {
            const chartData = statsResponse.stats.incidentTypes.map(type => ({
              name: getIncidentTypeName(type.type),
              value: parseInt(type.count),
              type: type.type
            }));
            setPieChartData(chartData);
          }
        }
        
        // Generate "predictions" based on incident data
        // In a real app, you'd have a backend ML model
        if (areaIncidents.length > 0) {
          // Count incidents by type
          const incidentTypes = {};
          areaIncidents.forEach(incident => {
            incidentTypes[incident.type] = (incidentTypes[incident.type] || 0) + 1;
          });
          
          // Count incidents by hour of day
          const incidentsByHour = {};
          areaIncidents.forEach(incident => {
            const hour = new Date(incident.created_at).getHours();
            incidentsByHour[hour] = (incidentsByHour[hour] || 0) + 1;
          });
          
          // Get peak hours (top 3)
          const peakHours = Object.entries(incidentsByHour)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(entry => parseInt(entry[0]));
          
          // Get most common incident type
          let mostCommonType = '';
          let maxCount = 0;
          Object.entries(incidentTypes).forEach(([type, count]) => {
            if (count > maxCount) {
              maxCount = count;
              mostCommonType = type;
            }
          });
          
          // Create a "heatmap" of areas with incidents
          const clusters = [];
          if (areaIncidents.length > 0) {
            // Simple clustering for visualization
            for (let i = 0; i < Math.min(3, areaIncidents.length); i++) {
              const baseIncident = areaIncidents[Math.floor(Math.random() * areaIncidents.length)];
              clusters.push({
                location: baseIncident.location,
                count: Math.floor(Math.random() * 5) + 1,
                incidents: [baseIncident]
              });
            }
          }
          
          setPredictions({
            peakHours,
            mostCommonType,
            clusters,
            // Add forecasts for the next few hours
            forecast: [
              { hour: new Date().getHours(), risk: 'medium' },
              { hour: (new Date().getHours() + 1) % 24, risk: peakHours.includes((new Date().getHours() + 1) % 24) ? 'high' : 'low' },
              { hour: (new Date().getHours() + 2) % 24, risk: peakHours.includes((new Date().getHours() + 2) % 24) ? 'high' : 'low' },
              { hour: (new Date().getHours() + 3) % 24, risk: 'low' }
            ]
          });
        } else {
          // Si aucun incident n'est trouvé, créez des prédictions par défaut
          setPredictions({
            peakHours: [8, 12, 18],
            mostCommonType: 'TRAFFIC_JAM',
            clusters: [],
            forecast: [
              { hour: new Date().getHours(), risk: 'low' },
              { hour: (new Date().getHours() + 1) % 24, risk: 'low' },
              { hour: (new Date().getHours() + 2) % 24, risk: 'low' },
              { hour: (new Date().getHours() + 3) % 24, risk: 'low' }
            ]
          });
          
          // Données fictives pour le diagramme camembert si aucune donnée n'est disponible
          setPieChartData([
            { name: 'Embouteillage', value: 45, type: 'TRAFFIC_JAM' },
            { name: 'Accident', value: 25, type: 'ACCIDENT' },
            { name: 'Route fermée', value: 15, type: 'ROAD_CLOSED' },
            { name: 'Travaux', value: 10, type: 'CONSTRUCTION' },
            { name: 'Danger', value: 5, type: 'HAZARD' }
          ]);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [userId]);

  // Format time (convert 24h to 12h with AM/PM)
  const formatHour = (hour) => {
    if (hour === 0) return '12h00';
    if (hour === 12) return '12h00';
    return hour < 12 ? `${hour}h00` : `${hour}h00`;
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
  
  // Fonction pour basculer la visibilité d'une section
  const toggleSection = (section) => {
    setVisibleSections(prev => {
      const newState = {
        ...prev,
        [section]: !prev[section]
      };
      
      // Sauvegarder les préférences dans localStorage
      localStorage.setItem('recapSectionPreferences', JSON.stringify(newState));
      
      return newState;
    });
  };
  
  // Format pour l'infobulle du diagramme camembert
  const customTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ backgroundColor: '#fff', padding: '10px', border: '1px solid #ccc', borderRadius: '5px' }}>
          <p style={{ margin: 0 }}>{`${payload[0].name} : ${payload[0].value}`}</p>
        </div>
      );
    }
    return null;
  };
  
  // Charger les préférences de visibilité au chargement
  useEffect(() => {
    const savedPreferences = localStorage.getItem('recapSectionPreferences');
    if (savedPreferences) {
      try {
        setVisibleSections(JSON.parse(savedPreferences));
      } catch (e) {
        console.error('Erreur lors du chargement des préférences:', e);
      }
    }
  }, []);

  return (
    <div className="">
      <div className="section-header">
     
        <p>Analyse des incidents à proximité et prévisions de trafic</p>
      </div>
      
      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Chargement des données...</p>
        </div>
      ) : error ? (
        <div className="error-container">
          <FaInfoCircle size={24} />
          <p>Erreur lors du chargement des données: {error}</p>
        </div>
      ) : (
        <>
          {/* Current Situation Section */}
          <div className="section-container">
            <div className="section-header-toggle">
              <h3><FaMapMarkedAlt /> Situation Actuelle</h3>
              <button 
                className="toggle-button" 
                onClick={() => toggleSection('situation')}
                aria-label={visibleSections.situation ? "Masquer section" : "Afficher section"}
              >
                {visibleSections.situation ? 
                  <span className="toggle-text"><FaEyeSlash /> Masquer</span> : 
                  <span className="toggle-text"><FaEye /> Afficher</span>}
              </button>
            </div>
            
            <div className={`section-content ${visibleSections.situation ? 'visible' : 'hidden'}`}>
              <div className="situation-section">
                <div className="cards-row">
                  <div className="stat-card">
                    <div className="card-icon">
                      <FaExclamationTriangle />
                    </div>
                    <div className="card-content">
                      <h4>Incidents à proximité</h4>
                      <div className="card-value">{areaIncidents.length}</div>
                      <p>Dans un rayon de 5 km</p>
                    </div>
                  </div>
                  
                  <div className="stat-card">
                    <div className="card-icon">
                      <FaClock />
                    </div>
                    <div className="card-content">
                      <h4>Heure actuelle</h4>
                      <div className="card-value">{formatHour(new Date().getHours())}</div>
                      <p>{predictions?.forecast[0]?.risk === 'high' ? 'Risque élevé' : 
                          predictions?.forecast[0]?.risk === 'medium' ? 'Risque moyen' : 'Risque faible'}</p>
                    </div>
                  </div>
                  
                  <div className="stat-card">
                    <div className="card-icon">
                      <FaTrafficLight />
                    </div>
                    <div className="card-content">
                      <h4>Type d'incident dominant</h4>
                      <div className="card-value">
                        {predictions?.mostCommonType ? getIncidentTypeName(predictions.mostCommonType) : 'Aucun'}
                      </div>
                      <p>Soyez vigilant</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Traffic Forecast Section */}
          <div className="section-container">
            <div className="section-header-toggle">
              <h3><FaClock /> Prévision de Trafic</h3>
              <button 
                className="toggle-button" 
                onClick={() => toggleSection('forecast')}
                aria-label={visibleSections.forecast ? "Masquer section" : "Afficher section"}
              >
                {visibleSections.forecast ? 
                  <span className="toggle-text"><FaEyeSlash /> Masquer</span> : 
                  <span className="toggle-text"><FaEye /> Afficher</span>}
              </button>
            </div>
            
            <div className={`section-content ${visibleSections.forecast ? 'visible' : 'hidden'}`}>
              <div className="forecast-section">
                <div className="forecast-timeline">
                  {predictions?.forecast.map((timeSlot, index) => (
                    <div 
                      key={index} 
                      className={`forecast-slot ${timeSlot.risk}`}
                    >
                      <div className="time">{formatHour(timeSlot.hour)}</div>
                      <div className="risk-indicator"></div>
                      <div className="risk-label">
                        {timeSlot.risk === 'high' ? 'Élevé' : 
                         timeSlot.risk === 'medium' ? 'Moyen' : 'Faible'}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="peak-hours-container">
                  <h4><FaCalendarAlt /> Heures de pointe</h4>
                  <div className="peak-hours">
                    {predictions?.peakHours ? (
                      predictions.peakHours.map((hour, index) => (
                        <span key={index} className="peak-hour">{formatHour(hour)}</span>
                      ))
                    ) : (
                      <span>Données insuffisantes</span>
                    )}
                  </div>
                  <p className="tip">
                    <FaInfoCircle /> Conseil: Évitez de voyager pendant ces heures si possible
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Hotspots Map Section */}
          <div className="section-container">
            <div className="section-header-toggle">
              <h3><FaRoad /> Zones à risque</h3>
              <button 
                className="toggle-button" 
                onClick={() => toggleSection('hotspots')}
                aria-label={visibleSections.hotspots ? "Masquer section" : "Afficher section"}
              >
                {visibleSections.hotspots ? 
                  <span className="toggle-text"><FaEyeSlash /> Masquer</span> : 
                  <span className="toggle-text"><FaEye /> Afficher</span>}
              </button>
            </div>
            
            <div className={`section-content ${visibleSections.hotspots ? 'visible' : 'hidden'}`}>
              <div className="hotspots-section">
                <div className="hotspots-container">
                  {predictions?.clusters && predictions.clusters.length > 0 ? (
                    <div className="hotspot-cards">
                      {predictions.clusters.map((cluster, index) => (
                        <div key={index} className="hotspot-card">
                          <div className="hotspot-icon">
                            <FaExclamationTriangle />
                            <span className="hotspot-count">{cluster.count}</span>
                          </div>
                          <div className="hotspot-details">
                            <h4>Zone à risque {index + 1}</h4>
                            <p>
                              {cluster.incidents[0]?.type ? getIncidentTypeName(cluster.incidents[0].type) : 'Divers incidents'}
                            </p>
                            <button className="view-on-map-btn">
                              <FaMapMarkedAlt /> Voir sur la carte
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="no-hotspots">
                      <p>Aucune zone à risque identifiée actuellement</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* General Statistics */}
          <div className="section-container">
            <div className="section-header-toggle">
              <h3><FaChartBar /> Statistiques Globales</h3>
              <button 
                className="toggle-button" 
                onClick={() => toggleSection('globalStats')}
                aria-label={visibleSections.globalStats ? "Masquer section" : "Afficher section"}
              >
                {visibleSections.globalStats ? 
                  <span className="toggle-text"><FaEyeSlash /> Masquer</span> : 
                  <span className="toggle-text"><FaEye /> Afficher</span>}
              </button>
            </div>
            
            <div className={`section-content ${visibleSections.globalStats ? 'visible' : 'hidden'}`}>
              <div className="global-stats-section">
                <div className="cards-row">
                  <div className="stat-card">
                    <div className="card-icon">
                      <FaExclamationTriangle />
                    </div>
                    <div className="card-content">
                      <h4>Total des incidents</h4>
                      <div className="card-value">{stats?.totalIncidents || 0}</div>
                      <p>Signalés sur la plateforme</p>
                    </div>
                  </div>
                  
                  <div className="stat-card">
                    <div className="card-icon">
                      <FaThumbsUp />
                    </div>
                    <div className="card-content">
                      <h4>Total des votes</h4>
                      <div className="card-value">{stats?.totalVotes || 0}</div>
                      <p>Confirmations et infirmations</p>
                    </div>
                  </div>
                  
                  <div className="stat-card">
                    <div className="card-icon">
                      <FaUser />
                    </div>
                    <div className="card-content">
                      <h4>Contributeurs actifs</h4>
                      <div className="card-value">{stats?.topUsers?.length || 0}</div>
                      <p>Utilisateurs signalant des incidents</p>
                    </div>
                  </div>
                </div>
                
                {/* Charts section with bar chart and pie chart */}
                <div className="charts-container">
                  {/* Bar Chart */}
                  {stats?.incidentTypes && stats.incidentTypes.length > 0 && (
                    <div className="chart-card">
                      <h4><FaChartBar /> Répartition des types d'incidents (Barres)</h4>
                      <div className="chart-container">
                        <div className="bar-chart">
                          {stats.incidentTypes.map((type, index) => (
                            <div key={index} className="chart-bar-container">
                              <div className="chart-label">{getIncidentTypeName(type.type)}</div>
                              <div className="chart-bar">
                                <div 
                                  className="bar" 
                                  style={{ 
                                    width: `${Math.min(100, (type.count / Math.max(...stats.incidentTypes.map(t => parseInt(t.count)))) * 100)}%` 
                                  }}
                                ></div>
                                <div className="bar-value">{type.count}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Pie Chart */}
                  <div className="chart-card">
                    <h4><FaChartPie /> Répartition des types d'incidents (Camembert)</h4>
                    {pieChartData.length > 0 ? (
                      <>
                        <div className="pie-chart-container">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={pieChartData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                innerRadius={60}
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="value"
                              >
                                {pieChartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip content={customTooltip} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="pie-chart-legend">
                          {pieChartData.map((entry, index) => (
                            <div key={`legend-${index}`} className="legend-item">
                              <div 
                                className="legend-color" 
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                              ></div>
                              <span>{entry.name}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="no-data-message">
                        <p>Aucune donnée disponible pour le camembert</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default RecapPredictionPage;