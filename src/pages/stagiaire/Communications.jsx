import React, { useEffect, useMemo, useState } from "react";
import { useQueryClient } from '@tanstack/react-query';
import { useCommunications, useCommunicationStats, useCommunicationTypes } from "../../hooks/useCommunications";
import userService from "../../_services/user.service";
import patientService from "../../_services/patient.service";
import appointmentService from "../../_services/appointment.service";
import { communicationService } from "../../_services/communication.service";
import documentService from "../../_services/document.service";
import PatientName from "../../components/PatientName";
import LoadingSpinner from "../../components/LoadingSpinner";
import StatCard from "../../components/StatCard";
import PatientSearchInput from "../../components/PatientSearchInput";
import { getPatientNameString } from "../../utils/patientHelpers";

const formulaireCommunicationInitial = {
  patient_id: '',
  rendez_vous_id: '',
  type: '',
  canal: '',
  sujet: '',
  contenu: '',
  template: '',
  documentTypes: [] // Pour la checklist des types de documents
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
  // const [showRemindersOnly, setShowRemindersOnly] = useState(false);
  // useEffect(() => {
  //   if (showRemindersOnly) {
  //     setFilters(prev => ({ ...prev, type: ['RAPPEL_RDV'], page: 1, limit: 10 }));
  //   }
  // }, [showRemindersOnly]);

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
  
  // États pour l'upload de document (ENVOI_DOC)
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadDocTitle, setUploadDocTitle] = useState("");
  const [uploadDocType, setUploadDocType] = useState("COMPTE_RENDU_CONSULTATION");
  const [uploadingDocument, setUploadingDocument] = useState(false);
  
  // État pour les erreurs dans le modal
  const [modalError, setModalError] = useState('');

  // Types et canaux (fallback si hook vide) avec templates par défaut
  const typesFallback = [
    // {
    //   value: 'RAPPEL_RDV',
    //   label: 'Rappel de Rendez-vous',
    //   icon: 'calendar',
    //   description: 'Rappeler un rendez-vous à venir',
    //   template: 'Bonjour {patient_nom}, votre rendez-vous est prévu le {date_rdv} à {heure_rdv}. '
    // },
    {
      value: 'DEMANDE_DOC',
      label: 'Demande de Document',
      icon: 'file-text',
      description: 'Demander un document au patient',
      template: 'Bonjour {patient_nom}, nous avons besoin de votre {type_document}.'
    },
    {
      value: 'ENVOI_DOC',
      label: 'Envoi de Document',
      icon: 'upload_file',
      description: 'Envoyer un document au patient',
      template: 'Bonjour {patient_nom}, vous trouverez ci-joint le document demandé.'
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
    // { id: 'rappel-rdv', label: 'Rappel RDV', icon: 'calendar', color: 'blue', type: 'RAPPEL_RDV' },
    { id: 'demande-doc', label: 'Demande Document', icon: 'file-text', color: 'green', type: 'DEMANDE_DOC' },
    { id: 'envoi-doc', label: 'Envoi Document', icon: 'upload_file', color: 'blue', type: 'ENVOI_DOC' },
    { id: 'confirmation-rdv', label: 'Confirmation RDV', icon: 'check-circle', color: 'green', type: 'CONFIRMATION_RDV' },
    { id: 'annulation-rdv', label: 'Annulation RDV', icon: 'x-circle', color: 'red', type: 'ANNULATION_RDV' },
  ];
  
  // Types de documents disponibles pour la checklist
  const documentTypes = [
    { value: 'ORDONNANCE', label: 'Ordonnance', group: 'Documents de prescription' },
    { value: 'PRESCRIPTION_EXAMEN', label: 'Prescription d\'examen', group: 'Documents de prescription' },
    { value: 'RADIOGRAPHIE', label: 'Radiographie', group: 'Imagerie médicale' },
    { value: 'ECHOGRAPHIE', label: 'Échographie', group: 'Imagerie médicale' },
    { value: 'ENDOSCOPIE', label: 'Endoscopie', group: 'Imagerie médicale' },
    { value: 'DERMATOSCOPIE', label: 'Dermatoscopie', group: 'Imagerie médicale' },
    { value: 'ANALYSES_BIOLOGIQUES', label: 'Analyses biologiques', group: 'Résultats d\'examens' },
    { value: 'ANALYSES_ANATOMOPATHOLOGIQUES', label: 'Analyses anatomopathologiques', group: 'Résultats d\'examens' },
    { value: 'ELECTROCARDIOGRAMME', label: 'Électrocardiogramme', group: 'Résultats d\'examens' },
    { value: 'SPIROMETRIE', label: 'Spirométrie', group: 'Résultats d\'examens' },
    { value: 'COMPTE_RENDU_CONSULTATION', label: 'CR de consultation', group: 'Comptes-rendus médicaux' },
    { value: 'COMPTE_RENDU_HOSPITALISATION', label: 'CR d\'hospitalisation', group: 'Comptes-rendus médicaux' },
    { value: 'COMPTE_RENDU_OPERATOIRE', label: 'CR opératoire', group: 'Comptes-rendus médicaux' },
    { value: 'COMPTE_RENDU_URGENCE', label: 'CR d\'urgence', group: 'Comptes-rendus médicaux' },
    { value: 'CERTIFICAT_MEDICAL', label: 'Certificat médical', group: 'Certificats et attestations' },
    { value: 'CERTIFICAT_DE_DECES', label: 'Certificat de décès', group: 'Certificats et attestations' },
    { value: 'ATTESTATION_MALADIE', label: 'Attestation maladie', group: 'Certificats et attestations' },
    { value: 'FSE', label: 'FSE', group: 'Documents administratifs' },
    { value: 'FACTURE_MEDICALE', label: 'Facture médicale', group: 'Documents administratifs' },
    { value: 'CONVENTION_MEDICALE', label: 'Convention médicale', group: 'Documents administratifs' },
    { value: 'CARTE_IDENTITE', label: 'Carte d\'identité', group: 'Justificatifs requis' },
    { value: 'CARTE_VITALE', label: 'Carte vitale', group: 'Justificatifs requis' },
    { value: 'CONTACTS_URGENCE', label: 'Contact d\'urgence', group: 'Justificatifs requis' },
    { value: 'CARTE_MUTUELLE', label: 'Carte mutuelle', group: 'Justificatifs requis' },
    { value: 'DOSSIER_MEDICAL', label: 'Dossier médical', group: 'Documents de suivi' },
    { value: 'PLAN_DE_SOINS', label: 'Plan de soins', group: 'Documents de suivi' },
    { value: 'SUIVI_THERAPEUTIQUE', label: 'Suivi thérapeutique', group: 'Documents de suivi' },
  ];
  
  // Grouper les types de documents par catégorie
  const documentTypesByGroup = useMemo(() => {
    const groups = {};
    documentTypes.forEach(docType => {
      if (!groups[docType.group]) {
        groups[docType.group] = [];
      }
      groups[docType.group].push(docType);
    });
    return groups;
  }, []);

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

  // Utiliser la fonction utilitaire standardisée
  const getPatientLabel = (p) => getPatientNameString(p, false);

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
    setModalError(''); // Réinitialiser l'erreur
    setShowSendModal(true);
  };

  const closeSendModal = () => {
    setShowSendModal(false);
    setSendForm({ ...formulaireCommunicationInitial });
    setModalError(''); // Réinitialiser l'erreur
    // Réinitialiser les champs d'upload
    setUploadFile(null);
    setUploadDocTitle("");
    setUploadDocType("COMPTE_RENDU_CONSULTATION");
  };

  const QUICK_TYPES = [/* 'RAPPEL_RDV', */'CONFIRMATION_RDV', 'ANNULATION_RDV', 'ENVOI_DOC'];

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
        const patient_nom = patient ? getPatientNameString(patient, false) : '';
        const startAt = rdv ? (rdv.startAt ?? rdv.start_at) : undefined;
        const date_rdv = startAt ? new Date(startAt).toLocaleDateString('fr-FR') : '';
        const heure_rdv = startAt ? new Date(startAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
        contenu = tpl
          .replace('{patient_nom}', patient_nom)
          .replace('{date_rdv}', date_rdv)
          .replace('{heure_rdv}', heure_rdv);
      }

      const communicationData = { 
        ...sendForm, 
        sujet, 
        contenu,
        // Inclure les types de documents si c'est une demande de documents
        ...(sendForm.type === 'DEMANDE_DOC' && sendForm.documentTypes && sendForm.documentTypes.length > 0 
          ? { documentTypes: sendForm.documentTypes } 
          : {})
      };

      let createdCommunication;
      // if (sendForm.type === 'RAPPEL_RDV' && sendForm.rendez_vous_id) {
      //   createdCommunication = await communicationService.sendRappelRendezVous(sendForm.rendez_vous_id, communicationData);
      // } else 
      if (sendForm.type === 'CONFIRMATION_RDV' && sendForm.rendez_vous_id) {
        createdCommunication = await communicationService.sendConfirmationRendezVous(sendForm.rendez_vous_id, communicationData);
      } else if (sendForm.type === 'ANNULATION_RDV' && sendForm.rendez_vous_id) {
        createdCommunication = await communicationService.sendAnnulationRendezVous(sendForm.rendez_vous_id, communicationData);
      } else if (sendForm.type === 'DEMANDE_DOC') {
        createdCommunication = await communicationService.sendDemandeDocuments(communicationData);
      } else if (sendForm.type === 'ENVOI_DOC') {
        // Pour l'envoi de documents, uploader le document d'abord
        if (!uploadFile) {
          setModalError('Veuillez sélectionner un fichier à envoyer');
          setLoadingAction(false);
          return;
        }
        
        if (!sendForm.patient_id) {
          setModalError('Veuillez sélectionner un patient');
          setLoadingAction(false);
          return;
        }
        
        setUploadingDocument(true);
        try {
          // Upload du document - utiliser 'patient' comme dans Documents.jsx (API Platform accepte IRI ou ID)
          const fd = new FormData();
          fd.append("file", uploadFile);
          // L'API accepte 'patient' (IRI ou ID) ou 'patient_id' (ID brut)
          const patientObj = patients.find(p => p.id === sendForm.patient_id);
          const patientValue = patientObj?.['@id'] || `/api/patients/${sendForm.patient_id}` || sendForm.patient_id;
          fd.append("patient", patientValue);
          if (uploadDocType) fd.append("type", uploadDocType);
          // Le titre saisi par l'utilisateur devient original_name dans la BDD
          if (uploadDocTitle) {
            fd.append("original_name", uploadDocTitle);
            fd.append("title", uploadDocTitle);
          }
          
          const createdDoc = await documentService.createDocument(fd);
          const documentData = createdDoc.data || createdDoc;
          
          // Créer la communication pour l'envoi de document
          // API Platform attend un IRI pour les relations (patient, pas patient_id)
          const docTitle = uploadDocTitle || documentData.title || documentData.original_name || 'Document';
          const patientObjForComm = patients.find(p => p.id === sendForm.patient_id);
          const patientIri = patientObjForComm?.['@id'] || `/api/patients/${sendForm.patient_id}`;
          
          const communicationData = {
            patient: patientIri, // IRI pour API Platform (relation, pas patient_id)
            type: sendForm.type,
            canal: sendForm.canal,
            sujet: `Envoi de document : ${docTitle}`,
            contenu: `Bonjour, vous trouverez ci-joint le document "${docTitle}".`
          };
          
          createdCommunication = await communicationService.createCommunication(communicationData);
          
          // Réinitialiser les champs d'upload
          setUploadFile(null);
          setUploadDocTitle("");
          setUploadDocType("COMPTE_RENDU_CONSULTATION");
          
        } catch (uploadError) {
          console.error('Erreur lors de l\'upload du document:', uploadError);
          const errorMessage = uploadError?.response?.data?.message || 
                               uploadError?.response?.data?.error || 
                               uploadError?.response?.data?.['hydra:description'] ||
                               uploadError?.message || 
                               "Impossible d'uploader le document";
          setModalError(errorMessage);
          setLoadingAction(false);
          setUploadingDocument(false);
          return;
        } finally {
          setUploadingDocument(false);
        }
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
      if (![/* 'RAPPEL_RDV', */'CONFIRMATION_RDV','ANNULATION_RDV','DEMANDE_DOC','ENVOI_DOC'].includes(sendForm.type)) {
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
      console.error('Erreur lors de l\'envoi de la communication:', err);
      const errorMessage = err?.response?.data?.message || 
                           err?.response?.data?.error || 
                           err?.response?.data?.['hydra:description'] ||
                           (err?.response?.data?.violations && Array.isArray(err.response.data.violations) 
                             ? err.response.data.violations.map(v => v.message).join(', ')
                             : null) ||
                           err?.message || 
                           "Impossible d'envoyer la communication";
      setModalError(errorMessage);
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
    <div className="min-h-screen bg-purple-100 w-[95%] md:w-[90%] lg:w-[80%] mx-auto px-2 md:px-4 py-6">
      <div className="w-full">
        {globalMessage.text && (
          <div className={`${
            globalMessage.type === 'success' ? 'bg-green-100 border-green-300 text-green-800' : 
            globalMessage.type === 'info' ? 'bg-blue-100 border-blue-300 text-blue-800' :
            'bg-red-100 border-red-300 text-red-800'
          } border px-4 py-3 rounded-lg mb-6 shadow-lg flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              <span className="material-symbols-rounded text-2xl">
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
          <div className="bg-purple-200 rounded-lg shadow p-6 max-w-2xl mx-auto">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center shadow-sm">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-purple-800">Communications</h1>
            </div>
            <p className="text-purple-700 text-sm">Gérez toutes vos communications avec les patients</p>
          </div>
        </div>

        {/* Statistiques cartes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <StatCard
            icon="email"
            label="Total"
            value={stats.total || communications.length}
            color="purple"
          />
          <StatCard
            icon="check"
            label="Envoyées"
            value={stats.byStatus?.ENVOYE || 0}
            color="green"
          />
          <StatCard
            icon="clock"
            label="En attente"
            value={stats.byStatus?.EN_ATTENTE || 0}
            color="yellow"
          />
          <StatCard
            icon="warning"
            label="Échecs"
            value={stats.byStatus?.ECHEC || 0}
            color="red"
          />
        </div>

        {/* Actions rapides */}
        <div className="bg-white/90 backdrop-blur-sm p-6 rounded-lg shadow-lg border border-purple-200 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold text-gray-900">Actions rapides</h2>
            <div className="flex gap-2">
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
                  <span className="material-symbols-rounded text-2xl">
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
                    <span className="material-symbols-rounded text-2xl text-gray-700">
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
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Filtres</h2>

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
            <h2 className="text-2xl font-semibold text-gray-900">Communications</h2>
          </div>
          {/* <div className="px-6 py-3 flex items-center gap-3 border-b border-gray-200">
            <button
              onClick={() => setShowRemindersOnly(!showRemindersOnly)}
              className={`px-3 py-1 rounded-full text-xs ${showRemindersOnly ? 'bg-purple-100 text-purple-800 border border-purple-300' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {showRemindersOnly ? 'Voir tout' : 'Voir seulement les rappels RDV'}
            </button>
          </div> */}

          <div className="w-full">
            <table className="w-full table-auto divide-y divide-purple-200">
              <thead className="bg-purple-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Canal</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sujet</th>
                  {isFormateur && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Créé par</th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-auto">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-purple-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={isFormateur ? 8 : 7} className="px-6 py-8">
                      <LoadingSpinner color="purple" message="Chargement des communications..." />
                    </td>
                  </tr>
                ) : communications.length === 0 ? (
                  <tr>
                    <td colSpan={isFormateur ? 8 : 7} className="px-6 py-8 text-center">
                      <div className="text-gray-400 text-4xl mb-2">📞</div>
                      <p className="text-gray-500">Aucune communication trouvée</p>
                      <p className="text-sm text-gray-400 mt-1">Utilisez les actions rapides pour commencer</p>
                    </td>
                  </tr>
                ) : (
                  communications.map((comm, index) => {
                    const status = statusConfig[comm.statut] || statusConfig['BROUILLON'];
                    return (
                      <tr key={comm.id || comm['@id'] || `comm-${index}`} className="hover:bg-purple-50">
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{
                          (() => {
                            const d = comm.sentAt || comm.sent_at || comm.createdAt || comm.created_at;
                            return formatDate(d);
                          })()
                        }</td>
                        <td className="px-4 py-4 text-sm text-gray-900 break-words">
                          <PatientName patient={comm.patient} />
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900 break-words">{(communicationTypes || []).find(t => (t.value || t) === comm.type)?.label || comm.type}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className="inline-flex items-center gap-1">
                            <span className="material-symbols-rounded text-gray-600 text-2xl">{comm.canal === 'EMAIL' ? 'mail' : comm.canal === 'SMS' ? 'sms' : comm.canal === 'TELEPHONE' ? 'call' : 'chat'}</span>
                            {canaux.find(c => c.value === comm.canal)?.label || comm.canal}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900 break-words">{comm.sujet || 'Sans sujet'}</td>
                        {isFormateur && (
                          <td className="px-4 py-4 text-sm text-gray-900 break-words">
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
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            status.color === 'green' ? 'bg-green-100 text-green-800' :
                            status.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                            status.color === 'red' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
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
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal d'envoi */}
        {showSendModal && (
          <div className="fixed inset-0 bg-purple-900/30 backdrop-blur-sm overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border border-purple-200 w-11/12 md:w-3/4 lg:w-1/2 shadow-2xl rounded-xl bg-white/95 backdrop-blur-sm">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-purple-900 flex items-center gap-3">
                    <span className="material-symbols-rounded text-purple-700 text-2xl">send</span>
                    Nouvelle communication
                  </h3>
                  <button onClick={closeSendModal} className="text-purple-400 hover:text-purple-700 hover:bg-purple-100 p-2 rounded-full transition-all duration-200">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Message d'erreur dans le modal */}
                {modalError && (
                  <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                    <span className="material-symbols-rounded text-red-600 text-2xl flex-shrink-0">error</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-red-800 mb-1">Erreur</p>
                      <p className="text-sm text-red-700">{modalError}</p>
                    </div>
                    <button
                      onClick={() => setModalError('')}
                      className="text-red-400 hover:text-red-600 flex-shrink-0"
                      type="button"
                    >
                      <span className="material-symbols-rounded text-2xl">close</span>
                    </button>
                  </div>
                )}

                <form onSubmit={handleSendCommunication} className="space-y-6">
                  <div>
                    <PatientSearchInput
                      patients={patients}
                      value={sendForm.patient_id}
                      onChange={(patientId) => setSendForm(prev => ({ ...prev, patient_id: patientId, rendez_vous_id: '' }))}
                      placeholder="Rechercher un patient (nom, prénom, email, téléphone...)"
                      className="mt-1"
                      required
                      label="Patient"
                    />
                  </div>

                  {[/* 'RAPPEL_RDV', */'CONFIRMATION_RDV', 'ANNULATION_RDV'].includes(sendForm.type) && (
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

                  {sendForm.type === 'DEMANDE_DOC' && (
                    <div>
                      <label className="block text-sm font-semibold text-purple-800 mb-2">Types de documents demandés</label>
                      <div className="mt-2 max-h-64 overflow-y-auto border border-purple-200 rounded-lg p-4 bg-purple-50/50">
                        {Object.entries(documentTypesByGroup).map(([groupName, types]) => (
                          <div key={groupName} className="mb-4 last:mb-0">
                            <h4 className="text-xs font-semibold text-purple-700 mb-2 uppercase tracking-wide">{groupName}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {types.map(docType => (
                                <label key={docType.value} className="flex items-center space-x-2 cursor-pointer hover:bg-purple-100 p-2 rounded">
                                  <input
                                    type="checkbox"
                                    checked={sendForm.documentTypes?.includes(docType.value) || false}
                                    onChange={(e) => {
                                      const currentTypes = sendForm.documentTypes || [];
                                      if (e.target.checked) {
                                        setSendForm(prev => ({ ...prev, documentTypes: [...currentTypes, docType.value] }));
                                      } else {
                                        setSendForm(prev => ({ ...prev, documentTypes: currentTypes.filter(t => t !== docType.value) }));
                                      }
                                    }}
                                    className="w-4 h-4 text-purple-600 border-purple-300 rounded focus:ring-purple-500"
                                  />
                                  <span className="text-sm text-purple-800">{docType.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {sendForm.type === 'ENVOI_DOC' && (
                    <>
                      <div>
                        <label className="block text-sm font-semibold text-purple-800 mb-2">Fichier à envoyer</label>
                        <div className="mt-1">
                          <label 
                            className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-purple-300 rounded-lg cursor-pointer bg-purple-50 hover:bg-purple-100 transition-colors"
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              e.currentTarget.classList.add('border-purple-400', 'bg-purple-100');
                            }}
                            onDragLeave={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              e.currentTarget.classList.remove('border-purple-400', 'bg-purple-100');
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              e.currentTarget.classList.remove('border-purple-400', 'bg-purple-100');
                              const file = e.dataTransfer?.files?.[0];
                              if (file) {
                                setUploadFile(file);
                              }
                            }}
                          >
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              <span className="material-symbols-rounded text-purple-400 text-4xl mb-2">upload_file</span>
                              <p className="mb-2 text-sm text-purple-700">
                                <span className="font-semibold">Cliquez pour télécharger</span> ou glissez-déposez
                              </p>
                              <p className="text-xs text-purple-500">PDF, DOC, DOCX, TXT, JPG, PNG</p>
                            </div>
                            <input
                              type="file"
                              className="hidden"
                              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                            />
                          </label>
                          {uploadFile && (
                            <div className="mt-2 p-3 bg-purple-100 rounded-lg">
                              <p className="text-sm text-purple-800 font-medium">Fichier sélectionné : {uploadFile.name}</p>
                              <p className="text-xs text-purple-600">Taille : {(uploadFile.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-purple-800 mb-2">Titre du document</label>
                          <input
                            type="text"
                            value={uploadDocTitle}
                            onChange={(e) => setUploadDocTitle(e.target.value)}
                            placeholder="Ex: Compte rendu consultation"
                            className="mt-1 block w-full px-4 py-3 border border-purple-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white/80 backdrop-blur-sm transition-all duration-200"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-purple-800 mb-2">Type de document</label>
                          <select
                            value={uploadDocType}
                            onChange={(e) => setUploadDocType(e.target.value)}
                            className="mt-1 block w-full px-4 py-3 border border-purple-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white/80 backdrop-blur-sm transition-all duration-200"
                          >
                            <optgroup label="Documents de prescription">
                              <option value="ORDONNANCE">Ordonnance</option>
                              <option value="PRESCRIPTION_EXAMEN">Prescription d'examen</option>
                            </optgroup>
                            <optgroup label="Imagerie médicale">
                              <option value="RADIOGRAPHIE">Radiographie</option>
                              <option value="ECHOGRAPHIE">Échographie</option>
                              <option value="ENDOSCOPIE">Endoscopie</option>
                              <option value="DERMATOSCOPIE">Dermatoscopie</option>
                            </optgroup>
                            <optgroup label="Résultats d'examens">
                              <option value="ANALYSES_BIOLOGIQUES">Analyses biologiques</option>
                              <option value="ANALYSES_ANATOMOPATHOLOGIQUES">Analyses anatomopathologiques</option>
                              <option value="ELECTROCARDIOGRAMME">Électrocardiogramme</option>
                              <option value="SPIROMETRIE">Spirométrie</option>
                            </optgroup>
                            <optgroup label="Comptes-rendus médicaux">
                              <option value="COMPTE_RENDU_CONSULTATION">CR de consultation</option>
                              <option value="COMPTE_RENDU_HOSPITALISATION">CR d'hospitalisation</option>
                              <option value="COMPTE_RENDU_OPERATOIRE">CR opératoire</option>
                              <option value="COMPTE_RENDU_URGENCE">CR d'urgence</option>
                            </optgroup>
                            <optgroup label="Certificats et attestations">
                              <option value="CERTIFICAT_MEDICAL">Certificat médical</option>
                              <option value="CERTIFICAT_DE_DECES">Certificat de décès</option>
                              <option value="ATTESTATION_MALADIE">Attestation maladie</option>
                            </optgroup>
                            <optgroup label="Documents administratifs">
                              <option value="FSE">FSE</option>
                              <option value="FACTURE_MEDICALE">Facture médicale</option>
                              <option value="CONVENTION_MEDICALE">Convention médicale</option>
                            </optgroup>
                            <optgroup label="Justificatifs requis">
                              <option value="CARTE_IDENTITE">Carte d'identité</option>
                              <option value="CARTE_VITALE">Carte vitale</option>
                              <option value="CONTACTS_URGENCE">Contact d'urgence</option>
                              <option value="CARTE_MUTUELLE">Carte mutuelle</option>
                            </optgroup>
                            <optgroup label="Documents de suivi">
                              <option value="DOSSIER_MEDICAL">Dossier médical</option>
                              <option value="PLAN_DE_SOINS">Plan de soins</option>
                              <option value="SUIVI_THERAPEUTIQUE">Suivi thérapeutique</option>
                            </optgroup>
                          </select>
                        </div>
                      </div>
                    </>
                  )}

                  {!QUICK_TYPES.includes(sendForm.type) && sendForm.type !== 'DEMANDE_DOC' && sendForm.type !== 'ENVOI_DOC' && (
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
                    <button type="submit" disabled={loadingAction || uploadingDocument || (sendForm.type === 'ENVOI_DOC' && !uploadFile)} className="px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-purple-700 border border-transparent rounded-lg hover:from-purple-700 hover:to-purple-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl">
                      {(loadingAction || uploadingDocument) ? (
                        <span className="flex items-center gap-2">
                          <LoadingSpinner color="white" size="small" inline={true} />
                          {uploadingDocument ? 'Upload en cours...' : 'Envoi...'}
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <span className="material-symbols-rounded text-2xl">send</span>
                          {sendForm.type === 'ENVOI_DOC' ? 'Envoyer le document' : 'Envoyer'}
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
                  <h3 className="text-2xl font-medium text-gray-900">Détails de la communication</h3>
                  <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Patient</label>
                    <p className="text-sm text-gray-900">
                      <PatientName patient={selectedCommunication.patient} />
                    </p>
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