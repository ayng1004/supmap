import React, { createContext, useState, useEffect, useContext } from 'react';
import apiService from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Créer le contexte
const IncidentContext = createContext();

// Hook personnalisé pour utiliser le contexte
export const useIncidents = () => useContext(IncidentContext);

// Composant Provider
export const IncidentProvider = ({ children }) => {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [userVotes, setUserVotes] = useState({});

  // Fonction pour charger tous les incidents
  const loadIncidents = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await apiService.incidents.getAll();
      
      if (Array.isArray(data)) {
        // S'assurer que chaque incident a une propriété votes
        const processedIncidents = data.map(incident => ({
          ...incident,
          votes: incident.votes || { up: 0, down: 0 }
        }));
        
        setIncidents(processedIncidents);
        
        // Sauvegarder dans le stockage local pour un accès hors ligne
        await AsyncStorage.setItem('cached_incidents', JSON.stringify(processedIncidents));
      } else {
        throw new Error('Format de données invalide');
      }
    } catch (err) {
      console.error('Erreur lors du chargement des incidents:', err);
      setError('Impossible de charger les incidents');
      
      // Tenter de récupérer les incidents mis en cache précédemment
      try {
        const cachedData = await AsyncStorage.getItem('cached_incidents');
        if (cachedData) {
          setIncidents(JSON.parse(cachedData));
        }
      } catch (cacheError) {
        console.error('Erreur lors de la récupération du cache:', cacheError);
      }
    } finally {
      setLoading(false);
    }
  };

  // Charger les incidents au démarrage
  useEffect(() => {
    loadIncidents();
  }, [lastRefresh]);

  // Fonction pour rafraîchir les incidents
  const refreshIncidents = () => {
    setLastRefresh(Date.now());
  };

  // Fonction pour mettre à jour un incident spécifique
  const updateIncident = async (incidentId) => {
    try {
      // Récupérer l'incident mis à jour depuis l'API
      const updatedIncident = await apiService.incidents.getById(incidentId);
      
      // Mettre à jour l'incident dans la liste
      setIncidents(prev => 
        prev.map(inc => 
          inc.id === incidentId ? { ...inc, ...updatedIncident } : inc
        )
      );
      
      return updatedIncident;
    } catch (error) {
      console.error(`Erreur lors de la mise à jour de l'incident ${incidentId}:`, error);
      throw error;
    }
  };

  // Fonction pour voter pour un incident
  const voteForIncident = async (incidentId, isConfirmed) => {
    try {
      // Enregistrer le vote via l'API
      const result = await apiService.incidents.vote(incidentId, isConfirmed);
      
      // Mettre à jour l'état des votes de l'utilisateur
      setUserVotes(prev => ({
        ...prev,
        [incidentId]: isConfirmed ? 'up' : 'down'
      }));
      
      // Mettre à jour l'incident
      await updateIncident(incidentId);
      
      return result;
    } catch (error) {
      console.error(`Erreur lors du vote pour l'incident ${incidentId}:`, error);
      throw error;
    }
  };

  // Fonction pour ajouter un nouvel incident
  const addIncident = (newIncident) => {
    setIncidents(prev => {
      // Vérifier si l'incident existe déjà
      const exists = prev.some(inc => inc.id === newIncident.id);
      if (!exists) {
        // Ajouter le nouvel incident
        const updatedIncidents = [...prev, {
          ...newIncident,
          votes: newIncident.votes || { up: 0, down: 0 }
        }];
        
        // Mettre à jour le cache
        AsyncStorage.setItem('cached_incidents', JSON.stringify(updatedIncidents))
          .catch(err => console.error('Erreur lors de la mise à jour du cache:', err));
        
        return updatedIncidents;
      }
      return prev;
    });
  };

  // Valeur à fournir via le contexte
  const value = {
    incidents,
    loading,
    error,
    userVotes,
    refreshIncidents,
    updateIncident,
    voteForIncident,
    addIncident
  };

  return (
    <IncidentContext.Provider value={value}>
      {children}
    </IncidentContext.Provider>
  );
};

export default IncidentContext;