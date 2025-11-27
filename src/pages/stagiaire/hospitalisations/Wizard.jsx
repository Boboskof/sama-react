import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import hospitalisationService from '../../../_services/hospitalisation.service';
import patientService from '../../../_services/patient.service';
import documentService from '../../../_services/document.service';
import { communicationService } from '../../../_services/communication.service';
import userService from '../../../_services/user.service';
import { formatDate as formatDateDisplay } from '../../../utils/dateHelpers';
import PatientName from '../../../components/PatientName';
import LoadingSpinner from '../../../components/LoadingSpinner';

const Wizard = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(null);
  const [patient, setPatient] = useState(null);
  const [mutuelleSnapshot, setMutuelleSnapshot] = useState(null);

  // Étape 1 - Pré-admission
  const [motifAdministratif, setMotifAdministratif] = useState('');
  const [uniteService, setUniteService] = useState('');
  const [contactUrgenceNom, setContactUrgenceNom] = useState('');
  const [contactUrgenceTelephone, setContactUrgenceTelephone] = useState('');
  const [checklist, setChecklist] = useState({
    piece_identite: false,
    attestation_mutuelle: false,
    consentement: false,
  });
  const [uploadedFiles, setUploadedFiles] = useState([]);

  // Étape 2 - Planification
  const [plannedAdmissionDate, setPlannedAdmissionDate] = useState('');
  const [plannedDischargeDate, setPlannedDischargeDate] = useState('');
  const [createRdvPreAdmission, setCreateRdvPreAdmission] = useState(false);
  const [rdvStartAt, setRdvStartAt] = useState('');
  const [rdvEndAt, setRdvEndAt] = useState('');
  const [rdvMotif, setRdvMotif] = useState('Pré-admission hospitalisation');
  const [rdvLieu, setRdvLieu] = useState('');

  // Charger le patient et sa mutuelle
  useEffect(() => {
    (async () => {
      try {
        const p = await patientService.getOnePatient(id);
        setPatient(p);
        // Charger la dernière couverture valide
        try {
          const couv = await patientService.getPatientCouvertures(id);
          const valide = (couv || []).find(c => {
            const now = new Date();
            const d = c.dateFin ? new Date(c.dateFin) : null;
            return !d || d >= now;
          });
          if (valide && valide.mutuelle) {
            setMutuelleSnapshot(valide.mutuelle);
          }
        } catch {}
      } catch {}
    })();
  }, [id]);

  // Calculer le % de complétion de la checklist
  const checklistProgress = () => {
    const total = Object.keys(checklist).length;
    const completed = Object.values(checklist).filter(Boolean).length;
    return Math.round((completed / total) * 100);
  };

  // Validation étape 1
  const canProceedStep1 = () => {
    return motifAdministratif.trim() && uniteService.trim() && checklist.piece_identite && checklist.attestation_mutuelle;
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!created || !files.length) return;
    setLoading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('patient', id);
        fd.append('type', 'AUTRE');
        fd.append('contenu', `Hospitalisation #${created.id}`);
        // Note: Pas de champ titre dans ce formulaire, donc pas d'original_name envoyé
        // Le backend utilisera le nom du fichier par défaut
        // Le backend devrait accepter un champ "tags" ou "hospitalisationId"
        await documentService.createDocument(fd);
      }
      setUploadedFiles(prev => [...prev, ...files.map(f => ({ name: f.name, id: Date.now() }))]);
    } catch (err) {
      console.error('Erreur upload', err);
    } finally {
      setLoading(false);
    }
  };

  const next = async () => {
    if (step === 1) {
      if (!canProceedStep1()) {
        alert('Veuillez compléter les champs obligatoires et cocher les pièces critiques (pièce d\'identité, attestation mutuelle)');
        return;
      }
      try {
        setLoading(true);
        const payload = {
          patient: id,
          motifAdministratif,
          uniteService,
          contactUrgenceNom,
          contactUrgenceTelephone,
          mutuelleSnapshot,
          checklist,
        };
        const res = await hospitalisationService.create(payload);
        setCreated(res);
        setStep(2);
      } catch (err) {
        console.error('Erreur création', err);
        alert('Erreur lors de la création');
      } finally {
        setLoading(false);
      }
    } else if (step === 2) {
      if (!plannedAdmissionDate) {
        alert('Veuillez saisir une date d\'admission prévue');
        return;
      }
      try {
        setLoading(true);
        const schedulePayload = {
          plannedAdmissionDate,
          plannedDischargeDate: plannedDischargeDate || undefined,
          uniteService,
          createRdvPreAdmission,
          ...(createRdvPreAdmission && rdvStartAt ? {
            rdv: {
              startAt: rdvStartAt,
              endAt: rdvEndAt || undefined,
              motif: rdvMotif,
              lieu: rdvLieu || undefined,
            }
          } : {}),
        };
        await hospitalisationService.postSchedule(created.id, schedulePayload);
        setStep(3);
      } catch (err) {
        console.error('Erreur planification', err);
        alert('Erreur lors de la planification');
      } finally {
        setLoading(false);
      }
    } else {
      navigate(`/patients/${id}/hospitalisations/${created.id}`);
    }
  };

  const formatDate = (d) => {
    if (!d) return '';
    const date = new Date(d);
    return date.toISOString().split('T')[0];
  };

  const today = formatDate(new Date());

  return (
    <div className="min-h-screen w-[95%] md:w-[90%] lg:w-[80%] mx-auto px-2 md:px-4 py-6 space-y-6 bg-indigo-50">
      <div className="text-center py-6">
        <div className="bg-indigo-200 rounded-lg shadow p-6 max-w-xl mx-auto">
          <h1 className="text-2xl font-bold text-indigo-800">Nouvelle hospitalisation</h1>
          <p className="text-indigo-700 text-sm">Étape {step} / 3</p>
        </div>
      </div>

      {/* Étape 1 - Pré-admission */}
      {step === 1 && (
        <div className="bg-white rounded-lg shadow p-6 max-w-3xl mx-auto">
          <h3 className="text-lg font-semibold mb-4 text-indigo-800">Pré-admission</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Motif administratif *</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={motifAdministratif}
                onChange={e => setMotifAdministratif(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unité / Service *</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={uniteService}
                onChange={e => setUniteService(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact urgence - Nom</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={contactUrgenceNom}
                onChange={e => setContactUrgenceNom(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact urgence - Téléphone</label>
              <input
                className="w-full border rounded px-3 py-2"
                type="tel"
                value={contactUrgenceTelephone}
                onChange={e => setContactUrgenceTelephone(e.target.value)}
              />
            </div>
          </div>

          {mutuelleSnapshot && (
            <div className="mb-4 p-3 bg-gray-50 rounded border">
              <label className="block text-sm font-medium text-gray-700 mb-1">Mutuelle (dernière couverture valide)</label>
              <p className="text-sm text-gray-600">
                {typeof mutuelleSnapshot === 'object' ? (mutuelleSnapshot.nom || mutuelleSnapshot.name || 'Mutuelle') : String(mutuelleSnapshot)}
              </p>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Checklist pré-admission *</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={checklist.piece_identite}
                  onChange={e => setChecklist(c => ({ ...c, piece_identite: e.target.checked }))}
                  className="rounded"
                />
                <span className={checklist.piece_identite ? 'text-gray-900' : 'text-red-600'}>
                  Pièce d'identité *
                </span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={checklist.attestation_mutuelle}
                  onChange={e => setChecklist(c => ({ ...c, attestation_mutuelle: e.target.checked }))}
                  className="rounded"
                />
                <span className={checklist.attestation_mutuelle ? 'text-gray-900' : 'text-red-600'}>
                  Attestation mutuelle *
                </span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={checklist.consentement}
                  onChange={e => setChecklist(c => ({ ...c, consentement: e.target.checked }))}
                  className="rounded"
                />
                <span>Consentement</span>
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-2">Complétion: {checklistProgress()}%</p>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              disabled={loading || !canProceedStep1()}
              onClick={next}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <LoadingSpinner color="white" size="small" inline={true} />
                  Création...
                </>
              ) : (
                'Suivant'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Étape 2 - Planification */}
      {step === 2 && created && (
        <div className="bg-white rounded-lg shadow p-6 max-w-3xl mx-auto">
          <h3 className="text-lg font-semibold mb-4 text-indigo-800">Planification</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date d'admission prévue *</label>
              <input
                type="date"
                className="w-full border rounded px-3 py-2"
                value={plannedAdmissionDate}
                onChange={e => setPlannedAdmissionDate(e.target.value)}
                min={today}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de sortie prévue (optionnel)</label>
              <input
                type="date"
                className="w-full border rounded px-3 py-2"
                value={plannedDischargeDate}
                onChange={e => setPlannedDischargeDate(e.target.value)}
                min={plannedAdmissionDate || today}
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={createRdvPreAdmission}
                onChange={e => setCreateRdvPreAdmission(e.target.checked)}
                className="rounded"
              />
              <span className="font-medium">Créer un RDV de pré-admission</span>
            </label>
            {createRdvPreAdmission && (
              <div className="ml-6 mt-2 space-y-2 p-3 bg-gray-50 rounded">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Date/heure début</label>
                    <input
                      type="datetime-local"
                      className="w-full border rounded px-2 py-1 text-sm"
                      value={rdvStartAt}
                      onChange={e => setRdvStartAt(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Date/heure fin (optionnel)</label>
                    <input
                      type="datetime-local"
                      className="w-full border rounded px-2 py-1 text-sm"
                      value={rdvEndAt}
                      onChange={e => setRdvEndAt(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Motif</label>
                  <input
                    type="text"
                    className="w-full border rounded px-2 py-1 text-sm"
                    value={rdvMotif}
                    onChange={e => setRdvMotif(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Lieu (optionnel)</label>
                  <input
                    type="text"
                    className="w-full border rounded px-2 py-1 text-sm"
                    value={rdvLieu}
                    onChange={e => setRdvLieu(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {created && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Upload de documents (tag: Hospitalisation #{created.id})</label>
              <label className="cursor-pointer block border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                <span className="material-symbols-rounded text-gray-400 text-4xl mb-2 block">upload_file</span>
                <p className="text-sm text-gray-700 mb-2">
                  <span className="font-semibold">Cliquez pour sélectionner</span> ou glissez-déposez des fichiers
                </p>
                <p className="text-xs text-gray-500">Vous pouvez sélectionner plusieurs fichiers</p>
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  disabled={loading}
                  className="hidden"
                />
              </label>
              {uploadedFiles.length > 0 && (
                <ul className="mt-2 text-sm text-gray-600">
                  {uploadedFiles.map((f, i) => (
                    <li key={i}>✓ {f.name}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 rounded border hover:bg-gray-50"
            >
              Retour
            </button>
            <button
              disabled={loading || !plannedAdmissionDate}
              onClick={next}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <LoadingSpinner color="white" size="small" inline={true} />
                  Planification...
                </>
              ) : (
                'Suivant'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Étape 3 - Validation */}
      {step === 3 && created && (
        <div className="bg-white rounded-lg shadow p-6 max-w-3xl mx-auto">
          <h3 className="text-lg font-semibold mb-4 text-indigo-800">Validation</h3>
          
          <div className="space-y-4 mb-6">
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Récapitulatif</h4>
              <div className="bg-gray-50 p-4 rounded space-y-2 text-sm">
                <p><strong>Patient:</strong> {patient ? <PatientName patient={patient} /> : id}</p>
                <p><strong>Service:</strong> {uniteService}</p>
                <p><strong>Motif:</strong> {motifAdministratif}</p>
                <p><strong>Admission prévue:</strong> {plannedAdmissionDate ? formatDateDisplay(plannedAdmissionDate) : '—'}</p>
                {plannedDischargeDate && <p><strong>Sortie prévue:</strong> {formatDateDisplay(plannedDischargeDate)}</p>}
                {createRdvPreAdmission && <p><strong>RDV pré-admission:</strong> {rdvStartAt ? new Date(rdvStartAt).toLocaleString('fr-FR') : 'Créé automatiquement'}</p>}
                <p><strong>Checklist:</strong> {checklistProgress()}%</p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={next}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
            >
              Terminer et voir le détail
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Wizard;
