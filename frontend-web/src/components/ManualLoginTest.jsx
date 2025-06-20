// ManualLoginTest.jsx
// Créez ce fichier dans votre dossier components

import React, { useState } from 'react';
import axios from 'axios';

const ManualLoginTest = () => {
  const [email, setEmail] = useState('amani@test.com');
  const [password, setPassword] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      console.log('Tentative de connexion directe...');
      // Utiliser axios directement sans passer par votre instance api
      const response = await axios.post('http://localhost:3001/api/auth/login', {
        email,
        password
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Réponse de connexion:', response.data);
      setResult(response.data);
      
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        console.log('Token sauvegardé dans localStorage');
      }
    } catch (err) {
      console.error('Erreur de connexion:', err);
      setError({
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
    } finally {
      setLoading(false);
    }
  };

  const testIncidents = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const token = localStorage.getItem('token');
      console.log('Test de récupération des incidents avec token:', token ? token.substring(0, 15) + '...' : 'null');
      
      // Utiliser axios directement
      const response = await axios.get('http://localhost:3001/api/incidents', {
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
      
      console.log('Réponse incidents:', response.data);
      setResult(response.data);
    } catch (err) {
      console.error('Erreur de récupération des incidents:', err);
      setError({
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
    } finally {
      setLoading(false);
    }
  };

  const testIncidentPost = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const token = localStorage.getItem('token');
      console.log('Test de création d\'incident avec token:', token ? token.substring(0, 15) + '...' : 'null');
      
      // Utiliser axios directement
      const response = await axios.post('http://localhost:3001/api/incidents', {
        type: 'accident',
        description: 'Test depuis ManualLoginTest',
        latitude: 48.8534,
        longitude: 2.3488
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
      
      console.log('Réponse création incident:', response.data);
      setResult(response.data);
    } catch (err) {
      console.error('Erreur de création d\'incident:', err);
      setError({
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '20px auto', padding: '20px', backgroundColor: '#f0f0f0', borderRadius: '8px' }}>
      <h2>Test manuel de connexion</h2>
      
      <form onSubmit={handleLogin} style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            required
          />
        </div>
        
        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Mot de passe:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            required
          />
        </div>
        
        <button
          type="submit"
          disabled={loading}
          style={{
            backgroundColor: '#4caf50',
            color: 'white',
            border: 'none',
            padding: '10px 15px',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '10px'
          }}
        >
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button
          onClick={testIncidents}
          disabled={loading}
          style={{
            backgroundColor: '#2196f3',
            color: 'white',
            border: 'none',
            padding: '10px 15px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Tester GET incidents
        </button>
        
        <button
          onClick={testIncidentPost}
          disabled={loading}
          style={{
            backgroundColor: '#ff9800',
            color: 'white',
            border: 'none',
            padding: '10px 15px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Tester POST incident
        </button>
      </div>
      
      {(result || error) && (
        <div>
          <h3>{error ? 'Erreur' : 'Résultat'}</h3>
          <pre
            style={{
              backgroundColor: error ? '#ffebee' : '#e8f5e9',
              padding: '10px',
              borderRadius: '4px',
              overflow: 'auto',
              maxHeight: '300px'
            }}
          >
            {JSON.stringify(error || result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default ManualLoginTest;