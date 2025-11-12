import React from 'react';

const SearchFilters = ({ 
  category, 
  filters, 
  onFiltersChange,
  className = ""
}) => {
  const handleFilterChange = (key, value) => {
    // Ne jamais envoyer de tableaux, seulement des valeurs scalaires ou undefined
    onFiltersChange({
      ...filters,
      [key]: value && value !== '' ? value : undefined
    });
  };

  const renderCategoryFilters = () => {
    switch (category) {
      case 'rendez_vous':
        return (
          <select
            value={filters.statut || ''}
            onChange={(e) => handleFilterChange('statut', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="">Tous les statuts</option>
            <option value="CONFIRME">Confirmé</option>
            <option value="ANNULE">Annulé</option>
            <option value="EN_ATTENTE">En attente</option>
            <option value="PLANIFIE">Planifié</option>
            <option value="TERMINE">Terminé</option>
            <option value="ABSENT">Absent</option>
          </select>
        );

      case 'documents':
        return (
          <select
            value={filters.type || ''}
            onChange={(e) => handleFilterChange('type', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="">Tous les types</option>
            <option value="CARTE_VITALE">Carte vitale</option>
            <option value="ORDONNANCE">Ordonnance</option>
            <option value="ANALYSE">Analyse</option>
            <option value="RADIOGRAPHIE">Radiographie</option>
            <option value="COMPTE_RENDU">Compte-rendu</option>
            <option value="CERTIFICAT">Certificat</option>
          </select>
        );

      case 'communications':
        return (
          <div className="flex space-x-2">
            {/* Filtre par statut */}
            <select
              value={filters.statut || ''}
              onChange={(e) => handleFilterChange('statut', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">Tous les statuts</option>
              <option value="ENVOYE">Envoyé</option>
              <option value="EN_ATTENTE">En attente</option>
              <option value="ECHEC">Échec</option>
              <option value="BROUILLON">Brouillon</option>
            </select>
            
            {/* Filtre par type */}
            <select
              value={filters.type || ''}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">Tous les types</option>
              <option value="RAPPEL_RDV">Rappel RDV</option>
              <option value="DEMANDE_DOC">Demande Document</option>
              <option value="CONFIRMATION_RDV">Confirmation RDV</option>
              <option value="ANNULATION_RDV">Annulation RDV</option>
              <option value="RESULTATS_ANALYSES">Résultats Analyses</option>
              <option value="RAPPEL_VACCINATION">Rappel Vaccination</option>
            </select>
            
            {/* Filtre par canal */}
            <select
              value={filters.canal || ''}
              onChange={(e) => handleFilterChange('canal', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">Tous les canaux</option>
              <option value="EMAIL">Email</option>
              <option value="SMS">SMS</option>
              <option value="TELEPHONE">Téléphone</option>
            </select>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`flex items-center space-x-4 ${className}`}>
      {renderCategoryFilters()}
      
      <div className="flex items-center space-x-2">
        <label className="text-sm text-gray-600">Période:</label>
        <input
          type="date"
          value={filters.date_from || ''}
          onChange={(e) => handleFilterChange('date_from', e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
        <span className="text-gray-400">à</span>
        <input
          type="date"
          value={filters.date_to || ''}
          onChange={(e) => handleFilterChange('date_to', e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
      </div>
    </div>
  );
};

export default SearchFilters;
