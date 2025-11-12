import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import patientService from '../../_services/patient.service';
import mutuelleService from '../../_services/mutuelle.service';
import LoadingSpinner from '../../components/LoadingSpinner';

const NouveauPatient = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Mutuelles
  const [insuranceCompanies, setInsuranceCompanies] = useState([]);
  const [loadingInsurance, setLoadingInsurance] = useState(true);
  
  // États pour l'option "Autre" mutuelle
  const [showCustomMutuelle, setShowCustomMutuelle] = useState(false);
  const [customMutuelleName, setCustomMutuelleName] = useState('');
  const [creatingCustomMutuelle, setCreatingCustomMutuelle] = useState(false);
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
    caissePayante: '', // Enum CaissePayante
    caisseLieu: '',    // Lieu pour CPAM/CGSS/MSA
    caisseAutreNom: '',
    // Notes médicales (sous-champs)
    notesAntecedents: '',
    notesAllergies: '',
    notesTraitements: '',
    notesAutres: '',
    // Champs supplémentaires
    emergencyContact: '',
    emergencyPhone: '',
    // Champs de couverture mutuelle
    mutuelleId: '', // ID de la mutuelle sélectionnée
    numeroAdherent: '',
    dateDebutCouverture: '',
    dateFinCouverture: '',
    couvertureValide: true
  });

  // Charger les mutuelles
  useEffect(() => {
    const loadInsuranceCompanies = async () => {
      try {
        setLoadingInsurance(true);
        setLoadError('');
        
        // Utiliser l'API Platform pour récupérer les vraies mutuelles avec IRIs
        const data = await mutuelleService.getAllMutuelles();
        
        
        
        // Les données sont déjà au bon format avec @id
        setInsuranceCompanies(data);
      } catch (error) {
        console.error('Erreur lors du chargement des mutuelles:', error);
        setLoadError("Impossible de charger les mutuelles. Vérifiez votre connexion et réessayez.");
        
        // Fallback avec l'ancien service
        try {
          const fallbackData = await patientService.getInsuranceCompanies();
          
          const transformedData = Array.isArray(fallbackData) 
            ? fallbackData.map((name, index) => ({ 
                id: index + 1, 
                '@id': `/api/mutuelles/${index + 1}`,
                name: name 
              }))
            : [];
          
          setInsuranceCompanies(transformedData);
        } catch (fallbackError) {
          console.error('Erreur fallback:', fallbackError);
          // Liste fallback finale
          setInsuranceCompanies([
            { id: 1, name: 'Mutuelle Générale' },
            { id: 2, name: 'MGEN' },
            { id: 3, name: 'Harmonie Mutuelle' },
            { id: 4, name: 'Mutuelle Familiale' },
            { id: 5, name: 'MACSF' },
            { id: 6, name: 'MNH' }
          ]);
        }
      } finally {
        setLoadingInsurance(false);
      }
    };

    loadInsuranceCompanies();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Nettoyer le téléphone pour le backend
    let cleanedValue = value;
    if (name === 'telephone') {
      // Garder seulement les chiffres, +, espaces, tirets, parenthèses et points
      cleanedValue = value.replace(/[^0-9\s\+\-\(\)\.]/g, '');
    }
    // Forcer uniquement des chiffres pour le numéro de sécurité sociale et limiter à 13
    if (name === 'numeroSecu') {
      cleanedValue = value.replace(/\D/g, '').slice(0, 13);
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: cleanedValue
    }));
  };

  // Gérer le changement de mutuelle
  const handleMutuelleChange = (e) => {
    const value = e.target.value;
    if (value === 'autre') {
      setShowCustomMutuelle(true);
      setFormData(prev => ({ ...prev, mutuelleId: '' }));
    } else {
      setShowCustomMutuelle(false);
      setFormData(prev => ({ ...prev, mutuelleId: value }));
    }
  };

  // Créer une mutuelle personnalisée
  const [customMutuelleMessage, setCustomMutuelleMessage] = useState({ type: '', text: '' });

  const handleCreateCustomMutuelle = async () => {
    if (!customMutuelleName.trim()) {
      setCustomMutuelleMessage({ type: 'error', text: 'Le nom de la mutuelle est obligatoire' });
      return;
    }

    try {
      setCreatingCustomMutuelle(true);
      
      // Utiliser le service mutuelle avec authentification
      const response = await mutuelleService.createCustomMutuelle(
        customMutuelleName.trim()
      );

      // Ajouter la nouvelle mutuelle à la liste
      const newMutuelle = {
        id: response.mutuelle.id,
        '@id': `/api/mutuelles/${response.mutuelle.id}`,
        name: response.mutuelle.nom
      };
      
      setInsuranceCompanies(prev => [...prev, newMutuelle]);
      // Utiliser l'ID numérique pour l'API Platform
      setFormData(prev => ({ ...prev, mutuelleId: response.mutuelle.id }));
      
      // Réinitialiser le formulaire "Autre"
      setShowCustomMutuelle(false);
      setCustomMutuelleName('');
      
      setCustomMutuelleMessage({ type: 'success', text: 'Mutuelle créée avec succès !' });
    } catch (error) {
      console.error('Erreur lors de la création de la mutuelle:', error);
      setCustomMutuelleMessage({ type: 'error', text: 'Erreur lors de la création de la mutuelle' });
    } finally {
      setCreatingCustomMutuelle(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    try {
      setSubmitError('');
      // Vérif doublon NIR
      if (formData.numeroSecu) {
        const exists = await patientService.existsNumeroSecu(String(formData.numeroSecu));
        if (exists) {
          setSubmitError('Un patient avec ce numéro de sécurité sociale existe déjà.');
          setLoading(false);
          return;
        }
      }
      
      // Calcul organismeSecu via enum/règles
      const ENUM_LABELS = { CPAM: 'CPAM', CGSS: 'CGSS', MSA: 'MSA', CNMSS: 'CNMSS', ENIM: 'ENIM', CANSSM: 'CANSSM', CPR_SNCF: 'CPR SNCF', RATP: 'RATP', CAMIEG: 'CAMIEG', AUTRE: 'Autre' };
      const needsLieu = (k) => ['CPAM','CGSS','MSA'].includes(k || '');
      let organismeSecuComputed = '';
      if (formData.caissePayante === 'AUTRE') {
        if (!formData.caisseAutreNom.trim()) {
          setSubmitError('Veuillez saisir le nom de la caisse.');
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
      
      // 1. Construire le payload patient (sans mutuelle)
      const patientPayload = {
        prenom: formData.prenom,
        nom: formData.nom,
        email: formData.email || undefined,
        telephone: formData.telephone || undefined,
        dateNaissance: formData.dateNaissance || undefined,
        genre: formData.genre || undefined,
        statut: formData.statut || 'ACTIF',
        adresseL1: formData.adresseL1 || undefined,
        adresseL2: formData.adresseL2 || undefined,
        ville: formData.ville || undefined,
        codePostal: formData.codePostal || undefined,
        numeroSecu: formData.numeroSecu || undefined,
        organismeSecu: organismeSecuComputed || undefined,
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
        emergencyContact: formData.emergencyContact || undefined,
        emergencyPhone: formData.emergencyPhone || undefined,
        // ❌ PAS de champs mutuelle ici - séparés dans les couvertures
      };

      
      
      // 2. Créer le patient
      const patient = await patientService.createPatient(patientPayload);
      
      // 3. Si une mutuelle est sélectionnée, créer la couverture
      if (formData.mutuelleId && formData.numeroAdherent) {
        try {
          // Construire l'IRI complet de la mutuelle
          const mutuelleIri = formData.mutuelleId.startsWith('/api/') 
            ? formData.mutuelleId 
            : `/api/mutuelles/${formData.mutuelleId}`;
            
          const couvertureData = {
            patient: patient['@id'], // IRI du patient créé
            mutuelle: mutuelleIri, // IRI complet de la mutuelle
            numeroAdherent: formData.numeroAdherent,
            dateDebut: formData.dateDebutCouverture,
            dateFin: formData.dateFinCouverture,
            valide: formData.couvertureValide
          };
          
          
          await patientService.createCouverture(couvertureData);
          
        } catch (error) {
          console.error('❌ Erreur création couverture:', error);
          // Ne pas faire échouer la création du patient si la couverture échoue
        }
      }
      
      navigate('/patients');
    } catch (error) {
      console.error('❌ Erreur lors de la création du patient:', error);
      setSubmitError('Erreur lors de la création du patient. Vérifiez les champs et réessayez.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 bg-orange-100 min-h-screen p-6">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="bg-orange-200 rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-orange-800">Nouveau Patient</h1>
              <p className="text-gray-600 mt-2">Créer un nouveau dossier patient</p>
            </div>
            <button
              onClick={() => navigate('/patients')}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              ← Retour à la liste
            </button>
          </div>
        </div>

        {/* Global form error banner */}
        {submitError && (
          <div className="mb-4 bg-red-100 border border-red-300 text-red-800 px-4 py-3 rounded">
            {submitError}
          </div>
        )}

        {/* Formulaire */}
        <div className="bg-orange-50 rounded-lg shadow">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Informations personnelles */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations personnelles</h3>
              
              {/* Genre - Première ligne seule */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Genre *</label>
                <select
                  name="genre"
                  value={formData.genre}
                  onChange={handleChange}
                  required
                  className="w-full md:w-1/3 px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="Mr">Mr</option>
                  <option value="Mme">Mme</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Statut *</label>
                <select
                  name="statut"
                  value={formData.statut}
                  onChange={handleChange}
                  required
                  className="w-full md:w-1/3 px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="ACTIF">Actif ✅</option>
                  <option value="INACTIF">Inactif ⏸️</option>
                  <option value="DECEDE">Décédé ⚰️</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Le statut contrôle la disponibilité du patient pour la prise de rendez-vous.
                </p>
              </div>

              {/* Prénom et Nom - Deuxième ligne */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
                  <input
                    type="text"
                    name="prenom"
                    value={formData.prenom}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                  <input
                    type="text"
                    name="nom"
                    value={formData.nom}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                  <input
                    type="tel"
                    name="telephone"
                    value={formData.telephone}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Ex: 06 12 34 56 78 ou +33 6 12 34 56 78"
                    pattern="[0-9\s\+\-\(\)\.]{10,20}"
                    title="Format accepté: 06 12 34 56 78, +33 6 12 34 56 78, etc."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Format flexible: numéros, espaces, +, -, (), . acceptés
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date de naissance *</label>
                  <input
                    type="date"
                    name="dateNaissance"
                    value={formData.dateNaissance}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Adresse */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Adresse</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Adresse L1</label>
                  <input
                    type="text"
                    name="adresseL1"
                    value={formData.adresseL1}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    autoComplete="address-line1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Adresse L2</label>
                  <input
                    type="text"
                    name="adresseL2"
                    value={formData.adresseL2}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    autoComplete="address-line2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                  <input
                    type="text"
                    name="ville"
                    value={formData.ville}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    autoComplete="address-level2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code postal</label>
                  <input
                    type="text"
                    name="codePostal"
                    value={formData.codePostal}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    autoComplete="postal-code"
                  />
                </div>
              </div>
            </div>

            {/* Sécurité sociale */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Sécurité sociale</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Numéro de sécurité sociale</label>
                  <input
                    type="text"
                    name="numeroSecu"
                    value={formData.numeroSecu}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Ex: 1234567890123"
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
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
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
                    onChange={handleChange}
                    placeholder="Ex: Paris, Gironde, Bretagne…"
                    className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
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
                    onChange={handleChange}
                    placeholder="Saisir le nom de la caisse"
                    className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                  />
              </div>
              )}
            </div>

            {/* Couverture mutuelle */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Couverture mutuelle</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mutuelle</label>
                  {loadingInsurance ? (
                    <div className="w-full px-3 py-2 border border-orange-300 rounded-lg bg-gray-50 flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500 mr-2"></div>
                      <span className="text-sm text-gray-500">Chargement des mutuelles...</span>
                    </div>
                  ) : (
                    <select
                      name="mutuelleId"
                      value={formData.mutuelleId}
                      onChange={handleMutuelleChange}
                      className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="">Sélectionner une mutuelle</option>
                      {insuranceCompanies.map((company) => {
                        // Utiliser l'ID numérique pour l'API Platform
                        const value = company.id || company['@id']?.split('/').pop();
                        const displayName = company.nom || company.name;
                        return (
                          <option key={company.id ?? company['@id'] ?? company.nom} value={value}>
                            {displayName}
                          </option>
                        );
                      })}
                      <option value="autre">Autre (saisir manuellement)</option>
                    </select>
                  )}
                  
                  {/* Formulaire pour mutuelle personnalisée */}
                  {showCustomMutuelle && (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h4 className="text-sm font-medium text-blue-800 mb-3">Créer une nouvelle mutuelle</h4>
                      {customMutuelleMessage.text && (
                        <div className={`${customMutuelleMessage.type === 'success' ? 'bg-green-100 border-green-300 text-green-800' : 'bg-red-100 border-red-300 text-red-800'} border px-3 py-2 rounded text-sm mb-3`}>
                          {customMutuelleMessage.text}
                        </div>
                      )}
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la mutuelle *</label>
                          <input
                            type="text"
                            value={customMutuelleName}
                            onChange={(e) => setCustomMutuelleName(e.target.value)}
                            className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Ex: Ma Mutuelle Personnalisée"
                          />
                        </div>
                        <div className="flex space-x-2">
                          <button
                            type="button"
                            onClick={handleCreateCustomMutuelle}
                            disabled={creatingCustomMutuelle || !customMutuelleName.trim()}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                          >
                            {creatingCustomMutuelle ? 'Création...' : 'Créer la mutuelle'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowCustomMutuelle(false);
                              setCustomMutuelleName('');
                              setCustomMutuelleMessage({ type: '', text: '' });
                            }}
                            className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Numéro d'adhérent</label>
                  <input
                    type="text"
                    name="numeroAdherent"
                    value={formData.numeroAdherent}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Ex: 123456789"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date de début</label>
                  <input
                    type="date"
                    name="dateDebutCouverture"
                    value={formData.dateDebutCouverture}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin</label>
                  <input
                    type="date"
                    name="dateFinCouverture"
                    value={formData.dateFinCouverture}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="couvertureValide"
                    checked={formData.couvertureValide}
                    onChange={(e) => setFormData(prev => ({ ...prev, couvertureValide: e.target.checked }))}
                    className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-700">
                    Couverture valide
                  </label>
                </div>
              </div>
            </div>

            {/* Informations médicales */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations médicales</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Antécédents médicaux</label>
                  <textarea
                    name="notesAntecedents"
                    value={formData.notesAntecedents}
                    onChange={handleChange}
                    rows={4}
                    className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Maladies chroniques, hospitalisations, chirurgies..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Allergies</label>
                  <textarea
                    name="notesAllergies"
                    value={formData.notesAllergies}
                    onChange={handleChange}
                    rows={4}
                    className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Médicaments, aliments, substances..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Traitements en cours</label>
                  <textarea
                    name="notesTraitements"
                    value={formData.notesTraitements}
                    onChange={handleChange}
                    rows={4}
                    className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Médicaments, posologie et fréquence..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Autres informations</label>
                  <textarea
                    name="notesAutres"
                    value={formData.notesAutres}
                    onChange={handleChange}
                    rows={4}
                    className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Contact d'urgence, observations diverses..."
                  />
                </div>
              </div>
            </div>

            {/* Boutons */}
            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => navigate('/patients')}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Création...' : 'Créer le patient'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default NouveauPatient;
