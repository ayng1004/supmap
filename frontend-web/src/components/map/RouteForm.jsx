import React, { useState } from 'react';
import { FaLocationArrow, FaMapMarkerAlt, FaCar, FaWalking, FaBiking, FaTimes, FaRoute } from 'react-icons/fa';

const RouteForm = ({ onSubmit, onCancel }) => {
  const [startPoint, setStartPoint] = useState('');
  const [endPoint, setEndPoint] = useState('');
  const [useCurrentLocation, setUseCurrentLocation] = useState(true);
  const [travelMode, setTravelMode] = useState('driving');
  const [avoidTolls, setAvoidTolls] = useState(false);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Préparer les données de l'itinéraire
    const routeData = {
      startPoint: useCurrentLocation ? 'current-location' : startPoint,
      endPoint,
      options: {
        travelMode,
        avoidTolls
      }
    };
    
    // Appeler la fonction de callback avec les données
    onSubmit(routeData);
  };
  
  return (
    <div className={`route-form-container ${document.body.classList.contains('dark-mode') ? 'dark-mode' : ''}`}>
      <div style={{
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '18px'
      }}>
        <h3 style={{
          margin: 0, 
          color: '#333', 
          fontSize: '18px', 
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center'
        }}>
          <FaRoute size={20} style={{ marginRight: '10px', color: '#4285F4' }} />
          Calculer un itinéraire
        </h3>
        <button 
          type="button" 
          onClick={onCancel}
          style={{
            background: 'none',
            border: 'none',
            color: '#9AA0A6',
            cursor: 'pointer',
            fontSize: '20px',
            padding: '5px'
          }}
        >
          <FaTimes />
        </button>
      </div>
      
      <form onSubmit={handleSubmit}>
        {/* Point de départ */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '12px',
            background: '#F1F3F4',
            padding: '10px 15px',
            borderRadius: '30px',
            cursor: 'pointer'
          }} onClick={() => setUseCurrentLocation(!useCurrentLocation)}>
            <input
              type="checkbox"
              id="use-current-location"
              checked={useCurrentLocation}
              onChange={(e) => setUseCurrentLocation(e.target.checked)}
              style={{ 
                marginRight: '12px',
                cursor: 'pointer',
                accentColor: '#4285F4'
              }}
            />
            <label 
              htmlFor="use-current-location"
              style={{
                display: 'flex',
                alignItems: 'center',
                fontWeight: '500',
                cursor: 'pointer',
                color: '#444'
              }}
            >
              <FaLocationArrow 
                size={15} 
                style={{ 
                  marginRight: '8px', 
                  color: '#4285F4'
                }} 
              />
              Utiliser ma position actuelle
            </label>
          </div>

          {!useCurrentLocation && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              border: '1px solid #e0e0e0',
              borderRadius: '30px',
              padding: '0 15px',
              overflow: 'hidden',
              boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
            }}>
              <FaLocationArrow size={15} style={{ color: '#34A853', marginRight: '10px' }}/>
              <input
                type="text"
                placeholder="Point de départ"
                value={startPoint}
                onChange={(e) => setStartPoint(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 0',
                  border: 'none',
                  outline: 'none',
                  fontSize: '15px'
                }}
                required={!useCurrentLocation}
              />
            </div>
          )}
        </div>
        
        {/* Destination */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            border: '1px solid #e0e0e0',
            borderRadius: '30px',
            padding: '0 15px',
            overflow: 'hidden',
            boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
          }}>
            <FaMapMarkerAlt size={15} style={{ color: '#EA4335', marginRight: '10px' }}/>
            <input
              type="text"
              placeholder="Destination"
              value={endPoint}
              onChange={(e) => setEndPoint(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 0',
                border: 'none',
                outline: 'none',
                fontSize: '15px'
              }}
              required
            />
          </div>
        </div>
        
        {/* Options de trajet */}
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ 
            marginBottom: '12px', 
            color: '#444',
            fontSize: '15px',
            fontWeight: '600'
          }}>Options</h4>
          
          {/* Mode de transport */}
          <div style={{ marginBottom: '15px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '3px',
              background: '#F1F3F4',
              borderRadius: '30px',
              marginBottom: '10px'
            }}>
              <button
                type="button"
                onClick={() => setTravelMode('driving')}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  borderRadius: '30px',
                  cursor: 'pointer',
                  background: travelMode === 'driving' ? '#4285F4' : 'transparent',
                  color: travelMode === 'driving' ? 'white' : '#555',
                  fontWeight: '500',
                  transition: 'all 0.2s ease'
                }}
              >
                <FaCar size={14} style={{ marginRight: '5px' }} />
                Voiture
              </button>
              <button
                type="button"
                onClick={() => setTravelMode('cycling')}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  borderRadius: '30px',
                  cursor: 'pointer',
                  background: travelMode === 'cycling' ? '#4285F4' : 'transparent',
                  color: travelMode === 'cycling' ? 'white' : '#555',
                  fontWeight: '500',
                  transition: 'all 0.2s ease'
                }}
              >
                <FaBiking size={14} style={{ marginRight: '5px' }} />
                Vélo
              </button>
              <button
                type="button"
                onClick={() => setTravelMode('walking')}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  borderRadius: '30px',
                  cursor: 'pointer',
                  background: travelMode === 'walking' ? '#4285F4' : 'transparent',
                  color: travelMode === 'walking' ? 'white' : '#555',
                  fontWeight: '500',
                  transition: 'all 0.2s ease'
                }}
              >
                <FaWalking size={14} style={{ marginRight: '5px' }} />
                À pied
              </button>
            </div>
          </div>
          
          {/* Option péages */}
          {travelMode === 'driving' && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center',
              background: '#F1F3F4',
              padding: '10px 15px',
              borderRadius: '30px',
              cursor: 'pointer'
            }}
            onClick={() => setAvoidTolls(!avoidTolls)}
            >
              <input
                type="checkbox"
                id="avoid-tolls"
                checked={avoidTolls}
                onChange={(e) => setAvoidTolls(e.target.checked)}
                style={{ 
                  marginRight: '12px',
                  cursor: 'pointer',
                  accentColor: '#4285F4'
                }}
              />
              <label 
                htmlFor="avoid-tolls"
                style={{
                  fontWeight: '500',
                  cursor: 'pointer',
                  color: '#444'
                }}
              >
                Éviter les péages
              </label>
            </div>
          )}
        </div>
        
        {/* Bouton Calculer */}
        <button
          type="submit"
          style={{
            width: '100%',
            padding: '14px 0',
            backgroundColor: '#4285F4',
            color: 'white',
            border: 'none',
            borderRadius: '30px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '15px',
            boxShadow: '0 2px 8px rgba(66, 133, 244, 0.4)',
            transition: 'all 0.2s ease'
          }}
        >
          Calculer l'itinéraire
        </button>
      </form>
    </div>
  );
};

export default RouteForm;