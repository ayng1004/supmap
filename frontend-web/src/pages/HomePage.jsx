// frontend-web/src/pages/HomePage.jsx
import React from 'react';
import Map from '../components/Map';

const HomePage = () => {
  return (
    <div className="home-page">
      <Map />
      {/* Autres éléments UI comme le panneau de recherche, signalements, etc. */}
    </div>
  );
};

export default HomePage;