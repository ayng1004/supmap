const express = require('express');
const cors = require('cors');
const incidentsRoutes = require('./routes/incidents');

// Autres importations existantes...

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware pour traiter les requêtes JSON
app.use(express.json());

// Configuration CORS pour permettre les requêtes du frontend
app.use(cors({
  origin: '*', // En production, remplacez par les origines autorisées
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Route racine
app.get('/', (req, res) => {
  res.send('API SUPMAP');
});

// Routes pour l'API
app.use('/api/incidents', incidentsRoutes);

// Ajouter vos autres routes existantes ici...

// Middleware de gestion des erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Erreur serveur', error: err.message });
});

// Démarrage du serveur
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});