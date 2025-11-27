import React, { useState, useMemo, useRef, useEffect } from 'react';
import { getPatientNameString, getPatientStatusInfo, getPatientStatusMeta, getPatientId } from '../utils/patientHelpers';

/**
 * Composant de recherche intelligente de patient
 * 
 * @param {Object} props
 * @param {Array} props.patients - Liste des patients disponibles
 * @param {string|number} props.value - ID du patient sélectionné
 * @param {Function} props.onChange - Callback appelé avec l'ID du patient sélectionné
 * @param {string} props.placeholder - Texte du placeholder
 * @param {string} props.className - Classes CSS additionnelles
 * @param {boolean} props.required - Si le champ est requis
 * @param {boolean} props.allowDeceased - Si on permet la sélection de patients décédés
 * @param {string} props.label - Label du champ
 * @param {string} props.labelClassName - Classes CSS pour le label
 * @param {string} props.inputClassName - Classes CSS pour l'input
 */
const PatientSearchInput = ({
  patients = [],
  value = '',
  onChange,
  placeholder = "Rechercher un patient (nom, prénom, email, téléphone...)",
  className = '',
  required = false,
  allowDeceased = false,
  label = 'Patient',
  labelClassName = '',
  inputClassName = ''
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Normaliser la recherche (ignore accents, casse, espaces)
  const normalizeSearch = (str) => {
    if (!str) return '';
    return str
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  };

  // Fonction de recherche intelligente
  const searchPatients = (query, patientList) => {
    if (!query || query.trim() === '') return patientList.slice(0, 50);
    
    const normalizedQuery = normalizeSearch(query);
    const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0);
    
    return patientList.filter(p => {
      const id = getPatientId(p);
      if (!id) return false;
      
      const prenom = normalizeSearch(p.prenom || p.firstName || '');
      const nom = normalizeSearch(p.nom || p.lastName || '');
      const email = normalizeSearch(p.email || '');
      const telephone = normalizeSearch(p.telephone || p.phone || '');
      const numeroSecu = normalizeSearch(p.numeroSecu || p.numeroSecuriteSociale || '');
      const fullName = `${prenom} ${nom}`.trim();
      
      return queryWords.every(word => 
        prenom.includes(word) ||
        nom.includes(word) ||
        fullName.includes(word) ||
        email.includes(word) ||
        telephone.includes(word) ||
        numeroSecu.includes(word) ||
        id.includes(word)
      );
    }).slice(0, 20);
  };

  // Patients filtrés selon la recherche
  const filteredPatients = useMemo(() => {
    return searchPatients(searchQuery, patients);
  }, [searchQuery, patients]);

  // Synchroniser avec la valeur externe (value prop)
  useEffect(() => {
    if (value) {
      const patient = patients.find(p => {
        const id = getPatientId(p);
        return String(id) === String(value);
      });
      if (patient) {
        setSelectedPatient(patient);
        setSearchQuery(getPatientNameString(patient, false) || patient.email || `Patient ${getPatientId(patient)}`);
      } else {
        setSelectedPatient(null);
        setSearchQuery('');
      }
    } else {
      setSelectedPatient(null);
      setSearchQuery('');
    }
  }, [value, patients]);

  // Gérer la sélection d'un patient
  const handleSelectPatient = (patient) => {
    const id = getPatientId(patient);
    if (!id) return;
    
    const info = getPatientStatusInfo(patient);
    if (info.isDeceased && !allowDeceased) {
      return; // Ne pas sélectionner les patients décédés si non autorisé
    }
    
    setSelectedPatient(patient);
    const displayName = getPatientNameString(patient, false) || patient.email || `Patient ${id}`;
    setSearchQuery(displayName);
    setShowResults(false);
    
    if (onChange) {
      onChange(id);
    }
  };

  // Gérer le changement de texte dans l'input
  const handleInputChange = (e) => {
    const newQuery = e.target.value;
    setSearchQuery(newQuery);
    setShowResults(true);
    
    if (!newQuery) {
      setSelectedPatient(null);
      if (onChange) {
        onChange('');
      }
    }
  };

  // Gérer le focus
  const handleFocus = () => {
    if (searchQuery) {
      setShowResults(true);
    }
  };

  // Gérer le clic en dehors pour fermer la liste
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Gérer les touches clavier
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setShowResults(false);
      inputRef.current?.blur();
    }
  };

  // Effacer la sélection
  const handleClear = () => {
    setSearchQuery('');
    setSelectedPatient(null);
    setShowResults(false);
    if (onChange) {
      onChange('');
    }
    inputRef.current?.focus();
  };

  // Classes par défaut pour le label et l'input
  const defaultLabelClasses = "block text-sm font-medium text-gray-700 mb-1";
  const defaultInputClasses = "w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400 bg-white";
  
  // Fusionner les classes personnalisées avec les classes par défaut
  const finalLabelClasses = labelClassName || defaultLabelClasses;
  const finalInputClasses = inputClassName || defaultInputClasses;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className={finalLabelClasses}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          className={finalInputClasses}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            title="Effacer"
          >
            <span className="material-symbols-rounded text-xl">close</span>
          </button>
        )}
      </div>
      
      {showResults && filteredPatients.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filteredPatients.map(patient => {
            const id = getPatientId(patient);
            if (!id) return null;
            
            const info = getPatientStatusInfo(patient);
            const statutMeta = getPatientStatusMeta(patient.statut || patient.status, patient.statutLabel || patient.statut_label);
            const name = getPatientNameString(patient, false) || patient.email || `Patient ${id}`;
            const isDisabled = info.isDeceased && !allowDeceased;
            
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleSelectPatient(patient)}
                disabled={isDisabled}
                className={`w-full text-left px-4 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors ${
                  isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                } ${selectedPatient && getPatientId(selectedPatient) === id ? 'bg-blue-100' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 truncate">{name}</span>
                      {statutMeta && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statutMeta.badgeClass}`}>
                          {statutMeta.icon && <span className="mr-1">{statutMeta.icon}</span>}
                          {statutMeta.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      {patient.email && (
                        <span className="truncate">{patient.email}</span>
                      )}
                      {(patient.telephone || patient.phone) && (
                        <span className="whitespace-nowrap">{patient.telephone || patient.phone}</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
      
      {showResults && searchQuery && filteredPatients.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-center text-gray-500">
          Aucun patient trouvé
        </div>
      )}
    </div>
  );
};

export default PatientSearchInput;

