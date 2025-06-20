
import React from 'react';
import { Link } from 'react-router-dom';
import { FaMapMarkerAlt, FaChartLine, FaUserEdit, FaTrophy, FaExclamationTriangle, FaVoteYea } from 'react-icons/fa';

const OverviewPage = ({ user, stats }) => {
  // Sélectionner quelques badges à afficher sur la vue d'ensemble
  const highlightedBadges = stats.badges.slice(0, 3);
  
  return (
    <div className="overview-content">
      <div className="welcome-card">
        <div className="welcome-text">
          <h2>Bienvenue, {user?.username} !</h2>
          <p>Voici un résumé de votre activité sur GéoAlert</p>
        </div>
        <div className="last-activity">
          <p>Dernière connexion: {new Date().toLocaleDateString()}</p>
        </div>
      </div>
      
      <div className="overview-row">
        <div className="overview-card">
          <div className="card-icon">
            <FaExclamationTriangle />
          </div>
          <div className="card-content">
            <h3>Incidents signalés</h3>
            <div className="card-value">{stats.incidents}</div>
          </div>
        </div>
        
        <div className="overview-card">
          <div className="card-icon">
            <FaVoteYea />
          </div>
          <div className="card-content">
            <h3>Votes soumis</h3>
            <div className="card-value">{stats.votes}</div>
          </div>
        </div>
        
        <div className="overview-card">
          <div className="card-icon">
            <FaTrophy />
          </div>
          <div className="card-content">
            <h3>Badges</h3>
            <div className="card-value">{stats.badges.length}</div>
          </div>
        </div>
      </div>
      
      <div className="overview-row">
        <div className="overview-card large">
          <h3>Badges récents</h3>
          {highlightedBadges.length > 0 ? (
            <div className="badges-preview">
              {highlightedBadges.map((badge, index) => (
                <div key={index} className={`badge-item ${badge.color}`}>
                  {badge.icon}
                  <span>{badge.label}</span>
                </div>
              ))}
              {stats.badges.length > 3 && (
                <div className="more-badges" onClick={() => window.location.href = '#/stats'}>
                  +{stats.badges.length - 3} autres
                </div>
              )}
            </div>
          ) : (
            <p className="no-data">Vous n'avez pas encore obtenu de badges.</p>
          )}
        </div>
        
        <div className="overview-card large">
          <h3>Accès rapides</h3>
          <div className="quick-actions">
            <div className="action-button" onClick={() => window.location.href = '/'}>
              <FaMapMarkerAlt />
              <span>Carte</span>
            </div>
            
            <div className="action-button" onClick={() => window.location.href = '#/profile'}>
              <FaUserEdit />
              <span>Modifier profil</span>
            </div>
            
            <div className="action-button" onClick={() => window.location.href = '#/stats'}>
              <FaChartLine />
              <span>Statistiques</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="overview-card large">
        <h3>Derniers incidents signalés</h3>
        {stats.incidents > 0 ? (
          <table className="incidents-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Date</th>
                <th>Statut</th>
                <th>Votes</th>
              </tr>
            </thead>
            <tbody>
              {/* Données fictives pour exemple */}
              <tr>
                <td>Accident</td>
                <td>{new Date().toLocaleDateString()}</td>
                <td>Actif</td>
                <td>+5</td>
              </tr>
              <tr>
                <td>Embouteillage</td>
                <td>{new Date(Date.now() - 86400000).toLocaleDateString()}</td>
                <td>Expiré</td>
                <td>+3</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p className="no-data">Vous n'avez pas encore signalé d'incidents.</p>
        )}
      </div>
    </div>
  );
};

export default OverviewPage;