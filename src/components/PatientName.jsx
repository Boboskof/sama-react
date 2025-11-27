import React from 'react';

/**
 * Composant réutilisable pour afficher le nom d'un patient de manière standardisée
 * 
 * Format d'affichage : [Genre] Prénom Nom (nom en gras)
 * 
 * @param {Object} props
 * @param {Object} props.patient - Objet patient avec nom, prenom, genre, nomComplet
 * @param {boolean} props.showGenre - Afficher le genre (Mr/Mme) - défaut: true
 * @param {boolean} props.boldName - Mettre le nom en gras - défaut: true
 * @param {string} props.className - Classes CSS additionnelles
 */
const PatientName = ({ 
  patient, 
  showGenre = true, 
  boldName = true,
  className = '' 
}) => {
  if (!patient || typeof patient !== 'object') {
    return <span className={className}>—</span>;
  }

  // Fonction pour formater le genre
  const formatGenre = (patient) => {
    if (!showGenre) return null;
    const raw = patient.genre || patient.gender || patient.civilite || '';
    const val = String(raw).trim();
    if (!val) return null;
    const lower = val.toLowerCase();
    if (val === 'Mr' || val === 'M' || lower === 'homme' || lower === 'm.') return 'Mr';
    if (val === 'Mme' || val === 'F' || lower === 'femme' || lower === 'mme.' || lower === 'madame') return 'Mme';
    return val;
  };

  const genre = formatGenre(patient);

  // Récupérer prénom et nom (soit directement, soit depuis nomComplet)
  let prenom = patient.prenom || patient.firstName || '';
  let nom = patient.nom || patient.lastName || '';

  // Si nomComplet est disponible mais pas nom/prenom séparément, essayer de le parser
  // Format attendu : "nom prénom" (nom en premier)
  if (patient.nomComplet && (!prenom || !nom)) {
    const parts = patient.nomComplet.trim().split(/\s+/);
    if (parts.length >= 2) {
      // Premier mot = nom, le reste = prénom
      nom = parts[0];
      prenom = parts.slice(1).join(' ');
    } else if (parts.length === 1) {
      // Un seul mot, considérer comme nom
      nom = parts[0];
      prenom = '';
    }
  }

  if (!prenom && !nom) {
    return <span className={className}>—</span>;
  }

  return (
    <span className={className}>
      {genre && <><span className="font-bold">{genre}</span>{' '}</>}
      {nom && <span className={boldName ? 'font-bold' : ''}>{nom}</span>}
      {nom && prenom && ' '}
      {prenom && <span>{prenom}</span>}
    </span>
  );
};

export default PatientName;

