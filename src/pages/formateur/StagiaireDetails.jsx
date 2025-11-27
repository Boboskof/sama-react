import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import formateurService from '../../_services/formateur.service';
import auditService from '../../_services/audit.service';
import patientService from '../../_services/patient.service';
import stagiaireNoteService from '../../_services/stagiaire-note.service';
import LoadingSpinner from '../../components/LoadingSpinner';
import NotesList from '../../components/NotesList';
import NoteForm from '../../components/NoteForm';
import ErrorMessage from '../../components/ErrorMessage';
import { formatDateTime } from '../../utils/dateHelpers';
import PatientName from '../../components/PatientName';
import StatCard from '../../components/StatCard';
import '../../styles/audit-logs.css';

const StagiaireDetails = () => {
  const { stagiaireId } = useParams();
  const [stagiaire, setStagiaire] = useState(null);
  const [activite, setActivite] = useState([]);
  const [patients, setPatients] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Notes
  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteError, setNoteError] = useState('');

  // Charger les notes du stagiaire
  const loadNotes = async () => {
    if (!stagiaireId) return;
    setNotesLoading(true);
    try {
      const notesList = await stagiaireNoteService.getNotes(stagiaireId, 'DESC');
      setNotes(Array.isArray(notesList) ? notesList : []);
    } catch (err) {
      console.error('Erreur chargement notes:', err);
      setNotes([]);
    } finally {
      setNotesLoading(false);
    }
  };

  useEffect(() => {
    const loadStagiaireDetails = async () => {
      try {
        setLoading(true);
        
        // Charger les données en parallèle
        const [data, patientsData, logsData] = await Promise.allSettled([
          formateurService.getStagiaireDetails(stagiaireId),
          // Charger les patients créés par ce stagiaire en utilisant le paramètre userId du backend
          patientService.getAllPatients({}, false, stagiaireId),
          // Charger l'activité récente avec auditService (même logique que LogsAudit)
          auditService.getAuditLogs({
            user_id: stagiaireId,
            limit: 50,
            page: 1
          })
        ]);
        
        // Traiter les résultats
        if (data.status === 'fulfilled') {
          setStagiaire(data.value.stagiaire);
        }
        
        if (patientsData.status === 'fulfilled') {
          setPatients(Array.isArray(patientsData.value) ? patientsData.value : []);
        } else {
          setPatients([]);
        }
        
        if (logsData.status === 'fulfilled') {
          const logs = logsData.value.data || [];
          // Normaliser les logs comme dans LogsAudit
          const normalizedLogs = logs.map((log) => {
            if (!log) return null;
            return {
              ...log,
              action: log.action || 'UNKNOWN',
              entityType: log.entityType || log.entity_type || 'UNKNOWN',
              entityId: log.entityId || log.entity_id || '',
              createdAt: log.createdAt || log.created_at || new Date().toISOString(),
              ip: log.ip || '',
              user: log.user ? {
                ...log.user,
                full_name: log.user.full_name || (log.user.prenom && log.user.nom ? `${log.user.prenom} ${log.user.nom}`.trim() : undefined)
              } : null,
              message: log.message || '',
              payload: log.payload || null
            };
          }).filter(Boolean);
          setActivite(normalizedLogs);
        } else {
          setActivite([]);
        }
        
        // Charger les notes
        await loadNotes();
      } catch (err) {
        console.error('Erreur chargement détails stagiaire:', err);
        setError('Impossible de charger les détails du stagiaire');
      } finally {
        setLoading(false);
      }
    };

    if (stagiaireId) {
      loadStagiaireDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stagiaireId]);

  // Créer une note
  const handleCreateNote = async (noteData) => {
    if (!stagiaireId) return;
    setNoteError('');
    try {
      await stagiaireNoteService.createNote(stagiaireId, noteData);
      setShowNoteForm(false);
      await loadNotes(); // Recharger la liste
    } catch (err) {
      setNoteError(err?.response?.data?.message || 'Erreur lors de la création de la note');
      throw err;
    }
  };

  // Supprimer une note
  const handleDeleteNote = async (noteId) => {
    if (!stagiaireId || !window.confirm('Êtes-vous sûr de vouloir supprimer cette note ?')) return;
    try {
      await stagiaireNoteService.deleteNote(stagiaireId, noteId);
      await loadNotes(); // Recharger la liste
    } catch (err) {
      console.error('Erreur suppression note:', err);
      alert('Erreur lors de la suppression de la note');
    }
  };


  const getActionIcon = (action) => {
    const icons = {
      'CREATE': '➕',
      'UPDATE': '✏️',
      'DELETE': '🗑️',
      'LOGIN': '🔐',
      'LOGOUT': '🚪',
      'VIEW': '👁️',
      'API_REQUEST': '🌐'
    };
    return icons[action] || '📝';
  };

  const getActionColor = (action) => {
    return auditService.getActionColor(action);
  };

  const getActionLabel = (action) => {
    return auditService.getActionLabel(action);
  };

  const getActionBadgeClass = (action) => {
    const color = getActionColor(action);
    return `audit-badge-${color}`;
  };

  const getActionRowClassWithBg = (action) => {
    const color = getActionColor(action);
    // Mapping des couleurs vers les classes Tailwind
    const colorMap = {
      green: 'bg-green-50 border-l-green-500 hover:bg-green-100',
      blue: 'bg-blue-50 border-l-blue-500 hover:bg-blue-100',
      red: 'bg-red-50 border-l-red-500 hover:bg-red-100',
      purple: 'bg-purple-50 border-l-purple-500 hover:bg-purple-100',
      gray: 'bg-gray-50 border-l-gray-500 hover:bg-gray-100',
      yellow: 'bg-yellow-50 border-l-yellow-500 hover:bg-yellow-100',
      indigo: 'bg-indigo-50 border-l-indigo-500 hover:bg-indigo-100'
    };
    return colorMap[color] || 'bg-gray-50 border-l-gray-500 hover:bg-gray-100';
  };

  const getActionIconClass = (action) => {
    const color = getActionColor(action);
    return `audit-icon-${color}`;
  };

  const formatEntityName = (entityType) => {
    if (!entityType) return '—';
    let name = entityType.replace(/^App\\Entity\\/, '');
    return name;
  };

  const getEnrichedMessage = (log) => {
    let message = log?.message || '';
    if (!message) return message;
    message = message.replace(/\s+à\s+\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}\.?/g, '');
    message = message.replace(/\s+à\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.?/g, '');
    message = message.replace(/\s+à\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\.?/g, '');
    message = message.replace(/\s+à\s+\d{2}\/\d{2}\/\d{4}\.?/g, '');
    return message.trim();
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-500 text-center p-4">{error}</div>;
  if (!stagiaire) return <div className="text-center p-4">Stagiaire non trouvé</div>;

  return (
    <div className="space-y-6 bg-indigo-100 min-h-screen w-[95%] md:w-[90%] lg:w-[80%] mx-auto px-2 md:px-4 py-6">
      {/* Titre avec icône */}
      <div className="text-center py-6 mb-6">
        <div className="bg-blue-200 rounded-lg shadow p-6 max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center shadow-sm">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-blue-800">Gestion des stagiaires</h1>
          </div>
          <p className="text-blue-700 text-3xl font-bold">
            {stagiaire.prenom} {stagiaire.nom}
          </p>
        </div>
      </div>

      <div className="w-full px-2 md:px-4 py-8">
        {/* Informations générales */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 mb-8 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 border-b border-blue-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <span className="material-symbols-rounded text-white text-2xl">person</span>
              </div>
              <h3 className="text-2xl font-bold text-white">Informations du stagiaire</h3>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Nom */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-5 border border-blue-200 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-rounded text-blue-600 text-xl">badge</span>
                  <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide">Nom</p>
                </div>
                <p className="text-xl text-gray-900 font-bold mb-1">{stagiaire.nom || '—'}</p>
                <p className="text-lg text-gray-700">{stagiaire.prenom || '—'}</p>
              </div>

              {/* Email */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-5 border border-green-200 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-rounded text-green-600 text-xl">email</span>
                  <p className="text-sm font-semibold text-green-700 uppercase tracking-wide">Email</p>
                </div>
                <p className="text-lg text-gray-900 break-all">{stagiaire.email || '—'}</p>
              </div>

              {/* Téléphone */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-5 border border-purple-200 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-rounded text-purple-600 text-xl">phone</span>
                  <p className="text-sm font-semibold text-purple-700 uppercase tracking-wide">Téléphone</p>
                </div>
                <p className="text-lg text-gray-900">{stagiaire.telephone || stagiaire.phone || <span className="text-gray-400 italic">Non renseigné</span>}</p>
              </div>

              {/* Rôle */}
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-5 border border-orange-200 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-rounded text-orange-600 text-xl">work</span>
                  <p className="text-sm font-semibold text-orange-700 uppercase tracking-wide">Rôle</p>
                </div>
                <p className="text-lg text-gray-900 font-medium">
                  {(() => {
                    const type = stagiaire.typeStagiaire || stagiaire.type_stagiaire;
                    if (!type) return 'Stagiaire';
                    if (type === 'SECRETAIRE_MEDICAL' || type === 'Secrétaire médical') return 'Secrétaire médical';
                    if (type === 'AMA' || type === 'Assistant médico-administratif (AMA)') return 'Assistant médico-administratif (AMA)';
                    if (type === 'AUTRE' || type === 'Autre type de stagiaire') return 'Autre';
                    return 'Stagiaire';
                  })()}
                </p>
              </div>

              {/* Section */}
              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-5 border border-indigo-200 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-rounded text-indigo-600 text-xl">school</span>
                  <p className="text-sm font-semibold text-indigo-700 uppercase tracking-wide">Section</p>
                </div>
                <p className="text-lg text-gray-900 font-medium">{stagiaire.section || <span className="text-gray-400 italic">Non renseignée</span>}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            icon="people"
            label="Patients créés"
            value={patients.length}
            color="orange"
          />
          <StatCard
            icon="analytics"
            label="Actions totales"
            value={stagiaire.nbActions || 0}
            color="purple"
          />
          <StatCard
            icon="activity"
            label="Activité récente"
            value={activite.length}
            color="blue"
          />
        </div>

        {/* Notes du formateur */}
        <div className="mt-8 mb-8 bg-blue-50 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-blue-200">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-medium text-gray-900">Notes du formateur</h3>
              <button
                onClick={() => setShowNoteForm(!showNoteForm)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
              >
                {showNoteForm ? 'Annuler' : 'Nouvelle note'}
              </button>
            </div>
          </div>
          <div className="p-6">
            {noteError && <ErrorMessage message={noteError} />}
            {showNoteForm && (
              <div className="mb-6">
                <NoteForm
                  stagiaireId={stagiaireId}
                  stagiaireName={stagiaire ? `${stagiaire.prenom} ${stagiaire.nom}` : ''}
                  onSubmit={handleCreateNote}
                  onCancel={() => {
                    setShowNoteForm(false);
                    setNoteError('');
                  }}
                />
              </div>
            )}
            <NotesList
              notes={notes}
              loading={notesLoading}
              canDelete={true}
              onDelete={handleDeleteNote}
            />
          </div>
        </div>

        <div className="space-y-8">
          {/* Patients créés */}
          <div className="bg-orange-50 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-orange-200">
              <h3 className="text-2xl font-medium text-gray-900">Patients créés</h3>
              <p className="text-sm text-gray-500">{patients.length} patients</p>
            </div>
            <div className="p-6">
              {patients.length > 0 ? (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {patients.map((patient) => {
                    const patientId = patient.id || patient['@id']?.split('/').pop();
                    const prenom = patient.prenom || '';
                    const nom = patient.nom || '';
                    const email = patient.email || '';
                    const createdAt = patient.createdAt || patient.created_at || '';
                    return (
                      <div key={patientId || patient['@id']} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-orange-100 transition-colors">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-orange-600">
                              {prenom?.charAt(0)?.toUpperCase() || ''}{nom?.charAt(0)?.toUpperCase() || ''}
                            </span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            <PatientName patient={patient} showGenre={false} />
                          </p>
                          {email && (
                            <p className="text-sm text-gray-500">{email}</p>
                          )}
                          {createdAt && (
                            <p className="text-xs text-gray-400">
                              Créé le {formatDateTime(createdAt)}
                            </p>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          <Link
                            to={`/patients/${patientId}`}
                            className="text-orange-600 hover:text-orange-800 text-sm font-medium"
                          >
                            Voir →
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">Aucun patient créé</p>
              )}
            </div>
          </div>

          {/* Activité récente */}
          <div className="bg-blue-50 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-blue-200">
              <h3 className="text-2xl font-medium text-gray-900">Activité récente</h3>
              <p className="text-sm text-gray-500">50 dernières actions</p>
            </div>
            <div className="divide-y divide-gray-200">
              {activite.length > 0 ? (
                activite.map((log, index) => (
                  <div
                    key={log.id || `${log.entityId || log.entity_id || 'log'}-${index}`}
                    className={`px-6 py-4 cursor-pointer border-l-4 ${getActionRowClassWithBg(log.action)}`}
                  >
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        <span className={`material-symbols-rounded text-4xl ${getActionIconClass(log.action)}`}>
                          {auditService.getActionIcon(log.action)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-shrink-0">
                            <p className="text-sm font-medium text-gray-900">
                              {log.user?.full_name || (log.user?.prenom || log.user?.nom ? `${log.user.prenom || ''} ${log.user.nom || ''}`.trim() : 'Anonyme')}
                            </p>
                            <p className="text-sm text-gray-500">{log.user?.email || ''}</p>
                          </div>
                          <div className="flex-1 flex flex-col justify-center mx-4 min-w-0">
                            {getEnrichedMessage(log) && (
                              <p className="text-sm text-gray-900 text-center break-words whitespace-normal">{getEnrichedMessage(log)}</p>
                            )}
                            <div className="text-center mt-1">
                              <p className="text-xs text-gray-500">
                                {formatEntityName(log.entityType)} {log.entityId && `(ID: ${log.entityId.substring(0, 8)}...)`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 flex-shrink-0">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionBadgeClass(log.action)}`}>
                              {getActionLabel(log.action)}
                            </span>
                            <span className="text-xs text-gray-400 whitespace-nowrap">
                              {formatDateTime(log.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-6 py-12 text-center">
                  <div className="text-gray-400 text-4xl mb-4">📋</div>
                  <h3 className="text-2xl font-medium text-gray-900 mb-2">Aucune activité récente</h3>
                  <p className="text-gray-500">
                    Aucune action enregistrée pour ce stagiaire.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Statistiques détaillées */}
        {stats && (
          <div className="mt-8 bg-blue-50 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-blue-200">
              <h3 className="text-2xl font-medium text-gray-900">Statistiques détaillées</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {Object.entries(stats).map(([key, value]) => (
                  <div key={key} className="text-center">
                    <p className="text-2xl font-semibold text-gray-900">{value}</p>
                    <p className="text-sm text-gray-500 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}


      </div>
    </div>
  );
};

export default StagiaireDetails;
