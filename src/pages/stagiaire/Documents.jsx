// src/pages/Documents.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import documentService from "../../_services/document.service";
import formateurService from "../../_services/formateur.service";
import patientService from "../../_services/patient.service";
import userService from "../../_services/user.service";
import { useSearch } from "../../hooks/useSearch";
import ErrorMessage from "../../components/ErrorMessage";
// Avoid importing TS types in JSX runtime modules

const PAGE_SIZE = 10;

function fmtDate(d) {
  if (!d) return "—";
  try {
    const date = new Date(d);
    return date.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    return "Date invalide";
  }
}

function fmtFileSize(bytes) {
  if (!bytes) return "—";
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

const statusClasses = {
  active: "bg-green-100 text-green-800",
  archived: "bg-red-100 text-red-800",
  default: "bg-gray-100 text-gray-800",
};

const Documents = () => {
  // Filtres / pagination (structure simplifiée)
  const [filters, setFilters] = useState({
    search: "",
    type: [],
    statut: [],
    patientId: undefined,
    dateDebut: undefined,
    dateFin: undefined,
    page: 1,
    limit: 10
  });

  // Boutons rapides pour les filtres
  const quickFilters = [
    { label: 'Aujourd\'hui', action: () => {
      const today = new Date().toISOString().split('T')[0];
      const isActive = filters.dateDebut === today && filters.dateFin === today;
      setFilters(f => ({ 
        ...f, 
        dateDebut: isActive ? undefined : today, 
        dateFin: isActive ? undefined : today,
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
      const isActive = filters.dateDebut === weekStartStr && filters.dateFin === weekEndStr;
      setFilters(f => ({ 
        ...f, 
        dateDebut: isActive ? undefined : weekStartStr, 
        dateFin: isActive ? undefined : weekEndStr,
        page: 1
      }));
    }},
    { label: 'Ordonnances', action: () => {
      const isActive = filters.type?.includes('ORDONNANCE');
      setFilters(f => ({ 
        ...f, 
        type: isActive 
          ? (f.type || []).filter(t => t !== 'ORDONNANCE')
          : ['ORDONNANCE'],
        page: 1
      }));
    }},
    { label: 'Analyses', action: () => {
      const isActive = filters.type?.includes('ANALYSE');
      setFilters(f => ({ 
        ...f, 
        type: isActive 
          ? (f.type || []).filter(t => t !== 'ANALYSE')
          : ['ANALYSE'],
        page: 1
      }));
    }},
    { label: 'Radiographies', action: () => {
      const isActive = filters.type?.includes('RADIOGRAPHIE');
      setFilters(f => ({ 
        ...f, 
        type: isActive 
          ? (f.type || []).filter(t => t !== 'RADIOGRAPHIE')
          : ['RADIOGRAPHIE'],
        page: 1
      }));
    }},
    { label: 'Tous', action: () => {
      setFilters(f => ({ 
        ...f, 
        search: "",
        type: [],
        statut: [],
        patientId: undefined,
        dateDebut: undefined,
        dateFin: undefined,
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

  // Hook de recherche pour les documents (simplifié)
  const { 
    query, 
    setQuery, 
    results: searchResults, 
    loading: searchLoading, 
    error: searchError, 
    total: searchTotal 
  } = useSearch('documents', { 
    limit: filters.limit || 25,
    filters: {
      search: filters.search,
      type: filters.type?.[0],
      statut: filters.statut?.[0],
      patient_id: filters.patientId,
      date_from: filters.dateDebut,
      date_to: filters.dateFin
    }
  });

  // UI
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  // Upload
  const [file, setFile] = useState(null);
  const [docTitle, setDocTitle] = useState("");
  const [docType, setDocType] = useState("COMPTE_RENDU_CONSULTATION"); // Valeurs de l'enum TypeDocument
  const [uploading, setUploading] = useState(false);
  const [globalMsg, setGlobalMsg] = useState({ type: '', text: '' });

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

  // Fonction pour charger les documents
  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      // Construire des filtres stricts côté back: préférer patient.id
      const statusFilter = filters.statut?.[0];
      const params = {
        page: filters.page,
        limit: filters.limit || PAGE_SIZE,
        q: query || undefined,
        status: statusFilter || undefined,
        "order[uploadedAt]": "desc",
      };
      if (filters.patientId) {
        if (typeof filters.patientId === 'string' && filters.patientId.includes('/api/patients/')) {
          params.patient = filters.patientId; // IRI accepté
          const idOnly = filters.patientId.split('/').pop();
          if (idOnly) params["patient.id"] = idOnly; // filtre explicite si activé côté back
        } else {
          params["patient.id"] = filters.patientId; // UUID/ID brut
        }
      }
      // Ne pas filtrer côté front: le serveur filtre déjà par rôle (stagiaire ou formateur)
      const data = await documentService.getDocuments(params);
      const documents = Array.isArray(data) ? data : [];
      
      // Enrichissement: résoudre IRIs pour patient et uploadedBy
      if (documents.length > 0) {
        const needPatientLookup = documents.some(doc => typeof doc?.patient === 'string');
        // Si uploadedBy est un IRI string, tenter un enrichissement via détail du document
        const needDetailLookup = documents.some(doc => typeof doc?.uploadedBy === 'string' && !doc?.uploaded_by);

        let patientsMap = null;
        if (needPatientLookup) {
          try {
            const patientsData = await patientService.getAllPatients();
            patientsMap = new Map();
            patientsData.forEach(patient => {
              patientsMap.set(`/api/patients/${patient.id}`, patient);
            });
          } catch {}
        }

        let enrichedDocuments = documents.map(doc => {
          const withPatient = needPatientLookup && patientsMap && typeof doc?.patient === 'string'
            ? { ...doc, patient: patientsMap.get(doc.patient) || doc.patient }
            : doc;
          return withPatient;
        });

        if (needDetailLookup) {
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
      console.error("Erreur lors du chargement des documents:", e);
      setErr(e);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [query, filters.patientId, filters.page, filters.search, filters.type, filters.statut, filters.dateDebut, filters.dateFin, filters.limit, currentUser?.id]);

  // Charger documents
  // Ne pas inclure loadDocuments dans les dépendances pour éviter les boucles
  // loadDocuments est déjà mémorisé avec useCallback et ses dépendances sont explicites
  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filters.patientId, filters.page, filters.search, filters.type, filters.statut, filters.dateDebut, filters.dateFin, filters.limit, currentUser?.id]);

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
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (docTitle) fd.append("title", docTitle);
      if (docType) fd.append("type", docType);
      if (filters.patientId) {
        // adapte selon ton backend: id brut ou IRI '/api/patients/<id>'
        fd.append("patient", filters.patientId);
      }
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
    <div className="space-y-6 bg-green-100 min-h-screen p-6">
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
        <div className="bg-green-200 rounded-lg shadow p-6 max-w-xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center shadow-sm">
              <span className="material-symbols-rounded text-green-600 text-2xl">description</span>
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
        <div className="bg-white/80 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center shadow-sm">
              <span className="material-symbols-rounded text-green-600 text-2xl">description</span>
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Total (filtre)</h3>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/80 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center shadow-sm">
              <span className="material-symbols-rounded text-green-600 text-2xl">check_circle</span>
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Actifs</h3>
              <p className="text-2xl font-bold text-gray-900">{stats.actifs}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/80 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center shadow-sm">
              <span className="material-symbols-rounded text-red-600 text-2xl">inventory_2</span>
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Archivés</h3>
              <p className="text-2xl font-bold text-gray-900">{stats.archives}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/80 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center shadow-sm">
              <span className="material-symbols-rounded text-blue-600 text-2xl">today</span>
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Aujourd'hui</h3>
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
            <label className="block text-sm font-medium text-green-700 mb-2">Titre du document</label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-400"
              placeholder="Ex: Compte rendu consultation"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
            />
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
            <label className="block text-sm font-medium text-green-700 mb-2">Patient associé</label>
            <select
              className="w-full px-4 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-400"
              value={filters.patientId || ''}
              onChange={(e) => setFilters(f => ({ ...f, patientId: e.target.value || undefined }))}
            >
              <option value="">— Sélectionner un patient —</option>
              {patients.map((p) => (
                <option key={p.id ?? p["@id"]} value={p.id ?? p["@id"]}>
                  {`${p.nom?.toUpperCase?.() ?? ""} ${p.prenom ?? ""}`.trim()}
                </option>
              ))}
            </select>
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
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
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
      <div className="bg-white rounded-lg shadow border border-green-200">
        <div className="p-6 border-b-2 border-green-200 bg-green-50 rounded-t-lg">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h3 className="text-lg font-semibold text-green-800 flex items-center gap-2">
              <span className="material-symbols-rounded text-green-700">folder_open</span>
              Liste des documents {loading ? "— chargement…" : ""}
            </h3>
            <div className="flex items-center gap-4 flex-wrap justify-end">
              {/* Filtres rapides déplacés ici */}
              <div className="flex items-center gap-2">
                {quickFilters.map((filter, index) => (
                  <button
                    key={index}
                    onClick={filter.action}
                    className={`px-3 py-1 rounded-full text-xs transition-colors ${
                      (filter.label === 'Aujourd' + "'" + 'hui' && filters.dateDebut && filters.dateFin && filters.dateDebut === filters.dateFin && filters.dateDebut === new Date().toISOString().split('T')[0]) ||
                      (filter.label === 'Ordonnances' && filters.type?.includes('ORDONNANCE')) ||
                      (filter.label === 'Analyses' && filters.type?.includes('ANALYSE')) ||
                      (filter.label === 'Radiographies' && filters.type?.includes('RADIOGRAPHIE')) ||
                      (filter.label === 'Tous' && !filters.type?.length && !filters.statut?.length && !filters.patientId && !filters.dateDebut && !filters.dateFin)
                        ? 'bg-green-100 text-green-800 border border-green-300' 
                        : 'bg-white text-green-700 hover:bg-green-50 border border-green-300'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            <div className="flex items-center gap-2 bg-green-100 px-3 py-1 rounded-full">
              <span className="material-symbols-rounded text-green-600 text-base">description</span>
                <span className="text-sm text-green-700 font-medium">
                  {items.length} document{items.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  disabled={!canPrev}
                  onClick={() => canPrev && setFilters(f => ({ ...f, page: f.page - 1 }))}
                  className={`px-3 py-1 rounded-lg border transition-colors ${
                    canPrev 
                      ? "bg-white hover:bg-green-50 border-green-300 text-green-700" 
                      : "bg-gray-100 text-gray-400 border-gray-200"
                  }`}
                  title="Page précédente"
                >
                  <span className="material-symbols-rounded text-green-700 text-base">chevron_left</span>
                </button>
                <span className="text-sm text-green-700 px-3 py-1 bg-white rounded-lg border border-green-300">
                  {filters.page}/{pages}
                </span>
                <button
                  disabled={!canNext}
                  onClick={() => canNext && setFilters(f => ({ ...f, page: f.page + 1 }))}
                  className={`px-3 py-1 rounded-lg border transition-colors ${
                    canNext 
                      ? "bg-white hover:bg-green-50 border-green-300 text-green-700" 
                      : "bg-gray-100 text-gray-400 border-gray-200"
                  }`}
                  title="Page suivante"
                >
                  <span className="material-symbols-rounded text-green-700 text-base">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </div>


        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-green-100">
              <tr>
                <th className="px-6 py-4 text-center text-xs font-semibold text-green-700 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-2">
                    <span className="material-symbols-rounded text-green-700 text-base">description</span>
                    Titre
                  </div>
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-green-700 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-2">
                    <span className="material-symbols-rounded text-green-700 text-base">person</span>
                    Patient
                  </div>
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-green-700 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-2">
                    <span className="material-symbols-rounded text-green-700 text-base">label</span>
                    Type
                  </div>
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-green-700 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-2">
                    <span className="material-symbols-rounded text-green-700 text-base">schedule</span>
                    Créé le
                  </div>
                </th>
                { (userService.isFormateur && userService.isFormateur()) && (
                  <th className="px-6 py-4 text-center text-xs font-semibold text-green-700 uppercase tracking-wider">
                    <div className="flex items-center justify-center gap-2">
                      <span className="material-symbols-rounded text-green-700 text-base">badge</span>
                      Créé par
                    </div>
                  </th>
                )}
                <th className="px-6 py-4 text-center text-xs font-semibold text-green-700 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-2">
                    <span className="material-symbols-rounded text-green-700 text-base">task_alt</span>
                    Statut
                  </div>
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-green-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-green-200">
              {items.length === 0 && !loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
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
                    } else if (p.prenom || p.firstName) {
                      const prenom = p.prenom || p.firstName || '';
                      const nom = p.nom || p.lastName || '';
                      patientName = `${prenom} ${nom}`.trim();
                    } else if (p.nom || p.lastName) {
                      patientName = p.nom || p.lastName || '';
                    } else {
                      patientName = "Patient sans nom";
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
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{title}</div>
                            <div className="text-xs text-gray-500">
                              {fileName} • {fmtFileSize(fileSize)} • {mimeType}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <span className="text-xs font-semibold text-green-600">
                              {patientName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </span>
                          </div>
                          <span className="text-sm text-gray-700">{patientName || "—"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {d.type || 'Type inconnu'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div>{fmtDate(d.uploadedAt || d.uploaded_at)}</div>
                      </td>
                      {(userService.isFormateur && userService.isFormateur()) && (
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {uploadedByName || '—'}
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${badge}`}>
                          {st === "active" ? "Actif" : st === "archived" ? "Archivé" : st}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            className="p-2 text-green-600 hover:text-green-800 hover:bg-green-100 rounded-lg transition-colors"
                            onClick={() => download(d.id ?? d["@id"], title)}
                            title="Télécharger"
                          >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </button>
                          {st === "active" ? (
                            <button
                              className="p-2 text-orange-600 hover:text-orange-800 hover:bg-orange-100 rounded-lg transition-colors"
                              onClick={() => archiveDocument(d.id ?? d["@id"])}
                              title="Archiver"
                            >
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8l4 4-4 4m6-8l4 4-4 4" />
                              </svg>
                            </button>
                          ) : (
                            <button
                              className="p-2 text-green-600 hover:text-green-800 hover:bg-green-100 rounded-lg transition-colors"
                              onClick={() => restoreDocument(d.id ?? d["@id"])}
                              title="Restaurer"
                            >
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            </button>
                          )}
                          <button
                            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-lg transition-colors"
                            onClick={() => remove(d.id ?? d["@id"])}
                            title="Supprimer"
                          >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      </div>
    </div>
  );
};

export default Documents;
