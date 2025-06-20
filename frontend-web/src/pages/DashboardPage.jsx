// DashboardPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  FaUser, FaChartBar, FaTachometerAlt, FaSignOutAlt, 
  FaMapMarkedAlt, FaCarAlt, FaExclamationTriangle, FaThumbsUp
} from 'react-icons/fa';
import ProfileContent from './ProfilePage';
import StatsContent from './StatsPage';
import OverviewContent from './OverviewPage';
import RecapPredictionPage from './RecapPredictionPage';
import './Dashboard.css';

const DashboardPage = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    incidents: 0,
    votes: 0,
    badges: []
  });
  
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      navigate('/login');
      return;
    }

    const fetchUserData = async () => {
      try {
        setLoading(true);
        const userResponse = await axios.get('http://localhost:3001/api/auth/verify', {
          headers: { Authorization: `Bearer ${token}` }
        });
    
        if (userResponse.data && userResponse.data.user) {
          const userData = userResponse.data.user;
          setUser(userData);
          
          // Vérifier les paramètres d'URL
          const searchParams = new URLSearchParams(window.location.search);
          const section = searchParams.get('section');
          if (section === 'recap') {
            setActiveTab('recap');
          }
    
          const statsRes = await axios.get(`http://localhost:3001/api/incidents/stats/${userData.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
    
          const statsData = statsRes.data?.stats || {};
          const ALL_INCIDENT_BADGES = ["10+ incidents", "20+ incidents", "30+ incidents"];
          const ALL_VOTE_BADGES = ["10+ votes", "20+ votes", "30+ votes"];
          
          const formattedBadges = [];
    
          ALL_INCIDENT_BADGES.forEach(badge => {
            formattedBadges.push({
              label: badge,
              color: (statsData.badges?.incidents || []).includes(badge) ? 'success' : 'disabled',
              icon: <FaExclamationTriangle />,
              category: 'incident'
            });
          });
            
          ALL_VOTE_BADGES.forEach(badge => {
            formattedBadges.push({
              label: badge,
              color: (statsData.badges?.votes || []).includes(badge) ? 'info' : 'disabled',
              icon: <FaThumbsUp />,
              category: 'vote'
            });
          });
            
          // Ancienneté
          const creationDate = new Date(userData.created_at || Date.now());
          const now = new Date();
          const monthsDiff = (now.getFullYear() - creationDate.getFullYear()) * 12 +
                            (now.getMonth() - creationDate.getMonth());
    
          if (monthsDiff >= 6) {
            formattedBadges.push({
              label: 'Membre depuis 6 mois',
              color: 'warning',
              icon: <FaMapMarkedAlt />
            });
          }
    
          if (monthsDiff >= 12) {
            formattedBadges.push({
              label: 'Membre depuis 1 an',
              color: 'primary',
              icon: <FaMapMarkedAlt />
            });
          }
    
          setStats({
            incidents: statsData.incidentsReported || 0,
            votes: statsData.votesCast || 0,
            badges: formattedBadges
          });
        }
      } catch (err) {
        console.error('Erreur récupération des statistiques:', err);
        setStats({ incidents: 0, votes: 0, badges: [] });
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <h3>Chargement de votre profil...</h3>
      </div>
    );
  }

  // Contenu en fonction de l'onglet actif
  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileContent user={user} />;
      case 'stats':
        return <StatsContent stats={stats} userId={user ? user.id : null} />;
      case 'recap':
        return <RecapPredictionPage userId={user ? user.id : null} />;
      case 'overview':
      default:
        return <OverviewContent user={user} stats={stats} />;
    }
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-sidebar">
        <div className="sidebar-header">
          <FaMapMarkedAlt size={32} />
          <h2>GéoAlert</h2>
        </div>
        
        <div className="sidebar-user">
          <div className="user-avatar">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="Avatar" />
            ) : (
              <FaUser size={24} />
            )}
          </div>
          <div className="user-info">
            <h3>{user?.username}</h3>
            <p>{user?.email}</p>
          </div>
        </div>
        
        <nav className="sidebar-nav">
          <ul>
            <li 
              className={activeTab === 'overview' ? 'active' : ''} 
              onClick={() => setActiveTab('overview')}
            >
              <FaTachometerAlt />
              <span>Tableau de bord</span>
            </li>
            <li 
              className={activeTab === 'profile' ? 'active' : ''} 
              onClick={() => setActiveTab('profile')}
            >
              <FaUser />
              <span>Profil</span>
            </li>
            <li 
              className={activeTab === 'stats' ? 'active' : ''} 
              onClick={() => setActiveTab('stats')}
            >
              <FaChartBar />
              <span>Statistiques</span>
            </li>
            <li 
              className={activeTab === 'recap' ? 'active' : ''} 
              onClick={() => setActiveTab('recap')}
            >
              <FaMapMarkedAlt />
              <span>Récapitulatif & Prédiction</span>
            </li>
          </ul>
        </nav>
        
        <div className="sidebar-footer">
          <button className="logout-button" onClick={handleLogout}>
            <FaSignOutAlt />
            <span>Déconnexion</span>
          </button>
        </div>
      </div>
      
      <div className="dashboard-content">
        <div className="content-header">
          <h1>
            {activeTab === 'overview' && 'Tableau de bord'}
            {activeTab === 'profile' && 'Mon Profil'}
            {activeTab === 'stats' && 'Mes Statistiques'}
            {activeTab === 'recap' && 'Récapitulatif & Prédiction'}
          </h1>
        </div>
        
        <div className="content-body">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;