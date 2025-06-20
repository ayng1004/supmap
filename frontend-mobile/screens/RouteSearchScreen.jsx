// RouteSearchScreen.jsx - Avec fonctionnalités de recherche intelligente et style Waze
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  FlatList, 
  SafeAreaView, 
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard
} from 'react-native';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import * as Location from 'expo-location';
import SmartNavigationService from '../services/SmartNavigationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapboxGL from '@rnmapbox/maps';
import LocationsSearchService from '../services/LocationsSearchService';

const GOOGLE_MAPS_API_KEY = 'VOTRE_CLÉ_API_COMPLÈTE';

const RouteSearchScreen = ({ navigation, route }) => {
  // État pour les entrées de recherche
  const [origin, setOrigin] = useState('Ma position');
  const [destination, setDestination] = useState('');
  const [swapLoading, setSwapLoading] = useState(false);
  const [showRouteOptions, setShowRouteOptions] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [showingResults, setShowingResults] = useState(false);
  const [activeInput, setActiveInput] = useState(null); // 'origin' ou 'destination'
  const [searchQuery, setSearchQuery] = useState(''); // Pour suivre la requête de recherche en cours

  // Animations
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // État pour les préférences d'itinéraire
  const [routePreferences, setRoutePreferences] = useState({
    avoidTolls: false,
    avoidHighways: false,
    avoidFerries: false,
  });
  
  // État pour les coordonnées réelles (pour la navigation)
  const [originCoords, setOriginCoords] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);
  
  // État pour les destinations récentes et sauvegardées
  const [recentDestinations, setRecentDestinations] = useState([]);
  const [savedLocations, setSavedLocations] = useState([]);
  
  // État pour le chargement et les suggestions
  const [isLoading, setIsLoading] = useState(false);
  
  // Effet pour charger la position de l'utilisateur lors du premier rendu
  useEffect(() => {
    // Vérifier si une position utilisateur a été passée dans les params
    if (route.params?.userLocation) {
      setOriginCoords(route.params.userLocation);
    } else {
      // Sinon, récupérer la position actuelle
      (async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const location = await Location.getCurrentPositionAsync({});
            setOriginCoords([location.coords.longitude, location.coords.latitude]);
          }
        } catch (error) {
          console.error('Erreur de localisation:', error);
        }
      })();
    }
    
    // Charger les destinations récentes depuis AsyncStorage
    loadRecentDestinations();
    loadSavedLocations();
  }, [route.params]);
  
  // Fonction pour charger les destinations récentes
  const loadRecentDestinations = async () => {
    try {
      const recentDestinationsString = await AsyncStorage.getItem('recentDestinations');
      if (recentDestinationsString) {
        const recentDestinations = JSON.parse(recentDestinationsString);
        setRecentDestinations(recentDestinations);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des destinations récentes:', error);
    }
  };
  
  const performSearch = async (text) => {
    setSearchQuery(text);
    
    // Mettre à jour le champ correspondant
    if (activeInput === 'origin') {
      setOrigin(text === '' ? 'Ma position' : text);
    } else {
      setDestination(text);
    }
    
    // Rechercher si la requête est assez longue
    if (text.length >= 2) {
      setSearchingAddress(true);
      try {
        const results = await LocationsSearchService.searchAddress(text);
                console.log('Résultats de recherche:', results);
        setSearchResults(results);
      } catch (error) {
        console.error('Erreur lors de la recherche:', error);
        setSearchResults([]);
      } finally {
        setSearchingAddress(false);
      }
    } else {
      setSearchResults([]);
    }
  };
  

  // Fonction pour charger les lieux sauvegardés
  const loadSavedLocations = async () => {
    try {
      const savedLocationsString = await AsyncStorage.getItem('savedLocations');
      if (savedLocationsString) {
        const savedLocations = JSON.parse(savedLocationsString);
        setSavedLocations(savedLocations);
      } else {
        // Données par défaut si aucune n'est sauvegardée
        setSavedLocations([
          { id: '1', name: 'Maison', address: 'Votre adresse domicile', coords: [2.3522, 48.8566] },
          { id: '2', name: 'Bureau', address: 'Votre lieu de travail', coords: [2.3522, 48.8566] },
        ]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des lieux sauvegardés:', error);
    }
  };
  
  // Fonction pour échanger l'origine et la destination
  const swapLocations = () => {
    setSwapLoading(true);
    
    // Animation de rotation pour le bouton swap
    const rotateAnim = new Animated.Value(0);
    Animated.timing(rotateAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true
    }).start();
    
    const spin = rotateAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '180deg']
    });
    
    setTimeout(() => {
      const tempText = origin;
      const tempCoords = originCoords;
      
      setOrigin(destination);
      setOriginCoords(destinationCoords);
      
      setDestination(tempText);
      setDestinationCoords(tempCoords);
      
      setSwapLoading(false);
    }, 300);
  };
  
  // Fonction pour sélectionner une destination depuis les suggestions
  const selectDestination = (item) => {
    if (activeInput === 'origin') {
      setOrigin(item.name || item.address);
      setOriginCoords(item.coords);
    } else {
      setDestination(item.name || item.address);
      setDestinationCoords(item.coords);
    }
    
    hideSearchResults();
    
    // Ajouter aux destinations récentes si ce n'est pas déjà présent
    const isAlreadyRecent = recentDestinations.some(dest => 
      dest.id === item.id || 
      (dest.coords && item.coords && 
       dest.coords[0] === item.coords[0] && 
       dest.coords[1] === item.coords[1])
    );
    
    if (!isAlreadyRecent) {
      const newRecentDestinations = [
        { 
          id: Date.now().toString(), 
          name: item.name, 
          address: item.address,
          coords: item.coords
        },
        ...recentDestinations
      ].slice(0, 5); // Garder seulement les 5 plus récentes
      
      setRecentDestinations(newRecentDestinations);
      
      // Sauvegarder dans AsyncStorage
      AsyncStorage.setItem('recentDestinations', JSON.stringify(newRecentDestinations));
    }
  };
  
  // Fonction pour afficher les résultats de recherche
  const showSearchResults = (inputType) => {
    setActiveInput(inputType);
    setShowingResults(true);
    
    // Initialiser la requête de recherche avec la valeur actuelle du champ
    if (inputType === 'origin' && origin !== 'Ma position') {
      setSearchQuery(origin);
    } else if (inputType === 'destination') {
      setSearchQuery(destination);
    } else {
      setSearchQuery('');
    }
    
    // Animer l'apparition des résultats
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start();
    
    // Si on a déjà une requête, faire une recherche initiale
    if ((inputType === 'origin' && origin !== 'Ma position' && origin.length >= 2) || 
        (inputType === 'destination' && destination.length >= 2)) {
      performSearch(inputType === 'origin' ? origin : destination);
    }
  };
  

  // Fonction pour masquer les résultats de recherche
  const hideSearchResults = () => {
    Keyboard.dismiss();
    
    // Animer la disparition des résultats
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start(() => {
      setShowingResults(false);
      setSearchResults([]);
      setSearchQuery('');
    });
  };
  
  // Fonction modifiée pour démarrer la navigation
  const startNavigation = async () => {
    if (!destination || destination.trim() === '') {
      Alert.alert("Erreur", "Veuillez entrer une destination");
      return;
    }

    setIsLoading(true);
    
    try {
      let destCoords = destinationCoords;
      
      // Si on n'a pas de coordonnées de destination mais qu'on a du texte, essayer de géocoder
      if (!destCoords) {
        try {
          const coords = await LocationsSearchService.geocodeAddress(destination);          if (coords) {
            destCoords = coords;
            console.log('Coordonnées trouvées par géocodage:', destCoords);
          } else {
            // Si aucun résultat, afficher une erreur
            Alert.alert("Adresse introuvable", "Veuillez sélectionner une adresse dans la liste.");
            setIsLoading(false);
            return;
          }
        } catch (error) {
          console.error('Erreur de géocodage:', error);
          Alert.alert("Erreur", "Impossible de trouver l'adresse. Veuillez réessayer.");
          setIsLoading(false);
          return;
        }
      }
      
      // Si le départ est "Ma position" et qu'on n'a pas encore les coordonnées
      let originCoordsFinal = originCoords;
      if (origin === 'Ma position' && !originCoordsFinal) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          originCoordsFinal = [location.coords.longitude, location.coords.latitude];
          setOriginCoords(originCoordsFinal);
        } else {
          Alert.alert("Erreur", "La permission de localisation est nécessaire pour la navigation");
          setIsLoading(false);
          return;
        }
      }
      
      // Vérification finale que nous avons bien des coordonnées valides
      if (!originCoordsFinal || !destCoords) {
        throw new Error("Coordonnées manquantes pour la navigation");
      }
      
      console.log('Navigation de', originCoordsFinal, 'à', destCoords);
      
      // Naviguer vers l'écran de navigation
      navigation.navigate('Navigation', {
        origin: originCoordsFinal,
        destination: destCoords,
        destinationName: destination,
        preferences: routePreferences
      });
    } catch (error) {
      console.error('Erreur lors du démarrage de la navigation:', error);
      Alert.alert("Erreur", "Impossible de démarrer la navigation. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fonction pour basculer les options d'itinéraire
  const toggleRouteOptions = () => {
    setShowRouteOptions(!showRouteOptions);
  };
  
  // Fonction pour mettre à jour les préférences
  const togglePreference = (preference) => {
    setRoutePreferences(prev => ({
      ...prev,
      [preference]: !prev[preference]
    }));
  };
  
  // Transformations pour l'animation des résultats de recherche
  const searchResultsTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [50, 0]
  });
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Itinéraire</Text>
        <View style={{width: 24}} />
      </View>

      <View style={styles.content}>
        {/* Barre de recherche améliorée avec style Waze */}
        <View style={styles.searchContainer}>
          <View style={styles.routePoints}>
            <View style={styles.pointsLine}>
              <View style={styles.originDot} />
              <View style={styles.dottedLine} />
              <View style={styles.destinationDot} />
            </View>
                    
            <View style={styles.inputsContainer}>
              <TouchableOpacity 
                style={[
                  styles.inputWrapper,
                  activeInput === 'origin' && styles.activeInputWrapper
                ]}
                onPress={() => {
                  showSearchResults('origin');
                }}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name="locate" 
                  size={18} 
                  color="#4CAF50" 
                  style={styles.inputIcon}
                />
                <Text 
                  style={[
                    styles.inputText,
                    !origin && styles.inputPlaceholder
                  ]}
                  numberOfLines={1}
                >
                  {origin || "Point de départ"}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.inputWrapper,
                  activeInput === 'destination' && styles.activeInputWrapper
                ]}
                onPress={() => {
                  showSearchResults('destination');
                }}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name="location" 
                  size={18} 
                  color="#F44336" 
                  style={styles.inputIcon}
                />
                <Text 
                  style={[
                    styles.inputText,
                    !destination && styles.inputPlaceholder
                  ]}
                  numberOfLines={1}
                >
                  {destination || "Destination"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <TouchableOpacity 
            style={[
              styles.swapButton, 
              swapLoading && styles.swapButtonLoading
            ]}
            onPress={swapLocations}
            disabled={swapLoading}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
          >
            <MaterialIcons 
              name="swap-vert" 
              size={24} 
              color={swapLoading ? "#999" : "#1A73E8"} 
            />
          </TouchableOpacity>
        </View>

        {/* Options d'itinéraire */}
        <TouchableOpacity 
          style={styles.optionsButton}
          onPress={toggleRouteOptions}
          activeOpacity={0.7}
        >
          <FontAwesome5 name="sliders-h" size={16} color="#1A73E8" />
          <Text style={styles.optionsButtonText}>Options d'itinéraire</Text>
          <Ionicons 
            name={showRouteOptions ? "chevron-up" : "chevron-down"} 
            size={20} 
            color="#666" 
          />
        </TouchableOpacity>

        {showRouteOptions && (
          <View style={styles.routeOptionsContainer}>
            <TouchableOpacity 
              style={styles.optionItem}
              onPress={() => togglePreference('avoidTolls')}
              activeOpacity={0.7}
            >
              <View style={[
                styles.optionCheckbox,
                routePreferences.avoidTolls && styles.optionCheckboxChecked
              ]}>
                {routePreferences.avoidTolls && (
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                )}
              </View>
              <Text style={styles.optionText}>Éviter les péages</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.optionItem}
              onPress={() => togglePreference('avoidHighways')}
              activeOpacity={0.7}
            >
              <View style={[
                styles.optionCheckbox,
                routePreferences.avoidHighways && styles.optionCheckboxChecked
              ]}>
                {routePreferences.avoidHighways && (
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                )}
              </View>
              <Text style={styles.optionText}>Éviter les autoroutes</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.optionItem}
              onPress={() => togglePreference('avoidFerries')}
              activeOpacity={0.7}
            >
              <View style={[
                styles.optionCheckbox,
                routePreferences.avoidFerries && styles.optionCheckboxChecked
              ]}>
                {routePreferences.avoidFerries && (
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                )}
              </View>
              <Text style={styles.optionText}>Éviter les ferrys</Text>
            </TouchableOpacity>
          </View>
        )}

        <ScrollView 
          style={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContentContainer}
        >
          {/* Lieux sauvegardés avec style moderne */}
          <View style={styles.savedLocationsContainer}>
            <Text style={styles.sectionTitle}>Lieux sauvegardés</Text>
            <View style={styles.savedLocationsGrid}>
              {savedLocations.map((location) => (
                <TouchableOpacity 
                  key={location.id}
                  style={styles.savedLocationItem}
                  onPress={() => {
                    setActiveInput('destination');
                    selectDestination(location);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.savedLocationIcon,
                    location.name === 'Maison' && styles.homeIcon,
                    location.name === 'Bureau' && styles.workIcon
                  ]}>
                    <Ionicons 
                      name={
                        location.name === 'Maison' ? 'home' : 
                        location.name === 'Bureau' ? 'business' : 
                        'location'
                      } 
                      size={22} 
                      color="#FFF" 
                    />
                  </View>
                  <Text style={styles.savedLocationName}>{location.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Destinations récentes avec style moderne */}
          {recentDestinations.length > 0 && (
            <View style={styles.recentContainer}>            
              <Text style={styles.sectionTitle}>Destinations récentes</Text>
              
              <FlatList
                data={recentDestinations}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={styles.recentItem}
                    onPress={() => {
                      setActiveInput('destination');
                      selectDestination(item);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.recentIconContainer}>
                      <MaterialIcons name="history" size={20} color="#666" />
                    </View>
                    <View style={styles.recentInfo}>
                      <Text style={styles.recentName} numberOfLines={1}>{item.name || "Destination"}</Text>
                      <Text style={styles.recentAddress} numberOfLines={1}>{item.address}</Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.favoriteButton}
                      hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                    >
                      <MaterialIcons name="star-border" size={24} color="#999" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                )}
                keyExtractor={item => item.id}
                scrollEnabled={false}
              />
            </View>
          )}
        </ScrollView>
      </View>

      {/* Écran de recherche */}
      {showingResults && (
        <Animated.View 
          style={[
            styles.searchResultsOverlay,
            {
              opacity: fadeAnim,
              transform: [{ translateY: searchResultsTranslateY }]
            }
          ]}
        >
          <View style={styles.searchResultsHeader}>
            <TouchableOpacity 
              style={styles.searchResultsBackButton}
              onPress={hideSearchResults}
              hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
            >
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <TextInput
              style={styles.searchResultsInput}
              placeholder={activeInput === 'origin' ? "Point de départ" : "Destination"}
              value={searchQuery}
              onChangeText={performSearch}
              autoFocus
              returnKeyType="search"
              placeholderTextColor="#999"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity 
                style={styles.clearSearchButton}
                onPress={() => {
                  performSearch('');
                }}
                hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
              >
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>
          
          <ScrollView 
            style={styles.searchResultsContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {activeInput === 'origin' && (
              <TouchableOpacity 
                style={styles.myLocationOption}
                onPress={() => {
                  setOrigin('Ma position');
                  setOriginCoords(null);
                  hideSearchResults();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.myLocationIconContainer}>
                  <Ionicons name="locate" size={20} color="#4CAF50" />
                </View>
                <Text style={styles.myLocationText}>Ma position actuelle</Text>
              </TouchableOpacity>
            )}
            
            {searchingAddress ? (
              <View style={styles.searchingContainer}>
                <ActivityIndicator size="small" color="#1A73E8" />
                <Text style={styles.searchingText}>Recherche en cours...</Text>
              </View>
            ) : searchResults.length > 0 ? (
              searchResults.map((item) => (
                <TouchableOpacity 
                  key={item.id}
                  style={styles.searchResultItem}
                  onPress={() => selectDestination(item)}
                  activeOpacity={0.7}
                >
                  <Ionicons 
                    name={item.isManualInput ? "search" : "location"} 
                    size={20} 
                    color="#1A73E8" 
                  />
                  <View style={styles.searchResultTextContainer}>
                    <Text style={styles.searchResultName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.searchResultAddress} numberOfLines={1}>{item.address}</Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : searchQuery.length >= 2 ? (
              <View style={styles.noResultsContainer}>
                <Ionicons name="search-outline" size={40} color="#999" />
                <Text style={styles.noResultsText}>Aucun résultat trouvé</Text>
              </View>
            ) : searchQuery.length > 0 ? (
              <View style={styles.typingHintContainer}>
                <Text style={styles.typingHintText}>Continuez à taper pour voir les résultats</Text>
              </View>
            ) : null}
          </ScrollView>
        </Animated.View>
      )}

      {/* Bouton de navigation modernisé */}
      <View style={styles.footer}>
        {isLoading ? (
          <View style={styles.loadingButton}>
            <ActivityIndicator size="small" color="#FFF" />
            <Text style={styles.loadingButtonText}>Calcul des itinéraires...</Text>
          </View>
        ) : (
          <TouchableOpacity 
            style={[
              styles.navigationButton, 
              !destination && styles.navigationButtonDisabled
            ]}
            onPress={startNavigation}
            disabled={!destination}
            activeOpacity={0.8}
          >
            <Text style={styles.navigationButtonText}>Calculer les itinéraires</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
    zIndex: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
    zIndex: 2,
  },
  routePoints: {
    flex: 1,
    flexDirection: 'row',
  },
  pointsLine: {
    width: 20,
    alignItems: 'center',
    marginRight: 8,
  },
  originDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    marginTop: 12,
  },
  dottedLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#DADADA',
    marginVertical: 4,
  },
  destinationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F44336',
    marginBottom: 12,
  },
  inputsContainer: {
    flex: 1,
  },
  inputWrapper: {
    marginVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  activeInputWrapper: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#1A73E8',
  },
  inputIcon: {
    marginRight: 8,
  },
  inputText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  inputPlaceholder: {
    color: '#999',
  },
  swapButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  swapButtonLoading: {
    opacity: 0.5,
  },
  optionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
    zIndex: 1,
  },
  optionsButtonText: {
    flex: 1,
    fontSize: 16,
    color: '#1A73E8',
    marginLeft: 8,
  },
  routeOptionsContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
    zIndex: 1,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  optionCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#1A73E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionText: {
    fontSize: 16,
    color: '#333',
  },
  scrollContent: {
    flex: 1,
    zIndex: 0,
  },
  scrollContentContainer: {
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  savedLocationsContainer: {
    backgroundColor: 'white',
    marginTop: 16,
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  savedLocationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  savedLocationItem: {
    width: '30%',
    alignItems: 'center',
    marginBottom: 16,
    marginRight: '3%',
  },
  savedLocationIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#3887be',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  homeIcon: {
    backgroundColor: '#4CAF50',
  },
  workIcon: {
    backgroundColor: '#FF9800',
  },
  savedLocationName: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  recentContainer: {
    backgroundColor: 'white',
    marginTop: 16,
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  recentIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recentInfo: {
    flex: 1,
  },
  recentName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  recentAddress: {
    fontSize: 14,
    color: '#666',
  },
  favoriteButton: {
    padding: 8,
  },
  footer: {
    backgroundColor: 'white',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#EFEFEF',
  },
  navigationButton: {
    backgroundColor: '#1A73E8',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  navigationButtonDisabled: {
    backgroundColor: '#A9A9A9',
  },
  navigationButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingButton: {
    backgroundColor: '#1A73E8',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  loadingButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  // Styles pour l'écran de recherche
  searchResultsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'white',
    zIndex: 100,
  },
  searchResultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  searchResultsBackButton: {
    marginRight: 12,
  },
  searchResultsInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: '#333',
  },
  clearSearchButton: {
    padding: 4,
    marginLeft: 8,
  },
  searchResultsContent: {
    flex: 1,
  },
  myLocationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  myLocationIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  myLocationText: {
    fontSize: 16,
    color: '#333',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  searchResultTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  searchResultAddress: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  searchingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  searchingText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 12,
  },
  noResultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  noResultsText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  typingHintContainer: {
    padding: 20,
    alignItems: 'center',
  },
  typingHintText: {
    fontSize: 14,
    color: '#999',
  }
});

export default RouteSearchScreen;