// Types d'incidents avec leurs informations d'affichage
const INCIDENT_TYPES = {
    'traffic': { 
      id: 'traffic', 
      title: 'Bouchon', 
      color: '#FF9500', 
      icon: 'traffic-light',
      description: 'Embouteillage important'
    },
    'accident': { 
      id: 'accident', 
      title: 'Accident', 
      color: '#FF3B30', 
      icon: 'car-crash',
      description: 'Accident de circulation' 
    },
    'hazard': { 
      id: 'hazard', 
      title: 'Danger', 
      color: '#FF2D55', 
      icon: 'exclamation-triangle',
      description: 'Obstacle ou danger sur la route' 
    },
    'police': { 
      id: 'police', 
      title: 'Police', 
      color: '#34C759', 
      icon: 'shield-alt',
      description: 'Contrôle policier' 
    },
    'closure': { 
      id: 'closure', 
      title: 'Route fermée', 
      color: '#5856D6', 
      icon: 'road',
      description: 'Route ou voie fermée' 
    }
  };
  
  // Fonction pour obtenir les informations d'un type à partir de son ID
  export const getIncidentTypeInfo = (typeId) => {
    return INCIDENT_TYPES[typeId] || {
      id: 'unknown',
      title: 'Autre',
      color: '#8E8E93',
      icon: 'exclamation',
      description: 'Signalement non catégorisé'
    };
  };
  
  // Obtenir le temps d'expiration pour un type d'incident (en millisecondes)
  export const getIncidentExpiration = (typeId) => {
    const EXPIRATION_TIMES = {
      'traffic': 3 * 60 * 60 * 1000,  // 3 heures pour embouteillages
      'police': 2 * 60 * 60 * 1000,   // 2 heures pour contrôles policiers
      'closure': 12 * 60 * 60 * 1000, // 12 heures pour routes fermées
      'accident': 6 * 60 * 60 * 1000, // 6 heures pour accidents
      'hazard': 4 * 60 * 60 * 1000    // 4 heures pour obstacles
    };
    
    return EXPIRATION_TIMES[typeId] || 4 * 60 * 60 * 1000; // 4 heures par défaut
  };
  
  // Vérifier si un incident est toujours actif en fonction de sa date de création
  export const isIncidentActive = (incident) => {
    if (!incident) return false;
    if (incident.active === false) return false;
    
    const now = new Date();
    const createdDate = new Date(incident.created_at || incident.timestamp);
    const age = now - createdDate;
    
    const expirationTime = getIncidentExpiration(incident.type);
    
    // Expiration basée sur le temps
    if (age > expirationTime) return false;
    
    // Expiration basée sur les votes
    const { up = 0, down = 0 } = incident.votes || {};
    if (down > up && down >= 3) return false;
    
    return true;
  };
  
  // Fonction pour formater le temps écoulé
  export const getElapsedTime = (timestamp) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffMinutes < 1) return 'À l\'instant';
    if (diffMinutes < 60) return `Il y a ${diffMinutes} min`;
    
    const hours = Math.floor(diffMinutes / 60);
    if (hours < 24) return `Il y a ${hours} h`;
    
    const days = Math.floor(hours / 24);
    return `Il y a ${days} jour${days > 1 ? 's' : ''}`;
  };
  
  export default INCIDENT_TYPES;