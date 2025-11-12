import React, { useEffect, useMemo, useState } from "react";
import { useQueryClient } from '@tanstack/react-query';
import { useCommunications, useCommunicationStats, useCommunicationTypes } from "../../hooks/useCommunications";
import userService from "../../_services/user.service";
import patientService from "../../_services/patient.service";
import appointmentService from "../../_services/appointment.service";
import { communicationService } from "../../_services/communication.service";

const formulaireCommunicationInitial = {
  patient_id: '',
  rendez_vous_id: '',
  type: '',
  canal: '',
  sujet: '',
  contenu: '',
  template: ''
};

// Page alignée sur le style et les fonctionnalités de Communications.jsx
const CommunicationsWithQuery = () => {
  const queryClient = useQueryClient();
  const isFormateur = userService.isFormateur && userService.isFormateur();

  // États pour les filtres (structure alignée)
  const [filters, setFilters] = useState({
    type: [],
    statut: [],
    canal: [],
    patientId: undefined,
    dateDebut: undefined,
    dateFin: undefined,
    page: 1,
    limit: 25
  });

  // Vue dédiée Rappels RDV: 10 lignes, paginées
  const [showRemindersOnly, setShowRemindersOnly] = useState(false);
  useEffect(() => {
    if (showRemindersOnly) {
      setFilters(prev => ({ ...prev, type: ['RAPPEL_RDV'], page: 1, limit: 10 }));
    }
  }, [showRemindersOnly]);

  // Données via TanStack Query
  const {
    data: communications = [],
    isLoading,
    error,
    isFetching,
  } = useCommunications(filters);
  const { data: stats = {} } = useCommunicationStats(filters);
  const { data: typesData } = useCommunicationTypes();

  // États complémentaires pour aligner les fonctionnalités
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [globalMessage, setGlobalMessage] = useState({ type: '', text: '' });
  const [showSendModal, setShowSendModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCommunication, setSelectedCommunication] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);

  const [sendForm, setSendForm] = useState(() => ({ ...formulaireCommunicationInitial }));

  // Types et canaux (fallback si hook vide) avec templates par défaut
  const typesFallback = [
    {
      value: 'RAPPEL_RDV',
      label: 'Rappel de Rendez-vous',
      icon: 'calendar',
      description: 'Rappeler un rendez-vous à venir',
      template: 'Bonjour {patient_nom}, votre rendez-vous est prévu le {date_rdv} à {heure_rdv}. '
    },
    {
      value: 'DEMANDE_DOC',
      label: 'Demande de Document',
      icon: 'file-text',
      description: 'Demander un document au patient',
      template: 'Bonjour {patient_nom}, nous avons besoin de votre {type_document}.'
    },
    {
      value: 'CONFIRMATION_RDV',
      label: 'Confirmation de Rendez-vous',
      icon: 'check-circle',
      description: 'Confirmer un rendez-vous',
      template: 'Bonjour {patient_nom}, votre rendez-vous du {date_rdv} est confirmé.'
    },
    {
      value: 'ANNULATION_RDV',
      label: 'Annulation de Rendez-vous',
      icon: 'x-circle',
      description: 'Annuler un rendez-vous',
      template: 'Bonjour {patient_nom}, votre rendez-vous du {date_rdv} est annulé.'
    },
    {
      value: 'RESULTATS_ANALYSES',
      label: "Résultats d'Analyses",
      icon: 'activity',
      description: "Envoyer les résultats d'analyses",
      template: "Bonjour {patient_nom}, vos résultats d'analyses sont disponibles."
    },
    {
      value: 'RAPPEL_VACCINATION',
      label: 'Rappel de Vaccination',
      icon: 'shield',
      description: 'Rappeler une vaccination',
      template: 'Bonjour {patient_nom}, il est temps de faire votre rappel de vaccination.'
    }
  ];

  const communicationTypes = useMemo(() => {
    const mapToRich = (arr) => (arr || []).map((t) => {
      if (typeof t === 'string') {
        return typesFallback.find(f => f.value === t) || { value: t, label: t, template: '' };
      }
      // Objet déjà enrichi
      return t;
    });
    if (Array.isArray(typesData) && typesData.length > 0) return mapToRich(typesData);
    if (Array.isArray(typesData?.types) && typesData.types.length > 0) return mapToRich(typesData.types);
    return typesFallback;
  }, [typesData]);
  const canaux = (typesData?.canals && Array.isArray(typesData.canals))
    ? typesData.canals
    : [
        { value: 'EMAIL', label: 'Email', icon: 'mail' },
        { value: 'SMS', label: 'SMS', icon: 'message-square' },
        { value: 'TELEPHONE', label: 'Téléphone', icon: 'phone' }
      ];

  const statusConfig = {
    ENVOYE: { color: 'green', icon: 'check-circle', label: 'Envoyé' },
    EN_ATTENTE: { color: 'yellow', icon: 'clock', label: 'En attente' },
    ECHEC: { color: 'red', icon: 'x-circle', label: 'Échec' },
    BROUILLON: { color: 'gray', icon: 'edit', label: 'Brouillon' }
  };

  const quickActions = [
    { id: 'rappel-rdv', label: 'Rappel RDV', icon: 'calendar', color: 'blue', type: 'RAPPEL_RDV' },
    { id: 'demande-doc', label: 'Demande Document', icon: 'file-text', color: 'green', type: 'DEMANDE_DOC' },
    { id: 'confirmation-rdv', label: 'Confirmation RDV', icon: 'check-circle', color: 'green', type: 'CONFIRMATION_RDV' },
    { id: 'annulation-rdv', label: 'Annulation RDV', icon: 'x-circle', color: 'red', type: 'ANNULATION_RDV' },
  ];

  // Charger patients et rendez-vous (aligné avec Communications.jsx)
  useEffect(() => {
    const load = async () => {
      try {
        const page = filters.page || 1;
        const perPage = filters.limit || 25;
        const [patientsData, appointmentsData] = await Promise.all([
          isFormateur
            ? patientService.getFormateurPatients(page, perPage).catch(() => [])
            : patientService.getAllPatients().catch(() => []),
          isFormateur
            ? appointmentService.getFormateurAppointments(page, perPage).catch(() => [])
            : appointmentService.getAllAppointments().catch(() => [])
        ]);
        setPatients(Array.isArray(patientsData) ? patientsData : []);
        setAppointments(Array.isArray(appointmentsData) ? appointmentsData : []);
      } catch (e) {
        setPatients([]);
        setAppointments([]);
      }
    };
    load();
  }, [isFormateur, filters.page, filters.limit]);

  const rdvsForSelectedPatient = useMemo(() => {
    if (!sendForm.patient_id) return [];
    return appointments
      .filter(a => (a.patient?.id ?? a.patient_id) === sendForm.patient_id)
      .sort((a, b) => new Date(b.startAt ?? b.start_at) - new Date(a.startAt ?? a.start_at));
  }, [appointments, sendForm.patient_id]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1 // Reset à la page 1 lors du changement de filtre
    }));
  };

  const getPatientLabel = (p) => {
    if (!p) return "Patient inconnu";
    if (typeof p === "string") return "Patient inconnu";
    const prenom = p?.prenom || "";
    const nom = p?.nom || "";
    return (prenom || nom) ? `${prenom} ${nom}`.trim() : "Patient inconnu";
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const openSendModal = (actionType = null) => {
    let formulaire = { ...formulaireCommunicationInitial };
    if (actionType) {
      const action = quickActions.find(a => a.id === actionType);
      if (action) {
        const typeSelectionne = communicationTypes.find(t => t.value === action.type);
        formulaire = {
          ...formulaire,
          type: action.type,
          sujet: typeSelectionne?.label || '',
          canal: 'EMAIL'
        };
      }
    }
    setSendForm(formulaire);
    setShowSendModal(true);
  };

  const closeSendModal = () => {
    setShowSendModal(false);
    setSendForm({ ...formulaireCommunicationInitial });
  };

  const QUICK_TYPES = ['RAPPEL_RDV', 'CONFIRMATION_RDV', 'ANNULATION_RDV'];

  // Ouvrir les détails avec récupération complète
  const openDetails = async (comm) => {
    try {
      const commId = String(comm.id || comm['@id']?.split('/')?.pop() || '');
      let full = comm;
      if (commId) {
        try {
          const fetched = await communicationService.getCommunication(commId);
          full = fetched?.data || fetched || comm;
        } catch {}
      }
      setSelectedCommunication(full);
      setShowDetailModal(true);
    } catch {
      setSelectedCommunication(comm);
      setShowDetailModal(true);
    }
  };

  const handleSendCommunication = async (e) => {
    e.preventDefault();
    try {
      setLoadingAction(true);

      let sujet = sendForm.sujet;
      let contenu = sendForm.contenu;
      const selectedType = communicationTypes.find(t => (t.value || t) === sendForm.type);
      if (selectedType) {
        const stLabel = typeof selectedType === 'string' ? selectedType : (selectedType.label || sendForm.sujet);
        sujet = stLabel;
        let tpl = (typeof selectedType === 'string' ? (typesFallback.find(f => f.value === selectedType)?.template || '') : (selectedType.template || ''));
        const patient = patients.find(p => p.id === sendForm.patient_id);
        const rdv = appointments.find(a => a.id === sendForm.rendez_vous_id);
        const patient_nom = patient ? `${patient.prenom ?? ''} ${patient.nom ?? ''}`.trim() : '';
        const startAt = rdv ? (rdv.startAt ?? rdv.start_at) : undefined;
        const date_rdv = startAt ? new Date(startAt).toLocaleDateString('fr-FR') : '';
        const heure_rdv = startAt ? new Date(startAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
        contenu = tpl
          .replace('{patient_nom}', patient_nom)
          .replace('{date_rdv}', date_rdv)
          .replace('{heure_rdv}', heure_rdv);
      }

      const communicationData = { ...sendForm, sujet, contenu };

      let createdCommunication;
      if (sendForm.type === 'RAPPEL_RDV' && sendForm.rendez_vous_id) {
        createdCommunication = await communicationService.sendRappelRendezVous(sendForm.rendez_vous_id, communicationData);
      } else if (sendForm.type === 'CONFIRMATION_RDV' && sendForm.rendez_vous_id) {
        createdCommunication = await communicationService.sendConfirmationRendezVous(sendForm.rendez_vous_id, communicationData);
      } else if (sendForm.type === 'ANNULATION_RDV' && sendForm.rendez_vous_id) {
        createdCommunication = await communicationService.sendAnnulationRendezVous(sendForm.rendez_vous_id, communicationData);
      } else if (sendForm.type === 'DEMANDE_DOC') {
        createdCommunication = await communicationService.sendDemandeDocuments(communicationData);
      } else {
        createdCommunication = await communicationService.createCommunication(communicationData);
      }

      let communicationId;
      if (createdCommunication?.data) {
        communicationId = createdCommunication.data.id || createdCommunication.data['@id']?.split('/')?.pop();
      } else {
        communicationId = createdCommunication?.id || createdCommunication?.['@id']?.split('/')?.pop();
      }

      if (!communicationId) throw new Error("L'API n'a pas retourné d'ID pour la communication créée");

      // Ne pas appeler /{id}/send si déjà traité par endpoints spécialisés
      if (!['RAPPEL_RDV','CONFIRMATION_RDV','ANNULATION_RDV','DEMANDE_DOC'].includes(sendForm.type)) {
        try { await communicationService.sendCommunication(String(communicationId)); } catch {}
      }

      // Optimistic UI: insérer immédiatement en tête de liste
      const optimistic = {
        id: String(communicationId),
        patient: patients.find(p => p.id === sendForm.patient_id) || sendForm.patient_id,
        type: sendForm.type,
        canal: sendForm.canal,
        sujet,
        contenu,
        statut: sendForm.type === 'RAPPEL_RDV' ? 'ENVOYE' : 'ENVOYE',
        createdAt: new Date().toISOString(),
      };
      try {
        queryClient.setQueriesData({ queryKey: ['communications'] }, (old) => {
          if (!old) return [optimistic];
          if (Array.isArray(old)) return [optimistic, ...old];
          // format hydra/member improbable ici car hook retourne un array
          return old;
        });
      } catch {}

      // Sync server: refetch la liste
      queryClient.invalidateQueries({ queryKey: ['communications'] });

      setGlobalMessage({ type: 'success', text: 'Communication envoyée avec succès !' });
      closeSendModal();
    } catch (err) {
      setGlobalMessage({ type: 'error', text: "Impossible d'envoyer la communication" });
    } finally {
      setLoadingAction(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-purple-100 p-6">
        <div className="max-w-7xl mx-auto">
          <ErrorMessage 
            message={error} 
            title="Erreur de chargement"
            dismissible={false}
          />
          <div className="mt-4">
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Recharger la page
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-purple-100 p-6">
      <div className="max-w-7xl mx-auto">
        {globalMessage.text && (
          <div className={`${
            globalMessage.type === 'success' ? 'bg-green-100 border-green-300 text-green-800' : 
            globalMessage.type === 'info' ? 'bg-blue-100 border-blue-300 text-blue-800' :
            'bg-red-100 border-red-300 text-red-800'
          } border px-4 py-3 rounded-lg mb-6 shadow-lg flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              <span className="material-symbols-rounded text-lg">
                {globalMessage.type === 'success' ? 'check_circle' : 
                 globalMessage.type === 'info' ? 'info' : 'error'}
              </span>
              <span className="font-medium">{globalMessage.text}</span>
            </div>
            <button
              onClick={() => setGlobalMessage({ type: '', text: '' })}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <span className="material-symbols-rounded">close</span>
            </button>
          </div>
        )}

        {/* Titre centré */}
        <div className="text-center py-6 mb-6">
          <div className="bg-purple-200 rounded-lg shadow p-6 max-w-xl mx-auto">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center shadow-sm">
                <span className="material-symbols-rounded text-purple-600 text-2xl">forum</span>
              </div>
              <h1 className="text-2xl font-bold text-purple-800">Communications</h1>
            </div>
            <p className="text-purple-700 text-sm">Gérez toutes vos communications avec les patients</p>
          </div>
        </div>

        {/* Statistiques cartes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white/90 backdrop-blur-sm p-6 rounded-lg shadow-lg border border-purple-200">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total || communications.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white/90 backdrop-blur-sm p-6 rounded-lg shadow-lg border border-purple-200">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Envoyées</p>
                <p className="text-2xl font-bold text-gray-900">{stats.byStatus?.ENVOYE || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-white/90 backdrop-blur-sm p-6 rounded-lg shadow-lg border border-purple-200">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">En attente</p>
                <p className="text-2l font-bold text-gray-900">{stats.byStatus?.EN_ATTENTE || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-white/90 backdrop-blur-sm p-6 rounded-lg shadow-lg border border-purple-200">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Échecs</p>
                <p className="text-2xl font-bold text-gray-900">{stats.byStatus?.ECHEC || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions rapides */}
        <div className="bg-white/90 backdrop-blur-sm p-6 rounded-lg shadow-lg border border-purple-200 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Actions rapides</h2>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['communications'] });
                  setGlobalMessage({ type: 'success', text: 'Liste rafraîchie' });
                  setTimeout(() => setGlobalMessage({ type: '', text: '' }), 2000);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                title="Rafraîchir la liste des communications"
              >
                <span className="material-symbols-rounded text-base">refresh</span>
                Rafraîchir
              </button>
              {!isFormateur && (
                <button
                  onClick={() => {
                    const showAll = filters.skipAutoFilter === true;
                    setFilters(prev => ({
                      ...prev,
                      skipAutoFilter: !showAll,
                      page: 1
                    }));
                    setGlobalMessage({ 
                      type: 'info', 
                      text: showAll 
                        ? 'Affichage de vos communications uniquement' 
                        : 'Affichage de toutes les communications' 
                    });
                    setTimeout(() => setGlobalMessage({ type: '', text: '' }), 3000);
                  }}
                  className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                    filters.skipAutoFilter 
                      ? 'bg-green-600 text-white hover:bg-green-700' 
                      : 'bg-gray-600 text-white hover:bg-gray-700'
                  }`}
                  title={filters.skipAutoFilter ? "Voir mes communications uniquement" : "Voir toutes les communications"}
                >
                  <span className="material-symbols-rounded text-base">
                    {filters.skipAutoFilter ? 'person' : 'people'}
                  </span>
                  {filters.skipAutoFilter ? 'Mes communications' : 'Toutes les communications'}
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 md-grid-cols-3 lg:grid-cols-6 gap-4">
            {quickActions.map((action) => (
              <button
                key={action.id}
                onClick={() => openSendModal(action.id)}
                className={`p-4 rounded-lg border-2 border-dashed hover:border-solid transition-all duration-200 ${
                  action.color === 'blue' ? 'border-purple-200 hover:border-purple-400 hover:bg-purple-50' :
                  action.color === 'green' ? 'border-green-200 hover:border-green-400 hover:bg-green-50' :
                  action.color === 'red' ? 'border-red-200 hover:border-red-400 hover:bg-red-50' :
                  'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                }`}
              >
                <div className="text-center">
                  <div className={`w-8 h-8 mx-auto mb-2 rounded-full flex items-center justify-center ${
                    action.color === 'blue' ? 'bg-purple-100' :
                    action.color === 'green' ? 'bg-green-100' :
                    action.color === 'red' ? 'bg-red-100' :
                    'bg-gray-100'
                  }`}>
                    <span className="material-symbols-rounded text-base text-gray-700">
                      {action.icon === 'calendar' ? 'event' :
                       action.icon === 'file-text' ? 'description' :
                       action.icon === 'check-circle' ? 'check_circle' :
                       action.icon === 'x-circle' ? 'cancel' : 'mail'}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">{action.label}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Filtres détaillés */}
        <div className="bg-white/90 backdrop-blur-sm p-6 rounded-lg shadow-lg border border-purple-200 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Filtres</h2>

          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Filtres rapides</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  const isActive = filters.statut?.includes('ENVOYE');
                  setFilters(f => ({ 
                    ...f, 
                    statut: isActive 
                      ? (f.statut || []).filter(s => s !== 'ENVOYE')
                      : [...(f.statut || []), 'ENVOYE'],
                    page: 1
                  }));
                }}
                className={`px-3 py-1 rounded-full text-sm ${
                  filters.statut?.includes('ENVOYE') 
                    ? 'bg-green-100 text-green-800 border border-green-300' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Envoyées
              </button>
              <button
                onClick={() => {
                  const isActive = filters.statut?.includes('EN_ATTENTE');
                  setFilters(f => ({ 
                    ...f, 
                    statut: isActive 
                      ? (f.statut || []).filter(s => s !== 'EN_ATTENTE')
                      : [...(f.statut || []), 'EN_ATTENTE'],
                    page: 1
                  }));
                }}
                className={`px-3 py-1 rounded-full text-sm ${
                  filters.statut?.includes('EN_ATTENTE') 
                    ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                En attente
              </button>
              <button
                onClick={() => {
                  const isActive = filters.statut?.includes('ECHEC');
                  setFilters(f => ({ 
                    ...f, 
                    statut: isActive 
                      ? (f.statut || []).filter(s => s !== 'ECHEC')
                      : [...(f.statut || []), 'ECHEC'],
                    page: 1
                  }));
                }}
                className={`px-3 py-1 rounded-full text-sm ${
                  filters.statut?.includes('ECHEC') 
                    ? 'bg-red-100 text-red-800 border border-red-300' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Échecs
              </button>
              <button
                onClick={() => setFilters(f => ({ 
                  ...f, 
                  statut: [], 
                  type: [], 
                  canal: [],
                  page: 1
                }))}
                className="px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                Tous
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Recherche</label>
              <input
                type="text"
                value={filters.recherche || ''}
                onChange={(e) => handleFilterChange('recherche', e.target.value)}
                placeholder="Contenu..."
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Type</label>
              <select
                value={filters.type?.[0] || ''}
                onChange={(e) => handleFilterChange('type', e.target.value ? [e.target.value] : [])}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="">Tous les types</option>
                {(communicationTypes || []).map((type, idx) => {
                  const val = typeof type === 'string' ? type : (type && typeof type.value === 'string' ? type.value : '');
                  const label = typeof type === 'string' ? type : (type && typeof type.label === 'string' ? type.label : (val || `Type ${idx+1}`));
                  return (
                    <option key={val || idx} value={val}>{label}</option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Canal</label>
              <select
                value={filters.canal?.[0] || ''}
                onChange={(e) => handleFilterChange('canal', e.target.value ? [e.target.value] : [])}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="">Tous les canaux</option>
                {canaux.map(canal => (
                  <option key={canal.value} value={canal.value}>{canal.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Liste des communications en tableau */}
        <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-purple-200">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Communications</h2>
            {isFetching && (
              <div className="flex items-center text-sm text-gray-500">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500 mr-2"></div>
                Chargement...
              </div>
            )}
          </div>
          <div className="px-6 py-3 flex items-center gap-3 border-b border-gray-200">
            <button
              onClick={() => setShowRemindersOnly(!showRemindersOnly)}
              className={`px-3 py-1 rounded-full text-xs ${showRemindersOnly ? 'bg-purple-100 text-purple-800 border border-purple-300' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {showRemindersOnly ? 'Voir tout' : 'Voir seulement les rappels RDV'}
            </button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            </div>
          ) : communications.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-purple-200">
                <thead className="bg-purple-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Canal</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sujet</th>
                    {isFormateur && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Créé par</th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-purple-100">
                  {communications.map((comm, index) => {
                    const status = statusConfig[comm.statut] || statusConfig['BROUILLON'];
                    return (
                      <tr key={comm.id || comm['@id'] || `comm-${index}`} className="hover:bg-purple-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{
                          (() => {
                            const d = comm.sentAt || comm.sent_at || comm.createdAt || comm.created_at;
                            return formatDate(d);
                          })()
                        }</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{getPatientLabel(comm.patient)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{(communicationTypes || []).find(t => (t.value || t) === comm.type)?.label || comm.type}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className="inline-flex items-center gap-1">
                            <span className="material-symbols-rounded text-gray-600 text-base">{comm.canal === 'EMAIL' ? 'mail' : comm.canal === 'SMS' ? 'sms' : comm.canal === 'TELEPHONE' ? 'call' : 'chat'}</span>
                            {canaux.find(c => c.value === comm.canal)?.label || comm.canal}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{comm.sujet || 'Sans sujet'}</td>
                        {isFormateur && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {(() => {
                              const raw = comm.createdBy || comm.created_by || comm.creePar || comm.user || null;
                              if (!raw) return '—';
                              if (typeof raw === 'string') {
                                const fallbackName = comm.created_by_name || comm.createdByName || '';
                                const fallbackEmail = comm.created_by_email || comm.createdByEmail || '';
                                return fallbackName || fallbackEmail || (raw.split('/').pop() || '—');
                              }
                              const fn = raw.prenom || raw.firstName || '';
                              const ln = raw.nom || raw.lastName || '';
                              const email = raw.email || '';
                              const name = `${fn} ${ln}`.trim();
                              return name || email || '—';
                            })()}
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            status.color === 'green' ? 'bg-green-100 text-green-800' :
                            status.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                            status.color === 'red' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button onClick={() => openDetails(comm)} className="mr-3 inline-flex items-center px-3 py-1 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 hover:text-purple-800 transition-colors">Voir</button>
                          {comm.statut === 'BROUILLON' && (
                            <button className="mr-3 inline-flex items-center px-3 py-1 text-sm font-medium text-purple-700 bg-white border border-purple-200 rounded-lg hover:bg-purple-50 hover:text-purple-800 transition-colors">Modifier</button>
                          )}
                          {comm.statut === 'ECHEC' && (
                            <button className="inline-flex items-center px-3 py-1 text-sm font-medium text-purple-700 bg-white border border-purple-200 rounded-lg hover:bg-purple-50 hover:text-purple-800 transition-colors">Renvoyer</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-400 text-4xl mb-2">📞</div>
              <p className="text-gray-500">Aucune communication trouvée</p>
              <p className="text-sm text-gray-400 mt-1">Utilisez les actions rapides pour commencer</p>
            </div>
          )}
        </div>

        {/* Modal d'envoi */}
        {showSendModal && (
          <div className="fixed inset-0 bg-purple-900/30 backdrop-blur-sm overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border border-purple-200 w-11/12 md:w-3/4 lg:w-1/2 shadow-2xl rounded-xl bg-white/95 backdrop-blur-sm">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-purple-900 flex items-center gap-3">
                    <span className="material-symbols-rounded text-purple-700 text-2xl">send</span>
                    Nouvelle communication
                  </h3>
                  <button onClick={closeSendModal} className="text-purple-400 hover:text-purple-700 hover:bg-purple-100 p-2 rounded-full transition-all duration-200">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={handleSendCommunication} className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-purple-800 mb-2">Patient</label>
                    <select
                      value={sendForm.patient_id}
                      onChange={(e) => setSendForm(prev => ({ ...prev, patient_id: e.target.value, rendez_vous_id: '' }))}
                      required
                      className="mt-1 block w-full px-4 py-3 border border-purple-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white/80 backdrop-blur-sm transition-all duration-200"
                    >
                      <option value="">Sélectionner un patient</option>
                      {patients.map(patient => (
                        <option key={patient.id} value={patient.id}>{patient.prenom} {patient.nom}</option>
                      ))}
                    </select>
                  </div>

                  {['RAPPEL_RDV', 'CONFIRMATION_RDV', 'ANNULATION_RDV'].includes(sendForm.type) && (
                    <div>
                      <label className="block text-sm font-semibold text-purple-800 mb-2">Rendez-vous</label>
                      <select
                        value={sendForm.rendez_vous_id}
                        onChange={(e) => setSendForm(prev => ({ ...prev, rendez_vous_id: e.target.value }))}
                        required
                        className="mt-1 block w-full px-4 py-3 border border-purple-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white/80 backdrop-blur-sm transition-all duration-200"
                      >
                        <option value="">Sélectionner un rendez-vous</option>
                        {rdvsForSelectedPatient.map(rdv => (
                          <option key={rdv.id} value={rdv.id}>{`${rdv.motif ?? 'Rendez-vous'} — ${new Date(rdv.startAt ?? rdv.start_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {sendForm.type && (
                    <div>
                      <label className="block text-sm font-semibold text-purple-800 mb-2">Sujet</label>
                      <div className="mt-1 block w-full px-4 py-3 bg-purple-50 border border-purple-200 rounded-lg text-purple-800 font-medium">
                        {communicationTypes.find(t => (t.value || t) === sendForm.type)?.label || sendForm.sujet}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-purple-800 mb-2">Canal</label>
                    <select
                      value={sendForm.canal}
                      onChange={(e) => setSendForm(prev => ({ ...prev, canal: e.target.value }))}
                      required
                      className="mt-1 block w-full px-4 py-3 border border-purple-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white/80 backdrop-blur-sm transition-all duration-200"
                    >
                      <option value="">Sélectionner un canal</option>
                      {canaux.map(canal => (
                        <option key={canal.value} value={canal.value}>{canal.label}</option>
                      ))}
                    </select>
                  </div>

                  {!QUICK_TYPES.includes(sendForm.type) && (
                    <div>
                      <label className="block text-sm font-semibold text-purple-800 mb-2">Contenu</label>
                      <textarea
                        value={sendForm.contenu}
                        onChange={(e) => setSendForm(prev => ({ ...prev, contenu: e.target.value }))}
                        required
                        rows={4}
                        className="mt-1 block w-full px-4 py-3 border border-purple-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white/80 backdrop-blur-sm transition-all duration-200 resize-none"
                      />
                    </div>
                  )}

                  <div className="flex justify-end space-x-4 pt-6 border-t border-purple-200">
                    <button type="button" onClick={closeSendModal} className="px-6 py-3 text-sm font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 hover:border-purple-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all duration-200">Annuler</button>
                    <button type="submit" disabled={loadingAction} className="px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-purple-700 border border-transparent rounded-lg hover:from-purple-700 hover:to-purple-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl">
                      {loadingAction ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Envoi...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <span className="material-symbols-rounded text-lg">send</span>
                          Envoyer
                        </span>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Modal de détails */}
        {showDetailModal && selectedCommunication && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Détails de la communication</h3>
                  <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Patient</label>
                    <p className="text-sm text-gray-900">{getPatientLabel(selectedCommunication.patient)}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Type</label>
                      <p className="text-sm text-gray-900">{(communicationTypes || []).find(t => (t.value || t) === selectedCommunication.type)?.label || selectedCommunication.type}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Canal</label>
                      <p className="text-sm text-gray-900">{canaux.find(c => c.value === selectedCommunication.canal)?.label || selectedCommunication.canal}</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Sujet</label>
                    <p className="text-sm text-gray-900">{selectedCommunication.sujet || 'Sans sujet'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Contenu</label>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedCommunication.contenu}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Statut</label>
                      <p className="text-sm text-gray-900">{statusConfig[selectedCommunication.statut]?.label || selectedCommunication.statut}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">ID</label>
                      <p className="text-sm text-gray-900">{selectedCommunication.id || selectedCommunication['@id']}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Créée le</label>
                      <p className="text-sm text-gray-900">{formatDate(selectedCommunication.createdAt || selectedCommunication.created_at)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Dernière mise à jour</label>
                      <p className="text-sm text-gray-900">{formatDate(selectedCommunication.updatedAt || selectedCommunication.updated_at)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Envoyée le</label>
                      <p className="text-sm text-gray-900">{formatDate(selectedCommunication.sentAt || selectedCommunication.sent_at || selectedCommunication.createdAt || selectedCommunication.created_at)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Créé par</label>
                      <p className="text-sm text-gray-900">
                        {(() => {
                          const raw = selectedCommunication.createdBy || selectedCommunication.created_by || selectedCommunication.user || null;
                          if (!raw) return '—';
                          if (typeof raw === 'string') {
                            const fallbackName = selectedCommunication.created_by_name || selectedCommunication.createdByName || '';
                            const fallbackEmail = selectedCommunication.created_by_email || selectedCommunication.createdByEmail || '';
                            return fallbackName || fallbackEmail || (raw.split('/').pop() || '—');
                          }
                          const fn = raw.prenom || raw.firstName || '';
                          const ln = raw.nom || raw.lastName || '';
                          const email = raw.email || '';
                          const name = `${fn} ${ln}`.trim();
                          return name || email || '—';
                        })()}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Destinataire</label>
                      <p className="text-sm text-gray-900">{selectedCommunication.to_email || selectedCommunication.to_phone || '—'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Rendez-vous</label>
                      <p className="text-sm text-gray-900">{(() => {
                        const rdv = selectedCommunication.rendez_vous || selectedCommunication.rendezVous || selectedCommunication.rendez_vous_id || selectedCommunication.rendezVousId;
                        if (!rdv) return '—';
                        if (typeof rdv === 'string') return rdv;
                        const start = rdv.start_at || rdv.startAt;
                        const motif = rdv.motif || 'RDV';
                        return `${motif}${start ? ` — ${new Date(start).toLocaleString('fr-FR')}` : ''}`;
                      })()}</p>
                    </div>
                  </div>
                  {selectedCommunication.errorMessage && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Erreur</label>
                      <p className="text-sm text-red-700 whitespace-pre-wrap">{selectedCommunication.errorMessage}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default CommunicationsWithQuery;
