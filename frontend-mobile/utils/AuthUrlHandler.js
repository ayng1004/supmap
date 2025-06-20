import { Linking } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Gestionnaire d'URL pour l'authentification OAuth
 */
class AuthUrlHandler {
  constructor(navigationRef) {
    this.navigationRef = navigationRef;
    this.initialUrl = null;
    this.urlListener = null;
  }

  /**
   * Initialise le gestionnaire d'URL
   */
  init = async () => {
    // Récupérer l'URL initiale si l'application a été ouverte via une URL
    try {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        console.log('URL initiale trouvée:', initialUrl);
        this.handleUrl(initialUrl);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'URL initiale:', error);
    }

    // Ajouter un écouteur pour les URL entrantes
    this.urlListener = Linking.addEventListener('url', ({ url }) => {
      console.log('URL reçue via le listener:', url);
      this.handleUrl(url);
    });
  };

  /**
   * Gère une URL entrante
   * @param {string} url - L'URL à traiter
   */
  handleUrl = async (url) => {
    if (!url) return;

    console.log('Traitement de l\'URL:', url);

    try {
      // Vérifier si l'URL est une redirection d'authentification
      if (url.includes('token=')) {
        // Extraire le token et les données utilisateur
        const urlObj = new URL(url);
        const params = new URLSearchParams(urlObj.search);
        
        const token = params.get('token');
        const userData = params.get('user');
        
        if (token) {
          console.log('Token trouvé dans l\'URL');
          
          // Sauvegarder le token
          await SecureStore.setItemAsync('userToken', token);
          
          // Sauvegarder les infos utilisateur si disponibles
          if (userData) {
            try {
              const user = JSON.parse(decodeURIComponent(userData));
              await SecureStore.setItemAsync('userInfo', JSON.stringify(user));
              console.log('Données utilisateur sauvegardées');
            } catch (parseError) {
              console.error('Erreur lors du parsing des données utilisateur:', parseError);
            }
          }
          
          // Rediriger vers l'écran principal si la navigation est disponible
          if (this.navigationRef && this.navigationRef.current) {
            console.log('Redirection vers l\'écran Map');
            
            // Vérifier si l'utilisateur était en train de signaler un incident
            const routeState = this.navigationRef.current.getRootState();
            let redirectParams = {};
            
            try {
              // Parcourir l'historique de navigation pour trouver des paramètres à préserver
              if (routeState && routeState.routes) {
                for (const route of routeState.routes) {
                  if (route.name === 'Login' && route.params) {
                    if (route.params.redirectAfterLogin) {
                      redirectParams = {
                        screen: route.params.redirectAfterLogin,
                        params: {}
                      };
                      
                      // Ajouter les paramètres de localisation si présents
                      if (route.params.locationLat && route.params.locationLng) {
                        redirectParams.params.locationLat = route.params.locationLat;
                        redirectParams.params.locationLng = route.params.locationLng;
                      }
                      
                      break;
                    }
                  }
                }
              }
            } catch (navError) {
              console.error('Erreur lors de l\'analyse de l\'état de navigation:', navError);
            }
            
            // Rediriger en fonction des paramètres
            if (redirectParams.screen) {
              this.navigationRef.current.navigate(redirectParams.screen, redirectParams.params);
            } else {
              this.navigationRef.current.navigate('Map');
            }
          } else {
            console.log('Navigation non disponible');
          }
        } else {
          console.log('Pas de token dans l\'URL');
        }
      }
    } catch (error) {
      console.error('Erreur lors du traitement de l\'URL:', error);
    }
  };

  /**
   * Nettoie les écouteurs d'URL
   */
  cleanup = () => {
    if (this.urlListener) {
      this.urlListener.remove();
      this.urlListener = null;
      console.log('Listener d\'URL nettoyé');
    }
  };
}

export default AuthUrlHandler;