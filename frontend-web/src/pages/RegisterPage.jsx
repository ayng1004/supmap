import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const RegisterPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    try {
      const response = await axios.post('http://localhost:3001/api/auth/register', formData, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/login');
        }, 1500);
      }
    } catch (err) {
      console.error(err);
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Une erreur est survenue.');
      }
    }
  };

  return (
    <div style={styles.pageContainer}>
      {/* Background Elements */}
      <div style={styles.backgroundCircle1}></div>
      <div style={styles.backgroundCircle2}></div>
      <div style={styles.backgroundCircle3}></div>
      <div style={styles.backgroundPath1}></div>
      <div style={styles.backgroundPath2}></div>
      
      {/* Main Content */}
      <div style={styles.registerContainer}>
        <div style={styles.logoSection}>
          <div style={styles.mainLogo}>SupMap</div>
          <div style={styles.stepIndicator}>
            <div style={styles.stepLine}></div>
            <div style={styles.stepDot1}></div>
            <div style={styles.stepDot2}></div>
            <div style={styles.stepText}>Créer votre compte</div>
          </div>
        </div>
        
        <div style={styles.formCard}>
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.inputGroup}>
              <div style={styles.inputLabel}>👤 Nom d'utilisateur</div>
              <input
                type="text"
                name="username"
                placeholder="Choisissez votre identifiant"
                value={formData.username}
                onChange={handleChange}
                required
                style={styles.input}
              />
            </div>
            
            <div style={styles.inputGroup}>
              <div style={styles.inputLabel}>📧 Email</div>
              <input
                type="email"
                name="email"
                placeholder="votre@email.com"
                value={formData.email}
                onChange={handleChange}
                required
                style={styles.input}
              />
            </div>
            
            <div style={styles.inputGroup}>
              <div style={styles.inputLabel}>🔒 Mot de passe</div>
              <input
                type="password"
                name="password"
                placeholder="Minimum 8 caractères"
                value={formData.password}
                onChange={handleChange}
                required
                style={styles.input}
              />
            </div>
            
            {error && (
              <div style={styles.errorBox}>
                <span style={styles.errorIcon}>❌</span>
                {error}
              </div>
            )}
            
            {success && (
              <div style={styles.successBox}>
                <span style={styles.successIcon}>🎉</span>
                Inscription réussie !
              </div>
            )}
            
            <button type="submit" style={styles.submitButton}>
              Commencer l'aventure
            </button>
          </form>
          
          <div style={styles.footer}>
            <div style={styles.dividerContainer}>
              <div style={styles.dividerLine}></div>
              <span style={styles.dividerText}>Ou</span>
              <div style={styles.dividerLine}></div>
            </div>
            
            <div style={styles.loginPrompt}>
              Déjà sur la route avec nous ?{' '}
              <span onClick={() => navigate('/login')} style={styles.loginLink}>
                Connectez-vous
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  pageContainer: {
    minHeight: '100vh',
    backgroundColor: '#F8FAFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    position: 'relative',
    overflow: 'hidden',
  },
  backgroundCircle1: {
    position: 'absolute',
    width: '600px',
    height: '600px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(156,200,255,0.1) 0%, rgba(156,200,255,0.05) 70%, transparent 100%)',
    top: '-200px',
    left: '-200px',
  },
  backgroundCircle2: {
    position: 'absolute',
    width: '400px',
    height: '400px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(156,200,255,0.15) 0%, rgba(156,200,255,0.1) 50%, transparent 100%)',
    bottom: '-100px',
    right: '-100px',
  },
  backgroundCircle3: {
    position: 'absolute',
    width: '150px',
    height: '150px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.6)',
    top: '20%',
    right: '10%',
    boxShadow: '0 8px 20px rgba(0,0,0,0.05)',
  },
  backgroundPath1: {
    position: 'absolute',
    width: '800px',
    height: '20px',
    background: 'rgba(156,200,255,0.1)',
    borderRadius: '50%',
    transform: 'rotate(-30deg)',
    top: '15%',
    left: '-10%',
  },
  backgroundPath2: {
    position: 'absolute',
    width: '600px',
    height: '15px',
    background: 'rgba(156,200,255,0.08)',
    borderRadius: '50%',
    transform: 'rotate(15deg)',
    bottom: '25%',
    right: '-10%',
  },
  registerContainer: {
    position: 'relative',
    zIndex: 5,
    width: '100%',
    maxWidth: '500px',
  },
  logoSection: {
    textAlign: 'center',
    marginBottom: '40px',
  },
  mainLogo: {
    fontSize: '52px',
    color: '#050F39',
    fontWeight: 'bold',
    marginBottom: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  stepIndicator: {
    position: 'relative',
    padding: '15px 0',
  },
  stepLine: {
    height: '2px',
    background: '#E5E5E5',
    width: '60%',
    margin: '0 auto',
    position: 'relative',
  },
  stepDot1: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#050F39',
    position: 'absolute',
    left: '25%',
    top: '14px',
  },
  stepDot2: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    background: '#9CC8FF',
    border: '3px solid #050F39',
    position: 'absolute',
    right: '25%',
    top: '12px',
  },
  stepText: {
    marginTop: '20px',
    color: '#050F39',
    fontSize: '18px',
    fontWeight: '500',
  },
  formCard: {
    backgroundColor: 'white',
    borderRadius: '25px',
    padding: '45px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.08)',
    backdropFilter: 'blur(10px)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '25px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  inputLabel: {
    color: '#050F39',
    fontSize: '16px',
    fontWeight: '500',
  },
  input: {
    padding: '16px 20px',
    border: '2px solid #F0F3FF',
    borderRadius: '16px',
    fontSize: '16px',
    backgroundColor: '#FAFBFF',
    transition: 'all 0.3s ease',
    color: '#050F39',
  },
  errorBox: {
    backgroundColor: '#FFF5F5',
    color: '#C53030',
    padding: '14px 20px',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '15px',
    border: '1px solid #FFB0B0',
  },
  errorIcon: {
    fontSize: '18px',
  },
  successBox: {
    backgroundColor: '#F0FDF4',
    color: '#16A34A',
    padding: '14px 20px',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '15px',
    border: '1px solid #BBF7D0',
  },
  successIcon: {
    fontSize: '18px',
  },
  submitButton: {
    padding: '18px',
    fontSize: '17px',
    fontWeight: 'bold',
    background: 'linear-gradient(135deg, #050F39 0%, #1A2469 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '16px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    marginTop: '10px',
    boxShadow: '0 4px 15px rgba(5, 15, 57, 0.3)',
  },
  footer: {
    marginTop: '30px',
  },
  dividerContainer: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '25px',
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    background: '#E5E5E5',
  },
  dividerText: {
    padding: '0 15px',
    color: '#6b7280',
    fontSize: '14px',
  },
  loginPrompt: {
    textAlign: 'center',
    fontSize: '15px',
    color: '#6b7280',
  },
  loginLink: {
    color: '#050F39',
    fontWeight: '600',
    cursor: 'pointer',
    textDecoration: 'none',
    borderBottom: '1px solid transparent',
  },
};

export default RegisterPage;