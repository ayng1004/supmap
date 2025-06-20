import React, { useState } from 'react';
import axios from 'axios';

const LoginPage = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('http://localhost:3001/api/auth/login', formData, {
        withCredentials: true
      });

      console.log('Réponse login:', response.data);

      // Tu peux sauvegarder le token en localStorage si besoin
      localStorage.setItem('token', response.data.token);

      // Rediriger vers une page protégée, par exemple dashboard
      window.location.href = '/';

    } catch (err) {
      console.error('Erreur de connexion:', err);
      setError(err.response?.data?.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.pageContainer}>
      <div style={styles.mainContainer}>
        <div style={styles.leftPanel}>
          <div style={styles.header}>
            <div style={styles.logo}>SupMap</div>
            <div style={styles.tagline}>Connectez-vous pour naviguer</div>
          </div>
          
          <div style={styles.loginCard}>
            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.inputWrapper}>
                <span style={styles.inputIcon}>📧</span>
                <input
                  type="email"
                  name="email"
                  placeholder="Votre email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  style={styles.input}
                />
              </div>
              
              <div style={styles.inputWrapper}>
                <span style={styles.inputIcon}>🔒</span>
                <input
                  type="password"
                  name="password"
                  placeholder="Mot de passe"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  style={styles.input}
                />
              </div>
              
              {error && (
                <div style={styles.errorBox}>
                  <span style={styles.errorIcon}>⚠️</span>
                  {error}
                </div>
              )}
              
              <button type="submit" style={styles.button} disabled={loading}>
                {loading ? (
                  <div style={styles.loadingContent}>
                    <div style={styles.spinner}></div>
                    Navigation en cours...
                  </div>
                ) : (
                  <div style={styles.buttonContent}>
                    Commencer le voyage
                  </div>
                )}
              </button>
              
              <div style={styles.divider}>
                <span style={styles.dividerText}>ou</span>
              </div>
              
              <a 
                href="http://localhost:3001/api/auth/google"
                style={styles.googleButton}
              >
                <svg style={styles.googleIcon} viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Connexion avec Google
              </a>
            </form>
          </div>
        </div>
        
        <div style={styles.rightPanel}>
          <div style={styles.gradientBackground}>
            <div style={styles.route1}></div>
            <div style={styles.route2}></div>
            <div style={styles.route3}></div>
            <div style={styles.floatingElement1}></div>
            <div style={styles.floatingElement2}></div>
            <div style={styles.floatingElement3}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  pageContainer: {
    minHeight: '100vh',
    backgroundColor: '#F0F3F8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  mainContainer: {
    width: '100%',
    maxWidth: '1200px',
    display: 'flex',
    backgroundColor: 'white',
    borderRadius: '20px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
    overflow: 'hidden',
  },
  leftPanel: {
    width: '40%',
    padding: '60px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  rightPanel: {
    width: '60%',
    position: 'relative',
    overflow: 'hidden',
  },
  header: {
    marginBottom: '40px',
  },
  logo: {
    fontSize: '48px',
    color: '#050F39',
    fontWeight: 'bold',
    marginBottom: '10px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  tagline: {
    color: '#050F39',
    fontSize: '18px',
    fontWeight: '400',
  },
  loginCard: {
    marginTop: '20px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '15px',
    fontSize: '20px',
    zIndex: 1,
  },
  input: {
    width: '100%',
    padding: '15px 15px 15px 45px',
    fontSize: '16px',
    border: '2px solid #E5E5E5',
    borderRadius: '10px',
    transition: 'all 0.3s ease',
    backgroundColor: '#F9F9F9',
  },
  errorBox: {
    backgroundColor: '#FFE5E5',
    color: '#D32F2F',
    padding: '12px 15px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    border: '1px solid #FFB3B3',
  },
  errorIcon: {
    fontSize: '16px',
  },
  button: {
    padding: '16px',
    fontSize: '16px',
    fontWeight: 'bold',
    backgroundColor: '#050F39',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    marginTop: '10px',
  },
  buttonContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  loadingContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid #ffffff',
    borderTop: '2px solid transparent',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    margin: '20px 0',
  },
  dividerText: {
    backgroundColor: 'white',
    padding: '0 15px',
    color: '#888',
    fontSize: '14px',
  },
  googleButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '16px',
    backgroundColor: '#ffffff',
    color: '#666',
    borderRadius: '12px',
    textDecoration: 'none',
    fontWeight: 'bold',
    fontSize: '16px',
    border: '2px solid #E5E5E5',
    transition: 'all 0.3s ease',
  },
  googleIcon: {
    width: '24px',
    height: '24px',
  },
  gradientBackground: {
    width: '100%',
    height: '100%',
    background: 'linear-gradient(135deg, #9CC8FF 0%, #8ABFF5 40%, #7AADEB 100%)',
    position: 'relative',
  },
  route1: {
    position: 'absolute',
    width: '1000px',
    height: '8px',
    background: 'rgba(255, 255, 255, 0.15)',
    borderRadius: '20px',
    top: '30%',
    left: '-20%',
    transform: 'rotate(-8deg)',
    boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
  },
  route2: {
    position: 'absolute',
    width: '800px',
    height: '8px',
    background: 'rgba(255, 255, 255, 0.2)',
    borderRadius: '20px',
    top: '65%',
    left: '-10%',
    transform: 'rotate(5deg)',
    boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
  },
  route3: {
    position: 'absolute',
    width: '600px',
    height: '6px',
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '20px',
    top: '48%',
    left: '20%',
    transform: 'rotate(-2deg)',
  },
  floatingElement1: {
    position: 'absolute',
    width: '80px',
    height: '80px',
    background: 'white',
    borderRadius: '20px',
    top: '20%',
    right: '20%',
    transform: 'rotate(5deg)',
    opacity: 0.8,
    boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
  },
  floatingElement2: {
    position: 'absolute',
    width: '50px',
    height: '50px',
    background: 'white',
    borderRadius: '15px',
    bottom: '30%',
    right: '15%',
    transform: 'rotate(-8deg)',
    opacity: 0.7,
    boxShadow: '0 8px 25px rgba(0,0,0,0.1)',
  },
  floatingElement3: {
    position: 'absolute',
    width: '60px',
    height: '60px',
    background: 'rgba(255, 255, 255, 0.9)',
    borderRadius: '18px',
    top: '50%',
    left: '15%',
    transform: 'rotate(-3deg)',
    opacity: 0.6,
    boxShadow: '0 8px 25px rgba(0,0,0,0.08)',
  },
};

// Ajout de l'animation pour le spinner
const styleSheet = document.styleSheets[0];
styleSheet.insertRule(`
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`, styleSheet.cssRules.length);

export default LoginPage;