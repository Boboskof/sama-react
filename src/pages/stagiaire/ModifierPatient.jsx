import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import patientService from '../../_services/patient.service';
import { useMutuelles, useCreateMutuelle } from '../../hooks/useMutuelles';
import LoadingSpinner from '../../components/LoadingSpinner';

const ModifierPatient = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [loadingPatient, setLoadingPatient] = useState(true);
  const [originalNumeroSecu, setOriginalNumeroSecu] = useState('');

  // Mutuelles avec React Query
  const { data: mutuelles = [], isLoading: loadingInsurance, error: mutuellesError } = useMutuelles();
  const createMutuelleMutation = useCreateMutuelle();
  
  // Trier les mutuelles par ordre alphabétique
  const insuranceCompanies = useMemo(() => {
    return [...mutuelles].sort((a, b) => {
      const nameA = (a.nom || a.name || '').toLowerCase().trim();
      const nameB = (b.nom || b.name || '').toLowerCase().trim();
      return nameA.localeCompare(nameB, 'fr', { sensitivity: 'base' });
    });
  }, [mutuelles]);
  
  // États pour l'option "Autre" mutuelle
  const [showCustomMutuelle, setShowCustomMutuelle] = useState(false);
  const [customMutuelleName, setCustomMutuelleName] = useState('');
  const [loadError, setLoadError] = useState('');

  // Form
  const [formData, setFormData] = useState({
    prenom: '',
    nom: '',
    email: '',
    telephone: '',
    dateNaissance: '',
    genre: 'Mr',
    statut: 'ACTIF',
    adresseL1: '',
    adresseL2: '',
    ville: '',
    codePostal: '',
    // Informations de sécurité sociale
    numeroSecu: '',
    organismeSecu: '', // Résultat calculé à l'envoi
    caissePayante: '',
    caisseLieu: '',
    caisseAutreNom: '',
    // Notes médicales (sous-champs)
    notesAntecedents: '',
    notesAllergies: '',
    notesTraitements: '',
    notesAutres: '',
    // Champs de contact d'urgence
    contactUrgenceNom: '',
    contactUrgenceTelephone: '',
    // Champs de couverture mutuelle
    mutuelleId: '', // ID de la mutuelle sélectionnée
    numeroAdherent: '',
    dateDebutCouverture: '',
    dateFinCouverture: '',
    couvertureValide: true
  });

  // Gérer les erreurs de chargement des mutuelles
  useEffect(() => {
    if (mutuellesError) {
      setLoadError('Erreur lors du chargement des mutuelles');
    } else {
      setLoadError('');
    }
  }, [mutuellesError]);

  // Fonction pour parser organismeSecu et extraire caissePayante, caisseLieu, caisseAutreNom
  const parseOrganismeSecu = (organismeSecu) => {
    if (!organismeSecu || !organismeSecu.trim()) {
      return { caissePayante: '', caisseLieu: '', caisseAutreNom: '' };
    }

    const org = organismeSecu.trim();
    const ENUM_LABELS = { CPAM: 'CPAM', CGSS: 'CGSS', MSA: 'MSA', CNMSS: 'CNMSS', ENIM: 'ENIM', CANSSM: 'CANSSM', CPR_SNCF: 'CPR SNCF', RATP: 'RATP', CAMIEG: 'CAMIEG', AUTRE: 'Autre' };
    
    // Vérifier si c'est un format "LABEL de LIEU" (pour CPAM, CGSS, MSA)
    const needsLieu = ['CPAM', 'CGSS', 'MSA'];
    for (const [key, label] of Object.entries(ENUM_LABELS)) {
      if (needsLieu.includes(key)) {
        // Format: "CPAM de Paris" ou "CGSS de Guadeloupe"
        const pattern = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+de\\s+(.+)$`, 'i');
        const match = org.match(pattern);
        if (match) {
          return {
            caissePayante: key,
            caisseLieu: match[1].trim(),
            caisseAutreNom: ''
          };
        }
        // Format exact: "CPAM", "CGSS", "MSA" (comparaison insensible à la casse)
        if (org.toUpperCase() === label.toUpperCase()) {
          return {
            caissePayante: key,
            caisseLieu: '',
            caisseAutreNom: ''
          };
        }
      } else {
        // Pour les autres caisses (CNMSS, ENIM, etc.), format exact (comparaison insensible à la casse)
        if (org.toUpperCase() === label.toUpperCase()) {
          return {
            caissePayante: key,
            caisseLieu: '',
            caisseAutreNom: ''
          };
        }
      }
    }
    
    // Si aucun match, c'est probablement "AUTRE" avec un nom personnalisé
    return {
      caissePayante: 'AUTRE',
      caisseLieu: '',
      caisseAutreNom: org
    };
  };

  // Charger les données du patient
  useEffect(() => {
    const loadPatient = async () => {
      try {
        setLoadingPatient(true);
        const patient = await patientService.getOnePatient(id);
        
        // Parser organismeSecu pour extraire caissePayante, caisseLieu, caisseAutreNom
        const { caissePayante, caisseLieu, caisseAutreNom } = parseOrganismeSecu(patient.organismeSecu);
        
        // Mapper les données du patient vers le formulaire
        setFormData({
          prenom: patient.prenom || '',
          nom: patient.nom || '',
          email: patient.email || '',
          telephone: patient.telephone || '',
          dateNaissance: patient.dateNaissance ? patient.dateNaissance.split('T')[0] : '',
          genre: patient.genre || 'Mr',
          statut: patient.statut || 'ACTIF',
          adresseL1: patient.adresseL1 || '',
          adresseL2: patient.adresseL2 || '',
          ville: patient.ville || '',
          codePostal: patient.codePostal || '',
          numeroSecu: patient.numeroSecu || '',
          organismeSecu: patient.organismeSecu || '',
          caissePayante: caissePayante,
          caisseLieu: caisseLieu,
          caisseAutreNom: caisseAutreNom,
          notesAntecedents: patient.notes?.antecedents || '',
          notesAllergies: patient.notes?.allergies || '',
          notesTraitements: patient.notes?.traitements || '',
          notesAutres: patient.notes?.autres || '',
          contactUrgenceNom: patient.contactUrgenceNom || '',
          contactUrgenceTelephone: patient.contactUrgenceTelephone || '',
          mutuelleId: patient.mutuelleId || '',
          numeroAdherent: patient.numeroAdherent || '',
          dateDebutCouverture: patient.dateDebutCouverture ? patient.dateDebutCouverture.split('T')[0] : '',
          dateFinCouverture: patient.dateFinCouverture ? patient.dateFinCouverture.split('T')[0] : '',
          couvertureValide: patient.couvertures && patient.couvertures.length > 0 ? patient.couvertures[0].valide : true
        });
        setOriginalNumeroSecu(patient.numeroSecu || '');
      } catch (error) {
        console.error('Erreur lors du chargement du patient:', error);
        setLoadError('Erreur lors du chargement du patient');
      } finally {
        setLoadingPatient(false);
      }
    };

    if (id) {
      loadPatient();
    }
  }, [id]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    let nextValue = type === 'checkbox' ? checked : value;
    // Forcer uniquement des chiffres pour le numéro de sécurité sociale et limiter à 13
    if (name === 'numeroSecu') {
      nextValue = String(value).replace(/\D/g, '').slice(0, 13);
    }
    // Nettoyer le téléphone (principal et d'urgence) pour le backend
    if (name === 'telephone' || name === 'contactUrgenceTelephone') {
      // Garder seulement les chiffres, +, espaces, tirets, parenthèses et points
      nextValue = value.replace(/[^0-9\s\+\-\(\)\.]/g, '');
    }
    setFormData(prev => ({
      ...prev,
      [name]: nextValue
    }));
  };

  const handleCustomMutuelleChange = (e) => {
    setCustomMutuelleName(e.target.value);
  };

  const createCustomMutuelle = async () => {
    if (!customMutuelleName.trim()) return;
    
    try {
      const newMutuelle = await createMutuelleMutation.mutateAsync({
        nom: customMutuelleName.trim()
      });
      
      // Utiliser l'ID de la nouvelle mutuelle
      setFormData(prev => ({ ...prev, mutuelleId: newMutuelle.id }));
      setShowCustomMutuelle(false);
      setCustomMutuelleName('');
    } catch (error) {
      console.error('Erreur lors de la création de la mutuelle:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      const secu = String(formData.numeroSecu || '');
      // Vérif doublon NIR si modifié et non vide
      if (secu && secu !== String(originalNumeroSecu || '')) {
        const exists = await patientService.existsNumeroSecu(secu, String(id));
        if (exists) {
          setLoading(false);
          alert('Un patient avec ce numéro de sécurité sociale existe déjà.');
          return;
        }
      }
      
      // Préparer les données pour l'API
      // Calcul organismeSecu via enum/règles
      const ENUM_LABELS = { CPAM: 'CPAM', CGSS: 'CGSS', MSA: 'MSA', CNMSS: 'CNMSS', ENIM: 'ENIM', CANSSM: 'CANSSM', CPR_SNCF: 'CPR SNCF', RATP: 'RATP', CAMIEG: 'CAMIEG', AUTRE: 'Autre' };
      const needsLieu = (k) => ['CPAM','CGSS','MSA'].includes(k || '');
      let organismeSecuComputed = '';
      if (formData.caissePayante === 'AUTRE') {
        if (!formData.caisseAutreNom.trim()) {
          alert('Veuillez saisir le nom de la caisse.');
          setLoading(false);
          return;
        }
        organismeSecuComputed = formData.caisseAutreNom.trim();
      } else if (formData.caissePayante) {
        const label = ENUM_LABELS[formData.caissePayante] || formData.caissePayante;
        organismeSecuComputed = needsLieu(formData.caissePayante) && formData.caisseLieu.trim()
          ? `${label} de ${formData.caisseLieu.trim()}`
          : label;
      } else {
        organismeSecuComputed = formData.organismeSecu || '';
      }

      // Normaliser le téléphone (comme dans le formulaire de création)
      const normalizePhoneForBackend = (phone) => {
        if (!phone) return undefined;
        // Supprimer tous les espaces, tirets, parenthèses et points
        let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
        // Si commence par +33, remplacer par 0
        if (cleaned.startsWith('+33')) {
          cleaned = '0' + cleaned.substring(3);
        }
        // Si commence par 33 et a 12 chiffres, remplacer par 0
        if (cleaned.startsWith('33') && cleaned.length === 12) {
          cleaned = '0' + cleaned.substring(2);
        }
        return cleaned;
      };

      const patientData = {
        prenom: formData.prenom,
        nom: formData.nom,
        email: formData.email,
        telephone: normalizePhoneForBackend(formData.telephone),
        dateNaissance: formData.dateNaissance,
        genre: formData.genre,
        statut: formData.statut,
        adresseL1: formData.adresseL1,
        adresseL2: formData.adresseL2,
        ville: formData.ville,
        codePostal: formData.codePostal,
        numeroSecu: formData.numeroSecu,
        organismeSecu: organismeSecuComputed,
        notes: (() => {
          const n = {
            antecedents: formData.notesAntecedents?.trim(),
            allergies: formData.notesAllergies?.trim(),
            traitements: formData.notesTraitements?.trim(),
            autres: formData.notesAutres?.trim(),
          };
          const hasAny = Object.values(n).some(v => v && v.length > 0);
          return hasAny ? n : undefined;
        })(),
        contactUrgenceNom: formData.contactUrgenceNom || null,
        contactUrgenceTelephone: normalizePhoneForBackend(formData.contactUrgenceTelephone) || null
      };

      // Ajouter les données de couverture si une mutuelle est sélectionnée
      if (formData.mutuelleId) {
        patientData.couvertures = [{
          mutuelleId: formData.mutuelleId,
          numeroAdherent: formData.numeroAdherent,
          dateDebut: formData.dateDebutCouverture,
          dateFin: formData.dateFinCouverture,
          valide: formData.couvertureValide
        }];
      }

      // Utiliser PATCH (merge-patch) pour compatibilité backend
      await patientService.patchPatient(id, patientData);
      navigate(`/patients/${id}`);
    } catch (error) {
      console.error('Erreur lors de la modification du patient:', error);
      if (error?.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate(`/patients/${id}`);
  };

  if (loadingPatient) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner message="Chargement du patient..." />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-6 bg-orange-100 min-h-screen w-[95%] md:w-[90%] lg:w-[80%] mx-auto px-2 md:px-4 py-6 flex items-center justify-center">
        <div className="bg-orange-50 p-8 rounded-lg shadow-md text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Erreur</h2>
          <p className="text-gray-600 mb-6">{loadError}</p>
          <button
            onClick={() => navigate('/patients')}
            className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Retour à la liste
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-orange-100 min-h-screen w-[95%] md:w-[90%] lg:w-[80%] mx-auto px-2 md:px-4 py-6">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="bg-orange-200 rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-orange-800">Modifier Patient</h1>
              <p className="text-gray-600 mt-2">Modifier les informations du patient</p>
            </div>
            <button
              onClick={handleCancel}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              ← Annuler
            </button>
          </div>
        </div>

        {/* Formulaire */}
        <div className="bg-orange-50 rounded-lg shadow">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Informations personnelles */}
            <div className="bg-white rounded-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <span className="text-2xl mr-2">👤</span>
                Informations personnelles
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Genre
                  </label>
                  <select
                    name="genre"
                    value={formData.genre}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="Mr">Monsieur</option>
                    <option value="Mme">Madame</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prénom *
                  </label>
                  <input
                    type="text"
                    name="prenom"
                    value={formData.prenom}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom *
                  </label>
                  <input
                    type="text"
                    name="nom"
                    value={formData.nom}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    name="telephone"
                    value={formData.telephone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date de naissance
                  </label>
                  <input
                    type="date"
                    name="dateNaissance"
                    value={formData.dateNaissance}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Statut
                  </label>
                  <select
                    name="statut"
                    value={formData.statut}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="ACTIF">Actif ✅</option>
                    <option value="INACTIF">Inactif ⏸️</option>
                    <option value="DECEDE">Décédé ⚰️</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Les patients décédés ne peuvent plus recevoir de nouveaux rendez-vous.
                  </p>
                </div>
              </div>
            </div>

            {/* Adresse */}
            <div className="bg-white rounded-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <span className="text-2xl mr-2">🏠</span>
                Adresse
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Adresse ligne 1
                  </label>
                  <input
                    type="text"
                    name="adresseL1"
                    value={formData.adresseL1}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Adresse ligne 2
                  </label>
                  <input
                    type="text"
                    name="adresseL2"
                    value={formData.adresseL2}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ville
                    </label>
                    <input
                      type="text"
                      name="ville"
                      value={formData.ville}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Code postal
                    </label>
                    <input
                      type="text"
                      name="codePostal"
                      value={formData.codePostal}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Sécurité sociale */}
            <div className="bg-white rounded-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <span className="text-2xl mr-2">🆔</span>
                Sécurité sociale
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Numéro de sécurité sociale
                  </label>
                  <input
                    type="text"
                    name="numeroSecu"
                    value={formData.numeroSecu}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    inputMode="numeric"
                    pattern="^[0-9]{13}$"
                    maxLength={13}
                    title="Le numéro de sécurité sociale doit contenir exactement 13 chiffres"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Caisse payante</label>
                  <select
                    name="caissePayante"
                    value={formData.caissePayante}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">— Sélectionner —</option>
                    <option value="CPAM">CPAM</option>
                    <option value="CGSS">CGSS</option>
                    <option value="MSA">MSA</option>
                    <option value="CNMSS">CNMSS</option>
                    <option value="ENIM">ENIM</option>
                    <option value="CANSSM">CANSSM</option>
                    <option value="CPR_SNCF">CPR SNCF</option>
                    <option value="RATP">RATP</option>
                    <option value="CAMIEG">CAMIEG</option>
                    <option value="AUTRE">Autre…</option>
                  </select>
                </div>
              </div>
              {(formData.caissePayante === 'CPAM' || formData.caissePayante === 'CGSS' || formData.caissePayante === 'MSA') && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lieu (ville / département / région)</label>
                  <input
                    type="text"
                    name="caisseLieu"
                    value={formData.caisseLieu}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              )}
              {formData.caissePayante === 'AUTRE' && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la caisse</label>
                  <input
                    type="text"
                    name="caisseAutreNom"
                    value={formData.caisseAutreNom}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Saisir le nom de la caisse"
                    required
                  />
                </div>
              )}
            </div>

            {/* Couverture mutuelle retirée: gérée via le modal dans PatientSingle */}

            {/* Contact d'urgence */}
            <div className="bg-white rounded-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <span className="text-2xl mr-2">🚨</span>
                Contact d'urgence
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom du contact d'urgence / Lien avec le patient
                  </label>
                  <input
                    type="text"
                    name="contactUrgenceNom"
                    value={formData.contactUrgenceNom}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Téléphone du contact d'urgence
                  </label>
                  <input
                    type="tel"
                    name="contactUrgenceTelephone"
                    value={formData.contactUrgenceTelephone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
            </div>

            {/* Notes médicales structurées */}
            <div className="bg-white rounded-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <span className="text-2xl mr-2">📝</span>
                Informations médicales
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Antécédents médicaux</label>
                  <textarea
                    name="notesAntecedents"
                    value={formData.notesAntecedents}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Allergies</label>
                  <textarea
                    name="notesAllergies"
                    value={formData.notesAllergies}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Traitements en cours</label>
                  <textarea
                    name="notesTraitements"
                    value={formData.notesTraitements}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Autres informations</label>
                  <textarea
                    name="notesAutres"
                    value={formData.notesAutres}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="flex justify-end space-x-4 pt-6">
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Modification...' : 'Modifier le patient'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ModifierPatient;
