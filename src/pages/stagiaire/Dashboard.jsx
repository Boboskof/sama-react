import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import appointmentService from "../../_services/appointment.service";
import patientService from "../../_services/patient.service";
import medecinService from "../../_services/medecin.service";
import userService from "../../_services/user.service";
import stagiaireNoteService from "../../_services/stagiaire-note.service";
import justificatifService from "../../_services/justificatif.service";
import LoadingSpinner from "../../components/LoadingSpinner";
import ErrorMessage from "../../components/ErrorMessage";
import NotesList from "../../components/NotesList";
import { useTodayAppointments } from "../../hooks/useAppointments";

const Dashboard = () => {
  // États principaux
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // React Query hooks pour les rendez-vous
  const { 
    data: todayAppointmentsData = [], 
    isLoading: appointmentsLoading, 
    error: appointmentsError 
  } = useTodayAppointments();
  
  // États des données
  const [coverageAlerts, setCoverageAlerts] = useState({ manquantes: [], expirees: [] });
  // Notes du formateur
  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  // Médecins et sélection
  const [medecins, setMedecins] = useState([]);
  const [selectedMedecinId, setSelectedMedecinId] = useState('');
  // Stats couvertures
  const [coverageStats, setCoverageStats] = useState({
    couverturesValid: 0,
    couverturesExpired: 0,
    couverturesToCheck: 0
  });
  // Dossiers incomplets
  const [patientsIncomplets, setPatientsIncomplets] = useState([]);
  const [incompleteDossiers, setIncompleteDossiers] = useState(0);
  // Pagination des patients incomplets
  const [currentPage, setCurrentPage] = useState(1);
  const patientsPerPage = 5;

  // Chargement des données du dashboard
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      // Charger l'utilisateur connecté (fallback localStorage)
      const storedUser = userService.getUser?.() || null;
      if (storedUser) {
        setUser(storedUser);
      }
      const currentUser = await userService.getCurrentUser().catch(() => storedUser || null);
      setUser(currentUser);

      if (!currentUser) {
        return;
      }

      // Charger les données essentielles en parallèle
      const [alerts, medecinsList, patientsIncompletsData] = await Promise.all([
        patientService.getCoverageAlerts().catch(() => ({ manquantes: [], expirees: [] })),
        medecinService.getAllMedecins().catch(() => []),
        justificatifService.getPatientsIncomplets().catch(() => ({ data: [], total: 0 }))
      ]);
      
      // Couvertures mutuelles (via endpoint de stats dédié)
      try {
        const s = await patientService.getCoverageStatus();
        setCoverageStats({
          couverturesValid: s.valides || 0,
          couverturesExpired: s.expirees || 0,
          couverturesToCheck: s.manquantes || 0
        });
      } catch {
        // Fallback silencieux
      }
      
      // Charger les notes du formateur pour ce stagiaire (utilise /api/me/notes)
      setNotesLoading(true);
      try {
        const notesList = await stagiaireNoteService.getMyNotes('DESC');
        if (import.meta.env.DEV) {
          console.log('📝 Notes chargées dans Dashboard:', notesList);
        }
        setNotes(Array.isArray(notesList) ? notesList : []);
      } catch (err) {
        console.error('❌ Erreur chargement notes dans Dashboard:', err);
        setNotes([]);
      } finally {
        setNotesLoading(false);
      }
      
      // Mettre à jour les états
      setCoverageAlerts({
        manquantes: Array.isArray(alerts?.manquantes) ? alerts.manquantes : [],
        expirees: Array.isArray(alerts?.expirees) ? alerts.expirees : [],
      });
      setMedecins(Array.isArray(medecinsList) ? medecinsList : []);
      
      // Dossiers incomplets
      const patientsIncompletsList = Array.isArray(patientsIncompletsData?.data) ? patientsIncompletsData.data : [];
      setPatientsIncomplets(patientsIncompletsList);
      setIncompleteDossiers(patientsIncompletsData?.total || 0);

    } catch (error) {
      console.error("Erreur lors du chargement des données:", error);
      setError(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Réinitialiser la page à 1 quand la liste des patients change
  useEffect(() => {
    setCurrentPage(1);
  }, [patientsIncomplets.length]);

  // Gérer les erreurs React Query
  useEffect(() => {
    if (appointmentsError) {
      setError(appointmentsError);
    }
  }, [appointmentsError]);

  // Pagination des patients incomplets
  const paginatedPatients = useMemo(() => {
    const startIndex = (currentPage - 1) * patientsPerPage;
    const endIndex = startIndex + patientsPerPage;
    return patientsIncomplets.slice(startIndex, endIndex);
  }, [patientsIncomplets, currentPage, patientsPerPage]);

  const totalPages = Math.ceil(patientsIncomplets.length / patientsPerPage);

  // Filtrer et trier les rendez-vous d'aujourd'hui par médecin sélectionné
  const filteredTodayAppointments = useMemo(() => {
    if (!Array.isArray(todayAppointmentsData) || todayAppointmentsData.length === 0) {
      return [];
    }
    
    // Filtrer par médecin si sélectionné
    let filtered = todayAppointmentsData;
    if (selectedMedecinId) {
      filtered = todayAppointmentsData.filter(rdv => {
        const med = rdv.medecin || rdv.doctor;
        const medId = typeof med === 'object' ? med?.id : med;
        return String(medId) === String(selectedMedecinId);
      });
    }
    
    // Filtrer par date du jour
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    filtered = filtered.filter(rdv => {
      const start = rdv.startAt || rdv.start_at || rdv.appointmentTime;
      if (!start) return false;
      const rdvDate = new Date(start);
      rdvDate.setHours(0, 0, 0, 0);
      return rdvDate.getTime() === today.getTime();
    });
    
    // Trier par horaire (du plus tôt au plus tard)
    return filtered.sort((a, b) => {
      const startA = a.startAt || a.start_at || a.appointmentTime;
      const startB = b.startAt || b.start_at || b.appointmentTime;
      
      if (!startA && !startB) return 0;
      if (!startA) return 1;
      if (!startB) return -1;
      
      const dateA = new Date(startA);
      const dateB = new Date(startB);
      
      if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
      if (isNaN(dateA.getTime())) return 1;
      if (isNaN(dateB.getTime())) return -1;
      
      return dateA.getTime() - dateB.getTime();
    });
  }, [todayAppointmentsData, selectedMedecinId]);


  const formatTime = (timeString) => {
    if (!timeString) return "";
    const date = new Date(timeString);
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner message="Chargement des données..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      {/* Titre centré avec icône et description */}
      <div className="text-center py-6 mb-6">
        <div className="bg-blue-200 rounded-lg shadow p-6 max-w-xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center shadow-sm">
              <span className="material-symbols-rounded text-blue-600 text-2xl">dashboard</span>
            </div>
            <h1 className="text-2xl font-bold text-blue-800">Tableau de Bord</h1>
          </div>
          <p className="text-blue-700 text-sm">
            Vue d'ensemble de votre activité médicale
          </p>
        </div>
      </div>

      {/* Message d'erreur global */}
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

      <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold text-green-600">
                {user?.prenom?.[0] || 'S'}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Bonjour {user?.prenom} {user?.nom}
              </h1>
              <p className="text-gray-600">Stagiaire - {user?.section || 'Formation médicale'}</p>
            </div>
          </div>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex space-x-3">
              <Link to="/patients/nouveau" className="bg-orange-100 text-orange-700 px-4 py-2 rounded-lg hover:bg-orange-200 transition-colors shadow-md flex items-center gap-2">
                <span className="material-symbols-rounded">person_add</span>
                Nouveau patient
              </Link>
              <Link to="/appointments" className="bg-pink-100 text-pink-700 px-4 py-2 rounded-lg hover:bg-pink-200 transition-colors shadow-md flex items-center gap-2">
                <span className="material-symbols-rounded">event</span>
                Nouveau RDV
              </Link>
              <Link to="/documents" className="bg-green-100 text-green-700 px-4 py-2 rounded-lg hover:bg-green-200 transition-colors shadow-md flex items-center gap-2">
                <span className="material-symbols-rounded">upload_file</span>
                Upload document
              </Link>
              <Link
                to="/communications"
                className="bg-purple-100 text-purple-700 px-4 py-2 rounded-lg hover:bg-purple-200 transition-colors shadow-md flex items-center gap-2"
              >
                <span className="material-symbols-rounded">chat</span>
                Nouvelle communication
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Notes du formateur */}
      <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border-l-4 border-indigo-400 mb-6">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <span className="material-symbols-rounded text-indigo-600">note</span>
              Notes du formateur
            </h2>
          </div>
        </div>
        <div className="p-6">
          <NotesList 
            notes={notes} 
            loading={notesLoading}
            canDelete={false}
          />
        </div>
      </div>

      {/* Sections principales */}
      <div className="grid grid-cols-1 gap-6 mb-6">
        {/* Gestion des patients - Dossiers incomplets uniquement */}
        <div className="bg-orange-50/90 backdrop-blur-sm rounded-lg shadow-lg border-l-4 border-orange-400">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <span className="material-symbols-rounded text-orange-600">groups</span>
                Gestion des patients
              </h2>
              <div className="flex space-x-2">
                <Link to="/patients/nouveau" className="bg-orange-600 text-white px-3 py-1 rounded text-sm hover:bg-orange-700 shadow-sm flex items-center gap-1">
                  <span className="material-symbols-rounded text-white text-base">person_add</span>
                  Nouveau
                </Link>
                <Link to="/patients" className="bg-slate-600 text-white px-3 py-1 rounded text-sm hover:bg-slate-700 shadow-sm flex items-center gap-1">
                  <span className="material-symbols-rounded text-white text-base">search</span>
                  Rechercher
                </Link>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">
                Dossiers incomplets {incompleteDossiers > 0 && `(${incompleteDossiers})`}
              </h3>
              {patientsIncomplets.length === 0 ? (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-3">
                    <span className="material-symbols-rounded text-green-600 text-3xl">check_circle</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-700">Tous les dossiers sont complets !</p>
                  <p className="text-sm text-gray-500 mt-1">Aucun justificatif manquant</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {paginatedPatients.map((patient) => (
                      <div key={patient.id} className="bg-white border-l-4 border-yellow-400 rounded-lg shadow-sm p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="text-sm font-semibold text-gray-900">
                              {patient.prenom} {patient.nom}
                            </h4>
                            {patient.email && (
                              <p className="text-xs text-gray-500 mt-1">{patient.email}</p>
                            )}
                          </div>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-300">
                            {patient.totalManquants} manquant{patient.totalManquants > 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="mt-3">
                          <p className="text-xs font-medium text-gray-700 mb-2">Justificatifs manquants :</p>
                          <ul className="space-y-1">
                            {patient.justificatifsManquants.map((justificatif) => (
                              <li key={justificatif.type} className="flex items-center gap-2 text-xs text-red-600">
                                <span className="material-symbols-rounded text-base">description</span>
                                <span>{justificatif.label}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="mt-3 flex justify-end">
                          <Link
                            to={`/patients/${patient.id}`}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                          >
                            Voir le dossier
                            <span className="material-symbols-rounded text-sm">arrow_forward</span>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Contrôles de pagination */}
                  {totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
                      <div className="text-sm text-gray-600">
                        Page {currentPage} sur {totalPages} ({patientsIncomplets.length} patient{patientsIncomplets.length > 1 ? 's' : ''})
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          className="px-3 py-1.5 text-sm font-medium text-orange-700 bg-orange-100 rounded-lg hover:bg-orange-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                        >
                          <span className="material-symbols-rounded text-base">chevron_left</span>
                          Précédent
                        </button>
                        <button
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                          className="px-3 py-1.5 text-sm font-medium text-orange-700 bg-orange-100 rounded-lg hover:bg-orange-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                        >
                          Suivant
                          <span className="material-symbols-rounded text-base">chevron_right</span>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Planning des rendez-vous - Avec sélecteur de médecin */}
        <div className="bg-pink-50/90 backdrop-blur-sm rounded-lg shadow-lg border-l-4 border-pink-400">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <span className="material-symbols-rounded text-pink-600">calendar_month</span>
                Planning des rendez-vous
              </h2>
            </div>
          </div>
          <div className="p-6">
            {/* Sélecteur de médecin */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filtrer par médecin
              </label>
              <select
                value={selectedMedecinId}
                onChange={(e) => setSelectedMedecinId(e.target.value)}
                className="w-full md:w-1/3 px-3 py-2 border border-pink-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white"
              >
                <option value="">Tous les médecins</option>
                {medecins.map((med) => (
                  <option key={med.id} value={med.id}>
                    Dr {med.nom?.toUpperCase() || ''} {med.prenom || ''} {med.specialite ? `— ${med.specialite}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Liste RDV du jour */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">
                Rendez-vous d'aujourd'hui{selectedMedecinId ? ` (médecin sélectionné)` : ''}
              </h3>
              {appointmentsLoading && (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-pink-500"></div>
                  <span className="ml-2 text-sm text-gray-600">Chargement...</span>
                </div>
              )}
              {!appointmentsLoading && (
                <div className="space-y-3">
                  {filteredTodayAppointments.map((rdv, index) => {
                    const start = rdv.startAt || rdv.start_at || rdv.appointmentTime;
                    const med = rdv.medecin || rdv.doctor || {};
                    const medNomUpper = (med.nom || med.lastName || '').toUpperCase();
                    const medPrenom = med.prenom || med.firstName || '';
                    const spec = med?.specialite?.label || med?.specialite?.nom || med?.specialite || med?.specialty?.name || med?.specialty || '';
                    const sRaw = (rdv.statut || rdv.status || '').toString().toUpperCase();
                    const isPlan = sRaw.includes('PLAN');
                    const isConf = sRaw.includes('CONFIRM');
                    const isAbs = sRaw.includes('ABSEN');
                    const isAnn = sRaw.includes('ANNU');
                    const badgeCls = isConf
                      ? 'bg-green-100 text-green-800'
                      : isPlan
                        ? 'bg-blue-100 text-blue-800'
                        : isAbs
                          ? 'bg-purple-100 text-purple-800'
                          : isAnn
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800';
                    const label = isConf ? 'Confirmé' : isPlan ? 'Planifié' : isAbs ? 'Absent' : isAnn ? 'Annulé' : 'Inconnu';
                    return (
                      <div key={rdv.id || index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="text-sm font-medium text-gray-900">
                            {formatTime(start)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {rdv.patient?.prenom} {rdv.patient?.nom}
                            </p>
                            <p className="text-xs text-gray-500">
                              {rdv.motif}
                              {medNomUpper ? (
                                <> • Dr <span className="font-extrabold">{medNomUpper}</span> <span className="font-semibold">{medPrenom}</span>{spec ? ` — ${spec}` : ''}</>
                              ) : null}
                            </p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${badgeCls}`}>{label}</span>
                        </div>
                      </div>
                    );
                  })}
                  {filteredTodayAppointments.length === 0 && !appointmentsLoading && (
                    <p className="text-gray-500 text-sm text-center py-4">
                      {selectedMedecinId ? 'Aucun rendez-vous aujourd\'hui pour ce médecin' : 'Aucun rendez-vous aujourd\'hui'}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Couvertures mutuelles - Inchangé */}
      <div className="bg-orange-50/90 backdrop-blur-sm rounded-lg shadow-lg border-l-4 border-orange-400 mb-6">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <span className="material-symbols-rounded text-orange-600">health_and_safety</span>
              Couvertures mutuelles
            </h2>
          </div>
        </div>
        <div className="p-6">
          {/* Statistiques couvertures: Valides / Expirées / Manquantes */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{coverageStats.couverturesValid}</p>
              <p className="text-sm text-gray-500">Valides</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{coverageStats.couverturesExpired}</p>
              <p className="text-sm text-gray-500">Expirées</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">{coverageStats.couverturesToCheck}</p>
              <p className="text-sm text-gray-500">Manquantes</p>
            </div>
          </div>

          {/* Alertes couvertures */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Alertes couvertures</h3>
            {/* Manquantes */}
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-yellow-700 mb-2">Manquantes ({coverageAlerts.manquantes.length})</h4>
              {coverageAlerts.manquantes.length === 0 ? (
                <p className="text-xs text-gray-500">Aucune</p>
              ) : (
                <ul className="space-y-2">
                  {coverageAlerts.manquantes.slice(0, 5).map((it, idx) => (
                    <li key={idx} className="flex items-center justify-between text-sm bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
                      <span>{it.patient?.prenom || ''} {it.patient?.nom || ''}</span>
                      {it.patient?.id && (
                        <Link to={`/patients/${it.patient.id}`} className="text-blue-600 hover:text-blue-800 text-xs">Ouvrir</Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {/* Expirées */}
            <div>
              <h4 className="text-sm font-semibold text-red-700 mb-2">Expirées ({coverageAlerts.expirees.length})</h4>
              {coverageAlerts.expirees.length === 0 ? (
                <p className="text-xs text-gray-500">Aucune</p>
              ) : (
                <ul className="space-y-2">
                  {coverageAlerts.expirees.slice(0, 5).map((it, idx) => (
                    <li key={idx} className="text-sm bg-red-50 border border-red-200 rounded px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span>{it.patient?.prenom || ''} {it.patient?.nom || ''}</span>
                        {it.patient?.id && (
                          <Link to={`/patients/${it.patient.id}`} className="text-blue-600 hover:text-blue-800 text-xs">Ouvrir</Link>
                        )}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {it.mutuelle ? `Mutuelle: ${it.mutuelle}` : ''}
                        {it.numeroAdherent ? ` • Adhérent: ${it.numeroAdherent}` : ''}
                        {it.dateFin ? ` • Fin: ${new Date(it.dateFin).toLocaleDateString('fr-FR')}` : ''}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
