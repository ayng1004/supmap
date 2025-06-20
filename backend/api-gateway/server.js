const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const jwt = require('jsonwebtoken');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3001;


app.use((req, res, next) => {
  res.header('Content-Security-Policy', "default-src 'self'");
  res.header('X-XSS-Protection', '1; mode=block');
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('Strict-Transport-Security', 'max-age=31536000');
  next();
});

// 1️⃣ Middleware pour corriger CORS sur toutes les requêtes
// Middleware pour bien accepter CORS avec credentials
app.use((req, res, next) => {
  // Obtenir l'origine de la requête
  const origin = req.headers.origin;
  // Autoriser uniquement les origines spécifiques
  if (origin === 'http://localhost:3000' || origin === 'http://192.168.1.27:3000') {
      res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// 2️⃣ Configuration des proxies 
const authServiceProxy = createProxyMiddleware({
  target: process.env.AUTH_SERVICE_URL || 'http://auth-service:3002',
  changeOrigin: true,
  pathRewrite: { '^/api/auth': '/' }
});


const incidentServiceProxy = createProxyMiddleware({
  target: process.env.INCIDENT_SERVICE_URL || 'http://incident-service:3003',
  changeOrigin: true,
  pathRewrite: { 
    '^/api/incidents/area': '/area',     
    '^/api/incidents': '/incidents'      
  }
});

const routeServiceProxy = createProxyMiddleware({
  target: process.env.ROUTE_SERVICE_URL || 'http://route-service:3004',
  changeOrigin: true,
  pathRewrite: { '^/api/routes': '/' }
});

// 3️⃣ Routes proxy d'abord
app.use('/api/auth', authServiceProxy);
app.use('/api/incidents', incidentServiceProxy);
app.use('/api/routes', routeServiceProxy);


app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));


app.use((req, res, next) => {
  if (req.url.startsWith('/api/auth') || req.url.startsWith('/api/incidents') || req.url.startsWith('/api/routes')) {
    return next();
  }
  express.json()(req, res, next);
});

// Middleware d'authentification JWT
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('JWT verification error:', error);
    next();
  }
};

app.use(verifyToken);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', services: ['auth', 'incidents', 'routes'] });
});

// Documentation API
app.get('/api/docs', (req, res) => {
  res.status(200).json({
    api: {
      version: '1.0.0',
      name: 'API Trafic Routier',
      endpoints: {
        auth: [
          { method: 'POST', path: '/api/auth/register', description: 'Inscription d\'un utilisateur' },
          { method: 'POST', path: '/api/auth/login', description: 'Connexion d\'un utilisateur' },
          { method: 'GET', path: '/api/auth/verify', description: 'Vérification du token JWT' },
          { method: 'PUT', path: '/api/auth/profile', description: 'Mise à jour du profil utilisateur' },
          { method: 'PUT', path: '/api/auth/change-password', description: 'Changer le mot de passe utilisateur' }

        ],
        incidents: [
          { method: 'GET', path: '/api/incidents', description: 'Liste des incidents' },
          { method: 'GET', path: '/api/incidents/area', description: 'Incidents par zone' },
          { method: 'GET', path: '/api/incidents/:id', description: 'Détails d\'un incident' },
          { method: 'GET', path: '/api/incidents/:incidentId/votes/:userId', description: 'Vérifier si un utilisateur a déjà voté' },
          { method: 'POST', path: '/api/incidents', description: 'Créer un incident' },
          { method: 'POST', path: '/api/incidents/:id/vote', description: 'Voter pour un incident' },
          { method: 'DELETE', path: '/api/incidents/:id', description: 'Supprimer un incident' }
        ],
        routes: [
          { method: 'POST', path: '/api/routes/calculate', description: 'Calculer un itinéraire' },
          { method: 'GET', path: '/api/routes/geocode', description: 'Géocoder une adresse' },
          { method: 'POST', path: '/api/routes/save', description: 'Sauvegarder un itinéraire' },
          { method: 'GET', path: '/api/routes/saved', description: 'Voir itinéraires sauvegardés' },
          { method: 'GET', path: '/api/routes/share/:uuid', description: 'Voir un itinéraire partagé' },
          { method: 'DELETE', path: '/api/routes/:id', description: 'Supprimer un itinéraire' }
        ]
      }
    }
  });
});

// Socket.io pour le temps réel
const server = http.createServer(app);
const io = require('socket.io')(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

io.on('connection', (socket) => {
  console.log('Client connecté:', socket.id);

  socket.on('authenticate', (token) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      socket.emit('authenticated');
      console.log('Socket authentifié:', socket.id);
    } catch (error) {
      console.error('Erreur d\'authentification du socket:', error);
      socket.emit('authentication_error', { message: 'Token invalide ou expiré' });
    }
  });

  socket.on('subscribe-area', (bounds) => {
    if (!bounds || !bounds.lat1 || !bounds.lon1 || !bounds.lat2 || !bounds.lon2) {
      return socket.emit('error', { message: 'Paramètres manquants' });
    }
    const areaId = `area:${bounds.lat1},${bounds.lon1},${bounds.lat2},${bounds.lon2}`;
    socket.join(areaId);
    console.log(`Socket ${socket.id} abonné à ${areaId}`);
  });

  socket.on('unsubscribe-area', (bounds) => {
    if (!bounds || !bounds.lat1 || !bounds.lon1 || !bounds.lat2 || !bounds.lon2) {
      return;
    }
    const areaId = `area:${bounds.lat1},${bounds.lon1},${bounds.lat2},${bounds.lon2}`;
    socket.leave(areaId);
    console.log(`Socket ${socket.id} désabonné de ${areaId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client déconnecté:', socket.id);
  });
});

// Lancer le serveur
server.listen(PORT, () => {
  console.log(`API Gateway démarré sur le port ${PORT}`);
});
