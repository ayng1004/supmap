import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator, 
  Linking,
  Alert,
  Platform
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import axios from 'axios';
import apiService from '../api';

// Fonction pour générer un ID de session unique
const generateSessionId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

// Fonctions d'authentification OAuth avec Google
export const GoogleAuth = {
  // Initialiser l'authentification Google
  initGoogleAuth: async () => {
    try {
      // Générer un ID de session unique
      const sessionId = generateSessionId();
      console.log('Session ID généré:', sessionId);
      
      // Faire une requête POST à votre backend pour initialiser l'authentification
      console.log('Initialisation de l\'authentification Google avec POST...');
      const response = await apiService.auth.googleAuthInit({
        sessionId,
        platform: Platform.OS
      });
      
      console.log('Réponse d\'initialisation Google auth:', response);
      
      if (response.success && response.authUrl) {
        return {
          sessionId,
          authUrl: response.authUrl
        };
      } else {
        throw new Error('Réponse d\'initialisation invalide');
      }
    } catch (error) {
      console.error('Erreur lors de l\'initialisation de l\'authentification Google:', error);
      throw error;
    }
  },
  
  // Vérifier le statut de l'authentification Google
  checkAuthStatus: async (sessionId) => {
    try {
      console.log('Vérification du statut de l\'authentification pour la session:', sessionId);
      const response = await apiService.auth.checkGoogleAuthStatus(sessionId);
      
      console.log('Réponse de vérification du statut:', response);
      
      if (response.success && response.completed) {
        // Si l'authentification est complétée, stocker le token et les infos utilisateur
        await SecureStore.setItemAsync('userToken', response.token);
        await SecureStore.setItemAsync('userInfo', JSON.stringify(response.user));
        
        return {
          success: true,
          token: response.token,
          user: response.user
        };
      }
      
      return {
        success: false,
        completed: response.completed || false
      };
    } catch (error) {
      console.error('Erreur lors de la vérification du statut d\'authentification:', error);
      throw error;
    }
  },
  
  // Ouvrir l'URL d'authentification dans un navigateur web
  openAuthUrl: async (authUrl) => {
  try {
    console.log('Ouverture de l\'URL d\'authentification:', authUrl);
    
    // Utiliser le navigateur système pour tous les appareils
    await Linking.openURL(authUrl);
    
    // Afficher une alerte pour guider l'utilisateur
    Alert.alert(
      "Authentification Google",
      "Après vous être connecté dans le navigateur, revenez à l'application pour terminer l'authentification."
    );
    
    return true;
  } catch (error) {
    console.error('Erreur lors de l\'ouverture de l\'URL d\'authentification:', error);
    throw error;
  }
}
};

// Composant d'authentification Google
const GoogleAuthButton = ({ onSuccess, onError, isLoading, setIsLoading }) => {
  const [authInProgress, setAuthInProgress] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [statusCheckInterval, setStatusCheckInterval] = useState(null);
  
  // Nettoyer les intervalles à la fermeture
  useEffect(() => {
    return () => {
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
      }
    };
  }, [statusCheckInterval]);
  
  // Fonction pour gérer le processus d'authentification Google
  const handleGoogleAuth = async () => {
    try {
      if (isLoading || authInProgress) return;
      
      setIsLoading(true);
      setAuthInProgress(true);
      
      // Étape 1: Initialiser l'authentification
      const authInitResult = await GoogleAuth.initGoogleAuth();
      console.log('Authentification initialisée:', authInitResult);
      
      if (!authInitResult || !authInitResult.authUrl) {
        throw new Error('Échec de l\'initialisation de l\'authentification');
      }
      
      setSessionId(authInitResult.sessionId);
      
      // Étape 2: Ouvrir l'URL d'authentification dans un navigateur
      const browserOpened = await GoogleAuth.openAuthUrl(authInitResult.authUrl);
      
      if (!browserOpened) {
        setAuthInProgress(false);
        setIsLoading(false);
        return;
      }
      
      // Étape 3: Vérifier périodiquement le statut de l'authentification
      const interval = setInterval(async () => {
        try {
          const statusResult = await GoogleAuth.checkAuthStatus(authInitResult.sessionId);
          
          if (statusResult.success && statusResult.token) {
            // Authentification réussie
            clearInterval(interval);
            setAuthInProgress(false);
            setIsLoading(false);
            onSuccess(statusResult);
          }
        } catch (error) {
          console.error('Erreur lors de la vérification du statut:', error);
          clearInterval(interval);
          setAuthInProgress(false);
          setIsLoading(false);
          onError(error);
        }
      }, 2000); // Vérifier toutes les 2 secondes
      
      setStatusCheckInterval(interval);
      
      // Arrêter la vérification après 2 minutes si aucun résultat
      setTimeout(() => {
        if (authInProgress) {
          clearInterval(interval);
          setAuthInProgress(false);
          setIsLoading(false);
          Alert.alert(
            "Authentification expirée",
            "La session d'authentification a expiré. Veuillez réessayer."
          );
        }
      }, 120000); // 2 minutes
      
    } catch (error) {
      console.error('Erreur d\'authentification Google:', error);
      setAuthInProgress(false);
      setIsLoading(false);
      onError(error);
    }
  };
  
  return (
    <TouchableOpacity
      style={styles.googleButton}
      onPress={handleGoogleAuth}
      disabled={isLoading || authInProgress}
    >
      {isLoading || authInProgress ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Text style={styles.buttonText}>Continuer avec Google</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  googleButton: {
    backgroundColor: '#4285F4',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
    marginVertical: 10,
    width: '100%'
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold'
  }
});

export default GoogleAuthButton;