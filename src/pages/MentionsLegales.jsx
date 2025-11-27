import React from 'react';

const MentionsLegales = () => {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h1 className="text-2xl font-bold mb-4">Mentions légales</h1>
      <div className="space-y-4 text-sm text-gray-700">
        <p><strong>Éditeur du site</strong>: UGECAM</p>
        <p><strong>Directeur de la publication</strong>: [Nom à compléter]</p>
        <p><strong>Hébergement</strong>: [Hébergeur à compléter]</p>
        <p><strong>Contact</strong>: [Email / Téléphone]</p>
        <p>
          <strong>Propriété intellectuelle</strong>: Le contenu, le nom et le logo SAMA sont protégés. 
          Toute reproduction est interdite sans autorisation.
        </p>
        <p>
          <strong>Données personnelles</strong>: Le traitement des données est conforme au RGPD. 
          Voir la <a href="/politique-de-confidentialite" className="text-blue-600">Politique de confidentialité</a>.
        </p>
      </div>
    </div>
  );
};

export default MentionsLegales;

