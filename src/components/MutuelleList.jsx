import React, { useState, useEffect } from 'react';
import mutuelleService from '../_services/mutuelle.service';

const MutuelleList = () => {
  const [mutuelles, setMutuelles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadMutuelles = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Essayer d'abord la liste simple
      const data = await mutuelleService.getMutuellesList();
      setMutuelles(data);
      
      // Log de debug supprimé pour la production
    } catch (err) {
      console.error('Erreur avec getMutuellesList, essai avec getAllMutuelles:', err);
      
      try {
        // Fallback vers getAllMutuelles
        const data = await mutuelleService.getAllMutuelles();
        setMutuelles(data);
        
        // Log de debug supprimé pour la production
      } catch (fallbackErr) {
        console.error('Erreur lors du chargement des mutuelles:', fallbackErr);
        setError(fallbackErr);
        setMutuelles([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMutuelles();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Chargement des mutuelles...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-600">
        <p>Erreur lors du chargement des mutuelles</p>
        <p className="text-sm text-gray-500 mt-1">{error.message}</p>
        <button 
          onClick={loadMutuelles}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">
          Mutuelles disponibles ({mutuelles.length})
        </h2>
        <button 
          onClick={loadMutuelles}
          className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
        >
          Actualiser
        </button>
      </div>

      {mutuelles.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <div className="text-gray-500 text-lg mb-2">
            <p className="font-medium">Aucune mutuelle trouvée.</p>
            <p className="text-sm mt-1">Aucune mutuelle n'est disponible pour le moment.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {mutuelles.map((mutuelle) => (
            <div key={mutuelle.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-gray-900">
                    {mutuelle.nom}
                  </h3>
                  {mutuelle.code && (
                    <p className="text-sm text-gray-600">
                      Code: {mutuelle.code}
                    </p>
                  )}
                  {mutuelle.active !== undefined && (
                    <span className={`inline-block px-2 py-1 text-xs rounded mt-1 ${
                      mutuelle.active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {mutuelle.active ? 'Active' : 'Inactive'}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                    ID: {mutuelle.id}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MutuelleList;

