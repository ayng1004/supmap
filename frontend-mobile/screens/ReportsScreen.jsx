import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Image, 
  ActivityIndicator,
  ScrollView,
  Alert
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../services/api';

// Définition des types d'incidents avec les mêmes valeurs que le front web
const INCIDENT_ICONS = {
  'traffic': require('../assets/icons/traffic.png'),
  'accident': require('../assets/icons/accident.png'),
  'hazard': require('../assets/icons/hazard.png'), 
  'police': require('../assets/icons/police.png'),
  'closure': require('../assets/icons/closure.png')
};

// Types d'incidents avec les données cohérentes
const INCIDENT_TYPES = {
  'traffic': { 
    id: 'traffic', 
    title: 'Bouchon', 
    color: '#FF9500', 
    icon: 'traffic-light',
    description: 'Embouteillage important'
  },
  'accident': { 
    id: 'accident', 
    title: 'Accident', 
    color: '#FF3B30', 
    icon: 'car-crash',
    description: 'Accident de circulation' 
  },
  'hazard': { 
    id: 'hazard', 
    title: 'Danger', 
    color: '#FF2D55', 
    icon: 'exclamation-triangle',
    description: 'Obstacle ou danger sur la route' 
  },
  'police': { 
    id: 'police', 
    title: 'Police', 
    color: '#34C759', 
    icon: 'shield-alt',
    description: 'Contrôle policier' 
  },
  'closure': { 
    id: 'closure', 
    title: 'Route fermée', 
    color: '#5856D6', 
    icon: 'road',
    description: 'Route ou voie fermée' 
  }
};

// Fonction pour obtenir les informations d'un type à partir de son ID
const getIncidentTypeInfo = (typeId) => {
  return INCIDENT_TYPES[typeId] || {
    id: 'unknown',
    title: 'Autre',
    color: '#8E8E93',
    icon: 'exclamation',
    description: 'Signalement non catégorisé'
  };
};
const saveUserVotes = async (votes) => {
  try {
    await AsyncStorage.setItem('userVotes', JSON.stringify(votes));
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des votes:', error);
  }
};
const loadUserVotes = async () => {
  try {
    const savedVotes = await AsyncStorage.setItem('userVotes');
    return savedVotes ? JSON.parse(savedVotes) : {};
  } catch (error) {
    console.error('Erreur lors du chargement des votes:', error);
    return {};
  }
};
// Vérifier si un incident est toujours actif
const isIncidentActive = (incident) => {
  if (!incident) return false;
  if (incident.active === false) return false;
  
  const now = new Date();
  const createdDate = new Date(incident.created_at || incident.timestamp);
  const age = now - createdDate;
  
  // Définir des durées de vie par type d'incident
  const EXPIRATION_TIMES = {
    'traffic': 3 * 60 * 60 * 1000,  // 3 heures pour embouteillages
    'police': 2 * 60 * 60 * 1000,   // 2 heures pour contrôles policiers
    'closure': 12 * 60 * 60 * 1000, // 12 heures pour routes fermées
    'accident': 6 * 60 * 60 * 1000, // 6 heures pour accidents
    'hazard': 4 * 60 * 60 * 1000    // 4 heures pour obstacles
  };
  
  const expirationTime = EXPIRATION_TIMES[incident.type] || 4 * 60 * 60 * 1000;
  
  // Expiration basée sur le temps
  if (age > expirationTime) return false;
  
  // Expiration basée sur les votes
  const { up = 0, down = 0 } = incident.votes || {};
  if (down > up && down >= 3) return false;
  
  return true;
};

// Fonction pour formater le temps écoulé
const getElapsedTime = (timestamp) => {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMinutes = Math.floor((now - date) / (1000 * 60));
  
  if (diffMinutes < 1) return 'À l\'instant';
  if (diffMinutes < 60) return `Il y a ${diffMinutes} min`;
  
  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  
  const days = Math.floor(hours / 24);
  return `Il y a ${days} jour${days > 1 ? 's' : ''}`;
};

// Calcul de la fiabilité
const calculateReliability = (incident) => {
  if (!incident || !incident.votes) {
    return 50; // Fiabilité par défaut: 50%
  }
  
  const { up = 0, down = 0 } = incident.votes;
  const total = up + down;
  
  if (total === 0) {
    return 50; // Aucun vote = fiabilité neutre
  }
  
  // Calculer le pourcentage de votes positifs
  return Math.round((up / total) * 100);
};

const ReportsScreen = ({ route, navigation }) => {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [userInfo, setUserInfo] = useState(null);
  const [userVotes, setUserVotes] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  // Récupérer les incidents de l'écran de carte s'ils existent et les infos utilisateur
useEffect(() => {
  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    // Récupérer les informations utilisateur
    try {
      const userInfoString = await SecureStore.getItemAsync('userInfo');
      if (userInfoString) {
        const userData = JSON.parse(userInfoString);
        setUserInfo(userData);
      }
      
      // Charger les votes sauvegardés
      const savedVotes = await AsyncStorage.getItem('userVotes');
      if (savedVotes) {
        setUserVotes(JSON.parse(savedVotes));
      }
    } catch (error) {
      console.error('Erreur lors du chargement des informations:', error);
    }
      try {
        // Utiliser les incidents passés par la route s'ils existent
        if (route?.params?.incidents && Array.isArray(route.params.incidents)) {
          // S'assurer que chaque incident a une propriété votes
          const processedIncidents = route.params.incidents.map(incident => ({
            ...incident,
            votes: incident.votes || { up: 0, down: 0 }
          }));
          setIncidents(processedIncidents);
        } else {
          // Sinon, essayer de charger depuis l'API
          const data = await apiService.incidents.getAll();
          if (Array.isArray(data)) {
            // S'assurer que chaque incident a une propriété votes
            const processedIncidents = data.map(incident => ({
              ...incident,
              votes: incident.votes || { up: 0, down: 0 }
            }));
            setIncidents(processedIncidents);
          } else {
            throw new Error("Format de données invalide depuis l'API");
          }
        }
      } catch (err) {
        console.error('Erreur lors du chargement des incidents:', err);
        setError('Impossible de charger les incidents. Veuillez réessayer.');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [route?.params?.incidents]);
  
  // Fonction pour rafraîchir les incidents
  const refreshIncidents = async () => {
    setRefreshing(true);
    try {
      const data = await apiService.incidents.getAll();
      if (Array.isArray(data)) {
        // S'assurer que chaque incident a une propriété votes
        const processedIncidents = data.map(incident => ({
          ...incident,
          votes: incident.votes || { up: 0, down: 0 }
        }));
        setIncidents(processedIncidents);
      } else {
        throw new Error("Format de données invalide depuis l'API");
      }
    } catch (err) {
      console.error('Erreur lors du rafraîchissement des incidents:', err);
      Alert.alert("Erreur", "Impossible de rafraîchir les incidents.");
    } finally {
      setRefreshing(false);
    }
  };

const handleVote = async (incidentId, isConfirmed) => {
  try {
    // Vérifier si l'utilisateur est connecté
    if (!userInfo) {
      Alert.alert(
        "Connexion requise", 
        "Vous devez être connecté pour voter.",
        [
          { text: "Annuler", style: "cancel" },
          { text: "Se connecter", onPress: () => navigation.navigate('Login') }
        ]
      );
      return;
    }
    
    // Vérifier si l'incident existe
    const incident = incidents.find(inc => inc.id === incidentId);
    if (!incident) {
      Alert.alert("Erreur", "Incident non trouvé.");
      return;
    }
    
    // Vérifier si l'utilisateur est l'auteur de l'incident
    if (incident.reporter?.id === userInfo.id || incident.reported_by === userInfo.id) {
      Alert.alert("Action impossible", "Vous ne pouvez pas voter pour votre propre signalement.");
      return;
    }
    
    // Vérifier si l'utilisateur a déjà voté (en local)
    if (userVotes[incidentId]) {
      Alert.alert("Déjà voté", "Vous avez déjà voté pour ce signalement.");
      return;
    }
    
    // Ne pas faire cette vérification API ici, elle pourrait causer des problèmes
    // La vérification locale avec userVotes est suffisante
    
    setLoading(true);
    
    // Appel API avec les bons paramètres
    console.log(`Vote pour incident ${incidentId}, isConfirmed: ${isConfirmed}`);
    const result = await apiService.incidents.vote(incidentId, isConfirmed);
    
    if (result) {
      // Mise à jour de l'état local des votes
      setUserVotes(prev => ({
        ...prev,
        [incidentId]: true
      }));
      const updatedVotes = {
        ...userVotes,
        [incidentId]: isConfirmed ? 'up' : 'down'
      };
       setUserVotes(updatedVotes);
      // Mise à jour des incidents avec les nouvelles données de vote
      setIncidents(prev => 
        prev.map(inc => {
          if (inc.id === incidentId) {
            const updatedVotes = {
              up: isConfirmed ? (inc.votes?.up || 0) + 1 : inc.votes?.up || 0,
              down: !isConfirmed ? (inc.votes?.down || 0) + 1 : inc.votes?.down || 0
            };
            
            return {
              ...inc,
              votes: updatedVotes,
              reliability_score: result.reliability || inc.reliability_score,
              active: result.active !== undefined ? result.active : inc.active
            };
          }
          return inc;
        })
      );
      
      Alert.alert(
        "Vote enregistré", 
        `Vous avez ${isConfirmed ? 'confirmé' : 'infirmé'} ce signalement.`
      );
    }
  } catch (error) {
    console.error('Erreur lors du vote:', error);
    // Afficher le message d'erreur plus détaillé
    Alert.alert("Erreur", `Impossible d'enregistrer votre vote: ${error.message}`);
  } finally {
    setLoading(false);
  }
};
  // Fonction pour formater les coordonnées en adresse lisible
  const formatLocation = (coords) => {
    if (!coords) return "Position non disponible";
    return `Latitude: ${coords[1]?.toFixed(4) || "?"}, Longitude: ${coords[0]?.toFixed(4) || "?"}`;
  };

  // Rendu d'un élément de la liste
  const renderItem = ({ item }) => {
    // Obtenir les coordonnées
    let coords = item.coords;
    
    if (!coords && item.location) {
      if (Array.isArray(item.location)) {
        coords = item.location;
      } else if (item.location.coordinates && Array.isArray(item.location.coordinates)) {
        coords = item.location.coordinates;
      }
    }
    
    if (!coords) {
      coords = [0, 0]; // Valeur par défaut si aucune coordonnée n'est trouvée
    }
    
    const typeInfo = getIncidentTypeInfo(item.type);
    const reliability = calculateReliability(item);
    const timestamp = item.created_at || item.timestamp || new Date();
    const hasUserVoted = userVotes[item.id] === true;

    return (
      <TouchableOpacity
        style={styles.reportCard}
        onPress={() => {
          // Navigation vers les détails 
          navigation.navigate('Map', { 
            focusIncident: item,
            showPopup: true
          });
        }}
      >
        <View style={styles.cardHeader}>
          {/* Icône */}
          <View style={[
            styles.iconContainer, 
            { 
              backgroundColor: 'white', 
              borderColor: typeInfo.color, 
              borderWidth: 2 
            }
          ]}>
            <Image 
              source={INCIDENT_ICONS[item.type] || INCIDENT_ICONS['hazard']}
              style={styles.iconImage}
              resizeMode="contain"
            />
          </View>
          
          {/* Informations principales */}
          <View style={styles.reportInfo}>
            <View style={styles.reportHeader}>
              <Text style={styles.reportTitle}>{typeInfo.title}</Text>
              <Text style={styles.reportTime}>{getElapsedTime(timestamp)}</Text>
            </View>
            <Text style={styles.reportDescription}>
              {item.description || typeInfo.description}
            </Text>
            <Text style={styles.reportLocation}>{formatLocation(coords)}</Text>
          </View>
        </View>
        
        {/* Barre de fiabilité avec nombre de votes */}
        <View style={styles.reliabilityContainer}>
          <View style={styles.reliabilityHeader}>
            <Text style={styles.reliabilityLabel}>Fiabilité</Text>
            <Text style={styles.reliabilityPercent}>{reliability}%</Text>
          </View>
          <View style={styles.reliabilityBar}>
            <View 
              style={[
                styles.reliabilityValue, 
                { 
                  width: `${reliability}%`,
                  backgroundColor: reliability > 50 ? '#33CC66' : '#FF453A'
                }
              ]} 
            />
          </View>
          <View style={styles.voteCountContainer}>
            <View style={styles.voteCount}>
              <Ionicons name="thumbs-up" size={16} color="#33CC66" />
              <Text style={styles.voteNumber}>{item.votes?.up || 0}</Text>
            </View>
            <View style={styles.voteCount}>
              <Ionicons name="thumbs-down" size={16} color="#FF453A" />
              <Text style={styles.voteNumber}>{item.votes?.down || 0}</Text>
            </View>
          </View>
        </View>
        
        {/* Actions de vote ou indicateur de vote précédent */}
        {hasUserVoted ? (
          <View style={styles.alreadyVotedContainer}>
            <Ionicons name="checkmark-circle" size={16} color="#33CC66" />
            <Text style={styles.alreadyVotedText}>Vous avez déjà voté pour ce signalement</Text>
          </View>
        ) : (
          <View style={styles.voteActionsContainer}>
            <TouchableOpacity 
              style={[styles.voteButton, styles.confirmButton]}
              onPress={() => handleVote(item.id, true)}
              disabled={loading}
            >
              <Ionicons name="thumbs-up" size={16} color="#33CC66" />
              <Text style={styles.voteButtonText}>Confirmer</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.voteButton, styles.rejectButton]}
              onPress={() => handleVote(item.id, false)}
              disabled={loading}
            >
              <Ionicons name="thumbs-down" size={16} color="#FF453A" />
              <Text style={styles.voteButtonText}>Infirmer</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.detailsButton}
              onPress={() => navigation.navigate('IncidentDetail', { incident: item })}
            >
              <Ionicons name="information-circle" size={16} color="#1A73E8" />
              <Text style={styles.detailsButtonText}>Détails</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Entête avec options de filtre
  const ListHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Signalements récents</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
        <View style={styles.filterContainer}>
          <TouchableOpacity 
            style={[
              styles.filterButton, 
              filter === 'all' ? styles.filterButtonActive : styles.filterButtonInactive
            ]}
            onPress={() => setFilter('all')}
          >
            <Text style={filter === 'all' ? styles.filterTextActive : styles.filterTextInactive}>Tous</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[
              styles.filterButton, 
              filter === 'accident' ? styles.filterButtonActive : styles.filterButtonInactive
            ]}
            onPress={() => setFilter('accident')}
          >
            <Text style={filter === 'accident' ? styles.filterTextActive : styles.filterTextInactive}>Accidents</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[
              styles.filterButton, 
              filter === 'traffic' ? styles.filterButtonActive : styles.filterButtonInactive
            ]}
            onPress={() => setFilter('traffic')}
          >
            <Text style={filter === 'traffic' ? styles.filterTextActive : styles.filterTextInactive}>Bouchons</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[
              styles.filterButton, 
              filter === 'police' ? styles.filterButtonActive : styles.filterButtonInactive
            ]}
            onPress={() => setFilter('police')}
          >
            <Text style={filter === 'police' ? styles.filterTextActive : styles.filterTextInactive}>Police</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[
              styles.filterButton, 
              filter === 'hazard' ? styles.filterButtonActive : styles.filterButtonInactive
            ]}
            onPress={() => setFilter('hazard')}
          >
            <Text style={filter === 'hazard' ? styles.filterTextActive : styles.filterTextInactive}>Dangers</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[
              styles.filterButton, 
              filter === 'closure' ? styles.filterButtonActive : styles.filterButtonInactive
            ]}
            onPress={() => setFilter('closure')}
          >
            <Text style={filter === 'closure' ? styles.filterTextActive : styles.filterTextInactive}>Routes fermées</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );

  // Affichage pendant le chargement
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1A73E8" />
        <Text style={styles.loadingText}>Chargement des signalements...</Text>
      </View>
    );
  }

  // Affichage en cas d'erreur
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.errorButton}
          onPress={() => {
            setLoading(true);
            setError(null);
            // Recharger les incidents
            apiService.incidents.getAll()
              .then(data => {
                if (Array.isArray(data)) {
                  setIncidents(data);
                } else {
                  throw new Error("Format de données invalide");
                }
              })
              .catch(err => {
                console.error('Erreur lors du rechargement:', err);
                setError('Impossible de charger les incidents. Veuillez réessayer.');
              })
              .finally(() => setLoading(false));
          }}
        >
          <Text style={styles.errorButtonText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Si aucun incident
  if (incidents.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Image 
          source={require('../assets/icons/empty.png')} 
          style={styles.emptyImage}
        />
        <Text style={styles.emptyText}>Aucun signalement pour le moment</Text>
        <Text style={styles.emptySubtext}>Les incidents signalés apparaîtront ici</Text>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={refreshIncidents}
          disabled={refreshing}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color="#1A73E8" />
          ) : (
            <>
              <Ionicons name="refresh" size={16} color="#1A73E8" />
              <Text style={styles.refreshButtonText}>Rafraîchir</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // Filtrer les incidents selon le filtre actif
  const filteredIncidents = filter === 'all' 
    ? incidents 
    : incidents.filter(incident => incident.type === filter);

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredIncidents.sort((a, b) => {
          const dateA = new Date(a.created_at || a.timestamp || 0);
          const dateB = new Date(b.created_at || b.timestamp || 0);
          return dateB - dateA; // Plus récent en premier
        })}
        renderItem={renderItem}
        keyExtractor={item => item.id?.toString() || Math.random().toString()}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={refreshIncidents}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#555',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F2F2F7',
  },
  errorIcon: {
    fontSize: 50,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorButton: {
    backgroundColor: '#1A73E8',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  errorButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listContent: {
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  filtersScroll: {
    marginBottom: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingRight: 16,
  },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#1A73E8',
  },
  filterButtonInactive: {
    backgroundColor: '#E5E5EA',
  },
  filterTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  filterTextInactive: {
    color: '#8E8E93',
  },
  reportCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  iconImage: {
    width: 30,
    height: 30,
  },
  reportInfo: {
    flex: 1,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#333',
  },
  reportDescription: {
    fontSize: 16,
    color: '#3C3C43',
    opacity: 0.6,
    marginBottom: 4,
  },
  reportLocation: {
    fontSize: 14,
    color: '#3C3C43',
    opacity: 0.6,
  },
  reportTime: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  reliabilityContainer: {
    marginVertical: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 10,
  },
  reliabilityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  reliabilityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  reliabilityPercent: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  reliabilityBar: {
    height: 8,
    backgroundColor: '#eee',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  reliabilityValue: {
    height: '100%',
  },
  voteCountContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  voteCount: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  voteNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#555',
    marginLeft: 6,
  },
  voteActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
  },
  confirmButton: {
    backgroundColor: '#e8f8ef',
    borderColor: '#33CC66',
    borderWidth: 1,
  },
  rejectButton: {
    backgroundColor: '#feeeee',
    borderColor: '#FF453A',
    borderWidth: 1,
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f0f7ff',
    borderColor: '#1A73E8',
    borderWidth: 1,
    flex: 1,
    marginHorizontal: 4,
  },
  voteButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F2F2F7',
  },
  emptyImage: {
    width: 120,
    height: 120,
    marginBottom: 20,
    opacity: 0.7,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
});

export default ReportsScreen;