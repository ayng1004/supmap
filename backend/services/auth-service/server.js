const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const passport = require('passport'); 
require('./config/passport')(passport); 
const oauthRoutes = require('./routes/oauth'); 
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3002;

// Connexion PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// Middlewares
app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true
}));
app.use(express.json());
app.use(passport.initialize()); 

app.use('/', oauthRoutes); 
// Vérification de la connexion à la base de données
pool.query('SELECT NOW()', (err) => {
  if (err) {
    console.error('Erreur de connexion à PostgreSQL:', err);
  } else {
    console.log('Connexion à PostgreSQL établie');
  }
});



const notifyServices = async (eventType, userData) => {
  try {
    console.log(`Notification des services pour l'événement ${eventType}:`, userData);
    
    // Liste des services à notifier
    const services = [
      {
        name: 'Service d\'incidents',
        url: process.env.INCIDENT_SERVICE_URL || 'http://incident-service:3003',
        endpoint: '/sync-user'
      },
      {
        name: 'Service de routes',
        url: process.env.ROUTE_SERVICE_URL || 'http://route-service:3004',
        endpoint: '/sync-user'
      }
    ];
    
    const results = await Promise.allSettled(
      services.map(service => 
        axios.post(`${service.url}${service.endpoint}`, userData, {
          headers: {
            'Content-Type': 'application/json',
            'apiKey': process.env.INTERNAL_API_KEY || 'default-secret-key'
          }
        })
        .then(response => {
          console.log(`Service ${service.name} notifié avec succès:`, response.data);
          return { service: service.name, success: true };
        })
        .catch(error => {
          console.error(`Erreur lors de la notification du service ${service.name}:`, error.message);
          return { service: service.name, success: false, error: error.message };
        })
      )
    );
    
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    console.log(`${successCount}/${services.length} services notifiés avec succès`);
    
    return results;
  } catch (error) {
    console.error('Erreur lors de la notification des services:', error);
    return [];
  }
};

// Middleware de vérification des droits d'administration
const isAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'Pas de token fourni' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Récupérer l'utilisateur avec son rôle
    const user = await pool.query(
      'SELECT u.id, u.role_id, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1',
      [decoded.id]
    );
    
    if (user.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }
    
    // Vérifier si l'utilisateur est admin
    if (user.rows[0].role_name !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Accès refusé: droits admin requis' });
    }
    
    // Stocker les infos utilisateur pour les routes suivantes
    req.user = user.rows[0];
    next();
  } catch (error) {
    console.error('Erreur vérification admin:', error);
    res.status(401).json({ success: false, message: 'Token invalide ou expiré' });
  }
};

// Endpoint pour synchroniser les données utilisateur avec les autres services
app.post('/sync-user', async (req, res) => {
    try {
      const { apiKey } = req.headers;
      
      // Vérification de l'API key (à définir dans votre .env)
      if (apiKey !== process.env.INTERNAL_API_KEY) {
        return res.status(401).json({ success: false, message: 'Non autorisé' });
      }
      
      const { userId } = req.body;
      
      // Récupérer les infos utilisateur avec son rôle
      const user = await pool.query(
        `SELECT u.id, u.username, u.email, u.role_id, r.name as role_name 
         FROM users u 
         JOIN roles r ON u.role_id = r.id 
         WHERE u.id = $1`,
        [userId]
      );
      
      if (user.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
      }
      
      res.status(200).json({
        success: true,
        user: user.rows[0]
      });
    } catch (error) {
      console.error('Erreur de synchronisation:', error);
      res.status(500).json({ success: false, message: 'Erreur interne' });
    }
});

// --- ROUTES DE GESTION DES RÔLES ---

// Route pour récupérer tous les rôles (admin uniquement)
app.get('/roles', isAdmin, async (req, res) => {
  try {
    const roles = await pool.query('SELECT * FROM roles ORDER BY id');
    res.status(200).json({ success: true, roles: roles.rows });
  } catch (error) {
    console.error('Erreur récupération des rôles:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Route pour assigner un rôle à un utilisateur (admin uniquement)
app.put('/users/:userId/role', isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { roleId } = req.body;
    
    if (!roleId) {
      return res.status(400).json({ success: false, message: 'ID de rôle requis' });
    }
    
    // Vérifier si le rôle existe
    const roleExists = await pool.query('SELECT * FROM roles WHERE id = $1', [roleId]);
    if (roleExists.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Rôle non trouvé' });
    }
    
    // Mettre à jour le rôle de l'utilisateur
    const updatedUser = await pool.query(
      'UPDATE users SET role_id = $1 WHERE id = $2 RETURNING id, username, email, role_id',
      [roleId, userId]
    );
    
    if (updatedUser.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }
    
    // Notifier les autres services du changement de rôle
    const userData = {
      ...updatedUser.rows[0],
      role_id: roleId
    };
    
    notifyServices('USER_ROLE_UPDATED', userData).catch(err => 
      console.error('Erreur lors de la notification des services:', err)
    );
    
    res.status(200).json({
      success: true,
      user: updatedUser.rows[0],
      message: 'Rôle utilisateur mis à jour'
    });
  } catch (error) {
    console.error('Erreur mise à jour du rôle:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// --- MODIFIER LA ROUTE D'INSCRIPTION ---
app.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tous les champs sont requis' 
      });
    }
    
    // Vérifier si l'email existe déjà
    const userExists = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    if (userExists.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cet email est déjà utilisé' 
      });
    }
    
    // Hasher le mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Insérer le nouvel utilisateur avec rôle par défaut (User = 3)
    const newUser = await pool.query(
      'INSERT INTO users (username, email, password, role_id) VALUES ($1, $2, $3, 3) RETURNING id, username, email, role_id, created_at',
      [username, email, hashedPassword]
    );
    
    // Générer un token JWT
    const token = jwt.sign(
      { 
        id: newUser.rows[0].id, 
        email: newUser.rows[0].email,
        role_id: newUser.rows[0].role_id 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // NOUVEAU: Notifier les autres services
    const userData = {
      id: newUser.rows[0].id,
      username: newUser.rows[0].username,
      email: newUser.rows[0].email,
      role_id: newUser.rows[0].role_id
    };
    
    // Notifier de façon asynchrone (ne pas attendre la réponse)
    notifyServices('USER_CREATED', userData).catch(err => 
      console.error('Erreur lors de la notification des services:', err)
    );
    
    res.status(201).json({
      success: true,
      token,
      user: newUser.rows[0]
    });
  } catch (error) {
    console.error('Erreur d\'inscription:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de l\'inscription' 
    });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email et mot de passe requis' 
      });
    }
    
    // Chercher l'utilisateur par email, inclure le rôle
    const user = await pool.query(
      `SELECT u.*, r.name as role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.email = $1`,
      [email]
    );
    
    if (user.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Email ou mot de passe incorrect' 
      });
    }
    
    // Vérifier le mot de passe
    const isMatch = await bcrypt.compare(password, user.rows[0].password);
    
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Email ou mot de passe incorrect' 
      });
    }
    
    // Générer un token JWT avec les infos de rôle
    const token = jwt.sign(
      { 
        id: user.rows[0].id, 
        email: user.rows[0].email,
        role_id: user.rows[0].role_id
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Retourner les informations utilisateur sans le mot de passe
    const { password: _, ...userInfo } = user.rows[0];
    
    res.status(200).json({
      success: true,
      token,
      user: userInfo
    });
  } catch (error) {
    console.error('Erreur de connexion:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la connexion' 
    });
  }
});

app.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Pas de token fourni' 
      });
    }
    
    // Vérifier le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Chercher l'utilisateur par ID avec son rôle
    const user = await pool.query(
      `SELECT u.id, u.username, u.email, u.avatar_url, u.created_at, u.role_id, r.name as role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.id = $1`,
      [decoded.id]
    );
    
    if (user.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }
    
    res.status(200).json({
      success: true,
      user: user.rows[0]
    });
  } catch (error) {
    console.error('Erreur de vérification du token:', error);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token invalide ou expiré' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la vérification' 
    });
  }
});

app.put('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Pas de token fourni' 
      });
    }
    
    // Vérifier le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const { username, avatar_url } = req.body;
    
    // Mettre à jour le profil
    const updatedUser = await pool.query(
      'UPDATE users SET username = COALESCE($1, username), avatar_url = COALESCE($2, avatar_url) WHERE id = $3 RETURNING id, username, email, avatar_url, role_id, created_at',
      [username, avatar_url, decoded.id]
    );
    
    if (updatedUser.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }
    
    res.status(200).json({
      success: true,
      user: updatedUser.rows[0]
    });
  } catch (error) {
    console.error('Erreur de mise à jour du profil:', error);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token invalide ou expiré' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la mise à jour du profil' 
    });
  }
});

app.put('/change-password', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Pas de token fourni' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ success: false, message: 'Nouveau mot de passe requis' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await pool.query(
      'UPDATE users SET password = $1 WHERE id = $2',
      [hashedPassword, decoded.id]
    );

    res.status(200).json({ success: true, message: 'Mot de passe mis à jour' });
  } catch (error) {
    console.error('Erreur changement mot de passe:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Route pour récupérer tous les utilisateurs avec leurs rôles (admin uniquement)
app.get('/users', isAdmin, async (req, res) => {
  try {
    const users = await pool.query(
      `SELECT u.id, u.username, u.email, u.avatar_url, u.created_at, u.role_id, r.name as role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       ORDER BY u.id`
    );
    
    res.status(200).json({
      success: true,
      users: users.rows
    });
  } catch (error) {
    console.error('Erreur récupération des utilisateurs:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Service d'authentification démarré sur le port ${PORT}`);
});