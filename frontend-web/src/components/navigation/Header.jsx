// Header.jsx - Modification du menu utilisateur
import React, { useState } from 'react';
import {
  FaUserCircle, FaSignInAlt, FaUserPlus, FaEllipsisV, 
  FaMap, FaGlobe, FaMoon, FaSun, FaCar, FaMapMarkedAlt,
  FaTachometerAlt // Ajouter cette icône pour le dashboard
} from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showStyleMenu, setShowStyleMenu] = useState(false);

  const { isAuthenticated, logout } = useAuth();

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
  };

  const handleProfile = () => {
    setMenuOpen(false);
    window.location.href = '/profile';
  };
  
  // Ajouter cette fonction
  const handleDashboard = () => {
    setMenuOpen(false);
    window.location.href = '/dashboard';
  };

  const mapStyles = [
    { id: 'streets', name: 'Carte classique', url: 'mapbox://styles/mapbox/streets-v11', icon: <FaMap /> },
    { id: 'satellite', name: 'Satellite', url: 'mapbox://styles/mapbox/satellite-streets-v11', icon: <FaGlobe /> },
    { id: 'dark', name: 'Sombre', url: 'mapbox://styles/mapbox/dark-v11', icon: <FaMoon /> },
    { id: 'light', name: 'Clair', url: 'mapbox://styles/mapbox/light-v11', icon: <FaSun /> },
    { id: 'navigation', name: 'Navigation Nuit', url: 'mapbox://styles/mapbox/navigation-night-v1', icon: <FaCar /> }
  ];

  return (
    <>
      {/* Header avec logo à gauche et contrôles à droite */}
      <div style={styles.headerContainer}>
        {/* Logo à gauche */}
        <div style={styles.logoButton} onClick={() => window.location.href = '/'}>
          <FaMapMarkedAlt size={22} />
        </div>

        {/* Contrôles à droite */}
        <div style={styles.rightControls}>
          {isAuthenticated && (
            <>
              <div style={styles.actionButton} onClick={() => setShowStyleMenu(!showStyleMenu)}>
                <FaEllipsisV size={18} />
              </div>

              <div style={styles.actionButton} onClick={() => setMenuOpen(!menuOpen)}>
                <FaUserCircle size={24} />
              </div>
            </>
          )}

          <div style={styles.mapUiContainer} id="map-ui-container">
            {menuOpen && (
              <div style={styles.menu}>
                {/* Ajoutez cette ligne */}
                <div style={styles.menuItem} onClick={handleDashboard}>
                  <FaTachometerAlt style={{ marginRight: '8px' }} />
                  Tableau de bord
                </div>
                <div style={styles.menuItem} onClick={handleProfile}>Mon Profil</div>
                <div style={styles.menuItem} onClick={handleLogout}>Se déconnecter</div>
              </div>
            )}

            {showStyleMenu && (
              <div style={styles.styleMenu}>
                {mapStyles.map(style => (
                  <div
                    key={style.id}
                    style={styles.menuItem}
                    onClick={() => {
                      localStorage.setItem('mapStyle', style.url);
                      window.location.reload();
                    }}
                  >
                    <span style={{ marginRight: '8px' }}>{style.icon}</span>
                    {style.name}
                  </div>
                ))}
              </div>
            )}
          </div>
          {!isAuthenticated && (
            <div style={styles.authButtons}>
              <div style={styles.actionButton} onClick={() => window.location.href = '/login'}>
                <FaSignInAlt size={20} />
              </div>
              <div style={styles.actionButton} onClick={() => window.location.href = '/register'}>
                <FaUserPlus size={20} />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// ... le reste du code reste inchangé

const styles = {
  headerContainer: {
    position: 'absolute',
    height: '55px',
    top: '10px',
    left: '5px',
    right: '10px',
    zIndex: 1000,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 10px',
  },
  mapUiContainer: {
    position: 'absolute',
    top: '70px',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    pointerEvents: 'none',
    display: 'flex',
    flexDirection: 'column',
    paddingTop: '60px',
  },
  logoButton: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    backgroundColor: '#444', // Gris foncé pour le logo
    color: 'white',
    cursor: 'pointer',
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
    pointerEvents: 'auto',
    transition: 'transform 0.2s, background-color 0.2s',
  },
  rightControls: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
  },
  actionButton: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    backgroundColor: '#555',  // Gris moyen pour les icônes
    color: 'white',
    cursor: 'pointer',
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
    transition: 'transform 0.2s, background-color 0.2s',
    pointerEvents: 'auto',
  },
  menu: {
    position: 'absolute',
    right: '10px',
    top: '60px',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    overflow: 'hidden',
    width: '220px',
    zIndex: 9999,
    pointerEvents: 'auto',
  },
  styleMenu: {
    position: 'absolute',
    right: '65px', // Ajusté pour ne pas chevaucher le menu utilisateur
    top: '60px',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    overflow: 'hidden',
    width: '220px',
    zIndex: 9999,
    pointerEvents: 'auto',
  },
  menuItem: {
    padding: '12px 20px',
    cursor: 'pointer',
    borderBottom: '1px solid #f0f0f0',
    backgroundColor: 'white',
    transition: 'background 0.2s',
    fontSize: '15px',
    color: '#333',
    display: 'flex',
    alignItems: 'center',
  },
  authButtons: {
    display: 'flex',
    gap: '10px',
    pointerEvents: 'auto',
  },
};

styles.actionButton[':hover'] = {
  backgroundColor: '#666',
  transform: 'translateY(-2px)',
};

styles.logoButton[':hover'] = {
  backgroundColor: '#666',
  transform: 'translateY(-2px)',
};

styles.menuItem[':hover'] = {
  backgroundColor: '#f5f5f5',
};

export default Header;
