import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import userService from '../../../_services/user.service';
import PatientName from '../../../components/PatientName';
import { formatDate } from '../../../utils/dateHelpers';
import { useAllHospitalisations, useDeleteHospitalisation } from '../../../hooks/useHospitalisations';
import LoadingSpinner from '../../../components/LoadingSpinner';

export default function HospitalisationsAll() {
  const isFormateur = userService.isFormateur && userService.isFormateur();
  const isAdmin = userService.isAdmin && userService.isAdmin();
  const currentUser = userService.getUser && userService.getUser();
  const currentUserId = currentUser?.id;
  const currentUserIri = currentUser?.['@id'] || (currentUserId ? `/api/users/${currentUserId}` : null);

  // Paramètres de liste mémoïsés pour éviter toute recréation inutile
  const listParams = useMemo(
    () => ({ limit: 50, 'order[createdAt]': 'desc' }),
    []
  );

  // Chargement des hospitalisations via React Query
  const {
    data: items = [],
    isLoading: loading,
  } = useAllHospitalisations(listParams);

  const deleteMutation = useDeleteHospitalisation();
  
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
  
  const handleDelete = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette hospitalisation ?')) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(id);
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      const errorMessage = error?.response?.data?.message || 
                          error?.response?.data?.detail || 
                          error?.message || 
                          'Erreur lors de la suppression de l\'hospitalisation';
      alert(errorMessage);
    }
  };

  return (
    <div className="min-h-screen w-[95%] md:w-[90%] lg:w-[80%] mx-auto px-2 md:px-4 py-6 space-y-6">
      <div className="text-center py-6">
        <div className="bg-indigo-200 rounded-lg shadow p-6 max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center shadow-sm">
              <span className="material-symbols-rounded text-indigo-600 text-2xl">local_hospital</span>
            </div>
            <h1 className="text-2xl font-bold text-indigo-800">Hospitalisations</h1>
          </div>
          <p className="text-indigo-700 text-sm">Vue globale</p>
        </div>
      </div>

      <div className="flex justify-end mb-4">
        <Link to="/patients" className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2">
          <span className="material-symbols-rounded text-white text-2xl">add</span>
          Nouvelle hospitalisation (via patient)
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">Liste</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-indigo-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider">Patient</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider">Service</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider">Dates</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan="5" className="px-6 py-6"><LoadingSpinner message="Chargement des hospitalisations..." size="medium" color="indigo" /></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan="5" className="px-6 py-6 text-center text-gray-500">Aucune hospitalisation</td></tr>
              ) : (
                items.map(h => {
                  const p = (h && h.patientObj) || h.patient || {};
                  const pid = typeof p === 'object' ? p.id : null;
                  return (
                    <tr key={h.id} className="hover:bg-indigo-50/40">
                      <td className="px-6 py-3 text-sm text-indigo-700">
                        {pid ? (
                          <Link to={`/patients/${pid}`}>
                            <PatientName patient={p} />
                          </Link>
                        ) : (
                          <PatientName patient={p} />
                        )}
                      </td>
                      <td className="px-6 py-3 text-sm">
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">{h.statut}</span>
                          {(() => {
                            // Vérifier si c'est une pré-admission (dateSortie est null ou plannedDischargeDate est null)
                            const isPreAdmission = !h.dateSortie && !h.plannedDischargeDate && h.plannedAdmissionDate;
                            if (isPreAdmission) {
                              return (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                                  ⏳ Pré-admission
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-700">{h.uniteService || '—'}</td>
                      <td className="px-6 py-3 text-sm text-gray-700">
                        <div className="flex flex-col gap-1">
                          {h.plannedAdmissionDate ? (
                            <span>Admission: {formatDate(h.plannedAdmissionDate)}</span>
                          ) : h.dateAdmission ? (
                            <span>Admission: {formatDate(h.dateAdmission)}</span>
                          ) : (
                            <span>—</span>
                          )}
                          {h.plannedDischargeDate ? (
                            <span>Sortie prévue: {formatDate(h.plannedDischargeDate)}</span>
                          ) : h.dateSortie ? (
                            <span>Sortie: {formatDate(h.dateSortie)}</span>
                          ) : h.plannedAdmissionDate ? (
                            <span className="text-yellow-600 font-medium">Sortie non planifiée</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          {pid && (
                            <Link
                              to={`/patients/${pid}/hospitalisations/${h.id}`}
                              className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center gap-1"
                              title="Voir les détails"
                            >
                              <span className="material-symbols-rounded text-sm">visibility</span>
                              Voir
                            </Link>
                          )}
                          {canDeleteHospitalisation(h) && (
                            <button
                              onClick={() => handleDelete(h.id)}
                              disabled={deleteMutation.isPending}
                              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-1"
                              title="Supprimer cette hospitalisation"
                            >
                              <span className="material-symbols-rounded text-sm">delete</span>
                              Supprimer
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


