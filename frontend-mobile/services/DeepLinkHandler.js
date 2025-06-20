// services/DeepLinkHandler.js
import React, { useEffect } from 'react';
import * as Linking from 'expo-linking';

const DeepLinkHandler = ({ navigation }) => {
  useEffect(() => {
    const handleDeepLink = (event) => {
      let url = event.url || event;
      console.log("DeepLinkHandler: URL reçue", url);
      
      try {
        // Parse l'URL
        const { path, queryParams } = Linking.parse(url);
        console.log("DeepLinkHandler: URL parsée", { path, queryParams });
        
        // Gestion des différents types de liens profonds
        if (path === 'route' && queryParams.data) {
          try {
            // Décodage des données de l'itinéraire
            const routeData = JSON.parse(decodeURIComponent(queryParams.data));
            console.log("DeepLinkHandler: Données d'itinéraire", routeData);
            
            // Navigation vers l'écran approprié avec les données
            navigation.navigate('Navigation', { routeData });
          } catch (parseError) {
            console.error("DeepLinkHandler: Erreur lors du parsing des données JSON", parseError);
          }
        }
        // Ajoutez ici d'autres types de liens si nécessaire
      } catch (error) {
        console.error("DeepLinkHandler: Erreur lors du traitement du lien", error);
      }
    };

    // Vérification de l'URL initiale (application lancée depuis un lien)
    Linking.getInitialURL().then(url => {
      if (url) {
        console.log("DeepLinkHandler: URL initiale", url);
        handleDeepLink(url);
      }
    }).catch(err => console.error("DeepLinkHandler: Erreur lors de la récupération de l'URL initiale", err));

    // Écoute des liens entrants lorsque l'application est déjà ouverte
    const subscription = Linking.addEventListener('url', handleDeepLink);
    
    // Nettoyage lors du démontage du composant
    return () => {
      subscription.remove();
    };
  }, [navigation]);
  
  // Ce composant ne rend rien à l'écran
  return null;
};

export default DeepLinkHandler;