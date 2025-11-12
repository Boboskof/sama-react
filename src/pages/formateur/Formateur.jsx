import React from 'react';
import { Navigate } from 'react-router-dom';

const Formateur = () => {
  // Redirige vers le dashboard formateur pour centraliser la page d'accueil
  return <Navigate to="/formateur/dashboard" replace />;
};

export default Formateur;


