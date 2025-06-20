import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, SafeAreaView } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { getIncidentTypeInfo, getElapsedTime } from '../constants/IncidentTypes';
import apiService from '../services/api';
import { StatusBar, Platform } from 'react-native';

const IncidentDetailScreen = ({ route, navigation }) => {
const initialIncident = route.params.incident || 
  (route.params.incidents && route.params.incidents.length > 0 
    ? route.params.incidents[0] 
    : null);
  const [incident, setIncident] = useState(initialIncident);
  const [loading, setLoading] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [hasVoted, setHasVoted] = useState(null);
  const [voteType, setVoteType] = useState(null);

  // Récupérer les informations du type d'incident
  const typeInfo = getIncidentTypeInfo(incident.type);
if (!initialIncident) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Détails du signalement</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.content}>
        <Text style={styles.noIncidentText}>Aucun incident à afficher</Text>
      </View>
    </SafeAreaView>
  );
}
  // Récupérer les informations de l'utilisateur et vérifier s'il a déjà voté
  useEffect(() => {
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
    refreshIncidentDetails();
  }, [incident.id]);

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

  // Rafraîchir les détails de l'incident depuis l'API
  const refreshIncidentDetails = async () => {
    try {
      setLoading(true);
      
      // Utiliser l'API pour récupérer les détails à jour de l'incident
      try {
        const updatedIncident = await apiService.incidents.getById(incident.id);
        if (updatedIncident) {
          console.log('Détails incidents mis à jour:', updatedIncident);
          setIncident(updatedIncident);
        }
      } catch (error) {
        console.error('Erreur lors de la récupération des détails de l\'incident:', error);
      }
    } catch (error) {
      console.error('Erreur générale lors du rafraîchissement des détails:', error);
    } finally {
      setLoading(false);
    }
  };

  // Gérer le vote pour l'incident
  const handleVote = async (isConfirmed) => {
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
      const result = await apiService.incidents.vote(incident.id, isConfirmed);
      
      // Mettre à jour l'incident avec les nouvelles données
      if (result) {
        // Mettre à jour le vote local
        setHasVoted(true);
        setVoteType(isConfirmed ? 'up' : 'down');
        
        // Mettre à jour les votes dans l'incident
        const updatedVotes = {
          up: isConfirmed ? (incident.votes?.up || 0) + 1 : incident.votes?.up || 0,
          down: !isConfirmed ? (incident.votes?.down || 0) + 1 : incident.votes?.down || 0
        };
        
        setIncident(prev => ({
          ...prev,
          votes: updatedVotes,
          reliability_score: result.reliability || prev.reliability_score,
          active: result.active
        }));
        
        Alert.alert(
          "Vote enregistré", 
          `Vous avez ${isConfirmed ? 'confirmé' : 'infirmé'} ce signalement.`
        );
      }
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
    if (!incident.votes) return 0;
    
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
    <SafeAreaView style={styles.container}>
       <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
       <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Détails du signalement</Text>
        <TouchableOpacity onPress={refreshIncidentDetails}>
          <Ionicons name="refresh" size={24} color="#1A73E8" />
        </TouchableOpacity>
      </View>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1A73E8" />
        </View>
      ) : (
        <ScrollView style={styles.content}>
          <View style={styles.incidentHeader}>
            <View style={[styles.typeIcon, { backgroundColor: typeInfo.color }]}>
              <FontAwesome5 name={typeInfo.icon} size={24} color="#fff" />
            </View>
            <View style={styles.incidentInfo}>
              <Text style={styles.incidentTitle}>{typeInfo.title}</Text>
              <Text style={styles.incidentTime}>
                {incident.created_at 
                  ? getElapsedTime(incident.created_at) 
                  : "Date inconnue"}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.sectionContent}>
              {incident.description || typeInfo.description || "Pas de description disponible"}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Position</Text>
            <Text style={styles.sectionContent}>{formatLocation()}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Signalé par</Text>
            <Text style={styles.sectionContent}>
              {incident.reporter?.name || incident.reporter_name || "Utilisateur anonyme"}
            </Text>
          </View>

          <View style={styles.reliabilityContainer}>
            <Text style={styles.reliabilityTitle}>Indice de fiabilité</Text>
            <View style={styles.reliabilityMeter}>
              <View 
                style={[
                  styles.reliabilityFill, 
                  { 
                    width: `${getReliabilityPercentage()}%`,
                    backgroundColor: getReliabilityColor() 
                  }
                ]} 
              />
            </View>
            <Text style={styles.reliabilityPercentage}>{getReliabilityPercentage()}%</Text>
            
            <View style={styles.votesContainer}>
              <View style={styles.voteItem}>
                <Ionicons name="thumbs-up" size={18} color="#34C759" />
                <Text style={styles.voteCount}>{incident.votes?.up || 0}</Text>
              </View>
              <View style={styles.voteItem}>
                <Ionicons name="thumbs-down" size={18} color="#FF3B30" />
                <Text style={styles.voteCount}>{incident.votes?.down || 0}</Text>
              </View>
            </View>
          </View>

          {(!hasVoted && userInfo) && (
            <View style={styles.actionsContainer}>
              <Text style={styles.actionTitle}>Ce signalement est-il exact ?</Text>
              
              <View style={styles.actionButtons}>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.confirmButton]}
                  onPress={() => handleVote(true)}
                >
                  <Ionicons name="thumbs-up" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Confirmer</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.actionButton, styles.infirmButton]}
                  onPress={() => handleVote(false)}
                >
                  <Ionicons name="thumbs-down" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Infirmer</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          {(hasVoted && voteType) && (
            <View style={styles.userVoteContainer}>
              <Text style={styles.userVoteText}>
                Vous avez {voteType === 'up' ? 'confirmé' : 'infirmé'} ce signalement
              </Text>
              <Ionicons 
                name={voteType === 'up' ? "thumbs-up" : "thumbs-down"} 
                size={20} 
                color={voteType === 'up' ? "#34C759" : "#FF3B30"} 
              />
            </View>
          )}
          
          {!userInfo && (
            <TouchableOpacity 
              style={styles.loginPrompt}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.loginPromptText}>
                Connectez-vous pour voter sur ce signalement
              </Text>
              <Ionicons name="log-in" size={20} color="#1A73E8" />
            </TouchableOpacity>
          )}
          
          {/* Bouton pour voir l'itinéraire */}
          <TouchableOpacity 
            style={styles.routeButton}
            onPress={() => {
              // Ici, vous pouvez naviguer vers l'écran d'itinéraire
              // en passant les coordonnées de l'incident comme destination
              navigation.navigate('RouteSearch', { 
                destination: incident.coords || incident.location 
              });
            }}
          >
            <Ionicons name="navigate" size={20} color="#fff" />
            <Text style={styles.routeButtonText}>Naviguer vers ce lieu</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    // Supprime tout padding ici, car il sera géré dans le header
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    // Ajuster le padding en haut pour tenir compte de la barre d'état
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight + 20,
    marginTop: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  incidentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  typeIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  incidentInfo: {
    flex: 1,
  },
  incidentTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  incidentTime: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  sectionContent: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
  },
  reliabilityContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  reliabilityTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  reliabilityMeter: {
    height: 8,
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  reliabilityFill: {
    height: '100%',
    backgroundColor: '#34C759',
  },
  reliabilityPercentage: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginVertical: 8,
  },
  votesContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
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
  actionsContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 120,
  },
  confirmButton: {
    backgroundColor: '#34C759',
  },
  infirmButton: {
    backgroundColor: '#FF3B30',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  userVoteContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userVoteText: {
    fontSize: 16,
    color: '#333',
    marginRight: 8,
  },
  loginPrompt: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  loginPromptText: {
    fontSize: 16,
    color: '#1A73E8',
    marginRight: 8,
  },
  routeButton: {
    backgroundColor: '#1A73E8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  routeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 8,
  },
  
  noIncidentText: {
  fontSize: 16,
  color: '#666',
  textAlign: 'center',
  marginTop: 50,
}
});

export default IncidentDetailScreen;