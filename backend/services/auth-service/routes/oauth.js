const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Map pour stocker les sessions d'authentification en cours
// Format: { sessionId: { completed: boolean, token: string, user: object, timestamp: number } }
const pendingAuthSessions = new Map();

// Nettoyage périodique des sessions expirées (plus de 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of pendingAuthSessions.entries()) {
    if (session.timestamp && now - session.timestamp > 10 * 60 * 1000) {
      pendingAuthSessions.delete(sessionId);
      console.log(`Session d'authentification expirée supprimée: ${sessionId}`);
    }
  }
}, 60 * 1000); // Vérifier toutes les minutes

// Vérification du statut d'une session d'authentification
router.get('/google/check', (req, res) => {
  try {
    const { sessionId } = req.query;
    
    if (!sessionId) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID de session requis' 
      });
    }
    
    // Récupérer la session
    const session = pendingAuthSessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session d\'authentification non trouvée'
      });
    }
    
    // Renvoyer le statut de la session
    res.json({
      success: true,
      completed: session.completed,
      token: session.token,
      user: session.user
    });
    
    // Si la session est complétée, la supprimer après l'avoir renvoyée
    if (session.completed) {
      pendingAuthSessions.delete(sessionId);
      console.log(`Session d'authentification complétée supprimée: ${sessionId}`);
    }
  } catch (error) {
    console.error('Erreur lors de la vérification de l\'authentification:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification de l\'authentification'
    });
  }
});

// Route pour démarrer l'authentification Google
router.get('/google', (req, res, next) => {
  // Utiliser l'état passé en paramètre, ou en créer un nouveau si absent
  const state = req.query.state || '';
  
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account',
    state
  })(req, res, next);
});

// Route callback après Google Auth
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login', session: false }),
  async (req, res) => {
    try {
      const user = req.user;
      let sessionId = null;
      
      // Essayer d'extraire l'ID de session de l'état
      if (req.query.state) {
        try {
          const stateObj = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
          sessionId = stateObj.sessionId;
        } catch (parseError) {
          console.error('Erreur lors du décodage de l\'état:', parseError);
        }
      }
      
      // Générer un token JWT en utilisant la structure de données utilisateur actuelle
      const token = jwt.sign(
        { 
          id: user.id, 
          email: user.email,
          role_id: user.role_id || 3 // Utilisateur standard par défaut
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      
      // Si on a un ID de session, mettre à jour la session
      if (sessionId && pendingAuthSessions.has(sessionId)) {
        const userData = {
          id: user.id,
          username: user.username,
          email: user.email,
          provider: user.provider,
          avatar_url: user.avatar_url,
          role_id: user.role_id || 3
        };
        
        pendingAuthSessions.set(sessionId, {
          completed: true,
          token,
          user: userData,
          timestamp: Date.now()
        });
        
        console.log(`Session d'authentification complétée: ${sessionId}`);
        
        // Rediriger vers une page de succès pour mobile
        return res.send(`
          <html>
            <head>
              <title>Authentification réussie</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  display: flex;
                  flex-direction: column;
                  justify-content: center;
                  align-items: center;
                  height: 100vh;
                  margin: 0;
                  padding: 20px;
                  text-align: center;
                  background-color: #F0F3F8;
                }
                .card {
                  background: white;
                  border-radius: 20px;
                  padding: 30px;
                  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                  max-width: 400px;
                  width: 100%;
                }
                h1 {
                  color: #050F39;
                  margin-bottom: 12px;
                }
                p {
                  color: #666;
                  line-height: 1.6;
                  margin-bottom: 24px;
                }
                .app-icon {
                  font-size: 60px;
                  margin-bottom: 24px;
                }
                .success-icon {
                  color: #34C759;
                  font-size: 48px;
                  margin-bottom: 24px;
                }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="app-icon">🗺️</div>
                <div class="success-icon">✓</div>
                <h1>Authentification réussie</h1>
                <p>Vous êtes maintenant connecté à SupMap. Vous pouvez retourner à l'application.</p>
              </div>
            </body>
          </html>
        `);
      }
      
      // Pour les applications web, rediriger vers la page de succès habituelle
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/oauth-success?token=${token}`);
    } catch (err) {
      console.error('Erreur après authentification Google:', err);
      res.redirect('/login');
    }
  }
);
router.post('/google/init', (req, res) => {
  try {
    const { sessionId, platform } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID de session requis' 
      });
    }
    
    // Stocker la session avec un horodatage
    pendingAuthSessions.set(sessionId, {
      completed: false,
      platform,
      timestamp: Date.now()
    });
    
    // Base URL - Utiliser l'adresse IP si mobile
    let baseUrl = process.env.API_URL || 'http://localhost:3001/api';
    
    // Si c'est un appareil mobile, utiliser l'adresse IP au lieu de localhost
    if (platform === 'android' || platform === 'ios') {
      // Utiliser la même adresse IP que dans votre fichier apiService.js pour Android
      baseUrl = 'http://192.168.1.27:3001/api';  // Remplacez par votre adresse IP
    }
    
    const state = Buffer.from(JSON.stringify({ 
      sessionId,
      platform: platform || 'web'
    })).toString('base64');
    
    const authUrl = `${baseUrl}/auth/google?state=${state}`;
    
    res.json({
      success: true,
      authUrl,
      message: 'Session d\'authentification initialisée'
    });
  } catch (error) {
    console.error('Erreur lors de l\'initialisation de l\'authentification:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'initialisation de l\'authentification'
    });
  }
});

// Vérification du statut d'une session d'authentification Facebook (même endpoing que Google)
// La route '/auth/google/check' peut être utilisée pour les deux types d'authentification

module.exports = router;