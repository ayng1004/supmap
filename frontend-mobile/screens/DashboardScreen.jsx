// DashboardScreen.jsx - Correction de l'erreur réseau
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  StyleSheet, 
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Platform,
  Image,
  Alert
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import OverviewScreen from './OverviewScreen';
import ProfileScreen from './ProfileScreen';
import StatsScreen from './StatsScreen';
import apiService from '../services/api';
import authService from '../services/auth/auth';

// Configuration de l'URL de base de l'API - IMPORTANT: Modifier cette valeur
// Remplacer par l'adresse IP de votre machine au lieu de localhost
// Par exemple: '192.168.1.10' ou '10.0.2.2' pour l'émulateur Android

const DashboardScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    incidents: 0,
    votes: 0,
    badges: []
  });
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        setLoading(true);
        const token = await authService.getToken();
        const userInfoStr = await AsyncStorage.getItem('userInfo');
  
        if (!token) {
          console.log("Pas de token trouvé, redirection vers login");
          navigation.replace('Login', { redirectTo: 'Dashboard' });
          return;
        }
  
        if (userInfoStr) {
          const userInfo = JSON.parse(userInfoStr);
          setUser(userInfo);
  
          try {
            const statsRes = await apiService.incidents.getStats(userInfo.id);
  
            if (statsRes?.success === false) {
              console.warn("Erreur stats API:", statsRes.error);
              setStats({
                incidents: 0,
                votes: 0,
                badges: []
              });
              return;
            }
  
            processStats(userInfo, statsRes.stats);
          } catch (statsError) {
            console.error("Erreur récupération stats:", statsError.message);
            const storedStats = await AsyncStorage.getItem('userStats');
            if (storedStats) {
              setStats(JSON.parse(storedStats));
            } else {
              setStats({ incidents: 0, votes: 0, badges: [] });
            }
          }
  
          return;
        }
  
        // Sinon, appel de /auth/verify
        try {
          const verify = await apiService.auth.verify();
  
          if (verify?.valid && verify.user) {
            setUser(verify.user);
            await AsyncStorage.setItem('userInfo', JSON.stringify(verify.user));
  
            const statsRes = await apiService.incidents.getStats(verify.user.id);
  
            if (statsRes?.success === false) {
              console.warn("Erreur stats API:", statsRes.error);
              setStats({
                incidents: 0,
                votes: 0,
                badges: []
              });
              return;
            }
  
            processStats(verify.user, statsRes.stats);
          } else {
            throw new Error("Utilisateur non valide");
          }
        } catch (err) {
          console.error("Erreur API verify ou stats:", err.message);
          Alert.alert(
            "Erreur",
            "Impossible de récupérer vos données. Veuillez réessayer.",
            [{ text: "OK", onPress: () => navigation.replace("Login") }]
          );
        }
      } catch (err) {
        console.error('Erreur globale:', err.message);
        setStats({ incidents: 0, votes: 0, badges: [] });
      } finally {
        setLoading(false);
      }
    };
  
    loadUserData();
  }, [navigation]);

  // Fonction pour traiter les statistiques et créer les badges
  const processStats = (userData, statsData) => {
    console.log("Traitement des statistiques:", statsData);
    
    // Badges configurés
    const ALL_INCIDENT_BADGES = ["10+ incidents", "20+ incidents", "30+ incidents"];
    const ALL_VOTE_BADGES = ["10+ votes", "20+ votes", "30+ votes"];
    
    const formattedBadges = [];

    // Badges d'incidents
    ALL_INCIDENT_BADGES.forEach(badge => {
      const badgeIncluded = statsData.badges?.incidents?.includes(badge) || false;
      
      formattedBadges.push({
        label: badge,
        color: badgeIncluded ? 'success' : 'disabled',
        icon: 'warning',
        category: 'incident'
      });
    });
    
    // Badges de votes
    ALL_VOTE_BADGES.forEach(badge => {
      const badgeIncluded = statsData.badges?.votes?.includes(badge) || false;
      
      formattedBadges.push({
        label: badge,
        color: badgeIncluded ? 'info' : 'disabled',
        icon: 'thumbs-up',
        category: 'vote'
      });
    });
      
    // Badges d'ancienneté
    const creationDate = new Date(userData.created_at || Date.now());
    const now = new Date();
    const monthsDiff = (now.getFullYear() - creationDate.getFullYear()) * 12 +
                      (now.getMonth() - creationDate.getMonth());
    
    if (monthsDiff >= 6) {
      formattedBadges.push({
        label: 'Membre depuis 6 mois',
        color: 'warning',
        icon: 'map',
        category: 'anciennete'
      });
    }

    if (monthsDiff >= 12) {
      formattedBadges.push({
        label: 'Membre depuis 1 an',
        color: 'primary',
        icon: 'map',
        category: 'anciennete'
      });
    }
    
    // Définir les statistiques 
    const updatedStats = {
      incidents: statsData.incidentsReported || 0,
      votes: statsData.votesCast || 0,
      badges: formattedBadges
    };
    
    console.log("Statistiques formatées:", updatedStats);
    setStats(updatedStats);
    
    // Enregistrer les statistiques dans AsyncStorage pour les récupérer facilement ailleurs
    AsyncStorage.setItem('userStats', JSON.stringify(updatedStats));
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
      await AsyncStorage.removeItem('userStats');
      navigation.replace('Login');
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      Alert.alert("Erreur", "Une erreur est survenue lors de la déconnexion");
    }
  };
  
  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };
  
  const closeMenu = () => {
    setMenuOpen(false);
  };
  
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    closeMenu();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4285F4" />
        <Text style={styles.loadingText}>Chargement de votre profil...</Text>
      </View>
    );
  }

  // Contenu en fonction de l'onglet actif
  const renderContent = () => {
    // Vérifier si l'utilisateur est valide
    if (!user) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={60} color="#FF3B30" />
          <Text style={styles.errorText}>Session expirée</Text>
          <Text style={styles.errorSubtext}>Veuillez vous reconnecter</Text>
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={() => navigation.replace('Login')}
          >
            <Text style={styles.loginButtonText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      );
    }

    switch (activeTab) {
      case 'profile':
        return <ProfileScreen route={{ params: { user } }} navigation={navigation} />;
      case 'stats':
        return <StatsScreen route={{ params: { stats, userId: user ? user.id : null } }} navigation={navigation} />;
      case 'overview':
      default:
        return <OverviewScreen user={user} stats={stats} navigation={navigation} />;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <View style={styles.container}>
        {/* Bouton de menu pour mobile */}
        <TouchableOpacity 
          style={styles.menuToggle} 
          onPress={toggleMenu}
          activeOpacity={0.7}
        >
          {menuOpen ? 
            <Ionicons name="close" size={24} color="#333" /> :
            <Ionicons name="menu" size={24} color="#333" />
          }
        </TouchableOpacity>
        
        {/* Overlay pour fermer le menu sur mobile */}
        {menuOpen && (
          <TouchableOpacity 
            style={styles.overlay} 
            activeOpacity={1}
            onPress={closeMenu}
          />
        )}
        
        {/* Sidebar / Menu latéral */}
        <View style={[
          styles.sidebar,
          menuOpen ? styles.sidebarOpen : styles.sidebarClosed
        ]}>
          <View style={styles.sidebarHeader}>
            <Ionicons name="map" size={28} color="#FFFFFF" />
            <Text style={styles.headerTitle}>GéoAlert</Text>
          </View>
          
          <View style={styles.userSection}>
            <View style={styles.userAvatar}>
              {user?.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={24} color="#FFFFFF" />
              )}
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user?.username || "Utilisateur"}</Text>
              <Text style={styles.userEmail}>{user?.email || ""}</Text>
            </View>
          </View>
          
          <View style={styles.navMenu}>
            <TouchableOpacity 
              style={[styles.menuItem, activeTab === 'overview' && styles.activeMenuItem]}
              onPress={() => handleTabChange('overview')}
            >
              <Ionicons name="speedometer" size={22} color="#FFFFFF" />
              <Text style={styles.menuItemText}>Tableau de bord</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.menuItem, activeTab === 'profile' && styles.activeMenuItem]}
              onPress={() => handleTabChange('profile')}
            >
              <Ionicons name="person" size={22} color="#FFFFFF" />
              <Text style={styles.menuItemText}>Profil</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.menuItem, activeTab === 'stats' && styles.activeMenuItem]}
              onPress={() => handleTabChange('stats')}
            >
              <Ionicons name="stats-chart" size={22} color="#FFFFFF" />
              <Text style={styles.menuItemText}>Statistiques</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => {
                closeMenu();
                navigation.navigate('Map');
              }}
            >
              <Ionicons name="map-outline" size={22} color="#FFFFFF" />
              <Text style={styles.menuItemText}>Carte</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.sidebarFooter}>
            <TouchableOpacity 
              style={styles.logoutButton}
              onPress={handleLogout}
            >
              <Ionicons name="log-out" size={22} color="#FFFFFF" />
              <Text style={styles.logoutText}>Déconnexion</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Contenu principal */}
        <View style={[
          styles.mainContent,
          menuOpen && styles.mainContentShifted
        ]}>
          <View style={styles.header}>
            <Text style={styles.headerText}>
              {activeTab === 'overview' && 'Tableau de bord'}
              {activeTab === 'profile' && 'Mon Profil'}
              {activeTab === 'stats' && 'Mes Statistiques'}
            </Text>

            {/* Bouton pour retourner à la carte */}
            <TouchableOpacity 
              style={styles.mapButton}
              onPress={() => navigation.navigate('Map')}
            >
              <Ionicons name="map-outline" size={22} color="#4285F4" />
            </TouchableOpacity>
          </View>
          
          <ScrollView 
            style={styles.contentScrollView}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {renderContent()}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  // Overlay
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 5,
  },
  // Menu toggle
  menuToggle: {
    position: 'absolute',
    top: 15,
    left: 15,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  // Sidebar styles
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 280,
    backgroundColor: '#222C3C',
    zIndex: 8,
    paddingTop: Platform.OS === 'ios' ? 0 : StatusBar.currentHeight,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  sidebarOpen: {
    transform: [{ translateX: 0 }],
  },
  sidebarClosed: {
    transform: [{ translateX: -280 }],
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#1A2435',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  userSection: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userEmail: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginTop: 4,
  },
  navMenu: {
    flex: 1,
    paddingTop: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    paddingLeft: 20,
  },
  activeMenuItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#4285F4',
  },
  menuItemText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 15,
  },
  sidebarFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 15,
  },
  // Main content styles
  mainContent: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    marginLeft: 0,
    paddingTop: 60, // Espace pour le bouton de menu en haut
  },
  mainContentShifted: {
    marginLeft: Platform.OS === 'ios' ? 280 : 0,
    opacity: Platform.OS === 'ios' ? 0.8 : 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  headerText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  mapButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F5F7FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentScrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 15,
    paddingBottom: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666666',
  },
  // Error container styles
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
  },
  errorSubtext: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
    marginBottom: 30,
  },
  loginButton: {
    backgroundColor: '#4285F4',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default DashboardScreen;