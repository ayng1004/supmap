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
  KeyboardAvoidingView,
  ScrollView,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import apiService from '../services/api';
import authService from '../services/auth/auth';
const { width } = Dimensions.get('window');
const isTablet = width > 768;

const RegisterScreen = ({ navigation, route }) => {
  // Récupérer les paramètres de redirection si présents
  const redirectAfterRegister = route?.params?.redirectAfterRegister;
  const locationLat = route?.params?.locationLat;
  const locationLng = route?.params?.locationLng;

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Animation values
  const fadeIn = new Animated.Value(0);
  const slideUp = new Animated.Value(50);

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
  }, []);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateForm = () => {
    if (!formData.username || !formData.email || !formData.password || !formData.confirmPassword) {
      setError('Veuillez remplir tous les champs');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return false;
    }

    if (formData.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Veuillez saisir une adresse email valide');
      return false;
    }

    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setError('');
    setLoading(true);

    try {
      // Utiliser une approche directe similaire à la version web
      const registerData = {
        username: formData.username,
        email: formData.email,
        password: formData.password
      };
      
      console.log('Tentative d\'inscription avec:', registerData.email);
      
      // Utiliser directement l'endpoint /auth/register
      const API_URL = apiService.API_URL;
      const response = await axios.post(`${API_URL}/auth/register`, registerData, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      console.log('Réponse d\'inscription:', response.data);
      
      if (response.data && response.data.token) {
          console.log('Inscription réussie, token reçu');
          
          // Utiliser authService pour stocker les données d'authentification
          await authService.setAuthData({
            token: response.data.token,
            user: response.data.user
          })
        
        // Afficher un message de succès avant la redirection
        Alert.alert(
          "Inscription réussie",
          "Votre compte a été créé avec succès!",
          [
            { 
              text: "OK", 
              onPress: () => handleRedirectAfterRegister() 
            }
          ]
        );
      } else {
        console.log('Inscription échouée, aucun token reçu');
        setError('Erreur lors de l\'inscription');
      }
    } catch (err) {
      console.error('Erreur d\'inscription:', err);
      
      // Extraire le message d'erreur de la réponse si disponible
      if (err.response && err.response.data) {
        if (err.response.data.message) {
          setError(err.response.data.message);
        } else if (err.response.status === 409) {
          setError('Cet email est déjà utilisé');
        } else {
          setError('Erreur lors de l\'inscription');
        }
      } else {
        setError('Erreur de connexion au serveur');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRedirectAfterRegister = () => {
    if (redirectAfterRegister === 'ReportIncident') {
      navigation.navigate('ReportIncident', {
        locationLat, 
        locationLng
      });
    } else if (redirectAfterRegister) {
      navigation.navigate(redirectAfterRegister);
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
            {/* Left Panel (Registration Form) */}
            <View style={styles.leftPanel}>
              <View style={styles.header}>
                <Text style={styles.logo}>SupMap</Text>
                <Text style={styles.tagline}>Créez votre compte</Text>
              </View>
              
              <View style={styles.registerCard}>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={22} color="#888" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Votre nom d'utilisateur"
                    autoCapitalize="none"
                    value={formData.username}
                    onChangeText={(text) => handleInputChange('username', text)}
                  />
                </View>
                
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
                
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={22} color="#888" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirmez le mot de passe"
                    secureTextEntry
                    value={formData.confirmPassword}
                    onChangeText={(text) => handleInputChange('confirmPassword', text)}
                  />
                </View>
                
                {error ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={20} color="#D32F2F" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}
                
                <TouchableOpacity 
                  style={styles.registerButton} 
                  onPress={handleRegister}
                  disabled={loading}
                >
                  {loading ? (
                    <View style={styles.buttonContent}>
                      <ActivityIndicator size="small" color="#FFF" />
                      <Text style={styles.buttonText}>Création en cours...</Text>
                    </View>
                  ) : (
                    <Text style={styles.buttonText}>Créer mon compte</Text>
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.loginLink}
                  onPress={() => navigation.navigate('Login')}
                >
                  <Text style={styles.loginText}>
                    Déjà inscrit ? <Text style={styles.loginHighlight}>Se connecter</Text>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
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
    display: isTablet ? 'flex' : 'none', // Cacher sur mobile pour gain de place
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
  registerCard: {
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
  registerButton: {
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
  loginLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  loginText: {
    color: '#666',
    fontSize: 14,
  },
  loginHighlight: {
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

export default RegisterScreen;