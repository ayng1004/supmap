// backend/services/auth-service/config/passport.js
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const { Pool } = require('pg');

// Connexion à la base de données
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

module.exports = function(passport) {
  // Stratégie Google
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: 'http://localhost:3001/api/auth/google/callback',
    proxy: true

  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Vérification si l'utilisateur existe déjà
      const existingUser = await pool.query(
        'SELECT * FROM users WHERE provider = $1 AND provider_id = $2',
        ['google', profile.id]
      );
      
      if (existingUser.rows.length > 0) {
        return done(null, existingUser.rows[0]);
      }
      
      // Vérification si l'email existe déjà
      if (profile.emails && profile.emails.length > 0) {
        const userWithEmail = await pool.query(
          'SELECT * FROM users WHERE email = $1',
          [profile.emails[0].value]
        );
        
        if (userWithEmail.rows.length > 0) {
          // Mise à jour de l'utilisateur existant avec les informations Google
          const updatedUser = await pool.query(
            'UPDATE users SET provider = $1, provider_id = $2 WHERE email = $3 RETURNING *',
            ['google', profile.id, profile.emails[0].value]
          );
          
          return done(null, updatedUser.rows[0]);
        }
      }
      
      // Création d'un nouvel utilisateur
      const newUser = await pool.query(
        'INSERT INTO users (username, email, provider, provider_id, avatar_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [
          profile.displayName,
          profile.emails ? profile.emails[0].value : null,
          'google',
          profile.id,
          profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null
        ]
      );
      
      done(null, newUser.rows[0]);
    } catch (error) {
      console.error('Google auth error:', error);
      done(error, null);
    }
  }));
  
  // Stratégie Facebook
  passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: '/api/auth/facebook/callback',
    profileFields: ['id', 'displayName', 'photos', 'email'],
    proxy: true
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Vérification si l'utilisateur existe déjà
      const existingUser = await pool.query(
        'SELECT * FROM users WHERE provider = $1 AND provider_id = $2',
        ['facebook', profile.id]
      );
      
      if (existingUser.rows.length > 0) {
        return done(null, existingUser.rows[0]);
      }
      
      // Vérification si l'email existe déjà
      if (profile.emails && profile.emails.length > 0) {
        const userWithEmail = await pool.query(
          'SELECT * FROM users WHERE email = $1',
          [profile.emails[0].value]
        );
        
        if (userWithEmail.rows.length > 0) {
          // Mise à jour de l'utilisateur existant avec les informations Facebook
          const updatedUser = await pool.query(
            'UPDATE users SET provider = $1, provider_id = $2 WHERE email = $3 RETURNING *',
            ['facebook', profile.id, profile.emails[0].value]
          );
          
          return done(null, updatedUser.rows[0]);
        }
      }
      
      // Création d'un nouvel utilisateur
      const newUser = await pool.query(
        'INSERT INTO users (username, email, provider, provider_id, avatar_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [
          profile.displayName,
          profile.emails ? profile.emails[0].value : null,
          'facebook',
          profile.id,
          profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null
        ]
      );
      
      done(null, newUser.rows[0]);
    } catch (error) {
      console.error('Facebook auth error:', error);
      done(error, null);
    }
  }));
  
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      done(null, user.rows[0]);
    } catch (error) {
      done(error, null);
    }
  });
};