import React, { useState, useEffect, useCallback } from "react";
import userService from "../../_services/user.service";
import appointmentService from "../../_services/appointment.service";
import patientService from "../../_services/patient.service";
import medecinService from "../../_services/medecin.service";
import ErrorMessage from "../../components/ErrorMessage";
// Recherche/filters retirés

const PATIENT_STATUS_META = {
  ACTIF: { label: 'Actif', icon: '✅', isDeceased: false },
  INACTIF: { label: 'Inactif', icon: '⏸️', isDeceased: false },
  DECEDE: { label: 'Décédé', icon: '⚰️', isDeceased: true }
};

const getPatientStatusInfo = (patientLike) => {
  if (!patientLike) {
    return { code: '', label: '', icon: '', isDeceased: false };
  }
  if (typeof patientLike === 'string') {
    return { code: '', label: '', icon: '', isDeceased: false };
  }
  const rawStatus = patientLike.statut || patientLike.status || '';
  const code = typeof rawStatus === 'string' ? rawStatus.toUpperCase() : '';
  const meta = PATIENT_STATUS_META[code] || null;
  const label = patientLike.statutLabel || patientLike.statusLabel || meta?.label || (typeof rawStatus === 'string' ? rawStatus : '');
  return {
    code,
    label,
    icon: meta?.icon || '',
    isDeceased: meta?.isDeceased || false
  };
};

const getPatientId = (patientLike) => {
  if (!patientLike || typeof patientLike !== 'object') return undefined;
  if (patientLike.id !== undefined && patientLike.id !== null) return String(patientLike.id);
  if (typeof patientLike['@id'] === 'string') {
    const iri = patientLike['@id'];
    return iri.includes('/') ? iri.split('/').pop() : iri;
  }
  return undefined;
};

// Exemple d'Appointments simplifié avec mappers
const Appointments = () => {
  // États principaux
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Référentiels
  const [patients, setPatients] = useState([]);
  const [medecins, setMedecins] = useState([]);
  const medecinsById = React.useMemo(() => {
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

  // Parse heures/minutes depuis formats back: "YYYY-MM-DD HH:mm:ss" ou ISO
  const extractHHmm = (dateLike) => {
    if (!dateLike) return '';
    if (typeof dateLike === 'string') {
      const s = dateLike;
      // 1) "YYYY-MM-DD HH:mm:ss"
      let m = s.match(/^(\d{4})-(\d{2})-(\d{2})\s(\d{2}):(\d{2})(?::\d{2})?$/);
      if (m) return `${m[4]}:${m[5]}`;
      // 2) ISO: "YYYY-MM-DDTHH:mm:ss"(+tz)
      m = s.match(/T(\d{2}):(\d{2})(?::\d{2})?/);
      if (m) return `${m[1]}:${m[2]}`;
    }
    const d = new Date(dateLike);
    if (!isNaN(d)) {
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    }
    return '';
  };

  const sameDay = (a, b) => (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );

  const dayIndexMondayFirst = (date) => (date.getDay() + 6) % 7;

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  // Formateur
  const isFormateur = userService.isFormateur && userService.isFormateur();
  const [trainerAppointments, setTrainerAppointments] = useState([]);
  const [trainerLoading, setTrainerLoading] = useState(false);
  const [creatorMap, setCreatorMap] = useState({}); // id -> { prenom, nom, email }
  const [creatorLabelByRdv, setCreatorLabelByRdv] = useState({}); // rdvId -> string label

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
  const [newAppt, setNewAppt] = useState({ patient: '', medecin: '', motif: '', date: '', heure: '', duree: '30', notes: '' });
  const [createError, setCreateError] = useState('');
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
  const [showEdit, setShowEdit] = useState(false);
  const [editApptId, setEditApptId] = useState(null);
  const [editAppt, setEditAppt] = useState({ patient: '', medecin: '', motif: '', date: '', heure: '', duree: '30', notes: '' });
  const [editError, setEditError] = useState('');

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
      
      // IMPORTANT : Utiliser getAllAppointmentsHistory par défaut (sans filtre de date)
      // pour voir TOUS les rendez-vous futurs, pas seulement ceux de la semaine
      // Seulement utiliser getAllAppointments si un filtre de date spécifique est défini
      
      // Par défaut (sans filtre de date), utiliser /rendez-vous/tous pour voir TOUS les rendez-vous
      // Si un filtre de date est défini, utiliser /rendez-vous/ avec les paramètres de date
      const appointmentMethod = (apiFilters.useHistoryEndpoint || !hasDateFilter)
        ? appointmentService.getAllAppointmentsHistory  // Utiliser /rendez-vous/tous pour voir tous les RDV
        : appointmentService.getAllAppointments;        // Utiliser /rendez-vous/ seulement si filtre de date
      
      // Log pour debug
      if (import.meta.env.DEV) {
        console.log('📅 Chargement rendez-vous:', {
          hasDateFilter,
          dateDebut: filters.dateDebut,
          dateFin: filters.dateFin,
          method: appointmentMethod === appointmentService.getAllAppointmentsHistory ? '/rendez-vous/tous' : '/rendez-vous/',
          filters: apiFilters
        });
      }
      
      const [data, statusAgg] = await Promise.all([
        appointmentMethod(apiFilters),
        appointmentService.getRendezVousStatus().catch(() => null)
      ]);
      let list = Array.isArray(data) ? data : [];
      
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
      console.error("Erreur lors du chargement des rendez-vous:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [filters, selectedMedecinId, medecinsById]);

  // Charger référentiels
  useEffect(() => {
    (async () => {
      try {
        const [p, m] = await Promise.all([
          patientService.getAllPatients({ limit: 200 }).catch(() => []),
          medecinService.getAllMedecins().catch(() => [])
        ]);
        setPatients(Array.isArray(p) ? p : []);
        setMedecins(Array.isArray(m) ? m : []);
      } catch {}
    })();
  }, []);


  // Charger RDV créés par des stagiaires (vue formateur)
  useEffect(() => {
    if (!isFormateur) return;
    (async () => {
      try {
        setTrainerLoading(true);
        const page1 = await appointmentService.getFormateurAppointments(1, 50);
        const list = Array.isArray(page1) ? page1 : [];
        list.sort((a, b) => new Date(a.startAt || a.start_at || a.dateTime || 0) - new Date(b.startAt || b.start_at || b.dateTime || 0));
        setTrainerAppointments(list);
      } finally {
        setTrainerLoading(false);
      }
    })();
  }, [isFormateur]);

  // Résolution externe désactivée: l'endpoint formateur renvoie désormais created_by complet
  useEffect(() => { /* no-op */ }, [isFormateur, trainerAppointments]);

  // Enrichissement via détails désactivé (le back fournit created_by directement)
  useEffect(() => { /* no-op */ }, [isFormateur, trainerAppointments, creatorLabelByRdv]);

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

  // Vue exclusive pour FORMATEUR: afficher uniquement la liste des RDV créés par des stagiaires
  if (isFormateur) {
    return (
      <div className="min-h-screen p-6">
        <div className="text-center py-6">
          <div className="bg-pink-200 rounded-lg shadow p-6 max-w-xl mx-auto">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center shadow-sm">
                <span className="material-symbols-rounded text-pink-600 text-2xl">calendar_month</span>
              </div>
              <h1 className="text-2xl font-bold text-pink-800">Rendez-Vous</h1>
            </div>
            <p className="text-pink-700 text-sm">RDV créés par les stagiaires</p>
          </div>
        </div>

        <div className="bg-pink-200 rounded-lg shadow">
          <div className="px-6 py-4 border-b-2 border-pink-300 bg-pink-50 flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-lg font-semibold text-pink-800 flex items-center gap-2 m-0">
              <span className="material-symbols-rounded text-pink-600">assignment_ind</span>
              Liste des rendez-vous
              <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-pink-100 text-pink-800 border border-pink-300">{trainerAppointments.length}</span>
            </h3>
          </div>

          <div className="p-6">
            {trainerLoading ? (
              <div className="text-center py-6 text-pink-700">Chargement…</div>
            ) : trainerAppointments.length === 0 ? (
              <div className="text-center py-6 text-gray-500">Aucun rendez-vous créé par des stagiaires</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-pink-100">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-pink-700 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-pink-700 uppercase tracking-wider">Heure</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-pink-700 uppercase tracking-wider">Patient</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-pink-700 uppercase tracking-wider">Médecin</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-pink-700 uppercase tracking-wider">Motif</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-pink-700 uppercase tracking-wider">Statut</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-pink-700 uppercase tracking-wider">Créé par</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-pink-200">
                    {trainerAppointments.map((rdv, index) => {
                      
                      const d = new Date(rdv.startAt || rdv.start_at || rdv.appointmentTime || rdv.startTime || rdv.dateTime);
                      const dateStr = !isNaN(d) ? d.toLocaleDateString('fr-FR') : '—';
                      const timeStr = !isNaN(d) ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
                      const patient = rdv.patient || {};
                      const medecin = rdv.medecin || rdv.doctor || {};
                      const statut = rdv.statut || rdv.status || 'PLANIFIE';
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
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">{dateStr}</td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">{timeStr}</td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">{patient.prenom || ''} {patient.nom || ''}</td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">{medecin.prenom || ''} {medecin.nom || ''}</td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">{rdv.motif || '—'}</td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">{statut}</td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">{creatorName}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // (Chargement RDV patients retiré)

  // Génère les 6 semaines affichées (42 cases), en commençant lundi
  const calendarDays = React.useMemo(() => {
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
  const timeSlots = React.useMemo(() => {
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

  // Couleurs statut alignées avec la page complète
  const getPlanningClasses = (statut) => {
    switch (statut) {
      case 'EN_ATTENTE': return { box: 'bg-yellow-50 border-l-4 border-l-yellow-500', badge: 'bg-yellow-100 text-yellow-800', border: 'border-l-yellow-500' };
      case 'PLANIFIE': return { box: 'bg-blue-50 border-l-4 border-l-blue-500', badge: 'bg-blue-100 text-blue-800', border: 'border-l-blue-500' };
      case 'CONFIRME': return { box: 'bg-green-50 border-l-4 border-l-green-500', badge: 'bg-green-100 text-green-800', border: 'border-l-green-500' };
      case 'ANNULE': return { box: 'bg-red-50 border-l-4 border-l-red-500', badge: 'bg-red-100 text-red-800', border: 'border-l-red-500' };
      case 'ABSENT': return { box: 'bg-red-100 border-l-4 border-l-red-600', badge: 'bg-red-600 text-white font-bold', border: 'border-l-red-600' };
      case 'TERMINE': return { box: 'bg-gray-50 border-l-4 border-l-gray-500', badge: 'bg-gray-100 text-gray-800', border: 'border-l-gray-500' };
      default: return { box: 'bg-blue-50 border-l-4 border-l-blue-500', badge: 'bg-blue-100 text-blue-800', border: 'border-l-blue-500' };
    }
  };

  const getListBg = (statut) => {
    // Utiliser les mêmes couleurs que getPlanningClasses pour la cohérence
    switch (statut) {
      case 'EN_ATTENTE': return 'bg-yellow-50';
      case 'PLANIFIE': return 'bg-blue-50';
      case 'CONFIRME': return 'bg-green-50';
      case 'ANNULE': return 'bg-red-50';
      case 'ABSENT': return 'bg-red-100';
      case 'TERMINE': return 'bg-gray-50';
      default: return 'bg-blue-50';
    }
  };
  
  // Fonction unifiée pour obtenir les classes de badge (cohérence avec le planning)
  const getStatusBadgeClasses = (statut) => {
    const cls = getPlanningClasses(statut);
    return cls.badge;
  };

  // Récupération robuste du nom médecin pour affichage (plusieurs formats backend)
  const getDoctorName = (appt) => {
    if (!appt) return '';
    // Métadonnées possibles
    const metaName = appt?.payload?.metadata?.doctor_name || appt?.metadata?.doctor_name;
    if (metaName && String(metaName).trim()) return String(metaName).trim();
    // Chaînes directes
    const direct = appt?.medecinName || appt?.doctorName || appt?.medecin_nom_complet || appt?.praticien || '';
    if (direct && String(direct).trim()) return String(direct).trim();
    // IRI vers cache local si nécessaire
    const medecinField = appt?.medecin || appt?.doctor;
    if (typeof medecinField === 'string') {
      const iri = medecinField;
      const id = iri.includes('/') ? iri.split('/').pop() : iri;
      const inCache = medecinsById[id];
      if (inCache) {
        const fn = inCache.prenom || inCache.firstName || '';
        const ln = inCache.nom || inCache.lastName || '';
        const composed = `${fn} ${ln}`.trim();
        if (composed) return composed;
      }
    }
    // Objets usuels
    const m = (typeof medecinField === 'object' && medecinField) ? medecinField : (appt?.medecin || appt?.doctor || {});
    const prenom = m.prenom || m.firstName || m.givenName || appt?.medecin_prenom || '';
    const nom = m.nom || m.lastName || m.familyName || appt?.medecin_nom || '';
    const composed = `${prenom || ''} ${nom || ''}`.trim();
    if (composed) return composed;
    return '';
  };

  // RDV filtrés sur la journée sélectionnée
  const dayAppointments = React.useMemo(() => {
    const day = selectedDate;
    return (appointments || [])
      .filter(r => r?.statut !== 'ANNULE')
      .filter(r => {
        const d = new Date(r.startAt || r.start_at || r.appointmentTime || r.startTime || r.dateTime);
        return !isNaN(d) && sameDay(d, day);
      });
  }, [appointments, selectedDate]);

  // Indexation des RDV par créneau (HH:mm)
  const appointmentsBySlot = React.useMemo(() => {
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

  // Calcul des créneaux occupés par la durée (ex: 60min couvre 2 slots de 30min)
  const getApptDurationMinutes = (appt) => {
    // Priorités: champ direct, synonymes, calcul end-start, fallback 30
    const direct = appt?.duree ?? appt?.duration ?? appt?.dureeMinutes ?? appt?.lengthMinutes;
    if (typeof direct === 'number' && !isNaN(direct)) return direct;
    if (typeof direct === 'string' && direct.trim() && !isNaN(parseInt(direct, 10))) return parseInt(direct, 10);
    const start = appt?.startAt || appt?.start_at || appt?.appointmentTime || appt?.startTime || appt?.dateTime;
    const end = appt?.endAt || appt?.end_at || appt?.endTime;
    if (start && end) {
      const ds = new Date(start);
      const de = new Date(end);
      if (!isNaN(ds) && !isNaN(de)) {
        const mins = Math.max(0, Math.round((de.getTime() - ds.getTime()) / 60000));
        if (mins > 0) return mins;
      }
    }
    return 30;
  };

  const occupiedContinuationSlots = React.useMemo(() => {
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
        const idx = startIdx + i;
        if (idx >= 0 && idx < timeSlots.length) {
          occupied.add(timeSlots[idx].start);
        }
      }
    }
    return occupied;
  }, [dayAppointments, timeSlots]);

  const formatEndTimeFrom = (startHHmm, dureeMin) => {
    if (!startHHmm) return '';
    const [h, m] = startHHmm.split(":").map(n => parseInt(n, 10));
    const startTotal = h * 60 + m;
    const endTotal = startTotal + (parseInt(dureeMin || 30, 10));
    const endH = Math.floor(endTotal / 60);
    const endM = endTotal % 60;
    return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
  };

  const formatRangeForAppointment = (appt) => {
    const startRaw = appt?.startAt || appt?.start_at || appt?.appointmentTime || appt?.startTime || appt?.dateTime;
    const startHHmm = extractHHmm(startRaw);
    if (!startHHmm) return '';
    const endRaw = appt?.endAt || appt?.end_at || appt?.endTime;
    let endHHmm = extractHHmm(endRaw);
    if (!endHHmm) {
      const dmin = getApptDurationMinutes(appt);
      endHHmm = formatEndTimeFrom(startHHmm, dmin);
    }
    return `${startHHmm} à ${endHHmm}`;
  };


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

  // Edition de statut (corriger une erreur)
  const [editStatusId, setEditStatusId] = useState(null);
  const [editStatusValue, setEditStatusValue] = useState('');

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
        notes: newAppt.notes,
      };
      console.debug('[RDV] CREATE payload=', payload);
      await appointmentService.createAppointment(payload);
      console.debug('[RDV] CREATE ok');
      setShowCreate(false);
      setNewAppt({ patient: '', medecin: '', motif: '', date: '', heure: '', duree: '30', notes: '' });
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
    setEditAppt({
      patient: appt?.patient?.id || '',
      medecin: appt?.medecin?.id || appt?.doctor?.id || '',
      motif: appt?.motif || '',
      date,
      heure,
      duree: String(getApptDurationMinutes(appt)),
      notes: appt?.notes || ''
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
        notes: editAppt.notes,
      };
      console.debug('[RDV] EDIT payload=', payload);
      await appointmentService.updateAppointment(editApptId, payload);
      console.debug('[RDV] EDIT ok');
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
    <div className="min-h-screen p-6">
      
      {/* Titre centré avec icône et description */}
      <div className="text-center py-6 mb-6">
        <div className="bg-pink-200 rounded-lg shadow p-6 max-w-xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center shadow-sm">
              <span className="material-symbols-rounded text-pink-600 text-2xl">calendar_month</span>
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
        <div className="bg-pink-50 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-pink-700">Total aujourd'hui</p>
                <p className="text-3xl font-bold text-pink-800">{stats.total}</p>
            </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="material-symbols-rounded text-blue-600">event</span>
              </div>
          </div>
        </div>

        <div className="bg-pink-50 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-pink-700">Planifiés</p>
              <p className="text-3xl font-bold text-pink-800">{stats.planifies}</p>
            </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="material-symbols-rounded text-blue-600">event_upcoming</span>
              </div>
          </div>
        </div>
        <div className="bg-pink-50 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-pink-700">Confirmés</p>
              <p className="text-3xl font-bold text-pink-800">{stats.confirmes}</p>
            </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <span className="material-symbols-rounded text-green-600">check_circle</span>
              </div>
          </div>
        </div>
        
        <div className="bg-pink-50 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-pink-700">Absents</p>
              <p className="text-3xl font-bold text-red-600">{stats.absents}</p>
            </div>
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <span className="material-symbols-rounded text-red-600">person_off</span>
              </div>
          </div>
        </div>
      </div>

      {/* Bouton de sélection médecin centré entre stats et calendrier */}
      <div className="flex justify-center mb-6">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowDoctorPicker(v => !v)}
            className="inline-flex flex-col items-center gap-1 px-4 py-2 rounded-full bg-pink-600 text-white text-base font-bold hover:bg-pink-700 shadow text-center"
          >
            <span className="inline-flex items-center gap-2">
              <span className="material-symbols-rounded text-sm">stethoscope</span>
              {selectedMedecinId ? 'Changer de médecin' : 'Choisir le médecin'}
            </span>
            {selectedMedecinId && (
              <span className="block text-sm md:text-base font-bold opacity-95 leading-tight">
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
              <h3 className="text-xl font-bold text-pink-800 flex items-center gap-2 m-0">
                <span className="material-symbols-rounded text-pink-600">calendar_month</span>
                Calendrier
              </h3>
              <div />
            </div>
            <div className="flex items-center justify-between mb-4">
              <button onClick={goToPreviousMonth} className="p-2 hover:bg-pink-100 rounded-lg transition-colors text-pink-700">
                <span className="material-symbols-rounded">chevron_left</span>
              </button>
              <h4 className="text-lg font-semibold text-pink-700">
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
              <h3 className="text-lg font-semibold text-pink-800 flex items-center gap-2">
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
                    return (
                      <div key={slot.start} style={{ minHeight: HAUTEUR_MIN_CARTE_CRENEAU * slotsToCover }} className={`border border-pink-200 rounded-lg p-3 bg-white transition-all shadow-sm ${hasStarter ? 'hover:bg-pink-50' : 'cursor-pointer hover:bg-pink-100 hover:shadow-md hover:border-pink-300 hover:scale-[1.02]'}`}>
                        <div className="text-sm font-medium text-pink-700 mb-2 font-semibold">{slot.start} - {hasStarter ? formatEndTimeFrom(slot.start, dureeMin) : slot.end}</div>
                        <div>
                          {hasStarter ? (() => {
                            const cls = getPlanningClasses(first?.statut);
                            return (
                              <div className={`${cls.box} p-3 rounded-lg`}>
                                <div className="text-xs">
                                  <div className="font-semibold">{first?.patient?.prenom} {first?.patient?.nom}</div>
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
                              <span className="text-xs text-pink-600">Libre</span>
                              <button onClick={() => {
                                const y = selectedDate.getFullYear();
                                const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
                                const d = String(selectedDate.getDate()).padStart(2, '0');
                                setNewAppt(a => ({ ...a, date: `${y}-${m}-${d}`, heure: slot.start }));
                                setShowCreate(true);
                              }} className="text-pink-600 hover:text-pink-800 hover:bg-pink-100 rounded-full p-1 transition-all" title="Ajouter un RDV">
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
                    return (
                      <div key={slot.start} style={{ minHeight: HAUTEUR_MIN_CARTE_CRENEAU * slotsToCover }} className={`border border-pink-200 rounded-lg p-3 bg-white transition-all shadow-sm ${hasStarter ? 'hover:bg-pink-50' : 'cursor-pointer hover:bg-pink-100 hover:shadow-md hover:border-pink-300 hover:scale-[1.02]'}`}>
                        <div className="text-sm font-medium text-pink-700 mb-2 font-semibold">{slot.start} - {hasStarter ? formatEndTimeFrom(slot.start, dureeMin) : slot.end}</div>
                        <div>
                          {hasStarter ? (() => {
                            const cls = getPlanningClasses(first?.statut);
                            return (
                              <div className={`${cls.box} p-3 rounded-lg`}>
                                <div className="text-xs">
                                  <div className="font-semibold">{first?.patient?.prenom} {first?.patient?.nom}</div>
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
                              <span className="text-xs text-pink-600">Libre</span>
                              <button onClick={() => {
                                const y = selectedDate.getFullYear();
                                const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
                                const d = String(selectedDate.getDate()).padStart(2, '0');
                                setNewAppt(a => ({ ...a, date: `${y}-${m}-${d}`, heure: slot.start }));
                                setShowCreate(true);
                              }} className="text-pink-600 hover:text-pink-800 hover:bg-pink-100 rounded-full p-1 transition-all" title="Ajouter un RDV">
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
          <h3 className="text-lg font-semibold text-pink-800 flex items-center gap-2 m-0">
            <span className="material-symbols-rounded text-pink-600">list</span>
            Liste des rendez-vous
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => {
                loadAppointments();
                setError(null);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              title="Rafraîchir la liste des rendez-vous"
            >
              <span className="material-symbols-rounded text-base">refresh</span>
              Rafraîchir
            </button>
            {!isFormateur && (
              <button
                onClick={() => {
                  const useHistory = filters.useHistoryEndpoint === true;
                  setFilters(prev => ({
                    ...prev,
                    useHistoryEndpoint: !useHistory,
                    skipAutoFilter: !useHistory,
                    page: 1
                  }));
                }}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  filters.useHistoryEndpoint 
                    ? 'bg-green-600 text-white hover:bg-green-700' 
                    : 'bg-gray-600 text-white hover:bg-gray-700'
                }`}
                title={filters.useHistoryEndpoint ? "Voir mes rendez-vous uniquement" : "Voir tous les rendez-vous"}
              >
                <span className="material-symbols-rounded text-base">
                  {filters.useHistoryEndpoint ? 'person' : 'people'}
                </span>
                {filters.useHistoryEndpoint ? 'Mes rendez-vous' : 'Tous les rendez-vous'}
              </button>
            )}
          </div>
        </div>
        <div className="px-6 py-2 bg-pink-100 border-b border-pink-200">
          {/* Avertissement si un filtre de date limite l'affichage */}
          {(filters.dateDebut || filters.dateFin) && (
            <div className="mb-3 bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 flex items-start justify-between shadow-sm">
              <div className="flex items-start gap-3 flex-1">
                <span className="material-symbols-rounded text-yellow-600 text-2xl">warning</span>
                <div className="flex-1">
                  <p className="text-base font-bold text-yellow-900 mb-2">
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
                <span className="material-symbols-rounded text-xl">close</span>
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
            <select 
              value={filters.patientId || ''} 
              onChange={(e) => setFilters(f => ({ 
                ...f, 
                patientId: e.target.value || undefined,
                page: 1
              }))} 
              className="px-3 py-1 text-xs border border-pink-300 rounded"
            >
              <option value="">Tous les patients</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>
              ))}
            </select>

          {loading && (
              <div className="flex items-center text-sm text-gray-500 ml-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-pink-500 mr-2"></div>
              Chargement...
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
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto"></div>
            <p className="mt-2 text-gray-600">Chargement des rendez-vous...</p>
            </div>
        ) : appointments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {selectedMedecinId ? 'Aucun rendez-vous trouvé pour ce médecin' : 'Aucun rendez-vous trouvé'}
            </div>
        ) : (
            <div className="space-y-4">
            {(() => {
              // Filtrer les rendez-vous
              const filteredAppointments = appointments.filter(a => {
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
                          <span className={`font-semibold text-lg`}>{initials}</span>
                          </div>
                          <div>
                            <div className="font-semibold text-gray-800">
                              {patient.prenom} {patient.nom}
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
            <h3 className="text-lg font-semibold text-pink-800 flex items-center gap-2 m-0">
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
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-pink-100">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-pink-700 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-pink-700 uppercase tracking-wider">Heure</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-pink-700 uppercase tracking-wider">Patient</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-pink-700 uppercase tracking-wider">Médecin</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-pink-700 uppercase tracking-wider">Motif</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-pink-700 uppercase tracking-wider">Statut</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-pink-700 uppercase tracking-wider">Créé par</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-pink-200">
                    {trainerAppointments.map((rdv, index) => {
                      const d = new Date(rdv.startAt || rdv.start_at || rdv.appointmentTime || rdv.startTime || rdv.dateTime);
                      const dateStr = !isNaN(d) ? d.toLocaleDateString('fr-FR') : '—';
                      const timeStr = !isNaN(d) ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
                      const patient = rdv.patient || {};
                      const medecin = rdv.medecin || rdv.doctor || {};
                      const statut = rdv.statut || rdv.status || 'PLANIFIE';
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
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">{dateStr}</td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">{timeStr}</td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">{patient.prenom || ''} {patient.nom || ''}</td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">{medecin.prenom || ''} {medecin.nom || ''}</td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">{rdv.motif || '—'}</td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">{statut}</td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">{creatorName}</td>
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
                          <span className="material-symbols-rounded text-base">chevron_left</span>
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
                          <span className="material-symbols-rounded text-base">chevron_right</span>
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
                <h3 className="text-lg font-semibold text-pink-800">Nouveau Rendez-vous</h3>
              </div>
              <button onClick={() => setShowCreate(false)} className="text-pink-500 hover:text-pink-700 rounded-full p-1 hover:bg-pink-100" aria-label="Fermer">
                <span className="material-symbols-rounded">close</span>
                </button>
              </div>
            <form onSubmit={createAppointment} className="px-6 py-5 space-y-5">
              {createError && (
                <div className="bg-red-100 border border-red-300 text-red-800 px-4 py-2 rounded">{createError}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-pink-800 mb-1">Patient</label>
                <select value={newAppt.patient} onChange={(e) => setNewAppt(a => ({ ...a, patient: e.target.value }))} className="w-full border border-pink-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-400 bg-pink-50">
                  <option value="">— Sélectionner —</option>
                  {patients.map(p => {
                    const id = getPatientId(p);
                    if (!id) return null;
                    const info = getPatientStatusInfo(p);
                    const name = `${p.prenom || p.firstName || ''} ${p.nom || p.lastName || ''}`.trim() || (p.email || `Patient ${id}`);
                    const statusSuffix = info.label ? ` — ${info.label}${info.icon ? ` ${info.icon}` : ''}` : '';
                    return (
                      <option key={id} value={id} disabled={info.isDeceased}>
                        {name}{statusSuffix}{info.isDeceased ? ' (bloqué)' : ''}
                      </option>
                    );
                  })}
                </select>
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
                <h3 className="text-lg font-semibold text-pink-800">Modifier le Rendez-vous</h3>
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



