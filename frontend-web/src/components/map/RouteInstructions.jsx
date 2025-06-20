import React from 'react';
import { formatDistance, formatDuration } from '../../services/directionsService';
import './RouteInstructions.css';
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
    <div className={`route-instructions ${document.body.classList.contains('dark-mode') ? 'dark-mode' : ''}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3>Route Instructions</h3>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '20px',
          }}
        >
          ×
        </button>
      </div>

      {/* Résumé de l'itinéraire */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '10px',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px',
          marginBottom: '15px',
        }}
      >
        <div>
          <strong>Distance:</strong> {formatDistance(distance)}
        </div>
        <div>
          <strong>Duration:</strong> {formatDuration(duration)}
        </div>
      </div>

      {/* Liste des instructions */}
      <div className="steps-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {allSteps.map((step, index) => (
          <div
            key={index}
            className="step-item"
            style={{
              padding: '15px',
              marginBottom: '10px',
              backgroundColor: document.body.classList.contains('dark-mode') ? '#444' : 'rgb(255, 255, 255)',
              border: '3px solid transparent',
              borderRadius: '8px',
              display: 'flex',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
              backgroundOrigin: 'border-box',
              backgroundClip: 'content-box, border-box',
            }}
          >
            <div
              style={{
                minWidth: '30px',
                height: '30px',
                backgroundColor: '#3887be',
                color: 'white',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '10px',
                fontSize: '14px',
              }}
            >
              {index + 1}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }} className="step-instruction">
                {step.maneuver.instruction}
              </div>
              <div style={{ color: '#666', fontSize: '13px' }} className="step-meta">
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
            cursor: 'pointer',
          }}
        >
          Print
        </button>
        <button
          onClick={onClose}
          style={{
            padding: '8px 16px',
            backgroundColor: '#3887be',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default RouteInstructions;