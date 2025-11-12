import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import formateurService from '../../_services/formateur.service';
import auditService from '../../_services/audit.service';
import stagiaireNoteService from '../../_services/stagiaire-note.service';
import LoadingSpinner from '../../components/LoadingSpinner';
import NotesList from '../../components/NotesList';
import NoteForm from '../../components/NoteForm';
import ErrorMessage from '../../components/ErrorMessage';

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
        // Charger les données en parallèle pour éviter les requêtes en cascade
        const [data] = await Promise.all([
          formateurService.getStagiaireDetails(stagiaireId),
          loadNotes() // Charger les notes en parallèle (loadNotes est async)
        ]);
        setStagiaire(data.stagiaire);
        setActivite(Array.isArray(data.logs) ? data.logs : []);
        setPatients(Array.isArray(data.patients) ? data.patients : []);
        setStats(data.stats || null);
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

  const formatDate = (dateString) => {
    if (!dateString) return 'Jamais';
    return new Date(dateString).toLocaleString('fr-FR');
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

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-500 text-center p-4">{error}</div>;
  if (!stagiaire) return <div className="text-center p-4">Stagiaire non trouvé</div>;

  return (
    <div className="space-y-6 bg-indigo-100 min-h-screen p-6">
      {/* Header */}
      <div className="bg-blue-200 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-blue-800">
                {stagiaire.prenom} {stagiaire.nom}
              </h1>
              <p className="text-gray-600">Détails et activité du stagiaire</p>
            </div>
            <div className="flex space-x-4">
              <Link
                to="/formateur/stagiaires"
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Retour à la liste
              </Link>
              <Link
                to={`/formateur/logs?user_id=${stagiaire.id}`}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                Voir tous les logs
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Informations générales */}
        <div className="bg-blue-50 rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-blue-200">
            <h3 className="text-lg font-medium text-gray-900">Informations du stagiaire</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <p className="text-sm font-medium text-gray-500">Nom complet</p>
                <p className="text-lg text-gray-900">{stagiaire.prenom} {stagiaire.nom}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Email</p>
                <p className="text-lg text-gray-900">{stagiaire.email}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Dernière activité</p>
                <p className="text-lg text-gray-900">{formatDate(stagiaire.derniereActivite)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Rôles</p>
                <div className="flex space-x-2">
                  {stagiaire.roles?.map((role) => (
                    <span key={role} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-blue-50 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 text-sm font-medium">🏥</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Patients créés</p>
                <p className="text-2xl font-semibold text-gray-900">{stagiaire.nbPatients || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-purple-600 text-sm font-medium">📊</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Actions totales</p>
                <p className="text-2xl font-semibold text-gray-900">{stagiaire.nbActions || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 text-sm font-medium">⚡</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Activité récente</p>
                <p className="text-2xl font-semibold text-gray-900">{activite.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Activité récente */}
          <div className="bg-blue-50 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-blue-200">
              <h3 className="text-lg font-medium text-gray-900">Activité récente</h3>
              <p className="text-sm text-gray-500">50 dernières actions</p>
            </div>
            <div className="p-6">
              {activite.length > 0 ? (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {activite.map((log) => (
                    <div key={log.id} className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <span className="text-lg">{getActionIcon(log.action)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium text-gray-900">
                            {log.message || getActionLabel(log.action)}
                          </p>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-${getActionColor(log.action)}-100 text-${getActionColor(log.action)}-800`}>
                            {auditService.formatEntityType(log.entityType || log.entity_type)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">
                          {log.entityId || log.entity_id ? `ID: ${log.entityId || log.entity_id}` : 'Système'}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatDate(log.createdAt || log.created_at)}
                        </p>
                        {log.ip && (
                          <p className="text-xs text-gray-400 font-mono">
                            IP: {log.ip}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">Aucune activité récente</p>
              )}
            </div>
          </div>

          {/* Patients créés */}
          <div className="bg-blue-50 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-blue-200">
              <h3 className="text-lg font-medium text-gray-900">Patients créés</h3>
              <p className="text-sm text-gray-500">{patients.length} patients</p>
            </div>
            <div className="p-6">
              {patients.length > 0 ? (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {patients.map((patient) => (
                    <div key={patient.id} className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-600">
                            {patient.prenom?.charAt(0)}{patient.nom?.charAt(0)}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {patient.prenom} {patient.nom}
                        </p>
                        <p className="text-sm text-gray-500">{patient.email}</p>
                        <p className="text-xs text-gray-400">
                          Créé le {formatDate(patient.createdAt)}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        <Link
                          to={`/patients/${patient.id}`}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Voir
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">Aucun patient créé</p>
              )}
            </div>
          </div>
        </div>

        {/* Statistiques détaillées */}
        {stats && (
          <div className="mt-8 bg-blue-50 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-blue-200">
              <h3 className="text-lg font-medium text-gray-900">Statistiques détaillées</h3>
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

        {/* Notes du formateur */}
        <div className="mt-8 bg-blue-50 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-blue-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Notes du formateur</h3>
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
      </div>
    </div>
  );
};

export default StagiaireDetails;
