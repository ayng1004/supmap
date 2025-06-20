// frontend-web/src/services/RouteNotificationManager.js
import SmartNavigationService from './SmartNavigationService';

/**
 * Service de gestion des notifications d'itinéraire
 * Gère les notifications lors de la détection d'incidents sur un itinéraire
 * et offre des options pour recalculer automatiquement les itinéraires
 */
class RouteNotificationManager {
  constructor() {
    this.listeners = [];
    this.activeRoute = null;
    this.stopMonitoringFn = null;
    this.autoReroute = false;
    this.lastNotificationTime = 0;
    this.notificationThrottleMs = 60000; // Limiter à une notification par minute
  }

  /**
   * Initialise le gestionnaire et démarre la surveillance des incidents
   * @param {Object} route - Itinéraire à surveiller
   * @param {boolean} autoReroute - Activer le recalcul automatique
   */
  init(route, autoReroute = false) {
    this.activeRoute = route;
    this.autoReroute = autoReroute;

    // Arrêter la surveillance précédente si elle existe
    if (this.stopMonitoringFn) {
      this.stopMonitoringFn();
    }

    // Démarrer la surveillance des incidents
    this.stopMonitoringFn = SmartNavigationService.startIncidentMonitoring(
      route,
      this.handleIncidentDetected.bind(this)
    );
  }

  /**
   * Ajoute un écouteur pour les notifications
   * @param {Function} listener - Fonction appelée lors d'une notification
   */
  addListener(listener) {
    if (typeof listener === 'function' && !this.listeners.includes(listener)) {
      this.listeners.push(listener);
    }
  }

  /**
   * Supprime un écouteur
   * @param {Function} listener - Fonction à supprimer
   */
  removeListener(listener) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /**
   * Gère la détection d'un nouvel incident sur l'itinéraire
   * @param {Array} newIncidents - Nouveaux incidents détectés
   * @param {Array} allIncidents - Tous les incidents sur l'itinéraire
   */
  async handleIncidentDetected(newIncidents, allIncidents) {
    if (!newIncidents || newIncidents.length === 0) return;

    // Limiter la fréquence des notifications
    const now = Date.now();
    if (now - this.lastNotificationTime < this.notificationThrottleMs) {
      return;
    }
    this.lastNotificationTime = now;

    console.log(`${newIncidents.length} nouveaux incidents détectés sur l'itinéraire`);

    // Analyser l'impact des incidents sur l'itinéraire actuel
    const impact = SmartNavigationService.analyzeIncidentImpact(
      this.activeRoute, 
      allIncidents
    );

    // Si l'impact est significatif, proposer un recalcul
    const isSignificantImpact = impact.totalScore < 70;

    // En mode recalcul automatique, recalculer directement l'itinéraire
    let alternativeRoute = null;
    if (this.autoReroute && isSignificantImpact && this.activeRoute.startPoint && this.activeRoute.endPoint) {
      try {
        // Recalculer l'itinéraire
        const origin = this.activeRoute.startPoint.coordinates;
        const destination = this.activeRoute.endPoint.coordinates;
        const options = this.activeRoute.options || {};

        const newRouteData = await SmartNavigationService.recalculateRoute(
          origin,
          destination,
          options,
          allIncidents
        );

        // Vérifier si le nouvel itinéraire est significativement meilleur
        if (newRouteData && newRouteData.routes && newRouteData.routes.length > 0) {
          const newMainRoute = newRouteData.routes[0];
          const currentScore = this.activeRoute.score || 0;
          const newScore = newMainRoute.score || 0;

          // Si le nouvel itinéraire est au moins 15% meilleur, le proposer
          if (newScore > currentScore * 1.15) {
            alternativeRoute = newRouteData;
          }
        }
      } catch (error) {
        console.error('Erreur lors du recalcul automatique:', error);
      }
    }

    // Créer une notification
    const notification = {
      type: 'incident_detected',
      incidents: newIncidents,
      impact,
      time: new Date(),
      isSignificant: isSignificantImpact,
      alternativeRoute
    };

    // Notifier tous les écouteurs
    this.notifyListeners(notification);
  }

  /**
   * Notifie tous les écouteurs enregistrés
   * @param {Object} notification - Données de notification
   * @param {boolean} bypassThrottle - Si true, ignore la limitation de fréquence
   */
  notifyListeners(notification, bypassThrottle = false) {
    // Si ce n'est pas un bypass et que la limite de fréquence est atteinte, ne pas notifier
    if (!bypassThrottle) {
      const now = Date.now();
      if (now - this.lastNotificationTime < this.notificationThrottleMs) {
        return;
      }
    }
    
    // Mettre à jour le timestamp de dernière notification dans tous les cas
    this.lastNotificationTime = Date.now();
    
    this.listeners.forEach(listener => {
      try {
        listener(notification);
      } catch (error) {
        console.error('Erreur dans un écouteur de notification:', error);
      }
    });
  }

  /**
   * Active ou désactive le recalcul automatique d'itinéraire
   * @param {boolean} enable - Activer ou désactiver
   */
  setAutoReroute(enable) {
    this.autoReroute = enable;
  }

  /**
   * Arrête la surveillance des incidents
   */
  stop() {
    if (this.stopMonitoringFn) {
      this.stopMonitoringFn();
      this.stopMonitoringFn = null;
    }
    this.activeRoute = null;
  }
}

// Exporter une instance unique
const routeNotificationManager = new RouteNotificationManager();
export default routeNotificationManager;