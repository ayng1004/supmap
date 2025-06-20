// SearchScreen.jsx
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  SafeAreaView, 
  StatusBar,
  Alert,
  Keyboard,
  Platform,
  Animated
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import MapboxGL from '@rnmapbox/maps';

// Définir votre clé API Google Maps ici
const GOOGLE_MAPS_API_KEY = 'AIzaSyAkbB6bz4NyD8iJBv8aqlzT7d-ASEzZRtMS'; // Remplacez par votre clé API complète

const RECENT_SEARCHES = [
  { id: '1', place: 'Tour Eiffel', address: 'Champ de Mars, 5 Av. Anatole France, 75007 Paris' },
  { id: '2', place: 'Notre-Dame de Paris', address: 'Parvis Notre-Dame - Pl. Jean-Paul II, 75004 Paris' },
  { id: '3', place: 'Arc de Triomphe', address: 'Place Charles de Gaulle, 75008 Paris' },
];

const SUGGESTIONS = [
  { id: '4', place: 'Louvre Museum', address: 'Rue de Rivoli, 75001 Paris' },
  { id: '5', place: 'Montmartre', address: 'Montmartre, 75018 Paris' },
  { id: '6', place: 'Champs-Élysées', address: 'Avenue des Champs-Élysées, 75008 Paris' },
];

// Fonction de recherche d'adresse améliorée
const searchAddress = async (query) => {
  if (!query || query.length < 3) return [];
  
  try {
    // 1. Essayer avec Mapbox d'abord
    const encodedQuery = encodeURIComponent(query);
    const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?country=fr&types=address,place,locality&access_token=${MapboxGL.accessToken}`;
    
    console.log('Recherche Mapbox:', mapboxUrl);
    const response = await fetch(mapboxUrl);
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      // Transformer les résultats dans le même format que vos données existantes
      return data.features.map((feature, index) => ({
        id: `search-${index}`,
        place: feature.text,
        address: feature.place_name,
        coords: feature.center // [longitude, latitude]
      }));
    }
    
    // 2. Si Mapbox ne trouve rien, essayer avec l'API de geocoding de Google
    try {
      const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedQuery}&region=fr&key=${GOOGLE_MAPS_API_KEY}`;
      
      console.log('Recherche Google:', googleUrl);
      const googleResponse = await fetch(googleUrl);
      const googleData = await googleResponse.json();
      
      if (googleData.status === 'OK' && googleData.results && googleData.results.length > 0) {
        return googleData.results.map((result, index) => {
          // Extraction du nom de lieu principal
          const addressComponents = result.address_components || [];
          const localityComponent = addressComponents.find(comp => 
            comp.types.includes('locality') || comp.types.includes('postal_town')
          );
          
          // Nom par défaut depuis l'adresse formatée
          let placeName = result.formatted_address.split(',')[0];
          
          // Si on trouve un composant locality, l'utiliser comme nom
          if (localityComponent) {
            placeName = localityComponent.long_name;
          }
          
          return {
            id: `google-${index}`,
            place: placeName,
            address: result.formatted_address,
            coords: [
              result.geometry.location.lng,
              result.geometry.location.lat
            ]
          };
        });
      }
    } catch (googleError) {
      console.error('Erreur lors de la recherche Google:', googleError);
    }
    
    // Si aucune API ne trouve de résultats, retourner un tableau vide
    return [];
  } catch (error) {
    console.error('Erreur lors de la recherche d\'adresse:', error);
    return [];
  }
};

const SearchScreen = ({ navigation }) => {
  const [searchText, setSearchText] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  // Fonction de recherche améliorée
  const handleSearch = async (text) => {
    setSearchText(text);
    
    if (text.length > 2) {
      setIsSearching(true);
      Keyboard.dismiss();
      
      try {
        // Rechercher parmi les adresses prédéfinies
        const localResults = [...RECENT_SEARCHES, ...SUGGESTIONS].filter(
          item => item.place.toLowerCase().includes(text.toLowerCase()) || 
                item.address.toLowerCase().includes(text.toLowerCase())
        );
        
        // Rechercher avec le service de géocodage
        const geocodeResults = await searchAddress(text);
        
        // Combiner les résultats
        const combinedResults = [...localResults, ...geocodeResults];
        setResults(combinedResults);
        
        // Animer l'apparition des résultats
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true
        }).start();
      } catch (error) {
        console.error('Erreur de recherche:', error);
        Alert.alert('Erreur', 'Impossible de réaliser la recherche. Veuillez réessayer.');
      } finally {
        setIsSearching(false);
      }
    } else {
      setResults([]);
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true
      }).start();
    }
  };

  const handleSelectDestination = (item) => {
    // Convertir l'adresse en coordonnées si nécessaire
    if (!item.coords) {
      Alert.alert('Information', 'Aucune coordonnée disponible pour cette destination.');
      return;
    }
    
    // Naviguer vers l'écran de carte avec les coordonnées
    navigation.navigate('MapScreen', { 
      destination: item,
      calculateRoute: true 
    });
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.resultItem}
      onPress={() => handleSelectDestination(item)}
      activeOpacity={0.7}
    >
      <MaterialIcons name="location-on" size={24} color="#FF4757" style={styles.locationIcon} />
      <View style={styles.locationInfo}>
        <Text style={styles.placeName}>{item.place}</Text>
        <Text style={styles.address} numberOfLines={1}>{item.address}</Text>
      </View>
      <TouchableOpacity style={styles.directionsButton}>
        <Ionicons name="navigate" size={20} color="#2196F3" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher une destination"
            value={searchText}
            onChangeText={handleSearch}
            autoFocus
            returnKeyType="search"
            placeholderTextColor="#999"
          />
          {searchText.length > 0 && (
            <TouchableOpacity 
              style={styles.clearButton}
              onPress={() => {
                setSearchText('');
                setResults([]);
                Animated.timing(fadeAnim, {
                  toValue: 0,
                  duration: 200,
                  useNativeDriver: true
                }).start();
              }}
              hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
            >
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {searchText.length === 0 ? (
        <View style={styles.recentContainer}>
          <Text style={styles.sectionTitle}>Recherches récentes</Text>
          <FlatList
            data={RECENT_SEARCHES}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContentContainer}
          />
          
          <Text style={[styles.sectionTitle, {marginTop: 20}]}>Suggestions populaires</Text>
          <FlatList
            data={SUGGESTIONS}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContentContainer}
          />
        </View>
      ) : (
        <Animated.View style={{flex: 1, opacity: fadeAnim}}>
          <FlatList
            data={results}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContentContainer}
            ListEmptyComponent={
              <View style={styles.emptyResults}>
                <Text style={styles.emptyResultsText}>
                  {isSearching 
                    ? 'Recherche en cours...' 
                    : `Aucun résultat pour "${searchText}"`}
                </Text>
              </View>
            }
          />
        </Animated.View>
      )}
      
      {isSearching && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <Ionicons name="search" size={24} color="#2196F3" />
            <Text style={styles.loadingText}>Recherche en cours...</Text>
          </View>
        </View>
      )}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
    backgroundColor: '#fff',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 10,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 46,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    padding: 4,
  },
  recentContainer: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  listContentContainer: {
    paddingBottom: 20,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  locationIcon: {
    marginRight: 12,
  },
  locationInfo: {
    flex: 1,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  address: {
    fontSize: 14,
    color: '#666',
  },
  directionsButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginLeft: 8,
  },
  emptyResults: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
  },
  emptyResultsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  loadingContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loadingText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
});

export default SearchScreen;