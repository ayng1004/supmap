const { Pool } = require('pg');

// Configuration de la connexion à la base de données
const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'geodb'
});

// Tester la connexion au démarrage
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Erreur de connexion à la base de données PostgreSQL:', err);
  } else {
    console.log('Connexion à la base de données PostgreSQL établie avec succès.');
  }
});

module.exports = pool;