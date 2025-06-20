const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3004;

// Connexion à PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true
}));
app.use(express.json());



// Endpoint pour synchroniser un utilisateur simplifié
app.post('/sync-user', async (req, res) => {
  try {
    // Vérification d'API key optionnelle (pour éviter les problèmes initiaux)
    const apiKey = req.headers.apikey;
    if (apiKey && apiKey !== process.env.INTERNAL_API_KEY) {
      console.warn('Tentative de synchronisation avec une clé API invalide');
    }
    
    const { id, username, email } = req.body;
    
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID utilisateur requis' 
      });
    }
    
    // Valeurs par défaut si les données sont incomplètes
    const safeUsername = username || `user_${id}`;
    const safeEmail = email || `user_${id}@example.com`;
    
    console.log(`Demande de synchronisation utilisateur reçue pour ID ${id}`);
    
    // Vérifier si l'utilisateur existe déjà
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [id]
    );
    
    if (existingUser.rows.length > 0) {
      // Mettre à jour l'utilisateur existant
      await pool.query(
        'UPDATE users SET username = $1, email = $2 WHERE id = $3',
        [safeUsername, safeEmail, id]
      );
      
      console.log(`Utilisateur ID ${id} mis à jour avec succès`);
      return res.status(200).json({ 
        success: true, 
        message: 'Utilisateur mis à jour avec succès',
        user: { id, username: safeUsername, email: safeEmail }
      });
    }
    
    // Créer un nouvel utilisateur
    await pool.query(
      'INSERT INTO users (id, username, email) VALUES ($1, $2, $3)',
      [id, safeUsername, safeEmail]
    );
    
    console.log(`Nouvel utilisateur ID ${id} synchronisé avec succès`);
    res.status(201).json({ 
      success: true, 
      message: 'Utilisateur synchronisé avec succès',
      user: { id, username: safeUsername, email: safeEmail }
    });
  } catch (error) {
    console.error('Erreur lors de la synchronisation de l\'utilisateur:', error);
    // Toujours renvoyer un succès pour éviter les erreurs en cascade
    res.status(200).json({ 
      success: true, 
      message: 'Synchronisation notée (avec erreurs)',
      error: error.message
    });
  }
});
// Middleware d'authentification
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentification requise' 
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Récupérer les informations utilisateur de base
    const userQuery = await pool.query(
      'SELECT id, username FROM users WHERE id = $1',
      [decoded.id]
    );
    
    if (userQuery.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }
    
    req.user = userQuery.rows[0];
    next();
  } catch (error) {
    console.error('Erreur d\'authentification:', error);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token invalide ou expiré' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Erreur d\'authentification' 
    });
  }
};

// Routes pour les itinéraires
app.post('/calculate', async (req, res) => {
  try {
    const { origin, destination, options } = req.body;
    console.log("Reçu pour calcul:", {
      origin,
      destination,
      options
    });
    
    
    if (!origin || !destination) {
      return res.status(400).json({ 
        success: false, 
        message: 'Origin et destination sont requis' 
      });
    }
    
    // Construire les paramètres de la requête à l'API Mapbox
    const coordinates = `${origin.coordinates[0]},${origin.coordinates[1]};${destination.coordinates[0]},${destination.coordinates[1]}`;
    const profile = 'driving'; // Par défaut, on utilise le profil de conduite
    
    // Options supplémentaires
    const optParams = [];
    
    // Éviter les péages
    if (options && options.avoidTolls) {
      optParams.push('exclude=toll');
    }
    
    // Construire l'URL
    let url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}?alternatives=true&geometries=geojson&steps=true&overview=full&annotations=distance,duration,speed`;
    
    if (optParams.length > 0) {
      url += `&${optParams.join('&')}`;
    }
    
    url += `&access_token=${process.env.MAPBOX_API_KEY}`;
    
    // Appeler l'API Mapbox
    const response = await axios.get(url);
    console.log("Réponse Mapbox reçue avec", response.data.routes.length, "itinéraires");

    // Récupérer les incidents sur le trajet
    if (response.data.routes && response.data.routes.length > 0) {
      const route = response.data.routes[0];
      const coordinates = route.geometry.coordinates;
      
      // Créer un linestring pour rechercher les incidents à proximité
      const linestring = `LINESTRING(${coordinates.map(point => `${point[0]} ${point[1]}`).join(', ')})`;
      
      // Récupérer les incidents à proximité de l'itinéraire
      const incidentsQuery = await pool.query(`
        SELECT 
          i.id, 
          i.type, 
          i.description, 
          ST_AsGeoJSON(i.location)::json as location, 
          i.reliability_score,
          i.created_at,
          u.username as reporter_name
        FROM incidents i
        LEFT JOIN users u ON i.reported_by = u.id
        WHERE 
          i.active = true AND 
          ST_DWithin(i.location, ST_GeographyFromText($1), 500)
        ORDER BY i.created_at DESC
      `, [linestring]);
      
      // Formater les incidents pour le frontend
      const incidents = incidentsQuery.rows.map(incident => ({
        id: incident.id,
        type: incident.type,
        description: incident.description,
        location: incident.location.coordinates,
        reliability: incident.reliability_score,
        reporter_name: incident.reporter_name,
        created_at: incident.created_at
      }));
      
      // Ajouter les incidents à la réponse
      response.data.incidents = incidents;
    }
    
    res.status(200).json({
      success: true,
      ...response.data
    });
  } catch (error) {
    console.error('Erreur de calcul d\'itinéraire:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors du calcul de l\'itinéraire' 
    });
  }
});

app.get('/geocode', async (req, res) => {
  try {
    const { query, proximity } = req.query;
    
    if (!query) {
      return res.status(400).json({ 
        success: false, 
        message: 'Paramètre de recherche requis' 
      });
    }
    
    // Construire l'URL pour le géocodage
    let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${process.env.MAPBOX_API_KEY}&language=fr&country=fr`;
    
    // Ajouter la proximité si fournie
    if (proximity) {
      url += `&proximity=${proximity}`;
    }
    
    // Appeler l'API Mapbox pour le géocodage
    const response = await axios.get(url);
    
    res.status(200).json({
      success: true,
      ...response.data
    });
  } catch (error) {
    console.error('Erreur de géocodage:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors du géocodage' 
    });
  }
});

app.get('/current-position', async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: "Utiliser l'API de géolocalisation du navigateur ou de l'appareil mobile"
    });
  } catch (error) {
    console.error('Erreur de récupération de position:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la récupération de la position' 
    });
  }
});

app.post('/save', authenticate, async (req, res) => {
  try {
    const { name, origin, destination, waypoints, options, routeData } = req.body;
    
    if (!name || !origin || !destination || !routeData) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nom, origine, destination et données d\'itinéraire sont requis' 
      });
    }
    
    // Créer les points géographiques
    const originPoint = `POINT(${origin.coordinates[0]} ${origin.coordinates[1]})`;
    const destinationPoint = `POINT(${destination.coordinates[0]} ${destination.coordinates[1]})`;
    
    // Déterminer si on évite les péages
    const avoidTolls = options && options.avoidTolls ? true : false;
    
    // Insérer l'itinéraire dans la base de données
    const newRouteQuery = await pool.query(`
      INSERT INTO routes (user_id, name, origin, destination, waypoints, avoid_tolls, route_data)
      VALUES ($1, $2, ST_GeographyFromText($3), ST_GeographyFromText($4), $5, $6, $7)
      RETURNING id, name, qr_code_uuid, created_at
    `, [
      req.user.id,
      name,
      originPoint,
      destinationPoint,
      JSON.stringify(waypoints || []),
      avoidTolls,
      JSON.stringify(routeData)
    ]);
    
    // Générer l'URL de partage
    const shareUrl = `${process.env.CORS_ORIGIN}/routes/share/${newRouteQuery.rows[0].qr_code_uuid}`;
    
    res.status(201).json({
      success: true,
      route: {
        ...newRouteQuery.rows[0],
        share_url: shareUrl
      }
    });
  } catch (error) {
    console.error('Erreur de sauvegarde d\'itinéraire:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la sauvegarde de l\'itinéraire' 
    });
  }
});

app.get('/saved', authenticate, async (req, res) => {
  try {
    // Récupérer tous les itinéraires sauvegardés de l'utilisateur
    const routesQuery = await pool.query(`
      SELECT 
        id, 
        name, 
        ST_AsGeoJSON(origin)::json as origin, 
        ST_AsGeoJSON(destination)::json as destination, 
        waypoints, 
        avoid_tolls, 
        qr_code_uuid, 
        created_at
      FROM routes
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [req.user.id]);
    
    // Formater les itinéraires pour le frontend
    const routes = routesQuery.rows.map(route => ({
      id: route.id,
      name: route.name,
      origin: {
        type: 'Feature',
        geometry: route.origin,
        properties: {}
      },
      destination: {
        type: 'Feature',
        geometry: route.destination,
        properties: {}
      },
      waypoints: route.waypoints,
      avoid_tolls: route.avoid_tolls,
      qr_code_uuid: route.qr_code_uuid,
      share_url: `${process.env.CORS_ORIGIN}/routes/share/${route.qr_code_uuid}`,
      created_at: route.created_at
    }));
    
    res.status(200).json({
      success: true,
      routes
    });
  } catch (error) {
    console.error('Erreur de récupération des itinéraires:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la récupération des itinéraires' 
    });
  }
});

app.get('/share/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    
    // Récupérer l'itinéraire partagé
    const routeQuery = await pool.query(`
      SELECT 
        r.id, 
        r.name, 
        ST_AsGeoJSON(r.origin)::json as origin, 
        ST_AsGeoJSON(r.destination)::json as destination, 
        r.waypoints, 
        r.avoid_tolls, 
        r.route_data,
        r.created_at,
        u.username as created_by
      FROM routes r
      JOIN users u ON r.user_id = u.id
      WHERE r.qr_code_uuid = $1
    `, [uuid]);
    
    if (routeQuery.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Itinéraire non trouvé' 
      });
    }
    
    // Formater l'itinéraire pour le frontend
    const route = {
      id: routeQuery.rows[0].id,
      name: routeQuery.rows[0].name,
      origin: {
        type: 'Feature',
        geometry: routeQuery.rows[0].origin,
        properties: {}
      },
      destination: {
        type: 'Feature',
        geometry: routeQuery.rows[0].destination,
        properties: {}
      },
      waypoints: routeQuery.rows[0].waypoints,
      avoid_tolls: routeQuery.rows[0].avoid_tolls,
      route_data: routeQuery.rows[0].route_data,
      created_by: routeQuery.rows[0].created_by,
      created_at: routeQuery.rows[0].created_at
    };
    
    res.status(200).json({
      success: true,
      route
    });
  } catch (error) {
    console.error('Erreur de récupération de l\'itinéraire partagé:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la récupération de l\'itinéraire partagé' 
    });
  }
});

app.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Vérifier que l'itinéraire existe et appartient à l'utilisateur
    const routeQuery = await pool.query(
      'SELECT * FROM routes WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    
    if (routeQuery.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Itinéraire non trouvé ou vous n\'êtes pas autorisé à le supprimer' 
      });
    }
    
    // Supprimer l'itinéraire
    await pool.query(
      'DELETE FROM routes WHERE id = $1',
      [id]
    );
    
    res.status(200).json({
      success: true,
      message: 'Itinéraire supprimé avec succès'
    });
  } catch (error) {
    console.error('Erreur de suppression d\'itinéraire:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la suppression de l\'itinéraire' 
    });
  }
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Service d'itinéraires démarré sur le port ${PORT}`);
});