import React from 'react';

const PolitiqueConfidentialite = () => {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h1 className="text-2xl font-bold mb-4">Politique de confidentialité</h1>
      <div className="space-y-4 text-sm text-gray-700">
        <p><strong>Responsable de traitement</strong>: UGECAM</p>
        <p><strong>Finalités</strong>: gestion des dossiers médicaux, rendez-vous, communications.</p>
        <p><strong>Base légale</strong>: obligations légales et intérêt légitime selon les cas.</p>
        <p><strong>Données</strong>: identité, coordonnées, données de santé nécessaires.</p>
        <p><strong>Conservation</strong>: selon durées légales applicables aux dossiers médicaux.</p>
        <p><strong>Droits</strong>: accès, rectification, effacement, limitation, opposition, portabilité.</p>
        <p><strong>Sécurité</strong>: mesures techniques et organisationnelles.</p>
        <p><strong>Contact DPO</strong>: [Email du DPO]</p>
      </div>
    </div>
  );
};

export default PolitiqueConfidentialite;

