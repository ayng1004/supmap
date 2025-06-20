
import React, { useState } from 'react';
import axios from 'axios';
import { FaEdit, FaKey, FaSave, FaTimes } from 'react-icons/fa';

const ProfilePage = ({ user }) => {
  const [username, setUsername] = useState(user?.username || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  const handleUpdateProfile = async () => {
    const token = localStorage.getItem('token');
    try {
      await axios.put('http://localhost:3001/api/auth/profile', 
        { username },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessage('Profil mis à jour avec succès !');
      setMessageType('success');
    } catch (err) {
      console.error('Erreur mise à jour profil:', err);
      setMessage('Erreur lors de la mise à jour.');
      setMessageType('error');
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setMessage('Les mots de passe ne correspondent pas.');
      setMessageType('error');
      return;
    }
    if (newPassword.length < 8) {
      setMessage('Le mot de passe doit faire au moins 8 caractères.');
      setMessageType('error');
      return;
    }

    const token = localStorage.getItem('token');
    try {
      await axios.put('http://localhost:3001/api/auth/change-password', 
        { newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
      setMessage('Mot de passe changé avec succès !');
      setMessageType('success');
    } catch (err) {
      console.error('Erreur changement mot de passe:', err);
      setMessage('Erreur lors du changement de mot de passe.');
      setMessageType('error');
    }
  };

  return (
    <div className="profile-content">
      <div className="profile-card">
        <div className="card-header">
          <h2>Informations personnelles</h2>
          <p>Gérez vos informations de compte</p>
        </div>
        
        <div className="profile-form">
          <div className="form-group">
            <label>Email</label>
            <input 
              type="email" 
              value={user?.email} 
              disabled 
              className="form-control"
            />
          </div>
          
          <div className="form-group">
            <label>Nom d'utilisateur</label>
            <input 
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              className="form-control"
            />
          </div>
          
          <div className="form-actions">
            <button className="btn-primary" onClick={handleUpdateProfile}>
              <FaSave />
              <span>Enregistrer</span>
            </button>
          </div>
        </div>
      </div>
      
      <div className="profile-card">
        <div className="card-header">
          <h2>Sécurité</h2>
          <p>Gérez votre mot de passe</p>
        </div>
        
        {!showPasswordForm ? (
          <div className="form-actions center">
            <button className="btn-secondary" onClick={() => setShowPasswordForm(true)}>
              <FaKey />
              <span>Changer de mot de passe</span>
            </button>
          </div>
        ) : (
          <div className="profile-form">
            <div className="form-group">
              <label>Nouveau mot de passe</label>
              <input 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="form-control"
              />
            </div>
            
            <div className="form-group">
              <label>Confirmer le mot de passe</label>
              <input 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="form-control"
              />
            </div>
            
            <div className="form-actions">
              <button className="btn-secondary" onClick={handleChangePassword}>
                <FaSave />
                <span>Changer</span>
              </button>
              <button className="btn-light" onClick={() => setShowPasswordForm(false)}>
                <FaTimes />
                <span>Annuler</span>
              </button>
            </div>
          </div>
        )}
      </div>
      
      {message && (
        <div className={`message ${messageType === 'success' ? 'success' : 'error'}`}>
          {message}
        </div>
      )}
    </div>
  );
};

export default ProfilePage;