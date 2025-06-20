// services/IncidentService.js
// Service pour la gestion des incidents sur la route

/**
 * Service de gestion des incidents routiers
 */
class IncidentService {
    /**
     * Types d'incidents prédéfinis
     * @returns {Object} - Objet contenant les différents types d'incidents
     */
    getIncidentTypes() {
      return {
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
    }
  
    /**
     * Obtient la couleur associée à un type d'incident
     * @param {string} type - Type d'incident
     * @returns {string} - Code couleur hexadécimal
     */
    getIncidentColor(type) {
      const incidentTypes = this.getIncidentTypes();
      return incidentTypes[type]?.color || '#8E8E93';
    }
  
    /**
     * Obtient l'icône associée à un type d'incident
     * @param {string} type - Type d'incident
     * @returns {string} - Nom de l'icône
     */
    getIncidentIcon(type) {
      const incidentTypes = this.getIncidentTypes();
      return incidentTypes[type]?.icon || 'exclamation';
    }
  
    /**
     * Crée un nouvel incident
     * @param {string} type - Type d'incident
     * @param {Array} coords - Coordonnées [longitude, latitude]
     * @param {string} description - Description de l'incident
     * @returns {Object} - Nouvel objet incident
     */
    createIncident(type, coords, description = '') {
      const incidentTypes = this.getIncidentTypes();
      const defaultDescription = incidentTypes[type]?.description || 'Incident sur la route';
      
      return {
        id: Date.now().toString(),
        type: type,
        coords: coords,
        description: description || defaultDescription,
        created_at: new Date().toISOString(),
        active: true,
        votes: { up: 1, down: 0 }
      };
    }
  
    /**
     * Filtre les incidents pour ne garder que les actifs et valides
     * @param {Array} incidents - Liste d'incidents
     * @returns {Array} - Liste filtrée
     */
    filterActiveIncidents(incidents) {
      if (!incidents || !Array.isArray(incidents)) {
        return [];
      }
      
      return incidents.filter(incident => 
        incident.active !== false && 
        incident.coords && 
        incident.coords.length === 2
      );
    }
  
    /**
     * Met à jour le vote d'un incident
     * @param {Array} incidents - Liste d'incidents
     * @param {string} incidentId - ID de l'incident
     * @param {boolean} isUpvote - True pour upvote, false pour downvote
     * @returns {Object} - Liste d'incidents mise à jour et incident modifié
     */
    updateIncidentVote(incidents, incidentId, isUpvote) {
      const updatedIncidents = incidents.map(inc => {
        if (inc.id === incidentId) {
          // Créer une copie des votes actuels ou initialiser
          const updatedVotes = inc.votes ? { ...inc.votes } : { up: 0, down: 0 };
          
          // Incrémenter le vote approprié
          if (isUpvote) {
            updatedVotes.up = (updatedVotes.up || 0) + 1;
          } else {
            updatedVotes.down = (updatedVotes.down || 0) + 1;
          }
          
          // Déterminer si l'incident doit rester actif
          // Si trop de downvotes, désactiver l'incident
          const shouldStayActive = !(
            updatedVotes.down > updatedVotes.up && 
            updatedVotes.down >= 3
          );
          
          return {
            ...inc,
            votes: updatedVotes,
            active: shouldStayActive
          };
        }
        return inc;
      });
      
      // Trouver l'incident mis à jour
      const updatedIncident = updatedIncidents.find(inc => inc.id === incidentId);
      
      return { 
        incidents: updatedIncidents, 
        updatedIncident 
      };
    }
  }
  
  // Exporter une instance unique du service
  export default new IncidentService();