// Créez un nouveau fichier à la racine de votre projet: mapboxPatch.js

// Ce fichier va patcher les modules natifs de MapboxGL
// pour désactiver complètement les fonctionnalités de localisation problématiques

import { NativeModules } from 'react-native';

// Fonction pour patcher les modules natifs de MapboxGL
function patchMapboxNativeModules() {
  console.log('Tentative de patch des modules natifs MapboxGL...');
  
  try {
    // Vérifier si les modules natifs MapboxGL sont disponibles
    if (NativeModules.RNMBXModule) {
      console.log('Module RNMBXModule trouvé, application du patch...');
      
      // Sauvegarde des fonctions originales que nous allons remplacer
      const originalSetUserTrackingMode = NativeModules.RNMBXModule.setUserTrackingMode;
      
      // Remplacer par des fonctions vides qui ne font rien
      NativeModules.RNMBXModule.setUserTrackingMode = (reactTag, userTrackingMode, animated) => {
        console.log('setUserTrackingMode patché appelé - opération ignorée');
        // Ne rien faire
        return Promise.resolve();
      };
      
      console.log('Patch appliqué avec succès à RNMBXModule');
    }
    
    // Vérifier si le module de localisation est disponible
    if (NativeModules.RNMBXLocationModule) {
      console.log('Module RNMBXLocationModule trouvé, application du patch...');
      
      // Sauvegarder les fonctions originales
      const originalStart = NativeModules.RNMBXLocationModule.start;
      const originalSetPaused = NativeModules.RNMBXLocationModule.setPaused;
      const originalSetRenderMode = NativeModules.RNMBXLocationModule.setRenderMode;
      
      // Remplacer par des fonctions vides qui ne font rien
      NativeModules.RNMBXLocationModule.start = () => {
        console.log('LocationModule.start patché appelé - opération ignorée');
        return Promise.resolve();
      };
      
      NativeModules.RNMBXLocationModule.setPaused = (paused) => {
        console.log('LocationModule.setPaused patché appelé - opération ignorée');
        return Promise.resolve();
      };
      
      NativeModules.RNMBXLocationModule.setRenderMode = (renderMode) => {
        console.log('LocationModule.setRenderMode patché appelé - opération ignorée');
        return Promise.resolve();
      };
      
      console.log('Patch appliqué avec succès à RNMBXLocationModule');
    }
    
    console.log('Patching des modules MapboxGL terminé');
    return true;
  } catch (error) {
    console.error('Erreur lors du patching des modules MapboxGL:', error);
    return false;
  }
}

// Exécuter le patch immédiatement
const success = patchMapboxNativeModules();

export default {
  patchMapboxNativeModules,
  success
};