import axios from 'axios';

// Force HTTPS en production
const API_URL = process.env.NODE_ENV === 'production'
  ? process.env.REACT_APP_API_URL.replace('http://', 'https://') 
  : process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Création de l'instance axios
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

// Fonction pour vérifier si le token est expiré
const isTokenExpired = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp < Date.now() / 1000;
  } catch (e) {
    return true;
  }
};

// Intercepteur pour ajouter le token JWT à chaque requête
api.interceptors.request.use(
  (config) => {
    console.log(`Envoi d'une requête ${config.method} à ${config.baseURL}${config.url}`);
    
    const token = localStorage.getItem('token');
    if (token) {
      if (isTokenExpired(token)) {
        console.log('Token expiré, déconnexion');
        localStorage.removeItem('token');
        window.location.href = '/login';
        return Promise.reject(new Error('Token expiré'));
      }
      config.headers.Authorization = `Bearer ${token}`;
      console.log('Token JWT ajouté aux en-têtes');
    } else {
      console.log('⚠️ Aucun token JWT trouvé, la requête sera non authentifiée');
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Intercepteur pour traiter les erreurs de réponse
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.log(`Erreur ${error.response.status} reçue de ${error.config?.url}:`, error.response.data);
      
      if (error.response.status === 401) {
        console.log('Token expiré ou non valide, suppression du token et redirection vers la page de connexion.');
        localStorage.removeItem('token');
        
        // Optionnel: rediriger vers la page de connexion
        // window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;