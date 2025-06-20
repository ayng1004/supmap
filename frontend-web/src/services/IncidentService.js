import api from './api';
const getIconPath = (filename) => `${process.env.PUBLIC_URL}/icons/${filename}`;

export const INCIDENT_TYPES = {
  ACCIDENT: {
    id: 'accident',
    label: 'Accident',
    icon: getIconPath('accident.png'),
    color: '#e74c3c'
  },
  TRAFFIC: {
    id: 'traffic',
    label: 'Embouteillage',
    icon: getIconPath('traffic.png'),
    color: '#f39c12'
  },
  CLOSURE: {
    id: 'closure',
    label: 'Route fermée',
    icon: getIconPath('closure.png'),
    color: '#3498db'
  },
  POLICE: {
    id: 'police',
    label: 'Contrôle policier',
    icon: getIconPath('police.png'),
    color: '#2c3e50'
  },
  HAZARD: {
    id: 'hazard',
    label: 'Obstacle',
    icon: getIconPath('hazard.png'),
    color: '#8e44ad'
  }
};


// Stockage local temporaire pour le fallback
let localIncidents = JSON.parse(localStorage.getItem('local_incidents') || '[]');

// Cache pour les incidents récupérés depuis l'API
let cachedIncidents = JSON.parse(localStorage.getItem('cached_incidents') || '[]');

// État du mode hors ligne
let isOffline = false;

// Fonction utilitaire pour sauvegarder les incidents locaux
const saveLocalIncidents = () => {
  localStorage.setItem('local_incidents', JSON.stringify(localIncidents));
  console.log('Incidents locaux sauvegardés:', localIncidents.length);
};

// Fonction utilitaire pour sauvegarder les incidents en cache
const saveCachedIncidents = () => {
  localStorage.setItem('cached_incidents', JSON.stringify(cachedIncidents));
  console.log('Incidents en cache sauvegardés:', cachedIncidents.length);
};

// Dans IncidentService.js, modifiez la fonction handleOfflineMode
const handleOfflineMode = (setMode) => {
  if (setMode !== undefined) {
    isOffline = setMode;
    localStorage.setItem('offline_mode', JSON.stringify(isOffline));
    console.log(`Mode hors ligne ${isOffline ? 'activé' : 'désactivé'}`);
  }
  return isOffline;
};

// Au démarrage, assurez-vous que le mode hors ligne est désactivé par défaut
try {
  handleOfflineMode(false); // Forcer le mode en ligne au démarrage
} catch (error) {
  console.error('Erreur lors de l\'initialisation du mode hors ligne:', error);
}

// Initialiser le mode hors ligne depuis le localStorage si disponible
try {
  const savedOfflineMode = localStorage.getItem('offline_mode');
  if (savedOfflineMode !== null) {
    isOffline = JSON.parse(savedOfflineMode);
  } else {
    // Par défaut, commencer en mode en ligne
    isOffline = false;
    localStorage.setItem('offline_mode', 'false');
  }
  console.log(`Mode hors ligne initialisé à: ${isOffline}`);
} catch (error) {
  console.error('Erreur lors de la lecture du mode hors ligne:', error);
  // En cas d'erreur, forcer le mode en ligne
  isOffline = false;
  localStorage.setItem('offline_mode', 'false');
}

// Service de gestion des incidents
const incidentService = {
  
  // Récupérer tous les incidents
  getAllIncidents: async () => {
    try {
      incidentService.cleanExpiredIncidents();

      if (handleOfflineMode()) {
        console.log('Mode hors ligne actif, utilisation des données locales');
        return [...localIncidents, ...cachedIncidents].filter(
          (incident, index, self) => 
            // Supprimer les doublons en se basant sur l'ID
            index === self.findIndex(i => i.id === incident.id)
        );
      }
      
      // Requête à l'API
      const response = await api.get('/api/incidents');
      
      console.log('Réponse getAllIncidents:', response);
      handleOfflineMode(false); // Explicitement désactiver le mode hors ligne
      
      // Mettre en cache les incidents récupérés
      if (response.data.incidents && Array.isArray(response.data.incidents)) {
        // Assurer que chaque incident a une propriété votes
        const processedIncidents = response.data.incidents.map(incident => ({
          ...incident,
          // Si votes n'existe pas ou est null, initialiser avec up et down à 0
          votes: incident.votes || { up: 0, down: 0 }
        }));
        
        cachedIncidents = processedIncidents.filter(
          // Ne pas mettre en cache les incidents qui sont déjà en local
          incident => !localIncidents.some(local => local.id === incident.id)
        );
        saveCachedIncidents();
        
        // Combiner les incidents de l'API avec les incidents locaux
        const allIncidents = [
          ...processedIncidents, 
          ...localIncidents
        ].filter(
          (incident, index, self) => 
            // Supprimer les doublons en se basant sur l'ID
            index === self.findIndex(i => i.id === incident.id)
        );
        
        return allIncidents;
      }
      
      return response.data.incidents || [];
    } catch (error) {
      console.error('Erreur lors de la récupération des incidents:', error);
      handleOfflineMode(true);
      
      // Fallback - retourner les incidents stockés localement et en cache
      return [...localIncidents, ...cachedIncidents].filter(
        (incident, index, self) => 
          index === self.findIndex(i => i.id === incident.id)
      );
    }
  },
  
  getIncidentsInArea: async (bounds) => {
    try {
      if (handleOfflineMode()) {
        console.log('Mode hors ligne actif, filtrage des données locales par zone');
        return incidentService.filterIncidentsByArea([...localIncidents, ...cachedIncidents], bounds);
      }
      
      const { lat1, lon1, lat2, lon2 } = bounds;
      
      // Modifier le chemin de l'endpoint pour qu'il corresponde à la configuration du serveur
      // Essayez d'abord l'endpoint correct
      try {
        const response = await api.get(`/api/incidents/area?lat1=${lat1}&lon1=${lon1}&lat2=${lat2}&lon2=${lon2}`);
        handleOfflineMode(false);
        return response.data.incidents || [];
      } catch (areaError) {
        console.warn("Erreur sur l'endpoint area, tentative de récupération de tous les incidents:");
        // Si l'endpoint /area échoue, essayez plutôt de récupérer tous les incidents
        const allIncidentsResponse = await api.get('/api/incidents');
        const allIncidents = allIncidentsResponse.data.incidents || [];
        
        // Filtrer manuellement par zone
        return incidentService.filterIncidentsByArea(allIncidents, bounds);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des incidents par zone:', error);
      handleOfflineMode(true);
      
      // Fallback - filtrer les incidents locaux qui sont dans la zone
      return incidentService.filterIncidentsByArea([...localIncidents, ...cachedIncidents], bounds);
    }
  },
  
  // Fonction utilitaire pour filtrer les incidents par zone géographique
  filterIncidentsByArea: (incidents, bounds) => {
    return incidents.filter(incident => {
      if (!incidentService.isIncidentActive(incident)) {
        return false;
      }
      // Déterminer les coordonnées selon le format de l'incident
      let lng, lat;
      
      if (incident.location && Array.isArray(incident.location)) {
        [lng, lat] = incident.location;
      } else if (incident.longitude !== undefined && incident.latitude !== undefined) {
        lng = incident.longitude;
        lat = incident.latitude;
      } else {
        console.warn('Incident sans coordonnées valides lors du filtrage par zone:', incident);
        return false;
      }
      
      return (
        lat >= Math.min(bounds.lat1, bounds.lat2) &&
        lat <= Math.max(bounds.lat1, bounds.lat2) &&
        lng >= Math.min(bounds.lon1, bounds.lon2) &&
        lng <= Math.max(bounds.lon1, bounds.lon2)
      );
    });
  },
  
  // Créer un nouvel incident (sans l'enregistrer)
  createIncident: (type, location, description = '', reportedBy = null) => {
    return {
      type,
      description,
      location,
      reported_by: reportedBy,
      active: true,
      reliability_score: 1.0,
      created_at: new Date().toISOString(),
      votes: { up: 0, down: 0 }
    };
  },
  
  addIncident: async (incidentData) => {
    try {
      // Récupérer le token d'authentification
      const token = localStorage.getItem('token');
      
      // Vérifier si l'utilisateur est connecté
      if (!token) {
        console.warn('Utilisateur non authentifié, ajout local uniquement');
        return incidentService.addLocalIncident(incidentData);
      }
  
      const { location, type, description, reported_by, votes } = incidentData;
  
      // Préparer les données pour l'API
      const payload = {
        type,
        description,
        reported_by,
        votes: votes || { up: 0, down: 0 },
        latitude: location[1],
        longitude: location[0]
      };
  
      console.log('Envoi des données d\'incident:', payload);
      
      // Envoyer à l'API
      const response = await api.post('/api/incidents', payload, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
  
      console.log('Réponse après ajout d\'incident:', response);
      
      // Vérifier et formater la réponse
      const incident = response.data.incident || response.data;
      
      // Assurer que l'incident a une propriété votes
      if (!incident.votes) {
        incident.votes = { up: 0, down: 0 };
      }
      
      return incident;
    } catch (error) {
      console.error('Erreur lors de l\'ajout d\'un incident:', error);
      
      // Gérer spécifiquement les erreurs d'authentification
      if (error.response && error.response.status === 401) {
        console.warn('Authentification échouée, ajout local uniquement');
      }
      
      // Fallback en mode local
      return incidentService.addLocalIncident(incidentData);
    }
  },
  
  // Fonction pour ajouter un incident localement
  addLocalIncident: (incidentData) => {
    // Générer un ID unique pour l'incident local
    const now = new Date();
    const localId = `local-${now.getTime()}-${Math.floor(Math.random() * 1000)}`;
    
    // S'assurer que votes est initialisé
    const votes = incidentData.votes || { up: 0, down: 0 };
    
    // Créer l'incident local avec les bonnes propriétés
    const newIncident = {
      id: localId,
      ...incidentData,
      created_at: now.toISOString(),
      reliability_score: 1.0,
      active: true,
      votes,
      reporter: {
        id: incidentData.reported_by || 'anonymous',
        name: 'Utilisateur local'
      }
    };
    
    // Ajouter à la liste locale et sauvegarder
    localIncidents.push(newIncident);
    saveLocalIncidents();
    
    console.log('Incident ajouté localement:', newIncident);
    return newIncident;
  },

  // Dans IncidentService.js
  getIncidentById: async (incidentId) => {
    try {
      // Essayer d'abord de récupérer depuis l'API
      const response = await api.get(`/api/incidents/${incidentId}`);
      
      // Si succès, retourner l'incident
      if (response.data && (response.data.incident || response.data.id)) {
        const incident = response.data.incident || response.data;
        
        // S'assurer que les votes sont présents
        if (!incident.votes) {
          incident.votes = { up: 0, down: 0 };
        }
        
        console.log("Incident récupéré avec votes:", incident);
        return incident;
      }
    } catch (error) {
      console.error(`Erreur lors de la récupération de l'incident ${incidentId}:`, error);
    }
    
    // Si échec ou incident non trouvé, chercher localement
    const localIncident = localIncidents.find(inc => inc.id.toString() === incidentId.toString());
    if (localIncident) return localIncident;
    
    // Chercher dans le cache
    const cachedIncident = cachedIncidents.find(inc => inc.id.toString() === incidentId.toString());
    if (cachedIncident) return cachedIncident;
    
    // Si toujours pas trouvé
    return null;
  },

  // Version simplifiée qui n'utilise que la base de données pour les votes
  voteIncident: async (incidentId, isConfirmed) => {
    // Récupérer l'utilisateur et le token depuis le localStorage
    const user = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('token');
    
    console.log('Infos pour vote:', {
      userExists: !!user,
      tokenExists: !!token,
      incidentId,
      isConfirmed
    });
    
    // Vérifier si l'utilisateur est connecté
    if (!user || !token) {
      const error = new Error('Vous devez être connecté pour voter');
      error.name = 'AuthenticationError';
      throw error;
    }

    try {
      console.log(`Tentative de vote sur l'incident ${incidentId}`);
      
      // Voter directement via l'API
      const response = await api.post(`/api/incidents/${incidentId}/vote`, 
        { is_confirmed: isConfirmed },
        { 
          headers: { 
            Authorization: `Bearer ${token}` 
          } 
        }
      );
      
      console.log('Réponse du vote:', response.data);
      
      // Retourner l'incident mis à jour avec les votes
      return {
        ...response.data,
        id: incidentId,
        votes: response.data.votes || { 
          up: response.data.up || (isConfirmed ? 1 : 0), 
          down: response.data.down || (isConfirmed ? 0 : 1) 
        }
      };
    } catch (error) {
      console.error('Erreur lors du vote:', error);
      
      // Vérifier le message d'erreur ou le code HTTP pour distinguer les cas
      if (error.response) {
        if (error.response.status === 401) {
          const authError = new Error('Vous devez être connecté pour voter');
          authError.name = 'AuthenticationError';
          throw authError;
        } else if (error.response.status === 403) {
          const ownerError = new Error('Vous ne pouvez pas voter sur votre propre incident');
          ownerError.name = 'OwnerError';
          throw ownerError;
        } else if (error.response.status === 409) {
          // Code 409 Conflict - pour les votes en double
          const duplicateError = new Error('Vous avez déjà voté sur cet incident');
          duplicateError.name = 'DuplicateVoteError';
          throw duplicateError;
        }
      }
      
      // Propager l'erreur
      throw error;
    }
  },
  
  // Supprimer un incident
  deleteIncident: async (incidentId) => {
    try {
      // Vérifier d'abord si c'est un incident local
      if (incidentId.toString().startsWith('local-')) {
        return incidentService.deleteLocalIncident(incidentId);
      }
      
      if (handleOfflineMode()) {
        console.log('Mode hors ligne actif, suppression locale uniquement');
        return incidentService.deleteLocalIncident(incidentId);
      }
      
      const response = await api.delete(`/api/incidents/${incidentId}`);

      handleOfflineMode(false);
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la suppression d\'un incident:', error);
      handleOfflineMode(true);
      
      return incidentService.deleteLocalIncident(incidentId);
    }
  },
  
  // Fonction pour supprimer un incident local
  deleteLocalIncident: (incidentId) => {
    const initialCount = localIncidents.length;
    localIncidents = localIncidents.filter(inc => inc.id.toString() !== incidentId.toString());
    
    if (initialCount !== localIncidents.length) {
      saveLocalIncidents();
      console.log(`Incident local ${incidentId} supprimé`);
      return { success: true, message: 'Incident supprimé localement' };
    }
    
    // Chercher dans les incidents en cache
    const initialCacheCount = cachedIncidents.length;
    cachedIncidents = cachedIncidents.filter(inc => inc.id.toString() !== incidentId.toString());
    
    if (initialCacheCount !== cachedIncidents.length) {
      saveCachedIncidents();
      console.log(`Incident en cache ${incidentId} supprimé`);
      return { success: true, message: 'Incident supprimé du cache' };
    }
    
    console.warn(`Incident ${incidentId} non trouvé pour suppression`);
    return { success: false, message: 'Incident non trouvé' };
  },
  
  // Signaler un incident (fonction simplifiée pour le composant ReportIncidentPage)
  reportIncident: async (data) => {
    try {
      const { coords, title } = data;
      
      // Déterminer le type d'incident en fonction du titre
      let type = 'other';
      Object.values(INCIDENT_TYPES).forEach(incidentType => {
        if (incidentType.label.toLowerCase() === title.toLowerCase()) {
          type = incidentType.id;
        }
      });
      
      return await incidentService.addIncident({
        type,
        location: coords,
        description: `Signalement: ${title}`,
        votes: { up: 0, down: 0 } // Initialiser les votes
      });
    } catch (error) {
      console.error('Erreur lors du signalement d\'un incident:', error);
      throw error;
    }
  },

  cleanExpiredIncidents: () => {
    const now = new Date();
    const EXPIRATION_TIMES = {
      'traffic': 3 * 60 * 60 * 1000,  // 3 heures pour embouteillages
      'police': 2 * 60 * 60 * 1000,   // 2 heures pour contrôles policiers
      'closure': 12 * 60 * 60 * 1000, // 12 heures pour routes fermées
      'accident': 6 * 60 * 60 * 1000, // 6 heures pour accidents
      'hazard': 4 * 60 * 60 * 1000    // 4 heures pour obstacles
    };
    
    // Nettoyer les incidents locaux expirés
    const initialCount = localIncidents.length;
    localIncidents = localIncidents.filter(incident => {
      const createdDate = new Date(incident.created_at);
      const age = now - createdDate;
      const expirationTime = EXPIRATION_TIMES[incident.type] || 4 * 60 * 60 * 1000;
      
      // Conserver les incidents non expirés
      return age <= expirationTime || incident.active === false;
    });
    
    if (initialCount !== localIncidents.length) {
      saveLocalIncidents();
      console.log(`${initialCount - localIncidents.length} incidents locaux expirés ont été nettoyés`);
    }
    
    // Nettoyer également le cache des incidents
    const initialCacheCount = cachedIncidents.length;
    cachedIncidents = cachedIncidents.filter(incident => {
      const createdDate = new Date(incident.created_at || incident.createdAt);
      const age = now - createdDate;
      const expirationTime = EXPIRATION_TIMES[incident.type] || 4 * 60 * 60 * 1000;
      
      // Conserver les incidents non expirés
      return age <= expirationTime || incident.active === false;
    });
    
    if (initialCacheCount !== cachedIncidents.length) {
      saveCachedIncidents();
      console.log(`${initialCacheCount - cachedIncidents.length} incidents en cache expirés ont été nettoyés`);
    }
    
    return {
      removed: (initialCount - localIncidents.length) + (initialCacheCount - cachedIncidents.length)
    };
  },
  
  // Vérifier si un incident est encore actif
  isIncidentActive: (incident) => {
    if (!incident) return false;
    if (incident.active === false) return false;
    
    const now = new Date();
    const createdDate = new Date(incident.created_at || incident.createdAt);
    const age = now - createdDate;
    
    // Définir des durées de vie par type d'incident
    const EXPIRATION_TIMES = {
      'traffic': 3 * 60 * 60 * 1000,  // 3 heures
      'police': 2 * 60 * 60 * 1000,   // 2 heures
      'closure': 12 * 60 * 60 * 1000, // 12 heures
      'accident': 6 * 60 * 60 * 1000, // 6 heures
      'hazard': 4 * 60 * 60 * 1000    // 4 heures
    };
    
    const expirationTime = EXPIRATION_TIMES[incident.type] || 4 * 60 * 60 * 1000;
    
    // Expiration basée sur le temps
    if (age > expirationTime) return false;
    
    // Expiration basée sur les votes
    const { up = 0, down = 0 } = incident.votes || {};
    if (down > up && down >= 3) return false;
    
    return true;
  },
  
  // Nettoyer complètement le cache local
  clearLocalCache: () => {
    // Vider les incidents locaux
    localIncidents = [];
    saveLocalIncidents();
    
    // Vider les incidents en cache
    cachedIncidents = [];
    saveCachedIncidents();
    
    // Vider l'éventuel cache localStorage des votes
    localStorage.removeItem('user_votes');
    
    console.log('Cache local vidé avec succès');
    return true;
  },
  
  // Synchroniser les incidents locaux avec le serveur
  syncLocalIncidents: async () => {
    const localOnlyIncidents = localIncidents.filter(inc => inc.id.toString().startsWith('local-'));
    
    if (localOnlyIncidents.length === 0) {
      console.log('Aucun incident local à synchroniser');
      return { added: 0, failed: 0 };
    }
    
    console.log(`Tentative de synchronisation de ${localOnlyIncidents.length} incidents locaux`);
    let added = 0;
    let failed = 0;
    
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('Impossible de synchroniser: aucun token d\'authentification');
      return { added: 0, failed: localOnlyIncidents.length };
    }
    
    const syncResults = await Promise.allSettled(
      localOnlyIncidents.map(async (localIncident) => {
        try {
          // Copier l'incident pour ne pas modifier l'original
          const incidentToSync = { ...localIncident };
          delete incidentToSync.id; // Supprimer l'ID local
          
          // Préparer les données pour l'API
          const { location, type, description, reported_by, votes } = incidentToSync;
          
          // Envoyer au serveur
          const response = await api.post('/api/incidents', {
            type,
            description,
            reported_by,
            votes: votes || { up: 0, down: 0 },
            latitude: location[1],
            longitude: location[0]
          }, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          
          return { 
            success: true, 
            localId: localIncident.id, 
            serverIncident: response.data.incident 
          };
        } catch (error) {
          console.error(`Échec de synchronisation pour incident ${localIncident.id}:`, error);
          return { 
            success: false, 
            localId: localIncident.id, 
            error 
          };
        }
      })
    );
    
    // Traiter les résultats
    const successfulIds = [];
    
    syncResults.forEach(result => {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          added++;
          successfulIds.push(result.value.localId);
        } else {
          failed++;
        }
      } else {
        failed++;
      }
    });
    
    // Supprimer les incidents synchronisés avec succès
    if (successfulIds.length > 0) {
      localIncidents = localIncidents.filter(
        incident => !successfulIds.includes(incident.id)
      );
      saveLocalIncidents();
    }
    
    console.log(`Synchronisation terminée: ${added} ajoutés, ${failed} échoués`);
    return { added, failed };
  },
  
  // Dans IncidentService.js, modifiez les fonctions problématiques :

hasUserVotedServer: async (incidentId, userId) => {
  if (!incidentId || !userId) return false;
  
  try {
    const token = localStorage.getItem('token');
    if (!token) return false;
    
    // Vérifier si on est en mode hors ligne
    if (handleOfflineMode()) {
      console.log('Mode hors ligne, retour false pour la vérification de vote');
      return false;
    }
    
    const response = await api.get(`/api/incidents/${incidentId}/votes/${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    return response.data && response.data.hasVoted;
  } catch (error) {
    // Plutôt que de logguer l'erreur, retournez simplement false
    // console.error(`Erreur lors de la vérification du vote serveur pour l'incident ${incidentId}:`, error);
    return false;
  }
},

getUserVoteType: async (incident, userId) => {
  if (!userId || !incident) return null;
  
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;
    
    // Vérifier si on est en mode hors ligne
    if (handleOfflineMode()) {
      console.log('Mode hors ligne, retour null pour type de vote');
      return null;
    }
    
    const response = await api.get(`/api/incidents/${incident.id}/votes/${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (response.data && response.data.hasVoted) {
      return response.data.voteType || 'up';
    }
    
    return null;
  } catch (error) {
    // Ne pas logguer l'erreur à chaque fois
    // console.error(`Erreur lors de la récupération du type de vote pour l'incident ${incident.id}:`, error);
    return null;
  }
},
  
  // Obtient le type de vote d'un utilisateur depuis le serveur
  getUserVoteType: async (incident, userId) => {
    if (!userId || !incident) return null;
    
    try {
      const token = localStorage.getItem('token');
      if (!token) return null;
      
      const response = await api.get(`/api/incidents/${incident.id}/votes/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data && response.data.hasVoted) {
        return response.data.voteType;
      }
      
      return null;
    } catch (error) {
      console.error(`Erreur lors de la récupération du type de vote pour l'incident ${incident.id}:`, error);
      return null;
    }
  },
  
  // Obtenir le nombre d'incidents locaux
  getLocalIncidentsCount: () => localIncidents.length,
  
  // Calculer le taux de fiabilité d'un incident (en pourcentage)
  calculateReliability: (incident) => {
    if (!incident || !incident.votes) {
      return 50; // Fiabilité par défaut: 50%
    }
    
    const { up = 0, down = 0 } = incident.votes;
    const total = up + down;
    
    if (total === 0) {
      return 50; // Aucun vote = fiabilité neutre
    }
    
    // Calculer le pourcentage de votes positifs
    return Math.round((up / total) * 100);
  },

  // Détermine si un utilisateur peut voter sur un incident en interrogeant le serveur
  canUserVote: async (incident, userId) => {
    // L'incident doit exister
    if (!incident) {
      return { canVote: false, reason: 'Incident non trouvé' };
    }
    
    // L'utilisateur doit être connecté
    if (!userId) {
      return { canVote: false, reason: 'Vous devez être connecté pour voter' };
    }
    
    // L'utilisateur ne peut pas voter sur son propre incident
    if (incident.userId === userId || incident.reported_by === userId ||
        (incident.reporter && incident.reporter.id === userId)) {
      return { canVote: false, reason: 'Vous ne pouvez pas voter sur votre propre incident' };
    }
    
    // Vérifier si l'utilisateur a déjà voté (via API)
    try {
      const hasVoted = await incidentService.hasUserVotedServer(incident.id, userId);
      if (hasVoted) {
        return { canVote: false, reason: 'Vous avez déjà voté sur cet incident' };
      }
    } catch (error) {
      console.error('Erreur lors de la vérification du vote:', error);
      // En cas d'erreur, on laisse voter
    }
    
    return { canVote: true };
  }
};

export const { 
  getAllIncidents, 
  getIncidentsInArea, 
  createIncident, 
  addIncident, 
  voteIncident, 
  deleteIncident, 
  reportIncident,
  syncLocalIncidents,
  isOfflineMode,
  setOfflineMode,
  getLocalIncidentsCount,
  cleanExpiredIncidents, 
  isIncidentActive,      
  clearLocalCache, 
  getUserVoteType,        
  canUserVote,
  hasUserVotedServer
} = incidentService;

export default incidentService;
