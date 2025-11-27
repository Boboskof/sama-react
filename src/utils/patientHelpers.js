/**
 * Helpers pour la gestion des patients
 */

/**
 * Formate le genre du patient (M., Mme, etc.)
 * @param {object} patient - Objet patient
 * @returns {string|null} Genre formaté ou null
 */
export function formatGenre(patient) {
  if (!patient || typeof patient !== 'object') return null;
  
  const raw = patient.genre || patient.gender || patient.civilite || '';
  const val = String(raw).trim();
  if (!val) return null;
  
  const lower = val.toLowerCase();
  if (val === 'Mr' || val === 'M' || lower === 'homme' || lower === 'm.') return 'Mr';
  if (val === 'Mme' || val === 'Mme.' || lower === 'femme' || lower === 'mme') return 'Mme';
  if (val === 'Mlle' || val === 'Mlle.' || lower === 'mademoiselle' || lower === 'mlle') return 'Mlle';
  
  return val; // Retourne la valeur originale si non reconnue
}

/**
 * Configuration des statuts de patients
 */
const PATIENT_STATUS_CONFIG = {
  ACTIF: {
    code: 'ACTIF',
    label: 'Actif',
    icon: '✓',
    badgeClass: 'bg-green-100 text-green-800',
    color: '#4caf50',
    isDeceased: false
  },
  INACTIF: {
    code: 'INACTIF',
    label: 'Inactif',
    icon: '⏸',
    badgeClass: 'bg-yellow-100 text-yellow-800',
    color: '#ff9800',
    isDeceased: false
  },
  DECEDE: {
    code: 'DECEDE',
    label: 'Décédé',
    icon: '✝',
    badgeClass: 'bg-gray-100 text-gray-800',
    color: '#9e9e9e',
    isDeceased: true
  }
};

/**
 * Obtient les métadonnées d'un statut de patient
 * @param {string} statut - Statut du patient (ACTIF, INACTIF, DECEDE)
 * @param {string} statutLabel - Label optionnel du statut
 * @returns {object|null} Métadonnées du statut ou null
 */
export function getPatientStatusMeta(statut, statutLabel = null) {
  if (!statut) return null;
  
  const statutUpper = String(statut).toUpperCase().trim();
  const config = PATIENT_STATUS_CONFIG[statutUpper];
  
  if (config) {
    return {
      ...config,
      label: statutLabel || config.label
    };
  }
  
  // Statut inconnu - retourne une configuration par défaut
  return {
    code: statutUpper,
    label: statutLabel || statutUpper,
    icon: '❓',
    badgeClass: 'bg-gray-100 text-gray-800',
    color: '#666666',
    isDeceased: false
  };
}

/**
 * Obtient les informations d'un statut de patient (version simplifiée)
 * @param {object} patient - Objet patient
 * @returns {object} Informations du statut avec isDeceased, label, icon
 */
export function getPatientStatusInfo(patient) {
  if (!patient || typeof patient !== 'object') {
    return {
      isDeceased: false,
      label: null,
      icon: null
    };
  }
  
  const statut = patient.statut || patient.status || null;
  if (!statut) {
    return {
      isDeceased: false,
      label: null,
      icon: null
    };
  }
  
  const statutUpper = String(statut).toUpperCase().trim();
  const config = PATIENT_STATUS_CONFIG[statutUpper];
  
  if (config) {
    return {
      isDeceased: config.isDeceased,
      label: config.label,
      icon: config.icon
    };
  }
  
  // Statut inconnu
  return {
    isDeceased: false,
    label: statutUpper,
    icon: '❓'
  };
}

/**
 * Obtient l'ID d'un patient (gère différents formats: id, @id, etc.)
 * @param {object} patient - Objet patient
 * @returns {string|number|null} ID du patient ou null
 */
export function getPatientId(patient) {
  if (!patient || typeof patient !== 'object') return null;
  
  // Essayer id en premier
  if (patient.id !== undefined && patient.id !== null) {
    return patient.id;
  }
  
  // Essayer @id (IRI API Platform)
  if (patient['@id']) {
    const iri = String(patient['@id']);
    if (iri.includes('/')) {
      return iri.split('/').pop();
    }
    return iri;
  }
  
  return null;
}

/**
 * Obtient le nom complet d'un patient au format "nom prénom" (pour strings, selects, etc.)
 * @param {object} patient - Objet patient
 * @param {boolean} includeGenre - Inclure le genre (Mr/Mme) - défaut: false
 * @returns {string} Nom complet formaté ou "Patient inconnu"
 */
export function getPatientNameString(patient, includeGenre = false) {
  if (!patient || typeof patient !== 'object') {
    return "Patient inconnu";
  }

  // Utiliser nomComplet si disponible (format: "nom prénom")
  if (patient.nomComplet) {
    const genre = includeGenre ? formatGenre(patient) : null;
    return genre ? `${genre} ${patient.nomComplet}` : patient.nomComplet;
  }

  // Construire à partir de nom et prenom (format: "nom prénom" - nom en premier)
  const nom = patient.nom || patient.lastName || '';
  const prenom = patient.prenom || patient.firstName || '';

  if (!nom && !prenom) {
    return "Patient inconnu";
  }

  // Format: "nom prénom" (nom en premier)
  const fullName = `${nom} ${prenom}`.trim();
  const genre = includeGenre ? formatGenre(patient) : null;
  
  return genre ? `${genre} ${fullName}` : fullName;
}

/**
 * Vérifie si un patient est mineur (moins de 18 ans)
 * @param {string} dateNaissance - Date de naissance au format "YYYY-MM-DD"
 * @returns {boolean} true si le patient est mineur
 */
export function isMineur(dateNaissance) {
  if (!dateNaissance) return false;
  
  const birthDate = new Date(dateNaissance);
  if (isNaN(birthDate.getTime())) return false;
  
  const today = new Date();
  const age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    return age - 1 < 18;
  }
  
  return age < 18;
}

/**
 * Valide le format d'un numéro de sécurité sociale français
 * Format attendu: 15 chiffres (1 85 12 75 123 456 78)
 * Le département (positions 3-4) doit être entre 01 et 95 (hors 20, 96-99)
 * @param {string|null} numeroSecu - Numéro de sécurité sociale
 * @returns {boolean} true si le numéro est valide
 */
export function isNumeroSecuValide(numeroSecu) {
  if (!numeroSecu) return false;
  
  // Nettoyer les espaces
  const cleaned = String(numeroSecu).replace(/\s/g, '');
  
  // Vérifier la longueur (15 chiffres)
  if (cleaned.length !== 15) return false;
  
  // Vérifier que ce sont uniquement des chiffres
  if (!/^\d+$/.test(cleaned)) return false;
  
  // Extraire le département (positions 3-4, index 2-3)
  const dept = parseInt(cleaned.substring(2, 4), 10);
  
  // Le département doit être entre 01 et 95, mais pas 20 (Corse a 2A et 2B)
  // et pas 96-99 (réservés)
  return dept >= 1 && dept <= 95 && dept !== 20;
}

