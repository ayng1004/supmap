import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.handlers = {
      'new-incident': [],
      'incident-updated': [],
      'incident-removed': []
    };
    this.connected = false;
  }
  
  // Connecter au serveur WebSocket
  connect() {
    if (this.socket) {
      this.disconnect();
    }
    
    const WS_URL = process.env.REACT_APP_WS_URL || 'http://localhost:3001';
    const token = localStorage.getItem('token');
    
    this.socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true
    });
    
    // Événement de connexion
    this.socket.on('connect', () => {
      console.log('Socket connecté:', this.socket.id);
      this.connected = true;
      
      // Authentifier le socket avec le token JWT si disponible
      if (token) {
        this.socket.emit('authenticate', token);
      }
    });
    
    // Événement de déconnexion
    this.socket.on('disconnect', (reason) => {
      console.log('Socket déconnecté:', reason);
      this.connected = false;
    });
    
    // Événements d'erreur
    this.socket.on('connect_error', (error) => {
      console.error('Erreur de connexion socket:', error);
    });
    
    this.socket.on('error', (error) => {
      console.error('Erreur socket:', error);
    });
    
    // Authentification réussie
    this.socket.on('authenticated', () => {
      console.log('Socket authentifié');
    });
    
    // Erreur d'authentification
    this.socket.on('authentication_error', (error) => {
      console.error('Erreur d\'authentification socket:', error);
    });
    
    // Événements d'incidents
    this.socket.on('new-incident', (data) => {
      console.log('Nouvel incident reçu:', data);
      this.handlers['new-incident'].forEach(handler => handler(data));
    });
    
    this.socket.on('incident-updated', (data) => {
      console.log('Incident mis à jour reçu:', data);
      this.handlers['incident-updated'].forEach(handler => handler(data));
    });
    
    this.socket.on('incident-removed', (data) => {
      console.log('Incident supprimé reçu:', data);
      this.handlers['incident-removed'].forEach(handler => handler(data));
    });
    
    return this;
  }
  
  // Déconnecter du serveur WebSocket
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
    return this;
  }
  
  // S'abonner aux incidents dans une zone géographique
  subscribeToArea(bounds) {
    if (!this.socket || !this.connected) {
      this.connect();
    }
    
    this.socket.emit('subscribe-area', bounds);
    return this;
  }
  
  // Se désabonner d'une zone géographique
  unsubscribeFromArea(bounds) {
    if (this.socket && this.connected) {
      this.socket.emit('unsubscribe-area', bounds);
    }
    return this;
  }
  
  // Ajouter un gestionnaire d'événement
  on(event, handler) {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }
    
    this.handlers[event].push(handler);
    return this;
  }
  
  // Supprimer un gestionnaire d'événement
  off(event, handler) {
    if (!this.handlers[event]) {
      return this;
    }
    
    this.handlers[event] = this.handlers[event].filter(h => h !== handler);
    return this;
  }
  
  // Vérifier si le socket est connecté
  isConnected() {
    return this.connected;
  }
}

// Singleton
const socketService = new SocketService();

export default socketService;