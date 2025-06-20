// frontend-web/src/components/map/RouteAlert.jsx
import React, { useState, useEffect } from 'react';
import { FaExclamationTriangle, FaRoad, FaTimes, FaSync, FaSearchLocation, FaExchangeAlt } from 'react-icons/fa';
import './RouteAlert.css';

/**
 * Composant affichant une alerte pour les incidents sur l'itinéraire
 * et proposant des actions comme le recalcul d'itinéraire
 */
const RouteAlert = ({ 
  notification, 
  onClose, 
  onReroute, 
  onShowIncident,
  onShowAlternatives,
  hasAlternatives = false,
  autoHide = true 
}) => {
  const [visible, setVisible] = useState(true);
  
  // Auto-masquer la notification après 15 secondes si autoHide est activé
  useEffect(() => {
    if (autoHide && notification) {
      const timer = setTimeout(() => {
        setVisible(false);
        if (onClose) onClose();
      }, 15000);
      
      return () => clearTimeout(timer);
    }
  }, [notification, autoHide, onClose]);

  // Si pas de notification, ne rien afficher
  if (!notification || !visible) return null;
  
  // Obtenir les informations sur les incidents
  const { incidents, impact, alternativeRoute } = notification;
  
  // Si aucun incident, ne rien afficher
  if (!incidents || incidents.length === 0) return null;
  
  // Déterminer la sévérité de l'alerte
  const severity = impact && impact.totalScore < 50 ? 'high' : 
                  impact && impact.totalScore < 70 ? 'medium' : 'low';
  
  // Formater le délai supplémentaire estimé
  const formattedDelay = impact && impact.estimatedDelay ? 
    `${impact.estimatedDelay} min` : 'inconnu';
  
  // Générer un message adapté à la situation
  let message = '';
  if (incidents.length === 1) {
    const incident = incidents[0];
    const type = getIncidentTypeName(incident.type);
    message = `Un ${type} a été signalé sur votre itinéraire.`;
  } else {
    message = `${incidents.length} incidents ont été signalés sur votre itinéraire.`;
  }
  
  // Titre de l'alerte
  let title = '';
  if (severity === 'high') {
    title = 'Incident majeur sur votre itinéraire';
  } else if (severity === 'medium') {
    title = 'Incident sur votre itinéraire';
  } else {
    title = 'Nouvel incident signalé';
  }

  return (
    <div className={`route-alert route-alert--${severity}`}>
      <div className="route-alert__icon">
        <FaExclamationTriangle size={24} />
      </div>
      
      <div className="route-alert__content">
        <h3 className="route-alert__title">{title}</h3>
        <p className="route-alert__message">{message}</p>
        <p className="route-alert__impact">
          Retard estimé: <strong>{formattedDelay}</strong>
        </p>
        
        <div className="route-alert__actions">
          {hasAlternatives && onShowAlternatives && (
            <button 
              className="route-alert__button route-alert__button--primary"
              onClick={() => {
                setVisible(false);
                onShowAlternatives();
              }}
            >
              <FaExchangeAlt /> Voir les alternatives
            </button>
          )}
          
          {onReroute && (
            <button 
              className="route-alert__button route-alert__button--secondary"
              onClick={() => {
                setVisible(false);
                onReroute(alternativeRoute);
              }}
            >
              <FaSync /> Recalculer
            </button>
          )}
          
          {onShowIncident && incidents.length > 0 && (
            <button 
              className="route-alert__button route-alert__button--secondary"
              onClick={() => {
                setVisible(false);
                onShowIncident(incidents[0]);
              }}
            >
              <FaSearchLocation /> Voir l'incident
            </button>
          )}
          
          <button 
            className="route-alert__button route-alert__button--close"
            onClick={() => {
              setVisible(false);
              if (onClose) onClose();
            }}
          >
            <FaTimes /> Ignorer
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Obtient le nom lisible d'un type d'incident
 * @param {string} type - Type d'incident
 * @returns {string} Nom lisible
 */
function getIncidentTypeName(type) {
  const types = {
    'accident': 'accident',
    'traffic': 'embouteillage',
    'closure': 'route fermée',
    'police': 'contrôle policier',
    'hazard': 'obstacle',
  };
  
  return types[type] || 'incident';
}

export default RouteAlert;