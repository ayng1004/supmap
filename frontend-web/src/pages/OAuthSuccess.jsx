import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const OAuthSuccess = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
      // Stocke le token
      localStorage.setItem('token', token);

      // Charge les infos utilisateur
      axios.get('http://localhost:3001/api/auth/verify', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      .then(res => {
        localStorage.setItem('user', JSON.stringify(res.data.user));
        navigate('/profile'); // Redirige vers la page Profil ou Accueil
      })
      .catch(() => {
        navigate('/login'); // Si erreur, retourne au login
      });
    } else {
      navigate('/login');
    }
  }, [navigate]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      fontSize: '18px',
      fontWeight: 'bold'
    }}>
      Connexion réussie... Redirection...
    </div>
  );
};

export default OAuthSuccess;
