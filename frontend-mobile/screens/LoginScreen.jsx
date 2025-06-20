import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  SafeAreaView, 
  Animated, 
  Dimensions,
  Platform,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import apiService from '../services/api';
import GoogleAuthButton from '../services/auth/GoogleAuthButton';
import axios from 'axios';
import authService from '../services/auth/auth';

const { width } = Dimensions.get('window');
const isTablet = width > 768;
const API_URL = apiService.API_URL;

const LoginScreen = ({ navigation, route }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);

  // Animation values
  const fadeIn = new Animated.Value(0);
  const slideUp = new Animated.Value(50);
  
  // Route redirect params
  const redirectAfterLogin = route.params?.redirectAfterLogin;
  const locationLat = route.params?.locationLat;
  const locationLng = route.params?.locationLng;

  useEffect(() => {
    // Start animations when component mounts
    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideUp, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    // Configurer le gestionnaire d'URL pour les redirections
    const handleDeepLink = async (event) => {
      try {
        const url = event.url || event;
        console.log('Deep link reçu:', url);
  
        if (typeof url === 'string' && url.includes('token=')) {
          // Extraire le token de l'URL
          const tokenParam = url.split('token=')[1];
          if (!tokenParam) return;
  
          const token = tokenParam.split('&')[0];
          console.log('Token extrait:', token.substring(0, 10) + '...');
          
          // Sauvegarder le token dans AsyncStorage au lieu de SecureStore
          await authService.setAuthData({ token });

          
          // Rediriger vers la page appropriée
          handleRedirectAfterLogin();
        }
      } catch (error) {
        console.error('Erreur lors du traitement du deep link:', error);
      }
    };
  
    // Récupérer l'URL initiale si l'app a été ouverte via une URL
    Linking.getInitialURL().then(url => {
      if (url) handleDeepLink({ url });
    });
  
    // Écouter les URLs entrantes
    const subscription = Linking.addEventListener('url', handleDeepLink);
  
    return () => {
      subscription.remove();
    };
  }, []);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleLogin = async () => {
    setError('');
    setLoading(true);

    try {
      // Use apiService instead of direct axios for consistency
      const response = await apiService.auth.login(formData);

      console.log('Réponse login:', response);

          await authService.setAuthData({
        token: response.token,
        user: response.user
      });


      // Navigate to appropriate screen after login
      handleRedirectAfterLogin();
      
    } catch (err) {
      console.error('Erreur de connexion:', err);
      setError(err.response?.data?.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (result) => {
    console.log('Google Auth success:', result);
    try {
      // Sauvegarder token et rediriger dans AsyncStorage au lieu de SecureStore
      await authService.setAuthData({
          token: result.token,
          user: result.user
        });

      handleRedirectAfterLogin();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des données de session:', error);
      setError('Erreur lors de la connexion. Veuillez réessayer.');
    }
  };

  const handleGoogleError = (error) => {
    console.error('Google Auth error:', error);
    setError('Erreur lors de l\'authentification Google');
  };

  const handleRedirectAfterLogin = () => {
    if (redirectAfterLogin === 'ReportIncident') {
      navigation.navigate('ReportIncident', {
        locationLat, 
        locationLng
      });
    } else if (redirectAfterLogin) {
      navigation.navigate(redirectAfterLogin);
    } else {
      navigation.navigate('Map');
    }
  };


  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <SafeAreaView style={styles.safeArea}>
          <Animated.View 
            style={[
              styles.mainContainer, 
              { 
                opacity: fadeIn,
                transform: [{ translateY: slideUp }]
              }
            ]}
          >
            {/* Left Panel (Login Form) */}
            <View style={styles.leftPanel}>
              <View style={styles.header}>
                <Text style={styles.logo}>SupMap</Text>
                <Text style={styles.tagline}>Connectez-vous pour naviguer</Text>
              </View>
              
              <View style={styles.loginCard}>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={22} color="#888" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Votre email"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={formData.email}
                    onChangeText={(text) => handleInputChange('email', text)}
                  />
                </View>
                
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={22} color="#888" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Mot de passe"
                    secureTextEntry
                    value={formData.password}
                    onChangeText={(text) => handleInputChange('password', text)}
                  />
                </View>
                
                {error ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={20} color="#D32F2F" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}
                
                <TouchableOpacity 
                  style={styles.loginButton} 
                  onPress={handleLogin}
                  disabled={loading || socialLoading}
                >
                  {loading ? (
                    <View style={styles.buttonContent}>
                      <ActivityIndicator size="small" color="#FFF" />
                      <Text style={styles.buttonText}>Navigation en cours...</Text>
                    </View>
                  ) : (
                    <Text style={styles.buttonText}>Commencer le voyage</Text>
                  )}
                </TouchableOpacity>
                
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>ou</Text>
                  <View style={styles.dividerLine} />
                </View>
                
                <View style={styles.socialButtonsContainer}>
                  {/* Remplacer le TouchableOpacity par GoogleAuthButton */}
                  <GoogleAuthButton 
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                    isLoading={socialLoading}
                    setIsLoading={setSocialLoading}
                  />
                </View>
                
                <TouchableOpacity 
                  style={styles.registerLink}
                  onPress={() => navigation.navigate('Register')}
                  disabled={loading || socialLoading}
                >
                  <Text style={styles.registerText}>
                    Pas encore de compte ? <Text style={styles.registerHighlight}>S'inscrire</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            
            {/* Right Panel (Decorative Background) */}
            <View style={styles.rightPanel}>
              <View style={styles.gradientBackground}>
                <View style={styles.route1} />
                <View style={styles.route2} />
                <View style={styles.route3} />
                <View style={styles.floatingElement1} />
                <View style={styles.floatingElement2} />
                <View style={styles.floatingElement3} />
              </View>
            </View>
          </Animated.View>
        </SafeAreaView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F3F8',
  },
  scrollContainer: {
    flexGrow: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  mainContainer: {
    width: '100%',
    maxWidth: isTablet ? 900 : undefined,
    backgroundColor: 'white',
    borderRadius: 20,
    overflow: 'hidden',
    flexDirection: isTablet ? 'row' : 'column',
  },
  leftPanel: {
    width: isTablet ? '45%' : '100%',
    padding: isTablet ? 40 : 30,
  },
  rightPanel: {
    width: isTablet ? '55%' : '100%',
    height: isTablet ? undefined : 200,
    overflow: 'hidden',
  },
  header: {
    marginBottom: 30,
  },
  logo: {
    fontSize: 36,
    color: '#050F39',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  tagline: {
    color: '#050F39',
    fontSize: 16,
    opacity: 0.8,
  },
  loginCard: {
    width: '100%',
  },
  inputWrapper: {
    position: 'relative',
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  inputIcon: {
    marginRight: 10,
    marginLeft: 5,
  },
  input: {
    flex: 1,
    padding: 15,
    fontSize: 16,
  },
  errorBox: {
    backgroundColor: '#FFE5E5',
    padding: 12,
    borderRadius: 10,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFB3B3',
  },
  errorText: {
    color: '#D32F2F',
    marginLeft: 8,
    fontSize: 14,
    flex: 1,
  },
  loginButton: {
    backgroundColor: '#050F39',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 5,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E5E5',
  },
  dividerText: {
    marginHorizontal: 15,
    color: '#888',
    fontSize: 14,
  },
  socialButtonsContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  googleButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    padding: 12,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  googleButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  registerLink: {
    marginTop: 10,
    alignItems: 'center',
  },
  registerText: {
    color: '#666',
    fontSize: 14,
  },
  registerHighlight: {
    color: '#1A73E8',
    fontWeight: 'bold',
  },
  gradientBackground: {
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#7AADEB', // Couleur de base au lieu du gradient
  },
  route1: {
    position: 'absolute',
    width: isTablet ? 500 : 300,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    top: '30%',
    left: '-10%',
    transform: [{ rotate: '-8deg' }],
  },
  route2: {
    position: 'absolute',
    width: isTablet ? 400 : 250,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    top: '65%',
    left: '10%',
    transform: [{ rotate: '5deg' }],
  },
  route3: {
    position: 'absolute',
    width: isTablet ? 300 : 200,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    top: '48%',
    left: '20%',
    transform: [{ rotate: '-2deg' }],
  },
  floatingElement1: {
    position: 'absolute',
    width: 60,
    height: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 15,
    top: '20%',
    right: '20%',
    transform: [{ rotate: '5deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
  },
  floatingElement2: {
    position: 'absolute',
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 12,
    bottom: '30%',
    right: '15%',
    transform: [{ rotate: '-8deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  floatingElement3: {
    position: 'absolute',
    width: 50,
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 14,
    top: '50%',
    left: '15%',
    transform: [{ rotate: '-3deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 4,
  },
});

export default LoginScreen;