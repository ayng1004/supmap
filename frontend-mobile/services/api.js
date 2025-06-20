import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import authService from './auth/auth';
import { DEV_API_URL, PROD_API_URL } from '@env'; // ← depuis le .env
// Détermination de l'URL de l'API
let API_URL;

// En développement, on utilise l'IP configurée dans l'environnement
if (__DEV__) {
  if (!DEV_API_URL) {
    throw new Error('❌ DEV_API_URL manquant dans .env');
  }
  API_URL = DEV_API_URL;
} else {
  if (!PROD_API_URL) {
    throw new Error('❌ PROD_API_URL manquant dans .env');
  }
  API_URL = PROD_API_URL;
}

// Création de l'instance axios avec un timeout plus long pour résoudre les problèmes de réseau
const api = axios.create({
  baseURL: API_URL,
  timeout: 30000, // 30 secondes
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Intercepteur pour ajouter le token JWT à chaque requête
api.interceptors.request.use(
  async (config) => {
    try {
      // Utiliser authService pour récupérer le token de manière sécurisée
      const token = await authService.getToken();
      
      // Log plus détaillé
      if (token) {
        console.log(`🔑 Token présent (${token.substring(0, 10)}...) pour ${config.url}`);
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        console.log(`⚠️ Aucun token pour la requête vers ${config.url}`);
      }
      
      return config;
    } catch (error) {
      console.error('Erreur lors de la récupération du token:', error);
      return Promise.reject(error);
    }
  },
  (error) => {
    console.error('Erreur dans l\'intercepteur de requêtes:', error);
    return Promise.reject(error);
  }
);

// Intercepteur pour traiter les erreurs de réponse
api.interceptors.response.use(
  (response) => {
    // Log de debug
    console.log(`✅ Réponse de ${response.config.url}: Status ${response.status}`);
    return response;
  },
  async (error) => {
    // Log détaillé des erreurs réseau
    if (error.message === 'Network Error') {
      console.error('⛔ Erreur réseau détectée:', error);
      console.error('Host API:', API_URL);
      
      // Retourner un objet personnalisé avec message d'erreur clair
      return Promise.reject(new Error('Erreur de connexion au serveur. Vérifiez votre connexion réseau.'));
    }
    
    // Gérer les erreurs 401 (non autorisé) - token expiré ou invalide
    if (error.response && error.response.status === 401) {
      // Utiliser authService pour effacer les données d'authentification
      await authService.logout();
      
      // En cas d'erreur d'authentification, on émet un événement
      if (global.authErrorEventEmitter) {
        global.authErrorEventEmitter();
      }
    }
    
    // Log général pour les autres erreurs
    if (error.response) {
      console.error('⛔ Erreur API:', error.response.status, error.response.data);
    } else {
      console.error('⛔ Erreur API sans réponse:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// Méthodes d'API pour l'application mobile avec approche simplifiée
const apiService = {
  // Exposer l'URL de base pour des usages directs
  API_URL,
  
  // Authentification
  auth: {
    // Inscription d'un nouvel utilisateur
    register: async (userData) => {
      try {
        console.log('Tentative d\'inscription:', userData.email);
        const response = await api.post('/auth/register', userData);
        
        // Stocker les données d'authentification de manière sécurisée
        if (response.data && response.data.token) {
          await authService.setAuthData({
            token: response.data.token,
            user: response.data.user
          });
        }
        
        console.log('Réponse d\'inscription:', response.data);
        return response.data;
      } catch (error) {
        console.error('Erreur register:', error.message);
        throw error; // Propager l'erreur pour une gestion cohérente
      }
    },
    
    // Connexion d'un utilisateur
    login: async (credentials) => {
      try {
        console.log('Tentative de connexion:', credentials.email);
        const response = await api.post('/auth/login', credentials);
        
        // Stocker les données d'authentification de manière sécurisée
        if (response.data && response.data.token) {
          await authService.setAuthData({
            token: response.data.token,
            user: response.data.user
          });
        }
        
        console.log('Réponse de connexion:', response.data);
        return response.data;
      } catch (error) {
        console.error('Erreur login:', error.message);
        throw error; // Propager l'erreur pour une gestion cohérente
      }
    },
    
    // Vérification de la validité du token
    verify: async () => {
      try {
        console.log('Vérification du token');
        const response = await api.get('/auth/verify');
        
        // Mettre à jour les informations utilisateur si la vérification réussit
        if (response.data && response.data.valid && response.data.user) {
          await authService.setUserInfo(response.data.user);
        }
        
        return response.data;
      } catch (error) {
        console.error('Erreur verify:', error.message);
        return { valid: false };
      }
    },
    
    // Mise à jour du profil utilisateur
    updateProfile: async (userData) => {
      try {
        console.log('Mise à jour du profil');
        const response = await api.put('/auth/profile', userData);
        
        // Si la requête réussit, mettre à jour les informations utilisateur stockées
        if (response.data && response.data.success) {
          const currentUserInfo = await authService.getUserInfo();
          if (currentUserInfo) {
            const updatedUserInfo = { ...currentUserInfo, ...userData };
            await authService.setUserInfo(updatedUserInfo);
          }
        }
        
        return response.data;
      } catch (error) {
        console.error('Erreur updateProfile:', error.message);
        throw error;
      }
    },
    
    // Changement de mot de passe
    changePassword: async (passwordData) => {
      try {
        console.log('Changement de mot de passe');
        const response = await api.put('/auth/change-password', passwordData);
        return response.data;
      } catch (error) {
        console.error('Erreur changePassword:', error.message);
        throw error;
      }
    },
    
    // Obtenir l'URL d'authentification Google
    getGoogleAuthUrl: () => {
      return `${API_URL}/auth/google`;
    },
    
    // Déconnexion (suppression des données locales)
    logout: async () => {
      try {
        await authService.logout();
        return { success: true };
      } catch (error) {
        console.error('Erreur logout:', error.message);
        throw error;
      }
    },
    
    googleAuthInit: async (authData) => {
      try {
        console.log('Initialisation de l\'authentification Google:', authData);
        const response = await api.post('/auth/google/init', authData);
        return response.data;
      } catch (error) {
        console.error('Erreur googleAuthInit:', error.message);
        throw error;
      }
    },
    
    checkGoogleAuthStatus: async (sessionId) => {
      try {
        console.log('Vérification du statut de l\'authentification:', sessionId);
        const response = await api.get(`/auth/google/check?sessionId=${sessionId}`);
        
        // Si l'authentification Google a réussi, stocker les données
        if (response.data && response.data.success && response.data.token) {
          await authService.setAuthData({
            token: response.data.token,
            user: response.data.user
          });
        }
        
        return response.data;
      } catch (error) {
        console.error('Erreur checkGoogleAuthStatus:', error.message);
        throw error;
      }
    },
  },
  
  // Incidents
  incidents: {
    getAll: async () => {
      try {
        // Ajouter un paramètre pour inclure tous les incidents, même inactifs
        const response = await api.get('/incidents?includeInactive=true');
        
        // Vérifier si la réponse est valide
        if (response.data && response.data.incidents) {
          console.log(`API getAll: reçu ${response.data.incidents.length} incidents`);
          return response.data.incidents;
        } else if (response.data && Array.isArray(response.data)) {
          console.log(`API getAll: reçu ${response.data.length} incidents (format tableau)`);
          return response.data;
        } else {
          console.warn('Format de réponse inattendu dans getAll:', response.data);
          return [];
        }
      } catch (error) {
        console.error('Erreur getAll incidents:', error.message);
        return []; // Retourner un tableau vide en cas d'erreur
      }
    },
    
   getInArea: async (bounds) => {
  try {
    // Vérifier que les bounds sont définies et adapter au format utilisé
    if (!bounds) {
      console.error('Bounds non définies dans getInArea');
      return await apiService.incidents.getAll();
    }
    
    // Vérifier si les bounds sont au format {minLat, minLon, maxLat, maxLon}
    if (bounds.minLat && bounds.minLon && bounds.maxLat && bounds.maxLon) {
      // Convertir au format attendu par l'API
      const lat1 = bounds.minLat;
      const lon1 = bounds.minLon;
      const lat2 = bounds.maxLat;
      const lon2 = bounds.maxLon;
      
      const response = await api.get(`/incidents/area?lat1=${lat1}&lon1=${lon1}&lat2=${lat2}&lon2=${lon2}`);
      
      // Vérifier si la réponse est valide
      if (response.data && response.data.incidents) {
        return response.data.incidents;
      } else if (response.data && Array.isArray(response.data)) {
        return response.data;
      } else {
        console.warn('Format de réponse inattendu dans getInArea:', response.data);
        return [];
      }
    } 
    // Format original {lat1, lon1, lat2, lon2}
    else if (bounds.lat1 && bounds.lon1 && bounds.lat2 && bounds.lon2) {
      const { lat1, lon1, lat2, lon2 } = bounds;
      const response = await api.get(`/incidents/area?lat1=${lat1}&lon1=${lon1}&lat2=${lat2}&lon2=${lon2}`);
      
      // Même traitement de la réponse...
      if (response.data && response.data.incidents) {
        return response.data.incidents;
      } else if (response.data && Array.isArray(response.data)) {
        return response.data;
      } else {
        console.warn('Format de réponse inattendu dans getInArea:', response.data);
        return [];
      }
    } 
    else {
      console.error('Format de bounds incorrect dans getInArea');
      return await apiService.incidents.getAll();
    }
  } catch (error) {
    console.error('Erreur getInArea:', error.message);
    // En cas d'erreur, essayer de récupérer tous les incidents
    return await apiService.incidents.getAll();
  }
},
    getById: async (incidentId) => {
      try {
        const response = await api.get(`/incidents/${incidentId}`);
        
        // Vérifier si la réponse est valide
        if (response.data && response.data.incident) {
          return response.data.incident;
        } else if (response.data && response.data.id) {
          return response.data;
        } else {
          console.warn('Format de réponse inattendu dans getById:', response.data);
          return null;
        }
      } catch (error) {
        console.error('Erreur getById incident:', error.message);
        return null;
      }
    },
    
    getStats: async (userId) => {
      try {
        const response = await api.get(`/incidents/stats/${userId}`);
        return response.data;
      } catch (error) {
        console.error('Erreur getStats:', error.message);
        return { success: false, error: error.message };
      }
    },
    
    getByUser: (userId) => api.get(`/incidents/by-user/${userId}`),
    
    getVoteCount: async (userId) => {
      try {
        const response = await api.get(`/incidents/votes/count/${userId}`);
        return response.data;
      } catch (error) {
        console.error('Erreur getVoteCount:', error.message);
        return { count: 0 };
      }
    },
    
    report: async (incident) => {
      try {
        const { latitude, longitude, type, description } = incident;
        // Vérifier les données obligatoires
        if (!latitude || !longitude || !type) {
          console.error('Données d\'incident incomplètes:', incident);
          throw new Error('Données d\'incident incomplètes');
        }
        
        console.log('Envoi rapport incident:', { type, latitude, longitude, description });
        
        const response = await api.post('/incidents', {
          type,
          description: description || '',
          latitude,
          longitude
        });
        
        // Vérifier si la réponse est valide
        if (response.data && response.data.incident) {
          return response.data.incident;
        } else if (response.data && response.data.id) {
          return response.data;
        } else {
          console.warn('Format de réponse inattendu dans report:', response.data);
          return null;
        }
      } catch (error) {
        console.error('Erreur report incident:', error.message);
        // Pour permettre un fallback en mode hors-ligne, on propage l'erreur
        throw error;
      }
    },
    
    vote: async (incidentId, isConfirmed) => {
      try {
        const response = await api.post(`/incidents/${incidentId}/vote`, {
          is_confirmed: isConfirmed
        });
        
        return response.data;
      } catch (error) {
        console.error('Erreur vote incident:', error.message);
        throw error;
      }
    },
    
    delete: async (incidentId) => {
      try {
        const response = await api.delete(`/incidents/${incidentId}`);
        return response.data;
      } catch (error) {
        console.error('Erreur delete incident:', error.message);
        throw error;
      }
    }
  },
  
  // Itinéraires
  routes: {
    calculate: async (origin, destination, options = {}) => {
      try {
        const response = await api.post('/routes/calculate', {
          origin: {
            coordinates: origin
          },
          destination: {
            coordinates: destination
          },
          options
        });
        return response.data;
      } catch (error) {
        console.error('Erreur calculate route:', error.message);
        throw error;
      }
    },
    
    geocode: async (query, proximity = null) => {
      try {
        let url = `/routes/geocode?query=${encodeURIComponent(query)}`;
        if (proximity) {
          url += `&proximity=${proximity}`;
        }
        const response = await api.get(url);
        return response.data;
      } catch (error) {
        console.error('Erreur geocode:', error.message);
        throw error;
      }
    }
  }
};

export default apiService;