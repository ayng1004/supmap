import React, { useRef, useContext, useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { AuthContext } from '../../context/AuthProvider';
import { INCIDENT_TYPES } from '../../services/IncidentService';
import incidentService from '../../services/IncidentService';
import './IncidentDetails.css';
import api from '../../services/api'; 
import { voteIncident } from '../../services/IncidentService';
const IncidentDetails = ({ incident, onClose, onVote, onRefresh }) => {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentIncident, setCurrentIncident] = useState(incident);
  const [localUserVoteType, setLocalUserVoteType] = useState(
    incidentService.getUserVoteType ? incidentService.getUserVoteType(incident, user?.id) : null
  );
  const [deleteLoading, setDeleteLoading] = useState(false);
  const popupContentRef = useRef();

  // Vérifier si l'utilisateur est admin (role_id === 1 ou role_name === 'Admin')
  const isAdmin = user && (user.role_id === 1 || user.role_name === 'Admin');

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  useEffect(() => {
    const fetchIncidentDetails = async () => {
      if (incident && incident.id) {
        try {
          const refreshedIncident = await incidentService.getIncidentById(incident.id);
          if (refreshedIncident) {
            setCurrentIncident(refreshedIncident);
            if (user && user.id) {
              try {
                const hasVoted = await incidentService.hasUserVotedServer(incident.id, user.id);
                if (hasVoted) {
                  const response = await api.get(`/api/incidents/${incident.id}/votes/${user.id}`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                  });
                  if (response.data && response.data.hasVoted) {
                    setLocalUserVoteType(response.data.voteType || 'up');
                  }
                } else {
                  setLocalUserVoteType(null);
                }
              } catch (err) {
                console.error("Erreur lors de la vérification du vote:", err);
                setLocalUserVoteType(null);
              }
            }
          }
        } catch (err) {
          console.error("Erreur lors du rafraîchissement des détails de l'incident:", err);
        }
      }
    };
    fetchIncidentDetails();
  }, [incident, user]);

// ÉTAPE 1: Dans votre fichier IncidentDetails.jsx, localisez la fonction handleVote actuelle
// qui ressemble à ceci:


// ÉTAPE 2: Remplacez-la ENTIÈREMENT par cette nouvelle version:

const handleVote = async (isConfirmed) => {
  try {
    setLoading(true);
    setError(null);
    
    // Vérifier si l'utilisateur est connecté
    if (!user) {
      setError('Vous devez être connecté pour voter');
      return;
    }
    
    console.log(`Vote ${isConfirmed ? 'positif' : 'négatif'} pour incident ${currentIncident.id}`);
    
    // Récupérer le token et faire l'appel API directement
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Session expirée, veuillez vous reconnecter');
      return;
    }
    
    // Faire l'appel API directement sans passer par voteIncident
    const response = await api.post(
      `/api/incidents/${currentIncident.id}/vote`,
      { is_confirmed: isConfirmed },
      { 
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        } 
      }
    );
    
    console.log('Réponse du vote:', response.data);
    
    // Mettre à jour les votes localement
    const updatedIncident = {
      ...currentIncident,
      votes: {
        up: isConfirmed 
          ? (currentIncident.votes?.up || 0) + 1 
          : (currentIncident.votes?.up || 0),
        down: !isConfirmed 
          ? (currentIncident.votes?.down || 0) + 1 
          : (currentIncident.votes?.down || 0)
      }
    };
    
    setCurrentIncident(updatedIncident);
    setLocalUserVoteType(isConfirmed ? 'up' : 'down');
    
    // Rafraîchir les données si nécessaire
    if (onRefresh) {
      onRefresh();
    }
    
    // Fermer le détail d'incident si nécessaire
    if (onClose) {
      onClose();
    }
    
  } catch (error) {
    console.error('Erreur de vote:', error);
    
    // Message d'erreur adapté
    let errorMessage = 'Une erreur est survenue lors du vote';
    
    if (error.response) {
      const status = error.response.status;
      if (status === 401) {
        errorMessage = 'Vous devez être connecté pour voter';
      } else if (status === 403) {
        errorMessage = 'Vous ne pouvez pas voter sur votre propre incident';
      } else if (status === 409) {
        errorMessage = 'Vous avez déjà voté sur cet incident';
      } else if (error.response.data?.message) {
        errorMessage = error.response.data.message;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    setError(errorMessage);
  } finally {
    setLoading(false);
  }
};



useEffect(() => {
  // Diagnostic de l'authentification
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  
  console.log('État de l\'authentification:');
  console.log('- Token présent:', token ? 'Oui' : 'Non');
  console.log('- User présent:', user ? 'Oui' : 'Non');
  
  if (token && user) {
    const userData = JSON.parse(user);
    console.log('- Utilisateur:', userData.username || userData.email);
    console.log('- ID utilisateur:', userData.id);
  }
  
  // Visualisation du début du token (pour débogage)
  if (token) {
    console.log('- Début du token:', token.substring(0, 20) + '...');
  }
}, []);

  // Nouvelle fonction pour gérer la suppression d'incident
  const handleDeleteIncident = async () => {
    try {
      if (!isAdmin) {
        setError('Vous devez être administrateur pour supprimer un incident');
        return;
      }

      if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet incident ? Cette action est irréversible.')) {
        return;
      }

      setDeleteLoading(true);
      setError(null);

      // Appel au service pour supprimer l'incident
      await incidentService.deleteIncident(incident.id);
      
      // Fermer la popup et rafraîchir la liste si nécessaire
      onClose();
      if (onRefresh) {
        onRefresh();
      }
    } catch (err) {
      setError(err.message || 'Erreur lors de la suppression');
      console.error('Erreur de suppression:', err);
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!currentIncident) {
    return (
      <div className="incident-popup">
        <div className="incident-popup-content">
          <h2>Erreur</h2>
          <p>Incident non trouvé.</p>
          <button className="popup-close-btn" onClick={onClose}>Fermer</button>
        </div>
      </div>
    );
  }

  const typeInfo = INCIDENT_TYPES[currentIncident.type?.toUpperCase()] || INCIDENT_TYPES.HAZARD;
  const reliability = incidentService.calculateReliability 
    ? incidentService.calculateReliability(currentIncident) 
    : 50; 

  let canVote = true;
  let reason = '';

  if (incidentService.canUserVote) {
    const result = incidentService.canUserVote(currentIncident, user?.id);
    canVote = result.canVote;
    reason = result.reason;
  } else {
    if (!user) {
      canVote = false;
      reason = "Vous devez être connecté pour voter";
    } else if (currentIncident.userId === user.id || currentIncident.reported_by === user.id) {
      canVote = false;
      reason = "Vous ne pouvez pas voter sur votre propre incident";
    }
  }

  if (user && localUserVoteType === null) {
    canVote = true;
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Date inconnue';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('fr-FR', {
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return 'Date invalide';
    }
  };

  const isAuthor = user ? (
    (currentIncident.userId && currentIncident.userId === user.id) || 
    (currentIncident.reported_by && currentIncident.reported_by === user.id)
  ) : false;

  return ReactDOM.createPortal(
    <div className="incident-popup" onClick={(e) => {
      if (popupContentRef.current && !popupContentRef.current.contains(e.target)) {
        onClose();
      }
    }}>
      <div className="incident-popup-content" ref={popupContentRef}>
        <div className="popup-header" style={{ backgroundColor: typeInfo.color }}>
          <div className="popup-icon-container">
            <img src={typeInfo.icon} alt={typeInfo.label} className="popup-icon" />
          </div>
          <h2 className="popup-title">{typeInfo.label}</h2>
          <button className="popup-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="popup-body">
          <div className="incident-description">
            <p>{currentIncident.description || 'Pas de description'}</p>
          </div>

          <div className="incident-metadata">
            <div className="metadata-item">
              <span className="metadata-icon">🕒</span>
              <span>{formatDate(currentIncident.created_at || currentIncident.createdAt)}</span>
            </div>
            
            {(currentIncident.reporter?.name || currentIncident.reported_by) && (
              <div className="metadata-item">
                <span className="metadata-icon">👤</span>
                <span>{currentIncident.reporter?.name || currentIncident.reported_by}</span>
              </div>
            )}
            
            {currentIncident.address && (
              <div className="metadata-item">
                <span className="metadata-icon">📍</span>
                <span>{currentIncident.address}</span>
              </div>
            )}
          </div>
          
          <div className="incident-reliability">
            <div className="reliability-label">
              <span>Fiabilité: {reliability}%</span>
            </div>
            <div className="reliability-bar">
              <div 
                className="reliability-value" 
                style={{ 
                  width: `${reliability}%`, 
                  backgroundColor: reliability > 50 ? '#2ecc71' : '#e74c3c' 
                }}
              ></div>
            </div>
          </div>

          <div className="votes-summary">
            <div className="vote-count up">
              <span className="vote-icon">👍</span>
              <span className="vote-number">{currentIncident.votes?.up || 0}</span>
            </div>
            <div className="vote-count down">
              <span className="vote-icon">👎</span>
              <span className="vote-number">{currentIncident.votes?.down || 0}</span>
            </div>
          </div>

          <div className="vote-info">
            {!user && (
              <div className="info-message not-logged">
                <span className="info-icon">ℹ️</span>
                <span>Connectez-vous pour voter sur cet incident</span>
              </div>
            )}
            {user && localUserVoteType && (
              <div className="info-message voted">
                <span className="info-icon">ℹ️</span>
                <span>Vous avez déjà {localUserVoteType === 'up' ? 'confirmé' : 'infirmé'} cet incident</span>
              </div>
            )}
            {user && isAuthor && (
              <div className="info-message author">
                <span className="info-icon">ℹ️</span>
                <span>Vous êtes l'auteur de cet incident et ne pouvez pas voter</span>
              </div>
            )}
            {error && (
              <div className="info-message error">
                <span className="info-icon">⚠️</span>
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="voting-actions">
            {user ? (
              <>
                <button 
                  className={`vote-btn confirm ${localUserVoteType === 'up' ? 'active' : ''}`}
                  onClick={() => handleVote(true)}
                  disabled={loading || !canVote || localUserVoteType === 'up'}
                >
                  <span className="btn-icon">👍</span>
                  <span className="btn-text">{loading ? 'Chargement...' : 'Confirmer'}</span>
                </button>

                <button 
                  className={`vote-btn reject ${localUserVoteType === 'down' ? 'active' : ''}`}
                  onClick={() => handleVote(false)}
                  disabled={loading || !canVote || localUserVoteType === 'down'}
                >
                  <span className="btn-icon">👎</span>
                  <span className="btn-text">{loading ? 'Chargement...' : 'Infirmer'}</span>
                </button>
              </>
            ) : (
              <div className="login-required">
                <p>Vous devez être connecté pour voter sur cet incident</p>
              </div>
            )}
          </div>

          {/* Ajout du bouton de suppression pour les administrateurs */}
          {isAdmin && (
            <div className="admin-actions">
              <button 
                className="delete-btn"
                onClick={handleDeleteIncident}
                disabled={deleteLoading}
              >
                <span className="btn-icon">🗑️</span>
                <span className="btn-text">{deleteLoading ? 'Suppression...' : 'Supprimer cet incident'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default IncidentDetails;