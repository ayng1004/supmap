import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';  // Importer SecureStore pour les tokens
import MapboxGL from '@rnmapbox/maps';
import * as Location from 'expo-location';
import apiService from '../services/api';

// Importation des icônes
const INCIDENT_ICONS = {
  'traffic': require('../assets/icons/traffic.png'),
  'accident': require('../assets/icons/accident.png'),
  'hazard': require('../assets/icons/hazard.png'), 
  'police': require('../assets/icons/police.png'),
  'closure': require('../assets/icons/closure.png')
};

const INCIDENT_TYPES = [
  { id: 'traffic', title: 'Bouchon', color: '#FF9500', icon: 'traffic-light', description: 'Embouteillage important' },
  { id: 'accident', title: 'Accident', color: '#FF3B30', icon: 'car-crash', description: 'Accident de circulation' },
  { id: 'hazard', title: 'Danger', color: '#FF2D55', icon: 'exclamation-triangle', description: 'Obstacle ou danger sur la route' },
  { id: 'police', title: 'Police', color: '#34C759', icon: 'shield-alt', description: 'Contrôle policier' },
  { id: 'closure', title: 'Route fermée', color: '#5856D6', icon: 'road', description: 'Route ou voie fermée' },
];

// Composant moderne pour les boutons de type d'incident - les icônes restent avec leur couleur d'origine
const ModernTypeButton = ({ type, selected, onPress }) => {
  return (
    <TouchableOpacity 
      style={[
        styles.typeButton,
        selected && { 
          borderColor: type.color, 
          borderWidth: 2,
          shadowColor: type.color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 10,
          elevation: 5,
        }
      ]}
      onPress={onPress}
    >
      <View style={[
        styles.typeIconContainer,
        // Fond toujours blanc, la bordure du bouton change de couleur à la place
        { backgroundColor: '#f5f5f5' }
      ]}>
        <Image 
          source={INCIDENT_ICONS[type.id]} 
          style={styles.typeIconImage}
          resizeMode="contain"
        />
      </View>
      <Text style={[
        styles.typeText,
        selected && { color: type.color, fontWeight: 'bold' }
      ]}>
        {type.title}
      </Text>
    </TouchableOpacity>
  );
};

const ReportIncidentScreen = ({ route, navigation }) => {
  const { location } = route.params || {};
  const mapRef = useRef(null);
  const cameraRef = useRef(null);
  
  const [selectedType, setSelectedType] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(location || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [userToken, setUserToken] = useState(null); // State pour stocker le token

  // Récupérer les informations utilisateur et le token
  useEffect(() => {
    const loadUserData = async () => {
      try {
        // Charger les informations utilisateur
        const userInfoString = await AsyncStorage.getItem('userInfo');
        if (userInfoString) {
          setUserInfo(JSON.parse(userInfoString));
        }

        // Charger le token depuis SecureStore d'abord (c'est ce qu'utilise votre API)
        let token = await SecureStore.getItemAsync('userToken');
        if (!token) {
          // Essayer AsyncStorage comme fallback
          token = await AsyncStorage.getItem('userToken');
        }
        
        if (token) {
          setUserToken(token);
          console.log('Token d\'authentification chargé');
        } else {
          console.warn('Aucun token d\'authentification trouvé');
        }
      } catch (error) {
        console.error('Erreur lors du chargement des données utilisateur:', error);
      }
    };

    loadUserData();
    
    // Si aucune position n'est fournie, essayer d'obtenir la position actuelle
    if (!location) {
      (async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const locationResult = await Location.getCurrentPositionAsync({});
            setCurrentLocation([locationResult.coords.longitude, locationResult.coords.latitude]);
          }
        } catch (error) {
          console.error('Erreur lors de la récupération de la position:', error);
          Alert.alert(
            "Erreur de localisation",
            "Impossible d'obtenir votre position actuelle."
          );
        }
      })();
    }
  }, [location]);

  const handleSubmit = async () => {
    if (!selectedType) {
      Alert.alert('Erreur', 'Veuillez sélectionner un type d\'incident');
      return;
    }
    
    if (!currentLocation) {
      Alert.alert('Erreur', 'Impossible de déterminer votre position');
      return;
    }

    if (!userToken) {
      Alert.alert(
        'Authentification requise', 
        'Vous devez être connecté pour signaler un incident',
        [
          { text: 'Annuler', style: 'cancel' },
          { 
            text: 'Se connecter', 
            onPress: () => navigation.navigate('Login', {
              redirectAfterLogin: 'ReportIncident',
              location: currentLocation
            })
          }
        ]
      );
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Vérifier que nous avons toutes les données nécessaires
      if (!userInfo?.id) {
        console.warn('ID utilisateur manquant');
      }

      // Format attendu par l'API
      const incidentData = {
        type: selectedType.id,
        description: selectedType.description,
        latitude: currentLocation[1],
        longitude: currentLocation[0]
      };
      
      console.log('Envoi rapport incident:', incidentData);
      
      // Essayer de créer l'incident en utilisant fetch directement
      const url = 'http://192.168.1.27:3001/api/incidents';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`,
          'Accept': 'application/json'
        },
        body: JSON.stringify(incidentData)
      });
      
      console.log('Statut de la réponse:', response.status);
      
      if (response.ok) {
        const responseData = await response.json();
        console.log('Réponse API:', responseData);
        
        // Format attendu par Map.js
        const newIncident = {
          id: responseData.id || Date.now().toString(),
          type: selectedType.id,
          coords: currentLocation,
          description: selectedType.description,
          location: {
            type: 'Point',
            coordinates: currentLocation,
            name: "Emplacement actuel"
          },
          active: true,
          reported_by: userInfo?.id,
          reporter: userInfo,
          created_at: new Date().toISOString(),
          votes: {
            up: 1,
            down: 0
          }
        };
        
        // Succès
        Alert.alert(
          "Signalement envoyé",
          "Merci pour votre contribution à la sécurité routière!",
          [
            { 
              text: "OK", 
              onPress: () => {
                // Retourner à l'écran précédent avec les informations du nouvel incident
                if (route.params?.returnToNavigation) {
                  navigation.navigate('Navigation', { newIncident });
                } else {
                  navigation.navigate('Map', { newIncident });
                }
              }
            }
          ]
        );
      } else {
        // Gérer les codes d'erreur
        if (response.status === 401) {
          // Token expiré ou invalide
          console.error('Authentification échouée - token invalide ou expiré');
          Alert.alert(
            "Session expirée",
            "Votre session a expiré. Veuillez vous reconnecter.",
            [
              { 
                text: "OK", 
                onPress: async () => {
                  // Supprimer le token et rediriger vers la connexion
                  await SecureStore.deleteItemAsync('userToken');
                  await AsyncStorage.removeItem('userToken');
                  navigation.navigate('Login', {
                    redirectAfterLogin: 'ReportIncident',
                    location: currentLocation
                  });
                }
              }
            ]
          );
          return;
        }
        
        // Autre erreur - créer incident local
        console.error('Erreur API:', response.status);
        throw new Error(`Erreur API: ${response.status}`);
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi du signalement:', error);
      
      // En cas d'erreur, créer un incident local
      const localIncident = {
        id: Date.now().toString(),
        type: selectedType.id,
        coords: currentLocation,
        description: selectedType.description,
        location: {
          type: 'Point',
          coordinates: currentLocation,
          name: "Emplacement actuel"
        },
        active: true,
        reported_by: userInfo?.id,
        reporter: userInfo,
        created_at: new Date().toISOString(),
        votes: {
          up: 1,
          down: 0
        },
        offline: true
      };
      
      Alert.alert(
        "Problème de connexion",
        "Le signalement n'a pas pu être envoyé au serveur, mais a été ajouté localement.",
        [
          { 
            text: "OK", 
            onPress: () => {
              if (route.params?.returnToNavigation) {
                navigation.navigate('Navigation', { newIncident: localIncident });
              } else {
                navigation.navigate('Map', { newIncident: localIncident });
              }
            }
          }
        ]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Signaler un incident</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.mapContainer}>
        <MapboxGL.MapView
          ref={mapRef}
          style={styles.map}
          styleURL={MapboxGL.StyleURL.Street}
        >
          <MapboxGL.Camera
            ref={cameraRef}
            zoomLevel={15}
            centerCoordinate={currentLocation || [2.3488, 48.8534]} // Paris par défaut
          />
          
          {currentLocation && (
            <MapboxGL.PointAnnotation
              id="incident-location"
              coordinate={currentLocation}
            >
              <View style={styles.markerContainer}>
                <View style={styles.markerDot} />
              </View>
            </MapboxGL.PointAnnotation>
          )}
        </MapboxGL.MapView>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Type d'incident</Text>
        
        <View style={styles.typeContainer}>
          {INCIDENT_TYPES.map(type => (
            <ModernTypeButton
              key={type.id}
              type={type}
              selected={selectedType?.id === type.id}
              onPress={() => setSelectedType(type)}
            />
          ))}
        </View>

        {currentLocation && (
          <View style={styles.locationInfo}>
            <Text style={styles.locationTitle}>Position</Text>
            <Text style={styles.locationText}>Latitude: {currentLocation[1]?.toFixed(5) || "Position non disponible"}</Text>
            <Text style={styles.locationText}>Longitude: {currentLocation[0]?.toFixed(5) || "Position non disponible"}</Text>
          </View>
        )}
        
        {!userToken && (
          <View style={styles.warningContainer}>
            <Ionicons name="warning" size={24} color="#FFA000" />
            <Text style={styles.warningText}>Vous devez être connecté pour envoyer un signalement au serveur</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[
            styles.submitButton, 
            (!selectedType || isSubmitting) ? styles.submitButtonDisabled : styles.submitButtonEnabled
          ]}
          onPress={handleSubmit}
          disabled={!selectedType || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="warning" size={20} color="#fff" style={styles.submitIcon} />
              <Text style={styles.submitButtonText}>Signaler l'incident</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  mapContainer: {
    height: 180,
    width: '100%',
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(26, 115, 232, 0.2)',
    borderWidth: 2,
    borderColor: '#1A73E8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1A73E8',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  // Styles modernisés pour les boutons de type
  typeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  typeButton: {
    width: '48%',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  typeIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeIconImage: {
    width: 24,
    height: 24,
  },
  typeText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  // Styles pour les informations de localisation
  locationInfo: {
    backgroundColor: '#f8f8f8',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  locationTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
    fontSize: 16,
    color: '#333',
  },
  locationText: {
    color: '#666',
    fontSize: 14,
    marginBottom: 4,
  },
  // Styles d'avertissement pour l'authentification
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FFA000',
  },
  warningText: {
    flex: 1,
    marginLeft: 8,
    color: '#333',
    fontSize: 14,
  },
  // Styles pour le pied de page et le bouton de soumission
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  submitButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  submitButtonEnabled: {
    backgroundColor: '#FF3B30',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitIcon: {
    marginRight: 8,
  },
  submitButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default ReportIncidentScreen;