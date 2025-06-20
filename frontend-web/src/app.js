import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MapPage from './pages/MapPage';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import PrivateRoute from './components/PrivateRoute';
import Header from './components/navigation/Header';
import OAuthSuccess from './pages/OAuthSuccess';
import { AuthProvider } from './context/AuthProvider'; 
import { cleanExpiredIncidents } from './services/IncidentService';
import StatsPage from './pages/StatsPage';
import ThemeToggle from './components/ThemeToggle';
import DashboardPage from './pages/DashboardPage';
import RecapPredictionPage from './pages/RecapPredictionPage'; // Importer le composant

import './polyfills';

// Appel initial pour nettoyer les incidents expirés au démarrage
cleanExpiredIncidents();

function App() {
  useEffect(() => {
    // Nettoyer les incidents expirés au démarrage du composant
    cleanExpiredIncidents();

    // Configurer un nettoyage périodique
    const cleanupInterval = setInterval(() => {
      cleanExpiredIncidents();
    }, 30 * 60 * 1000); // Toutes les 30 minutes

    // Nettoyer l'intervalle lors du démontage du composant
    return () => {
      clearInterval(cleanupInterval);
    };
  }, []);

  return (
    <AuthProvider>
      <Router>
        <Header />
        <div className="app">
          <Routes>
            <Route path="/" element={<MapPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/recap" element={<RecapPredictionPage />} /> {/* Ajouter la route */}

            <Route
              path="/profile"
              element={
                <PrivateRoute>
                  <ProfilePage />
                </PrivateRoute>
              }
            />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/oauth-success" element={<OAuthSuccess />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;