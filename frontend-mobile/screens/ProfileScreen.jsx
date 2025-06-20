import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, Switch, SafeAreaView, Alert } from 'react-native';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authService from '../services/auth/auth';


const ProfileScreen = ({ navigation }) => {
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [voiceNavigation, setVoiceNavigation] = useState(true);
  const [showSpeed, setShowSpeed] = useState(true);
  const [user, setUser] = useState({
    username: '',
    email: '',
    points: 0,
    level: 'Débutant',
    avatarUrl: null,
    contributions: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Charger les données utilisateur depuis AsyncStorage au chargement du composant
    const loadUserData = async () => {
      try {
        const userInfo = await authService.getUserInfo();
if (userInfo) {
  setUser({
    username: userInfo.username || 'Utilisateur',
    email: userInfo.email || '',
    points: userInfo.points || 0,
    level: getDynamicLevel(userInfo.points || 0),
    avatarUrl: userInfo.avatar_url || 'https://randomuser.me/api/portraits/lego/1.jpg',
    contributions: userInfo.contributions || 0
  });
}
      } catch (error) {
        console.error('Erreur lors du chargement des données utilisateur:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, []);

  // Fonction pour déterminer le niveau en fonction des points
  const getDynamicLevel = (points) => {
    if (points >= 2000) return 'Expert';
    if (points >= 1000) return 'Explorateur';
    if (points >= 500) return 'Contributeur';
    if (points >= 100) return 'Navigateur';
    return 'Débutant';
  };

  const toggleNotifications = () => setNotifications(prev => !prev);
  const toggleDarkMode = () => setDarkMode(prev => !prev);
  const toggleVoiceNavigation = () => setVoiceNavigation(prev => !prev);
  const toggleShowSpeed = () => setShowSpeed(prev => !prev);

  const handleLogout = async () => {
    try {
      // Supprimer les données d'authentification du stockage
      await authService.logout();
      
      // Rediriger vers l'écran de connexion
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      Alert.alert('Erreur', 'Un problème est survenu lors de la déconnexion');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      

      <ScrollView style={styles.container}>
        {/* Profil utilisateur */}
        <View style={styles.profileCard}>
          <Image 
            source={{ 
              uri: user.avatarUrl || 'https://randomuser.me/api/portraits/lego/1.jpg' 
            }} 
            style={styles.avatar}
          />
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>{user.username}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
            <View style={styles.levelContainer}>
              <Text style={styles.levelText}>{user.level}</Text>
            </View>
          </View>
        </View>

        {/* Statistiques */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user.points}</Text>
            <Text style={styles.statLabel}>Points</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user.contributions}</Text>
            <Text style={styles.statLabel}>Contributions</Text>
          </View>
        </View>

        {/* Paramètres */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Préférences</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingIconContainer}>
              <Ionicons name="notifications" size={22} color="#fff" />
            </View>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>Notifications</Text>
              <Text style={styles.settingDescription}>Alertes de trafic et d'incidents</Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={toggleNotifications}
              trackColor={{ false: '#D1D1D6', true: '#34C759' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingItem}>
            <View style={[styles.settingIconContainer, { backgroundColor: '#5856D6' }]}>
              <Ionicons name="moon" size={22} color="#fff" />
            </View>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>Mode sombre</Text>
              <Text style={styles.settingDescription}>Réduire la luminosité de l'écran</Text>
            </View>
            <Switch
              value={darkMode}
              onValueChange={toggleDarkMode}
              trackColor={{ false: '#D1D1D6', true: '#5856D6' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingItem}>
            <View style={[styles.settingIconContainer, { backgroundColor: '#007AFF' }]}>
              <Ionicons name="volume-high" size={22} color="#fff" />
            </View>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>Navigation vocale</Text>
              <Text style={styles.settingDescription}>Instructions audibles</Text>
            </View>
            <Switch
              value={voiceNavigation}
              onValueChange={toggleVoiceNavigation}
              trackColor={{ false: '#D1D1D6', true: '#007AFF' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingItem}>
            <View style={[styles.settingIconContainer, { backgroundColor: '#FF9500' }]}>
              <MaterialIcons name="speed" size={22} color="#fff" />
            </View>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>Afficher la vitesse</Text>
              <Text style={styles.settingDescription}>Compteur de vitesse sur la carte</Text>
            </View>
            <Switch
              value={showSpeed}
              onValueChange={toggleShowSpeed}
              trackColor={{ false: '#D1D1D6', true: '#FF9500' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Menu supplémentaire */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Compte</Text>
          
          <TouchableOpacity style={styles.menuItem}>
            <FontAwesome5 name="history" size={16} color="#666" style={styles.menuIcon} />
            <Text style={styles.menuItemText}>Historique des trajets</Text>
            <MaterialIcons name="chevron-right" size={24} color="#999" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <FontAwesome5 name="map-marked-alt" size={16} color="#666" style={styles.menuIcon} />
            <Text style={styles.menuItemText}>Mes lieux favoris</Text>
            <MaterialIcons name="chevron-right" size={24} color="#999" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <FontAwesome5 name="user-friends" size={16} color="#666" style={styles.menuIcon} />
            <Text style={styles.menuItemText}>Mes amis</Text>
            <MaterialIcons name="chevron-right" size={24} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <FontAwesome5 name="cog" size={16} color="#666" style={styles.menuIcon} />
            <Text style={styles.menuItemText}>Paramètres avancés</Text>
            <MaterialIcons name="chevron-right" size={24} color="#999" />
          </TouchableOpacity>
        </View>

        {/* Bouton déconnexion */}
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles.logoutButtonText}>Déconnexion</Text>
        </TouchableOpacity>

        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>SUPMAP v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  container: {
    flex: 1,
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
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  editButton: {
    padding: 4,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 10,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginRight: 16,
    backgroundColor: '#E1E1E1', // Couleur de fond en attendant le chargement
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  levelContainer: {
    backgroundColor: '#1A73E8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  levelText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginBottom: 16,
    paddingVertical: 15,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#EFEFEF',
  },
  sectionContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: '#999',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  menuIcon: {
    marginRight: 12,
    width: 24,
    textAlign: 'center',
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
    margin: 16,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  versionContainer: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 10,
  },
  versionText: {
    fontSize: 13,
    color: '#999',
  },
});

export default ProfileScreen;