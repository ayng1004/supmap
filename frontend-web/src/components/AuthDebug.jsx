// Version corrigée de AuthDebug.jsx avec plus de logging

import React, { useState } from 'react';
import api from '../services/api';

const AuthDebug = () => {
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [tokenInfo, setTokenInfo] = useState(null);
  const [responseData, setResponseData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Récupérer et décoder le token actuel
  const checkCurrentToken = () => {
    console.log("Vérification du token actuel...");
    const token = localStorage.getItem('token');
    if (!token) {
      console.log("Aucun token trouvé dans localStorage");
      setTokenInfo({ error: 'Aucun token trouvé' });
      return;
    }

    console.log("Token trouvé:", token.substring(0, 15) + '...');
    try {
      // Décoder le token (simple décodage, pas de vérification)
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.log("Format de token invalide");
        setTokenInfo({ error: 'Format de token invalide' });
        return;
      }

      const payload = JSON.parse(atob(parts[1]));
      console.log("Payload décodé:", payload);
      const isExpired = payload.exp ? payload.exp * 1000 < Date.now() : 'N/A';
      console.log("Token expiré?", isExpired);
      
      setTokenInfo({
        token: token.substring(0, 15) + '...',
        payload,
        isExpired
      });
    } catch (err) {
      console.error("Erreur lors du décodage du token:", err);
      setTokenInfo({ error: `Erreur de décodage: ${err.message}` });
    }
  };

  // Tester une connexion
  const handleLogin = async (e) => {
    e.preventDefault();
    console.log("Tentative de connexion avec:", loginData.email);
    setLoading(true);
    setError(null);
    setResponseData(null);

    try {
      console.log("Envoi de la requête de connexion...");
      const response = await api.post('/api/auth/login', loginData);
      console.log("Réponse de connexion reçue:", response);
      setResponseData(response.data);
      
      if (response.data.token) {
        console.log("Token reçu, sauvegarde dans localStorage");
        localStorage.setItem('token', response.data.token);
        checkCurrentToken();
      } else {
        console.warn("Aucun token dans la réponse");
      }
    } catch (err) {
      console.error("Erreur de connexion:", err);
      setError({
        message: err.message,
        response: err.response?.data || 'Pas de réponse',
        status: err.response?.status || 'Inconnu'
      });
    } finally {
      setLoading(false);
    }
  };

  // Tester une requête vers l'API incidents
  const testIncidentsAPI = async () => {
    console.log("Test de l'API incidents...");
    setLoading(true);
    setError(null);
    setResponseData(null);

    try {
      console.log("Envoi de la requête GET /api/incidents...");
      const response = await api.get('/api/incidents');
      console.log("Réponse de l'API incidents:", response);
      setResponseData({
        status: response.status,
        data: response.data
      });
    } catch (err) {
      console.error("Erreur lors du test de l'API incidents:", err);
      setError({
        message: err.message,
        response: err.response?.data || 'Pas de réponse',
        status: err.response?.status || 'Inconnu'
      });
    } finally {
      setLoading(false);
    }
  };

  // Vérifier le token côté serveur
  const verifyToken = async () => {
    console.log("Vérification du token via l'API...");
    setLoading(true);
    setError(null);
    setResponseData(null);

    try {
      console.log("Envoi de la requête GET /api/auth/verify...");
      const response = await api.get('/api/auth/verify');
      console.log("Réponse de vérification:", response);
      setResponseData({
        status: response.status,
        data: response.data
      });
    } catch (err) {
      console.error("Erreur lors de la vérification du token:", err);
      setError({
        message: err.message,
        response: err.response?.data || 'Pas de réponse',
        status: err.response?.status || 'Inconnu'
      });
    } finally {
      setLoading(false);
    }
  };

  // Déconnexion
  const handleLogout = () => {
    console.log("Déconnexion...");
    localStorage.removeItem('token');
    setTokenInfo(null);
    setResponseData({ message: 'Déconnecté avec succès' });
  };

  // Vérifier le token au chargement
  React.useEffect(() => {
    console.log("Composant AuthDebug monté, vérification du token initial");
    checkCurrentToken();
  }, []);

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Outil de débogage d'authentification</h1>
      
      {/* Informations sur le token actuel */}
      <section style={{ marginBottom: '30px', background: '#f5f5f5', padding: '15px', borderRadius: '8px' }}>
        <h2>Token actuel</h2>
        <button 
          onClick={() => {
            console.log("Bouton 'Vérifier le token' cliqué");
            checkCurrentToken();
          }}
          style={{
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            padding: '8px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '10px'
          }}
        >
          Vérifier le token
        </button>
        
        <button 
          onClick={() => {
            console.log("Bouton 'Vérifier via API' cliqué");
            verifyToken();
          }}
          style={{
            background: '#2196F3',
            color: 'white',
            border: 'none',
            padding: '8px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '10px'
          }}
        >
          Vérifier via API
        </button>
        
        <button 
          onClick={() => {
            console.log("Bouton 'Déconnexion' cliqué");
            handleLogout();
          }}
          style={{
            background: '#f44336',
            color: 'white',
            border: 'none',
            padding: '8px 12px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Déconnexion
        </button>
        
        {tokenInfo && (
          <pre style={{ marginTop: '15px', background: '#e0e0e0', padding: '10px', borderRadius: '4px', overflow: 'auto' }}>
            {JSON.stringify(tokenInfo, null, 2)}
          </pre>
        )}
      </section>
      
      {/* Formulaire de connexion */}
      <section style={{ marginBottom: '30px', background: '#f5f5f5', padding: '15px', borderRadius: '8px' }}>
        <h2>Test de connexion</h2>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <label htmlFor="email" style={{ display: 'block', marginBottom: '5px' }}>Email:</label>
            <input 
              type="email" 
              id="email" 
              value={loginData.email} 
              onChange={(e) => setLoginData({...loginData, email: e.target.value})}
              style={{ padding: '8px', width: '100%', borderRadius: '4px', border: '1px solid #ccc' }}
              required
            />
          </div>
          
          <div>
            <label htmlFor="password" style={{ display: 'block', marginBottom: '5px' }}>Mot de passe:</label>
            <input 
              type="password" 
              id="password" 
              value={loginData.password} 
              onChange={(e) => setLoginData({...loginData, password: e.target.value})}
              style={{ padding: '8px', width: '100%', borderRadius: '4px', border: '1px solid #ccc' }}
              required
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            style={{
              background: '#4CAF50',
              color: 'white',
              border: 'none',
              padding: '10px',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </section>
      
      {/* Test de l'API incidents */}
      <section style={{ marginBottom: '30px', background: '#f5f5f5', padding: '15px', borderRadius: '8px' }}>
        <h2>Test de l'API incidents</h2>
        <button 
          onClick={() => {
            console.log("Bouton 'Tester GET /api/incidents' cliqué");
            testIncidentsAPI();
          }}
          disabled={loading}
          style={{
            background: '#2196F3',
            color: 'white',
            border: 'none',
            padding: '10px 15px',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? 'Chargement...' : 'Tester GET /api/incidents'}
        </button>
      </section>
      
      {/* Résultats */}
      <section style={{ marginBottom: '30px', background: '#f5f5f5', padding: '15px', borderRadius: '8px' }}>
        <h2>{error ? 'Erreur' : 'Réponse'}</h2>
        <pre style={{ 
          background: error ? '#ffebee' : '#e8f5e9', 
          padding: '10px', 
          borderRadius: '4px', 
          overflow: 'auto',
          minHeight: '100px' // Pour montrer clairement où les résultats apparaîtront
        }}>
          {error || responseData ? JSON.stringify(error || responseData, null, 2) : 'Aucun résultat à afficher'}
        </pre>
      </section>
    </div>
  );
};

export default AuthDebug;