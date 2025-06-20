// OverviewContent.jsx - Version Mobile
import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const OverviewScreen = ({ user, stats, navigation }) => {
  // Sélectionner quelques badges à afficher sur la vue d'ensemble
  const highlightedBadges = stats.badges.slice(0, 3);
  
  // Conversion des icônes à partir des noms (pour compatibilité avec Ionicons)
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
  
  // Obtenir la couleur en fonction de la catégorie du badge
  const getBadgeColor = (colorName) => {
    const colors = {
      success: '#28A745',
      info: '#17A2B8',
      warning: '#FFC107',
      primary: '#007BFF',
      disabled: '#6C757D'
    };
    return colors[colorName] || colors.disabled;
  };
  
  // Obtenir la couleur du texte en fonction de la couleur de badge
  const getTextColor = (colorName) => {
    const textColors = {
      success: '#155724',
      info: '#0C5460',
      warning: '#856404',
      primary: '#004085',
      disabled: '#383D41'
    };
    return textColors[colorName] || textColors.disabled;
  };
  
  // Obtenir la couleur de fond en fonction de la couleur de badge
  const getBackgroundColor = (colorName) => {
    const bgColors = {
      success: '#D4EDDA',
      info: '#D1ECF1',
      warning: '#FFF3CD',
      primary: '#CCE5FF',
      disabled: '#E2E3E5'
    };
    return bgColors[colorName] || bgColors.disabled;
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.welcomeCard}>
        <Text style={styles.welcomeTitle}>Bienvenue, {user?.username} !</Text>
        <Text style={styles.welcomeSubtitle}>Voici un résumé de votre activité sur GéoAlert</Text>
        <Text style={styles.lastActivity}>Dernière connexion: {new Date().toLocaleDateString()}</Text>
      </View>
      
      <View style={styles.statsRow}>
        <View style={styles.statsCard}>
          <View style={[styles.iconContainer, { backgroundColor: 'rgba(255, 59, 48, 0.1)' }]}>
            <Ionicons name="warning" size={20} color="#FF3B30" />
          </View>
          <View style={styles.statsContent}>
            <Text style={styles.statsLabel}>Incidents signalés</Text>
            <Text style={styles.statsValue}>{stats.incidents}</Text>
          </View>
        </View>
        
        <View style={styles.statsCard}>
          <View style={[styles.iconContainer, { backgroundColor: 'rgba(52, 199, 89, 0.1)' }]}>
            <Ionicons name="thumbs-up" size={20} color="#34C759" />
          </View>
          <View style={styles.statsContent}>
            <Text style={styles.statsLabel}>Votes soumis</Text>
            <Text style={styles.statsValue}>{stats.votes}</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.statsCard}>
        <View style={[styles.iconContainer, { backgroundColor: 'rgba(255, 149, 0, 0.1)' }]}>
          <Ionicons name="trophy" size={20} color="#FF9500" />
        </View>
        <View style={styles.statsContent}>
          <Text style={styles.statsLabel}>Badges</Text>
          <Text style={styles.statsValue}>{stats.badges.length}</Text>
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Badges récents</Text>
        
        {highlightedBadges.length > 0 ? (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.badgesScroll}
          >
            {highlightedBadges.map((badge, index) => (
              <View 
                key={index} 
                style={[
                  styles.badgeItem, 
                  { backgroundColor: getBackgroundColor(badge.color) }
                ]}
              >
                <Ionicons 
                  name={getIconName(badge.icon)} 
                  size={16} 
                  color={getTextColor(badge.color)} 
                />
                <Text style={[
                  styles.badgeText,
                  { color: getTextColor(badge.color) }
                ]}>
                  {badge.label}
                </Text>
              </View>
            ))}
            
            {stats.badges.length > 3 && (
              <TouchableOpacity 
                style={styles.moreBadges}
                onPress={() => navigation.navigate('Stats')}
              >
                <Text style={styles.moreBadgesText}>+{stats.badges.length - 3} autres</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        ) : (
          <Text style={styles.emptyText}>Vous n'avez pas encore obtenu de badges.</Text>
        )}
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Accès rapides</Text>
        
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('Map')}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="map" size={22} color="#FFFFFF" />
            </View>
            <Text style={styles.actionText}>Carte</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('Profile')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#34C759' }]}>
              <Ionicons name="person" size={22} color="#FFFFFF" />
            </View>
            <Text style={styles.actionText}>Profil</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('Stats')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#FF9500' }]}>
              <Ionicons name="stats-chart" size={22} color="#FFFFFF" />
            </View>
            <Text style={styles.actionText}>Stats</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('ReportIncident')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#FF3B30' }]}>
              <Ionicons name="warning" size={22} color="#FFFFFF" />
            </View>
            <Text style={styles.actionText}>Signaler</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Derniers incidents signalés</Text>
        
        {stats.incidents > 0 ? (
          <View style={styles.incidentsContainer}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { flex: 2 }]}>Type</Text>
              <Text style={[styles.tableHeaderText, { flex: 2 }]}>Date</Text>
              <Text style={[styles.tableHeaderText, { flex: 1 }]}>Statut</Text>
              <Text style={[styles.tableHeaderText, { flex: 1 }]}>Votes</Text>
            </View>
            
            {/* Données d'exemple - À remplacer par les vraies données */}
            <View style={styles.tableRow}>
              <Text style={[styles.tableText, { flex: 2 }]}>Accident</Text>
              <Text style={[styles.tableText, { flex: 2 }]}>{new Date().toLocaleDateString()}</Text>
              <Text style={[styles.tableText, { flex: 1 }]}>Actif</Text>
              <Text style={[styles.tableText, { flex: 1, color: '#34C759' }]}>+5</Text>
            </View>
            
            <View style={styles.tableRow}>
              <Text style={[styles.tableText, { flex: 2 }]}>Embouteillage</Text>
              <Text style={[styles.tableText, { flex: 2 }]}>{new Date(Date.now() - 86400000).toLocaleDateString()}</Text>
              <Text style={[styles.tableText, { flex: 1 }]}>Expiré</Text>
              <Text style={[styles.tableText, { flex: 1, color: '#999' }]}>+3</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.emptyText}>Vous n'avez pas encore signalé d'incidents.</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  welcomeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 2,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 5,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 12,
  },
  lastActivity: {
    fontSize: 12,
    color: '#888888',
    marginTop: 5,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  statsCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    marginRight: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 2,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statsContent: {
    flex: 1,
  },
  statsLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  statsValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  section: {
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 15,
  },
  badgesScroll: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  badgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    marginBottom: 5,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },
  moreBadges: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    justifyContent: 'center',
    marginRight: 10,
  },
  moreBadgesText: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 14,
    color: '#888888',
    fontStyle: 'italic',
    marginVertical: 10,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    alignItems: 'center',
    width: '23%',
    marginBottom: 15,
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2.84,
    elevation: 3,
  },
  actionText: {
    fontSize: 12,
    color: '#333333',
  },
  incidentsContainer: {
    marginTop: 5,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    paddingBottom: 10,
    marginBottom: 5,
  },
  tableHeaderText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#666666',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  tableText: {
    fontSize: 13,
    color: '#333333',
  },
});

export default OverviewScreen;