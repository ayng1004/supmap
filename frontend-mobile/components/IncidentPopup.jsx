import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Animated, 
  Dimensions, 
  Image,
  ActivityIndicator
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { getIncidentTypeInfo, getElapsedTime } from '../constants/IncidentTypes';
import apiService from '../services/api';
import { Alert } from 'react-native';

const { height } = Dimensions.get('window');

const IncidentPopup = ({ incident, onClose, onDetails, onVote }) => {
  const [loading, setLoading] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [hasVoted, setHasVoted] = useState(null);
  const [voteType, setVoteType] = useState(null);
  const slideAnim = useRef(new Animated.Value(-300)).current; // commence hors écran

  // Récupérer les informations du type d'incident
  const typeInfo = getIncidentTypeInfo(incident.type);

  // Animation d'entrée
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 70,
      friction: 12,
      useNativeDriver: true
    }).start();
    
    // Charger les informations utilisateur
    const loadUserInfo = async () => {
      try {
        const userInfoString = await SecureStore.getItemAsync('userInfo');
        if (userInfoString) {
          const userData = JSON.parse(userInfoString);
          setUserInfo(userData);
          
          // Vérifier si l'utilisateur a déjà voté
          if (userData.id && incident.id) {
            checkUserVote(incident.id, userData.id);
          }
        }
      } catch (error) {
        console.error('Erreur lors du chargement des informations utilisateur:', error);
      }
    };

    loadUserInfo();
  }, [incident.id]);

  // Animation de sortie
  const hidePopup = (callback) => {
    Animated.timing(slideAnim, {
      toValue: -300,
      duration: 300,
      useNativeDriver: true
    }).start(() => {
      if (callback) callback();
    });
  };

  // Vérifier si l'utilisateur a déjà voté pour cet incident
  const checkUserVote = async (incidentId, userId) => {
    try {
      const voteData = await apiService.incidents.vote(incidentId, userId);
      if (voteData && voteData.hasVoted) {
        setHasVoted(true);
        setVoteType(voteData.voteType);
      } else {
        setHasVoted(false);
      }
    } catch (error) {
      console.error('Erreur lors de la vérification du vote:', error);
      setHasVoted(false);
    }
  };

  // Gérer le vote pour l'incident
  const handleVote = async (incidentId, isConfirmed) => {
    if (!userInfo) {
      Alert.alert("Connexion requise", "Vous devez être connecté pour voter.", [
        { text: "Annuler", style: "cancel" },
        { text: "Se connecter", onPress: () => navigation.navigate('Login') }
      ]);
      return;
    }
  
    // Vérifier si l'utilisateur est l'auteur de l'incident
    if (incident.reporter?.id === userInfo.id || incident.reported_by === userInfo.id) {
      Alert.alert("Action impossible", "Vous ne pouvez pas voter pour votre propre signalement.");
      return;
    }
  
    // Vérifier si l'utilisateur a déjà voté
    if (hasVoted) {
      Alert.alert("Déjà voté", "Vous avez déjà voté pour ce signalement.");
      return;
    }
  
    try {
      setLoading(true);
      
      // Appeler l'API pour enregistrer le vote
      const result = await apiService.incidents.vote(incidentId, isConfirmed);
      
      // Mettre à jour le vote local
      setHasVoted(true);
      setVoteType(isConfirmed ? 'up' : 'down');
      
      // Récupérer les données mises à jour depuis le serveur
      try {
        const updatedIncident = await apiService.incidents.getById(incidentId);
        if (updatedIncident) {
          console.log('Incident mis à jour après vote:', updatedIncident);
          
          // Mettre à jour les données locales avec les valeurs réelles du serveur
          if (onVote) {
            onVote(incidentId, isConfirmed, updatedIncident);
          }
        }
      } catch (error) {
        console.error('Erreur lors de la récupération des détails après vote:', error);
        
        // Si erreur lors de la récupération, on utilise les données locales estimées
        const updatedVotes = {
          up: isConfirmed ? (incident.votes?.up || 0) + 1 : incident.votes?.up || 0,
          down: !isConfirmed ? (incident.votes?.down || 0) + 1 : incident.votes?.down || 0
        };
        
        if (onVote) {
          onVote(incidentId, isConfirmed, {
            votes: updatedVotes,
            reliability_score: result?.reliability,
            active: result?.active
          });
        }
      }
      
      Alert.alert(
        "Vote enregistré", 
        `Vous avez ${isConfirmed ? 'confirmé' : 'infirmé'} ce signalement.`
      );
    } catch (error) {
      console.error('Erreur lors du vote:', error);
      Alert.alert("Erreur", "Impossible d'enregistrer votre vote. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  // Formater les coordonnées pour l'affichage
  const formatLocation = () => {
    let lat, lng;
    
    if (incident.coords) {
      [lng, lat] = incident.coords;
    } else if (incident.location) {
      if (Array.isArray(incident.location)) {
        [lng, lat] = incident.location;
      } else if (incident.location.coordinates) {
        [lng, lat] = incident.location.coordinates;
      }
    }
    
    if (lat !== undefined && lng !== undefined) {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
    
    return "Position non disponible";
  };

  // Formater le compteur de fiabilité
  const getReliabilityPercentage = () => {
    if (!incident.votes) return 50;
    
    const { up = 0, down = 0 } = incident.votes;
    const total = up + down;
    
    if (total === 0) return 50; // Valeur neutre par défaut
    
    return Math.round((up / total) * 100);
  };

  // Déterminer la couleur pour le compteur de fiabilité
  const getReliabilityColor = () => {
    const percentage = getReliabilityPercentage();
    
    if (percentage >= 70) return '#34C759'; // Vert
    if (percentage >= 40) return '#FF9500'; // Orange
    return '#FF3B30'; // Rouge
  };

  return (
    <Animated.View 
      style={[
        styles.container, 
        { transform: [{ translateY: slideAnim }] }
      ]}
    >
      {/* En-tête de la popup */}
      <View style={[styles.header, { backgroundColor: typeInfo.color }]}>
        <View style={styles.iconContainer}>
          <FontAwesome5 name={typeInfo.icon} size={24} color="#fff" />
        </View>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{typeInfo.title}</Text>
          <Text style={styles.time}>{getElapsedTime(incident.created_at)}</Text>
        </View>
        <TouchableOpacity 
          style={styles.closeButton} 
          onPress={() => hidePopup(onClose)}
        >
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      
      {/* Corps de la popup */}
      <View style={styles.content}>
        <Text style={styles.description}>
          {incident.description || typeInfo.description || "Pas de description disponible"}
        </Text>
        
        <View style={styles.infoRow}>
          <Ionicons name="location" size={16} color="#777" />
          <Text style={styles.infoText}>{formatLocation()}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Ionicons name="person" size={16} color="#777" />
          <Text style={styles.infoText}>
            {incident.reporter?.name || incident.reporter_name || "Utilisateur anonyme"}
          </Text>
        </View>
        
        {/* Indicateur de fiabilité */}
        <View style={styles.reliabilityContainer}>
          <Text style={styles.reliabilityLabel}>Fiabilité</Text>
          <View style={styles.reliabilityBar}>
            <View 
              style={[
                styles.reliabilityValue, 
                { width: `${getReliabilityPercentage()}%`, backgroundColor: getReliabilityColor() }
              ]} 
            />
          </View>
          <Text style={styles.reliabilityPercent}>{getReliabilityPercentage()}%</Text>
        </View>
        
        {/* Compteurs de votes */}
        <View style={styles.votesRow}>
          <View style={styles.voteItem}>
            <Ionicons name="thumbs-up" size={18} color="#34C759" />
            <Text style={styles.voteCount}>{incident.votes?.up || 0}</Text>
          </View>
          <View style={styles.voteItem}>
            <Ionicons name="thumbs-down" size={18} color="#FF3B30" />
            <Text style={styles.voteCount}>{incident.votes?.down || 0}</Text>
          </View>
        </View>
        
        {/* Actions */}
        <View style={styles.actions}>
          {!hasVoted ? (
            <>
              <TouchableOpacity 
                style={[styles.voteButton, styles.confirmButton]}
                onPress={() => handleVote(true)}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="thumbs-up" size={18} color="#fff" />
                    <Text style={styles.buttonText}>Confirmer</Text>
                  </>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.voteButton, styles.rejectButton]}
                onPress={() => handleVote(false)}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="thumbs-down" size={18} color="#fff" />
                    <Text style={styles.buttonText}>Infirmer</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.voteStatus}>
              <Ionicons 
                name={voteType === 'up' ? "thumbs-up" : "thumbs-down"} 
                size={18} 
                color={voteType === 'up' ? "#34C759" : "#FF3B30"} 
              />
              <Text style={styles.voteStatusText}>
                Vous avez {voteType === 'up' ? 'confirmé' : 'infirmé'} ce signalement
              </Text>
            </View>
          )}
        </View>
        
        {/* Bouton pour voir les détails complets */}
        <TouchableOpacity 
          style={styles.detailsButton}
          onPress={() => {
            hidePopup(() => {
              if (onDetails) onDetails(incident);
            });
          }}
        >
          <Text style={styles.detailsButtonText}>Voir tous les détails</Text>
          <Ionicons name="chevron-forward" size={18} color="#1A73E8" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
    maxHeight: height * 0.7, // Maximum 70% de la hauteur de l'écran
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  time: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
  },
  description: {
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  reliabilityContainer: {
    marginVertical: 16,
  },
  reliabilityLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  reliabilityBar: {
    height: 8,
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  reliabilityValue: {
    height: '100%',
  },
  reliabilityPercent: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'right',
  },
  votesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  voteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  voteCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 6,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: '40%',
  },
  confirmButton: {
    backgroundColor: '#34C759',
  },
  rejectButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  voteStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    width: '90%',
  },
  voteStatusText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  detailsButtonText: {
    fontSize: 16,
    color: '#1A73E8',
    fontWeight: '500',
    marginRight: 4,
  },
});

export default IncidentPopup;