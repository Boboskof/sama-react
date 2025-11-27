import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import hospitalisationService from '../../../_services/hospitalisation.service';
import userService from '../../../_services/user.service';
import { formatDate } from '../../../utils/dateHelpers';
import LoadingSpinner from '../../../components/LoadingSpinner';

const Liste = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  
  const isFormateur = userService.isFormateur && userService.isFormateur();
  const isAdmin = userService.isAdmin && userService.isAdmin();
  const currentUser = userService.getUser && userService.getUser();
  const currentUserId = currentUser?.id;
  const currentUserIri = currentUser?.['@id'] || (currentUserId ? `/api/users/${currentUserId}` : null);
  
  // Fonction pour vérifier si l'utilisateur peut supprimer une hospitalisation
  const canDeleteHospitalisation = (hosp) => {
    // Formateurs et admins peuvent tout supprimer
    if (isFormateur || isAdmin) return true;
    
    // Stagiaires peuvent supprimer uniquement leurs propres créations
    if (!currentUserId || !currentUserIri) return false;
    
    const creator = hosp.createdBy || hosp.created_by || hosp.creePar || hosp.user || null;
    if (!creator) return false;
    
    // Si creator est un objet
    if (typeof creator === 'object') {
      const creatorId = creator.id;
      const creatorIri = creator['@id'] || (creatorId ? `/api/users/${creatorId}` : null);
      return String(creatorId) === String(currentUserId) || creatorIri === currentUserIri;
    }
    
    // Si creator est une string (IRI)
    if (typeof creator === 'string') {
      const creatorId = creator.includes('/') ? creator.split('/').pop() : creator;
      return String(creatorId) === String(currentUserId) || creator === currentUserIri;
    }
    
    // Si creator est un nombre (ID)
    if (typeof creator === 'number') {
      return String(creator) === String(currentUserId);
    }
    
    return false;
  };
  
  const handleDelete = async (hospId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette hospitalisation ?')) {
      return;
    }
    try {
      setDeleting(true);
      await hospitalisationService.delete(hospId);
      setItems(prev => prev.filter(h => h.id !== hospId));
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      const errorMessage = error?.response?.data?.message || 
                          error?.response?.data?.detail || 
                          error?.message || 
                          'Erreur lors de la suppression de l\'hospitalisation';
      alert(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const list = await hospitalisationService.list(id);
        setItems(Array.isArray(list) ? list : []);
      } catch (e) {
        setError("Impossible de charger les hospitalisations");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  return (
    <div className="space-y-6 min-h-screen w-[95%] md:w-[90%] lg:w-[80%] mx-auto px-2 md:px-4 py-6">
      <div className="text-center py-6">
        <div className="bg-indigo-200 rounded-lg shadow p-6 max-w-xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center shadow-sm">
              <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-indigo-800">Hospitalisations</h1>
          </div>
          <p className="text-indigo-700 text-sm">Patient #{id}</p>
        </div>
      </div>

      <div className="flex justify-end">
        <Link to={`/patients/${id}/hospitalisations/nouveau`} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2">
          <span className="material-symbols-rounded text-white text-2xl">add</span>
          Nouvelle hospitalisation
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">Liste</h3>
        </div>
        {error && <div className="px-6 py-3 bg-red-50 text-red-700 border-b border-red-200">{error}</div>}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-indigo-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider">Service</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider">Dates</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-indigo-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan="4" className="px-6 py-6"><LoadingSpinner message="Chargement des hospitalisations..." size="medium" color="indigo" /></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan="4" className="px-6 py-6 text-center text-gray-500">Aucune hospitalisation</td></tr>
              ) : (
                items.map(h => (
                  <tr key={h.id} className="hover:bg-indigo-50/40">
                    <td className="px-6 py-3 text-sm">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        {h.statut}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-700">{h.uniteService || '—'}</td>
                    <td className="px-6 py-3 text-sm text-gray-700">
                      {h.plannedAdmissionDate ? formatDate(h.plannedAdmissionDate) : '—'}
                      {h.plannedDischargeDate ? ` → ${formatDate(h.plannedDischargeDate)}` : ''}
                    </td>
                    <td className="px-6 py-3 text-sm text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link to={`/patients/${id}/hospitalisations/${h.id}`} className="text-indigo-600 hover:text-indigo-800 text-sm">Voir</Link>
                        {canDeleteHospitalisation(h) && (
                          <button
                            onClick={() => handleDelete(h.id)}
                            disabled={deleting}
                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-1 text-sm"
                            title="Supprimer cette hospitalisation"
                          >
                            <span className="material-symbols-rounded text-sm">delete</span>
                            Supprimer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Liste;

