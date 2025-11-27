// Utilitaires centralisés pour les rendez-vous

/**
 * Extrait l'heure HH:mm d'une date (gère plusieurs formats)
 */
export const extractHHmm = (dateLike) => {
  if (!dateLike) return '';
  if (typeof dateLike === 'string') {
    const s = dateLike;
    // Format "YYYY-MM-DD HH:mm:ss"
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})\s(\d{2}):(\d{2})(?::\d{2})?$/);
    if (m) return `${m[4]}:${m[5]}`;
    // Format ISO: "YYYY-MM-DDTHH:mm:ss"(+tz)
    m = s.match(/T(\d{2}):(\d{2})(?::\d{2})?/);
    if (m) return `${m[1]}:${m[2]}`;
  }
  const d = new Date(dateLike);
  if (!isNaN(d.getTime())) {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  return '';
};

/**
 * Vérifie si deux dates sont le même jour
 */
export const sameDay = (a, b) => {
  if (!a || !b) return false;
  const date1 = a instanceof Date ? a : new Date(a);
  const date2 = b instanceof Date ? b : new Date(b);
  if (isNaN(date1.getTime()) || isNaN(date2.getTime())) return false;
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
};

/**
 * Calcule l'index du jour de la semaine (0 = lundi)
 */
export const dayIndexMondayFirst = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return (d.getDay() + 6) % 7;
};

/**
 * Obtient la durée d'un rendez-vous en minutes
 */
export const getAppointmentDuration = (appt) => {
  const direct = appt?.duree ?? appt?.duration ?? appt?.dureeMinutes ?? appt?.lengthMinutes;
  if (typeof direct === 'number' && !isNaN(direct)) return direct;
  if (typeof direct === 'string' && direct.trim() && !isNaN(parseInt(direct, 10))) {
    return parseInt(direct, 10);
  }
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
  return 30; // Durée par défaut
};

/**
 * Formate une plage horaire pour un rendez-vous
 */
export const formatAppointmentTimeRange = (appt) => {
  const startRaw = appt?.startAt || appt?.start_at || appt?.appointmentTime || appt?.startTime || appt?.dateTime;
  const startHHmm = extractHHmm(startRaw);
  if (!startHHmm) return '';
  
  const endRaw = appt?.endAt || appt?.end_at || appt?.endTime;
  let endHHmm = extractHHmm(endRaw);
  if (!endHHmm) {
    const dmin = getAppointmentDuration(appt);
    const [h, m] = startHHmm.split(':').map(n => parseInt(n, 10));
    const startTotal = h * 60 + m;
    const endTotal = startTotal + dmin;
    const endH = Math.floor(endTotal / 60);
    const endM = endTotal % 60;
    endHHmm = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
  }
  return `${startHHmm} à ${endHHmm}`;
};

/**
 * Obtient le nom du médecin depuis un rendez-vous
 */
export const getDoctorNameFromAppointment = (appt, medecinsById = {}) => {
  if (!appt) return '';
  
  // Métadonnées
  const metaName = appt?.payload?.metadata?.doctor_name || appt?.metadata?.doctor_name;
  if (metaName && String(metaName).trim()) return String(metaName).trim();
  
  // Chaînes directes
  const direct = appt?.medecinName || appt?.doctorName || appt?.medecin_nom_complet || appt?.praticien || '';
  if (direct && String(direct).trim()) return String(direct).trim();
  
  // IRI vers cache
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
  
  // Objets
  const m = (typeof medecinField === 'object' && medecinField) ? medecinField : {};
  const prenom = m.prenom || m.firstName || m.givenName || appt?.medecin_prenom || '';
  const nom = m.nom || m.lastName || m.familyName || appt?.medecin_nom || '';
  const composed = `${prenom || ''} ${nom || ''}`.trim();
  return composed || '';
};

/**
 * Obtient l'ID d'un patient depuis un objet patient
 */
export const getPatientId = (patientLike) => {
  if (!patientLike || typeof patientLike !== 'object') return undefined;
  if (patientLike.id !== undefined && patientLike.id !== null) return String(patientLike.id);
  if (typeof patientLike['@id'] === 'string') {
    const iri = patientLike['@id'];
    return iri.includes('/') ? iri.split('/').pop() : iri;
  }
  return undefined;
};

/**
 * Configuration des statuts de rendez-vous avec classes Tailwind
 */
export const APPOINTMENT_STATUS_CONFIG = {
  EN_ATTENTE: {
    label: 'En attente',
    box: 'bg-yellow-50 border-l-4 border-l-yellow-500',
    badge: 'bg-yellow-100 text-yellow-800',
    border: 'border-l-yellow-500',
    listBg: 'bg-yellow-50'
  },
  PLANIFIE: {
    label: 'Planifié',
    box: 'bg-blue-50 border-l-4 border-l-blue-500',
    badge: 'bg-blue-100 text-blue-800',
    border: 'border-l-blue-500',
    listBg: 'bg-blue-50'
  },
  CONFIRME: {
    label: 'Confirmé',
    box: 'bg-green-50 border-l-4 border-l-green-500',
    badge: 'bg-green-100 text-green-800',
    border: 'border-l-green-500',
    listBg: 'bg-green-50'
  },
  ANNULE: {
    label: 'Annulé',
    box: 'bg-red-50 border-l-4 border-l-red-500',
    badge: 'bg-red-100 text-red-800',
    border: 'border-l-red-500',
    listBg: 'bg-red-50'
  },
  ABSENT: {
    label: 'Absent',
    box: 'bg-red-100 border-l-4 border-l-red-600',
    badge: 'bg-red-600 text-white font-bold',
    border: 'border-l-red-600',
    listBg: 'bg-red-100'
  },
  TERMINE: {
    label: 'Terminé',
    box: 'bg-gray-50 border-l-4 border-l-gray-500',
    badge: 'bg-gray-100 text-gray-800',
    border: 'border-l-gray-500',
    listBg: 'bg-gray-50'
  }
};

/**
 * Obtient les classes pour un statut de rendez-vous
 */
export const getAppointmentStatusClasses = (statut) => {
  return APPOINTMENT_STATUS_CONFIG[statut] || APPOINTMENT_STATUS_CONFIG.PLANIFIE;
};

/**
 * Obtient le label d'un statut
 */
export const getAppointmentStatusLabel = (statut) => {
  return APPOINTMENT_STATUS_CONFIG[statut]?.label || statut || 'Inconnu';
};
