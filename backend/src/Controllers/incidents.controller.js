const db = require('../config/db'); // Ton fichier qui fait la connexion PostgreSQL

// Récupérer tous les incidents
exports.getAllIncidents = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM incidents WHERE active = TRUE');
    res.json(rows);
  } catch (error) {
    console.error('Erreur récupération incidents', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// Créer un nouvel incident
exports.createIncident = async (req, res) => {
  const { title, coords, color } = req.body;
  
  if (!title || !coords || coords.length !== 2) {
    return res.status(400).json({ error: 'Paramètres manquants' });
  }

  try {
    await db.query(
      'INSERT INTO incidents (type, description, location) VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326))',
      [title, color, coords[0], coords[1]]
    );
    res.status(201).json({ message: 'Incident créé avec succès' });
  } catch (error) {
    console.error('Erreur création incident', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};
