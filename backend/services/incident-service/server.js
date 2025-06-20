const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3003;


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
// Assurez-vous que cet endpoint est disponible dans tous vos services (incidents et routes)
app.post('/sync-user', async (req, res) => {
  try {
    // Vérification d'API key optionnelle (pour éviter les problèmes initiaux)
    const apiKey = req.headers.apikey;
    if (apiKey && apiKey !== process.env.INTERNAL_API_KEY) {
      console.warn('Tentative de synchronisation avec une clé API invalide');
      // On continue quand même au lieu de renvoyer une erreur
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

// Fonction de synchronisation des utilisateurs améliorée
const syncUserData = async (userId) => {
  try {
    console.log(`Tentative de synchronisation de l'utilisateur ${userId}`);
    
    // Vérifier si l'utilisateur existe déjà dans notre base
    const existingUser = await pool.query(
      'SELECT id, username FROM users WHERE id = $1',
      [userId]
    );
    
    if (existingUser.rows.length > 0) {
      console.log(`Utilisateur ${userId} déjà présent dans la base locale`);
      return existingUser.rows[0];
    }
    
    console.log(`Utilisateur ${userId} non trouvé localement, création d'un utilisateur temporaire`);
    
    // Créer un utilisateur temporaire sans appel HTTP vers auth-service
    // C'est une solution de contournement immédiate pour éviter les problèmes de communication
    const tempUsername = `temp_user_${userId}`;
    
    // Insérer l'utilisateur temporaire
    const insertResult = await pool.query(
      'INSERT INTO users (id, username, email) VALUES ($1, $2, $3) RETURNING id, username',
      [userId, tempUsername, `temp_${userId}@example.com`]
    );
    
    console.log(`Utilisateur temporaire créé avec succès pour ID ${userId}`);
    return insertResult.rows[0];
  } catch (error) {
    console.error('Erreur lors de la synchronisation de l\'utilisateur:', error);
    throw error;
  }
};

// Dans server.js
// Ajouter cette route qui est compatible avec l'appel du frontend
app.get('/api/stats', async (req, res) => {
  try {
    const totalIncidents = await pool.query('SELECT COUNT(*) FROM incidents');
    const totalVotes = await pool.query('SELECT COUNT(*) FROM incident_votes');

    const topUsers = await pool.query(`
      SELECT u.username, COUNT(i.id) as count
      FROM incidents i
      JOIN users u ON i.reported_by = u.id
      GROUP BY u.username
      ORDER BY count DESC
      LIMIT 5
    `);

    const incidentTypes = await pool.query(`
      SELECT type, COUNT(*) as count
      FROM incidents
      GROUP BY type
    `);

    res.json({
      success: true,
      stats: {
        totalIncidents: parseInt(totalIncidents.rows[0].count),
        totalVotes: parseInt(totalVotes.rows[0].count),
        topUsers: topUsers.rows,
        incidentTypes: incidentTypes.rows
      }
    });
  } catch (error) {
    console.error('Erreur stats :', error);
    res.status(500).json({ success: false, message: 'Erreur lors du calcul des statistiques' });
  }
});

// Ajouter également un endpoint compatible pour les incidents par zone
app.get('/api/incidents/area', async (req, res) => {
  try {
    const { lat1, lon1, lat2, lon2 } = req.query;
    
    if (!lat1 || !lon1 || !lat2 || !lon2) {
      return res.status(400).json({ 
        success: false, 
        message: 'Paramètres manquants: lat1, lon1, lat2, lon2 sont requis' 
      });
    }
    
    // Définir la boîte englobante (bounding box)
    const bbox = `POLYGON((${lon1} ${lat1}, ${lon2} ${lat1}, ${lon2} ${lat2}, ${lon1} ${lat2}, ${lon1} ${lat1}))`;
    
    // Récupérer les incidents dans cette zone
    const incidentsQuery = await pool.query(`
      SELECT 
        i.id, 
        i.type, 
        i.description, 
        ST_AsGeoJSON(i.location)::json as location, 
        i.reported_by, 
        i.reliability_score, 
        i.active,
        i.created_at,
        u.username as reporter_name
      FROM incidents i
      LEFT JOIN users u ON i.reported_by = u.id
      WHERE 
        i.active = true AND 
        ST_Intersects(i.location, ST_GeographyFromText($1))
      ORDER BY i.created_at DESC
    `, [bbox]);
    
    // Formater les incidents pour le frontend
    const incidents = incidentsQuery.rows.map(incident => ({
      id: incident.id,
      type: incident.type,
      description: incident.description,
      location: incident.location.coordinates, // Extraire les coordonnées
      reporter: {
        id: incident.reported_by,
        name: incident.reporter_name
      },
      reliability: incident.reliability_score,
      active: incident.active,
      created_at: incident.created_at
    }));
    
    res.status(200).json({
      success: true,
      incidents
    });
  } catch (error) {
    console.error('Erreur de récupération des incidents par zone:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la récupération des incidents par zone' 
    });
  }
});

// Middleware d'authentification amélioré
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentification requise' 
      });
    }
    
    try {
      // Vérifier le token JWT
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      try {
        // Synchroniser l'utilisateur
        req.user = await syncUserData(decoded.id);
        next();
      } catch (syncError) {
        // En cas d'erreur de synchronisation, utiliser les données du token pour continuer
        console.error('Erreur lors de la synchronisation utilisateur, utilisation des données du token:', syncError);
        
        // Utiliser les informations du token comme fallback
        req.user = {
          id: decoded.id,
          username: decoded.email ? decoded.email.split('@')[0] : `user_${decoded.id}`
        };
        
        // Continuer l'exécution même avec l'erreur de synchronisation
        next();
      }
    } catch (jwtError) {
      console.error('Erreur JWT:', jwtError);
      
      if (jwtError.name === 'JsonWebTokenError' || jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          success: false, 
          message: 'Token invalide ou expiré' 
        });
      }
      
      return res.status(500).json({ 
        success: false, 
        message: 'Erreur d\'authentification' 
      });
    }
  } catch (error) {
    console.error('Erreur globale d\'authentification:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur d\'authentification' 
    });
  }
};
const hasUserVoted = async (req, res) => {
  try {
    const { incidentId, userId } = req.params;
    
    // Vérifier que les IDs sont valides
    if (!incidentId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Identifiants d\'incident et d\'utilisateur requis'
      });
    }
    
    // Rechercher un vote existant dans la base de données
    const query = `
      SELECT * FROM incident_votes 
      WHERE incident_id = $1 AND user_id = $2
    `;
    
    const result = await pool.query(query, [incidentId, userId]);
    
    // Si un vote a été trouvé, retourner true
    if (result.rows.length > 0) {
      return res.status(200).json({
        hasVoted: true,
        voteType: result.rows[0].is_confirmed ? 'up' : 'down'
      });
    }
    
    // Sinon, retourner false
    return res.status(200).json({
      hasVoted: false
    });
    
  } catch (error) {
    console.error('Erreur lors de la vérification du vote:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la vérification du vote'
    });
  }
};
// Fonction pour notifier l'API Gateway des événements
const notifyGateway = async (event, data) => {
  try {
    await axios.post(`${process.env.API_GATEWAY_URL}/internal/events`, {
      event,
      data
    });
    console.log('Notification envoyée à l\'API Gateway:', event);
  } catch (error) {
    console.error('Erreur lors de la notification à l\'API Gateway:', error);
  }
};
app.get('/stats', async (req, res) => {
  try {
    const totalIncidents = await pool.query('SELECT COUNT(*) FROM incidents');
    const totalVotes = await pool.query('SELECT COUNT(*) FROM incident_votes');

    const topUsers = await pool.query(`
      SELECT u.username, COUNT(i.id) as count
      FROM incidents i
      JOIN users u ON i.reported_by = u.id
      GROUP BY u.username
      ORDER BY count DESC
      LIMIT 5
    `);

    const incidentTypes = await pool.query(`
      SELECT type, COUNT(*) as count
      FROM incidents
      GROUP BY type
    `);

    res.json({
      success: true,
      stats: {
        totalIncidents: parseInt(totalIncidents.rows[0].count),
        totalVotes: parseInt(totalVotes.rows[0].count),
        topUsers: topUsers.rows,
        incidentTypes: incidentTypes.rows
      }
    });
  } catch (error) {
    console.error('Erreur stats :', error);
    res.status(500).json({ success: false, message: 'Erreur lors du calcul des statistiques' });
  }
});

// Routes pour les incidents
app.get('/', async (req, res) => {
  try {
    const incidentsQuery = await pool.query(`
      SELECT 
        i.id, 
        i.type, 
        i.description, 
        ST_AsGeoJSON(i.location)::json as location, 
        i.reported_by, 
        i.reliability_score, 
        i.active,
        i.created_at,
        u.username as reporter_name
      FROM incidents i
      LEFT JOIN users u ON i.reported_by = u.id
      WHERE i.active = true
      ORDER BY i.created_at DESC
    `);
    
    // Formater les incidents pour le frontend
    const incidents = incidentsQuery.rows.map(incident => ({
      id: incident.id,
      type: incident.type,
      description: incident.description,
      location: incident.location.coordinates, // Extraire les coordonnées
      reporter: {
        id: incident.reported_by,
        name: incident.reporter_name
      },
      reliability: incident.reliability_score,
      active: incident.active,
      created_at: incident.created_at
    }));
    
    res.status(200).json({
      success: true,
      incidents
    });
  } catch (error) {
    console.error('Erreur de récupération des incidents:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la récupération des incidents' 
    });
  }
});

app.get('/area', async (req, res) => {
  try {
    const { lat1, lon1, lat2, lon2 } = req.query;
    
    if (!lat1 || !lon1 || !lat2 || !lon2) {
      return res.status(400).json({ 
        success: false, 
        message: 'Paramètres manquants: lat1, lon1, lat2, lon2 sont requis' 
      });
    }
    
    // Définir la boîte englobante (bounding box)
    const bbox = `POLYGON((${lon1} ${lat1}, ${lon2} ${lat1}, ${lon2} ${lat2}, ${lon1} ${lat2}, ${lon1} ${lat1}))`;
    
    // Récupérer les incidents dans cette zone
    const incidentsQuery = await pool.query(`
      SELECT 
        i.id, 
        i.type, 
        i.description, 
        ST_AsGeoJSON(i.location)::json as location, 
        i.reported_by, 
        i.reliability_score, 
        i.active,
        i.created_at,
        u.username as reporter_name
      FROM incidents i
      LEFT JOIN users u ON i.reported_by = u.id
      WHERE 
        i.active = true AND 
        ST_Intersects(i.location, ST_GeographyFromText($1))
      ORDER BY i.created_at DESC
    `, [bbox]);
    
    // Formater les incidents pour le frontend
    const incidents = incidentsQuery.rows.map(incident => ({
      id: incident.id,
      type: incident.type,
      description: incident.description,
      location: incident.location.coordinates, // Extraire les coordonnées
      reporter: {
        id: incident.reported_by,
        name: incident.reporter_name
      },
      reliability: incident.reliability_score,
      active: incident.active,
      created_at: incident.created_at
    }));
    
    res.status(200).json({
      success: true,
      incidents
    });
  } catch (error) {
    console.error('Erreur de récupération des incidents par zone:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la récupération des incidents par zone' 
    });
  }
});
app.get('/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const incidentCount = await pool.query(
      'SELECT COUNT(*) FROM incidents WHERE reported_by = $1',
      [userId]
    );

    const voteCount = await pool.query(
      'SELECT COUNT(*) FROM incident_votes WHERE user_id = $1',
      [userId]
    );

    const incidentsReported = parseInt(incidentCount.rows[0].count);
    const votesCast = parseInt(voteCount.rows[0].count);

    // Générer les badges
    const incidentBadges = [];
    const voteBadges = [];

    if (incidentsReported >= 10) incidentBadges.push("10+ incidents");
    if (incidentsReported >= 20) incidentBadges.push("20+ incidents");
    if (incidentsReported >= 30) incidentBadges.push("30+ incidents");

    if (votesCast >= 10) voteBadges.push("10+ votes");
    if (votesCast >= 20) voteBadges.push("20+ votes");
    if (votesCast >= 30) voteBadges.push("30+ votes");

    return res.json({
      success: true,
      stats: {
        incidentsReported,
        votesCast,
        badges: {
          incidents: incidentBadges,
          votes: voteBadges
        }
      }
    });
  } catch (error) {
    console.error('Erreur récupération stats :', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// --- ROUTES INCIDENTS ---

// GET tous les incidents
app.get('/incidents', async (req, res) => {
  try {
    const query = await pool.query(`
      SELECT 
        i.id, i.type, i.description, ST_AsGeoJSON(i.location)::json as location,
        i.reported_by, i.reliability_score, i.active, i.created_at,
        u.username as reporter_name
      FROM incidents i
      LEFT JOIN users u ON i.reported_by = u.id
      WHERE i.active = true
      ORDER BY i.created_at DESC
    `);

    const incidents = query.rows.map(incident => ({
      id: incident.id,
      type: incident.type,
      description: incident.description,
      location: incident.location.coordinates,
      reporter: {
        id: incident.reported_by,
        name: incident.reporter_name
      },
      reliability: incident.reliability_score,
      active: incident.active,
      created_at: incident.created_at
    }));

    res.json({ success: true, incidents });
  } catch (error) {
    console.error('Erreur GET incidents:', error);
    res.status(500).json({ success: false, message: 'Erreur récupération incidents' });
  }
});

// POST un nouvel incident
app.post('/incidents', authenticate, async (req, res) => {
  try {
    const { type, description, latitude, longitude } = req.body;
    if (!type || !latitude || !longitude) {
      return res.status(400).json({ success: false, message: 'Type, latitude et longitude requis' });
    }

    const point = `POINT(${longitude} ${latitude})`;

    const insert = await pool.query(`
      INSERT INTO incidents (type, description, location, reported_by, active, reliability_score)
      VALUES ($1, $2, ST_GeographyFromText($3), $4, true, 1.0)
      RETURNING id, type, description, reported_by, reliability_score, active, created_at
    `, [type, description || '', point, req.user.id]);

    const incident = {
      ...insert.rows[0],
      location: [longitude, latitude],
      reporter: {
        id: req.user.id,
        name: req.user.username
      }
    };

    res.status(201).json({ success: true, incident });
  } catch (error) {
    console.error('Erreur POST incident:', error);
    res.status(500).json({ success: false, message: 'Erreur création incident' });
  }
});

// POST un vote
app.post('/incidents/:id/vote', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_confirmed } = req.body;
    if (typeof is_confirmed !== 'boolean') return res.status(400).json({ success: false, message: 'is_confirmed requis' });

    const exists = await pool.query('SELECT * FROM incidents WHERE id = $1', [id]);
    if (exists.rows.length === 0) return res.status(404).json({ success: false, message: 'Incident non trouvé' });

    const vote = await pool.query(
      'SELECT * FROM incident_votes WHERE incident_id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    const votesCounts = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN is_confirmed = true THEN 1 ELSE 0 END), 0) as votes_up,
        COALESCE(SUM(CASE WHEN is_confirmed = false THEN 1 ELSE 0 END), 0) as votes_down
      FROM incident_votes
      WHERE incident_id = $1
    `, [id]);

    const up = parseInt(votesCounts.rows[0].votes_up);
    const down = parseInt(votesCounts.rows[0].votes_down);
    




    if (vote.rows.length > 0) {
      await pool.query(
        'UPDATE incident_votes SET is_confirmed = $1 WHERE incident_id = $2 AND user_id = $3',
        [is_confirmed, id, req.user.id]
      );
    } else {
      await pool.query(
        'INSERT INTO incident_votes (incident_id, user_id, is_confirmed) VALUES ($1, $2, $3)',
        [id, req.user.id, is_confirmed]
      );
    }

    const votes = await pool.query('SELECT is_confirmed FROM incident_votes WHERE incident_id = $1', [id]);
    const total = votes.rows.length;
    const confirmed = votes.rows.filter(v => v.is_confirmed).length;
    const score = total ? confirmed / total : 1.0;
    const active = !(score < 0.2 && total >= 5);

    await pool.query(
      'UPDATE incidents SET reliability_score = $1, active = $2 WHERE id = $3',
      [score, active, id]
    );

    res.json({ 
      success: true, 
      reliability: score, 
      active,
      votes: { up, down }
    });
  } catch (error) {
    console.error('Erreur vote:', error);
    res.status(500).json({ success: false, message: 'Erreur lors du vote' });
  }
});

// DELETE un incident - MODIFIÉ pour permettre aux admins de supprimer
app.delete('/incidents/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Récupérer l'incident
    const incident = await pool.query('SELECT * FROM incidents WHERE id = $1', [id]);
    if (!incident.rows.length) {
      return res.status(404).json({ success: false, message: 'Incident non trouvé' });
    }
    
    // Vérifier si l'utilisateur est admin en récupérant ses infos depuis le service d'auth
    let isAdmin = false;
    try {
      const authResponse = await axios.get('/verify', {
        baseURL: process.env.AUTH_SERVICE_URL || 'http://auth-service:3002',
        headers: { 
          Authorization: `Bearer ${req.headers.authorization?.split(' ')[1]}` 
        }
      });
      
      const userInfo = authResponse.data.user;
      // Vérifier si l'utilisateur est admin (role_id === 1 ou role_name === 'Admin')
      isAdmin = userInfo && (userInfo.role_id === 1 || userInfo.role_name === 'Admin');
    } catch (error) {
      console.error('Erreur lors de la vérification du rôle admin:', error);
      // En cas d'erreur, on suppose que l'utilisateur n'est pas admin
      isAdmin = false;
    }
    
    // Si l'utilisateur n'est ni admin ni l'auteur de l'incident, refuser la suppression
    if (!isAdmin && incident.rows[0].reported_by !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        message: 'Non autorisé à supprimer cet incident' 
      });
    }
    
    // Si admin: supprimer complètement l'incident
    if (isAdmin) {
      // Supprimer d'abord les votes associés pour éviter les contraintes de clé étrangère
      await pool.query('DELETE FROM incident_votes WHERE incident_id = $1', [id]);
      // Supprimer l'incident
      await pool.query('DELETE FROM incidents WHERE id = $1', [id]);
      
      return res.json({ 
        success: true, 
        message: 'Incident supprimé définitivement par administrateur' 
      });
    } 
    // Si auteur: marquer comme inactif (comportement actuel)
    else {
      await pool.query('UPDATE incidents SET active = false WHERE id = $1', [id]);
      
      return res.json({ 
        success: true, 
        message: 'Incident désactivé' 
      });
    }
  } catch (error) {
    console.error('Erreur suppression:', error);
    res.status(500).json({ success: false, message: 'Erreur suppression incident' });
  }
});

app.get('/incidents/by-user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(`
      SELECT 
        i.id, i.type, i.description, ST_AsGeoJSON(i.location)::json as location,
        i.reported_by, i.reliability_score, i.active, i.created_at,
        u.username as reporter_name
      FROM incidents i
      LEFT JOIN users u ON i.reported_by = u.id
      WHERE i.reported_by = $1
      ORDER BY i.created_at DESC
    `, [userId]);

    const incidents = result.rows.map(incident => ({
      id: incident.id,
      type: incident.type,
      description: incident.description,
      location: incident.location.coordinates,
      reporter: {
        id: incident.reported_by,
        name: incident.reporter_name
      },
      reliability: incident.reliability_score,
      active: incident.active,
      created_at: incident.created_at
    }));

    res.json({ success: true, incidents });
  } catch (error) {
    console.error('Erreur incidents utilisateur:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET un incident par ID
app.get('/incidents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = await pool.query(`
      SELECT 
        i.id, i.type, i.description, ST_AsGeoJSON(i.location)::json as location,
        i.reported_by, i.reliability_score, i.active, i.created_at,
        u.username as reporter_name,
        COALESCE(
          (SELECT COUNT(*) FROM incident_votes WHERE incident_id = i.id AND is_confirmed = true),
          0
        ) as votes_up,
        COALESCE(
          (SELECT COUNT(*) FROM incident_votes WHERE incident_id = i.id AND is_confirmed = false),
          0
        ) as votes_down
      FROM incidents i
      LEFT JOIN users u ON i.reported_by = u.id
      WHERE i.id = $1
    `, [id]);

    if (query.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Incident non trouvé' });
    }

    const incident = {
      ...query.rows[0],
      location: query.rows[0].location.coordinates,
      reporter: {
        id: query.rows[0].reported_by,
        name: query.rows[0].reporter_name
      },
      votes: {
        up: parseInt(query.rows[0].votes_up) || 0,
        down: parseInt(query.rows[0].votes_down) || 0
      }
    };

    // Supprimer les propriétés redondantes
    delete incident.reporter_name;
    delete incident.reported_by;
    delete incident.votes_up;
    delete incident.votes_down;

    res.json({ success: true, incident });
  } catch (error) {
    console.error('Erreur GET incident par ID:', error);
    res.status(500).json({ success: false, message: 'Erreur récupération incident' });
  }
});
// GET /api/incidents/stats/:userId
app.get('/incidents/stats/:userId', async (req, res) => {
  const { userId } = req.params;

  const incidentCount = await pool.query(
    'SELECT COUNT(*) FROM incidents WHERE reported_by = $1',
    [userId]
  );

  const voteCount = await pool.query(
    'SELECT COUNT(*) FROM incident_votes WHERE user_id = $1',
    [userId]
  );

  const incidentsReported = parseInt(incidentCount.rows[0].count);
  const votesCast = parseInt(voteCount.rows[0].count);

  const incidentBadges = [];
  const voteBadges = [];

  if (incidentsReported >= 10) incidentBadges.push("10+ incidents");
  if (incidentsReported >= 20) incidentBadges.push("20+ incidents");
  if (incidentsReported >= 30) incidentBadges.push("30+ incidents");

  if (votesCast >= 10) voteBadges.push("10+ votes");
  if (votesCast >= 20) voteBadges.push("20+ votes");
  if (votesCast >= 30) voteBadges.push("30+ votes");

  return res.json({
    success: true,
    stats: {
      incidentsReported,
      votesCast,
      badges: {
        incidents: incidentBadges,
        votes: voteBadges
      }
    }
  });
});

// GET /api/incidents/votes/count/:userId
app.get('/incidents/votes/count/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await pool.query(
      'SELECT COUNT(*) FROM incident_votes WHERE user_id = $1',
      [userId]
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Erreur lors du comptage des votes:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route pour vérifier si un utilisateur a déjà voté sur un incident
app.get('/incidents/:incidentId/votes/:userId', authenticate, async (req, res) => {
  try {
    const { incidentId, userId } = req.params;
    
    // Vérifier que les IDs sont valides
    if (!incidentId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Identifiants d\'incident et d\'utilisateur requis'
      });
    }
    
    // Rechercher un vote existant dans la base de données
    const query = `
      SELECT * FROM incident_votes 
      WHERE incident_id = $1 AND user_id = $2
    `;
    
    const result = await pool.query(query, [incidentId, userId]);
    
    // Si un vote a été trouvé, retourner true
    if (result.rows.length > 0) {
      return res.status(200).json({
        hasVoted: true,
        voteType: result.rows[0].is_confirmed ? 'up' : 'down'
      });
    }
    
    // Sinon, retourner false
    return res.status(200).json({
      hasVoted: false
    });
    
  } catch (error) {
    console.error('Erreur lors de la vérification du vote:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la vérification du vote'
    });
  }
});



// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Service d'incidents démarré sur le port ${PORT}`);
});
