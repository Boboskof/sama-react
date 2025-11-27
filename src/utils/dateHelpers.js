/**
 * Helpers pour le formatage des dates et heures
 */

/**
 * Formate une date au format français (JJ/MM/AAAA)
 * @param {string|Date} date - Date à formater (ISO string ou Date object)
 * @returns {string} Date formatée (ex: "17/11/2025")
 */
export function formatDate(date) {
  if (!date) return '—';
  
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '—';
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (error) {
    return '—';
  }
}

/**
 * Formate une heure au format français (HH:MM)
 * @param {string|Date} date - Date/heure à formater
 * @returns {string} Heure formatée (ex: "14:30")
 */
export function formatTime(date) {
  if (!date) return '—';
  
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '—';
    
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    
    return `${hours}:${minutes}`;
  } catch (error) {
    return '—';
  }
}

/**
 * Formate une date et heure au format français (JJ/MM/AAAA HH:MM)
 * @param {string|Date} date - Date/heure à formater
 * @returns {string} Date et heure formatées (ex: "17/11/2025 14:30")
 */
export function formatDateTime(date) {
  if (!date) return '—';
  
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '—';
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch (error) {
    return '—';
  }
}

/**
 * Formate une taille de fichier en format lisible (Ko, Mo, Go)
 * @param {number} bytes - Taille en octets
 * @returns {string} Taille formatée (ex: "1.5 Mo")
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 o';
  
  const k = 1024;
  const sizes = ['o', 'Ko', 'Mo', 'Go', 'To'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}





