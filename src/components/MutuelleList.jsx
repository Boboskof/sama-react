import React from 'react';
import { useMutuelles } from '../hooks/useMutuelles';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

const MutuelleList = () => {
  const { data: mutuelles = [], isLoading: loading, error, refetch } = useMutuelles();

  if (loading) {
    return <LoadingSpinner message="Chargement des mutuelles..." />;
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <ErrorMessage
          message={error?.message || 'Erreur lors du chargement des mutuelles'}
          title="Erreur"
          dismissible={false}
        />
        <button 
          onClick={() => refetch()}
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
          onClick={() => refetch()}
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

