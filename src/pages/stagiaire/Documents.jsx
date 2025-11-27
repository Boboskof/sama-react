// src/pages/Documents.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import documentService from "../../_services/document.service";
import formateurService from "../../_services/formateur.service";
import patientService from "../../_services/patient.service";
import userService from "../../_services/user.service";
import { useSearch } from "../../hooks/useSearch";
import ErrorMessage from "../../components/ErrorMessage";
import LoadingSpinner from "../../components/LoadingSpinner";
import PatientSearchInput from "../../components/PatientSearchInput";
import { formatDateTime, formatFileSize } from "../../utils/dateHelpers";
import { getPatientNameString } from "../../utils/patientHelpers";
import PatientName from "../../components/PatientName";
// Avoid importing TS types in JSX runtime modules

const PAGE_SIZE = 10;

const statusClasses = {
  active: "bg-green-100 text-green-800",
  archived: "bg-red-100 text-red-800",
  default: "bg-gray-100 text-gray-800",
};

const Documents = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Filtres / pagination selon la documentation
  const [filters, setFilters] = useState({
    search: "",
    type: undefined, // string simple selon la doc
    archived: undefined, // boolean selon la doc
    patientId: undefined,
    date_from: undefined, // date_from selon la doc
    date_to: undefined,   // date_to selon la doc
    page: 1,
    per_page: 25 // per_page selon la doc (défaut 25)
  });
  
  // Lire le paramètre patient de l'URL au chargement
  useEffect(() => {
    const patientParam = searchParams.get('patient');
    if (patientParam) {
      setFilters(prev => ({ ...prev, patientId: patientParam }));
      // Nettoyer l'URL après avoir lu le paramètre
      searchParams.delete('patient');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Boutons rapides pour les filtres
  const quickFilters = [
    { label: 'Aujourd\'hui', action: () => {
      const today = new Date().toISOString().split('T')[0];
      const isActive = filters.date_from === today && filters.date_to === today;
      setFilters(f => ({ 
        ...f, 
        date_from: isActive ? undefined : today, 
        date_to: isActive ? undefined : today,
        page: 1
      }));
    }},
    { label: 'Cette semaine', action: () => {
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const weekStartStr = weekStart.toISOString().split('T')[0];
      const weekEndStr = weekEnd.toISOString().split('T')[0];
      const isActive = filters.date_from === weekStartStr && filters.date_to === weekEndStr;
      setFilters(f => ({ 
        ...f, 
        date_from: isActive ? undefined : weekStartStr, 
        date_to: isActive ? undefined : weekEndStr,
        page: 1
      }));
    }},
    { label: 'Ordonnances', action: () => {
      const isActive = filters.type === 'ORDONNANCE';
      setFilters(f => ({ 
        ...f, 
        type: isActive ? undefined : 'ORDONNANCE',
        page: 1
      }));
    }},
    { label: 'Analyses', action: () => {
      const isActive = filters.type === 'ANALYSES_BIOLOGIQUES';
      setFilters(f => ({ 
        ...f, 
        type: isActive ? undefined : 'ANALYSES_BIOLOGIQUES',
        page: 1
      }));
    }},
    { label: 'Radiographies', action: () => {
      const isActive = filters.type === 'RADIOGRAPHIE';
      setFilters(f => ({ 
        ...f, 
        type: isActive ? undefined : 'RADIOGRAPHIE',
        page: 1
      }));
    }},
    { label: 'Tous', action: () => {
      setFilters(f => ({ 
        ...f, 
        search: "",
        type: undefined,
        archived: undefined,
        patientId: undefined,
        date_from: undefined,
        date_to: undefined,
        page: 1
      }));
    }}
  ];

  // Données
  const [items, setItems] = useState([]);
  const [patients, setPatients] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, actifs: 0, archives: 0, aujourdHui: 0 });
  const [currentUser, setCurrentUser] = useState(null);

  // Options de recherche mémoïsées pour éviter les boucles d'effets
  const documentSearchOptions = useMemo(
    () => ({
      per_page: filters.per_page || 25,
      filters: {
        search: filters.search,
        type: filters.type,
        archived: filters.archived,
        patient_id: filters.patientId,
        date_from: filters.date_from,
        date_to: filters.date_to,
      },
    }),
    [
      filters.per_page,
      filters.search,
      filters.type,
      filters.archived,
      filters.patientId,
      filters.date_from,
      filters.date_to,
    ]
  );

  // Hook de recherche pour les documents (simplifié)
  const { 
    query, 
    setQuery, 
    results: searchResults, 
    loading: searchLoading, 
    error: searchError, 
    total: searchTotal 
  } = useSearch('documents', documentSearchOptions);

  // UI
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  // Upload
  const [file, setFile] = useState(null);
  const [docTitle, setDocTitle] = useState("");
  const [docType, setDocType] = useState("COMPTE_RENDU_CONSULTATION"); // Valeurs de l'enum TypeDocument
  const [uploading, setUploading] = useState(false);
  const [globalMsg, setGlobalMsg] = useState({ type: '', text: '' });
  const [titleError, setTitleError] = useState('');

  // Charger patients (pour select)
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        // Utilisateur courant (pour filtrer uploadedBy.id)
        let u = userService.getUser();
        if (!u) {
          try { u = await userService.getCurrentUser(); } catch {}
        }
        if (!cancel) setCurrentUser(u || null);

        const data = await patientService.getAllPatients({ limit: 100, "order[nom]": "asc" });
        if (!cancel) setPatients(Array.isArray(data) ? data : []);
      } catch {
        if (!cancel) setPatients([]);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  // Fonction pour charger les documents selon la documentation
  const loadDocuments = useCallback(async () => {
    setLoading(true);
      setErr(null);
    try {
      // Construire les paramètres selon la documentation frontend-documents-filtres.md
      const params = {
        page: filters.page || 1,
        per_page: filters.per_page || 25,
        search: filters.search || query || undefined,
        type: filters.type || undefined,
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
        archived: filters.archived !== undefined ? filters.archived : undefined,
      };
      
      // Ajouter le filtre patient si présent
      if (filters.patientId) {
        params.patient = filters.patientId;
      }
      
      // Nettoyer les paramètres undefined
      Object.keys(params).forEach(key => {
        if (params[key] === undefined) {
          delete params[key];
        }
      });
      
      // Utiliser documentService qui gère correctement Axios
      // Le service utilise déjà safeGetList qui gère les formats de réponse
      const data = await documentService.getDocuments(params);
      const documents = Array.isArray(data) ? data : [];
      
      // Pour la pagination, on devra peut-être adapter si le backend renvoie un format différent
      // Pour l'instant, on utilise la longueur du tableau comme total
      let paginationData = null;
      
      // OPTIMISATION: Enrichissement uniquement si nécessaire et avec limite
      if (documents.length > 0) {
        const needPatientLookup = documents.some(doc => typeof doc?.patient === 'string');
        // Si uploadedBy est un IRI string, tenter un enrichissement via détail du document
        const needDetailLookup = documents.some(doc => typeof doc?.uploadedBy === 'string' && !doc?.uploaded_by);

        let patientsMap = null;
        if (needPatientLookup) {
          try {
            // OPTIMISATION: Extraire les IDs des patients depuis les IRIs au lieu de charger tous les patients
            const patientIds = documents
              .map(doc => {
                if (typeof doc?.patient === 'string' && doc.patient.includes('/api/patients/')) {
                  return doc.patient.split('/').pop();
                }
                return null;
              })
              .filter(Boolean);
            
            // OPTIMISATION: Charger uniquement les patients nécessaires (si l'API le supporte)
            // Sinon, limiter à 50 patients max pour éviter de charger toute la base
            if (patientIds.length > 0 && patientIds.length <= 20) {
              // Si peu de patients, les charger individuellement en parallèle
              const patientPromises = patientIds.map(id => 
                patientService.getOnePatient(id).catch(() => null)
              );
              const patientsData = await Promise.all(patientPromises);
              patientsMap = new Map();
              patientsData.forEach(patient => {
                if (patient?.id) {
                  patientsMap.set(`/api/patients/${patient.id}`, patient);
                }
              });
            } else {
              // OPTIMISATION: Limiter à 50 patients max si trop nombreux
              const patientsData = await patientService.getAllPatients({ limit: 50 });
              patientsMap = new Map();
              patientsData.forEach(patient => {
                patientsMap.set(`/api/patients/${patient.id}`, patient);
              });
            }
          } catch {}
        }

        let enrichedDocuments = documents.map(doc => {
          const withPatient = needPatientLookup && patientsMap && typeof doc?.patient === 'string'
            ? { ...doc, patient: patientsMap.get(doc.patient) || doc.patient }
            : doc;
          return withPatient;
        });

        // OPTIMISATION: Limiter les appels getOneDocument pour éviter les appels multiples
        if (needDetailLookup && enrichedDocuments.length <= 10) {
          // OPTIMISATION: Ne faire l'enrichissement que si peu de documents (max 10)
          try {
            const detailResults = await Promise.all(
              enrichedDocuments.map(async (doc) => {
                if (typeof doc?.uploadedBy === 'string' && !doc?.uploaded_by) {
                  const rawId = doc?.id || (typeof doc?.["@id"] === 'string' ? doc["@id"].split('/').pop() : null);
                  if (!rawId) return doc;
                  try {
                    const full = await documentService.getOneDocument(rawId);
                    if (full && full.uploaded_by && typeof full.uploaded_by === 'object') {
                      return { ...doc, uploaded_by: full.uploaded_by };
                    }
                  } catch {}
                }
                return doc;
              })
            );
            enrichedDocuments = detailResults;
          } catch {}
        }

        // Si toujours pas d'objet uploaded_by, tenter une résolution par liste stagiaires (formateur uniquement)
        const isFormateur = userService.isFormateur && userService.isFormateur();
        if (isFormateur) {
          try {
            const iriIds = new Set(
              enrichedDocuments
                .filter(d => typeof d?.uploadedBy === 'string' && !d?.uploaded_by)
                .map(d => String(d.uploadedBy).split('/').pop())
                .filter(Boolean)
            );
            if (iriIds.size > 0) {
              const stagiaires = await formateurService.getAllStagiaires();
              const byId = new Map(stagiaires.map(u => [String(u.id), u]));
              enrichedDocuments = enrichedDocuments.map(d => {
                if (typeof d?.uploadedBy === 'string' && !d?.uploaded_by) {
                  const id = String(d.uploadedBy).split('/').pop();
                  const u = id ? byId.get(id) : null;
                  if (u) {
                    return { ...d, uploaded_by: { id: u.id, prenom: u.prenom, nom: u.nom, email: u.email } };
                  }
                }
                return d;
              });
            }
          } catch {}
        }

        setItems(enrichedDocuments);
      } else {
        setItems(documents);
      }
      setTotal(documents.length);
      // Calcul de stats simples sur le jeu courant et total global via searchTotal
      const isToday = (d) => {
        if (!d) return false; const dt = new Date(d); const t0 = new Date(); t0.setHours(0,0,0,0); const t1 = new Date(t0); t1.setDate(t0.getDate()+1); return dt>=t0 && dt<t1;
      };
      const actifs = documents.filter(d => !d.archivedAt).length;
      const archives = documents.filter(d => !!d.archivedAt).length;
      const aujourdHui = documents.filter(d => isToday(d.uploadedAt || d.uploaded_at)).length;
      setStats({ total: Number(searchTotal || documents.length), actifs, archives, aujourdHui });
      setErr(null); // Réinitialiser l'erreur en cas de succès
    } catch (e) {
      // Gestion d'erreur améliorée : ne pas bloquer l'interface en cas de timeout
      const isTimeout = e?.code === 'ECONNABORTED' || e?.message?.includes('timeout');
      if (isTimeout) {
        console.warn("Timeout lors du chargement des documents - affichage des données en cache si disponibles");
        // Ne pas vider les items si c'est juste un timeout - garder les données précédentes
        // On utilise une fonction de mise à jour pour préserver l'état actuel
        setItems(prevItems => prevItems.length > 0 ? prevItems : []);
        setTotal(prevTotal => prevTotal > 0 ? prevTotal : 0);
      } else {
        console.error("Erreur lors du chargement des documents:", e);
        setErr(e);
        setItems([]);
        setTotal(0);
      }
    } finally {
      setLoading(false);
    }
  }, [query, filters.patientId, filters.page, filters.search, filters.type, filters.archived, filters.date_from, filters.date_to, filters.per_page, currentUser?.id]);

  // Charger documents
  // Ne pas inclure loadDocuments dans les dépendances pour éviter les boucles
  // loadDocuments est déjà mémorisé avec useCallback et ses dépendances sont explicites
  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filters.patientId, filters.page, filters.search, filters.type, filters.archived, filters.date_from, filters.date_to, filters.per_page, currentUser?.id]);

  const pages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);
  const canPrev = filters.page > 1;
  const canNext = filters.page < pages;

  // Actions
  const download = async (id, name = "document") => {
    try {
      const blob = await documentService.downloadDocument(id);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name}.pdf`; // ajuste selon mime/type
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Téléchargement impossible.");
    }
  };

  const archiveDocument = async (id) => {
    try {
      const updated = await documentService.archiveDocument(id);
      setItems((prev) => prev.map((d) => (d.id === id ? { ...d, ...updated } : d)));
    } catch (e) {
      console.error(e);
      alert("Archivage impossible.");
    }
  };

  const restoreDocument = async (id) => {
    try {
      const updated = await documentService.restoreDocument(id);
      setItems((prev) => prev.map((d) => (d.id === id ? { ...d, ...updated } : d)));
    } catch (e) {
      console.error(e);
      alert("Restauration impossible.");
    }
  };

  const remove = async (id) => {
    if (!confirm("Supprimer ce document ?")) return;
    try {
      await documentService.deleteDocument(id);
      setItems((prev) => prev.filter((d) => d.id !== id));
    } catch (e) {
      console.error(e);
      alert("Suppression impossible.");
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (f) setFile(f);
  };

  const onUpload = async () => {
    if (!file) return;
    
    // Validation : le titre est obligatoire
    if (!docTitle || !docTitle.trim()) {
      setTitleError("Veuillez renseigner un titre.");
      return;
    }
    
    // Effacer l'erreur si le titre est valide
    setTitleError('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (docType) fd.append("type", docType);
      if (filters.patientId) {
        // adapte selon ton backend: id brut ou IRI '/api/patients/<id>'
        fd.append("patient", filters.patientId);
      }
      // Le titre saisi par l'utilisateur devient original_name dans la BDD
      fd.append("original_name", docTitle.trim());
      fd.append("title", docTitle.trim());
      const created = await documentService.createDocument(fd);
      
      // Le backend retourne maintenant les données complètes
      const documentData = created.data || created;
      
      // Ajout optimiste en tête
      setItems((prev) => [documentData, ...prev]);
      setFile(null);
      setDocTitle("");
      setDocType("COMPTE_RENDU");
      
      // Recharger la liste complète pour avoir les données à jour
      setTimeout(() => {
        loadDocuments();
      }, 500);
      
      alert("Document uploadé avec succès !");
    } catch (e) {
      console.error(e);
      setGlobalMsg({ type: 'error', text: "Erreur lors de l'upload du document." });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 bg-green-100 min-h-screen w-[95%] md:w-[90%] lg:w-[80%] mx-auto px-2 md:px-4 py-4 md:py-6">
      {err && (
        <div className="mb-4">
          <ErrorMessage 
            message={err} 
            title="Erreur de chargement"
            dismissible={true}
            onDismiss={() => setErr(null)}
          />
        </div>
      )}
      {globalMsg.text && (
        <div className={`${globalMsg.type === 'success' ? 'bg-green-100 border-green-300 text-green-800' : 'bg-red-100 border-red-300 text-red-800'} border px-4 py-3 rounded mb-4`}>{globalMsg.text}</div>
      )}
      
      {/* Titre centré avec icône et description */}
      <div className="text-center py-6">
        <div className="bg-green-200 rounded-lg shadow p-6 max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center shadow-sm">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-green-800">Documents Médicaux</h1>
          </div>
          <p className="text-green-600 text-sm">
            Gestion et archivage des documents médicaux
          </p>
        </div>
      </div>

      {/* Tuiles de statistiques (basées sur les filtres courants) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white/90 backdrop-blur-sm p-6 rounded-lg shadow-lg border border-green-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-base font-medium text-gray-600">Total (filtre)</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/90 backdrop-blur-sm p-6 rounded-lg shadow-lg border border-green-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-base font-medium text-gray-600">Actifs</p>
              <p className="text-2xl font-bold text-gray-900">{stats.actifs}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/90 backdrop-blur-sm p-6 rounded-lg shadow-lg border border-green-200">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-base font-medium text-gray-600">Archivés</p>
              <p className="text-2xl font-bold text-gray-900">{stats.archives}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/90 backdrop-blur-sm p-6 rounded-lg shadow-lg border border-green-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-base font-medium text-gray-600">Aujourd'hui</p>
              <p className="text-2xl font-bold text-gray-900">{stats.aujourdHui}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Upload (caché pour le rôle formateur) */}
      {!(userService.isFormateur && userService.isFormateur()) && (
      <div className="bg-white rounded-lg shadow p-6 border border-green-200">
        <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center gap-2">
          <span className="material-symbols-rounded text-green-700">upload_file</span>
          Ajouter un document
        </h3>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className="border-2 border-dashed border-green-300 rounded-lg p-8 flex flex-col items-center justify-center text-center hover:bg-green-50 hover:border-green-400 transition-colors"
        >
          <svg className="w-12 h-12 text-green-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-sm text-green-700 mb-2">
            Glissez-déposez un fichier ici ou
            <label className="text-green-600 cursor-pointer ml-1 font-medium hover:text-green-800">
              choisissez un fichier
              <input
                type="file"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </p>
          <p className="text-xs text-green-600">Formats acceptés : PDF, DOC, DOCX, JPG, PNG</p>
          {file && (
            <div className="mt-4 p-3 bg-green-100 rounded-lg border border-green-200">
              <p className="text-sm text-green-800 font-medium">Fichier sélectionné : {file.name}</p>
              <p className="text-xs text-green-600">Taille : {(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-green-700 mb-2">
              Titre du document <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-400 ${
                titleError ? 'border-red-300 focus:border-red-400 focus:ring-red-500' : 'border-green-300'
              }`}
              placeholder="Ex: Compte rendu consultation"
              value={docTitle}
              onChange={(e) => {
                setDocTitle(e.target.value);
                // Effacer le message d'erreur quand l'utilisateur commence à taper
                if (titleError) {
                  setTitleError('');
                }
              }}
              required
            />
            {titleError && (
              <p className="mt-1 text-sm text-red-600">{titleError}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-green-700 mb-2">Type de document</label>
            <select
              className="w-full px-4 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-400"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
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
            <PatientSearchInput
              patients={patients}
              value={filters.patientId || ''}
              onChange={(patientId) => setFilters(f => ({ ...f, patientId: patientId || undefined }))}
              placeholder="Rechercher un patient (nom, prénom, email, téléphone...)"
              label="Patient associé"
              labelClassName="block text-sm font-medium text-green-700 mb-2"
              inputClassName="w-full px-4 py-2 pr-10 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-400 bg-white"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            disabled={!file || uploading}
            onClick={onUpload}
            className="px-6 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg hover:shadow-xl transition-all"
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner color="white" size="small" inline={true} />
                Envoi en cours...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Uploader le document
              </span>
            )}
          </button>
        </div>
      </div>
      )}

      {/* Liste des documents */}
      <div className="bg-white rounded-lg shadow border border-green-200 w-full mx-0">
        <div className="py-6 border-b-2 border-green-200 bg-green-50 rounded-t-lg">
          <div className="flex items-center justify-between gap-4 flex-wrap px-4 md:px-6 mb-4">
            <h3 className="text-lg font-semibold text-green-800 flex items-center gap-2">
              <span className="material-symbols-rounded text-green-700">folder_open</span>
              Liste des documents {loading ? "— chargement…" : ""}
            </h3>
            <div className="flex items-center gap-2 bg-green-100 px-3 py-1 rounded-full">
              <span className="material-symbols-rounded text-green-600 text-2xl">description</span>
              <span className="text-sm text-green-700 font-medium">
                {items.length} document{items.length > 1 ? "s" : ""}
              </span>
            </div>
          </div>
          
          {/* Section de filtres */}
          <div className="px-4 md:px-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Recherche textuelle */}
              <div>
                <label className="block text-sm font-medium text-green-700 mb-2">Recherche</label>
                <input
                  type="text"
                  value={filters.search || ''}
                  onChange={(e) => setFilters(f => ({ ...f, search: e.target.value, page: 1 }))}
                  placeholder="Nom du document..."
                  className="w-full px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-400"
                />
              </div>
              
              {/* Dropdown Type */}
              <div>
                <label className="block text-sm font-medium text-green-700 mb-2">Type de document</label>
                <select
                  value={filters.type || ''}
                  onChange={(e) => setFilters(f => ({ ...f, type: e.target.value || undefined, page: 1 }))}
                  className="w-full px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-400 bg-white"
                >
                  <option value="">Tous les types</option>
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
              
              {/* Date de début */}
              <div>
                <label className="block text-sm font-medium text-green-700 mb-2">Date de début</label>
                <input
                  type="date"
                  value={filters.date_from || ''}
                  onChange={(e) => setFilters(f => ({ ...f, date_from: e.target.value || undefined, page: 1 }))}
                  className="w-full px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-400"
                />
              </div>
              
              {/* Date de fin */}
              <div>
                <label className="block text-sm font-medium text-green-700 mb-2">Date de fin</label>
                <input
                  type="date"
                  value={filters.date_to || ''}
                  onChange={(e) => setFilters(f => ({ ...f, date_to: e.target.value || undefined, page: 1 }))}
                  className="w-full px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-400"
                />
              </div>
            </div>
            
            {/* Ligne 2 : Patient, Archivé, Boutons rapides */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              {/* Patient */}
              <div>
                <PatientSearchInput
                  patients={patients}
                  value={filters.patientId || ''}
                  onChange={(patientId) => setFilters(f => ({ ...f, patientId: patientId || undefined, page: 1 }))}
                  placeholder="Rechercher un patient..."
                  label="Patient"
                  labelClassName="block text-sm font-medium text-green-700 mb-2"
                  inputClassName="w-full px-3 py-2 pr-10 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-400 bg-white"
                />
              </div>
              
              {/* Statut archivé */}
              <div>
                <label className="block text-sm font-medium text-green-700 mb-2">Statut</label>
                <select
                  value={filters.archived === undefined ? '' : (filters.archived ? 'archived' : 'active')}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFilters(f => ({ 
                      ...f, 
                      archived: value === '' ? undefined : (value === 'archived'),
                      page: 1 
                    }));
                  }}
                  className="w-full px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-400 bg-white"
                >
                  <option value="">Tous</option>
                  <option value="active">Actifs uniquement</option>
                  <option value="archived">Archivés uniquement</option>
                </select>
              </div>
              
              {/* Boutons rapides */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-green-700">Filtres rapides:</span>
                {quickFilters.map((filter, index) => (
                  <button
                    key={index}
                    onClick={filter.action}
                    className={`px-3 py-1 rounded-full text-xs transition-colors ${
                      (filter.label === 'Aujourd' + "'" + 'hui' && filters.date_from && filters.date_to && filters.date_from === filters.date_to && filters.date_from === new Date().toISOString().split('T')[0]) ||
                      (filter.label === 'Cette semaine' && filters.date_from && filters.date_to) ||
                      (filter.label === 'Ordonnances' && filters.type === 'ORDONNANCE') ||
                      (filter.label === 'Analyses' && filters.type === 'ANALYSES_BIOLOGIQUES') ||
                      (filter.label === 'Radiographies' && filters.type === 'RADIOGRAPHIE') ||
                      (filter.label === 'Tous' && !filters.type && filters.archived === undefined && !filters.patientId && !filters.date_from && !filters.date_to && !filters.search)
                        ? 'bg-green-100 text-green-800 border border-green-300' 
                        : 'bg-white text-green-700 hover:bg-green-50 border border-green-300'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      
      
        <div className="w-full overflow-x-auto">
          <table className="w-full">
            <thead className="bg-green-100">
              <tr>
                <th className="px-3 py-4 text-center text-xs font-semibold text-green-700 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-1">
                    <span className="material-symbols-rounded text-green-700 text-xl">description</span>
                    <span className="hidden sm:inline">Titre</span>
                  </div>
                </th>
                <th className="px-3 py-4 text-center text-xs font-semibold text-green-700 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-1">
                    <span className="material-symbols-rounded text-green-700 text-xl">person</span>
                    <span className="hidden sm:inline">Patient</span>
                  </div>
                </th>
                <th className="px-3 py-4 text-center text-xs font-semibold text-green-700 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-1">
                    <span className="material-symbols-rounded text-green-700 text-xl">label</span>
                    <span className="hidden sm:inline">Type</span>
                  </div>
                </th>
                <th className="px-3 py-4 text-center text-xs font-semibold text-green-700 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-1">
                    <span className="material-symbols-rounded text-green-700 text-xl">schedule</span>
                    <span className="hidden sm:inline">Créé le</span>
                  </div>
                </th>
                { (userService.isFormateur && userService.isFormateur()) && (
                  <th className="px-3 py-4 text-center text-xs font-semibold text-green-700 uppercase tracking-wider">
                    <div className="flex items-center justify-center gap-1">
                      <span className="material-symbols-rounded text-green-700 text-xl">badge</span>
                      <span className="hidden sm:inline">Créé par</span>
                    </div>
                  </th>
                )}
                <th className="px-3 py-4 text-center text-xs font-semibold text-green-700 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-1">
                    <span className="material-symbols-rounded text-green-700 text-xl">task_alt</span>
                    <span className="hidden sm:inline">Statut</span>
                  </div>
                </th>
                <th className="px-3 py-4 text-center text-xs font-semibold text-green-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-green-200">
              {loading ? (
                <tr>
                  <td colSpan={(userService.isFormateur && userService.isFormateur()) ? 7 : 6} className="px-6 py-12 text-center">
                    <LoadingSpinner color="green" message="Chargement des documents..." />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={(userService.isFormateur && userService.isFormateur()) ? 7 : 6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <svg className="w-16 h-16 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div>
                        <p className="text-lg font-medium text-green-600">Aucun document trouvé</p>
                        <p className="text-sm text-green-500">Les documents uploadés apparaîtront ici</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((d) => {
                  const id = d.id ?? d["@id"];
                  const title = d.originalName || d.original_name || d.title || d.name || 'Document sans nom';
                  const fileName = d.fileName || d.file_name || d.name || 'Fichier inconnu';
                  const mimeType = d.mimeType || d.mime_type || 'Type inconnu';
                  const fileSize = d.size || 0;
                  const p = d.patient;
                  
                  // Gestion robuste du nom du patient
                  let patientName = "Patient inconnu";
                  if (p) {
                    if (typeof p === 'string') {
                      // Si c'est une string (IRI), on ne peut pas afficher le nom
                      patientName = "Patient (IRI)";
                    } else {
                      patientName = getPatientNameString(p, false);
                    }
                  }
                  // Lecture robuste du créateur/uploader (objet direct, pas de résolution réseau)
                  // uploaded_by est renvoyé par le back pour tous les rôles
                  const uploader = d.uploaded_by || d.uploadedBy || d.created_by || d.createdBy || null;
                  let uploadedByName = '—';
                  if (uploader && typeof uploader === 'object') {
                    uploadedByName = `${(uploader.prenom || uploader.firstName || '').trim()} ${(uploader.nom || uploader.lastName || '').trim()}`.trim() || '—';
                  } else if (typeof d.uploadedBy === 'string') {
                    // Fallback lisible si encore IRI
                    const last = d.uploadedBy.split('/').pop();
                    uploadedByName = last || '—';
                  }
                  const st = d.archivedAt ? 'archived' : 'active';
                  const badge = statusClasses[st] ?? statusClasses.default;

                  return (
                    <tr key={id} className="hover:bg-green-50 transition-colors">
                      <td className="px-3 py-5 align-top">
                        <div className="flex items-start gap-2">
                          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="text-sm font-medium text-gray-900 break-words min-w-0 leading-relaxed" title={title}>{title}</div>
                        </div>
                      </td>
                      <td className="px-3 py-5 align-top">
                        <div className="flex items-start gap-2">
                          <div className="w-7 h-7 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-semibold text-green-600">
                              {patientName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </span>
                          </div>
                          <span className="text-sm text-gray-700 break-words min-w-0 leading-relaxed" title={patientName}>
                            {typeof p === 'object' && p !== null ? <PatientName patient={p} /> : patientName || "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-5 align-top text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 break-words max-w-full whitespace-normal">
                          {d.type || 'Type inconnu'}
                        </span>
                      </td>
                      <td className="px-3 py-5 text-sm text-gray-600 align-top text-center">
                        <div className="break-words whitespace-normal leading-relaxed">{formatDateTime(d.uploadedAt || d.uploaded_at)}</div>
                      </td>
                      {(userService.isFormateur && userService.isFormateur()) && (
                        <td className="px-3 py-5 text-sm text-gray-700 align-top text-center">
                          <div className="break-words whitespace-normal leading-relaxed">{uploadedByName || '—'}</div>
                        </td>
                      )}
                      <td className="px-3 py-5 align-top text-center">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${badge}`}>
                          {st === "active" ? "Actif" : st === "archived" ? "Archivé" : st}
                        </span>
                      </td>
                      <td className="px-3 py-5 align-top">
                        <div className="flex items-center gap-1 justify-center">
                          <button
                            className="p-1.5 text-green-600 hover:text-green-800 hover:bg-green-100 rounded-lg transition-colors"
                            onClick={() => download(d.id ?? d["@id"], title)}
                            title="Télécharger"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </button>
                          {st === "active" ? (
                            <button
                              className="p-1.5 text-orange-600 hover:text-orange-800 hover:bg-orange-100 rounded-lg transition-colors"
                              onClick={() => archiveDocument(d.id ?? d["@id"])}
                              title="Archiver"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8l4 4-4 4m6-8l4 4-4 4" />
                              </svg>
                            </button>
                          ) : (
                            <button
                              className="p-1.5 text-green-600 hover:text-green-800 hover:bg-green-100 rounded-lg transition-colors"
                              onClick={() => restoreDocument(d.id ?? d["@id"])}
                              title="Restaurer"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            </button>
                          )}
                          <button
                            className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-lg transition-colors"
                            onClick={() => remove(d.id ?? d["@id"])}
                            title="Supprimer"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination en bas */}
        <div className="py-6 border-t border-green-200 bg-green-50 flex items-center justify-between px-4 md:px-6">
          <div className="text-sm text-green-700">
            Page {filters.page} sur {pages} • {items.length} document{items.length > 1 ? "s" : ""} affiché{items.length > 1 ? "s" : ""}
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={!canPrev}
              onClick={() => canPrev && setFilters(f => ({ ...f, page: f.page - 1 }))}
              className={`px-4 py-2 rounded-lg border transition-colors flex items-center gap-2 ${
                canPrev 
                  ? "bg-white hover:bg-green-50 border-green-300 text-green-700" 
                  : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
              }`}
              title="Page précédente"
            >
              <span className="material-symbols-rounded text-2xl">chevron_left</span>
              Précédent
            </button>
            <span className="text-sm text-green-700 px-4 py-2 bg-white rounded-lg border border-green-300 font-medium">
              {filters.page} / {pages}
            </span>
            <button
              disabled={!canNext}
              onClick={() => canNext && setFilters(f => ({ ...f, page: f.page + 1 }))}
              className={`px-4 py-2 rounded-lg border transition-colors flex items-center gap-2 ${
                canNext 
                  ? "bg-white hover:bg-green-50 border-green-300 text-green-700" 
                  : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
              }`}
              title="Page suivante"
            >
              Suivant
              <span className="material-symbols-rounded text-2xl">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Documents;