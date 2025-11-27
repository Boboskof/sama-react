import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import userService from '../../_services/user.service';
import patientService from '../../_services/patient.service';
import LoadingSpinner from '../../components/LoadingSpinner';
import SearchBar from '../../components/SearchBar';
import SearchFilters from '../../components/SearchFilters';
import ErrorMessage from '../../components/ErrorMessage';
import StatCard from '../../components/StatCard';
import { usePatients, usePatientStats, useAllCoverages } from '../../hooks/usePatients';
import { formatDate } from '../../utils/dateHelpers';
import { isMineur, isNumeroSecuValide } from '../../utils/patientHelpers';
// import types from TS files in TS/TSX only (JSX can't import TS types at runtime)

// Normalise une chaîne pour la recherche (accents/espaces/casse)
const strip = (s = '') =>
  s
    .toString()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

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
  const [couvertures, setCouvertures] = useState({});
  const [uiError, setUiError] = useState(null);
  // Filtres de recherche côté API (paginés)
  const [filters, setFilters] = useState({
    search: "",
    dateDebut: undefined,
    dateFin: undefined,
    page: 1,
    limit: 20 // Limit raisonnable (20/50 max recommandé) pour éviter de surcharger le backend
  });

  // Utiliser React Query pour charger les patients
  const { 
    data: patientsData = [], 
    isLoading: patientsLoading, 
    error: patientsError,
    isFetching: patientsFetching
  } = usePatients(filters);

  // Utiliser React Query pour charger les stats
  const { 
    data: statsData,
    isLoading: statsLoading
  } = usePatientStats();

  // Utiliser React Query pour charger toutes les couvertures avec leurs statuts
  const { 
    data: allCoveragesData,
    isLoading: allCoveragesLoading
  } = useAllCoverages();

  // Normaliser les patients (même logique qu'avant mais sur les données de React Query)
  const patients = useMemo(() => {
    return (patientsData || []).map(patient => {
      const pid = patient.id || (patient['@id'] ? String(patient['@id']).split('/').pop() : undefined);
      if (!pid) return null;
      
      return {
        ...patient,
        id: pid,
        nom: patient.nom || patient.lastName,
        prenom: patient.prenom || patient.firstName,
        genre: patient.genre || patient.gender || patient.civilite,
        dateNaissance: patient.dateNaissance || patient.date_naissance || patient.dateOfBirth,
        email: patient.email,
        telephone: patient.telephone || patient.phone,
        statut: patient.statut || patient.status,
        statutLabel: patient.statutLabel || patient.statut_label,
        createdBy: patient.createdBy || patient.created_by || patient.owner || patient.utilisateur
      };
    }).filter(p => p !== null);
  }, [patientsData]);

  // Extraire les stats depuis le backend (PAS depuis la liste paginée)
  // ⚠️ IMPORTANT: Les stats/exports doivent toujours venir du backend, jamais de la liste paginée
  const totalPatientsCount = statsData?.total || 0;
  const coverageStats = statsData?.coverage || { valides: 0, expirees: 0, manquantes: 0 };
  

  // Recherche locale dans la page (sur la liste paginée actuelle)
  const [query, setQuery] = useState('');

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

  // Créer un map des statuts de couverture par patient ID à partir de toutes les couvertures
  const coverageStatusMap = useMemo(() => {
    const map = {};
    
    if (!allCoveragesData?.couvertures || !Array.isArray(allCoveragesData.couvertures)) {
      return map;
    }
    
    // Grouper les couvertures par patient
    allCoveragesData.couvertures.forEach((couverture) => {
      const patientId = couverture.patient?.id;
      if (!patientId) return;
      
      const patientIdStr = String(patientId);
      
      if (!map[patientIdStr]) {
        map[patientIdStr] = {
          couvertures: []
        };
      }
      
      map[patientIdStr].couvertures.push(couverture);
    });
    
    // Déterminer le statut agrégé pour chaque patient
    Object.keys(map).forEach((patientId) => {
      const patientData = map[patientId];
      const couvertures = patientData.couvertures || [];
      
      if (couvertures.length === 0) {
        patientData.status = 'MANQUANTE';
        return;
      }
      
      // Vérifier s'il y a au moins une couverture valide
      const hasValid = couvertures.some(c => 
        c.currentlyValid === true || 
        c.statusText === 'VALIDE' || 
        (c.isExpired === false && c.isFuture === false && c.valide !== false)
      );
      
      const hasExpired = couvertures.some(c => 
        c.isExpired === true || 
        c.statusText === 'EXPIRÉE'
      );
      
      const hasFuture = couvertures.some(c => 
        c.isFuture === true || 
        c.statusText === 'FUTURE'
      );
      
      if (hasExpired && !hasValid) {
        patientData.status = 'EXPIRÉE';
      } else if (hasFuture && !hasValid) {
        patientData.status = 'FUTURE';
      } else if (hasValid) {
        patientData.status = 'VALIDE';
      } else {
        patientData.status = 'MANQUANTE';
      }
    });
    
    return map;
  }, [allCoveragesData]);

  // ⚠️ Filtre local UNIQUEMENT pour l'affichage (ne pas utiliser pour stats/exports)
  // La recherche principale est gérée côté backend via filters.search dans usePatients()
  // Ce filtre local est optionnel pour un affichage instantané sur la page actuelle (limit: 20 max)
  const filteredPatients = useMemo(() => {
    const q = strip(query);
    if (!q) return patients;
    // Filtrage en mémoire sur la liste déjà paginée (max 20 items) - acceptable pour UX
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
    const patientIdStr = String(patientId);
    
    // Vérifier dans le map des statuts
    if (coverageStatusMap[patientIdStr]) {
      const status = coverageStatusMap[patientIdStr].status;
      if (status === 'EXPIRÉE') {
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">EXPIRÉE</span>;
      } else if (status === 'MANQUANTE') {
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">MANQUANTE</span>;
      }
    }
    
    // Si le patient a des couvertures dans le map mais pas de statut spécifique, vérifier les couvertures
    const patientData = coverageStatusMap[patientIdStr];
    if (patientData?.couvertures && patientData.couvertures.length > 0) {
      // Vérifier si au moins une couverture est valide
      const hasValid = patientData.couvertures.some(c => 
        c.currentlyValid === true || 
        c.statusText === 'VALIDE' || 
        (c.isExpired === false && c.isFuture === false)
      );
      
      if (hasValid) {
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">VALIDE</span>;
      }
    }
    
    // Si pas dans le map, on distingue le chargement en cours et l'absence de couverture
    if (allCoveragesLoading) {
      // Pendant le chargement, afficher un tiret neutre
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          —
        </span>
      );
    }
    
    // Une fois le chargement terminé et si le patient n'a aucune couverture connue,
    // on considère que la couverture est manquante (comme l'ancien comportement).
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        MANQUANTE
      </span>
    );
  };

  // Utiliser les états de React Query
  const loading = patientsLoading || statsLoading;
  const error = patientsError || uiError;

  return (
    <div className="space-y-6 min-h-screen w-[95%] md:w-[90%] lg:w-[80%] mx-auto px-2 md:px-4 py-6">
      {/* Titre centré avec icône et description */}
      <div className="text-center py-6">
        <div className="bg-orange-200 rounded-lg shadow p-6 max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center shadow-sm">
              <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
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
            onDismiss={() => setUiError(null)}
          />
        </div>
      )}

      {/* Cartes de résumé (stats globales backend) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon="users"
          label="Total patients"
          value={totalPatientsCount}
          color="orange"
        />
        <StatCard
          icon="shield"
          label="Couvertures valides"
          value={coverageStats.valides}
          color="green"
        />
        <StatCard
          icon="warning"
          label="Couvertures expirées"
          value={coverageStats.expirees}
          color="red"
        />
        <StatCard
          icon="warning"
          label="Sans couverture"
          value={coverageStats.manquantes}
          color="purple"
        />
      </div>

      {/* Liste des patients */}
      <div className="bg-orange-50 rounded-lg shadow w-full">
        <div className="px-3 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-orange-700">Liste Patients</h3>
            <Link
              to="/patients/nouveau"
              className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-rounded text-white text-2xl">person_add</span>
              Nouveau Patient
            </Link>
          </div>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full">
            <thead className="bg-orange-200">
              <tr>
                <th className="px-3 py-3 text-center text-xs font-medium text-orange-700 uppercase tracking-wider">N°</th>
                <th className="px-3 py-3 text-center text-xs font-bold text-orange-700 uppercase tracking-wider">Genre</th>
                <th className="px-3 py-3 text-center text-xs font-bold text-orange-700 uppercase tracking-wider">Nom</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-orange-700 uppercase tracking-wider">Prénom</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-orange-700 uppercase tracking-wider">Date de Naissance</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-orange-700 uppercase tracking-wider">Statut</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-orange-700 uppercase tracking-wider">Statut Couverture</th>
                {isFormateur && (
                  <th className="px-3 py-3 text-center text-xs font-medium text-orange-700 uppercase tracking-wider">Créé par</th>
                )}
                <th className="px-3 py-3 text-center text-xs font-medium text-orange-700 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-orange-50 divide-y divide-orange-200">
              {patientsLoading || patientsFetching ? (
                <tr>
                  <td colSpan={isFormateur ? 9 : 8} className="px-6 py-8">
                    <LoadingSpinner color="orange" message="Chargement des patients..." />
                  </td>
                </tr>
              ) : filteredPatients.length > 0 ? (
                filteredPatients.map((patient, index) => (
                    <tr key={patient.id ?? `${patient.lastName}-${patient.firstName}-${index}`}>
                      <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-center">
                        {(filters.page - 1) * (filters.limit || 20) + index + 1}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                        {(() => {
                          const raw = patient.genre || patient.gender || patient.civilite || '';
                          const val = String(raw).trim();
                          if (!val) return (
                            <span className="text-red-600 font-bold inline-flex items-center gap-1">
                              <span className="material-symbols-rounded text-red-600 text-2xl">error</span>
                              MANQUANT
                            </span>
                          );
                          const lower = val.toLowerCase();
                          if (val === 'Mr' || val === 'M' || lower === 'homme' || lower === 'm.') return <span className="font-bold">Mr</span>;
                          if (val === 'Mme' || val === 'F' || lower === 'femme' || lower === 'mme.' || lower === 'madame') return <span className="font-bold">Mme</span>;
                          return (
                            <span className="text-orange-600 font-bold inline-flex items-center gap-1">
                              <span className="material-symbols-rounded text-orange-600 text-2xl">warning</span>
                              {val}
                            </span>
                          );
                        })()}
                      </td>
                    <td className="px-3 py-4 text-sm text-gray-900 text-center break-words">
                      <span className="font-bold">{patient.nom || patient.lastName || 'N/A'}</span>
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-900 text-center break-words">
                      {patient.prenom || patient.firstName || 'N/A'}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                      {formatDate(patient.dateNaissance)}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                      <div className="flex flex-col gap-1 items-center">
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
                        {/* Badges de statuts spéciaux */}
                        {(() => {
                          const badges = [];
                          const dateNaissance = patient.dateNaissance || patient.date_naissance || patient.dateOfBirth;
                          const numeroSecu = patient.numeroSecu || patient.numero_secu;
                          const dossierComplet = patient.dossierComplet ?? true;
                          const justificatifsManquants = patient.justificatifsManquants || [];
                          
                          // Badge mineur
                          if (dateNaissance && isMineur(dateNaissance)) {
                            badges.push(
                              <span key="mineur" className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200" title="Patient mineur">
                                👶 Mineur
                              </span>
                            );
                          }
                          
                          // Badge dossier incomplet
                          if (!dossierComplet || justificatifsManquants.length > 0) {
                            const title = justificatifsManquants.length > 0 
                              ? `Documents manquants: ${justificatifsManquants.join(', ')}`
                              : 'Dossier incomplet';
                            badges.push(
                              <span key="dossier" className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200" title={title}>
                                ⚠️ Dossier incomplet
                              </span>
                            );
                          }
                          
                          // Badge sécu invalide
                          if (numeroSecu && !isNumeroSecuValide(numeroSecu)) {
                            badges.push(
                              <span key="secu" className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200" title="Numéro de sécurité sociale invalide">
                                ⚠️ Sécu invalide
                              </span>
                            );
                          }
                          
                          // Ne pas afficher de badge "OK" - le statut "Actif" suffit
                          // Afficher seulement les badges d'alerte (mineur, dossier incomplet, sécu invalide)
                          
                          return badges.length > 0 ? <div className="flex flex-wrap gap-1 justify-center">{badges}</div> : null;
                        })()}
                      </div>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                      {getCoverageStatus(patient.id)}
                    </td>
                    {isFormateur && (
                      <td className="px-3 py-4 text-sm text-gray-900 text-center break-words">
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
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                      <button 
                        onClick={() => navigate(`/patients/${patient.id}`)}
                        className="bg-orange-600 text-white px-3 py-1 rounded text-xs hover:bg-orange-700 transition-colors mr-2 inline-flex items-center gap-1"
                      >
                        <span className="material-symbols-rounded text-white text-2xl">visibility</span>
                        Voir
                      </button>
                      <button className="bg-gray-500 text-white px-3 py-1 rounded text-xs hover:bg-gray-600 transition-colors inline-flex items-center gap-1 mr-2">
                        <span className="material-symbols-rounded text-white text-2xl">edit</span>
                        Modifier
                      </button>
                      {(() => {
                        const currentUser = userService.getUser && userService.getUser();
                        const isAdmin = userService.isAdmin && userService.isAdmin();
                        const currentUserId = currentUser?.id;
                        const currentUserIri = currentUser?.['@id'] || (currentUserId ? `/api/users/${currentUserId}` : null);
                        
                        // Fonction pour vérifier si l'utilisateur peut supprimer un patient
                        const canDeletePatient = () => {
                          // Formateurs et admins peuvent tout supprimer
                          if (isFormateur || isAdmin) return true;
                          
                          // Stagiaires peuvent supprimer uniquement leurs propres créations
                          if (!currentUserId || !currentUserIri) return false;
                          
                          const creator = patient.createdBy || patient.created_by || patient.owner || patient.utilisateur || null;
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
                        
                        const canDelete = canDeletePatient();
                        const onDelete = async () => {
                          if (!canDelete) {
                            alert('Suppression autorisée seulement pour le formateur, l\'admin ou le créateur.');
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
                            title={canDelete ? 'Supprimer' : 'Suppression autorisée seulement pour le formateur, l\'admin ou le créateur.'}
                            disabled={!canDelete}
                          >
                            <span className="material-symbols-rounded text-2xl">delete</span>
                            Supprimer
                          </button>
                        );
                      })()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isFormateur ? 9 : 8} className="px-4 py-8 text-center text-gray-500">
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
        <div className="text-sm text-gray-600">Page {filters.page} / {Math.max(1, Math.ceil((totalPatientsCount || filteredPatients.length) / (filters.limit || 20)))}</div>
        <div className="space-x-2">
          <button
            className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
            onClick={() => setFilters(f => ({ ...f, page: Math.max(1, (f.page || 1) - 1) }))}
            disabled={(filters.page || 1) <= 1}
          >Précédent</button>
          <button
            className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
            onClick={() => setFilters(f => ({ ...f, page: (f.page || 1) + 1 }))}
            disabled={(filters.page || 1) >= Math.max(1, Math.ceil((totalPatientsCount || filteredPatients.length) / (filters.limit || 20)))}
          >Suivant</button>
        </div>
      </div>
    </div>
  );
};

export default Patients;