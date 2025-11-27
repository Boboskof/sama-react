import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import hospitalisationService from '../../../_services/hospitalisation.service';
import { formatDate } from '../../../utils/dateHelpers';
import userService from '../../../_services/user.service';
import LoadingSpinner from '../../../components/LoadingSpinner';

const Detail = () => {
  const { id, hid } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  
  const isFormateur = userService.isFormateur && userService.isFormateur();
  const isAdmin = userService.isAdmin && userService.isAdmin();
  const isStagiaire = !isFormateur && !isAdmin;

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        // OPTIMISATION: Essayer d'abord de récupérer directement l'hospitalisation
        // Si l'endpoint direct n'existe pas, fallback sur la liste filtrée
        try {
          // Essayer un endpoint direct (si disponible)
          if (hospitalisationService.getOne) {
            const directItem = await hospitalisationService.getOne(hid).catch(() => null);
            if (directItem) {
              setItem(directItem);
              setLoading(false);
              return;
            }
          }
        } catch {
          // Continuer avec le fallback
        }
        
        // Fallback: Charger la liste et trouver l'item (moins optimal mais fonctionne)
        const list = await hospitalisationService.list(id);
        const array = Array.isArray(list)
          ? list
          : list && typeof list === 'object'
            ? Object.values(list)
            : [];
        const found = array.find(h => h && String(h.id) === String(hid));
        setItem(found || null);
      } finally { setLoading(false); }
    })();
  }, [id, hid]);

  const handleConfirmService = async () => {
    if (!item || !hid) return;
    
    // Vérifier si déjà confirmée (PLANIFIEE ou scheduled)
    const currentStatut = item.statut?.toUpperCase?.() || item.statut;
    if (currentStatut === 'PLANIFIEE' || currentStatut === 'SCHEDULED' || item.statut === 'scheduled') {
      alert('Cette hospitalisation est déjà confirmée.');
      return;
    }
    
    if (!window.confirm('Confirmer le service pour cette hospitalisation ?')) {
      return;
    }
    
    try {
      setConfirming(true);
      // Changer le statut à PLANIFIEE (confirmée) - utiliser la valeur de l'enum PHP
      await hospitalisationService.patch(hid, { statut: 'PLANIFIEE' });
      // Recharger les données
      const updated = await hospitalisationService.getOne(hid);
      if (updated) {
        setItem(updated);
        alert('Service confirmé avec succès.');
      }
    } catch (error) {
      console.error('Erreur lors de la confirmation:', error);
      const errorMessage = error?.response?.data?.message || 
                          error?.response?.data?.detail || 
                          error?.message || 
                          'Erreur lors de la confirmation du service';
      alert(errorMessage);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="min-h-screen w-[95%] md:w-[90%] lg:w-[80%] mx-auto px-2 md:px-4 py-6 space-y-6">
      <div className="text-center py-6">
        <div className="bg-indigo-200 rounded-lg shadow p-6 max-w-xl mx-auto">
          <h1 className="text-2xl font-bold text-indigo-800">Détail hospitalisation</h1>
          <p className="text-indigo-700 text-sm">Patient #{id} — Hosp #{hid}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        {loading ? (
          <LoadingSpinner message="Chargement des détails..." size="medium" color="indigo" />
        ) : !item ? (
          <p className="text-gray-600">Introuvable.</p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-rounded text-indigo-600">info</span>
              <span className="font-medium">Statut:</span> {item.statut}
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-rounded text-indigo-600">apartment</span>
              <span className="font-medium">Unité:</span> {item.uniteService || '—'}
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-rounded text-indigo-600">event</span>
              <span className="font-medium">Dates prévues:</span> {item.plannedAdmissionDate ? formatDate(item.plannedAdmissionDate) : '—'} {item.plannedDischargeDate ? `→ ${formatDate(item.plannedDischargeDate)}` : ''}
            </div>
          </div>
        )}
      </div>

      {item && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-1">Confirmation du service</h3>
              <p className="text-sm text-gray-600">Confirmer que le service est prêt pour cette hospitalisation</p>
              <p className="text-xs text-gray-500 mt-1">
                Statut actuel: {item.statut} | isStagiaire: {isStagiaire ? 'oui' : 'non'}
              </p>
            </div>
            {(() => {
              // Vérifier si le statut est déjà confirmé (PLANIFIEE)
              const currentStatut = String(item.statut || '').toUpperCase();
              const isAlreadyConfirmed = currentStatut === 'PLANIFIEE' || currentStatut === 'SCHEDULED';
              
              if (isAlreadyConfirmed) {
                return (
                  <div className="px-4 py-2 bg-gray-200 text-gray-600 rounded-lg">
                    Déjà confirmée
                  </div>
                );
              }
              
              if (!isStagiaire) {
                return (
                  <div className="px-4 py-2 bg-gray-200 text-gray-600 rounded-lg">
                    Réservé aux stagiaires
                  </div>
                );
              }
              
              return (
                <button
                  onClick={handleConfirmService}
                  disabled={confirming}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {confirming ? (
                    <>
                      <LoadingSpinner color="white" size="small" inline={true} />
                      Confirmation...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-rounded text-sm">check_circle</span>
                      Confirmer le service
                    </>
                  )}
                </button>
              );
            })()}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Link to={`/patients/${id}/hospitalisations`} className="px-4 py-2 rounded border">Retour à la liste</Link>
        <Link to="/hospitalisations" className="px-4 py-2 rounded border">Retour aux hospitalisations</Link>
      </div>
    </div>
  );
};

export default Detail;


