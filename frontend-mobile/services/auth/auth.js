// services/auth/auth.js
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Clés pour le stockage
const TOKEN_KEY = 'userToken';
const USER_INFO_KEY = 'userInfo';

// Liste des clés sensibles qui doivent utiliser SecureStore
const SECURE_KEYS = [TOKEN_KEY];

const authService = {
  // Stocke les données d'authentification
  setAuthData: async (authData) => {
    try {
      // Token dans SecureStore (chiffré)
      if (authData.token) {
        await SecureStore.setItemAsync(TOKEN_KEY, authData.token);
      }
      
      // UserInfo dans AsyncStorage (non sensible)
      if (authData.user) {
        await AsyncStorage.setItem(USER_INFO_KEY, JSON.stringify(authData.user));
      }
      
      return { success: true };
    } catch (error) {
      console.error('Erreur setAuthData:', error);
      return { success: false, error };
    }
  },

  // Récupère le token JWT (utilisé par l'intercepteur API)
  getToken: async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      return token;
    } catch (error) {
      console.error('Erreur getToken:', error);
      return null;
    }
  },

  // Récupère les infos utilisateur
  getUserInfo: async () => {
    try {
      const userInfoString = await AsyncStorage.getItem(USER_INFO_KEY);
      return userInfoString ? JSON.parse(userInfoString) : null;
    } catch (error) {
      console.error('Erreur getUserInfo:', error);
      return null;
    }
  },

  // Met à jour les infos utilisateur
  setUserInfo: async (userInfo) => {
    try {
      await AsyncStorage.setItem(USER_INFO_KEY, JSON.stringify(userInfo));
      return { success: true };
    } catch (error) {
      console.error('Erreur setUserInfo:', error);
      return { success: false, error };
    }
  },

  // Déconnexion (suppression des données)
  logout: async () => {
    try {
      // Supprimer le token sécurisé
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      
      // Supprimer les infos utilisateur
      await AsyncStorage.removeItem(USER_INFO_KEY);
      
      return { success: true };
    } catch (error) {
      console.error('Erreur logout:', error);
      return { success: false, error };
    }
  },
};

export default authService;