import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import userService from '../../_services/user.service';
import patientService from '../../_services/patient.service';
import LoadingSpinner from '../../components/LoadingSpinner';
import SearchBar from '../../components/SearchBar';
import SearchFilters from '../../components/SearchFilters';
import ErrorMessage from '../../components/ErrorMessage';
import { useSearch } from '../../hooks/useSearch';
// import types from TS files in TS/TSX only (JSX can't import TS types at runtime)

// Normalise une chaîne pour la recherche (accents/espaces/casse)
const strip = (s = '') =>
  s
    .toString()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

// Affiche une date au format local FR
const formatDate = (dateString) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR');
};

// Affichage robuste d'une mutuelle/assureur quelles que soient les formes renvoyées
const displayInsurance = (insurance) => {
  if (!insurance) return 'N/A';
  // Si objet { name }, si IRI '/api/insurance_companies/3', sinon string simple
  if (typeof insurance === 'object' && insurance !== null) {
    return insurance.name || insurance.label || 'N/A';
  }
  if (typeof insurance === 'string' && insurance.startsWith('/api/')) {
    return insurance.split('/').pop(); // fallback: id de l’IRI
  }
  return String(insurance);
};

const PATIENT_STATUS_META = {
  ACTIF: {
    label: 'Actif',
    badgeClass: 'bg-green-100 text-green-800 border border-green-200',
    icon: '✅'
  },
  INACTIF: {
    label: 'Inactif',
    badgeClass: 'bg-gray-100 text-gray-800 border border-gray-300',
    icon: '⏸️'
  },
  DECEDE: {
    label: 'Décédé',
    badgeClass: 'bg-red-100 text-red-800 border border-red-300 font-semibold',
    icon: '⚰️'
  }
};

const getPatientStatusMeta = (statut, statutLabel) => {
  if (!statut && !statutLabel) return null;
  const key = String(statut || '').toUpperCase();
  const base = PATIENT_STATUS_META[key];
  if (!base) {
    return {
      label: statutLabel || statut || 'Statut inconnu',
      badgeClass: 'bg-orange-100 text-orange-800 border border-orange-200',
      icon: 'ℹ️'
    };
  }
  return {
    ...base,
    code: key,
    label: statutLabel || base.label
  };
};

const Patients = () => {
  const navigate = useNavigate();
  const isFormateur = userService.isFormateur && userService.isFormateur();
  const [patients, setPatients] = useState([]);
  const [couvertures, setCouvertures] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Stats globales (back)
  const [totalPatientsCount, setTotalPatientsCount] = useState(0);
  const [coverageStats, setCoverageStats] = useState({ valides: 0, expirees: 0, manquantes: 0 });
  // Filtres de recherche côté API (paginés)
  const [filters, setFilters] = useState({
    search: "",
    dateDebut: undefined,
    dateFin: undefined,
    page: 1,
    limit: 30
  });
  

  // Utiliser le hook de recherche
  // Recherche serveur (hook commun)
  const { 
    query, 
    setQuery, 
    results: searchResults, 
    loading: searchLoading, 
    error: searchError, 
    total: searchTotal 
  } = useSearch('patients', { 
    limit: filters.limit || 50,
    filters: {
      search: filters.search,
      date_from: filters.dateDebut,
      date_to: filters.dateFin
    }
  });

  

  // Boutons rapides pour les filtres
  // Raccourcis de périodes usuelles
  const quickFilters = [
    { label: 'Aujourd\'hui', action: () => {
      const today = new Date().toISOString().split('T')[0];
      setFilters(f => ({ ...f, dateDebut: today, dateFin: today, page: 1 }));
    }},
    { label: 'Cette semaine', action: () => {
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      setFilters(f => ({ 
        ...f, 
        dateDebut: weekStart.toISOString().split('T')[0],
        dateFin: weekEnd.toISOString().split('T')[0],
        page: 1,
      }));
    }},
    { label: 'Ce mois', action: () => {
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      
      setFilters(f => ({ 
        ...f, 
        dateDebut: monthStart.toISOString().split('T')[0],
        dateFin: monthEnd.toISOString().split('T')[0],
        page: 1,
      }));
    }},
    { label: 'Tous', action: () => {
      setFilters(f => ({ 
        ...f, 
        search: "",
        dateDebut: undefined,
        dateFin: undefined,
        page: 1,
      }));
    }}
  ];

  // Charge la liste + détails patients et leurs couvertures (séquentiel pour cohérence UI)
  useEffect(() => {
    const loadPatients = async () => {
      try {
        setLoading(true);
        const extra = {};
        if (filters.search) (extra).search = filters.search;
        if (filters.dateDebut) (extra).date_from = filters.dateDebut;
        if (filters.dateFin) (extra).date_to = filters.dateFin;
        const list = await patientService.getPatientsPage(filters.page, filters.limit, extra);
        
        // Map de données complètes patient + couvertures associées
        const mappedPatients = [];
        const couverturesData = {};
        

        for (const patient of list) {
          try {
            const pid = patient.id || (patient['@id'] ? String(patient['@id']).split('/').pop() : undefined);
            if (!pid) continue;
            // Détails complet car la liste standard peut omettre certains champs (ex: genre)
            const fullPatientData = await patientService.getOnePatient(pid);
            
            const genreVal = patient.genre || fullPatientData.genre || (patient.gender ?? fullPatientData.gender) || (patient.civilite ?? fullPatientData.civilite);
            const mappedPatient = {
              ...fullPatientData,
              // Préserve le genre récupéré en liste si absents du détail
              genre: genreVal,
              numeroSecu: fullPatientData.numeroSecu,
              organismeSecu: fullPatientData.organismeSecu,
              adresseL1: fullPatientData.adresseL1,
              adresseL2: fullPatientData.adresseL2,
              notes: fullPatientData.notes
            };
            
            mappedPatients.push(mappedPatient);
            
            // Couvertures (pour calculer un statut visuel rapide)
            try {
              const couvData = await patientService.getPatientCouvertures(String(pid));
              couverturesData[String(pid)] = couvData;
            } catch (error) {
              console.error(`Erreur couvertures pour ${mappedPatient.prenom} ${mappedPatient.nom}:`, error);
              couverturesData[String(pid)] = [];
            }
          } catch (error) {
            console.error(`❌ ERREUR chargement patient ${(patient.id || patient['@id'] || 'inconnu')}:`, error);
            // Conserver un retour explicite pour l'utilisateur
            couverturesData[String(patient.id || '')] = [];
          }
        }
        
        setPatients(mappedPatients);
        setCouvertures(couverturesData);
        setError(null); // Réinitialiser l'erreur en cas de succès
      } catch (error) {
        console.error("Erreur lors du chargement des patients:", error);
        setPatients([]);
        setError(error);
      } finally {
        setLoading(false);
      }
    };
    loadPatients();
  }, [filters.page, filters.limit, filters.search, filters.dateDebut, filters.dateFin]);

  // Charger les stats globales depuis le back (léger et fiable)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [stagStatus, total, cov] = await Promise.all([
          patientService.getStagiairePatientsStatus().catch(() => ({})),
          patientService.countAllPatients().catch(() => 0),
          patientService.getCoverageStatus().catch(() => ({ valides: 0, expirees: 0, manquantes: 0, total: 0 }))
        ]);
        if (cancelled) return;
        const myTotal = Number(stagStatus?.me?.total || 0);
        setTotalPatientsCount(myTotal > 0 ? myTotal : Number(total || 0));
        setCoverageStats({ valides: Number(cov.valides||0), expirees: Number(cov.expirees||0), manquantes: Number(cov.manquantes||0) });
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredPatients = useMemo(() => {
    const q = strip(query);
    if (!q) return patients;
    return patients.filter((p) => {
      const f = strip(p.firstName || '');
      const l = strip(p.lastName || '');
      const e = strip(p.email || '');
      return f.includes(q) || l.includes(q) || e.includes(q);
    });
  }, [patients, query]);

  // Badge de statut pour une couverture individuelle
  const getStatusBadge = (couverture) => {
    if (couverture.isExpired) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">EXPIRÉE</span>;
    } else if (couverture.isFuture) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">FUTURE</span>;
    } else {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">VALIDE</span>;
    }
  };

  // Détermine le statut de couverture agrégé pour un patient (VALIDE/EXPIRÉE/MANQUANTE)
  const getCoverageStatus = (patientId) => {
    const patientCouvertures = couvertures[patientId] || [];
    
    // Si aucune couverture
    if (patientCouvertures.length === 0) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        MANQUANTE
      </span>;
    }

    // Calcul basé sur les dates de début/fin
    const now = new Date();
    let hasValid = false;
    let hasExpired = false;

  patientCouvertures.forEach(couverture => {
    const dateDebut = couverture.dateDebut ? new Date(couverture.dateDebut) : null;
    const dateFin = couverture.dateFin ? new Date(couverture.dateFin) : null;
    if (dateDebut && dateFin) {
      if (dateDebut <= now && now <= dateFin) {
        hasValid = true;
      } else if (dateFin < now) {
        hasExpired = true;
      }
    }
  });

  if (hasValid) {
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">VALIDE</span>;
  }
  return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">EXPIRÉE</span>;
  
};

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner message="Chargement des patients..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 min-h-screen p-6">
      {/* Titre centré avec icône et description */}
      <div className="text-center py-6">
        <div className="bg-orange-200 rounded-lg shadow p-6 max-w-xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center shadow-sm">
              <span className="material-symbols-rounded text-orange-600 text-2xl">groups</span>
            </div>
            <h1 className="text-2xl font-bold text-orange-800">Dossiers Patients</h1>
          </div>
          <p className="text-orange-600 text-sm">
            Gérez les dossiers médicaux de vos patients
          </p>
        </div>
      </div>

      {/* Message d'erreur */}
      {error && (
        <div className="mb-6">
          <ErrorMessage 
            message={error} 
            title="Erreur de chargement"
            dismissible={true}
            onDismiss={() => setError(null)}
          />
        </div>
      )}

      {/* Cartes de résumé (stats globales backend) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-orange-50 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-700">Total patients</p>
              <p className="text-3xl font-bold text-orange-800">{totalPatientsCount}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <span className="material-symbols-rounded text-orange-600">groups</span>
            </div>
          </div>
        </div>

        <div className="bg-orange-50 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-700">Couvertures valides</p>
              <p className="text-3xl font-bold text-orange-800">{coverageStats.valides}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <span className="material-symbols-rounded text-green-600">verified</span>
            </div>
          </div>
        </div>

        <div className="bg-orange-50 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-700">Couvertures expirées</p>
              <p className="text-3xl font-bold text-orange-800">{coverageStats.expirees}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <span className="material-symbols-rounded text-red-600">event_busy</span>
            </div>
          </div>
        </div>

        <div className="bg-orange-50 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-700">Sans couverture</p>
              <p className="text-3xl font-bold text-orange-800">{coverageStats.manquantes}</p>
            </div>
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
              <span className="material-symbols-rounded text-gray-600">shield</span>
            </div>
          </div>
        </div>
      </div>

      {/* Liste des patients */}
      <div className="bg-orange-50 rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-orange-700">Liste Patients</h3>
            <Link
              to="/patients/nouveau"
              className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-rounded text-white text-base">person_add</span>
              Nouveau Patient
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-orange-200">
              <tr>
                <th className="px-6 py-3 text-center text-xs font-medium text-orange-700 uppercase tracking-wider">N°</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-orange-700 uppercase tracking-wider">Genre</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-orange-700 uppercase tracking-wider">Nom</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-orange-700 uppercase tracking-wider">Prénom</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-orange-700 uppercase tracking-wider">Date de Naissance</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-orange-700 uppercase tracking-wider">Statut</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-orange-700 uppercase tracking-wider">Statut Couverture</th>
                {isFormateur && (
                  <th className="px-6 py-3 text-center text-xs font-medium text-orange-700 uppercase tracking-wider">Créé par</th>
                )}
                <th className="px-6 py-3 text-center text-xs font-medium text-orange-700 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-orange-50 divide-y divide-orange-200">
              {filteredPatients.length > 0 ? (
                filteredPatients.map((patient, index) => (
                    <tr key={patient.id ?? `${patient.lastName}-${patient.firstName}-${index}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-center">
                        {(filters.page - 1) * (filters.limit || 30) + index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                        {(() => {
                          const raw = patient.genre || patient.gender || patient.civilite || '';
                          const val = String(raw).trim();
                          if (!val) return (
                            <span className="text-red-600 font-bold inline-flex items-center gap-1">
                              <span className="material-symbols-rounded text-red-600 text-base">error</span>
                              MANQUANT
                            </span>
                          );
                          const lower = val.toLowerCase();
                          if (val === 'Mr' || val === 'M' || lower === 'homme' || lower === 'm.') return 'Mr';
                          if (val === 'Mme' || val === 'F' || lower === 'femme' || lower === 'mme.' || lower === 'madame') return 'Mme';
                          return (
                            <span className="text-orange-600 font-bold inline-flex items-center gap-1">
                              <span className="material-symbols-rounded text-orange-600 text-base">warning</span>
                              {val}
                            </span>
                          );
                        })()}
                      </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                      {patient.nom || patient.lastName || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                      {patient.prenom || patient.firstName || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                      {formatDate(patient.dateNaissance)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                      {(() => {
                        const meta = getPatientStatusMeta(patient.statut, patient.statutLabel);
                        if (!meta) return <span className="text-gray-500">—</span>;
                        return (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${meta.badgeClass}`}>
                            <span>{meta.icon}</span>
                            <span>{meta.label}</span>
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                      {getCoverageStatus(patient.id)}
                    </td>
                    {isFormateur && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                        {(() => {
                          const creator = patient.createdBy || patient.created_by || patient.owner || patient.utilisateur || {};
                          const fn = creator.prenom || creator.firstName || '';
                          const ln = creator.nom || creator.lastName || '';
                          const email = creator.email || '';
                          const name = `${fn} ${ln}`.trim();
                          return name || email || '—';
                        })()}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                      <button 
                        onClick={() => navigate(`/patients/${patient.id}`)}
                        className="bg-orange-600 text-white px-3 py-1 rounded text-xs hover:bg-orange-700 transition-colors mr-2 inline-flex items-center gap-1"
                      >
                        <span className="material-symbols-rounded text-white text-sm">visibility</span>
                        Voir
                      </button>
                      <button className="bg-gray-500 text-white px-3 py-1 rounded text-xs hover:bg-gray-600 transition-colors inline-flex items-center gap-1 mr-2">
                        <span className="material-symbols-rounded text-white text-sm">edit</span>
                        Modifier
                      </button>
                      {(() => {
                        const currentUser = userService.getUser && userService.getUser();
                        const isCreator = (() => {
                          const creator = (patient.createdBy || patient.created_by || patient.owner || patient.utilisateur || {});
                          const cid = creator.id || (typeof creator === 'string' ? creator.split('/').pop() : undefined);
                          return String(cid || '') === String(currentUser?.id || '');
                        })();
                        const canDelete = (userService.isFormateur && userService.isFormateur()) || (userService.isStagiaire && userService.isStagiaire() && isCreator);
                        const onDelete = async () => {
                          if (!canDelete) {
                            alert('Suppression autorisée seulement pour le formateur ou le créateur.');
                            return;
                          }
                          if (!confirm('Confirmer la suppression de ce patient ?')) return;
                          try {
                            await patientService.deletePatient(patient.id);
                            setPatients(prev => prev.filter(p => (p.id ?? p['@id']) !== patient.id));
                          } catch (e) {
                            alert('Échec de la suppression.');
                          }
                        };
                        return (
                          <button
                            onClick={onDelete}
                            className={`px-3 py-1 rounded text-xs transition-colors inline-flex items-center gap-1 ${canDelete ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-red-200 text-red-500 cursor-not-allowed'}`}
                            title={canDelete ? 'Supprimer' : 'Suppression autorisée seulement pour le formateur ou le créateur.'}
                            disabled={!canDelete}
                          >
                            <span className="material-symbols-rounded text-sm">delete</span>
                            Supprimer
                          </button>
                        );
                      })()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isFormateur ? 9 : 8} className="px-6 py-8 text-center text-gray-500">
                    {query
                      ? 'Aucun patient trouvé pour cette recherche'
                      : 'Aucun patient enregistré'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-gray-600">Page {filters.page} / {Math.max(1, Math.ceil((totalPatientsCount || filteredPatients.length) / (filters.limit || 30)))}</div>
        <div className="space-x-2">
          <button
            className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
            onClick={() => setFilters(f => ({ ...f, page: Math.max(1, (f.page || 1) - 1) }))}
            disabled={(filters.page || 1) <= 1}
          >Précédent</button>
          <button
            className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
            onClick={() => setFilters(f => ({ ...f, page: (f.page || 1) + 1 }))}
            disabled={(filters.page || 1) >= Math.max(1, Math.ceil((totalPatientsCount || filteredPatients.length) / (filters.limit || 30)))}
          >Suivant</button>
        </div>
      </div>
    </div>
  );
};

export default Patients;
