import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import patientService from '../../_services/patient.service';
import mutuelleService from '../../_services/mutuelle.service';
import documentService from '../../_services/document.service';
import hospitalisationService from '../../_services/hospitalisation.service';
import appointmentService from '../../_services/appointment.service';
import justificatifService from '../../_services/justificatif.service';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';

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

const PatientSingle = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [couvertures, setCouvertures] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState('');
  // Hospitalisations
  const [hospis, setHospis] = useState([]);
  const [hospisLoading, setHospisLoading] = useState(false);
  const [hospisError, setHospisError] = useState('');
  // RDV (historique)
  const [rdvs, setRdvs] = useState([]);
  const [rdvsLoading, setRdvsLoading] = useState(false);
  const [rdvsError, setRdvsError] = useState('');
  // Pagination pour l'historique des RDV
  const RDV_PER_PAGE = 20;
  const [rdvCurrentPage, setRdvCurrentPage] = useState(1);
  const [couverturesLoading, setCouverturesLoading] = useState(false);
  const [couverturesError, setCouverturesError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Aperçu document
  const [showDocPreview, setShowDocPreview] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewMime, setPreviewMime] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  // Justificatifs
  const [justificatifsStatus, setJustificatifsStatus] = useState(null);
  const [justificatifsLoading, setJustificatifsLoading] = useState(false);
  const buildDocUrl = (doc) => {
    return doc?.url || doc?.fileUrl || doc?.path || (doc?.id ? `/api/documents/${doc.id}/download` : '');
  };
  const revokePreviewUrl = () => {
    try { if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl); } catch {}
    setPreviewUrl('');
  };
  const openPreview = async (doc) => {
    setPreviewError('');
    setPreviewLoading(true);
    setPreviewDoc(doc);
    setShowDocPreview(true);
    revokePreviewUrl();
    try {
      // Test 1: vérifier que l'ID est valide et récupérer les métadonnées à jour
      if (doc?.id) {
        try {
          const fresh = await documentService.getOneDocument(doc.id);
          if (fresh && fresh.id) {
            setPreviewDoc(fresh);
          }
        } catch (e) {
          // 404 → document supprimé côté back: retirer de la liste et informer
          setDocuments(prev => Array.isArray(prev) ? prev.filter(d => (d.id || d['@id']) !== doc.id && (d.id || d['@id']) !== doc['@id']) : prev);
          setPreviewError('Document introuvable (supprimé côté serveur).');
          throw e;
        }
      }
      // Tente un download avec auth → blob (évite 401 sans Authorization)
      if (doc?.id) {
        const blob = await documentService.downloadDocument(doc.id);
        if (blob) {
          const url = URL.createObjectURL(blob);
          setPreviewUrl(url);
          setPreviewMime(blob.type || (doc.mimeType || doc.type || ''));
          setPreviewLoading(false);
          return;
        }
      }
      // Pas de fallback URL direct pour éviter 401 sans header Authorization
      setPreviewError('Aperçu non disponible');
    } catch (e) {
      setPreviewError("Aperçu non disponible");
    } finally {
      setPreviewLoading(false);
    }
  };
  const [flashMessage, setFlashMessage] = useState({ type: '', text: '' });
  const patientStatus = React.useMemo(
    () => getPatientStatusMeta(patient?.statut, patient?.statutLabel),
    [patient?.statut, patient?.statutLabel]
  );
  const isPatientDeceased = patientStatus?.code === 'DECEDE';
  // Modal ajout document
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [newDocFile, setNewDocFile] = useState(null);
  const [newDocContent, setNewDocContent] = useState('');
  const [newDocType, setNewDocType] = useState('COMPTE_RENDU_CONSULTATION');
  const closeAddDoc = () => { setShowAddDoc(false); setNewDocFile(null); setNewDocContent(''); setNewDocType('COMPTE_RENDU_CONSULTATION'); };
  const submitAddDoc = async () => {
    if (!newDocFile || !id) return;
    try {
      setUploadingDoc(true);
      const fd = new FormData();
      fd.append('file', newDocFile);
      if (newDocContent) fd.append('contenu', newDocContent);
      // Mapper type détaillé -> type legacy pour compat serveur
      const mapLegacyType = (t) => {
        if (!t) return 'AUTRE';
        // Justificatifs requis (garder le type exact pour la détection)
        if (['CARTE_IDENTITE', 'CARTE_VITALE', 'CONTACTS_URGENCE', 'CARTE_MUTUELLE'].includes(t)) return t;
        if (t === 'ORDONNANCE' || t === 'PRESCRIPTION_EXAMEN') return 'ORDONNANCE';
        if (['RADIOGRAPHIE','ECHOGRAPHIE','ENDOSCOPIE','DERMATOSCOPIE'].includes(t)) return 'RADIOGRAPHIE';
        if (t.startsWith('COMPTE_RENDU_')) return 'COMPTE_RENDU';
        if (t.startsWith('CERTIFICAT_') || t === 'ATTESTATION_MALADIE') return 'CERTIFICAT';
        if (t === 'FSE') return 'FSE';
        if (t.startsWith('ANALYSES_') || ['ELECTROCARDIOGRAMME','SPIROMETRIE','DOSSIER_MEDICAL','PLAN_DE_SOINS','SUIVI_THERAPEUTIQUE','PSYCHOLOGIE','KINESITHERAPIE','DIETETIQUE','FICHE_DE_LIAISON','PROTOCOLE_URGENCE'].includes(t)) return 'COMPTE_RENDU';
        return 'AUTRE';
      };
      const legacyType = mapLegacyType(newDocType);
      if (legacyType) fd.append('type', legacyType);
      // Optionnel: conserver le type détaillé (si ignoré côté back, non bloquant)
      // fd.append('subcategory', newDocType);
      // Associer le patient (certains back attendent l'id brut plutôt que l'IRI)
      fd.append('patient', String(id));
      // Fallback titre si requis côté back
      if (newDocFile?.name) {
        fd.append('title', newDocFile.name);
      }
      const created = await documentService.createDocument(fd);
      const doc = created?.data || created;
      // mettre à jour l'historique des documents
      setDocuments((prev) => [doc, ...(Array.isArray(prev) ? prev : [])]);
      // Recharger les justificatifs pour mettre à jour le statut
      loadPatientJustificatifs();
      setFlashMessage({ type: 'success', text: 'Document ajouté avec succès.' });
      setTimeout(() => setFlashMessage({ type: '', text: '' }), 3000);
      closeAddDoc();
    } catch (e) {
      console.error('Erreur upload document:', e);
      const errorMsg = e?.response?.data?.message || e?.message || "Échec de l'upload du document. Veuillez vérifier le format du fichier et réessayer.";
      setFlashMessage({ type: 'error', text: errorMsg });
      setTimeout(() => setFlashMessage({ type: '', text: '' }), 4000);
    } finally {
      setUploadingDoc(false);
    }
  };

  // Edition couverture (modal)
  const [showEditCouverture, setShowEditCouverture] = useState(false);
  const [editingCouverture, setEditingCouverture] = useState(null);
  const [editFields, setEditFields] = useState({
    mutuelleId: '',
    numeroAdherent: '',
    dateDebut: '',
    dateFin: '',
    valide: true,
  });
  const [savingCouverture, setSavingCouverture] = useState(false);
  const [saveError, setSaveError] = useState('');
  // Autocomplete mutuelle
  const [mutuelleQuery, setMutuelleQuery] = useState('');
  const [mutuelleResults, setMutuelleResults] = useState([]);
  const [mutuelleSearching, setMutuelleSearching] = useState(false);

  useEffect(() => {
    let active = true;
    const run = async () => {
      const q = mutuelleQuery.trim();
      if (!q) { setMutuelleResults([]); return; }
      try {
        setMutuelleSearching(true);
        const res = await mutuelleService.searchMutuelles(q, 8);
        if (!active) return;
        setMutuelleResults(Array.isArray(res?.mutuelles) ? res.mutuelles : []);
      } catch (e) {
        if (active) setMutuelleResults([]);
      } finally {
        if (active) setMutuelleSearching(false);
      }
    };
    const t = setTimeout(run, 250);
    return () => { active = false; clearTimeout(t); };
  }, [mutuelleQuery]);

  const openEditCouverture = (c) => {
    setEditingCouverture(c);
    setEditFields({
      mutuelleId: (c?.mutuelle?.id || (typeof c?.mutuelle === 'string' ? c.mutuelle.split('/').pop() : '')) || '',
      numeroAdherent: c?.numeroAdherent || '',
      dateDebut: c?.dateDebut ? String(c.dateDebut).slice(0, 10) : '',
      dateFin: c?.dateFin ? String(c.dateFin).slice(0, 10) : '',
      valide: !!c?.valide,
    });
    setSaveError('');
    setShowEditCouverture(true);
  };

  const openAddCouverture = () => {
    setEditingCouverture(null);
    setEditFields({
      mutuelleId: '',
      numeroAdherent: '',
      dateDebut: '',
      dateFin: '',
      valide: true,
    });
    setSaveError('');
    setShowEditCouverture(true);
  };

  const closeEditCouverture = () => {
    setShowEditCouverture(false);
    setEditingCouverture(null);
    setSaveError('');
  };

  const handleEditField = (field, value) => {
    setEditFields((prev) => ({ ...prev, [field]: value }));
  };

  const saveCouverture = async () => {
    try {
      setSavingCouverture(true);
      setSaveError('');

      // validations minimales
      if (!editFields.mutuelleId) {
        setSaveError('Mutuelle requise');
        setSavingCouverture(false);
        return;
      }
      if (!editFields.numeroAdherent) {
        setSaveError("Numéro d'adhérent requis");
        setSavingCouverture(false);
        return;
      }
      if (!editFields.dateDebut) {
        setSaveError('Date de début requise (YYYY-MM-DD)');
        setSavingCouverture(false);
        return;
      }
      if (editFields.dateFin && editFields.dateFin < editFields.dateDebut) {
        setSaveError('La date de fin doit être après la date de début');
        setSavingCouverture(false);
        return;
      }

      const payload = {
        patient: `/api/patients/${id}`,
        mutuelle: `/api/mutuelles/${editFields.mutuelleId}`,
        numeroAdherent: editFields.numeroAdherent,
        dateDebut: editFields.dateDebut,
        dateFin: editFields.dateFin || undefined,
        valide: !!editFields.valide,
      };

      try {
        if (editingCouverture) {
          const covId = editingCouverture.id || editingCouverture['@id']?.split('/')?.pop();
          await patientService.updateCouverture(covId, payload);
        } else {
          await patientService.createCouverture(payload);
        }
      } catch (e) {
        if (e?.code === 'DUPLICATE_COUVERTURE') {
          setSaveError('Cette mutuelle est déjà associée à ce patient.');
          setSavingCouverture(false);
          return;
        }
        throw e;
      }

      // recharger patient + couvertures pour cohérence d'affichage
      setCouverturesLoading(true);
      const [refreshedPatient, refreshedCouvertures] = await Promise.all([
        patientService.getOnePatient(id).catch(() => patient),
        patientService.getPatientCouvertures(id).catch(() => []),
      ]);
      // Conserver le genre si non renvoyé par /patients/show
      const mergedPatient = refreshedPatient
        ? { ...refreshedPatient, genre: refreshedPatient.genre || patient?.genre }
        : patient;
      setPatient(mergedPatient);
      setCouvertures(Array.isArray(refreshedCouvertures) ? refreshedCouvertures : []);
      setCouverturesLoading(false);

      closeEditCouverture();
      setFlashMessage({ type: 'success', text: 'Couverture mise à jour avec succès.' });
      setTimeout(() => setFlashMessage({ type: '', text: '' }), 3000);
    } catch (e) {
      console.error('Erreur sauvegarde couverture:', e);
      setSaveError("Erreur lors de l'enregistrement. Vérifiez les champs.");
      const errorMsg = e?.response?.data?.message || e?.message || "Erreur lors de la mise à jour de la couverture. Veuillez vérifier les données et réessayer.";
      setFlashMessage({ type: 'error', text: errorMsg });
      setTimeout(() => setFlashMessage({ type: '', text: '' }), 4000);
    } finally {
      setSavingCouverture(false);
    }
  };

  // Fonctions utilitaires
  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString('fr-FR');
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '—';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Fonction pour charger les documents du patient
  const loadPatientDocuments = async () => {
    try {
      setDocumentsLoading(true);
      setDocumentsError('');
      if (!id) {
        setDocuments([]);
        return;
      }
      const documentsData = await documentService.getDocuments({ 
        'patient.id': id,
        "order[uploadedAt]": "desc",
        limit: 50
      });
      setDocuments(Array.isArray(documentsData) ? documentsData : []);
    } catch (error) {
      console.error('Erreur lors du chargement des documents:', error);
      setDocuments([]);
      setDocumentsError("Impossible de charger les documents du patient. Réessayez plus tard.");
    } finally {
      setDocumentsLoading(false);
    }
  };

  // Charger les hospitalisations du patient
  const loadPatientHospitalisations = async () => {
    if (!id) { setHospis([]); return; }
    try {
      setHospisLoading(true);
      setHospisError('');
      const list = await hospitalisationService.list(id);
      setHospis(Array.isArray(list) ? list : []);
    } catch (e) {
      setHospis([]);
      setHospisError("Impossible de charger les hospitalisations du patient.");
    } finally {
      setHospisLoading(false);
    }
  };

  // Historique des rendez-vous du patient
  const loadPatientRdvHistory = async () => {
    if (!id) { setRdvs([]); return; }
    try {
      setRdvsLoading(true);
      setRdvsError('');
      const list = await appointmentService.getAllAppointmentsHistory({ 'patient.id': id, "order[startAt]": 'desc', limit: 50 });
      setRdvs(Array.isArray(list) ? list : []);
    } catch (e) {
      setRdvs([]);
      setRdvsError("Impossible de charger l'historique des rendez-vous.");
    } finally {
      setRdvsLoading(false);
    }
  };

  // Charger le statut des justificatifs du patient
  const loadPatientJustificatifs = async () => {
    if (!id) { setJustificatifsStatus(null); return; }
    try {
      setJustificatifsLoading(true);
      const status = await justificatifService.getPatientStatus(id);
      setJustificatifsStatus(status);
    } catch (e) {
      console.error('Erreur lors du chargement des justificatifs:', e);
      setJustificatifsStatus(null);
    } finally {
      setJustificatifsLoading(false);
    }
  };

  const initFetched = useRef(false);

  // Fonction pour obtenir les classes de badge selon le statut (alignée avec Appointments.jsx)
  const getStatusBadgeClasses = (statut) => {
    if (!statut) return 'bg-gray-100 text-gray-800';
    const statutUpper = statut.toUpperCase();
    switch (statutUpper) {
      case 'EN_ATTENTE': return 'bg-yellow-100 text-yellow-800';
      case 'PLANIFIE': return 'bg-blue-100 text-blue-800';
      case 'CONFIRME': return 'bg-green-100 text-green-800';
      case 'ANNULE': return 'bg-red-100 text-red-800';
      case 'ABSENT': return 'bg-red-600 text-white font-bold';
      case 'TERMINE': return 'bg-gray-100 text-gray-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  // Réinitialiser la pagination quand les RDV sont rechargés
  useEffect(() => {
    if (rdvs.length > 0) {
      setRdvCurrentPage(1);
    }
  }, [id]); // Réinitialiser quand on change de patient

  useEffect(() => {
    const loadPatient = async () => {
      try {
        setLoading(true);
        
        // Charger les données principales ET une liste pour compléter certains champs manquants (ex: genre)
        const [patientData, allPatients] = await Promise.all([
          patientService.getOnePatient(id),
          patientService.getAllPatients().catch(() => [])
        ]);
        const listPatients = Array.isArray(allPatients) ? allPatients : [];
        const patientFromList = listPatients.find(p => String(p?.id) === String(id));
        const mappedPatient = {
          ...patientData,
          genre: patientData?.genre || patientFromList?.genre,
        };
        setPatient(mappedPatient);
        
        // Marquer le chargement principal comme terminé
        setLoading(false);
        
        // Charger les données secondaires en arrière-plan (non bloquant)
        // Couvertures
        setCouverturesLoading(true);
        setCouverturesError('');
        patientService.getPatientCouvertures(id)
          .then(couvertures => setCouvertures(couvertures))
          .catch(error => {
            console.error('Erreur lors du chargement des couvertures:', error);
            setCouvertures([]);
            setCouverturesError("Impossible de charger les couvertures mutuelles.");
          })
          .finally(() => setCouverturesLoading(false));
        
        // Documents
        loadPatientDocuments();
        // Hospitalisations (non bloquant)
        loadPatientHospitalisations();
        // RDV (non bloquant)
        loadPatientRdvHistory();
        // Justificatifs (non bloquant)
        loadPatientJustificatifs();
        
      } catch (error) {
        console.error('Erreur lors du chargement du patient:', error);
        setError(error);
        setLoading(false);
      }
    };

    if (id && !initFetched.current) {
      initFetched.current = true;
      loadPatient();
    }
  }, [id]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error && !loading) {
    return (
      <div className="min-h-screen bg-orange-100 p-6">
        <div className="max-w-7xl mx-auto">
          <ErrorMessage 
            message={error} 
            title="Erreur de chargement"
            dismissible={false}
          />
          <div className="mt-4 flex gap-4">
            <button 
              onClick={() => navigate('/patients')} 
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              Retour à la liste des patients
            </button>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Recharger la page
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="space-y-6 bg-orange-100 min-h-screen p-6 flex items-center justify-center">
        <div className="bg-orange-50 p-8 rounded-lg shadow-md text-center">
          <div className="text-gray-500 text-6xl mb-4">
            <span className="material-symbols-rounded text-gray-500 text-6xl">person</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Patient introuvable</h2>
          <p className="text-gray-600 mb-6">Ce patient n'existe pas ou a été supprimé.</p>
          <button
            onClick={() => navigate('/patients')}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Retour à la liste
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-orange-100 min-h-screen p-6">
      <div className="max-w-4xl mx-auto px-4">
        {/* Flash message */}
        {flashMessage.text && (
          <div className={`mb-4 ${flashMessage.type === 'success' ? 'bg-green-100 border-green-300 text-green-800' : 'bg-red-100 border-red-300 text-red-800'} border px-4 py-3 rounded`}>
            {flashMessage.text}
          </div>
        )}

        {/* Debug retiré */}

        {/* Header */}
        <div className="bg-orange-200 rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
                <span className="text-2xl font-bold text-orange-600">
                  {patient.prenom?.charAt(0)}{patient.nom?.charAt(0)}
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-3xl font-bold text-orange-800">
                    {patient.prenom} {patient.nom}
                  </h1>
                  {patientStatus && (
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${patientStatus.badgeClass}`}>
                      <span>{patientStatus.icon}</span>
                      <span>{patientStatus.label}</span>
                    </span>
                  )}
                </div>
                <p className="text-gray-600">Patient #{String(patient.id).slice(-8)}</p>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => navigate(`/patients/${patient.id}/modifier`)}
                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <span className="material-symbols-rounded text-white text-base">edit</span>
                Modifier patient
              </button>
              <button
                onClick={() => navigate('/patients')}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <span className="material-symbols-rounded text-white text-base">arrow_back</span>
                Retour à la liste
              </button>
            </div>
          </div>
        </div>

        {isPatientDeceased && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6 flex items-start gap-3">
            <span className="text-xl leading-none">⚰️</span>
            <div>
              <p className="font-semibold">Patient déclaré décédé</p>
              <p className="text-sm">La programmation de nouveaux rendez-vous est désactivée pour ce patient. Consultez le dossier uniquement.</p>
            </div>
          </div>
        )}

        {/* Statut des justificatifs */}
        {justificatifsStatus && (
          <div className={`mb-6 rounded-lg shadow-md p-6 ${justificatifsStatus.dossierComplet ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
            <div className="flex items-start gap-3 mb-4">
              <span className={`material-symbols-rounded text-2xl ${justificatifsStatus.dossierComplet ? 'text-green-600' : 'text-yellow-600'}`}>
                {justificatifsStatus.dossierComplet ? 'check_circle' : 'warning'}
              </span>
              <div className="flex-1">
                <h3 className={`text-lg font-semibold mb-1 ${justificatifsStatus.dossierComplet ? 'text-green-800' : 'text-yellow-800'}`}>
                  {justificatifsStatus.dossierComplet ? 'Dossier complet' : 'Dossier incomplet'}
                </h3>
                <p className={`text-sm ${justificatifsStatus.dossierComplet ? 'text-green-700' : 'text-yellow-700'}`}>
                  {justificatifsStatus.dossierComplet 
                    ? 'Tous les justificatifs requis sont présents' 
                    : `${justificatifsStatus.totalManquants} justificatif${justificatifsStatus.totalManquants > 1 ? 's' : ''} manquant${justificatifsStatus.totalManquants > 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
            
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-gray-800 mb-3">Justificatifs requis</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {justificatifsStatus.justificatifs.map((justificatif) => (
                  <div
                    key={justificatif.type}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      justificatif.present 
                        ? 'bg-white border-green-200' 
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`material-symbols-rounded ${justificatif.present ? 'text-green-600' : 'text-red-600'}`}>
                        {justificatif.present ? 'check_circle' : 'cancel'}
                      </span>
                      <span className={`text-sm font-medium ${justificatif.present ? 'text-gray-800' : 'text-red-700'}`}>
                        {justificatif.label}
                      </span>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${justificatif.present ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {justificatif.present ? 'Présent' : 'Manquant'}
                    </span>
                  </div>
                ))}
              </div>
              
              {justificatifsStatus.justificatifsManquants.length > 0 && (
                <div className="mt-4">
                  <button
                    onClick={() => navigate(`/documents?patient=${id}`)}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                  >
                    <span className="material-symbols-rounded text-base">upload_file</span>
                    Ajouter les justificatifs manquants
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {justificatifsLoading && (
          <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
              <span className="text-sm">Chargement du statut des justificatifs...</span>
            </div>
          </div>
        )}

        {/* Informations personnelles */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-orange-50 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="material-symbols-rounded text-blue-600">badge</span>
              Informations personnelles
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Genre :</span>
                <span className="font-medium">
                  {!patient.genre ? (
                    <span className="text-red-600 font-bold inline-flex items-center gap-1">
                      <span className="material-symbols-rounded text-red-600 text-base">error</span>
                      MANQUANT
                    </span>
                  ) : patient.genre === 'Mr' || patient.genre === 'M' ? (
                    'Mr'
                  ) : patient.genre === 'Mme' || patient.genre === 'F' ? (
                    'Mme'
                  ) : (
                    <span className="text-orange-600 font-bold inline-flex items-center gap-1">
                      <span className="material-symbols-rounded text-orange-600 text-base">warning</span>
                      {patient.genre}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Prénom :</span>
                <span className="font-medium">
                  {patient.prenom ? patient.prenom : <span className="text-red-600 font-bold">❌ MANQUANT</span>}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Nom :</span>
                <span className="font-medium">
                  {patient.nom ? patient.nom : <span className="text-red-600 font-bold">❌ MANQUANT</span>}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Date de naissance :</span>
                <span className="font-medium">
                  {patient.dateNaissance ? new Date(patient.dateNaissance).toLocaleDateString('fr-FR') : <span className="text-red-600 font-bold">❌ MANQUANT</span>}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="material-symbols-rounded text-green-600">call</span>
              Contact
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Email :</span>
                <span className="font-medium">
                  {patient.email ? patient.email : (
                    <span className="text-red-600 font-bold inline-flex items-center gap-1">
                      <span className="material-symbols-rounded text-red-600 text-base">error</span>
                      MANQUANT
                    </span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Téléphone :</span>
                <span className="font-medium">
                  {patient.telephone ? patient.telephone : (
                    <span className="text-red-600 font-bold inline-flex items-center gap-1">
                      <span className="material-symbols-rounded text-red-600 text-base">error</span>
                      MANQUANT
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="material-symbols-rounded text-purple-600">home_pin</span>
              Adresse
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Adresse L1 :</span>
                <span className="font-medium">
                  {patient.adresseL1 ? patient.adresseL1 : (
                    <span className="text-red-600 font-bold inline-flex items-center gap-1">
                      <span className="material-symbols-rounded text-red-600 text-base">error</span>
                      MANQUANT
                    </span>
                  )}
                </span>
              </div>
              {patient.adresseL2 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Adresse L2 :</span>
                  <span className="font-medium">{patient.adresseL2}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Ville :</span>
                <span className="font-medium">
                  {patient.ville ? patient.ville : (
                    <span className="text-red-600 font-bold inline-flex items-center gap-1">
                      <span className="material-symbols-rounded text-red-600 text-base">error</span>
                      MANQUANT
                    </span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Code postal :</span>
                <span className="font-medium">
                  {patient.codePostal ? patient.codePostal : (
                    <span className="text-red-600 font-bold inline-flex items-center gap-1">
                      <span className="material-symbols-rounded text-red-600 text-base">error</span>
                      MANQUANT
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="material-symbols-rounded text-orange-600">health_and_safety</span>
              Sécurité sociale
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Numéro de sécurité sociale :</span>
                <span className="font-medium">
                  {patient.numeroSecu ? patient.numeroSecu : (
                    <span className="text-red-600 font-bold inline-flex items-center gap-1">
                      <span className="material-symbols-rounded text-red-600 text-base">error</span>
                      MANQUANT
                    </span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Caisse payante :</span>
                <span className="font-medium">
                  {patient.organismeSecu ? patient.organismeSecu : (
                    <span className="text-red-600 font-bold inline-flex items-center gap-1">
                      <span className="material-symbols-rounded text-red-600 text-base">error</span>
                      MANQUANT
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Couvertures mutuelles */}
        <div className="bg-orange-50 rounded-lg shadow-md p-6 mt-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center justify-between">
            <span className="material-symbols-rounded text-green-600">business_center</span>
            <span className="flex items-center gap-2">
              <span>Couvertures mutuelles</span>
              {couverturesLoading && (
                <div className="ml-2 animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
              )}
            </span>
            <button onClick={openAddCouverture} className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-sm transition-colors inline-flex items-center gap-1">
              <span className="material-symbols-rounded text-white text-base">add</span>
              Ajouter
            </button>
          </h2>
          {couverturesError && (
            <div className="mb-3 bg-red-100 border border-red-300 text-red-800 px-3 py-2 rounded text-sm">{couverturesError}</div>
          )}
          {couverturesLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            </div>
          ) : couvertures.length > 0 ? (
            <div className="space-y-4">
              {couvertures.map((couverture, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded-lg border">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-gray-600 font-medium">Mutuelle :</span>
                      <p className="text-gray-800">{couverture.mutuelle?.nom || 'Non renseignée'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600 font-medium">Numéro d'adhérent :</span>
                      <p className="text-gray-800">{couverture.numeroAdherent || 'Non renseigné'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600 font-medium">Date de début :</span>
                      <p className="text-gray-800">
                        {couverture.dateDebut ? new Date(couverture.dateDebut).toLocaleDateString('fr-FR') : 'Non renseignée'}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600 font-medium">Date de fin :</span>
                      <p className="text-gray-800">
                        {couverture.dateFin ? new Date(couverture.dateFin).toLocaleDateString('fr-FR') : 'Non renseignée'}
                      </p>
                    </div>
                    <div className="md:col-span-2 flex items-center justify-between">
                      <div>
                        <span className="text-gray-600 font-medium">Statut :</span>
                        <span className={`ml-2 px-2 py-1 rounded-full text-sm ${
                          couverture.valide 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {couverture.valide ? 'Valide' : 'Expirée'}
                        </span>
                      </div>
                      <div>
                        <button
                          onClick={() => openEditCouverture(couverture)}
                          className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-sm transition-colors"
                        >
                          Modifier
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-400 text-4xl mb-2">🏥</div>
              <p className="text-gray-500">Aucune couverture mutuelle enregistrée</p>
              <p className="text-sm text-gray-400 mt-1">Les couvertures mutuelles seront affichées ici</p>
            </div>
          )}
        </div>

        {/* Documents du patient */}
        <div className="bg-orange-50 rounded-lg shadow-md p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <span className="material-symbols-rounded text-green-600">description</span>
              Documents du patient
            </h2>
            <button
              onClick={() => setShowAddDoc(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors inline-flex items-center gap-1"
            >
              <span className="material-symbols-rounded text-white text-base">upload_file</span>
              Ajouter
            </button>
          </div>
          
          <div className="overflow-auto pr-2 pb-6" style={{ maxHeight: 'calc(100vh - 320px)' }}>
            {documentsError && (
              <div className="mb-3 bg-red-100 border border-red-300 text-red-800 px-3 py-2 rounded text-sm">{documentsError}</div>
            )}
            {documentsLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
              </div>
            ) : documents.length > 0 ? (
              <div className="space-y-4">
              {documents.map((doc) => {
                const title = doc.originalName || doc.original_name || doc.title || doc.name || 'Document sans nom';
                const fileName = doc.fileName || doc.file_name || doc.name || 'Fichier inconnu';
                const mimeType = doc.mimeType || doc.mime_type || 'Type inconnu';
                const fileSize = doc.size || 0;
                const uploadedBy = doc.uploadedBy;
                const uploadedByName = uploadedBy ? `${uploadedBy.prenom || uploadedBy.firstName || ''} ${uploadedBy.nom || uploadedBy.lastName || ''}`.trim() : "Utilisateur inconnu";
                const isArchived = doc.archivedAt;

                return (
                  <div key={doc.id || doc['@id']} className="bg-white p-4 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-rounded text-green-600">description</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <h3 className="text-sm font-medium text-gray-900 truncate">{title}</h3>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              isArchived ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                            }`}>
                              {isArchived ? 'Archivé' : 'Actif'}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 space-y-1">
                            <div>{fileName} • {formatFileSize(fileSize)} • {mimeType}</div>
                            <div>
                              Ajouté le {formatDate(doc.uploadedAt || doc.uploaded_at)}
                              {uploadedByName && ` par ${uploadedByName}`}
                            </div>
                            {doc.contenu && (
                              <div className="text-gray-600">{doc.contenu}</div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {doc.type || 'Type inconnu'}
                        </span>
                        <button
                          onClick={() => {
                            // Fonction de téléchargement (à implémenter)
                          }}
                          className="p-2 text-green-600 hover:text-green-800 hover:bg-green-100 rounded-lg transition-colors inline-flex items-center"
                          title="Télécharger"
                        >
                          <span className="material-symbols-rounded text-base">download</span>
                        </button>
                        <button
                          onClick={() => { openPreview(doc); }}
                          className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-colors inline-flex items-center"
                          title="Voir"
                        >
                          <span className="material-symbols-rounded text-base">visibility</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-gray-400 text-4xl mb-2">
                  <span className="material-symbols-rounded text-gray-400 text-4xl">description</span>
                </div>
                <p className="text-gray-500">Aucun document enregistré</p>
                <p className="text-sm text-gray-400 mt-1">Les documents de ce patient apparaîtront ici</p>
              </div>
            )}
          </div>
        </div>

        {/* Notes médicales */}
        {patient.notes && (
          <div className="bg-orange-50 rounded-lg shadow-md p-6 mt-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="material-symbols-rounded text-red-600">note_alt</span>
              Notes médicales
            </h2>
            {(() => {
              const n = patient?.notes ?? {};
              if (typeof n === 'string') {
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white rounded-lg shadow p-4">
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Notes générales</h3>
                      <p className="text-gray-700 whitespace-pre-wrap">{n}</p>
                    </div>
                  </div>
                );
              }

              const sections = [
                {
                  label: 'Antécédents médicaux',
                  value: n.antecedents || n.antecedantsMedicaux || ''
                },
                {
                  label: 'Allergies',
                  value: n.allergies || ''
                },
                {
                  label: 'Traitements en cours',
                  value: n.traitements || n.traitementEnCours || ''
                },
                {
                  label: 'Autres informations',
                  value: n.autres || n.autresInformations || ''
                }
              ];

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sections.map(({ label, value }) => (
                    <div key={label} className="bg-white rounded-lg shadow p-4">
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">{label}</h3>
                      <p className="text-gray-700 whitespace-pre-wrap">{value ? value : '—'}</p>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* Hospitalisations */}
        <div className="bg-indigo-50 rounded-lg shadow-md p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-indigo-900 flex items-center gap-2">
              <span className="material-symbols-rounded text-indigo-600">local_hospital</span>
              Hospitalisations
            </h2>
            <button
              onClick={() => navigate(`/patients/${patient.id}/hospitalisations/nouveau`)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-sm transition-colors inline-flex items-center gap-1"
            >
              <span className="material-symbols-rounded text-white text-base">add</span>
              Nouvelle hospitalisation
            </button>
          </div>
          {hospisError && (
            <div className="mb-3 bg-red-100 border border-red-300 text-red-800 px-3 py-2 rounded text-sm">{hospisError}</div>
          )}
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
                {hospisLoading ? (
                  <tr><td colSpan="4" className="px-6 py-6 text-center text-gray-500">Chargement…</td></tr>
                ) : hospis.length === 0 ? (
                  <tr><td colSpan="4" className="px-6 py-6 text-center text-gray-500">Aucune hospitalisation</td></tr>
                ) : (
                  hospis.map(h => (
                    <tr key={h.id} className="hover:bg-indigo-50/40">
                      <td className="px-6 py-3 text-sm">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                          {h.statut}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-700">{h.uniteService || '—'}</td>
                      <td className="px-6 py-3 text-sm text-gray-700">
                        {h.plannedAdmissionDate ? h.plannedAdmissionDate : '—'}
                        {h.plannedDischargeDate ? ` → ${h.plannedDischargeDate}` : ''}
                      </td>
                      <td className="px-6 py-3 text-sm text-right">
                        <button
                          onClick={() => navigate(`/patients/${patient.id}/hospitalisations/${h.id}`)}
                          className="text-indigo-600 hover:text-indigo-800 text-sm"
                        >
                          Voir
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Historique des rendez-vous */}
        <div className="bg-pink-50 rounded-lg shadow-md p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-pink-900 flex items-center gap-2">
              <span className="material-symbols-rounded text-pink-600">event</span>
              Historique des rendez-vous
            </h2>
            <button
              onClick={() => navigate(`/appointments`)}
              className={`px-3 py-1 rounded text-sm transition-colors inline-flex items-center gap-1 ${isPatientDeceased ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-pink-600 hover:bg-pink-700 text-white'}`}
              disabled={isPatientDeceased}
              title={isPatientDeceased ? 'Agenda accessible uniquement en lecture pour ce patient.' : 'Voir agenda'}
            >
              <span className={`material-symbols-rounded text-base ${isPatientDeceased ? 'text-gray-500' : 'text-white'}`}>calendar_month</span>
              Voir agenda
            </button>
          </div>
          {isPatientDeceased && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
              La prise de rendez-vous est désactivée : ce patient est marqué comme décédé.
            </div>
          )}
          {rdvsError && (
            <div className="mb-3 bg-red-100 border border-red-300 text-red-800 px-3 py-2 rounded text-sm">{rdvsError}</div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-pink-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-pink-700 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-pink-700 uppercase tracking-wider">Statut</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-pink-700 uppercase tracking-wider">Motif</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rdvsLoading ? (
                  <tr><td colSpan="3" className="px-6 py-6 text-center text-gray-500">Chargement…</td></tr>
                ) : rdvs.length === 0 ? (
                  <tr><td colSpan="3" className="px-6 py-6 text-center text-gray-500">Aucun rendez-vous</td></tr>
                ) : (() => {
                  // Pagination
                  const totalPages = Math.ceil(rdvs.length / RDV_PER_PAGE);
                  const startIndex = (rdvCurrentPage - 1) * RDV_PER_PAGE;
                  const endIndex = startIndex + RDV_PER_PAGE;
                  const paginatedRdvs = rdvs.slice(startIndex, endIndex);
                  
                  return (
                    <>
                      {paginatedRdvs.map(r => {
                        const statut = r.statut || '';
                        const badgeClasses = getStatusBadgeClasses(statut);
                        return (
                          <tr key={r.id} className="hover:bg-pink-50/40">
                            <td className="px-6 py-3 text-sm text-gray-700">
                              {r.startAt ? new Date(r.startAt).toLocaleString('fr-FR') : (r.start_at ? new Date(r.start_at).toLocaleString('fr-FR') : '—')}
                            </td>
                            <td className="px-6 py-3 text-sm">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClasses}`}>
                                {statut || '—'}
                              </span>
                            </td>
                            <td className="px-6 py-3 text-sm text-gray-700">{r.motif || '—'}</td>
                          </tr>
                        );
                      })}
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>
          
          {/* Pagination pour l'historique des RDV */}
          {!rdvsLoading && rdvs.length > RDV_PER_PAGE && (() => {
            const totalPages = Math.ceil(rdvs.length / RDV_PER_PAGE);
            const startIndex = (rdvCurrentPage - 1) * RDV_PER_PAGE;
            const endIndex = startIndex + RDV_PER_PAGE;
            
            return (
              <div className="mt-4 flex items-center justify-between border-t border-pink-200 pt-4">
                <div className="text-sm text-gray-700">
                  Affichage de {startIndex + 1} à {Math.min(endIndex, rdvs.length)} sur {rdvs.length} rendez-vous
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setRdvCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={rdvCurrentPage === 1}
                    className={`px-3 py-2 rounded-lg border transition-colors ${
                      rdvCurrentPage === 1
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
                      } else if (rdvCurrentPage <= 3) {
                        pageNum = i + 1;
                      } else if (rdvCurrentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = rdvCurrentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setRdvCurrentPage(pageNum)}
                          className={`px-3 py-2 rounded-lg border transition-colors ${
                            rdvCurrentPage === pageNum
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
                    onClick={() => setRdvCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={rdvCurrentPage === totalPages}
                    className={`px-3 py-2 rounded-lg border transition-colors ${
                      rdvCurrentPage === totalPages
                        ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                        : "bg-white hover:bg-pink-50 border-pink-300 text-pink-700"
                    }`}
                  >
                    <span className="material-symbols-rounded text-base">chevron_right</span>
                  </button>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Informations système */}
        <div className="bg-orange-50 rounded-lg shadow-md p-6 mt-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="material-symbols-rounded text-gray-600">info</span>
            Informations système
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex justify-between">
              <span className="text-gray-600">ID Patient :</span>
              <span className="font-mono text-sm">{patient.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Créé le :</span>
              <span className="font-medium">
                {patient.createdAt ? new Date(patient.createdAt).toLocaleDateString('fr-FR') : 'Non renseigné'}
              </span>
            </div>
          </div>
        </div>

        {/* Modal aperçu document */}
        {showDocPreview && previewDoc && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">{previewDoc.originalName || previewDoc.title || 'Document'}</h3>
                  <p className="text-xs text-gray-500">{previewDoc.type || previewDoc.mimeType || 'Type inconnu'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      try {
                        const blob = previewDoc?.id ? await documentService.downloadDocument(previewDoc.id) : null;
                        if (!blob) return;
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = (previewDoc.originalName || previewDoc.title || 'document');
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                      } catch {}
                    }}
                    className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Télécharger
                  </button>
                  <button onClick={() => { setShowDocPreview(false); setPreviewDoc(null); revokePreviewUrl(); }} className="p-2 rounded hover:bg-gray-100">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="p-6 max-h-[70vh] overflow-auto">
                {previewLoading ? (
                  <div className="text-center text-gray-600 text-sm">Chargement de l'aperçu…</div>
                ) : previewError ? (
                  <div className="text-center text-gray-600 text-sm">{previewError} Utilisez Télécharger pour ouvrir le fichier.</div>
                ) : (() => {
                  const url = previewUrl;
                  const mime = (previewMime || previewDoc.mimeType || previewDoc.type || '').toLowerCase();
                  const isImage = mime.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(url || '');
                  const isPdf = mime === 'application/pdf' || /\.pdf$/i.test(url || '');
                  if (url && isImage) {
                    return <img src={url} alt="aperçu" className="max-h-[60vh] w-auto mx-auto rounded border" />;
                  }
                  if (url && isPdf) {
                    return <iframe title="aperçu" src={url} className="w-full h-[65vh] border rounded" />;
                  }
                  return <div className="text-center text-gray-600 text-sm">Aperçu non disponible. Utilisez Télécharger.</div>;
                })()}
              </div>
            </div>
          </div>
        )}
        {/* Modal ajout document */}
        {showAddDoc && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-xl mx-4">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">Ajouter un document</h3>
                <button onClick={closeAddDoc} className="p-2 rounded hover:bg-gray-100">
                  <span className="material-symbols-rounded">close</span>
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="border-2 border-dashed border-green-300 rounded-lg p-6 text-center">
                  <input type="file" onChange={(e) => setNewDocFile(e.target.files?.[0] ?? null)} />
                  {newDocFile && (
                    <div className="mt-3 text-sm text-gray-700">{newDocFile.name}</div>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={newDocType}
                    onChange={(e) => setNewDocType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
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
                      <option value="CONTACTS_URGENCE">Formulaire de contacts d'urgence</option>
                      <option value="CARTE_MUTUELLE">Carte mutuelle</option>
                    </optgroup>
                    <optgroup label="Documents de suivi">
                      <option value="DOSSIER_MEDICAL">Dossier médical</option>
                      <option value="PLAN_DE_SOINS">Plan de soins</option>
                      <option value="SUIVI_THERAPEUTIQUE">Suivi thérapeutique</option>
                    </optgroup>
                    <optgroup label="Documents spécialisés">
                      <option value="PSYCHOLOGIE">Psychologie</option>
                      <option value="KINESITHERAPIE">Kinésithérapie</option>
                      <option value="DIETETIQUE">Diététique</option>
                    </optgroup>
                    <optgroup label="Documents d'urgence">
                      <option value="FICHE_DE_LIAISON">Fiche de liaison</option>
                      <option value="PROTOCOLE_URGENCE">Protocole d'urgence</option>
                    </optgroup>
                    <optgroup label="Documents de recherche">
                      <option value="ETUDE_CLINIQUE">Étude clinique</option>
                      <option value="PUBLICATION_MEDICALE">Publication médicale</option>
                    </optgroup>
                    <option value="AUTRE">Autre</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contenu</label>
                  <textarea
                    value={newDocContent}
                    onChange={(e) => setNewDocContent(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Précisez le contenu du document si besoin"
                  />
                </div>
              </div>
              <div className="px-6 py-4 border-t flex items-center justify-end gap-2">
                <button onClick={closeAddDoc} className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50">Annuler</button>
                <button
                  onClick={submitAddDoc}
                  disabled={!newDocFile || uploadingDoc}
                  className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {uploadingDoc ? 'Envoi…' : 'Uploader'}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Modal édition couverture */}
        {showEditCouverture && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-xl mx-4 border border-orange-200">
              <div className="px-6 py-4 border-b border-orange-200 bg-orange-50 flex items-center justify-between rounded-t-lg">
                <h3 className="text-lg font-semibold text-orange-800">Modifier la couverture</h3>
                <button onClick={closeEditCouverture} className="text-orange-400 hover:text-orange-600">
                  <span className="material-symbols-rounded">close</span>
                </button>
              </div>
              <div className="px-6 py-4 space-y-4">
                {saveError && (
                  <div className="bg-red-100 text-red-800 text-sm px-3 py-2 rounded">{saveError}</div>
                )}
                <div className="relative">
                  <label className="block text-sm font-medium text-orange-700 mb-1">Mutuelle</label>
                  <input
                    type="text"
                    value={mutuelleQuery}
                    onChange={(e) => {
                      setMutuelleQuery(e.target.value);
                    }}
                    onFocus={() => { if (!mutuelleQuery) setMutuelleQuery(''); }}
                    placeholder="Rechercher une mutuelle..."
                    className="w-full px-3 py-2 border border-orange-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-400"
                  />
                  {/* Suggestions */}
                  {mutuelleQuery && (mutuelleSearching || (mutuelleResults && mutuelleResults.length > 0)) && (
                    <div className="absolute z-20 mt-1 w-full bg-white border border-orange-200 rounded shadow max-h-56 overflow-y-auto">
                      {mutuelleSearching && (
                        <div className="px-3 py-2 text-sm text-gray-500">Recherche...</div>
                      )}
                      {!mutuelleSearching && mutuelleResults.map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setEditFields(prev => ({ ...prev, mutuelleId: m.id }));
                            setMutuelleQuery(m.nom || m.id);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-orange-50 text-sm"
                        >
                          <div className="font-medium text-orange-800">{m.nom || '—'}</div>
                        </button>
                      ))}
                      {!mutuelleSearching && mutuelleResults.length === 0 && (
                        <div className="px-3 py-2 text-sm text-orange-600">Aucun résultat</div>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-orange-600 mt-1">Sélectionne une mutuelle dans la liste (enregistre l'ID).</p>
                  {mutuelleQuery && (
                    <p className="text-xs text-orange-700 mt-1">Mutuelle sélectionnée: <span className="font-medium">{mutuelleQuery}</span></p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-orange-700 mb-1">Numéro d'adhérent</label>
                  <input
                    type="text"
                    value={editFields.numeroAdherent}
                    onChange={(e) => handleEditField('numeroAdherent', e.target.value)}
                    className="w-full px-3 py-2 border border-orange-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-400"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-orange-700 mb-1">Date de début</label>
                    <input
                      type="date"
                      value={editFields.dateDebut}
                      onChange={(e) => handleEditField('dateDebut', e.target.value)}
                      className="w-full px-3 py-2 border border-orange-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-orange-700 mb-1">Date de fin</label>
                    <input
                      type="date"
                      value={editFields.dateFin}
                      onChange={(e) => handleEditField('dateFin', e.target.value)}
                      className="w-full px-3 py-2 border border-orange-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-400"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="couverture-valide"
                    type="checkbox"
                    checked={!!editFields.valide}
                    onChange={(e) => handleEditField('valide', e.target.checked)}
                    className="h-4 w-4 text-orange-600"
                  />
                  <label htmlFor="couverture-valide" className="text-sm text-orange-700">Valide</label>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-orange-200 flex items-center justify-end gap-3 rounded-b-lg">
                <button onClick={closeEditCouverture} className="px-4 py-2 rounded border border-orange-300 text-orange-700 hover:bg-orange-50">Annuler</button>
                <button
                  onClick={saveCouverture}
                  disabled={savingCouverture}
                  className="px-4 py-2 rounded bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-60"
                >
                  {savingCouverture ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientSingle;
