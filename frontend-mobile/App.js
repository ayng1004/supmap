import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View, StatusBar, Platform, SafeAreaView, LogBox } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking'; // Ajout pour les deep links
import { useNavigation } from '@react-navigation/native'; // Ajout pour accéder à la navigation
import AuthUrlHandler from './utils/AuthUrlHandler';
import MapboxGL from '@rnmapbox/maps';

import './mapboxPatch'; // Importer le patch pour désactiver les fonctionnalités problématiques

import DeepLinkHandler from './services/DeepLinkHandler';

// Configuration de MapboxGL
MapboxGL.setAccessToken(process.env.MAPBOX_API_KEY || 'pk.eyJ1IjoidG95Y2FuIiwiYSI6ImNtYThhMWR0ZjE0NGIycXM2bG05ZXFxdHoifQ.5HZaIXzWUuPTa6lrSenaGQ');
MapboxGL.setTelemetryEnabled(false); // Désactiver la télémétrie


LogBox.ignoreLogs(['Reanimated 2', 'Non-serializable values were found in the navigation state']);

// Import des écrans principaux
import MapScreen from './screens/MapScreen';
import ReportsScreen from './screens/ReportsScreen';
import ProfileScreen from './screens/ProfileScreen';
import ReportIncidentScreen from './screens/ReportIncidentScreen';
import NavigationScreen from './screens/NavigationScreen';
import SearchScreen from './screens/SearchScreen';
import IncidentDetailScreen from './screens/IncidentDetailScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import NewNavigationScreen from './screens/NewNavigationScreen';

// Écrans additionnels
import MessagesScreen from './screens/MessagesScreen';
import StatsScreen from './screens/StatsScreen';
import RouteSearchScreen from './screens/RouteSearchScreen';
import POISearchScreen from './screens/POISearchScreen';
import VoiceSettingsScreen from './screens/VoiceSettingsScreen';
import DashboardScreen from './screens/DashboardScreen';

// Création du stack de navigation
const Stack = createStackNavigator();

// Configuration des deep links pour react-navigation
const linking = {
  prefixes: ['4proj://', 'exp://', 'https://4proj.app'],
  config: {
    screens: {
      Map: 'map',
      Navigation: {
        path: 'route',
        parse: {
          data: (data) => {
            try {
              return data ? JSON.parse(decodeURIComponent(data)) : null;
            } catch (e) {
              console.error('Erreur de parsing JSON:', e);
              return null;
            }
          }
        }
      },
      RouteSearch: 'search/route',
      Login: 'login',
      Register: 'register',
      Profile: 'profile',
      ReportIncident: 'report',
      // Autres écrans...
    },
  },
  // Gestion explicite des URL initiales et des souscriptions
  async getInitialURL() {
    // Vérifier si l'application a été ouverte via un lien
    const url = await Linking.getInitialURL();
    if (url != null) {
      return url;
    }
    return null;
  },
  subscribe(listener) {
    // Écouter les événements d'URL pendant que l'application est ouverte
    const subscription = Linking.addEventListener('url', ({ url }) => {
      listener(url);
    });
    
    return () => {
      subscription.remove();
    };
  },
};

// Wrapper pour DeepLinkHandler avec accès à la navigation
const DeepLinkHandlerWithNavigation = () => {
  const navigation = useNavigation();
  return <DeepLinkHandler navigation={navigation} />;
};

// Options par défaut pour les écrans
const screenOptions = {
  headerShown: false,
  cardStyle: { 
    backgroundColor: '#FFFFFF',
    // Ajouter un padding pour éviter que le contenu soit coupé en haut
    // Différent selon la plateforme
    ...Platform.select({
      ios: {
        // Sur iOS, utiliser un padding plus important pour éviter d'être coupé par le notch
        paddingTop: 0
      },
      android: {
        // Sur Android, tenir compte de la barre de statut
        paddingTop: 0
      }
    })
  }
};

export default function App() {
  const [initialRouteName, setInitialRouteName] = useState('Login');
  const [isLoading, setIsLoading] = useState(true);

  // Vérifier si l'utilisateur est déjà connecté au démarrage
  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        if (token) {
          // Si le token existe, définir la route initiale sur la carte
          setInitialRouteName('Map');
        }
      } catch (error) {
        console.error('Erreur lors de la vérification du statut de connexion:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Configurer la barre de statut
    StatusBar.setBarStyle('dark-content');
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor('transparent');
      StatusBar.setTranslucent(true);
    }

    checkLoginStatus();
  }, []);

  // Afficher un écran de chargement pendant la vérification
  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' }}>
        <View />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <NavigationContainer linking={linking}>
        <Stack.Navigator 
          initialRouteName={initialRouteName}
          screenOptions={screenOptions}
        >
          {/* Écrans principaux */}
          <Stack.Screen name="Map" component={MapScreen} />
          <Stack.Screen name="Reports" component={ReportsScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="ReportIncident" component={ReportIncidentScreen} />
          <Stack.Screen name="Navigation" component={NavigationScreen} />
          <Stack.Screen name="Search" component={SearchScreen} />
          <Stack.Screen name="IncidentDetail" component={IncidentDetailScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="RouteSearch" component={RouteSearchScreen} />
     
          {/* Tableau de bord avec les statistiques */}
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="Stats" component={StatsScreen} />
          
          {/* Écrans additionnels */}
          <Stack.Screen name="Messages" component={MessagesScreen} />
          <Stack.Screen name="POISearch" component={POISearchScreen} />
          <Stack.Screen name="VoiceSettings" component={VoiceSettingsScreen} />
        </Stack.Navigator>
        
        {/* Ajout du composant DeepLinkHandler */}
        <DeepLinkHandlerWithNavigation />
      </NavigationContainer>
    </SafeAreaView>
  );
} 