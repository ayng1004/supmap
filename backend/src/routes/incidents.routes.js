const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET tous les incidents
router.get('/', async (req, res) => {
  try {
    // Requête pour récupérer les incidents avec le décompte des votes
    const query = `
      SELECT 
        i.id, 
        i.type, 
        ST_X(i.location::geometry) as longitude, 
        ST_Y(i.location::geometry) as latitude, 
        i.description, 
        i.created_at, 
        i.reported_by, 
        i.active,
        i.reliability_score,
        COALESCE(up_votes.count, 0) as votes_up,
        COALESCE(down_votes.count, 0) as votes_down
      FROM 
        incidents i
      LEFT JOIN (
        SELECT incident_id, COUNT(*) as count 
        FROM incident_votes 
        WHERE is_confirmed = TRUE 
        GROUP BY incident_id
      ) up_votes ON i.id = up_votes.incident_id
      LEFT JOIN (
        SELECT incident_id, COUNT(*) as count 
        FROM incident_votes 
        WHERE is_confirmed = FALSE 
        GROUP BY incident_id
      ) down_votes ON i.id = down_votes.incident_id
      WHERE 
        i.active = TRUE
      ORDER BY 
        i.created_at DESC
    `;
    
    const result = await pool.query(query);
    
    // Transformer les données pour correspondre au format attendu par le frontend
    const incidents = result.rows.map(row => ({
      id: row.id,
      type: row.type,
      location: [row.longitude, row.latitude],
      description: row.description,
      createdAt: row.created_at,
      createdBy: row.reported_by,
      reliability: row.reliability_score,
      votes: {
        up: parseInt(row.votes_up),
        down: parseInt(row.votes_down)
      },
      active: row.active
    }));
    
    res.json(incidents);
  } catch (err) {
    console.error('Erreur lors de la récupération des incidents:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST un nouvel incident
router.post('/', async (req, res) => {
  try {
    const { type, location, description, created_by } = req.body;
    
    // Validation des données
    if (!type || !location || !Array.isArray(location) || location.length !== 2) {
      return res.status(400).json({ error: 'Données invalides' });
    }
    
    // Insertion dans la base de données
    // Aucun utilisateur connecté pour le moment, donc reported_by est null
    const result = await pool.query(
      'INSERT INTO incidents (type, location, description, reported_by, active, reliability_score) VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, NULL, TRUE, 1.0) RETURNING *',
      [type, location[0], location[1], description]
    );
    
    // Transformer la réponse pour le frontend
    const incident = result.rows[0];
    
    // Récupérer les coordonnées
    const geoResult = await pool.query(
      'SELECT ST_X(location::geometry) as lon, ST_Y(location::geometry) as lat FROM incidents WHERE id = $1',
      [incident.id]
    );
    
    res.status(201).json({
      id: incident.id,
      type: incident.type,
      location: [
        parseFloat(geoResult.rows[0].lon), 
        parseFloat(geoResult.rows[0].lat)
      ],
      description: incident.description,
      createdAt: incident.created_at,
      createdBy: incident.reported_by,
      reliability: incident.reliability_score,
      votes: {
        up: 0,
        down: 0
      },
      active: incident.active
    });
  } catch (err) {
    console.error('Erreur lors de la création d\'un incident:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST voter pour un incident
router.post('/:id/votes', async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.body;
    
    if (!type || (type !== 'up' && type !== 'down')) {
      return res.status(400).json({ error: 'Type de vote invalide' });
    }
    
    // Commencer une transaction
    await pool.query('BEGIN');
    
    // Vérifier si l'incident existe
    const incidentCheck = await pool.query(
      'SELECT * FROM incidents WHERE id = $1',
      [id]
    );
    
    if (incidentCheck.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Incident non trouvé' });
    }
    
    // Ajouter le vote (nous n'avons pas d'utilisateur connecté, donc user_id est null)
    // Dans une application réelle, vous devriez vérifier que l'utilisateur n'a pas déjà voté
    
    // Nous utilisons un ID fictif pour l'utilisateur anonyme pour éviter la contrainte UNIQUE
    const anonymousUserId = -1;
    
    // Tentative d'insertion d'un nouveau vote
    await pool.query(
      'INSERT INTO incident_votes (incident_id, user_id, is_confirmed) VALUES ($1, $2, $3) ON CONFLICT (incident_id, user_id) DO UPDATE SET is_confirmed = $3',
      [id, anonymousUserId, type === 'up']
    );
    
    // Mettre à jour le score de fiabilité basé sur les votes
    const votesResult = await pool.query(
      `SELECT 
        COUNT(CASE WHEN is_confirmed = TRUE THEN 1 END) as up_votes,
        COUNT(CASE WHEN is_confirmed = FALSE THEN 1 END) as down_votes
      FROM 
        incident_votes
      WHERE 
        incident_id = $1`,
      [id]
    );
    
    const upVotes = parseInt(votesResult.rows[0].up_votes);
    const downVotes = parseInt(votesResult.rows[0].down_votes);
    const totalVotes = upVotes + downVotes;
    
    // Calculer le score de fiabilité (entre 0 et 1)
    let reliabilityScore = 1.0;
    if (totalVotes > 0) {
      reliabilityScore = upVotes / totalVotes;
    }
    
    // Désactiver l'incident si le score est trop bas
    let isActive = true;
    if (reliabilityScore < 0.3 && totalVotes >= 3) {
      isActive = false;
    }
    
    // Mettre à jour l'incident
    await pool.query(
      'UPDATE incidents SET reliability_score = $1, active = $2 WHERE id = $3',
      [reliabilityScore, isActive, id]
    );
    
    // Récupérer l'incident mis à jour
    const updatedIncident = await pool.query(
      `SELECT 
        i.*, 
        ST_X(i.location::geometry) as longitude, 
        ST_Y(i.location::geometry) as latitude,
        COUNT(CASE WHEN iv.is_confirmed = TRUE THEN 1 END) as votes_up,
        COUNT(CASE WHEN iv.is_confirmed = FALSE THEN 1 END) as votes_down
      FROM 
        incidents i
      LEFT JOIN 
        incident_votes iv ON i.id = iv.incident_id
      WHERE 
        i.id = $1
      GROUP BY 
        i.id`,
      [id]
    );
    
    // Valider la transaction
    await pool.query('COMMIT');
    
    // Transformer la réponse pour le frontend
    const incident = updatedIncident.rows[0];
    res.json({
      id: incident.id,
      type: incident.type,
      location: [
        parseFloat(incident.longitude),
        parseFloat(incident.latitude)
      ],
      description: incident.description,
      createdAt: incident.created_at,
      createdBy: incident.reported_by,
      reliability: incident.reliability_score,
      votes: {
        up: parseInt(incident.votes_up),
        down: parseInt(incident.votes_down)
      },
      active: incident.active
    });
  } catch (err) {
    // Annuler la transaction en cas d'erreur
    await pool.query('ROLLBACK');
    console.error('Erreur lors du vote pour un incident:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET incidents à proximité
router.get('/nearby', async (req, res) => {
  try {
    const { longitude, latitude, radius = 5 } = req.query;
    
    // Validation des paramètres
    if (!longitude || !latitude) {
      return res.status(400).json({ error: 'Coordonnées manquantes' });
    }
    
    // Conversion du rayon de km en mètres
    const radiusInMeters = parseFloat(radius) * 1000;
    
    // Requête pour trouver les incidents à proximité
    const query = `
      SELECT 
        i.id, 
        i.type, 
        ST_X(i.location::geometry) as longitude, 
        ST_Y(i.location::geometry) as latitude, 
        i.description, 
        i.created_at, 
        i.reported_by, 
        i.active,
        i.reliability_score,
        COALESCE(up_votes.count, 0) as votes_up,
        COALESCE(down_votes.count, 0) as votes_down,
        ST_Distance(
          i.location, 
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) as distance
      FROM 
        incidents i
      LEFT JOIN (
        SELECT incident_id, COUNT(*) as count 
        FROM incident_votes 
        WHERE is_confirmed = TRUE 
        GROUP BY incident_id
      ) up_votes ON i.id = up_votes.incident_id
      LEFT JOIN (
        SELECT incident_id, COUNT(*) as count 
        FROM incident_votes 
        WHERE is_confirmed = FALSE 
        GROUP BY incident_id
      ) down_votes ON i.id = down_votes.incident_id
      WHERE 
        i.active = TRUE
        AND ST_DWithin(
          i.location, 
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 
          $3
        )
      ORDER BY 
        distance ASC
    `;
    
    const result = await pool.query(query, [longitude, latitude, radiusInMeters]);
    
    // Transformer les données pour le frontend
    const incidents = result.rows.map(row => ({
      id: row.id,
      type: row.type,
      location: [row.longitude, row.latitude],
      description: row.description,
      createdAt: row.created_at,
      createdBy: row.reported_by,
      reliability: row.reliability_score,
      distance: Math.round(row.distance), // distance en mètres
      votes: {
        up: parseInt(row.votes_up),
        down: parseInt(row.votes_down)
      },
      active: row.active
    }));
    
    res.json(incidents);
  } catch (err) {
    console.error('Erreur lors de la recherche d\'incidents à proximité:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;