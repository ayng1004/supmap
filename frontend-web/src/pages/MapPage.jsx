import React from 'react';
import MapView from '../components/map/MapView';

const MapPage = () => {
  return (
    <div style={{ 
      width: '100%',
      height: '100vh',
      position: 'relative'
    }}>
      <MapView />
    </div>
  );
};

export default MapPage;