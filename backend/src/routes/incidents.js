const express = require('express');
const router = express.Router();
const pool = require('../db'); // Connexion à la base de données

// Au début du fichier, ajoutez:
router.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  console.log('Headers:', JSON.stringify(req.headers));
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', JSON.stringify(req.body));
  }
  next();
});
/**
 * @route GET /api/incidents
 * @desc Récupérer tous les incidents actifs
 */
router.get('/', async (req, res) => {
  try {
    // Requête SQL pour récupérer les incidents avec décompte des votes
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
        COALESCE(
          (SELECT COUNT(*) FROM incident_votes WHERE incident_id = i.id AND is_confirmed = true), 
          0
        ) as votes_up,
        COALESCE(
          (SELECT COUNT(*) FROM incident_votes WHERE incident_id = i.id AND is_confirmed = false), 
          0
        ) as votes_down
      FROM 
        incidents i
      WHERE 
        i.active = true
      ORDER BY 
        i.created_at DESC
    `;
    
    const result = await pool.query(query);
    
    // Formater la réponse pour le frontend
    const incidents = result.rows.map(row => ({
      id: row.id,
      type: row.type,
      location: [parseFloat(row.longitude), parseFloat(row.latitude)],
      description: row.description,
      createdAt: row.created_at,
      createdBy: row.reported_by,
      votes: {
        up: parseInt(row.votes_up),
        down: parseInt(row.votes_down)
      },
      active: row.active
    }));
    
    res.json(incidents);
  } catch (err) {
    console.error('Erreur lors de la récupération des incidents:', err);
    res.status(500).json({ message: 'Erreur serveur lors de la récupération des incidents' });
  }
});

/**
 * @route POST /api/incidents
 * @desc Créer un nouvel incident
 */
router.post('/', async (req, res) => {
  try {
    const { type, location, description } = req.body;
    
    // Validation des données
    if (!type || !location || !Array.isArray(location) || location.length !== 2) {
      return res.status(400).json({ message: 'Données invalides. Type et location sont requis.' });
    }
    
    // Insertion dans la base de données
    const query = `
      INSERT INTO incidents (
        type, location, description, reported_by, active
      ) VALUES (
        $1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, NULL, true
      ) RETURNING id
    `;
    
    const result = await pool.query(query, [
      type, 
      location[0], // longitude
      location[1], // latitude
      description || ''
    ]);
    
    const incidentId = result.rows[0].id;
    
    // Récupérer l'incident complet
    const getIncidentQuery = `
      SELECT 
        i.id, 
        i.type, 
        ST_X(i.location::geometry) as longitude, 
        ST_Y(i.location::geometry) as latitude, 
        i.description, 
        i.created_at, 
        i.reported_by, 
        i.active
      FROM 
        incidents i
      WHERE 
        i.id = $1
    `;
    
    const incidentResult = await pool.query(getIncidentQuery, [incidentId]);
    
    if (incidentResult.rows.length === 0) {
      return res.status(500).json({ message: "Impossible de récupérer l'incident créé" });
    }
    
    const incident = incidentResult.rows[0];
    
    // Formater la réponse pour le frontend
    res.status(201).json({
      id: incident.id,
      type: incident.type,
      location: [parseFloat(incident.longitude), parseFloat(incident.latitude)],
      description: incident.description,
      createdAt: incident.created_at,
      createdBy: incident.reported_by,
      votes: {
        up: 0,
        down: 0
      },
      active: incident.active
    });
  } catch (err) {
    console.error('Erreur lors de la création d\'un incident:', err);
    res.status(500).json({ message: 'Erreur serveur lors de la création de l\'incident' });
  }
});

/**
 * @route POST /api/incidents/:id/votes
 * @desc Voter pour un incident
 */
router.post('/:id/votes', async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.body;
    
    // Validation des données
    if (!type || (type !== 'up' && type !== 'down')) {
      return res.status(400).json({ message: 'Type de vote invalide' });
    }
    
    // Vérifier si l'incident existe
    const checkQuery = 'SELECT * FROM incidents WHERE id = $1';
    const checkResult = await pool.query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Incident non trouvé' });
    }
    
    // Générer un ID anonyme unique pour éviter les doublons de votes
    const anonymousId = -1;
    
    // Insérer le vote
    const voteQuery = `
      INSERT INTO incident_votes (incident_id, user_id, is_confirmed)
      VALUES ($1, $2, $3)
      ON CONFLICT (incident_id, user_id) 
      DO UPDATE SET is_confirmed = $3
    `;
    
    await pool.query(voteQuery, [id, anonymousId, type === 'up']);
    
    // Récupérer les décomptes de votes
    const votesQuery = `
      SELECT 
        (SELECT COUNT(*) FROM incident_votes WHERE incident_id = $1 AND is_confirmed = true) as up_votes,
        (SELECT COUNT(*) FROM incident_votes WHERE incident_id = $1 AND is_confirmed = false) as down_votes
    `;
    
    const votesResult = await pool.query(votesQuery, [id]);
    const upVotes = parseInt(votesResult.rows[0].up_votes);
    const downVotes = parseInt(votesResult.rows[0].down_votes);
    
    // Déterminer si l'incident doit être désactivé
    let shouldDeactivate = false;
    if (downVotes >= 3 && downVotes > upVotes) {
      shouldDeactivate = true;
      
      // Mettre à jour le statut de l'incident
      await pool.query('UPDATE incidents SET active = false WHERE id = $1', [id]);
    }
    
    // Récupérer l'incident mis à jour
    const incidentQuery = `
      SELECT 
        i.id, 
        i.type, 
        ST_X(i.location::geometry) as longitude, 
        ST_Y(i.location::geometry) as latitude, 
        i.description, 
        i.created_at, 
        i.reported_by, 
        i.active
      FROM 
        incidents i
      WHERE 
        i.id = $1
    `;
    
    const incidentResult = await pool.query(incidentQuery, [id]);
    const incident = incidentResult.rows[0];
    
    // Formater la réponse pour le frontend
    res.json({
      id: incident.id,
      type: incident.type,
      location: [parseFloat(incident.longitude), parseFloat(incident.latitude)],
      description: incident.description,
      createdAt: incident.created_at,
      createdBy: incident.reported_by,
      votes: {
        up: upVotes,
        down: downVotes
      },
      active: incident.active
    });
  } catch (err) {
    console.error('Erreur lors du vote pour un incident:', err);
    res.status(500).json({ message: 'Erreur serveur lors du vote' });
  }
});

module.exports = router;