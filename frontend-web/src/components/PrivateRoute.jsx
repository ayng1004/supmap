import React from 'react';
import { Navigate } from 'react-router-dom';

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');

  // Si pas de token ➔ rediriger vers /login
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Sinon, afficher la page protégée
  return children;
};

export default PrivateRoute;
