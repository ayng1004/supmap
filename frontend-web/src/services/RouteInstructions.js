import React from 'react';
import { formatDistance, formatDuration } from '../../services/directionsService';

const RouteInstructions = ({ route, onClose }) => {
  if (!route || !route.routes || route.routes.length === 0) {
    return null;
  }
  
  const mainRoute = route.routes[0];
  const { distance, duration, legs } = mainRoute;
  
  // Récupérer toutes les étapes de tous les segments
  const allSteps = legs.reduce((steps, leg) => {
    return [...steps, ...leg.steps];
  }, []);
  
  return (
    <div className="route-instructions" style={{
      backgroundColor: 'white',
      borderRadius: '8px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      width: '100%',
      maxHeight: '70vh',
      overflowY: 'auto',
      padding: '15px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3>Instructions d'itinéraire</h3>
        <button 
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '20px'
          }}
        >
          ×
        </button>
      </div>
      
      {/* Résumé de l'itinéraire */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        padding: '10px',
        backgroundColor: '#f5f5f5',
        borderRadius: '4px',
        marginBottom: '15px'
      }}>
        <div>
          <strong>Distance:</strong> {formatDistance(distance)}
        </div>
        <div>
          <strong>Durée:</strong> {formatDuration(duration)}
        </div>
      </div>
      
      {/* Liste des instructions */}
      <div className="steps-list">
        {allSteps.map((step, index) => (
          <div 
            key={index} 
            className="step-item"
            style={{
              padding: '10px',
              borderBottom: index < allSteps.length - 1 ? '1px solid #eee' : 'none',
              display: 'flex',
              alignItems: 'flex-start'
            }}
          >
            <div style={{ 
              minWidth: '30px', 
              height: '30px',
              backgroundColor: '#3887be',
              color: 'white',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '10px',
              fontSize: '14px'
            }}>
              {index + 1}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                {step.maneuver.instruction}
              </div>
              <div style={{ color: '#666', fontSize: '13px' }}>
                {formatDistance(step.distance)} · {formatDuration(step.duration)}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Bouton pour fermer ou imprimer */}
      <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'space-between' }}>
        <button
          onClick={() => window.print()}
          style={{
            padding: '8px 16px',
            backgroundColor: '#f5f5f5',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Imprimer
        </button>
        <button
          onClick={onClose}
          style={{
            padding: '8px 16px',
            backgroundColor: '#3887be',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Fermer
        </button>
      </div>
    </div>
  );
};

export default RouteInstructions;