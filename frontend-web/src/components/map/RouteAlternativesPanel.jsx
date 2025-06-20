// frontend-web/src/components/map/RouteAlternativesPanel.jsx
import React, { useState } from 'react';
import { FaCarSide, FaClock, FaExclamationTriangle, FaTimes, FaCheck, FaRoad } from 'react-icons/fa';
import './RouteAlternativesPanel.css';

/**
 * Panneau d'affichage des itinéraires alternatifs suite à la détection d'incidents
 */
const RouteAlternativesPanel = ({ 
  alternatives, 
  currentRoute,
  onClose, 
  onSelectRoute 
}) => {
  // Suivi de l'itinéraire sélectionné (par défaut, le premier)
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  
  // Si aucune alternative n'est disponible
  if (!alternatives || alternatives.length === 0 || !currentRoute) {
    return (
      <div className="route-alternatives">
        <div className="route-alternatives__header">
          <h3>Aucun itinéraire alternatif</h3>
          <button className="route-alternatives__close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        <div className="route-alternatives__content">
          <p>Aucun itinéraire alternatif n'a pu être trouvé pour éviter les incidents.</p>
          <button 
            className="route-alternatives__button route-alternatives__button--primary"
            onClick={onClose}
          >
            Fermer
          </button>
        </div>
      </div>
    );
  }
  
  // Extraire l'itinéraire actuel et les alternatives
  const originalDuration = Math.round(currentRoute.duration / 60); // minutes
  const originalDistance = Math.round(currentRoute.distance / 1000); // km
  
  // Tri des alternatives par score (meilleur en premier)
  const sortedAlternatives = [...alternatives].sort((a, b) => {
    // Si l'un des itinéraires est marqué comme recommandé, il passe en premier
    if (a.recommended && !b.recommended) return -1;
    if (!a.recommended && b.recommended) return 1;
    // Sinon, tri par score
    return b.score - a.score;
  });
  
  // Sélectionner l'itinéraire pour prévisualisation
  const handleSelectForPreview = (index) => {
    setSelectedRouteIndex(index);
  };
  
  // Confirmer la sélection de l'itinéraire
  const handleConfirmSelection = () => {
    const selectedRoute = sortedAlternatives[selectedRouteIndex];
    if (onSelectRoute && selectedRoute) {
      onSelectRoute(selectedRoute);
    }
  };
  
  // Formatter la durée en heures/minutes
  const formatDuration = (minutes) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours} h ${mins > 0 ? `${mins} min` : ''}`;
  };
  
  // Calculer le différentiel de temps
  const calculateTimeDiff = (route) => {
    const routeDuration = Math.round(route.duration / 60);
    const diff = routeDuration - originalDuration;
    
    if (diff > 0) return `+${diff} min`;
    if (diff < 0) return `${diff} min`;
    return 'même durée';
  };
  
  // Calculer le différentiel de distance
  const calculateDistanceDiff = (route) => {
    const routeDistance = Math.round(route.distance / 1000);
    const diff = routeDistance - originalDistance;
    
    if (diff > 0) return `+${diff} km`;
    if (diff < 0) return `${diff} km`;
    return 'même distance';
  };

  return (
    <div className="route-alternatives">
      <div className="route-alternatives__header">
        <h3>Alternatives d'itinéraires</h3>
        <button className="route-alternatives__close" onClick={onClose}>
          <FaTimes />
        </button>
      </div>
      
      <div className="route-alternatives__current">
        <div className="route-alternatives__current-header">
          <FaExclamationTriangle className="route-alternatives__warning-icon" />
          <span>Incidents détectés sur votre itinéraire actuel</span>
        </div>
        <div className="route-alternatives__current-details">
          <div>
            <FaClock /> {formatDuration(originalDuration)}
          </div>
          <div>
            <FaRoad /> {originalDistance} km
          </div>
          <div className="route-alternatives__incidents">
            <FaExclamationTriangle /> {currentRoute.affectedSegments?.length || 0} incidents
          </div>
        </div>
      </div>
      
      <div className="route-alternatives__list">
        {sortedAlternatives.map((route, index) => {
          const duration = Math.round(route.duration / 60); // minutes
          const delay = route.estimatedDelay || 0;
          const totalDuration = duration + delay;
          const distance = Math.round(route.distance / 1000); // km
          const incidents = route.affectedSegments?.length || 0;
          const isSelected = index === selectedRouteIndex;
          const timeDiff = calculateTimeDiff(route);
          const distanceDiff = calculateDistanceDiff(route);
          
          return (
            <div 
              key={`route-alt-${index}`}
              className={`route-alternatives__item ${isSelected ? 'route-alternatives__item--selected' : ''}`}
              onClick={() => handleSelectForPreview(index)}
            >
              <div className="route-alternatives__item-header">
                <div className="route-alternatives__item-title">
                  {route.recommended ? (
                    <span className="route-alternatives__recommended">Recommandé</span>
                  ) : (
                    <span>Alternative {index + 1}</span>
                  )}
                </div>
                <div className="route-alternatives__item-score">
                  Score: {route.score}/100
                </div>
              </div>
              
              <div className="route-alternatives__item-details">
                <div className="route-alternatives__item-stat">
                  <FaClock />
                  <div>
                    <div className="route-alternatives__stat-value">{formatDuration(totalDuration)}</div>
                    <div className="route-alternatives__stat-diff">{timeDiff}</div>
                  </div>
                </div>
                
                <div className="route-alternatives__item-stat">
                  <FaRoad />
                  <div>
                    <div className="route-alternatives__stat-value">{distance} km</div>
                    <div className="route-alternatives__stat-diff">{distanceDiff}</div>
                  </div>
                </div>
                
                <div className="route-alternatives__item-stat">
                  <FaExclamationTriangle />
                  <div>
                    <div className="route-alternatives__stat-value">{incidents} incidents</div>
                    <div className="route-alternatives__stat-diff">
                      {incidents === 0 ? 'sans incident' : ''}
                    </div>
                  </div>
                </div>
              </div>
              
              {route.strengths && route.strengths.length > 0 && (
                <div className="route-alternatives__strengths">
                  <div className="route-alternatives__strength-title">Points forts:</div>
                  <ul className="route-alternatives__strength-list">
                    {route.strengths.slice(0, 2).map((strength, i) => (
                      <li key={`strength-${i}`}>✓ {strength}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {isSelected && (
                <div className="route-alternatives__selected-indicator">
                  <FaCheck /> Sélectionné pour aperçu
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      <div className="route-alternatives__actions">
        <button 
          className="route-alternatives__button route-alternatives__button--primary"
          onClick={handleConfirmSelection}
        >
          <FaCheck /> Utiliser cet itinéraire
        </button>
        
        <button 
          className="route-alternatives__button route-alternatives__button--secondary"
          onClick={onClose}
        >
          <FaTimes /> Annuler
        </button>
      </div>
    </div>
  );
};

export default RouteAlternativesPanel;