import api from './api';

// Données fictives pour remplacer les appels API manquants
const mockStats = {
  totalIncidents: 245,
  totalVotes: 1320,
  topUsers: [
    { id: 1, username: 'user1', incidentCount: 35 },
    { id: 2, username: 'user2', incidentCount: 28 },
    { id: 3, username: 'user3', incidentCount: 21 }
  ],
  incidentTypes: [
    { type: 'ACCIDENT', count: 78 },
    { type: 'TRAFFIC_JAM', count: 56 },
    { type: 'ROAD_CLOSED', count: 42 },
    { type: 'CONSTRUCTION', count: 35 },
    { type: 'HAZARD', count: 22 },
    { type: 'WEATHER', count: 12 }
  ]
};

const mockAreaIncidents = [
  {
    id: 1,
    type: 'ACCIDENT',
    location: { lat: 48.8566, lng: 2.3522 },
    created_at: new Date().toISOString(),
    description: 'Accident sur la voie de droite'
  },
  {
    id: 2,
    type: 'TRAFFIC_JAM',
    location: { lat: 48.8576, lng: 2.3532 },
    created_at: new Date(Date.now() - 3600000).toISOString(),
    description: 'Embouteillage important'
  },
  {
    id: 3,
    type: 'CONSTRUCTION',
    location: { lat: 48.8556, lng: 2.3512 },
    created_at: new Date(Date.now() - 7200000).toISOString(),
    description: 'Travaux en cours'
  }
];

// Fonction pour récupérer les statistiques (tente d'utiliser l'API, sinon utilise les données fictives)
export const getStats = async () => {
  try {
    const response = await api.get('/api/stats');
    return response.data;
  } catch (error) {
    console.log('Fallback to mock stats data:', error.message);
    return { success: true, stats: mockStats };
  }
};

// Fonction pour récupérer les incidents dans une zone (tente d'utiliser l'API, sinon utilise les données fictives)
export const getAreaIncidents = async (boundingBox) => {
  try {
    const response = await api.get('/api/incidents/area', { params: boundingBox });
    return response.data;
  } catch (error) {
    console.log('Fallback to mock area incidents data:', error.message);
    return { success: true, incidents: mockAreaIncidents };
  }
};