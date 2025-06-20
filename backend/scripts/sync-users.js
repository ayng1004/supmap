

const axios = require('axios');
const { Pool } = require('pg');
require('dotenv').config();

// Connexion à la base de données d'authentification
const pool = new Pool({
  host: process.env.AUTH_DB_HOST || 'auth-db',
  port: process.env.AUTH_DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.AUTH_DB_NAME || 'auth_db'
});

// Fonction pour récupérer tous les utilisateurs
const getAllUsers = async () => {
  try {
    const result = await pool.query('SELECT id, username, email FROM users');
    return result.rows;
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    return [];
  }
};

// Fonction pour notifier un service
const notifyService = async (serviceUrl, userData) => {
  try {
    console.log(`Tentative de synchronisation de l'utilisateur ${userData.id} vers ${serviceUrl}/sync-user`);
    
    const response = await axios.post(`${serviceUrl}/sync-user`, userData, {
      headers: {
        'Content-Type': 'application/json',
        'apiKey': process.env.INTERNAL_API_KEY || 'votre_cle_secrete_pour_communication_interne'
      }
    });
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error(`Erreur lors de la synchronisation vers ${serviceUrl}:`, error.message);
    
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
};

// Fonction principale
const syncUsers = async () => {
  try {
    console.log('Démarrage de la synchronisation des utilisateurs...');
    
    // Récupérer tous les utilisateurs
    const users = await getAllUsers();
    console.log(`${users.length} utilisateurs trouvés`);
    
    // Services à notifier 
    const services = [
      {
        name: 'Service d\'incidents',
        url: process.env.INCIDENT_SERVICE_URL || 'http://incident-service:3003'
      },
      {
        name: 'Service de routes',
        url: process.env.ROUTE_SERVICE_URL || 'http://route-service:3004'
      }
    ];
    
    // Pour chaque utilisateur, notifier tous les services
    for (const user of users) {
      console.log(`Synchronisation de l'utilisateur ${user.id} (${user.email})...`);
      
      for (const service of services) {
        console.log(`  Notification du service ${service.name}...`);
        
        const result = await notifyService(service.url, user);
        
        if (result.success) {
          console.log(`  Succès: ${JSON.stringify(result.data)}`);
        } else {
          console.error(`  Échec: ${JSON.stringify(result.error)}`);
        }
      }
    }
    
    console.log('Synchronisation terminée');
  } catch (error) {
    console.error('Erreur lors de la synchronisation:', error);
  } finally {
    pool.end();
  }
};

// Exécuter la fonction principale
syncUsers();