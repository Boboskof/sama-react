import React, { useState, useEffect, useCallback, useMemo } from "react";
import userService from "../../_services/user.service";
import appointmentService from "../../_services/appointment.service";
import patientService from "../../_services/patient.service";
import medecinService from "../../_services/medecin.service";
import ErrorMessage from "../../components/ErrorMessage";
import LoadingSpinner from "../../components/LoadingSpinner";
import {
  extractHHmm,
  sameDay,
  dayIndexMondayFirst,
  getAppointmentDuration,
  formatAppointmentTimeRange,
  getDoctorNameFromAppointment,
  getPatientId,
  getAppointmentStatusClasses,
  getAppointmentStatusLabel
} from "../../utils/appointmentHelpers";

import { getPatientStatusInfo, getPatientNameString } from "../../utils/patientHelpers";
import PatientName from "../../components/PatientName";
import PatientSearchInput from "../../components/PatientSearchInput";
import StatCard from "../../components/StatCard";


// Exemple d'Appointments simplifié avec mappers
const Appointments = () => {
  // États principaux
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fonction utilitaire pour formater le genre
  const formatGenre = (patient) => {
    if (!patient) return null;
    const raw = patient?.genre || patient?.gender || patient?.civilite || '';
    const val = String(raw).trim();
    if (!val) return null;
    const lower = val.toLowerCase();
    if (val === 'Mr' || val === 'M' || lower === 'homme' || lower === 'm.') return 'Mr';
    if (val === 'Mme' || val === 'F' || lower === 'femme' || lower === 'mme.' || lower === 'madame') return 'Mme';
    return val;
  };

  // Référentiels
  const [patients, setPatients] = useState([]);
  const [medecins, setMedecins] = useState([]);
  const medecinsById = useMemo(() => {
    const map = {};
    (medecins || []).forEach(m => { if (m && m.id) map[m.id] = m; });
    return map;
  }, [medecins]);

  // Si certains RDV ne contiennent qu'un IRI de médecin, charger paresseusement les fiches manquantes
  useEffect(() => {
    const missingIds = new Set();
    for (const appt of appointments || []) {
      const m = appt?.medecin || appt?.doctor;
      if (typeof m === 'string') {
        const iri = m;
        const id = iri.includes('/') ? iri.split('/').pop() : iri;
        if (id && !medecinsById[id]) missingIds.add(id);
      }
    }
    if (missingIds.size === 0) return;
    (async () => {
      try {
        const loaded = [];
        for (const id of Array.from(missingIds)) {
          try {
            const one = await medecinService.getOneMedecin(id);
            if (one) loaded.push(one);
          } catch {}
        }
        if (loaded.length) {
          setMedecins(prev => {
            const byId = new Set((prev || []).map(p => p.id));
            const merged = [...prev];
            for (const m of loaded) {
              if (!byId.has(m.id)) { merged.push(m); byId.add(m.id); }
            }
            return merged;
          });
        }
      } catch {}
    })();
  }, [appointments, medecinsById]);
  const [selectedMedecinId, setSelectedMedecinId] = useState('');
  const [showDoctorPicker, setShowDoctorPicker] = useState(false);

  // Stats basiques
  const [stats, setStats] = useState({ total: 0, confirmes: 0, enAttente: 0, annules: 0, termines: 0, absents: 0 });
  
  // Pagination pour l'historique des RDV
  const APPOINTMENTS_PER_PAGE = 20;
  const [currentPage, setCurrentPage] = useState(1);
  // (Section RDV des patients retirée)

  // Style visuel + calendrier/agenda (clonés)
const HOURS_START = 8;
const HOURS_END = 18;
const SLOT_MINUTES = 30;
  const HAUTEUR_MIN_CARTE_CRENEAU = 64; // px, pour fusion visuelle des créneaux

  const toISODate = (d) => {
  const z = new Date(d);
  z.setHours(0, 0, 0, 0);
  const year = z.getFullYear();
  const month = String(z.getMonth() + 1).padStart(2, '0');
  const day = String(z.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatEndTimeFrom = (startTime, durationMinutes) => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
  };

  // Helper pour détecter si un rendez-vous a l'urgence médecin (stocké dans les notes)
  const hasUrgenceMedecin = (appt) => {
    if (!appt) return false;
    // Vérifier d'abord les champs directs (si le backend les supporte un jour)
    if (appt.urgenceMedecin || appt.urgence_medecin) return true;
    // Sinon vérifier dans les notes
    const notes = appt.notes || '';
    return notes.includes('[URGENCE_MEDECIN]');
  };


  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  // Formateur
  const isFormateur = userService.isFormateur && userService.isFormateur();
  const isAdmin = userService.isAdmin && userService.isAdmin();
  const currentUser = userService.getUser && userService.getUser();
  const currentUserId = currentUser?.id;
  const currentUserIri = currentUser?.['@id'] || (currentUserId ? `/api/users/${currentUserId}` : null);
  
  // Fonction pour vérifier si l'utilisateur peut supprimer un rendez-vous
  const canDeleteAppointment = (rdv) => {
    // Formateurs et admins peuvent tout supprimer
    if (isFormateur || isAdmin) return true;
    
    // Stagiaires peuvent supprimer uniquement leurs propres créations
    if (!currentUserId || !currentUserIri) return false;
    
    const creator = rdv.createdBy || rdv.created_by || rdv.creePar || rdv.user || null;
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
  
  const [trainerAppointments, setTrainerAppointments] = useState([]);
  const [trainerLoading, setTrainerLoading] = useState(false);
  const [creatorMap, setCreatorMap] = useState({}); // id -> { prenom, nom, email }
  const [creatorLabelByRdv, setCreatorLabelByRdv] = useState({}); // rdvId -> string label
  const [trainerFilter, setTrainerFilter] = useState('a_venir'); // 'a_venir', 'passes'
  const [trainerCurrentPage, setTrainerCurrentPage] = useState(1);
  const TRAINER_PER_PAGE = 20;
  
  // État pour les rendez-vous passés (chargés séparément via l'endpoint /passes)
  const [pastAppointments, setPastAppointments] = useState([]);
  const [pastAppointmentsLoading, setPastAppointmentsLoading] = useState(false);
  const [pastAppointmentsPage, setPastAppointmentsPage] = useState(1);
  const [pastAppointmentsTotal, setPastAppointmentsTotal] = useState(0);
  const [pastAppointmentsShowingFrom, setPastAppointmentsShowingFrom] = useState(0);
  const [pastAppointmentsShowingTo, setPastAppointmentsShowingTo] = useState(0);
  const PAST_PER_PAGE = 20;

  // État pour la suppression multiple (uniquement pour formateurs)
  const [selectedAppointments, setSelectedAppointments] = useState(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Filtres simplifiés (JS)
  const [filters, setFilters] = useState({
    statut: [],
    medecin: undefined,
    patientId: undefined,
    dateDebut: undefined,
    dateFin: undefined,
    page: 1,
    limit: 100 // Augmenté pour voir plus de rendez-vous (au lieu de 25)
  });

  // Modales de création/édition
  const [showCreate, setShowCreate] = useState(false);
  const [newAppt, setNewAppt] = useState({ patient: '', medecin: '', motif: '', date: '', heure: '', duree: '30', notes: '', urgenceMedecin: false });
  const [createError, setCreateError] = useState('');
  
  const [showEdit, setShowEdit] = useState(false);
  const [editApptId, setEditApptId] = useState(null);
  const [editAppt, setEditAppt] = useState({ patient: '', medecin: '', motif: '', date: '', heure: '', duree: '30', notes: '', urgenceMedecin: false });
  const [editError, setEditError] = useState('');
  const [editStatusId, setEditStatusId] = useState(null);
  const [editStatusValue, setEditStatusValue] = useState('');
  
  // Recherche intelligente de patient pour création
  const [patientSearchCreate, setPatientSearchCreate] = useState('');
  const [showPatientResultsCreate, setShowPatientResultsCreate] = useState(false);
  const [selectedPatientCreate, setSelectedPatientCreate] = useState(null);
  
  // Recherche intelligente de patient pour édition
  const [patientSearchEdit, setPatientSearchEdit] = useState('');
  const [showPatientResultsEdit, setShowPatientResultsEdit] = useState(false);
  const [selectedPatientEdit, setSelectedPatientEdit] = useState(null);
  
  // Fonction de normalisation pour la recherche (ignore accents, casse, espaces)
  const normalizeSearch = (str) => {
    if (!str) return '';
    return str
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  };
  
  // Fonction de recherche intelligente de patient
  const searchPatients = (query, patientList) => {
    if (!query || query.trim() === '') return patientList.slice(0, 50); // Limiter à 50 résultats
    
    const normalizedQuery = normalizeSearch(query);
    const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0);
    
    return patientList.filter(p => {
      const id = getPatientId(p);
      if (!id) return false;
      
      // Récupérer toutes les informations du patient
      const prenom = normalizeSearch(p.prenom || p.firstName || '');
      const nom = normalizeSearch(p.nom || p.lastName || '');
      const email = normalizeSearch(p.email || '');
      const telephone = normalizeSearch(p.telephone || p.phone || '');
      const numeroSecu = normalizeSearch(p.numeroSecu || p.numeroSecuriteSociale || '');
      const fullName = `${prenom} ${nom}`.trim();
      
      // Vérifier si tous les mots de la requête sont présents
      return queryWords.every(word => 
        prenom.includes(word) ||
        nom.includes(word) ||
        fullName.includes(word) ||
        email.includes(word) ||
        telephone.includes(word) ||
        numeroSecu.includes(word) ||
        id.includes(word)
      );
    }).slice(0, 20); // Limiter à 20 résultats pour l'affichage
  };
  
  // Patients filtrés pour création
  const filteredPatientsCreate = useMemo(() => {
    return searchPatients(patientSearchCreate, patients);
  }, [patientSearchCreate, patients]);
  
  // Patients filtrés pour édition
  const filteredPatientsEdit = useMemo(() => {
    return searchPatients(patientSearchEdit, patients);
  }, [patientSearchEdit, patients]);
  
  // Gérer la sélection d'un patient (création)
  const handleSelectPatientCreate = (patient) => {
    const id = getPatientId(patient);
    if (!id) return;
    
    const info = getPatientStatusInfo(patient);
    if (info.isDeceased) {
      setCreateError("Ce patient est déclaré décédé. Veuillez choisir un autre patient.");
      return;
    }
    
    setNewAppt(prev => ({ ...prev, patient: id }));
    setSelectedPatientCreate(patient);
    setPatientSearchCreate(getPatientNameString(patient, false) || patient.email || `Patient ${id}`);
    setShowPatientResultsCreate(false);
    setCreateError('');
  };
  
  // Gérer la sélection d'un patient (édition)
  const handleSelectPatientEdit = (patient) => {
    const id = getPatientId(patient);
    if (!id) return;
    
    const info = getPatientStatusInfo(patient);
    if (info.isDeceased) {
      setEditError("Ce patient est déclaré décédé. Veuillez choisir un autre patient.");
      return;
    }
    
    setEditAppt(prev => ({ ...prev, patient: id }));
    setSelectedPatientEdit(patient);
    setPatientSearchEdit(getPatientNameString(patient, false) || patient.email || `Patient ${id}`);
    setShowPatientResultsEdit(false);
    setEditError('');
  };
  
  // Réinitialiser la recherche patient lors de l'ouverture/fermeture des modales
  useEffect(() => {
    if (showCreate) {
      if (newAppt.patient) {
        const selected = patients.find(p => getPatientId(p) === String(newAppt.patient));
        if (selected) {
          setSelectedPatientCreate(selected);
          setPatientSearchCreate(getPatientNameString(selected, false) || selected.email || `Patient ${getPatientId(selected)}`);
        } else {
          setSelectedPatientCreate(null);
          setPatientSearchCreate('');
        }
      } else {
        setSelectedPatientCreate(null);
        setPatientSearchCreate('');
      }
      setShowPatientResultsCreate(false);
    } else {
      setPatientSearchCreate('');
      setSelectedPatientCreate(null);
      setShowPatientResultsCreate(false);
    }
  }, [showCreate, newAppt.patient, patients]);
  
  useEffect(() => {
    if (showEdit) {
      if (editAppt.patient) {
        const selected = patients.find(p => getPatientId(p) === String(editAppt.patient));
        if (selected) {
          setSelectedPatientEdit(selected);
          setPatientSearchEdit(getPatientNameString(selected, false) || selected.email || `Patient ${getPatientId(selected)}`);
        } else {
          setSelectedPatientEdit(null);
          setPatientSearchEdit('');
        }
      } else {
        setSelectedPatientEdit(null);
        setPatientSearchEdit('');
      }
      setShowPatientResultsEdit(false);
    } else {
      setPatientSearchEdit('');
      setSelectedPatientEdit(null);
      setShowPatientResultsEdit(false);
    }
  }, [showEdit, editAppt.patient, patients]);
  
  // Fermer les résultats de recherche lors d'un clic en dehors
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showPatientResultsCreate && !event.target.closest('.patient-search-create')) {
        setShowPatientResultsCreate(false);
      }
      if (showPatientResultsEdit && !event.target.closest('.patient-search-edit')) {
        setShowPatientResultsEdit(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPatientResultsCreate, showPatientResultsEdit]);
  
  useEffect(() => {
    if (!newAppt.patient) return;
    const selected = patients.find(p => getPatientId(p) === String(newAppt.patient));
    if (!selected) return;
    const info = getPatientStatusInfo(selected);
    if (info.isDeceased) {
      setNewAppt(prev => ({ ...prev, patient: '' }));
      setCreateError(prev => prev || "Ce patient est déclaré décédé. Veuillez choisir un autre patient.");
    }
  }, [patients, newAppt.patient]);

  // Chargement des données
  const loadAppointments = useCallback(async () => {
    // Fonction helper pour vérifier si un RDV appartient à un médecin
    const belongsToMedecin = (appt, medecinId) => {
      if (!medecinId || !appt) return true; // Si pas de médecin sélectionné, on accepte tous
      const medecinField = appt?.medecin || appt?.doctor;
      if (typeof medecinField === 'string') {
        const id = medecinField.includes('/') ? medecinField.split('/').pop() : medecinField;
        return id === medecinId;
      }
      if (typeof medecinField === 'object' && medecinField) {
        return medecinField.id === medecinId;
      }
      // Fallback : chercher dans le cache
      return medecinsById[medecinId] && (
        medecinsById[medecinId].id === medecinId ||
        medecinsById[medecinId]['@id']?.includes(medecinId)
      );
    };

    try {
      setLoading(true);
      // Construire les filtres pour l'API
      // IMPORTANT : Ne pas envoyer dateDebut/dateFin si undefined pour voir TOUS les rendez-vous
      const hasDateFilter = filters.dateDebut !== undefined || filters.dateFin !== undefined;
      
      const apiFilters = {
        statut: filters.statut || [],
        medecin: selectedMedecinId || filters.medecin,
        patientId: filters.patientId,
        page: filters.page || 1,
        limit: filters.limit || 200, // Augmenter la limite pour récupérer plus de rendez-vous
        skipAutoFilter: filters.skipAutoFilter,
        useHistoryEndpoint: filters.useHistoryEndpoint,
        // IMPORTANT : Supprimer explicitement les dates si on veut voir TOUS les rendez-vous
        ...(hasDateFilter ? {
          dateDebut: filters.dateDebut,
          dateFin: filters.dateFin,
          includePast: true, // Inclure les rendez-vous passés si un filtre de date est défini
        } : {
          // Si pas de filtre de date, ne PAS inclure dateDebut/dateFin dans les paramètres
          // Cela garantit que l'API retourne TOUS les rendez-vous
        }),
      };
      
      // Utiliser la même méthode que le dashboard pour avoir tous les RDV d'aujourd'hui
      // Si pas de filtre de date, utiliser getFutureAppointments avec la date d'aujourd'hui
      // pour inclure tous les rendez-vous d'aujourd'hui (même passés)
      let data;
      if (!hasDateFilter) {
        const today = new Date().toISOString().slice(0, 10);
        // OPTIMISATION: Utiliser getFutureAppointments qui est plus optimisé
        data = await appointmentService.getFutureAppointments({ date: today });
      } else {
        // Si un filtre de date est défini, utiliser getAppointments (sans slash final)
        data = await appointmentService.getAppointments(apiFilters);
      }
      let list = Array.isArray(data) ? data : [];
      
      // Pour les stagiaires : filtrer uniquement leurs propres créations
      if (!isFormateur && !isAdmin && currentUserId && currentUserIri) {
        list = list.filter(appt => {
          const creator = appt.createdBy || appt.created_by || appt.creePar || appt.user || null;
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
        });
      }
      
      // Filtrer par médecin côté client aussi (pour être sûr)
      if (selectedMedecinId) {
        list = list.filter(appt => belongsToMedecin(appt, selectedMedecinId));
      }
      
      // Appliquer les filtres côté client également (pour garantir la cohérence)
      // Filtrage par statut
      if (filters.statut && filters.statut.length > 0) {
        list = list.filter(appt => filters.statut.includes(appt.statut));
      }
      
      // Filtrage par patient
      if (filters.patientId) {
        list = list.filter(appt => {
          const patientId = appt.patient?.id || appt.patient_id;
          return String(patientId) === String(filters.patientId);
        });
      }
      
      // Filtrage par dates
      if (filters.dateDebut) {
        const dateDebut = new Date(filters.dateDebut);
        dateDebut.setHours(0, 0, 0, 0);
        list = list.filter(appt => {
          const apptDate = new Date(appt.startAt || appt.start_at || appt.dateTime);
          apptDate.setHours(0, 0, 0, 0);
          return apptDate >= dateDebut;
        });
      }
      
      if (filters.dateFin) {
        const dateFin = new Date(filters.dateFin);
        dateFin.setHours(23, 59, 59, 999);
        list = list.filter(appt => {
          const apptDate = new Date(appt.startAt || appt.start_at || appt.dateTime);
          return apptDate <= dateFin;
        });
      }
      
      // Tri du plus ancien au plus récent (ASC)
      list.sort((a, b) => new Date(a.startAt || a.start_at || a.dateTime || 0) - new Date(b.startAt || b.start_at || b.dateTime || 0));
      setAppointments(list);
      
      // Calculer les stats depuis la liste filtrée (pour prendre en compte le filtre médecin)
      // Si un médecin est sélectionné, on calcule toujours depuis la liste filtrée
      // Sinon, on peut utiliser statusAgg si disponible (mais toujours recalculer depuis la liste pour cohérence)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayList = list.filter(a => {
        const apptDate = new Date(a.startAt || a.start_at || a.dateTime);
        apptDate.setHours(0, 0, 0, 0);
        return apptDate.getTime() === today.getTime();
      });
      
      // Calculer toutes les stats depuis la liste filtrée pour garantir la cohérence avec le filtre médecin
      setStats({
        total: todayList.length, // Total des RDV d'aujourd'hui (filtrés par médecin si sélectionné)
        confirmes: list.filter(a => a.statut === 'CONFIRME').length, // Tous les confirmés (filtrés par médecin si sélectionné)
        planifies: list.filter(a => a.statut === 'PLANIFIE').length, // Tous les planifiés (filtrés par médecin si sélectionné)
        annules: list.filter(a => a.statut === 'ANNULE').length, // Tous les annulés (filtrés par médecin si sélectionné)
        termines: list.filter(a => a.statut === 'TERMINE').length, // Tous les terminés (filtrés par médecin si sélectionné)
        absents: list.filter(a => a.statut === 'ABSENT').length, // Tous les absents (filtrés par médecin si sélectionné)
      });
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [filters, selectedMedecinId, medecinsById]);

  // Charger référentiels avec gestion d'erreur améliorée
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // OPTIMISATION: Charger en parallèle avec timeout individuel et gestion d'erreur silencieuse
        const [p, m] = await Promise.allSettled([
          // Utiliser l'endpoint optimisé /patients-all pour récupérer les patients du stagiaire
          patientService.getStagiairePatients(1, 200, {}).catch(() => []),
          medecinService.getAllMedecins(true) // silent = true pour éviter les logs répétés
        ]);
        
        if (!cancelled) {
          setPatients(Array.isArray(p.value) ? p.value : []);
          setMedecins(Array.isArray(m.value) ? m.value : []);
        }
      } catch (error) {
        // Erreur silencieuse - les données seront vides mais la page s'affichera
        if (!cancelled) {
          setPatients([]);
          setMedecins([]);
        }
      }
    })();
    
    return () => {
      cancelled = true;
    };
  }, []);


  // Charger RDV créés par des stagiaires (vue formateur) - Récupérer toutes les pages
  useEffect(() => {
    if (!isFormateur) return;
    (async () => {
      try {
        setTrainerLoading(true);
        let allAppointments = [];
        let currentPage = 1;
        let hasMore = true;
        
        // Récupérer toutes les pages depuis l'endpoint principal
        while (hasMore) {
          const result = await appointmentService.getFormateurAppointments(currentPage, 100);
          const list = Array.isArray(result.data) ? result.data : [];
          const pagination = result.pagination;
          
          if (list.length > 0) {
            allAppointments = [...allAppointments, ...list];
            
            // Utiliser les informations de pagination si disponibles
            if (pagination) {
              const totalPages = pagination.total_pages || Math.ceil((pagination.total || 0) / (pagination.per_page || 100));
              if (currentPage >= totalPages) {
                hasMore = false;
              } else {
                currentPage++;
              }
            } else {
              // Fallback : si on a moins de 100 résultats, on a récupéré toutes les pages
              if (list.length < 100) {
                hasMore = false;
              } else {
                currentPage++;
              }
            }
          } else {
            hasMore = false;
          }
        }
        
        // Trier par date (plus ancien au plus récent pour les rendez-vous à venir)
        allAppointments.sort((a, b) => new Date(a.startAt || a.start_at || a.dateTime || 0) - new Date(b.startAt || b.start_at || b.dateTime || 0));
        setTrainerAppointments(allAppointments);
      } finally {
        setTrainerLoading(false);
      }
    })();
  }, [isFormateur]);

  // Charger les rendez-vous passés via l'endpoint dédié
  const loadPastAppointments = useCallback(async (page = 1) => {
    if (!isFormateur) return;
    try {
      setPastAppointmentsLoading(true);
      const result = await appointmentService.getPastAppointments({
        page,
        per_page: PAST_PER_PAGE
      });
      const data = Array.isArray(result.data) ? result.data : [];
      setPastAppointments(data);
      setPastAppointmentsTotal(result.pagination?.total || data.length);
      setPastAppointmentsShowingFrom(result.pagination?.showing_from || 0);
      setPastAppointmentsShowingTo(result.pagination?.showing_to || 0);
    } catch (error) {
      setPastAppointments([]);
      setPastAppointmentsTotal(0);
      setPastAppointmentsShowingFrom(0);
      setPastAppointmentsShowingTo(0);
    } finally {
      setPastAppointmentsLoading(false);
    }
  }, [isFormateur]);

  // Charger les rendez-vous passés au montage et quand la page change
  useEffect(() => {
    if (isFormateur && trainerFilter === 'passes') {
      loadPastAppointments(pastAppointmentsPage);
    }
  }, [isFormateur, trainerFilter, pastAppointmentsPage, loadPastAppointments]);

  // Fonction de suppression simple
  const handleDeleteAppointment = useCallback(async (rdvId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce rendez-vous ?')) {
      return;
    }
    try {
      setIsDeleting(true);
      await appointmentService.deleteAppointment(rdvId);
      // Recharger les données
      if (isFormateur) {
        if (trainerFilter === 'passes') {
          await loadPastAppointments(pastAppointmentsPage);
        } else {
          // Recharger les rendez-vous à venir (toutes les pages)
          const loadTrainerAppointments = async () => {
            setTrainerLoading(true);
            try {
              let allAppointments = [];
              let currentPage = 1;
              let hasMore = true;
              
              while (hasMore) {
                const result = await appointmentService.getFormateurAppointments(currentPage, 100);
                const list = Array.isArray(result.data) ? result.data : [];
                const pagination = result.pagination;
                
                if (list.length > 0) {
                  allAppointments = [...allAppointments, ...list];
                  
                  if (pagination) {
                    const totalPages = pagination.total_pages || Math.ceil((pagination.total || 0) / (pagination.per_page || 100));
                    if (currentPage >= totalPages) {
                      hasMore = false;
                    } else {
                      currentPage++;
                    }
                  } else {
                    if (list.length < 100) {
                      hasMore = false;
                    } else {
                      currentPage++;
                    }
                  }
                } else {
                  hasMore = false;
                }
              }
              
              allAppointments.sort((a, b) => new Date(a.startAt || a.start_at || a.dateTime || 0) - new Date(b.startAt || b.start_at || b.dateTime || 0));
              setTrainerAppointments(allAppointments);
            } catch (err) {
              // Erreur silencieuse lors du rechargement
            } finally {
              setTrainerLoading(false);
            }
          };
          await loadTrainerAppointments();
        }
      } else {
        await loadAppointments();
      }
      alert('Rendez-vous supprimé avec succès');
    } catch (error) {
      alert('Erreur lors de la suppression du rendez-vous');
    } finally {
      setIsDeleting(false);
    }
  }, [isFormateur, trainerFilter, pastAppointmentsPage, loadPastAppointments]);

  // Fonction de suppression multiple (uniquement pour formateurs)
  const handleBulkDelete = useCallback(async () => {
    if (selectedAppointments.size === 0) {
      alert('Veuillez sélectionner au moins un rendez-vous à supprimer');
      return;
    }
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer ${selectedAppointments.size} rendez-vous(s) ?`)) {
      return;
    }
    try {
      setIsDeleting(true);
      const ids = Array.from(selectedAppointments);
      const result = await appointmentService.bulkDeleteAppointments(ids);
      
      // Afficher le résultat
      let message = result.message || `${result.deleted_count} rendez-vous supprimé(s)`;
      if (result.skipped_count > 0) {
        message += `, ${result.skipped_count} ignoré(s)`;
      }
      if (result.errors && result.errors.length > 0) {
        message += '\n\nErreurs:\n' + result.errors.join('\n');
      }
      alert(message);
      
      // Réinitialiser la sélection
      setSelectedAppointments(new Set());
      
      // Recharger les données
      if (trainerFilter === 'passes') {
        await loadPastAppointments(pastAppointmentsPage);
      } else {
        const loadTrainerAppointments = async () => {
          setTrainerLoading(true);
          try {
            let allAppointments = [];
            let currentPage = 1;
            let hasMore = true;
            
            while (hasMore) {
              const result = await appointmentService.getFormateurAppointments(currentPage, 100);
              const list = Array.isArray(result.data) ? result.data : [];
              const pagination = result.pagination;
              
              if (list.length > 0) {
                allAppointments = [...allAppointments, ...list];
                
                if (pagination) {
                  const totalPages = pagination.total_pages || Math.ceil((pagination.total || 0) / (pagination.per_page || 100));
                  if (currentPage >= totalPages) {
                    hasMore = false;
                  } else {
                    currentPage++;
                  }
                } else {
                  if (list.length < 100) {
                    hasMore = false;
                  } else {
                    currentPage++;
                  }
                }
              } else {
                hasMore = false;
              }
            }
            
            allAppointments.sort((a, b) => new Date(a.startAt || a.start_at || a.dateTime || 0) - new Date(b.startAt || b.start_at || b.dateTime || 0));
            setTrainerAppointments(allAppointments);
          } catch (err) {
            // Erreur silencieuse lors du rechargement
          } finally {
            setTrainerLoading(false);
          }
        };
        await loadTrainerAppointments();
      }
    } catch (error) {
      if (error.response?.status === 403) {
        alert('Accès refusé : vous n\'avez pas les permissions pour supprimer plusieurs rendez-vous');
      } else {
        alert('Erreur lors de la suppression multiple');
      }
    } finally {
      setIsDeleting(false);
    }
  }, [selectedAppointments, trainerFilter, pastAppointmentsPage, loadPastAppointments]);

  // Gérer la sélection/désélection d'un rendez-vous
  const toggleAppointmentSelection = useCallback((rdvId) => {
    setSelectedAppointments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rdvId)) {
        newSet.delete(rdvId);
      } else {
        newSet.add(rdvId);
      }
      return newSet;
    });
  }, []);

  // Sélectionner/désélectionner tous les rendez-vous de la page (sera défini dans le scope formateur)

  // Charger les médecins manquants depuis trainerAppointments (pour le formateur)
  useEffect(() => {
    if (!isFormateur || !trainerAppointments.length) return;
    const missingIds = new Set();
    for (const appt of trainerAppointments || []) {
      const m = appt?.medecin || appt?.doctor;
      if (typeof m === 'string') {
        const iri = m;
        const id = iri.includes('/') ? iri.split('/').pop() : iri;
        if (id && !medecinsById[id]) missingIds.add(id);
      } else if (m && typeof m === 'object' && m.id && !medecinsById[m.id]) {
        // Si c'est un objet avec un ID mais pas encore dans le cache
        missingIds.add(m.id);
      }
    }
    if (missingIds.size === 0) return;
    (async () => {
      try {
        const loaded = [];
        for (const id of Array.from(missingIds)) {
          try {
            const one = await medecinService.getOneMedecin(id);
            if (one) loaded.push(one);
          } catch {}
        }
        if (loaded.length) {
          setMedecins(prev => {
            const byId = new Set((prev || []).map(p => p.id));
            const merged = [...prev];
            for (const m of loaded) {
              if (!byId.has(m.id)) { merged.push(m); byId.add(m.id); }
            }
            return merged;
          });
        }
      } catch {}
    })();
  }, [trainerAppointments, medecinsById, isFormateur]);

  // Charger les médecins manquants depuis pastAppointments (pour le formateur)
  useEffect(() => {
    if (!isFormateur || !pastAppointments.length) return;
    const missingIds = new Set();
    for (const appt of pastAppointments || []) {
      const m = appt?.medecin || appt?.doctor;
      if (typeof m === 'string') {
        const iri = m;
        const id = iri.includes('/') ? iri.split('/').pop() : iri;
        if (id && !medecinsById[id]) missingIds.add(id);
      } else if (m && typeof m === 'object' && m.id && !medecinsById[m.id]) {
        missingIds.add(m.id);
      }
    }
    if (missingIds.size === 0) return;
    (async () => {
      try {
        const loaded = [];
        for (const id of Array.from(missingIds)) {
          try {
            const one = await medecinService.getOneMedecin(id);
            if (one) loaded.push(one);
          } catch {}
        }
        if (loaded.length) {
          setMedecins(prev => {
            const byId = new Set((prev || []).map(p => p.id));
            const merged = [...prev];
            for (const m of loaded) {
              if (!byId.has(m.id)) { merged.push(m); byId.add(m.id); }
            }
            return merged;
          });
        }
      } catch {}
    })();
  }, [pastAppointments, medecinsById, isFormateur]);


  // Recharger quand les filtres changent
  // Ne pas inclure loadAppointments dans les dépendances pour éviter les boucles
  // loadAppointments est déjà mémorisé avec useCallback et ses dépendances
  useEffect(() => {
    loadAppointments();
    // Réinitialiser la pagination quand les filtres changent
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, selectedMedecinId]);

  // Pré-remplir le médecin sélectionné lors de l'ouverture du modal de création
  useEffect(() => {
    if (!showCreate || !selectedMedecinId) return;
      setNewAppt(prev => {
        if (prev.medecin === selectedMedecinId) return prev;
        return { ...prev, medecin: selectedMedecinId };
      });
  }, [showCreate, selectedMedecinId]);

  // Génère les 6 semaines affichées (42 cases), en commençant lundi
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const start = new Date(firstDay);
    const offset = dayIndexMondayFirst(firstDay);
    start.setDate(1 - offset);
    const days = [];
    const cursor = new Date(start);
    for (let i = 0; i < 42; i++) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }, [currentMonth]);

  // Créneaux demi-heure
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = HOURS_START; hour < HOURS_END; hour++) {
      for (let minute = 0; minute < 60; minute += SLOT_MINUTES) {
        const start = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
        const endMinutesTotal = hour * 60 + minute + SLOT_MINUTES;
        const endH = Math.floor(endMinutesTotal / 60);
        const endM = endMinutesTotal % 60;
        const end = `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`;
        slots.push({ start, end });
      }
    }
    return slots;
  }, []);

  // Utiliser les utilitaires centralisés pour les statuts
  const getPlanningClasses = (statut) => {
    const config = getAppointmentStatusClasses(statut);
    return { box: config.box, badge: config.badge, border: config.border };
  };

  const getListBg = (statut) => {
    return getAppointmentStatusClasses(statut).listBg;
  };

  const getStatusBadgeClasses = (statut) => {
    return getAppointmentStatusClasses(statut).badge;
  };

  // Utiliser l'utilitaire centralisé
  const getDoctorName = (appt) => getDoctorNameFromAppointment(appt, medecinsById);

  // RDV filtrés sur la journée sélectionnée
  const dayAppointments = useMemo(() => {
    const day = selectedDate;
    return (appointments || [])
      .filter(r => r?.statut !== 'ANNULE')
      .filter(r => {
        const d = new Date(r.startAt || r.start_at || r.appointmentTime || r.startTime || r.dateTime);
        return !isNaN(d) && sameDay(d, day);
      });
  }, [appointments, selectedDate]);

  // Indexation des RDV par créneau (HH:mm)
  const appointmentsBySlot = useMemo(() => {
    const map = new Map();
    timeSlots.forEach(slot => map.set(slot.start, []));
    for (const appt of dayAppointments) {
      const dateFields = [appt.startAt, appt.start_at, appt.appointmentTime, appt.startTime, appt.dateTime];
      let key = '';
      for (const field of dateFields) {
        if (!field) continue;
        const hhmm = extractHHmm(field);
        if (hhmm) { key = hhmm; break; }
      }
      if (key && map.has(key)) map.get(key).push(appt);
    }
    return map;
  }, [dayAppointments, timeSlots]);

  // Utiliser l'utilitaire centralisé
  const getApptDurationMinutes = (appt) => getAppointmentDuration(appt);

  const occupiedContinuationSlots = useMemo(() => {
    const occupied = new Set();
    const slotIndexByStart = new Map(timeSlots.map((s, idx) => [s.start, idx]));
    for (const appt of dayAppointments) {
      const dateFields = [appt.startAt, appt.start_at, appt.appointmentTime, appt.startTime, appt.dateTime];
      let startKey = '';
      for (const field of dateFields) {
        if (!field) continue;
        const hhmm = extractHHmm(field);
        if (hhmm) { startKey = hhmm; break; }
      }
      if (!startKey) continue;
      const startIdx = slotIndexByStart.get(startKey);
      if (startIdx === undefined) continue;
      const dureeMin = getApptDurationMinutes(appt);
      const slotsToCover = Math.ceil(dureeMin / SLOT_MINUTES);
      for (let i = 1; i < slotsToCover; i++) {
        const nextIdx = startIdx + i;
        if (nextIdx < timeSlots.length) {
          occupied.add(timeSlots[nextIdx].start);
        }
      }
    }
    return occupied;
  }, [dayAppointments, timeSlots]);

  // Vue exclusive pour FORMATEUR: afficher uniquement la liste des RDV créés par des stagiaires
  if (isFormateur) {
    // Séparer les rendez-vous en passés et à venir
    const now = new Date();
    const upcomingAppointments = trainerAppointments.filter(rdv => {
      const rdvDate = new Date(rdv.startAt || rdv.start_at || rdv.dateTime || 0);
      return rdvDate >= now;
    });
    
    // Pour les rendez-vous passés, utiliser ceux chargés via l'endpoint /passes
    // Pour les rendez-vous à venir, utiliser ceux chargés via l'endpoint principal
    // Filtrer selon le filtre sélectionné
    let filteredAppointments = [];
    let totalPages = 1;
    let paginatedAppointments = [];
    
    if (trainerFilter === 'a_venir') {
      filteredAppointments = upcomingAppointments;
      totalPages = Math.ceil(filteredAppointments.length / TRAINER_PER_PAGE);
      const startIndex = (trainerCurrentPage - 1) * TRAINER_PER_PAGE;
      const endIndex = startIndex + TRAINER_PER_PAGE;
      paginatedAppointments = filteredAppointments.slice(startIndex, endIndex);
    } else {
      // trainerFilter === 'passes'
      // Utiliser les rendez-vous passés chargés via l'endpoint /passes
      filteredAppointments = pastAppointments;
      // Pour les rendez-vous passés, on utilise la pagination serveur
      // Calculer le nombre total de pages à partir du total et de la taille de page
      totalPages = pastAppointmentsTotal > 0 
        ? Math.ceil(pastAppointmentsTotal / PAST_PER_PAGE)
        : 1;
      paginatedAppointments = filteredAppointments; // Déjà paginés côté serveur
    }

    // Sélectionner/désélectionner tous les rendez-vous de la page
    const toggleSelectAll = () => {
      const allIds = paginatedAppointments.map(rdv => rdv.id).filter(Boolean);
      if (selectedAppointments.size === paginatedAppointments.length && 
          allIds.every(id => selectedAppointments.has(id))) {
        setSelectedAppointments(new Set());
      } else {
        setSelectedAppointments(new Set(allIds));
      }
    };
    
    return (
      <div className="min-h-screen w-[95%] md:w-[90%] lg:w-[80%] mx-auto px-2 md:px-4 py-6">
        <div className="text-center py-6">
          <div className="bg-pink-200 rounded-lg shadow p-6 max-w-2xl mx-auto">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center shadow-sm">
                <svg className="w-8 h-8 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-pink-800">Rendez-Vous</h1>
            </div>
            <p className="text-pink-700 text-sm">RDV créés par les stagiaires</p>
          </div>
        </div>

        {/* Boutons de filtre */}
        <div className="mb-6 flex justify-center gap-3 flex-wrap">
          <button
            onClick={() => {
              setTrainerFilter('a_venir');
              setTrainerCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 ${
              trainerFilter === 'a_venir'
                ? 'bg-green-600 text-white shadow-md'
                : 'bg-white text-green-700 hover:bg-green-50 border border-green-300'
            }`}
          >
            <span className="material-symbols-rounded text-2xl">schedule</span>
            À venir ({upcomingAppointments.length})
          </button>
          <button
            onClick={() => {
              setTrainerFilter('passes');
              setTrainerCurrentPage(1);
              setPastAppointmentsPage(1);
            }}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 ${
              trainerFilter === 'passes'
                ? 'bg-gray-600 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
            }`}
          >
            <span className="material-symbols-rounded text-2xl">history</span>
            Passés ({pastAppointmentsTotal || pastAppointments.length})
          </button>
        </div>

        <div className="bg-pink-200 rounded-lg shadow">
          <div className="px-6 py-4 border-b-2 border-pink-300 bg-pink-50 flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-2xl font-semibold text-pink-800 flex items-center gap-2 m-0">
              <span className="material-symbols-rounded text-pink-600">assignment_ind</span>
              Liste des rendez-vous
              <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-pink-100 text-pink-800 border border-pink-300">
                {trainerFilter === 'passes' 
                  ? (pastAppointmentsShowingFrom && pastAppointmentsShowingTo
                      ? `${pastAppointmentsShowingFrom}-${pastAppointmentsShowingTo} sur ${pastAppointmentsTotal || pastAppointments.length}`
                      : (() => {
                          const showingFrom = (pastAppointmentsPage - 1) * PAST_PER_PAGE + 1;
                          const showingTo = Math.min(pastAppointmentsPage * PAST_PER_PAGE, pastAppointmentsTotal || pastAppointments.length);
                          return `${showingFrom}-${showingTo} sur ${pastAppointmentsTotal || pastAppointments.length}`;
                        })())
                  : (() => {
                      const showingFrom = (trainerCurrentPage - 1) * TRAINER_PER_PAGE + 1;
                      const showingTo = Math.min(trainerCurrentPage * TRAINER_PER_PAGE, upcomingAppointments.length);
                      return `${showingFrom}-${showingTo} sur ${upcomingAppointments.length}`;
                    })()
                }
              </span>
            </h3>
          </div>

          <div className="p-6">
            {(trainerLoading || (trainerFilter === 'passes' && pastAppointmentsLoading)) ? (
              <div className="text-center py-6 text-pink-700">Chargement…</div>
            ) : filteredAppointments.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                {trainerFilter === 'a_venir' && 'Aucun rendez-vous à venir'}
                {trainerFilter === 'passes' && 'Aucun rendez-vous passé'}
              </div>
            ) : (
              <>
                {/* Bouton de suppression multiple (uniquement pour formateurs) */}
                {isFormateur && selectedAppointments.size > 0 && (
                  <div className="mb-4 flex items-center justify-between bg-red-50 border border-red-200 rounded-lg p-3">
                    <span className="text-sm text-red-700 font-medium">
                      {selectedAppointments.size} rendez-vous sélectionné(s)
                    </span>
                    <button
                      onClick={handleBulkDelete}
                      disabled={isDeleting}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <span className="material-symbols-rounded text-2xl">delete</span>
                      Supprimer {selectedAppointments.size} rendez-vous
                    </button>
                  </div>
                )}

                <div className="w-full">
                  <table className="w-full table-auto">
                    <thead className="bg-pink-100">
                      <tr>
                        {isFormateur && (
                          <th className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={paginatedAppointments.length > 0 && selectedAppointments.size === paginatedAppointments.length}
                              onChange={toggleSelectAll}
                              className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
                            />
                          </th>
                        )}
                        <th className={`${isFormateur ? 'px-3' : 'px-4'} py-3 text-center text-xs font-medium text-pink-700 uppercase tracking-wider w-24`}>Date</th>
                        <th className={`${isFormateur ? 'px-3' : 'px-4'} py-3 text-center text-xs font-medium text-pink-700 uppercase tracking-wider w-20`}>Heure</th>
                        <th className={`${isFormateur ? 'px-3' : 'px-4'} py-3 text-center text-xs font-bold text-pink-700 uppercase tracking-wider`}>Patient</th>
                        <th className={`${isFormateur ? 'px-3' : 'px-4'} py-3 text-center text-xs font-medium text-pink-700 uppercase tracking-wider`}>Médecin</th>
                        <th className={`${isFormateur ? 'px-3' : 'px-4'} py-3 text-center text-xs font-medium text-pink-700 uppercase tracking-wider`}>Motif</th>
                        <th className={`${isFormateur ? 'px-3' : 'px-4'} py-3 text-center text-xs font-medium text-pink-700 uppercase tracking-wider w-28`}>Statut</th>
                        <th className={`${isFormateur ? 'px-3' : 'px-4'} py-3 text-center text-xs font-medium text-pink-700 uppercase tracking-wider`}>Créé par</th>
                        <th className={`${isFormateur ? 'px-3' : 'px-4'} py-3 text-center text-xs font-medium text-pink-700 uppercase tracking-wider w-32`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-pink-200">
                      {paginatedAppointments.map((rdv, index) => {
                      
                      const d = new Date(rdv.startAt || rdv.start_at || rdv.appointmentTime || rdv.startTime || rdv.dateTime);
                      const dateStr = !isNaN(d) ? d.toLocaleDateString('fr-FR') : '—';
                      const timeStr = !isNaN(d) ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
                      const patient = rdv.patient || {};
                      const statut = rdv.statut || rdv.status || 'PLANIFIE';
                      // Utiliser la fonction centralisée pour obtenir le nom du médecin
                      const doctorName = getDoctorNameFromAppointment(rdv, medecinsById) || '—';
                      // Lecture prioritaire de l'endpoint formateur (objet complet)
                      const creatorObject = (rdv && typeof rdv.created_by === 'object') ? rdv.created_by : null;
                      const creatorRaw = creatorObject || rdv.created_by || rdv.createdBy || rdv.created_by_id || rdv.createdById || rdv.user_id || rdv.user || rdv.creePar || null;
                      let creatorName = '—';
                      if (creatorObject) {
                        const fn = creatorObject.prenom || creatorObject.firstName || '';
                        const ln = creatorObject.nom || creatorObject.lastName || '';
                        const email = creatorObject.email || '';
                        const name = `${fn} ${ln}`.trim();
                        creatorName = name || email || '—';
                      } else if (creatorRaw) {
                        if (typeof creatorRaw === 'string') {
                          const fallbackName = rdv.created_by_name || rdv.createdByName || '';
                          const fallbackEmail = rdv.created_by_email || rdv.createdByEmail || '';
                          const id = creatorRaw.includes('/') ? creatorRaw.split('/').pop() : creatorRaw;
                          const inMap = id ? creatorMap[id] : undefined;
                          const mapName = inMap ? `${inMap.prenom || ''} ${inMap.nom || ''}`.trim() || inMap.email : '';
                          creatorName = mapName || fallbackName || fallbackEmail || id || '—';
                          
                        } else if (typeof creatorRaw === 'number') {
                          const id = String(creatorRaw);
                          const inMap = creatorMap[id];
                          const mapName = inMap ? `${inMap.prenom || ''} ${inMap.nom || ''}`.trim() || inMap.email : '';
                          creatorName = mapName || id || '—';
                          
                        } else {
                          const fn = creatorRaw.prenom || creatorRaw.firstName || '';
                          const ln = creatorRaw.nom || creatorRaw.lastName || '';
                          const email = creatorRaw.email || '';
                          const name = `${fn} ${ln}`.trim();
                          creatorName = name || email || '—';
                          
                        }
                      }
                      if (creatorName === '—') {
                        const extra = creatorLabelByRdv[rdv.id];
                        if (extra) creatorName = extra;
                      }
                      return (
                        <tr key={rdv.id || index} className="hover:bg-pink-50">
                          {isFormateur && (
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              <input
                                type="checkbox"
                                checked={selectedAppointments.has(rdv.id)}
                                onChange={() => toggleAppointmentSelection(rdv.id)}
                                className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
                              />
                            </td>
                          )}
                          <td className={`${isFormateur ? 'px-3' : 'px-4'} py-3 whitespace-nowrap text-sm text-gray-900 text-center`}>{dateStr}</td>
                          <td className={`${isFormateur ? 'px-3' : 'px-4'} py-3 whitespace-nowrap text-sm text-gray-900 text-center`}>{timeStr}</td>
                          <td className={`${isFormateur ? 'px-3' : 'px-4'} py-3 text-sm text-gray-900 text-center break-words`}>
                            <div className="flex items-center justify-center gap-1">
                              <PatientName patient={patient} />
                              {hasUrgenceMedecin(rdv) && (
                                <span className="material-symbols-rounded text-red-600 text-2xl" title="Urgence médecin">emergency</span>
                              )}
                            </div>
                          </td>
                          <td className={`${isFormateur ? 'px-3' : 'px-4'} py-3 text-sm text-gray-900 text-center break-words`}>{doctorName}</td>
                          <td className={`${isFormateur ? 'px-3' : 'px-4'} py-3 text-sm text-gray-900 text-center break-words`}>{rdv.motif || '—'}</td>
                          <td className={`${isFormateur ? 'px-3' : 'px-4'} py-3 whitespace-nowrap text-sm text-gray-900 text-center`}>{statut}</td>
                          <td className={`${isFormateur ? 'px-3' : 'px-4'} py-3 text-sm text-gray-900 text-center break-words`}>{creatorName}</td>
                          <td className={`${isFormateur ? 'px-3' : 'px-6'} py-3 whitespace-nowrap text-sm text-center`}>
                            {(isFormateur || isAdmin) && (
                              <button
                                onClick={() => handleDeleteAppointment(rdv.id)}
                                disabled={isDeleting}
                                className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-1 mx-auto"
                                title="Supprimer ce rendez-vous"
                              >
                                <span className="material-symbols-rounded text-sm">delete</span>
                                Supprimer
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-6 flex items-center justify-between border-t border-pink-300 pt-4">
                    <div className="text-sm text-gray-700">
                      {trainerFilter === 'passes' ? (
                        (() => {
                          const showingFrom = pastAppointmentsShowingFrom || (pastAppointmentsPage - 1) * PAST_PER_PAGE + 1;
                          const showingTo = pastAppointmentsShowingTo || Math.min(pastAppointmentsPage * PAST_PER_PAGE, pastAppointmentsTotal || pastAppointments.length);
                          const total = pastAppointmentsTotal || pastAppointments.length;
                          return <>Affichage de la page {pastAppointmentsPage} sur {totalPages} ({showingFrom}-{showingTo} sur {total})</>;
                        })()
                      ) : (
                        (() => {
                          const showingFrom = (trainerCurrentPage - 1) * TRAINER_PER_PAGE + 1;
                          const showingTo = Math.min(trainerCurrentPage * TRAINER_PER_PAGE, filteredAppointments.length);
                          return <>Affichage de {showingFrom} à {showingTo} sur {filteredAppointments.length} rendez-vous</>;
                        })()
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (trainerFilter === 'passes') {
                            const newPage = Math.max(1, pastAppointmentsPage - 1);
                            setPastAppointmentsPage(newPage);
                          } else {
                            setTrainerCurrentPage(prev => Math.max(1, prev - 1));
                          }
                        }}
                        disabled={trainerFilter === 'passes' ? pastAppointmentsPage === 1 : trainerCurrentPage === 1}
                        className={`px-3 py-2 rounded-lg border transition-colors ${
                          (trainerFilter === 'passes' ? pastAppointmentsPage === 1 : trainerCurrentPage === 1)
                            ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                            : "bg-white hover:bg-pink-50 border-pink-300 text-pink-700"
                        }`}
                      >
                        <span className="material-symbols-rounded text-2xl">chevron_left</span>
                      </button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          const currentPage = trainerFilter === 'passes' ? pastAppointmentsPage : trainerCurrentPage;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          return (
                            <button
                              key={pageNum}
                              onClick={() => {
                                if (trainerFilter === 'passes') {
                                  setPastAppointmentsPage(pageNum);
                                } else {
                                  setTrainerCurrentPage(pageNum);
                                }
                              }}
                              className={`px-3 py-2 rounded-lg border transition-colors ${
                                currentPage === pageNum
                                  ? "bg-pink-600 text-white border-pink-700"
                                  : "bg-white hover:bg-pink-50 border-pink-300 text-pink-700"
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => {
                          if (trainerFilter === 'passes') {
                            const newPage = Math.min(totalPages, pastAppointmentsPage + 1);
                            setPastAppointmentsPage(newPage);
                          } else {
                            setTrainerCurrentPage(prev => Math.min(totalPages, prev + 1));
                          }
                        }}
                        disabled={trainerFilter === 'passes' ? pastAppointmentsPage === totalPages : trainerCurrentPage === totalPages}
                        className={`px-3 py-2 rounded-lg border transition-colors ${
                          (trainerFilter === 'passes' ? pastAppointmentsPage === totalPages : trainerCurrentPage === totalPages)
                            ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                            : "bg-white hover:bg-pink-50 border-pink-300 text-pink-700"
                        }`}
                      >
                        <span className="material-symbols-rounded text-2xl">chevron_right</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // (Chargement RDV patients retiré)

  // Utiliser l'utilitaire centralisé
  const formatRangeForAppointment = (appt) => formatAppointmentTimeRange(appt);


  const goToPreviousMonth = () => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const goToNextMonth = () => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1));

  // Actions RDV
  const handleAction = async (id, action) => {
    try {
      setLoading(true);
      const appt = (appointments || []).find(a => a.id === id);
      // Construit un payload minimal conforme à la validation backend
      let payload = undefined;
      if (appt) {
        const start = appt?.startAt || appt?.start_at;
        let d = null;
        if (typeof start === 'string' && start) {
          // Tente de parser "YYYY-MM-DD HH:mm:ss" ou ISO en LOCAL
          const s = start.replace('T', ' ');
          const m = s.match(/^(\d{4})-(\d{2})-(\d{2})\s(\d{2}):(\d{2})(?::(\d{2}))?/);
          if (m) {
            const [, y, mo, da, hh, mm, ss] = m;
            d = new Date(parseInt(y,10), parseInt(mo,10)-1, parseInt(da,10), parseInt(hh,10), parseInt(mm,10), ss?parseInt(ss,10):0, 0);
          } else {
            const tmp = new Date(start);
            if (!isNaN(tmp)) d = tmp;
          }
        }
        const startStr = d && !isNaN(d) ? formatDateTimeForApi(d) : undefined;
        const dureeMinutes = getApptDurationMinutes(appt);
        const endDate = d && dureeMinutes ? new Date(d.getTime() + dureeMinutes * 60000) : null;
        const endStr = endDate ? formatDateTimeForApi(endDate) : undefined;
        payload = {
          ...(startStr ? { start_at: startStr } : {}),
          ...(endStr ? { end_at: endStr } : {}),
          ...(dureeMinutes ? { dureeMinutes: dureeMinutes } : {}),
        };
      }

      if (action === 'CONFIRME') {
        await appointmentService.updateAppointment(id, { ...(payload || {}), statut: 'CONFIRME' });
      } else if (action === 'ANNULE') {
        try {
          await appointmentService.deleteAppointment(id);
        } catch (_) {
          await appointmentService.updateAppointment(id, { statut: 'ANNULE' });
        }
      } else if (action === 'ABSENT') {
        // garde l'endpoint dédié si dispo
        await appointmentService.markAsAbsent(id);
    } else {
        await appointmentService.updateAppointment(id, { ...(payload || {}), statut: action });
      }
      await loadAppointments();
    } catch (e) {
      setError("Erreur lors de l'action: " + (e?.message || ''));
    } finally {
      setLoading(false);
    }
  };

  // util: format ISO local without timezone: YYYY-MM-DDTHH:mm:ss
  const formatDateTimeForApi = (d) => {
    if (!d || isNaN(d)) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const HH = String(d.getHours()).padStart(2, '0');
    const MM = String(d.getMinutes()).padStart(2, '0');
    const SS = String(d.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${HH}:${MM}:${SS}`;
  };

  const isWithinWorkingHours = (start, end) => {
    if (!start || !end || isNaN(start) || isNaN(end)) return false;
    const day = start.getDay(); // 0=dim,6=sam
    if (day === 0 || day === 6) return false;
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();
    const minMinutes = 8 * 60;
    const maxMinutes = 18 * 60;
    return startMinutes >= minMinutes && endMinutes <= maxMinutes && end > start;
  };

  const createAppointment = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setCreateError('');
      // Construire la date en LOCAL pour éviter tout décalage de fuseau
      const [sy, sm, sd] = (newAppt.date || '').split('-').map(n => parseInt(n, 10));
      const [sh, smin] = (newAppt.heure || '00:00').split(':').map(n => parseInt(n, 10));
      const startDate = (Number.isFinite(sy) && Number.isFinite(sm) && Number.isFinite(sd))
        ? new Date(sy, (sm - 1), sd, sh || 0, smin || 0, 0, 0)
        : new Date();
      const endDate = new Date(startDate.getTime() + (parseInt(newAppt.duree || '30') * 60 * 1000));
      const startStr = formatDateTimeForApi(startDate);
      const endStr = formatDateTimeForApi(endDate);

      // Vérifications horaires (avant appel API)
      if (!isWithinWorkingHours(startDate, endDate)) {
        setCreateError('Créneau invalide: jours ouvrés 08:00–18:00, fin > début.');
        setLoading(false);
        return;
      }

      // Champs requis
      if (!newAppt.patient) {
        setCreateError('Le patient est requis');
        setLoading(false);
        return;
      }
      const selectedPatient = patients.find(p => getPatientId(p) === String(newAppt.patient));
      if (selectedPatient) {
        const info = getPatientStatusInfo(selectedPatient);
        if (info.isDeceased) {
          setCreateError('Ce patient est déclaré décédé. Impossible de créer un rendez-vous.');
          setLoading(false);
          return;
        }
      }
      if (!newAppt.date || !newAppt.heure) {
        setCreateError('Les dates de début et de fin doivent être définies');
        setLoading(false);
        return;
      }

      // Vérification de conflit avant création
      try {
        const { conflict, message } = await appointmentService.verifyConflict({
          patient_id: newAppt.patient || '',
          medecin_id: newAppt.medecin || selectedMedecinId || '',
          start_at: startStr,
          end_at: endStr,
        });
        if (conflict) {
          setCreateError('Le praticien a déjà un rendez-vous à cette heure');
          setLoading(false);
          return;
        }
      } catch (_) { /* noop: on tente quand même si endpoint indisponible */ }
      if (!newAppt.medecin) {
        setCreateError('Veuillez sélectionner un médecin.');
        setLoading(false);
        return;
      }
      const payload = {
        patient: newAppt.patient ? `/api/patients/${newAppt.patient}` : '',
        medecin: `/api/medecins/${newAppt.medecin}`,
        start_at: startStr,
        end_at: endStr, // fournir end_at pour respecter la règle (ou duree)
        motif: newAppt.motif,
        statut: 'PLANIFIE',
        duree: parseInt(newAppt.duree || '30'), // compatible avec "duree"
        notes: newAppt.urgenceMedecin 
          ? (newAppt.notes ? `${newAppt.notes} [URGENCE_MEDECIN]` : '[URGENCE_MEDECIN]')
          : newAppt.notes,
      };
      await appointmentService.createAppointment(payload);
      setShowCreate(false);
      setNewAppt({ patient: '', medecin: '', motif: '', date: '', heure: '', duree: '30', notes: '', urgenceMedecin: false });
      await loadAppointments();
    } catch (e) {
      const raw = e?.response?.data;
      const precise = raw?.error || raw?.message || raw?.detail || raw?.title || e?.message;
      const lower = (precise || '').toString().toLowerCase();
      if (e?.response?.status === 409 || lower.includes('déjà un rendez-vous') || lower.includes('praticien a déjà')) {
        setCreateError('Le praticien a déjà un rendez-vous à cette heure');
      } else if (lower.includes('invalid json')) {
        setCreateError('Invalid JSON');
      } else if (lower.includes('doit être après') || lower.includes('après la date de début')) {
        setCreateError('La date de fin doit être après la date de début');
      } else if (lower.includes('début et de fin doivent être définies')) {
        setCreateError('Les dates de début et de fin doivent être définies');
      } else if (lower.includes('heures d\'ouverture') || lower.includes('8h-18h')) {
        setCreateError("Le rendez-vous doit être dans les heures d'ouverture (8h-18h, lun-ven)");
      } else {
        setCreateError(precise || "Impossible de créer le rendez-vous. Vérifiez les champs.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Ouvrir la création pré-remplie à partir d'un RDV annulé
  const openReschedule = (appt) => {
    if (!appt) return;
    const reschedulePatientId = getPatientId(appt?.patient) || (typeof appt?.patient === 'string' ? appt.patient.split('/').pop() : undefined);
    const candidate = patients.find(p => getPatientId(p) === String(reschedulePatientId));
    const info = getPatientStatusInfo(candidate || appt?.patient);
    if (info.isDeceased) {
      setCreateError('Ce patient est déclaré décédé. Impossible de reprogrammer un rendez-vous.');
      return;
    }
    const start = appt?.startAt || appt?.start_at || appt?.appointmentTime || appt?.startTime || appt?.dateTime;
    const d = start ? new Date(start) : null;
    const date = d && !isNaN(d) ? d.toISOString().split('T')[0] : '';
    const heure = d && !isNaN(d) ? `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` : '';
    const duree = String(getApptDurationMinutes(appt));

    setNewAppt({
      patient: reschedulePatientId || '',
      medecin: appt?.medecin?.id || appt?.doctor?.id || '',
      motif: appt?.motif || '',
      date,
      heure,
      duree,
      notes: appt?.notes || ''
    });
    setShowCreate(true);
  };

  const openEdit = (appt) => {
    if (!appt) return;
    const start = appt?.startAt || appt?.start_at || appt?.appointmentTime || appt?.startTime || appt?.dateTime;
    const d = start ? new Date(start) : null;
    const date = d && !isNaN(d) ? d.toISOString().split('T')[0] : '';
    const heure = d && !isNaN(d) ? `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` : '';
    const notes = appt?.notes || '';
    const cleanNotes = notes.replace(/\[URGENCE_MEDECIN\]/g, '').trim();
    setEditAppt({
      patient: appt?.patient?.id || '',
      medecin: appt?.medecin?.id || appt?.doctor?.id || '',
      motif: appt?.motif || '',
      date,
      heure,
      duree: String(getApptDurationMinutes(appt)),
      notes: cleanNotes,
      urgenceMedecin: hasUrgenceMedecin(appt)
    });
    setEditApptId(appt.id);
    setEditError('');
    setShowEdit(true);
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editApptId) return;
    try {
      setLoading(true);
      setEditError('');
      const [ey, em, ed] = (editAppt.date || '').split('-').map(n => parseInt(n, 10));
      const [eh, emin] = (editAppt.heure || '00:00').split(':').map(n => parseInt(n, 10));
      const startDate = (Number.isFinite(ey) && Number.isFinite(em) && Number.isFinite(ed))
        ? new Date(ey, (em - 1), ed, eh || 0, emin || 0, 0, 0)
        : new Date();
      const endDate = new Date(startDate.getTime() + (parseInt(editAppt.duree || '30') * 60 * 1000));
      const startStr = formatDateTimeForApi(startDate);
      const endStr = formatDateTimeForApi(endDate);

      // Vérifications horaires (avant appel API)
      if (!isWithinWorkingHours(startDate, endDate)) {
        setEditError('Créneau invalide: jours ouvrés 08:00–18:00, fin > début.');
        setLoading(false);
        return;
      }

      // Champs requis
      if (!editAppt.patient) {
        setEditError('Le patient est requis');
        setLoading(false);
        return;
      }
      const selectedPatient = patients.find(p => getPatientId(p) === String(editAppt.patient));
      if (selectedPatient) {
        const info = getPatientStatusInfo(selectedPatient);
        if (info.isDeceased) {
          setEditError('Ce patient est déclaré décédé. Impossible de modifier le rendez-vous.');
          setLoading(false);
          return;
        }
      }

      // Vérification de conflit avant édition
      try {
        const { conflict } = await appointmentService.verifyConflict({
          patient_id: editAppt.patient || '',
          medecin_id: editAppt.medecin || selectedMedecinId || '',
          start_at: startStr,
          end_at: endStr,
          exclude_id: editApptId,
        });
        if (conflict) {
          setEditError('Le praticien a déjà un rendez-vous à cette heure');
      setLoading(false);
          return;
        }
      } catch (_) { /* noop */ }
      const payload = {
        patient: editAppt.patient ? `/api/patients/${editAppt.patient}` : undefined,
        medecin: editAppt.medecin ? `/api/medecins/${editAppt.medecin}` : undefined,
        start_at: startStr,
        end_at: endStr,
        motif: editAppt.motif,
        duree: parseInt(editAppt.duree || '30'),
        notes: (() => {
          // Retirer le tag [URGENCE_MEDECIN] s'il existe
          let cleanNotes = (editAppt.notes || '').replace(/\[URGENCE_MEDECIN\]/g, '').trim();
          // Ajouter le tag si la checkbox est cochée
          if (editAppt.urgenceMedecin) {
            cleanNotes = cleanNotes ? `${cleanNotes} [URGENCE_MEDECIN]` : '[URGENCE_MEDECIN]';
          }
          return cleanNotes;
        })(),
      };
      await appointmentService.updateAppointment(editApptId, payload);
      setShowEdit(false);
      await loadAppointments();
    } catch (e) {
      const raw = e?.response?.data;
      const backendMsgRaw = raw?.error || raw?.message || raw?.detail || raw?.title;
      const msg = (backendMsgRaw || e?.message || '').toString().toLowerCase();
      if (e?.response?.status === 409 || msg.includes('déjà un rendez-vous') || msg.includes('praticien a déjà')) {
        setEditError('Le praticien a déjà un rendez-vous à cette heure');
      } else if (msg.includes('invalid json')) {
        setEditError('Invalid JSON');
      } else if (msg.includes('doit être après') || msg.includes('après la date de début')) {
        setEditError('La date de fin doit être après la date de début');
      } else if (msg.includes('début et de fin doivent être définies')) {
        setEditError('Les dates de début et de fin doivent être définies');
      } else if (msg.includes("heures d'ouverture") || msg.includes('8h-18h')) {
        setEditError("Le rendez-vous doit être dans les heures d'ouverture (8h-18h, lun-ven)");
      } else {
        setEditError(backendMsgRaw || 'Impossible de modifier le rendez-vous.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Boutons rapides pour les filtres
  const quickFilters = [
    { label: 'Aujourd\'hui', action: () => {
      const today = new Date().toISOString().split('T')[0];
      setFilters(f => ({ ...f, dateDebut: today, dateFin: today }));
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
        dateFin: weekEnd.toISOString().split('T')[0]
      }));
    }},
    { label: 'Planifiés', action: () => {
      setFilters(f => ({ ...f, statut: ['PLANIFIE'] }));
    }},
    { label: 'Confirmés', action: () => {
      setFilters(f => ({ ...f, statut: ['CONFIRME'] }));
    }},
    { label: 'Absents', action: () => {
      setFilters(f => ({ ...f, statut: ['ABSENT'] }));
    }},
    { label: 'Tous', action: () => {
      setFilters(f => ({ 
        ...f, 
        statut: [], 
        medecin: undefined, 
        patientId: undefined,
        dateDebut: undefined,
        dateFin: undefined
      }));
    }}
  ];

  return (
    <div className="min-h-screen w-[95%] md:w-[90%] lg:w-[80%] mx-auto px-2 md:px-4 py-6">
      
      {/* Titre centré avec icône et description */}
      <div className="text-center py-6 mb-6">
        <div className="bg-pink-200 rounded-lg shadow p-6 max-w-xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center shadow-sm">
              <svg className="w-8 h-8 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-pink-800">Rendez-Vous</h1>
          </div>
          <p className="text-pink-700 text-sm">
            Gérez et planifiez vos rendez-vous médicaux
          </p>
        </div>
      </div>


        {/* Stats (même visuel que la page complète) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <StatCard
            icon="calendar"
            label="Total aujourd'hui"
            value={stats.total}
            color="blue"
          />
          <StatCard
            icon="clock"
            label="Planifiés"
            value={stats.planifies}
            color="blue"
          />
          <StatCard
            icon="check"
            label="Confirmés"
            value={stats.confirmes}
            color="green"
          />
          <StatCard
            icon="users"
            label="Absents"
            value={stats.absents}
            color="red"
          />
      </div>

      {/* Bouton de sélection médecin centré entre stats et calendrier */}
      <div className="flex justify-center mb-6">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowDoctorPicker(v => !v)}
            className="inline-flex flex-col items-center gap-1 px-4 py-2 rounded-full bg-pink-600 text-white text-2xl font-bold hover:bg-pink-700 shadow text-center"
          >
            <span className="inline-flex items-center gap-2">
              <span className="material-symbols-rounded text-sm">stethoscope</span>
              {selectedMedecinId ? 'Changer de médecin' : 'Choisir le médecin'}
            </span>
            {selectedMedecinId && (
              <span className="block text-sm md:text-2xl font-bold opacity-95 leading-tight">
                {(() => {
                  const m = medecins.find(x => x.id === selectedMedecinId);
                  if (!m) return '';
                  const lastUpper = (m.nom || '').toUpperCase();
                  const first = m.prenom || '';
                  const spec = m?.specialite?.label || m?.specialite?.nom || m?.specialite || m?.specialty?.name || m?.specialty || '';
                  return `Dr ${lastUpper} ${first}${spec ? ' — ' + spec : ''}`.trim();
                })()}
              </span>
            )}
          </button>
          {showDoctorPicker && (
            <select
              id="doctorPickerInline"
              value={selectedMedecinId}
              onChange={(e) => { setSelectedMedecinId(e.target.value); setShowDoctorPicker(false); }}
              onBlur={() => setShowDoctorPicker(false)}
              className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-10 border border-pink-300 rounded px-2 py-1 bg-white text-sm shadow"
            >
              <option value="">— Tous —</option>
              {medecins.map(m => { const spec = m?.specialite?.label || m?.specialite?.nom || m?.specialite || m?.specialty?.name || m?.specialty || ''; const label = `${m.prenom || ''} ${m.nom || ''}${spec ? ' — ' + spec : ''}`.trim(); return (<option key={m.id} value={m.id}>{label}</option>); })}
            </select>
          )}
        </div>
      </div>

      {selectedMedecinId ? (
        <>
          {/* Calendrier réduit (médecin sélectionné) */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-pink-800 flex items-center gap-2 m-0">
                <span className="material-symbols-rounded text-pink-600">calendar_month</span>
                Calendrier
              </h3>
              <div />
            </div>
            <div className="flex items-center justify-between mb-4">
              <button onClick={goToPreviousMonth} className="p-2 hover:bg-pink-100 rounded-lg transition-colors text-pink-700">
                <span className="material-symbols-rounded">chevron_left</span>
              </button>
              <h4 className="text-2xl font-semibold text-pink-700">
                {currentMonth.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
              </h4>
              <button onClick={goToNextMonth} className="p-2 hover:bg-pink-100 rounded-lg transition-colors text-pink-700">
                <span className="material-symbols-rounded">chevron_right</span>
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => (
                <div key={day} className="p-2 text-center text-sm font-medium text-pink-600">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((date) => {
                const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
                const key = toISODate(date);
                const today = sameDay(date, new Date());
                const selected = sameDay(date, selectedDate);
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedDate(date)}
                    className={`p-2 text-sm rounded-lg transition-colors ${!isCurrentMonth ? "text-gray-300" : "text-pink-700 hover:bg-pink-100"} ${today ? "bg-pink-300 text-pink-900 font-semibold" : ""} ${selected ? "bg-pink-500 text-white font-semibold" : ""}`}
                    aria-label={date.toDateString()}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Planning de la journée (agenda) */}
          <div className="bg-pink-200 rounded-lg shadow">
            <div className="p-6 border-b-2 border-pink-300 bg-pink-50">
              <h3 className="text-2xl font-semibold text-pink-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {selectedDate.toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} — Planning {loading ? "(chargement…)" : ""}
              </h3>
            </div>
            <div className="p-6 bg-pink-200">
              <div className="grid grid-cols-2 gap-4 mb-4 pb-2 border-b-2 border-pink-200">
                <div className="font-medium text-pink-700 text-sm text-center bg-pink-100 py-2 rounded-lg flex items-center justify-center gap-2">
                  <span className="material-symbols-rounded">wb_sunny</span>
                  Matin (8h-13h)
                </div>
                <div className="font-medium text-pink-700 text-sm text-center bg-pink-100 py-2 rounded-lg flex items-center justify-center gap-2">
                  <span className="material-symbols-rounded">dark_mode</span>
                  Après-midi (13h-18h)
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Matin */}
                <div className="space-y-2">
                  {timeSlots.filter(s => parseInt(s.start.split(":")[0], 10) >= 8 && parseInt(s.start.split(":")[0], 10) < 13).map(slot => {
                    const slotAppointments = appointmentsBySlot.get(slot.start) || [];
                    const hasStarter = slotAppointments.length > 0;
                    const isContinuation = !hasStarter && occupiedContinuationSlots.has(slot.start);
                    const first = slotAppointments[0];
                    if (isContinuation) return null; // fusion: ne pas afficher les suites
                    const dureeMin = getApptDurationMinutes(first);
                    const slotsToCover = hasStarter ? Math.ceil(dureeMin / SLOT_MINUTES) : 1;
                    // Vérifier si le créneau est entre 12h et 14h
                    const slotHour = parseInt(slot.start.split(":")[0], 10);
                    const isUrgencySlot = slotHour >= 12 && slotHour < 14;
                    return (
                      <div key={slot.start} style={{ minHeight: HAUTEUR_MIN_CARTE_CRENEAU * slotsToCover }} className={`border rounded-lg p-3 transition-all shadow-sm ${
                        isUrgencySlot 
                          ? 'border-gray-300 bg-gray-100 opacity-75' 
                          : `border-pink-200 bg-white ${hasStarter ? 'hover:bg-pink-50' : 'cursor-pointer hover:bg-pink-100 hover:shadow-md hover:border-pink-300 hover:scale-[1.02]'}`
                      }`}>
                        <div className={`text-sm font-medium mb-2 font-semibold ${isUrgencySlot ? 'text-gray-600' : 'text-pink-700'}`}>
                          {slot.start} - {hasStarter ? formatEndTimeFrom(slot.start, dureeMin) : slot.end}
                        </div>
                        {isUrgencySlot && !hasStarter && (
                          <div className="text-xs text-gray-500 italic mb-2">
                            Créneaux d'urgence privilégiés pour le médecin
                          </div>
                        )}
                        <div>
                          {hasStarter ? (() => {
                            const cls = getPlanningClasses(first?.statut);
                            return (
                              <div className={`${cls.box} p-3 rounded-lg`}>
                                <div className="text-xs">
                                  <div className="font-semibold flex items-center gap-1">
                                    <PatientName patient={first?.patient} />
                                    {hasUrgenceMedecin(first) && (
                                      <span className="material-symbols-rounded text-red-600 text-2xl" title="Urgence médecin">emergency</span>
                                    )}
                                  </div>
                                  <div className="text-gray-600 mt-1">{first?.motif}</div>
                                  <div className="mt-2 flex items-center gap-2"><span className={`px-2 py-1 rounded text-xs font-medium ${cls.badge}`}>{first?.statut}</span>
                                    <button onClick={() => openEdit(first)} className="px-2 py-0.5 rounded bg-pink-600 text-white hover:bg-pink-700 text-xs">Modifier</button>
                                  </div>
                                  
                                </div>
                              </div>
                            );
                          })() : isContinuation ? (
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-pink-600">Occupé (suite)</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <span className={`text-xs ${isUrgencySlot ? 'text-gray-500' : 'text-pink-600'}`}>Libre</span>
                              <button 
                                onClick={() => {
                                const y = selectedDate.getFullYear();
                                const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
                                const d = String(selectedDate.getDate()).padStart(2, '0');
                                setNewAppt(a => ({ ...a, date: `${y}-${m}-${d}`, heure: slot.start }));
                                setShowCreate(true);
                                }} 
                                className="text-pink-600 hover:text-pink-800 hover:bg-pink-100 rounded-full p-1 transition-all" 
                                title="Ajouter un RDV"
                              >
                                <span className="material-symbols-rounded">add</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Après-midi */}
                <div className="space-y-2">
                  {timeSlots.filter(s => parseInt(s.start.split(":")[0], 10) >= 13 && parseInt(s.start.split(":")[0], 10) < 18).map(slot => {
                    const slotAppointments = appointmentsBySlot.get(slot.start) || [];
                    const hasStarter = slotAppointments.length > 0;
                    const isContinuation = !hasStarter && occupiedContinuationSlots.has(slot.start);
                    const first = slotAppointments[0];
                    if (isContinuation) return null; // fusion: ne pas afficher les suites
                    const dureeMin = getApptDurationMinutes(first);
                    const slotsToCover = hasStarter ? Math.ceil(dureeMin / SLOT_MINUTES) : 1;
                    // Vérifier si le créneau est entre 12h et 14h
                    const slotHour = parseInt(slot.start.split(":")[0], 10);
                    const isUrgencySlot = slotHour >= 12 && slotHour < 14;
                    return (
                      <div key={slot.start} style={{ minHeight: HAUTEUR_MIN_CARTE_CRENEAU * slotsToCover }} className={`border rounded-lg p-3 transition-all shadow-sm ${
                        isUrgencySlot 
                          ? 'border-gray-300 bg-gray-100 opacity-75' 
                          : `border-pink-200 bg-white ${hasStarter ? 'hover:bg-pink-50' : 'cursor-pointer hover:bg-pink-100 hover:shadow-md hover:border-pink-300 hover:scale-[1.02]'}`
                      }`}>
                        <div className={`text-sm font-medium mb-2 font-semibold ${isUrgencySlot ? 'text-gray-600' : 'text-pink-700'}`}>
                          {slot.start} - {hasStarter ? formatEndTimeFrom(slot.start, dureeMin) : slot.end}
                        </div>
                        {isUrgencySlot && !hasStarter && (
                          <div className="text-xs text-gray-500 italic mb-2">
                            Créneaux d'urgence privilégiés pour le médecin
                          </div>
                        )}
                        <div>
                          {hasStarter ? (() => {
                            const cls = getPlanningClasses(first?.statut);
                            return (
                              <div className={`${cls.box} p-3 rounded-lg`}>
                                <div className="text-xs">
                                  <div className="font-semibold flex items-center gap-1">
                                    <PatientName patient={first?.patient} />
                                    {hasUrgenceMedecin(first) && (
                                      <span className="material-symbols-rounded text-red-600 text-2xl" title="Urgence médecin">emergency</span>
                                    )}
                                  </div>
                                  <div className="text-gray-600 mt-1">{first?.motif}</div>
                                  <div className="mt-2 flex items-center gap-2"><span className={`px-2 py-1 rounded text-xs font-medium ${cls.badge}`}>{first?.statut}</span>
                                    <button onClick={() => openEdit(first)} className="px-2 py-0.5 rounded bg-pink-600 text-white hover:bg-pink-700 text-xs">Modifier</button>
                                  </div>
                                </div>
                              </div>
                            );
                          })() : isContinuation ? (
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-pink-600">Occupé (suite)</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <span className={`text-xs ${isUrgencySlot ? 'text-gray-500' : 'text-pink-600'}`}>Libre</span>
                              <button 
                                onClick={() => {
                                const y = selectedDate.getFullYear();
                                const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
                                const d = String(selectedDate.getDate()).padStart(2, '0');
                                setNewAppt(a => ({ ...a, date: `${y}-${m}-${d}`, heure: slot.start }));
                                setShowCreate(true);
                                }} 
                                className="text-pink-600 hover:text-pink-800 hover:bg-pink-100 rounded-full p-1 transition-all" 
                                title="Ajouter un RDV"
                              >
                                <span className="material-symbols-rounded">add</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <p className="text-center text-pink-700 font-medium">
            Sélectionnez un médecin pour afficher le calendrier et le planning détaillé. Tous les rendez-vous des stagiaires restent visibles dans la liste ci-dessous.
          </p>
        </div>
      )}

      {/* Liste des rendez-vous avec entête identique à la page complète */}
      <div className="bg-pink-200 rounded-lg shadow mt-6">
        <div className="px-6 py-4 border-b-2 border-pink-300 bg-pink-50 flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-2xl font-semibold text-pink-800 flex items-center gap-2 m-0">
            <span className="material-symbols-rounded text-pink-600">list</span>
            Liste des rendez-vous
          </h3>
        </div>
        <div className="px-6 py-2 bg-pink-100 border-b border-pink-200">
          {/* Avertissement si un filtre de date limite l'affichage */}
          {(filters.dateDebut || filters.dateFin) && (
            <div className="mb-3 bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 flex items-start justify-between shadow-sm">
              <div className="flex items-start gap-3 flex-1">
                <span className="material-symbols-rounded text-yellow-600 text-2xl">warning</span>
                <div className="flex-1">
                  <p className="text-2xl font-bold text-yellow-900 mb-2">
                    ⚠️ Filtre de date actif - Affichage limité
                  </p>
                  <p className="text-sm text-yellow-800 mb-2">
                    Vous ne voyez que les rendez-vous du <strong className="text-yellow-900">{filters.dateDebut || 'début'}</strong> au <strong className="text-yellow-900">{filters.dateFin || 'fin'}</strong>.
                  </p>
                  <p className="text-sm font-semibold text-yellow-900 bg-yellow-100 px-3 py-2 rounded border border-yellow-300">
                    📊 Affichage : <strong>{appointments.length} rendez-vous</strong> sur un total de <strong>69 rendez-vous</strong>
                  </p>
                  <p className="text-xs text-yellow-700 mt-2 italic">
                    💡 Cliquez sur "Tous" ou sur le bouton ✕ ci-contre pour voir tous les rendez-vous
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setFilters(f => ({
                    ...f,
                    dateDebut: undefined,
                    dateFin: undefined,
                    page: 1
                  }));
                }}
                className="text-yellow-700 hover:text-yellow-900 hover:bg-yellow-100 rounded-full p-2 transition-colors ml-2"
                title="Retirer le filtre de date pour voir tous les rendez-vous"
              >
                <span className="material-symbols-rounded text-2xl">close</span>
              </button>
            </div>
          )}
          
          {/* Message informatif quand aucun filtre n'est actif */}
          {!filters.dateDebut && !filters.dateFin && (
            <div className="mb-3 bg-green-50 border border-green-300 rounded-lg p-3 flex items-center gap-2">
              <span className="material-symbols-rounded text-green-600">check_circle</span>
              <p className="text-sm text-green-800 font-medium">
                ✓ Affichage de <strong>tous les rendez-vous</strong> (sans filtre de date) - {appointments.length} rendez-vous visibles
              </p>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {selectedMedecinId && (
                <span className="text-sm text-pink-700">
                  Filtré par médecin : {(() => {
              const m = medecins.find(x => x.id === selectedMedecinId);
                    if (!m) return '';
              const lastUpper = (m.nom || '').toUpperCase();
              const first = m.prenom || '';
              const spec = m?.specialite?.label || m?.specialite?.nom || m?.specialite || m?.specialty?.name || m?.specialty || '';
                    return `Dr ${lastUpper} ${first}${spec ? ' — ' + spec : ''}`.trim();
            })()}
                </span>
              )}
            </div>
            <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-pink-100 text-pink-800 border border-pink-300 font-semibold">
              {appointments.length} rendez-vous
            </span>
          </div>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-2 flex-wrap justify-end mb-4">
            <button 
              onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                const isActive = filters.dateDebut === today && filters.dateFin === today;
                setFilters(f => ({ 
                  ...f, 
                  dateDebut: isActive ? undefined : today, 
                  dateFin: isActive ? undefined : today,
                  page: 1 // Reset à la page 1 lors du changement de filtre
                }));
              }} 
              className={`px-3 py-1 rounded-full text-xs transition-colors ${filters.dateDebut && filters.dateFin && filters.dateDebut === filters.dateFin && filters.dateDebut === new Date().toISOString().split('T')[0] ? 'bg-pink-100 text-pink-800 border border-pink-300' : 'bg-white text-pink-700 hover:bg-pink-50 border border-pink-300'}`}
            >
              Aujourd'hui
            </button>
            <button 
              onClick={() => {
                const t = new Date();
                const ws = new Date(t);
                ws.setDate(t.getDate() - t.getDay());
                const we = new Date(ws);
                we.setDate(ws.getDate() + 6);
                const weekStart = ws.toISOString().split('T')[0];
                const weekEnd = we.toISOString().split('T')[0];
                const isActive = filters.dateDebut === weekStart && filters.dateFin === weekEnd;
                setFilters(f => ({ 
                  ...f, 
                  dateDebut: isActive ? undefined : weekStart, 
                  dateFin: isActive ? undefined : weekEnd,
                  page: 1
                }));
              }} 
              className={`px-3 py-1 rounded-full text-xs transition-colors ${(() => {
                const t = new Date();
                const ws = new Date(t);
                ws.setDate(t.getDate() - t.getDay());
                const we = new Date(ws);
                we.setDate(ws.getDate() + 6);
                return filters.dateDebut === ws.toISOString().split('T')[0] && filters.dateFin === we.toISOString().split('T')[0];
              })() ? 'bg-pink-100 text-pink-800 border border-pink-300' : 'bg-white text-pink-700 hover:bg-pink-50 border border-pink-300'}`}
            >
              Cette semaine
            </button>
            <button 
              onClick={() => {
                const today = new Date();
                const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                const monthStartStr = monthStart.toISOString().split('T')[0];
                const monthEndStr = monthEnd.toISOString().split('T')[0];
                const isActive = filters.dateDebut === monthStartStr && filters.dateFin === monthEndStr;
                setFilters(f => ({ 
                  ...f, 
                  dateDebut: isActive ? undefined : monthStartStr, 
                  dateFin: isActive ? undefined : monthEndStr,
                  page: 1
                }));
              }} 
              className={`px-3 py-1 rounded-full text-xs transition-colors ${(() => {
                const today = new Date();
                const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                return filters.dateDebut === monthStart.toISOString().split('T')[0] && filters.dateFin === monthEnd.toISOString().split('T')[0];
              })() ? 'bg-pink-100 text-pink-800 border border-pink-300' : 'bg-white text-pink-700 hover:bg-pink-50 border border-pink-300'}`}
            >
              Ce mois
            </button>
            <button 
              onClick={() => {
                const today = new Date();
                const threeMonthsStart = new Date(today);
                threeMonthsStart.setMonth(today.getMonth() - 3);
                const threeMonthsEnd = new Date(today);
                threeMonthsEnd.setMonth(today.getMonth() + 3);
                const startStr = threeMonthsStart.toISOString().split('T')[0];
                const endStr = threeMonthsEnd.toISOString().split('T')[0];
                const isActive = filters.dateDebut === startStr && filters.dateFin === endStr;
                setFilters(f => ({ 
                  ...f, 
                  dateDebut: isActive ? undefined : startStr, 
                  dateFin: isActive ? undefined : endStr,
                  page: 1
                }));
              }} 
              className={`px-3 py-1 rounded-full text-xs transition-colors ${(() => {
                const today = new Date();
                const threeMonthsStart = new Date(today);
                threeMonthsStart.setMonth(today.getMonth() - 3);
                const threeMonthsEnd = new Date(today);
                threeMonthsEnd.setMonth(today.getMonth() + 3);
                return filters.dateDebut === threeMonthsStart.toISOString().split('T')[0] && filters.dateFin === threeMonthsEnd.toISOString().split('T')[0];
              })() ? 'bg-pink-100 text-pink-800 border border-pink-300' : 'bg-white text-pink-700 hover:bg-pink-50 border border-pink-300'}`}
            >
              6 mois
            </button>
            <button 
              onClick={() => {
                const isActive = filters.statut?.includes('PLANIFIE');
                setFilters(f => ({ 
                  ...f, 
                  statut: isActive 
                    ? (f.statut || []).filter(s => s !== 'PLANIFIE')
                    : [...(f.statut || []), 'PLANIFIE'],
                  page: 1
                }));
              }} 
              className={`px-3 py-1 rounded-full text-xs transition-colors ${filters.statut?.includes('PLANIFIE') ? 'bg-pink-100 text-pink-800 border border-pink-300' : 'bg-white text-pink-700 hover:bg-pink-50 border border-pink-300'}`}
            >
              Planifiés
            </button>
            <button 
              onClick={() => {
                const isActive = filters.statut?.includes('CONFIRME');
                setFilters(f => ({ 
                  ...f, 
                  statut: isActive 
                    ? (f.statut || []).filter(s => s !== 'CONFIRME')
                    : [...(f.statut || []), 'CONFIRME'],
                  page: 1
                }));
              }} 
              className={`px-3 py-1 rounded-full text-xs transition-colors ${filters.statut?.includes('CONFIRME') ? 'bg-pink-100 text-pink-800 border border-pink-300' : 'bg-white text-pink-700 hover:bg-pink-50 border border-pink-300'}`}
            >
              Confirmés
            </button>
            <button 
              onClick={() => {
                const isActive = filters.statut?.includes('ABSENT');
                setFilters(f => ({ 
                  ...f, 
                  statut: isActive 
                    ? (f.statut || []).filter(s => s !== 'ABSENT')
                    : [...(f.statut || []), 'ABSENT'],
                  page: 1
                }));
              }} 
              className={`px-3 py-1 rounded-full text-xs transition-colors ${filters.statut?.includes('ABSENT') ? 'bg-pink-100 text-pink-800 border border-pink-300' : 'bg-white text-pink-700 hover:bg-pink-50 border border-pink-300'}`}
            >
              Absents
            </button>
            <button 
              onClick={() => setFilters(f => ({ 
                ...f, 
                statut: [], 
                medecin: undefined, 
                patientId: undefined, 
                dateDebut: undefined, 
                dateFin: undefined,
                page: 1
              }))} 
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                !filters.dateDebut && !filters.dateFin && filters.statut.length === 0 && !filters.patientId
                  ? 'bg-pink-600 text-white border-2 border-pink-700 shadow-md' 
                  : 'bg-white text-pink-700 hover:bg-pink-50 border border-pink-300'
              }`}
              title="Voir TOUS les rendez-vous (sans limite de date - 69 rendez-vous)"
            >
              ✨ Tous
            </button>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={filters.dateDebut && filters.dateDebut === filters.dateFin ? filters.dateDebut : ''}
                onChange={(e) => {
                  const date = e.target.value || undefined;
                  setFilters(f => ({
                    ...f,
                    dateDebut: date,
                    dateFin: date, // Par défaut, filtrer sur une seule date
                    page: 1
                  }));
                }}
                className="px-3 py-1 rounded-full text-xs border border-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-500 bg-white"
                placeholder="Date spécifique"
                title="Filtrer par date spécifique (ex: 2025-11-13)"
              />
              {filters.dateDebut && filters.dateDebut === filters.dateFin && (
                <button
                  onClick={() => setFilters(f => ({ ...f, dateDebut: undefined, dateFin: undefined, page: 1 }))}
                  className="text-pink-600 hover:text-pink-800"
                  title="Effacer le filtre de date"
                >
                  <span className="material-symbols-rounded text-sm">close</span>
                </button>
              )}
            </div>
            {/* Filtres Patient/Médecin */}
            <div className="min-w-[200px]">
              <PatientSearchInput
                patients={patients}
                value={filters.patientId || ''}
                onChange={(patientId) => setFilters(f => ({ 
                  ...f, 
                  patientId: patientId || undefined,
                  page: 1
                }))}
                placeholder="Tous les patients"
                className="text-xs"
                label=""
              />
            </div>

          {loading && (
              <div className="flex items-center text-sm text-gray-500 ml-2">
              <LoadingSpinner color="pink" size="small" inline={true} />
              <span className="ml-2">Chargement...</span>
            </div>
          )}
          </div>
        </div>
        <div className="p-6">
        {error && (
          <div className="mb-4">
            <ErrorMessage 
              message={error} 
              title="Erreur de chargement"
              dismissible={true}
              onDismiss={() => setError(null)}
            />
          </div>
        )}
        {loading ? (
          <LoadingSpinner color="pink" message="Chargement des rendez-vous..." />
        ) : appointments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {selectedMedecinId ? 'Aucun rendez-vous trouvé pour ce médecin' : 'Aucun rendez-vous trouvé'}
            </div>
        ) : (
            <div className="space-y-4">
            {(() => {
              // Filtrer les rendez-vous
              // Pour les stagiaires : s'assurer qu'on ne montre que leurs propres créations
              let appointmentsToFilter = appointments;
              if (!isFormateur && !isAdmin && currentUserId && currentUserIri) {
                appointmentsToFilter = appointments.filter(appt => {
                  const creator = appt.createdBy || appt.created_by || appt.creePar || appt.user || null;
                  if (!creator) return false;
                  
                  if (typeof creator === 'object') {
                    const creatorId = creator.id;
                    const creatorIri = creator['@id'] || (creatorId ? `/api/users/${creatorId}` : null);
                    return String(creatorId) === String(currentUserId) || creatorIri === currentUserIri;
                  }
                  
                  if (typeof creator === 'string') {
                    const creatorId = creator.includes('/') ? creator.split('/').pop() : creator;
                    return String(creatorId) === String(currentUserId) || creator === currentUserIri;
                  }
                  
                  if (typeof creator === 'number') {
                    return String(creator) === String(currentUserId);
                  }
                  
                  return false;
                });
              }
              
              const filteredAppointments = appointmentsToFilter.filter(a => {
                // Exclure les annulés de l'affichage par défaut (mais ils peuvent être inclus via filtre statut)
                // Si les annulés sont explicitement demandés via le filtre statut, on les inclut
                if (a?.statut === 'ANNULE' && (!filters.statut || filters.statut.length === 0 || !filters.statut.includes('ANNULE'))) {
                  return false;
                }
                // Les autres filtres (médecin, patient, dates, statut) sont déjà appliqués dans loadAppointments
                return true;
              });
              
              // Pagination
              const totalPages = Math.ceil(filteredAppointments.length / APPOINTMENTS_PER_PAGE);
              const startIndex = (currentPage - 1) * APPOINTMENTS_PER_PAGE;
              const endIndex = startIndex + APPOINTMENTS_PER_PAGE;
              const paginatedAppointments = filteredAppointments.slice(startIndex, endIndex);
              
              return (
                <>
                  {paginatedAppointments.map((appointment) => {
              const patient = appointment.patient || {};
              const d = new Date(appointment.startAt || appointment.start_at || appointment.dateTime);
              const initials = `${patient.prenom?.[0] || ''}${patient.nom?.[0] || ''}`;
                const cls = getPlanningClasses(appointment.statut);
                return (
                  <div key={appointment.id} className={`p-4 rounded-r-lg border-l-4 ${cls.border} ${getListBg(appointment.statut)}`}> 
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4">
                          <div className={`w-12 h-12 ${cls.badge} rounded-full flex items-center justify-center`}>
                          <span className={`font-semibold text-2xl`}>{initials}</span>
                          </div>
                          <div>
                            <div className="font-semibold text-gray-800 flex items-center gap-1">
                              <PatientName patient={patient} />
                              {hasUrgenceMedecin(appointment) && (
                                <span className="material-symbols-rounded text-red-600 text-2xl" title="Urgence médecin">emergency</span>
                              )}
                            </div>
                            <div className="text-sm text-gray-600">
                              {appointment.motif} • {getDoctorName(appointment)} • {d.toLocaleDateString('fr-FR')} • {formatRangeForAppointment(appointment)}
                            </div>
                        {isFormateur && (
                          <div className="text-xs text-gray-500 mt-1">
                            {(() => {
                              const raw = appointment.createdBy || appointment.created_by || appointment.creePar || appointment.user || null;
                              if (!raw) return 'Créé par: —';
                              if (typeof raw === 'string') {
                                const fallbackName = appointment.created_by_name || appointment.createdByName || '';
                                const fallbackEmail = appointment.created_by_email || appointment.createdByEmail || '';
                                const val = fallbackName || fallbackEmail || (raw.split('/').pop() || '—');
                                return `Créé par: ${val}`;
                              }
                              const fn = raw.prenom || raw.firstName || '';
                              const ln = raw.nom || raw.lastName || '';
                              const email = raw.email || '';
                              const name = `${fn} ${ln}`.trim() || email || '—';
                              return `Créé par: ${name}`;
                            })()}
                          </div>
                        )}
                            <div className="text-xs text-gray-500 mt-1">
                              {patient.telephone && (
                                <span className="inline-flex items-center gap-1 mr-2">
                                  <span className="material-symbols-rounded text-gray-500 text-sm">call</span>
                                  {patient.telephone}
                                </span>
                              )}
                              {patient.email && (
                                <span className="inline-flex items-center gap-1">
                                  <span className="material-symbols-rounded text-gray-500 text-sm">mail</span>
                                  {patient.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeClasses(appointment.statut)}`}>{appointment.statut}</span>
                      {appointment.statut === 'PLANIFIE' && (
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleAction(appointment.id, 'CONFIRME')} className="px-3 py-1 rounded bg-green-600 text-white text-xs hover:bg-green-700">Confirmer</button>
                          <button onClick={() => handleAction(appointment.id, 'ABSENT')} className="px-3 py-1 rounded bg-red-600 text-white text-xs hover:bg-red-700 font-semibold">Absent</button>
                          <button onClick={() => handleAction(appointment.id, 'ANNULE')} className="px-3 py-1 rounded bg-red-600 text-white text-xs hover:bg-red-700">Annuler</button>
                          {(isFormateur || isAdmin) && (
                            <button 
                              onClick={() => handleDeleteAppointment(appointment.id)} 
                              disabled={isDeleting}
                              className="px-3 py-1 rounded bg-red-800 text-white text-xs hover:bg-red-900 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-1"
                              title="Supprimer ce rendez-vous"
                            >
                              <span className="material-symbols-rounded text-xs">delete</span>
                              Supprimer
                            </button>
                          )}
                  </div>
                      )}
                      {appointment.statut !== 'PLANIFIE' && (
                        <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                              if (editStatusId === appointment.id) {
                                    setEditStatusId(null);
                                    setEditStatusValue('');
                                  } else {
                                setEditStatusId(appointment.id);
                                setEditStatusValue(appointment.statut || 'CONFIRME');
                                  }
                                }}
                            className="px-3 py-1 rounded bg-pink-600 text-white text-xs hover:bg-pink-700"
                              >
                                Modifier
                              </button>
                              {canDeleteAppointment(appointment) && (
                                <button 
                                  onClick={() => handleDeleteAppointment(appointment.id)} 
                                  disabled={isDeleting}
                                  className="px-3 py-1 rounded bg-red-800 text-white text-xs hover:bg-red-900 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-1"
                                  title="Supprimer ce rendez-vous"
                                >
                                  <span className="material-symbols-rounded text-xs">delete</span>
                                  Supprimer
                                </button>
                              )}
                          
                          {editStatusId === appointment.id && (
                                <div className="flex items-center gap-2">
                                  <select
                                    value={editStatusValue}
                                    onChange={(e) => setEditStatusValue(e.target.value)}
                                    className="px-2 py-1 text-xs border border-pink-300 rounded hover:border-pink-400 bg-white"
                                  >
                                    <option value="PLANIFIE">Planifié</option>
                                    <option value="CONFIRME">Confirmé</option>
                                    <option value="ANNULE">Annulé</option>
                                    <option value="ABSENT">Absent</option>
                                    <option value="TERMINE">Terminé</option>
                                  </select>
                                  <button
                                    onClick={async () => {
                                      if (!editStatusValue) return;
                                      try {
                                        if (editStatusValue === 'ANNULE') {
                                          try {
                                            await appointmentService.deleteAppointment(appointment.id);
                                          } catch (_) {
                                            await appointmentService.updateStatus(appointment.id, 'ANNULE');
                                          }
                                        } else {
                                          await appointmentService.updateStatus(appointment.id, editStatusValue);
                                        }
                                        setEditStatusId(null);
                                        setEditStatusValue('');
                                        await loadAppointments();
                                      } catch (e) {
                                        setError("Erreur lors du changement de statut: " + (e?.message || ''));
                                      }
                                    }}
                                    className="px-3 py-1 rounded bg-pink-600 text-white text-xs hover:bg-pink-700"
                                  >
                                    Enregistrer
                                  </button>
                                </div>
                              )}
          </div>
        )}
      </div>

      {/* Formateur: RDV créés par des stagiaires */}
      {isFormateur && (
        <div className="bg-pink-200 rounded-lg shadow mt-6">
          <div className="px-6 py-4 border-b-2 border-pink-300 bg-pink-50 flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-2xl font-semibold text-pink-800 flex items-center gap-2 m-0">
              <span className="material-symbols-rounded text-pink-600">assignment_ind</span>
              RDV créés par des stagiaires
              <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-pink-100 text-pink-800 border border-pink-300">{trainerAppointments.length}</span>
            </h3>
          </div>
          <div className="p-6">
            {trainerLoading ? (
              <div className="text-center py-6 text-pink-700">Chargement…</div>
            ) : trainerAppointments.length === 0 ? (
              <div className="text-center py-6 text-gray-500">Aucun rendez-vous créé par des stagiaires</div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full table-auto">
                  <thead className="bg-pink-100">
                    <tr>
                      <th className="px-4 py-3 text-center text-xs font-medium text-pink-700 uppercase tracking-wider w-24">Date</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-pink-700 uppercase tracking-wider w-20">Heure</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-pink-700 uppercase tracking-wider">Patient</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-pink-700 uppercase tracking-wider">Médecin</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-pink-700 uppercase tracking-wider">Motif</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-pink-700 uppercase tracking-wider w-28">Statut</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-pink-700 uppercase tracking-wider">Créé par</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-pink-200">
                    {trainerAppointments.map((rdv, index) => {
                      const d = new Date(rdv.startAt || rdv.start_at || rdv.appointmentTime || rdv.startTime || rdv.dateTime);
                      const dateStr = !isNaN(d) ? d.toLocaleDateString('fr-FR') : '—';
                      const timeStr = !isNaN(d) ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
                      const patient = rdv.patient || {};
                      const statut = rdv.statut || rdv.status || 'PLANIFIE';
                      // Utiliser la fonction centralisée pour obtenir le nom du médecin
                      const doctorName = getDoctorNameFromAppointment(rdv, medecinsById) || '—';
                      const creatorRaw = rdv.createdBy || rdv.created_by || rdv.creePar || rdv.user || null;
                      let creatorName = '—';
                      if (creatorRaw) {
                        if (typeof creatorRaw === 'string') {
                          const fallbackName = rdv.created_by_name || rdv.createdByName || '';
                          const fallbackEmail = rdv.created_by_email || rdv.createdByEmail || '';
                          creatorName = fallbackName || fallbackEmail || creatorRaw.split('/').pop() || '—';
                        } else {
                          const fn = creatorRaw.prenom || creatorRaw.firstName || '';
                          const ln = creatorRaw.nom || creatorRaw.lastName || '';
                          const email = creatorRaw.email || '';
                          const name = `${fn} ${ln}`.trim();
                          creatorName = name || email || '—';
                        }
                      }
                      return (
                        <tr key={rdv.id || index} className="hover:bg-pink-50">
                          <td className={`${isFormateur ? 'px-3' : 'px-4'} py-3 whitespace-nowrap text-sm text-gray-900 text-center`}>{dateStr}</td>
                          <td className={`${isFormateur ? 'px-3' : 'px-4'} py-3 whitespace-nowrap text-sm text-gray-900 text-center`}>{timeStr}</td>
                          <td className={`${isFormateur ? 'px-3' : 'px-4'} py-3 text-sm text-gray-900 text-center break-words`}>
                            {(() => {
                              const genre = formatGenre(patient);
                              return (
                                <>
                                  {genre && <span className="font-bold">{genre} </span>}
                                  <span className="font-bold">{patient.nom || ''}</span>
                                  {patient.prenom && <span> {patient.prenom}</span>}
                                </>
                              );
                            })()}
                          </td>
                          <td className={`${isFormateur ? 'px-3' : 'px-4'} py-3 text-sm text-gray-900 text-center break-words`}>{doctorName}</td>
                          <td className={`${isFormateur ? 'px-3' : 'px-4'} py-3 text-sm text-gray-900 text-center break-words`}>{rdv.motif || '—'}</td>
                          <td className={`${isFormateur ? 'px-3' : 'px-4'} py-3 whitespace-nowrap text-sm text-gray-900 text-center`}>{statut}</td>
                          <td className={`${isFormateur ? 'px-3' : 'px-4'} py-3 text-sm text-gray-900 text-center break-words`}>{creatorName}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
                          )}
                        </div>
                                </div>
                          )}
                      </div>
                    </div>
                  );
                  })}
                  
                  {/* Pagination */}
                  {filteredAppointments.length > APPOINTMENTS_PER_PAGE && (
                    <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
                      <div className="text-sm text-gray-700">
                        Affichage de {startIndex + 1} à {Math.min(endIndex, filteredAppointments.length)} sur {filteredAppointments.length} rendez-vous
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          className={`px-3 py-2 rounded-lg border transition-colors ${
                            currentPage === 1
                              ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                              : "bg-white hover:bg-pink-50 border-pink-300 text-pink-700"
                          }`}
                        >
                          <span className="material-symbols-rounded text-2xl">chevron_left</span>
                        </button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum;
                            if (totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (currentPage <= 3) {
                              pageNum = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i;
                            } else {
                              pageNum = currentPage - 2 + i;
                            }
                            
                            return (
                              <button
                                key={pageNum}
                                onClick={() => setCurrentPage(pageNum)}
                                className={`px-3 py-2 rounded-lg border transition-colors ${
                                  currentPage === pageNum
                                    ? "bg-pink-600 text-white border-pink-600 font-semibold"
                                    : "bg-white hover:bg-pink-50 border-pink-300 text-pink-700"
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                          className={`px-3 py-2 rounded-lg border transition-colors ${
                            currentPage === totalPages
                              ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                              : "bg-white hover:bg-pink-50 border-pink-300 text-pink-700"
                          }`}
                        >
                          <span className="material-symbols-rounded text-2xl">chevron_right</span>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
            </div>
        )}
        </div>
      </div>

      {/* Modal création */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-2xl rounded-xl shadow-2xl border-2 border-pink-200 bg-white">
            <div className="px-6 py-4 border-b-2 border-pink-200 bg-pink-50 rounded-t-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-rounded text-pink-600">event_available</span>
                <h3 className="text-2xl font-semibold text-pink-800">Nouveau Rendez-vous</h3>
              </div>
              <button onClick={() => setShowCreate(false)} className="text-pink-500 hover:text-pink-700 rounded-full p-1 hover:bg-pink-100" aria-label="Fermer">
                <span className="material-symbols-rounded">close</span>
                </button>
              </div>
            <form onSubmit={createAppointment} className="px-6 py-5 space-y-5">
              {createError && (
                <div className="bg-red-100 border border-red-300 text-red-800 px-4 py-2 rounded">{createError}</div>
              )}
              <div className="relative patient-search-create">
                <label className="block text-sm font-medium text-pink-800 mb-1">Patient</label>
                <div className="relative">
                  <input
                    type="text"
                    value={patientSearchCreate}
                    onChange={(e) => {
                      setPatientSearchCreate(e.target.value);
                      setShowPatientResultsCreate(true);
                      if (!e.target.value) {
                        setNewAppt(prev => ({ ...prev, patient: '' }));
                        setSelectedPatientCreate(null);
                      }
                    }}
                    onFocus={() => setShowPatientResultsCreate(true)}
                    placeholder="Rechercher un patient (nom, prénom, email, téléphone...)"
                    className="w-full border border-pink-300 rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-400 bg-pink-50"
                    required
                  />
                  {patientSearchCreate && (
                    <button
                      type="button"
                      onClick={() => {
                        setPatientSearchCreate('');
                        setNewAppt(prev => ({ ...prev, patient: '' }));
                        setSelectedPatientCreate(null);
                        setShowPatientResultsCreate(false);
                      }}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <span className="material-symbols-rounded text-2xl">close</span>
                    </button>
                  )}
                  {showPatientResultsCreate && filteredPatientsCreate.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-pink-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredPatientsCreate.map(p => {
                        const id = getPatientId(p);
                        if (!id) return null;
                        const info = getPatientStatusInfo(p);
                        const name = `${p.prenom || p.firstName || ''} ${p.nom || p.lastName || ''}`.trim() || (p.email || `Patient ${id}`);
                        const statusSuffix = info.label ? ` — ${info.label}${info.icon ? ` ${info.icon}` : ''}` : '';
                        const email = p.email ? ` • ${p.email}` : '';
                        const telephone = p.telephone || p.phone ? ` • ${p.telephone || p.phone}` : '';
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => handleSelectPatientCreate(p)}
                            disabled={info.isDeceased}
                            className={`w-full text-left px-4 py-2 hover:bg-pink-50 border-b border-pink-100 last:border-b-0 ${
                              info.isDeceased ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                            }`}
                          >
                            <div className="font-medium text-gray-900">
                              {name}{statusSuffix}{info.isDeceased ? ' (bloqué)' : ''}
                            </div>
                            {(email || telephone) && (
                              <div className="text-xs text-gray-500 mt-0.5">
                                {email}{telephone}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {showPatientResultsCreate && patientSearchCreate && filteredPatientsCreate.length === 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-pink-300 rounded-lg shadow-lg p-4 text-center text-gray-500">
                      Aucun patient trouvé
                    </div>
                  )}
                </div>
            </div>
              <div>
                <label className="block text-sm font-medium text-pink-800 mb-1">Médecin</label>
                <select value={newAppt.medecin} onChange={(e) => setNewAppt(a => ({ ...a, medecin: e.target.value }))} className="w-full border border-pink-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-400 bg-pink-50" required>
                  <option value="">— Sélectionner —</option>
                  {medecins.map(m => (
                    <option key={m.id} value={m.id}>{(() => { const spec = m?.specialite?.label || m?.specialite?.nom || m?.specialite || m?.specialty?.name || m?.specialty || ''; return `Dr. ${m.prenom || ''} ${m.nom || ''}${spec ? ' — ' + spec : ''}`; })()}</option>
                  ))}
                </select>
                            </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                  <label className="block text-sm font-medium text-pink-800 mb-1">Date</label>
                  <input type="date" value={newAppt.date} onChange={(e) => setNewAppt(a => ({ ...a, date: e.target.value }))} className="w-full border border-pink-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-400 bg-pink-50" required />
                              </div>
                <div>
                  <label className="block text-sm font-medium text-pink-800 mb-1">Heure</label>
                  <input type="time" value={newAppt.heure} onChange={(e) => setNewAppt(a => ({ ...a, heure: e.target.value }))} className="w-full border border-pink-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-400 bg-pink-50" required />
                                </div>
                                </div>
              <div>
                <label className="block text-sm font-medium text-pink-800 mb-1">Motif</label>
                <select value={newAppt.motif} onChange={(e) => setNewAppt(a => ({ ...a, motif: e.target.value }))} className="w-full border border-pink-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-400 bg-pink-50" required>
                  <option value="">Sélectionner</option>
                  <option value="consultation">Consultation générale</option>
                  <option value="suivi">Suivi</option>
                  <option value="urgence">Urgence</option>
                  <option value="controle">Contrôle</option>
                  <option value="specialiste">Spécialiste</option>
                </select>
                            </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-pink-800 mb-1">Durée (min)</label>
                  <select value={newAppt.duree} onChange={(e) => setNewAppt(a => ({ ...a, duree: e.target.value }))} className="w-full border border-pink-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-400 bg-pink-50">
                    <option value="15">15</option>
                    <option value="30">30</option>
                    <option value="45">45</option>
                    <option value="60">60</option>
                  </select>
                          </div>
                <div>
                  <label className="block text-sm font-medium text-pink-800 mb-1">Notes</label>
                  <input type="text" value={newAppt.notes} onChange={(e) => setNewAppt(a => ({ ...a, notes: e.target.value }))} className="w-full border border-pink-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-400 bg-pink-50" />
                        </div>
                    </div>
              {(() => {
                const heure = newAppt.heure || '';
                const [hour] = heure.split(':').map(Number);
                const isUrgencySlot = hour >= 12 && hour < 14;
                return isUrgencySlot ? (
                  <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <input
                      type="checkbox"
                      id="urgenceMedecin"
                      checked={newAppt.urgenceMedecin || false}
                      onChange={(e) => setNewAppt(a => ({ ...a, urgenceMedecin: e.target.checked }))}
                      className="w-4 h-4 text-orange-600 border-orange-300 rounded focus:ring-orange-500"
                    />
                    <label htmlFor="urgenceMedecin" className="text-sm font-medium text-orange-800 cursor-pointer">
                      Urgence médecin
                    </label>
                  </div>
                ) : null;
              })()}
              <div className="flex justify-end gap-2 pt-4 border-t-2 border-pink-200">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg border-2 border-pink-300 text-pink-700 hover:bg-pink-50 hover:border-pink-400 transition-colors font-medium">Annuler</button>
                <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-pink-600 text-white hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg hover:shadow-xl transition-colors">
                  {loading ? 'Création…' : 'Créer le RDV'}
                </button>
                        </div>
            </form>
                      </div>
                    </div>
                  )}

      {/* Modal édition */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-2xl rounded-xl shadow-2xl border-2 border-pink-200 bg-white">
            <div className="px-6 py-4 border-b-2 border-pink-200 bg-pink-50 rounded-t-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-rounded text-pink-600">edit_calendar</span>
                <h3 className="text-2xl font-semibold text-pink-800">Modifier le Rendez-vous</h3>
                </div>
              <button onClick={() => setShowEdit(false)} className="text-pink-500 hover:text-pink-700 rounded-full p-1 hover:bg-pink-100" aria-label="Fermer">
                <span className="material-symbols-rounded">close</span>
              </button>
                </div>
            <form onSubmit={submitEdit} className="px-6 py-5 space-y-5">
              {editError && (
                <div className="bg-red-100 border border-red-300 text-red-800 px-4 py-2 rounded">{editError}</div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-pink-800 mb-1">Date</label>
                  <input type="date" value={editAppt.date} onChange={(e) => setEditAppt(a => ({ ...a, date: e.target.value }))} className="w-full border border-pink-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-400 bg-pink-50" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-pink-800 mb-1">Heure</label>
                  <input type="time" value={editAppt.heure} onChange={(e) => setEditAppt(a => ({ ...a, heure: e.target.value }))} className="w-full border border-pink-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-400 bg-pink-50" required />
                </div>
              </div>
              <div className="relative patient-search-edit">
                <label className="block text-sm font-medium text-pink-800 mb-1">Patient</label>
                <div className="relative">
                  <input
                    type="text"
                    value={patientSearchEdit}
                    onChange={(e) => {
                      setPatientSearchEdit(e.target.value);
                      setShowPatientResultsEdit(true);
                      if (!e.target.value) {
                        setEditAppt(prev => ({ ...prev, patient: '' }));
                        setSelectedPatientEdit(null);
                      }
                    }}
                    onFocus={() => setShowPatientResultsEdit(true)}
                    placeholder="Rechercher un patient (nom, prénom, email, téléphone...)"
                    className="w-full border border-pink-300 rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-400 bg-pink-50"
                    required
                  />
                  {patientSearchEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        setPatientSearchEdit('');
                        setEditAppt(prev => ({ ...prev, patient: '' }));
                        setSelectedPatientEdit(null);
                        setShowPatientResultsEdit(false);
                      }}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <span className="material-symbols-rounded text-2xl">close</span>
                    </button>
                  )}
                  {showPatientResultsEdit && filteredPatientsEdit.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-pink-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredPatientsEdit.map(p => {
                        const id = getPatientId(p);
                        if (!id) return null;
                        const info = getPatientStatusInfo(p);
                        const name = `${p.prenom || p.firstName || ''} ${p.nom || p.lastName || ''}`.trim() || (p.email || `Patient ${id}`);
                        const statusSuffix = info.label ? ` — ${info.label}${info.icon ? ` ${info.icon}` : ''}` : '';
                        const email = p.email ? ` • ${p.email}` : '';
                        const telephone = p.telephone || p.phone ? ` • ${p.telephone || p.phone}` : '';
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => handleSelectPatientEdit(p)}
                            disabled={info.isDeceased}
                            className={`w-full text-left px-4 py-2 hover:bg-pink-50 border-b border-pink-100 last:border-b-0 ${
                              info.isDeceased ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                            }`}
                          >
                            <div className="font-medium text-gray-900">
                              {name}{statusSuffix}{info.isDeceased ? ' (bloqué)' : ''}
                            </div>
                            {(email || telephone) && (
                              <div className="text-xs text-gray-500 mt-0.5">
                                {email}{telephone}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {showPatientResultsEdit && patientSearchEdit && filteredPatientsEdit.length === 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-pink-300 rounded-lg shadow-lg p-4 text-center text-gray-500">
                      Aucun patient trouvé
                    </div>
                  )}
                </div>
              </div>
                <div>
                <label className="block text-sm font-medium text-pink-800 mb-1">Motif</label>
                <select value={editAppt.motif} onChange={(e) => setEditAppt(a => ({ ...a, motif: e.target.value }))} className="w-full border border-pink-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-400 bg-pink-50" required>
                  <option value="">Sélectionner</option>
                    <option value="consultation">Consultation générale</option>
                  <option value="suivi">Suivi</option>
                    <option value="urgence">Urgence</option>
                  <option value="controle">Contrôle</option>
                    <option value="specialiste">Spécialiste</option>
                  </select>
                </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-pink-800 mb-1">Durée (min)</label>
                  <select value={editAppt.duree} onChange={(e) => setEditAppt(a => ({ ...a, duree: e.target.value }))} className="w-full border border-pink-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-400 bg-pink-50">
                    <option value="15">15</option>
                    <option value="30">30</option>
                    <option value="45">45</option>
                    <option value="60">60</option>
                  </select>
              </div>
              <div>
                  <label className="block text-sm font-medium text-pink-800 mb-1">Notes</label>
                  <input type="text" value={editAppt.notes} onChange={(e) => setEditAppt(a => ({ ...a, notes: e.target.value }))} className="w-full border border-pink-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-400 bg-pink-50" />
              </div>
              </div>
              {(() => {
                const heure = editAppt.heure || '';
                const [hour] = heure.split(':').map(Number);
                const isUrgencySlot = hour >= 12 && hour < 14;
                return isUrgencySlot ? (
                  <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <input
                      type="checkbox"
                      id="urgenceMedecinEdit"
                      checked={editAppt.urgenceMedecin || false}
                      onChange={(e) => setEditAppt(a => ({ ...a, urgenceMedecin: e.target.checked }))}
                      className="w-4 h-4 text-orange-600 border-orange-300 rounded focus:ring-orange-500"
                    />
                    <label htmlFor="urgenceMedecinEdit" className="text-sm font-medium text-orange-800 cursor-pointer">
                      Urgence médecin
                    </label>
                  </div>
                ) : null;
              })()}
              <div className="flex justify-end gap-2 pt-4 border-t-2 border-pink-200">
                <button type="button" onClick={() => setShowEdit(false)} className="px-4 py-2 rounded-lg border-2 border-pink-300 text-pink-700 hover:bg-pink-50 hover:border-pink-400 transition-colors font-medium">Annuler</button>
                <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-pink-600 text-white hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg hover:shadow-xl transition-colors">
                  {loading ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* (Section RDV des patients retirée) */}
    </div>
  );
};

export default Appointments;
