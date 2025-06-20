import React, { useEffect, useState } from 'react';
import { getIncidents } from '../services/api';

const IncidentsPage = () => {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getIncidents();
        setIncidents(data);
      } catch (error) {
        console.error('Erreur chargement incidents', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return <p>Chargement...</p>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Liste des incidents</h1>
      {incidents.length === 0 ? (
        <p>Aucun incident trouvé.</p>
      ) : (
        <ul>
          {incidents.map((incident) => (
            <li key={incident.id}>
              <strong>{incident.title}</strong> — {incident.description}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default IncidentsPage;
