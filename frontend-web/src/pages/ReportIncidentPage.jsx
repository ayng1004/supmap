import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // ✅ pour redirection web
import { useAuth } from '../contexts/useAuth';
import { reportIncident } from '../services/IncidentService'; // ✅ uniquement ça !

const INCIDENT_TYPES = [
  { id: 'traffic', title: 'Bouchon', color: 'orange' },
  { id: 'accident', title: 'Accident', color: 'red' },
  { id: 'hazard', title: 'Danger', color: 'pink' },
  { id: 'police', title: 'Police', color: 'green' },
  { id: 'closure', title: 'Route fermée', color: 'purple' },
];

const ReportIncidentPage = () => {
  const [selectedType, setSelectedType] = useState(null);
  const [sending, setSending] = useState(false);

  const { isAuthenticated } = useAuth();
  const navigate = useNavigate(); // ✅ pour navigation React Router

  const handleSubmit = async () => {
    if (!selectedType) {
      alert('Veuillez choisir un type d\'incident.');
      return;
    }

    if (!isAuthenticated) {
      alert('Vous devez être connecté pour signaler un incident.');
      navigate('/login');
      return;
    }

    try {
      setSending(true);

      // ✅ Position GPS navigateur
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
        });
      });

      const coords = [pos.coords.longitude, pos.coords.latitude];

      // ✅ Appel à incidentService
      await reportIncident({
        title: selectedType.title,
        coords,
        color: selectedType.color,
      });

      alert('Incident signalé avec succès !');
      navigate('/'); // ✅ retour à la map
    } catch (error) {
      console.error('Erreur lors du signalement', error);
      alert('Erreur lors du signalement.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Signaler un incident</h1>

      <div style={{ marginBottom: '20px' }}>
        {INCIDENT_TYPES.map(type => (
          <button
            key={type.id}
            onClick={() => setSelectedType(type)}
            style={{
              backgroundColor: selectedType?.id === type.id ? type.color : '#eee',
              margin: '5px',
              padding: '10px',
              borderRadius: '8px',
              border: 'none',
              color: selectedType?.id === type.id ? 'white' : 'black',
              cursor: 'pointer',
            }}
          >
            {type.title}
          </button>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={sending}
        style={{
          padding: '12px 24px',
          backgroundColor: sending ? '#ccc' : '#007AFF',
          color: 'white',
          fontSize: '16px',
          fontWeight: 'bold',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
        }}
      >
        {sending ? 'Envoi...' : 'Envoyer le signalement'}
      </button>
    </div>
  );
};

export default ReportIncidentPage;