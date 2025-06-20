import React, { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthProvider';
import { INCIDENT_TYPES } from '../../services/IncidentService';
import './IncidentForm.css';

const IncidentForm = ({ position, onSubmit, onCancel }) => {
  const { user, isAuthenticated } = useContext(AuthContext);
  const [selectedType, setSelectedType] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isAuthenticated) {
      setError('Vous devez être connecté pour signaler un incident');
      return;
    }

    if (!selectedType) {
      setError('Veuillez sélectionner un type d\'incident');
      return;
    }

    try {
      const incidentData = {
        type: selectedType,
        location: position,
        description: description || '',
        reported_by: user?.id
      };

      await onSubmit(incidentData);
      setSelectedType('');
      setDescription('');
      setError(null);
    } catch (err) {
      console.error('Erreur lors de la création de l\'incident:', err);
      setError(err.message || 'Impossible de créer l\'incident');
    }
  };

  return (
    <div className="incident-form">
      <h2>Signaler un incident</h2>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <div className="incident-types">
            {Object.values(INCIDENT_TYPES).map((type) => (
             <button
             key={type.id}
             type="button"
             className={`incident-type-circle ${selectedType === type.id ? 'selected' : ''}`}
             onClick={() => setSelectedType(type.id)}
             title={type.label}
             style={{
               '--selected-color': selectedType === type.id ? type.color : '#ccc',
               '--stroke-color': selectedType === type.id ? type.color : 'transparent'
             }}
           >
             <img
               src={type.icon}
               alt={type.label}
               className="incident-icon-only"
             />
           </button>
           
            ))}
          </div>
        </div>

        <div className="form-group2">
          <label htmlFor="description">Description (optionnel)</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Détails supplémentaires sur l'incident"
            rows="4"
          />
        </div>

        <div className="form-actions">
          <button type="submit" disabled={!selectedType || !isAuthenticated}>
            Signaler l'incident
          </button>
          <button type="button" onClick={onCancel}>
            Annuler
          </button>
        </div>
      </form>

      {!isAuthenticated && (
        <div>
          Vous devez être connecté pour signaler un incident.
        </div>
      )}
    </div>
  );
};

export default IncidentForm;
