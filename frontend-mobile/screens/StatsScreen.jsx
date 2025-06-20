// StatsScreen.jsx - Fixed with proper null checks
import React, { useState, useEffect } from 'react';

import { View, Text, ScrollView, StyleSheet, ActivityIndicator,Image, } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../services/api'; // <-- ajoute cette ligne

import { Ionicons } from '@expo/vector-icons'; // Using Ionicons instead of FontAwesome

const StatsScreen = ({ route, navigation }) => {
  // Get stats and userId from route params, with default values
  const { stats = { incidents: 0, votes: 0, badges: [] }, userId = null } = route.params || {};
 
  const [incidentTypes, setIncidentTypes] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [incidentCount, setIncidentCount] = useState(0);
  const [voteCount, setVoteCount] = useState(0);
  
  // Ensure badges exist before filtering
  const badges = stats?.badges || [];
  
  // Filtrer les badges par catégorie
  const incidentBadges = badges.filter(badge => badge?.category === 'incident');
  const voteBadges = badges.filter(badge => badge?.category === 'vote');
  const otherBadges = badges.filter(badge => !badge?.category || (badge.category !== 'incident' && badge.category !== 'vote'));
  
  // Convertir les icônes aux noms compatibles avec Ionicons
  const getIconName = (name) => {
    switch(name) {
      case 'warning':
        return 'warning';
      case 'thumbs-up':
        return 'thumbs-up';
      case 'map':
        return 'map';
      default:
        return 'star'; // Icône par défaut
    }
  };
  
  // Obtenir la couleur du badge
  const getBadgeStyle = (colorName) => {
    const styles = {
      success: {
        bg: '#D4EDDA',
        text: '#155724',
        icon: '#155724'
      },
      info: {
        bg: '#D1ECF1',
        text: '#0C5460',
        icon: '#0C5460'
      },
      warning: {
        bg: '#FFF3CD',
        text: '#856404',
        icon: '#856404'
      },
      primary: {
        bg: '#CCE5FF',
        text: '#004085',
        icon: '#004085'
      },
      disabled: {
        bg: '#E2E3E5',
        text: '#383D41',
        icon: '#6C757D'
      }
    };
    
    return styles[colorName] || styles.disabled;
  };

  useEffect(() => {
    const fetchAdditionalStats = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
  
      try {
        setLoading(true);
        const token = await AsyncStorage.getItem('userToken');
        
        if (!token) {
          // If no token, we can't fetch data
          setLoading(false);
          return;
        }
  
        // Récupérer tous les incidents
        const incidentsResponse = await apiService.incidents.getByUser(userId);

  
        // Récupérer le nombre de votes
        const votesResponse = await apiService.incidents.getVoteCount(userId);

  
        if (votesResponse.data?.count !== undefined) {
          setVoteCount(votesResponse.data.count);
        }
  
        if (incidentsResponse.data?.incidents) {
          const allIncidents = incidentsResponse.data.incidents;
  
          const myIncidents = allIncidents.filter(
            (incident) =>
              incident.reporter?.id === userId || incident.reporter_id === userId
          );
          
          // Répartition des types d'incidents
          const types = {};
          myIncidents.forEach((incident) => {
            types[incident.type] = (types[incident.type] || 0) + 1;
          });
  
          const typesArray = Object.entries(types).map(([type, count]) => ({
            name: type,
            value: count,
            color: getColorForType(type),
          }));
  
          setIncidentCount(myIncidents.length);
          setIncidentTypes(typesArray);
  
          // Derniers incidents signalés
          const sorted = [...myIncidents]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 5);
  
          setRecentActivity(sorted);
        }
      } catch (error) {
        console.error('Erreur lors de la récupération des statistiques détaillées:', error);
      } finally {
        setLoading(false);
      }
    };
  
    fetchAdditionalStats();
  }, [userId]);
  
  // Fonction pour obtenir une couleur selon le type d'incident
  const getColorForType = (type) => {
    const typeColors = {
      'accident': '#FF3B30',
      'traffic': '#FF9500', 
      'closure': '#34C759',
      'police': '#007AFF',
      'hazard': '#8E8E93'
    };
    
    return typeColors[type?.toLowerCase()] || '#555555';
  };
  
  const maxValue = incidentTypes.length > 0 
  ? Math.max(...incidentTypes.map(item => item.value)) 
  : 1;

  return (
    <View style={styles.container}>
   


      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.cardTitle}>Incidents signalés</Text>
          <Text style={styles.cardValue}>{stats?.incidents || 0}</Text>
        </View>
        
        <View style={styles.summaryCard}>
          <Text style={styles.cardTitle}>Votes soumis</Text>
          <Text style={styles.cardValue}>{stats?.votes || 0}</Text>
        </View>
        
        <View style={styles.summaryCard}>
          <Text style={styles.cardTitle}>Badges obtenus</Text>
          <Text style={styles.cardValue}>{badges.length}</Text>
        </View>
      </View>
      
      <View style={styles.card}>
        <Text style={styles.cardHeader}>Répartition des types d'incidents</Text>
        
        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="small" color="#4285F4" />
            <Text style={styles.loaderText}>Chargement...</Text>
          </View>
        ) : incidentTypes.length > 0 ? (
          <View style={styles.chartContainer}>
            {incidentTypes.map((type, index) => (
              <View key={index} style={styles.chartRow}>
                <View style={styles.chartLabelContainer}>
                  <View 
                    style={[
                      styles.colorDot, 
                      { backgroundColor: type.color }
                    ]} 
                  />
                  <Text style={styles.chartLabel}>{type.name}: {type.value}</Text>
                </View>
                
                <View style={styles.barContainer}>
                  <View 
                    style={[
                      styles.bar, 
                      { 
                        width: `${(type.value / maxValue) * 100}%`,
                        backgroundColor: type.color
                      }
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>
            Vous n'avez pas encore signalé d'incidents.
          </Text>
        )}
      </View>
      
      <View style={styles.card}>
        <Text style={styles.cardHeader}>Derniers incidents signalés</Text>
        
        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="small" color="#4285F4" />
            <Text style={styles.loaderText}>Chargement...</Text>
          </View>
        ) : recentActivity.length > 0 ? (
          <View style={styles.tableContainer}>
            <View style={styles.tableHeader}>
              <Text style={[styles.headerText, { flex: 2 }]}>Type</Text>
              <Text style={[styles.headerText, { flex: 2 }]}>Date</Text>
              <Text style={[styles.headerText, { flex: 1 }]}>Statut</Text>
            </View>
            
            <ScrollView style={styles.tableScrollView}>
              {recentActivity.map((incident, index) => (
                <View key={index} style={styles.tableRow}>
                  <Text style={[styles.cellText, { flex: 2 }]}>{incident.type}</Text>
                  <Text style={[styles.cellText, { flex: 2 }]}>
                    {new Date(incident.created_at).toLocaleDateString()}
                  </Text>
                  <Text style={[styles.cellText, { flex: 1 }]}>
                    {incident.active ? "Actif" : "Inactif"}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : (
          <Text style={styles.emptyText}>
            Vous n'avez pas encore signalé d'incidents.
          </Text>
        )}
      </View>
      
      <View style={styles.card}>
        <Text style={styles.cardHeader}>Badges de contribution</Text>
        
        <View style={styles.badgeSection}>
          <Text style={styles.badgeCategoryTitle}>Incidents</Text>
          <View style={styles.badgesList}>
            {incidentBadges.map((badge, index) => {
              const badgeStyle = getBadgeStyle(badge.color);
              return (
                <View 
                  key={index} 
                  style={[
                    styles.badgeItem, 
                    { backgroundColor: badgeStyle.bg }
                  ]}
                >
                  <Ionicons 
                    name={getIconName(badge.icon)} 
                    size={14} 
                    color={badgeStyle.icon} 
                  />
                  <Text 
                    style={[
                      styles.badgeText, 
                      { color: badgeStyle.text }
                    ]}
                  >
                    {badge.label}
                  </Text>
                </View>
              );
            })}
          </View>

          <Text style={styles.badgeCategoryTitle}>Votes</Text>
          <View style={styles.badgesList}>
            {voteBadges.map((badge, index) => {
              const badgeStyle = getBadgeStyle(badge.color);
              return (
                <View 
                  key={index} 
                  style={[
                    styles.badgeItem, 
                    { backgroundColor: badgeStyle.bg }
                  ]}
                >
                  <Ionicons 
                    name={getIconName(badge.icon)} 
                    size={14} 
                    color={badgeStyle.icon} 
                  />
                  <Text 
                    style={[
                      styles.badgeText, 
                      { color: badgeStyle.text }
                    ]}
                  >
                    {badge.label}
                  </Text>
                </View>
              );
            })}
          </View>
          
          {otherBadges.length > 0 && (
            <>
              <Text style={styles.badgeCategoryTitle}>Ancienneté</Text>
              <View style={styles.badgesList}>
                {otherBadges.map((badge, index) => {
                  const badgeStyle = getBadgeStyle(badge.color);
                  return (
                    <View 
                      key={index} 
                      style={[
                        styles.badgeItem, 
                        { backgroundColor: badgeStyle.bg }
                      ]}
                    >
                      <Ionicons 
                        name={getIconName(badge.icon)} 
                        size={14} 
                        color={badgeStyle.icon} 
                      />
                      <Text 
                        style={[
                          styles.badgeText, 
                          { color: badgeStyle.text }
                        ]}
                      >
                        {badge.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,

  },
  summaryRow: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 5,
    textAlign: 'center',
  },
  cardValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333333',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 2,
  },
  cardHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 15,
  },
  loaderContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loaderText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#666666',
  },
  chartContainer: {
    marginTop: 10,
  },
  chartRow: {
    marginBottom: 12,
  },
  chartLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  chartLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
  },
  barContainer: {
    height: 16,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 8,
  },
  tableContainer: {
    marginTop: 5,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  headerText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#666666',
  },
  tableScrollView: {
    maxHeight: 200,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  cellText: {
    fontSize: 13,
    color: '#333333',
  },
  badgeSection: {
    marginTop: 5,
  },
  badgeCategoryTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
    marginTop: 10,
    marginBottom: 8,
  },
  badgesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  badgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },
  emptyText: {
    fontSize: 14,
    color: '#888888',
    fontStyle: 'italic',
    padding: 10,
  },
});

export default StatsScreen;