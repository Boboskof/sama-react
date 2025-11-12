// src/_services/patient.service.ts
import Axios from "./caller.service";
import type { AxiosResponse } from "axios";
import type { Patient, ApiResponse } from "../types/api";
import { unwrapList, safeGetList, safeGetObject, enc, mergePatchHeaders } from './service.utils';
import { buildPatientParams, UIPatientFilters } from "./query/patients.query";

// Types pour le payload de création de patient
type NewPatient = {
  prenom: string;
  nom: string;
  email?: string;
  telephone?: string;        // "0621752198"
  dateNaissance?: string;    // "YYYY-MM-DD"
  genre?: string;
  adresseL1?: string;
  adresseL2?: string;
  ville?: string;
  codePostal?: string;
  numeroSecu?: string;
  organismeSecu?: string;
  notes?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  // ❌ PAS de champs mutuelle ici - séparés dans les couvertures
  // createdById?: string;    // ← seulement si requis par l'API
};

// Types pour la création de couverture
type NewCouverture = {
  patient: string;           // IRI du patient
  mutuelle: string;          // IRI de la mutuelle
  numeroAdherent: string;
  dateDebut?: string;        // "YYYY-MM-DD"
  dateFin?: string;          // "YYYY-MM-DD"
  valide?: boolean;
};

// Fonction utilitaire pour créer un IRI
const iri = (col: string, id?: string | number) => id != null ? `/api/${col}/${id}` : undefined;

// Fonction utilitaire pour supprimer les champs vides
const stripEmpty = <T extends object>(obj: T): Partial<T> =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v != null)) as Partial<T>;

// Résoudre l'IRI d'une mutuelle par nom
async function getMutuelleIriByName(name: string): Promise<string> {
  try {
    // Utiliser l'API Platform pour chercher la mutuelle
    const { data } = await Axios.get('/mutuelles', { 
      params: { nom: name, limit: 1 } 
    });
    
    const item = data['hydra:member']?.[0];
    if (!item?.['@id']) {
      throw new Error(`Mutuelle "${name}" introuvable`);
    }
    
    if (import.meta.env.DEV) {
    }
    return item['@id'];
  } catch (error) {
    console.error(`❌ Erreur lors de la recherche de la mutuelle "${name}":`, error);
    throw error;
  }
}

// Normaliser le numéro de téléphone pour le backend
function normalizePhone(phone: string): string {
  if (!phone) return phone;
  
  // Supprimer tous les espaces, tirets, parenthèses et points
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  
  // Si commence par +33, remplacer par 0
  if (cleaned.startsWith('+33')) {
    cleaned = '0' + cleaned.substring(3);
  }
  
  // Si commence par 33, remplacer par 0
  if (cleaned.startsWith('33') && cleaned.length === 12) {
    cleaned = '0' + cleaned.substring(2);
  }
  
  // Log de debug supprimé pour la production
  return cleaned;
}

// Utilitaire pour dérouler les réponses patients (support tous formats)
function unwrapPatients(d: any): Patient[] {
  if (Array.isArray(d?.data)) return d.data;
  if (Array.isArray(d?.['hydra:member'])) return d['hydra:member'];
  if (Array.isArray(d?.member)) return d.member;
  if (Array.isArray(d)) return d;
  return [];
}


const patientService = {
  // ----- Collection & Item (REST) -----
  /** ex: filters = { search: "john", dateDebut: "2024-01-01" } */
  getAllPatients(filters: UIPatientFilters = {}, onlyMine = false): Promise<Patient[]> {
    const params = buildPatientParams(filters);
    
    // Si onlyMine, essayer d'ajouter un filtre backend
    if (onlyMine) {
      const userData = localStorage.getItem('user');
      if (!userData) throw new Error('Utilisateur non connecté');
      const me = JSON.parse(userData);
      const userIri = me['@id'] || `/api/users/${me.id}`;
      params.append('createdBy', userIri);
    }
    
    return Axios.get(`/patients?${params.toString()}`)
      .then(response => {
        if (import.meta.env.DEV) {
          // Patients récupérés avec succès
        }
        
        // API Platform retourne les données dans member ou hydra:member
        const all = response.data?.member || response.data?.['hydra:member'] || response.data?.data;
        
        if (import.meta.env.DEV) {
        }
        
        if (!onlyMine) {
          if (import.meta.env.DEV) {
          }
          return all;
        }
        
        // Filtrer côté frontend si demandé
        const userData = localStorage.getItem('user');
      if (!userData) throw new Error('Utilisateur non connecté');
      const me = JSON.parse(userData);
        const uid = me.id;
        const userIri = me['@id'] || `/api/users/${me.id}`;
        
        const filteredPatients = all.filter((p: Patient) => {
          const createdBy = p?.createdBy;
          const createdById = typeof createdBy === 'object' ? createdBy?.id : createdBy;
          const createdByIri = typeof createdBy === 'string' ? createdBy : createdBy?.['@id'];
          
          return String(createdById) === String(uid) || 
                 String(createdByIri) === String(userIri) ||
                 String(createdBy) === String(userIri);
        });
        
        if (import.meta.env.DEV) {
        }
        return filteredPatients;
      })
      .catch(error => {
        console.error('❌ Erreur lors de la récupération des patients:', error);
        return [];
      });
  },

  // ----- Formateur: patients créés par des stagiaires -----
  async getFormateurPatients(page: number = 1, perPage: number = 25): Promise<Patient[]> {
    try {
      const res = await Axios.get('/formateur/patients', { params: { page, per_page: perPage } });
      return unwrapPatients(res.data);
    } catch (error) {
      console.error('❌ Erreur récupération patients formateur:', error);
      return [];
    }
  },

  async getOnePatient(id: string | number): Promise<Patient> {
    // Essai principal: item standard API Platform
    try {
      const r = await Axios.get(`/patients/${enc(id)}`, { validateStatus: () => true });
      if (r.status && r.status < 300 && r.data) {
        return r.data as Patient;
      }
      // Si 404 NotExposedAction ou route non exposée, fallback
      if (r.status === 404) {
        const r2 = await Axios.get(`/patients/show/${enc(id)}`, { validateStatus: () => true });
        if (r2.status && r2.status < 300 && r2.data) {
          const d: any = r2.data;
          // Supporte plusieurs enveloppes possibles
          const fromData = d?.patient ?? d?.data ?? d;
          if (fromData && typeof fromData === 'object' && !Array.isArray(fromData)) {
            return fromData as Patient;
          }
        }
      }
      throw new Error(`Patient ${id} introuvable (status ${r.status})`);
    } catch (e) {
      // Fallbacks via collection API
      try {
        // 1) Essayer filtres possibles: id, id[], search
        const tryOnce = async (params: Record<string, any>) => {
          const res = await Axios.get('/patients', { params, validateStatus: () => true });
          if (res.status && res.status < 300) {
            const d = res.data as any;
            const arr = (d?.['hydra:member'] ?? d?.member ?? d?.data ?? (Array.isArray(d) ? d : [])) as any[];
            if (Array.isArray(arr)) {
              const match = arr.find((p: any) => String(p?.id) === String(id) || String(p?.['@id'] || '').endsWith(`/${id}`));
              if (match) return match as Patient;
            }
          }
          return null;
        };

        const direct = await tryOnce({ id: id, itemsPerPage: 1 });
        if (direct) return direct as Patient;
        const directArr = await tryOnce({ 'id[]': id, itemsPerPage: 1 });
        if (directArr) return directArr as Patient;
        const bySearch = await tryOnce({ search: id, itemsPerPage: 30 });
        if (bySearch) return bySearch as Patient;

        // 2) Parcourir quelques pages si nécessaire (borné)
        const count = await this.countAllPatients();
        const perPage = 30;
        const maxPages = Math.min(10, Math.ceil((count || 0) / perPage) || 1);
        for (let page = 1; page <= maxPages; page++) {
          const list = await this.getPatientsPage(page, perPage);
          const found = Array.isArray(list) ? list.find((p: any) => String(p?.id) === String(id) || String(p?.['@id'] || '').endsWith(`/${id}`)) : undefined;
          if (found) return found as Patient;
        }
      } catch {}
      throw e;
    }
  },

  // Alternative: récupérer le patient depuis la liste complète
  async getOnePatientFromList(id: string | number): Promise<Patient> {
    try {
      const patients = await this.getAllPatients();
      const patient = patients.find(p => p.id === id || (p as any)['@id']?.includes(id));
      if (!patient) {
        throw new Error('Patient non trouvé');
      }
      return patient;
    } catch (error) {
      console.error('Erreur récupération patient depuis liste:', error);
      throw error;
    }
  },

  // Debug optionnel : récupérer un patient après création pour comparaison
  async getPatientAfterCreation(id: string | number): Promise<Patient> {
    const patient = await this.getOnePatient(id);
    return patient;
  },

  // ----- Couvertures mutuelles -----
  /** Créer une couverture mutuelle pour un patient */
  async createCouverture(couvertureData: NewCouverture): Promise<any> {
    const payload = stripEmpty({
      patient: couvertureData.patient,
      mutuelle: couvertureData.mutuelle,
      numeroAdherent: couvertureData.numeroAdherent,
      dateDebut: couvertureData.dateDebut,
      dateFin: couvertureData.dateFin,
      valide: couvertureData.valide,
    });

    // Log de debug supprimé pour la production

    try {
      const res = await Axios.post('/couvertures', payload, {
        headers: {
          'Content-Type': 'application/ld+json',
          Accept: 'application/ld+json, application/json',
        },
      });
      return res.data;
    } catch (error: any) {
      // Debug détaillé pour les erreurs de couverture
      if (error?.response?.status === 400) {
        const d = error.response?.data;
        const violations = d?.violations;
        if (Array.isArray(violations)) {
          const fieldErrors = Object.fromEntries(
            violations.map(v => [v.propertyPath, v.message])
          );
        }
      }
      console.error('❌ Erreur création couverture:', error);
      throw error;
    }
  },

  /** Mettre à jour une couverture existante */
  async updateCouverture(
    couvertureId: string | number,
    data: Partial<NewCouverture & { numeroAdherent?: string; dateDebut?: string; dateFin?: string; valide?: boolean }>
  ): Promise<any> {
    // Normalisation dates → YYYY-MM-DD
    const normalizeYmd = (v?: string): string | undefined => {
      if (!v) return undefined;
      // Accept already-correct format
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
      // Try to parse and convert
      const d = new Date(v);
      if (isNaN(d.getTime())) return undefined;
      return d.toISOString().slice(0, 10);
    };

    const payload = stripEmpty({
      patient: data.patient,
      mutuelle: data.mutuelle,
      numeroAdherent: data.numeroAdherent,
      dateDebut: normalizeYmd(data.dateDebut),
      dateFin: normalizeYmd(data.dateFin),
      valide: data.valide,
    });

    try {
      // Essayer PATCH (API Platform-friendly)
      const res = await Axios.patch(`/couvertures/${enc(couvertureId)}`, payload, mergePatchHeaders);
      return res.data;
    } catch (error: any) {
      // Fallback PUT si le backend n'accepte pas PATCH
      if (error?.response?.status === 405 || error?.response?.status === 415) {
        const resPut = await Axios.put(`/couvertures/${enc(couvertureId)}`, payload, {
          headers: {
            'Content-Type': 'application/ld+json',
            Accept: 'application/ld+json, application/json',
          },
        });
        return resPut.data;
      }
      const status = error?.response?.status;
      if (status === 400) {
        const d = error.response?.data;
        const violations = d?.violations;
        if (Array.isArray(violations)) {
          const fieldErrors = Object.fromEntries(
            violations.map((v: any) => [v.propertyPath, v.message])
          );
        }
      }
      if (status === 409) {
        const err = new Error('Cette mutuelle est déjà associée à ce patient.');
        (err as any).code = 'DUPLICATE_COUVERTURE';
        throw err;
      }
      // 401 est géré par l’interceptor (redirection /login)
      throw error;
    }
  },

  /** Récupérer les couvertures d'un patient avec détails des mutuelles */
  async getPatientCouvertures(patientId: string): Promise<any[]> {
    try {
      const res = await Axios.get('/couvertures', {
        params: { 'patient.id': patientId }
      });
      
      // API Platform retourne les données dans hydra:member
      const couvertures = res.data['hydra:member'] || res.data.member || res.data.data || [];
      
      // Si pas de couvertures, retourner directement
      if (couvertures.length === 0) {
        return [];
      }
      
      // Version simplifiée : retourner les couvertures sans enrichissement des mutuelles
      // L'enrichissement peut être fait côté frontend si nécessaire
      const couverturesEnrichies = couvertures.map((couverture: any) => ({
        ...couverture,
        mutuelle: couverture.mutuelle || { nom: 'Mutuelle inconnue' }
      }));
      
      
      // 🔧 FIX FINAL: Filtrage côté frontend pour garantir la sécurité
      const validCouvertures = couverturesEnrichies.filter((couverture: any) => {
        const patientRef = couverture.patient;
        let isPatientValid = false;
        
        // Vérifier différents formats de référence patient
        if (typeof patientRef === 'object' && patientRef !== null) {
          // Format: { id: "uuid", prenom: "...", nom: "..." }
          isPatientValid = patientRef.id === patientId;
        } else if (typeof patientRef === 'string') {
          // Format: "/api/patients/uuid"
          isPatientValid = patientRef === `/api/patients/${patientId}` || patientRef.includes(patientId);
        }
        
        if (!isPatientValid) {
          // Log seulement une fois par couverture invalide pour éviter les boucles
          if (!couverture._loggedError) {
            // Désactiver les logs d'erreur en mode production si le filtrage fonctionne
            if (import.meta.env.DEV) {
              console.error('❌ ERREUR: Couverture d\'un autre patient trouvée!', {
                expectedPatient: patientId,
                foundPatient: patientRef,
                couvertureId: couverture.id,
                couverture: couverture
              });
            }
            couverture._loggedError = true; // Marquer comme loggé
          }
        }
        
        return isPatientValid;
      });
      
      
      // 🚨 ALERTE: Si le backend ne filtre pas correctement
      if (couverturesEnrichies.length > validCouvertures.length) {
        
        // Option pour désactiver les logs d'erreur si le filtrage fonctionne
        if (validCouvertures.length > 0) {
          // Le filtrage fonctionne correctement
        }
      }
      
      return validCouvertures;
    } catch (error) {
      console.error('❌ Erreur récupération couvertures:', error);
      return [];
    }
  },


  // ----- Mes patients (backend-first) -----
  /** Récupère uniquement les patients créés par l'utilisateur connecté */
  async getMyPatients(): Promise<Patient[]> {
    const me = JSON.parse(localStorage.getItem('user') || '{}');
    const userIri = me['@id'] || `/api/users/${me.id}`; // support IRI ou id
    const res = await Axios.get('/patients', { params: { createdBy: userIri, itemsPerPage: 100 } });
    return unwrapPatients(res.data);
  },

  async createPatient(form: NewPatient): Promise<Patient> {
    // Normaliser le téléphone avant l'envoi
    const normalizedPhone = form.telephone ? normalizePhone(form.telephone) : undefined;

    const payload = stripEmpty({
      prenom: form.prenom,
      nom: form.nom,
      email: form.email,
      telephone: normalizedPhone,
      dateNaissance: form.dateNaissance,
      genre: form.genre,
      adresseL1: form.adresseL1,
      adresseL2: form.adresseL2,
      ville: form.ville,
      codePostal: form.codePostal,
      numeroSecu: form.numeroSecu,
      organismeSecu: form.organismeSecu,
      notes: form.notes,
      emergencyContact: form.emergencyContact,
      emergencyPhone: form.emergencyPhone,
      // ❌ PAS de champs mutuelle ici - séparés dans les couvertures
      // createdBy: iri('users', form.createdById),
    });

    

    try {
      
      
      const res = await Axios.post('/patients', payload, {
        headers: {
          'Content-Type': 'application/ld+json',
          Accept: 'application/ld+json, application/json',
        },
      });
      
      const createdPatient = res.data;
      
      // Micro-debug : Compare propriété par propriété
      
      
      // Si le 201 n'inclut pas le champ, le problème est côté dé-normalisation/processor/groups
      // Si le 201 l'inclut mais que /patients/show ne l'a plus, c'est un mapping de sortie différent
      
      return createdPatient;
    } catch (error: any) {
      // 🛡️ Mapping des erreurs vers le formulaire
      if (error?.response?.status === 400) {
        const d = error.response?.data;
        const violations = d?.violations;
        if (Array.isArray(violations)) {
          const fieldErrors = Object.fromEntries(
            violations.map(v => [v.propertyPath, v.message])
          );
          // ex: setErrors(fieldErrors);
        }
      }
      throw error;
    }
  },

  updatePatient(id: string | number, patientData: Partial<Patient>): Promise<Patient> {
    return Axios.put(`/patients/${enc(id)}`, patientData).then(r => r.data as Patient);
  },

  async patchPatient(id: string | number, partial: Partial<Patient>): Promise<Patient> {
    try {
      // Nettoyage simple: retirer undefined et chaînes vides (merge-patch plus robuste)
      const stripObj = (o: any): any => {
        if (!o || typeof o !== 'object') return o;
        const out: any = {};
        Object.entries(o).forEach(([k, v]) => {
          if (v === undefined || v === '') return;
          if (v && typeof v === 'object' && !Array.isArray(v)) {
            const sub = stripObj(v);
            if (sub && Object.keys(sub).length > 0) out[k] = sub;
            return;
          }
          if (Array.isArray(v)) {
            const arr = v.map(stripObj).filter(x => x != null && (typeof x !== 'object' || Object.keys(x).length > 0));
            if (arr.length > 0) out[k] = arr;
            return;
          }
          out[k] = v;
        });
        return out;
      };
      const payload = stripObj(partial);
      const res = await Axios.patch(`/patients/${enc(id)}`, payload, mergePatchHeaders);
      return res.data as Patient;
    } catch (error: any) {
      const status = error?.response?.status;
      const data = error?.response?.data;
      if (status === 400 && data) {
        const violations = data?.violations;
        if (Array.isArray(violations)) {
          const fieldErrors = Object.fromEntries(
            violations.map((v: any) => [v.propertyPath, v.message])
          );
        }
      }
      if (status === 405 || status === 415) {
        const resPut = await Axios.put(`/patients/${enc(id)}`, partial, {
          headers: {
            'Content-Type': 'application/ld+json',
            Accept: 'application/ld+json, application/json',
          },
        });
        return resPut.data as Patient;
      }
      throw error;
    }
  },

  deletePatient(id: string | number): Promise<any> {
    return Axios.delete(`/patients/${enc(id)}`).then(r => r.data);
  },

  // ----- Recherche & filtres -----
  /** Exemple: searchPatients({ q: 'dup', lastName: 'Dupond' }) */
  searchPatients(filters: Record<string, any> = {}): Promise<Patient[]> {
    // Récupérer l'utilisateur connecté pour filtrer par créateur
    const userData = localStorage.getItem('user');
    if (!userData) throw new Error('Utilisateur non connecté');
    const user = JSON.parse(userData);
    const userId = user.id;
    const queryParams = {
      ...filters,
      // Si l'utilisateur n'est pas admin, filtrer par créateur
      ...(userId && !user.roles?.includes('ROLE_ADMIN') && { createdBy: userId })
    } as Record<string, any>;
    
    return Axios.get("/patients", { params: queryParams })
      .then(response => {
        const d = response.data as any;
        const list = (d?.['hydra:member'] ?? d?.member ?? d?.data ?? (Array.isArray(d) ? d : [])) as any[];
        return Array.isArray(list) ? (list as any) : [];
      });
  },

  /** Back-compat si le back supporte encore ?q=... */
  searchByTerm(searchTerm: string): Promise<Patient[]> {
    return Axios.get("/patients", { params: { q: searchTerm, itemsPerPage: 30 } })
      .then(response => {
        const d = response.data as any;
        const list = (d?.['hydra:member'] ?? d?.member ?? d?.data ?? (Array.isArray(d) ? d : [])) as any[];
        return Array.isArray(list) ? (list as any) : [];
      });
  },

  // Pagination utilitaire (API Platform): page & itemsPerPage contrôlables côté front
  getPatientsPage(page: number = 1, limit: number = 25, extra: Record<string, any> = {}): Promise<Patient[]> {
    const params: Record<string, any> = { page, itemsPerPage: limit, ...extra };
    return Axios.get("/patients", { params })
      .then(response => {
        const d = response.data;
        const list = (d?.['hydra:member'] ?? d?.member ?? d?.data ?? (Array.isArray(d) ? d : [])) as any[];
        return Array.isArray(list) ? (list as any) : [];
      });
  },

  /** Nouvel endpoint: patients sans couverture (couverture=MANQUANTE) */
  getPatientsWithoutCoverage(page: number = 1, limit: number = 25, extra: Record<string, any> = {}): Promise<Patient[]> {
    return Axios.get("/patients", { params: { couverture: 'MANQUANTE', page, itemsPerPage: limit, ...extra } })
      .then(response => {
        const d = response.data as any;
        const list = (d?.['hydra:member'] ?? d?.member ?? d?.data ?? (Array.isArray(d) ? d : [])) as any[];
        return Array.isArray(list) ? (list as any) : [];
      });
  },

  /** Compte total des patients sans couverture (utilise total/hydra:totalItems si dispo) */
  async countPatientsWithoutCoverage(extra: Record<string, any> = {}): Promise<number> {
    const res = await Axios.get('/patients', { params: { couverture: 'MANQUANTE', page: 1, itemsPerPage: 1, ...extra } });
    const d = res.data as any;
    if (typeof d?.['hydra:totalItems'] === 'number') return d['hydra:totalItems'];
    if (typeof d?.['totalItems'] === 'number') return d['totalItems'];
    if (typeof d?.total === 'number') return d.total;
    if (Array.isArray(d?.data)) return d.data.length;
    if (Array.isArray(d)) return d.length;
    return 0;
  },

  /** Nouvel endpoint de stats couvertures */
  async getCoverageStatus(): Promise<{ total: number; valides: number; expirees: number; futures?: number; manquantes: number; }>{
    const res = await Axios.get('/status/couvertures');
    const d = (res.data?.data ?? res.data) as any;
    return {
      total: Number(d?.total ?? 0),
      valides: Number(d?.valides ?? 0),
      expirees: Number(d?.expirees ?? 0),
      futures: Number(d?.futures ?? 0),
      manquantes: Number(d?.manquantes ?? 0),
    };
  },

  /** Alertes couvertures: manquantes et expirées (auto-filtre par stagiaire côté back) */
  async getCoverageAlerts(): Promise<{ manquantes: any[]; expirees: any[] }>{
    const res = await Axios.get('/status/couvertures/alerts');
    const d = (res.data?.data ?? res.data) as any;
    return {
      manquantes: Array.isArray(d?.manquantes) ? d.manquantes : [],
      expirees: Array.isArray(d?.expirees) ? d.expirees : [],
    };
  },

  // Tri utilitaire (API Platform: order[field]=asc|desc)
  getPatientsOrdered(field: string = "lastName", dir: "asc" | "desc" = "asc", extra: Record<string, any> = {}): Promise<Patient[]> {
    return Axios.get("/patients", { params: { [`order[${field}]`]: dir, ...extra } })
      .then(response => {
        const d = response.data as any;
        const list = (d?.['hydra:member'] ?? d?.member ?? d?.data ?? (Array.isArray(d) ? d : [])) as any[];
        return Array.isArray(list) ? (list as any) : [];
      });
  },

  /** Compter tous les patients (prend en charge total/hydra:totalItems) */
  async countAllPatients(extra: Record<string, any> = {}): Promise<number> {
    const res = await Axios.get('/patients', { params: { page: 1, itemsPerPage: 1, ...extra } });
    const d = res.data as any;
    if (typeof d?.['hydra:totalItems'] === 'number') return d['hydra:totalItems'];
    if (typeof d?.['totalItems'] === 'number') return d['totalItems'];
    if (typeof d?.total === 'number') return d.total;
    if (Array.isArray(d?.data)) return d.data.length;
    if (Array.isArray(d)) return d.length;
    return 0;
  },

  /** Statut agrégé des patients par stagiaire */
  async getStagiairePatientsStatus(): Promise<{ me?: { user: any; total: number }; items?: Array<{ user: any; total: number }>; total_stagiaires?: number }>{
    const res = await Axios.get('/status/stagiaires/patients');
    const d = (res.data?.data ?? res.data) as any;
    return {
      me: d?.me ? { user: d.me.user, total: Number(d.me.total || 0) } : undefined,
      items: Array.isArray(d?.items) ? d.items.map((x: any) => ({ user: x.user, total: Number(x.total || 0) })) : undefined,
      total_stagiaires: typeof d?.total_stagiaires === 'number' ? d.total_stagiaires : undefined,
    };
  },

  // ----- Vérifications métier -----
  /**
   * Vérifie si un numéro de sécurité sociale (NIR) existe déjà.
   * excludeId permet d'ignorer un patient (cas édition).
   */
  async existsNumeroSecu(nir: string, excludeId?: string): Promise<boolean> {
    if (!nir) return false;
    try {
      // Recherche large côté back; on filtre côté front sur l'égalité exacte
      const candidates = await this.searchByTerm(nir);
      return candidates.some((p: any) => {
        const same = String(p?.numeroSecu || '') === String(nir);
        const sameId = excludeId && (String(p?.id) === String(excludeId) || String(p?.['@id'] || '').includes(excludeId));
        return same && !sameId;
      });
    } catch {
      return false;
    }
  },

  // ----- Mutuelles / assureurs -----
  getInsuranceCompanies(): Promise<string[]> {
    return Axios.get("/mutuelles-list")
      .then(response => {
        const data = response.data;
        // Gérer le format {data: [...], total: 30}
        if (data && Array.isArray(data.data)) {
          return data.data.map((mutuelle: any) => {
            return typeof mutuelle === 'string' ? mutuelle : mutuelle.name || mutuelle.nom || mutuelle;
          });
        }
        return [];
      })
      .catch(error => {
        console.error('❌ Erreur lors de la récupération des mutuelles:', error);
        // Fallback avec liste statique
        return [
          'Mutuelle Générale',
          'MGEN',
          'Harmonie Mutuelle', 
          'Mutuelle Familiale',
          'MACSF',
          'MNH',
          'Autre'
        ];
      });
  },

  // Variantes possibles si ton back expose d’autres chemins :
  // getInsuranceCompanies(): Promise<string[]> { return safeGetList<string>(Axios.get("/insurers")); }
  // getInsuranceCompanies(): Promise<string[]> { return safeGetList<string>(Axios.get("/mutuelles")); }
};

export default patientService;
