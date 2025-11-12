import React, { useState, useEffect } from 'react';
import { searchService } from '../_services/search.service';

const CommunicationFilters = ({ filters, onFiltersChange }) => {
  const [types, setTypes] = useState([]);
  const [canals, setCanals] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCommunicationData();
  }, []);

  const loadCommunicationData = async () => {
    try {
      setLoading(true);
      const [typesResponse, statsResponse] = await Promise.all([
        searchService.getCommunicationTypes(),
        searchService.getCommunicationStatistics()
      ]);
      
      setTypes(typesResponse.types || []);
      setCanals(typesResponse.canals || []);
      setStatistics(statsResponse);
    } catch (error) {
      console.error('Erreur lors du chargement des données de communication:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    // Ne jamais envoyer de tableaux, seulement des valeurs scalaires ou undefined
    onFiltersChange({ 
      ...filters, 
      [key]: value && value !== '' ? value : undefined 
    });
  };

  if (loading) {
    return (
      <div className="flex space-x-2">
        <div className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-100 animate-pulse">
          Chargement...
        </div>
      </div>
    );
  }

  return (
    <div className="flex space-x-2">
      {/* Filtre par statut */}
      <select
        value={filters.statut || ''}
        onChange={(e) => handleFilterChange('statut', e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-md text-sm"
      >
        <option value="">Tous les statuts</option>
        {statistics && statistics.byStatus && Object.entries(statistics.byStatus).map(([statut, count]) => (
          <option key={statut} value={statut}>
            {statut} ({count})
          </option>
        ))}
        {/* Fallback si pas de stats */}
        {(!statistics || !statistics.byStatus) && (
          <>
            <option value="ENVOYE">Envoyé</option>
            <option value="EN_ATTENTE">En attente</option>
            <option value="ECHEC">Échec</option>
            <option value="BROUILLON">Brouillon</option>
          </>
        )}
      </select>
      
      {/* Filtre par type */}
      <select
        value={filters.type || ''}
        onChange={(e) => handleFilterChange('type', e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-md text-sm"
      >
        <option value="">Tous les types</option>
        {types.map(type => (
          <option key={type.value} value={type.value}>
            {type.label}
          </option>
        ))}
      </select>
      
      {/* Filtre par canal */}
      <select
        value={filters.canal || ''}
        onChange={(e) => handleFilterChange('canal', e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-md text-sm"
      >
        <option value="">Tous les canaux</option>
        {canals.map(canal => (
          <option key={canal.value} value={canal.value}>
            {canal.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default CommunicationFilters;
