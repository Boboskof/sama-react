import React, { useState, useMemo } from 'react';
import { useFormateurExercises, usePublishExercise, useAssignExercise, useExerciseAssignments, useCreateExercise, useUpdateExercise, useFormateurExerciseDetail } from '../../hooks/useExercises';
import { useStagiaires } from '../../hooks/useStagiaires';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import { Link, useNavigate } from 'react-router-dom';
import { formatDateTime } from '../../utils/dateHelpers';

const FormateurExercises = () => {
  const navigate = useNavigate();
  const [ccpFilter, setCcpFilter] = useState(undefined);
  const [showPublishedOnly, setShowPublishedOnly] = useState(false);
  const [expandedExerciseId, setExpandedExerciseId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editExerciseId, setEditExerciseId] = useState(null);

  const { data: exercises = [], isLoading, error } = useFormateurExercises({
    ccp: ccpFilter,
    published: showPublishedOnly ? true : undefined,
  });

  const { data: stagiaires = [], isLoading: stagiairesLoading } = useStagiaires();

  const publishMutation = usePublishExercise();
  const assignMutation = useAssignExercise();
  const createMutation = useCreateExercise();
  const updateMutation = useUpdateExercise();

  const [assignState, setAssignState] = useState({
    exerciseId: null,
    selectedStagiaireIds: [],
    dueAt: '',
  });

  const [stagiaireSearch, setStagiaireSearch] = useState('');

  // Filtrer les stagiaires selon la recherche
  const filteredStagiaires = useMemo(() => {
    if (!stagiaireSearch.trim()) return stagiaires;
    
    const searchLower = stagiaireSearch.toLowerCase();
    return stagiaires.filter(s => {
      const prenom = (s.prenom || '').toLowerCase();
      const nom = (s.nom || '').toLowerCase();
      const email = (s.email || '').toLowerCase();
      const fullName = `${prenom} ${nom}`.toLowerCase();
      
      return prenom.includes(searchLower) || 
             nom.includes(searchLower) || 
             email.includes(searchLower) ||
             fullName.includes(searchLower);
    });
  }, [stagiaires, stagiaireSearch]);

  const handlePublish = (id) => {
    if (publishMutation.isLoading) return;
    publishMutation.mutate(id);
  };

  const toggleStagiaireSelection = (stagiaireId) => {
    setAssignState(prev => {
      const selected = prev.selectedStagiaireIds || [];
      const isSelected = selected.includes(stagiaireId);
      
      return {
        ...prev,
        selectedStagiaireIds: isSelected
          ? selected.filter(id => id !== stagiaireId)
          : [...selected, stagiaireId],
      };
    });
  };

  const handleSelectAllStagiaires = () => {
    const allIds = filteredStagiaires.map(s => s.id);
    const allSelected = allIds.every(id => assignState.selectedStagiaireIds.includes(id));
    
    setAssignState(prev => ({
      ...prev,
      selectedStagiaireIds: allSelected ? [] : allIds,
    }));
  };

  const handleAssign = (e) => {
    e.preventDefault();
    if (!assignState.exerciseId || assignState.selectedStagiaireIds.length === 0) return;

    assignMutation.mutate(
      {
        id: assignState.exerciseId,
        stagiaireIds: assignState.selectedStagiaireIds,
        dueAt: assignState.dueAt || undefined,
      },
      {
        onSuccess: () => {
          setAssignState({ exerciseId: null, selectedStagiaireIds: [], dueAt: '' });
          setStagiaireSearch('');
        },
      },
    );
  };

  const handleOpenAssignModal = (exerciseId) => {
    setAssignState(prev => ({
      ...prev,
      exerciseId,
      selectedStagiaireIds: [],
      dueAt: '',
    }));
    setStagiaireSearch('');
  };

  const getSelectedExercise = () => {
    if (!assignState.exerciseId) return null;
    return exercises.find(ex => ex.id === assignState.exerciseId);
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6 bg-indigo-100 min-h-screen w-[95%] md:w-[90%] lg:w-[80%] mx-auto px-2 md:px-4 py-6">
      <div className="text-center py-6 mb-0">
        <div className="bg-blue-200 rounded-lg shadow p-6 max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center shadow-sm">
              <span className="material-symbols-rounded text-blue-600 text-3xl">quiz</span>
            </div>
            <h1 className="text-2xl font-bold text-blue-800">Atelier d&apos;exercices</h1>
          </div>
          <p className="text-blue-700 text-sm">
            Gérez vos exercices, publiez-les et assignez-les à vos stagiaires
          </p>
        </div>
      </div>

      {error && (
        <ErrorMessage
          message={String(error)}
          title="Erreur de chargement"
          dismissible={false}
        />
      )}

      {/* Filtres simples */}
      <div className="bg-white rounded-lg shadow p-4 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Filtrer par CCP
          </label>
          <input
            type="text"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="CCP1, CCP2..."
            value={ccpFilter || ''}
            onChange={(e) => setCcpFilter(e.target.value || undefined)}
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-gray-800">
          <input
            type="checkbox"
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            checked={showPublishedOnly}
            onChange={(e) => setShowPublishedOnly(e.target.checked)}
          />
          <span>Afficher uniquement les exercices publiés</span>
        </label>
      </div>

      {/* Liste des exercices */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Mes exercices</h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {exercises.length} exercice{exercises.length > 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-rounded text-white text-xl">add</span>
              Nouveau exercice
            </button>
          </div>
        </div>
        {exercises.length === 0 ? (
          <div className="px-6 py-10 text-center text-gray-500">
            Aucun exercice pour le moment.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {exercises.map((ex) => {
              const isExpanded = expandedExerciseId === ex.id;
              
              return (
                <div key={ex.id} className="px-6 py-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {ex.title}
                      </p>
                      {ex.description && (
                        <p className="text-xs text-gray-600 truncate">
                          {ex.description}
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                          {ex.type}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                          Difficulté {ex.difficulty}
                        </span>
                        {ex.estimatedDurationMinutes && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                            ~{ex.estimatedDurationMinutes} min
                          </span>
                        )}
                        {ex.ccpCode && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                            CCP {ex.ccpCode}
                          </span>
                        )}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full ${
                          ex.isPublished
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {ex.isPublished ? 'Publié' : 'Brouillon'}
                        </span>
                        {/* Statistiques de réutilisation */}
                        {(ex.assignmentsCount !== undefined || ex.submissionsCount !== undefined) && (
                          <>
                            {ex.assignmentsCount !== undefined && ex.assignmentsCount > 0 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-50 text-purple-700" title="Nombre d'assignations">
                                👥 {ex.assignmentsCount}
                              </span>
                            )}
                            {ex.submissionsCount !== undefined && ex.submissionsCount > 0 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700" title="Nombre de copies rendues">
                                📝 {ex.submissionsCount}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedExerciseId(isExpanded ? null : ex.id)}
                        className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs text-gray-700 hover:bg-gray-50"
                      >
                        {isExpanded ? 'Masquer' : 'Voir détails'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditExerciseId(ex.id)}
                        className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs text-gray-700 hover:bg-gray-50"
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenAssignModal(ex.id)}
                        disabled={!ex.isPublished}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={!ex.isPublished ? 'Publiez d\'abord l\'exercice pour pouvoir l\'assigner' : 'Assigner cet exercice à des stagiaires'}
                      >
                        Assigner
                      </button>
                      {!ex.isPublished && (
                        <button
                          type="button"
                          onClick={() => handlePublish(ex.id)}
                          disabled={publishMutation.isLoading}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Publier
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Section détails/assignations (expandable) */}
                  {isExpanded && (
                    <ExerciseDetails
                      exercise={ex}
                      onAssign={() => handleOpenAssignModal(ex.id)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal d'assignation améliorée */}
      {assignState.exerciseId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Assigner un exercice
                </h3>
                {getSelectedExercise() && (
                  <p className="text-sm text-gray-600 mt-1">
                    {getSelectedExercise().title}
                  </p>
                )}
              </div>
              <button
                onClick={() => setAssignState({ exerciseId: null, selectedStagiaireIds: [], dueAt: '' })}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="material-symbols-rounded text-2xl">close</span>
              </button>
            </div>
            
            <form onSubmit={handleAssign} className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Recherche de stagiaires */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rechercher un stagiaire
                </label>
                <input
                  type="text"
                  value={stagiaireSearch}
                  onChange={(e) => setStagiaireSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Nom, prénom ou email..."
                />
              </div>

              {/* Liste des stagiaires avec sélection multiple */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Stagiaires ({assignState.selectedStagiaireIds.length} sélectionné{assignState.selectedStagiaireIds.length > 1 ? 's' : ''})
                  </label>
                  <button
                    type="button"
                    onClick={handleSelectAllStagiaires}
                    className="text-xs text-indigo-600 hover:text-indigo-800"
                  >
                    {filteredStagiaires.every(s => assignState.selectedStagiaireIds.includes(s.id))
                      ? 'Tout désélectionner'
                      : 'Tout sélectionner'}
                  </button>
                </div>
                <div className="border border-gray-300 rounded-lg max-h-64 overflow-y-auto">
                  {stagiairesLoading ? (
                    <div className="p-4 text-center text-gray-500">Chargement des stagiaires...</div>
                  ) : filteredStagiaires.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      {stagiaireSearch ? 'Aucun stagiaire trouvé' : 'Aucun stagiaire disponible'}
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {filteredStagiaires.map((stagiaire) => {
                        const isSelected = assignState.selectedStagiaireIds.includes(stagiaire.id);
                        return (
                          <label
                            key={stagiaire.id}
                            className={`flex items-center px-4 py-3 cursor-pointer hover:bg-gray-50 ${
                              isSelected ? 'bg-indigo-50' : ''
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleStagiaireSelection(stagiaire.id)}
                              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                            <div className="ml-3 flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                {stagiaire.prenom} {stagiaire.nom}
                              </p>
                              {stagiaire.email && (
                                <p className="text-xs text-gray-500">{stagiaire.email}</p>
                              )}
                              {stagiaire.section && (
                                <p className="text-xs text-gray-400">Section: {stagiaire.section}</p>
                              )}
                            </div>
                            {isSelected && (
                              <span className="text-indigo-600">
                                <span className="material-symbols-rounded text-xl">check_circle</span>
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Date limite */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  À rendre avant (optionnel)
                </label>
                <input
                  type="datetime-local"
                  value={assignState.dueAt}
                  onChange={(e) =>
                    setAssignState((prev) => ({
                      ...prev,
                      dueAt: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Laissez vide pour ne pas définir de date limite
                </p>
              </div>

              {/* Messages d'erreur ou de succès */}
              {assignMutation.isError && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
                  {assignMutation.error?.message || 'Erreur lors de l\'assignation'}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setAssignState({ exerciseId: null, selectedStagiaireIds: [], dueAt: '' })}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  disabled={assignMutation.isLoading}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={
                    assignState.selectedStagiaireIds.length === 0 ||
                    assignMutation.isLoading
                  }
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {assignMutation.isLoading ? 'Assignation...' : `Assigner à ${assignState.selectedStagiaireIds.length} stagiaire${assignState.selectedStagiaireIds.length > 1 ? 's' : ''}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de création d'exercice */}
      {showCreateModal && (
        <CreateExerciseModal
          onClose={() => setShowCreateModal(false)}
          onCreateSuccess={(exerciseId) => {
            setShowCreateModal(false);
            // Optionnel : rediriger vers une page d'édition ou juste rafraîchir la liste
            // navigate(`/formateur/exercises/${exerciseId}/edit`);
          }}
          createMutation={createMutation}
        />
      )}

      {/* Modal d'édition d'exercice */}
      {editExerciseId && (
        <EditExerciseModal
          exerciseId={editExerciseId}
          onClose={() => setEditExerciseId(null)}
          onUpdateSuccess={() => {
            setEditExerciseId(null);
          }}
          updateMutation={updateMutation}
        />
      )}
    </div>
  );
};

// Composant pour afficher les détails d'un exercice (assignations, etc.)
const ExerciseDetails = ({ exercise, onAssign }) => {
  // Essayer de récupérer les assignations depuis le détail de l'exercice d'abord
  const { data: exerciseDetail, isLoading: detailLoading } = useFormateurExerciseDetail(
    exercise.id,
    true,
  );
  
  // Essayer aussi l'endpoint dédié (peut retourner 404 si non disponible)
  const { data: assignmentsData, isLoading: assignmentsLoading, error: assignmentsError } = useExerciseAssignments(
    exercise.id,
    true,
  );

  // Prioriser les assignations du détail de l'exercice, sinon utiliser l'endpoint dédié
  // L'endpoint retourne { data: [...], statistics: {...} } ou { assignments: [...], statistics: {...} }
  const assignments = exerciseDetail?.assignments || assignmentsData?.data || assignmentsData?.assignments || [];
  // Récupérer les statistiques de l'API si disponibles (depuis assignmentsData directement ou depuis data.statistics)
  const apiStatistics = assignmentsData?.statistics;
  const isLoading = detailLoading || assignmentsLoading;
  
  // Logger les erreurs de chargement des assignations
  React.useEffect(() => {
    if (assignmentsError) {
      console.warn('Erreur chargement assignations (endpoint dédié):', assignmentsError);
    }
  }, [assignmentsError]);

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <h4 className="font-semibold text-gray-700 mb-2">Informations</h4>
          <ul className="space-y-1 text-sm text-gray-600">
            <li><strong>Type:</strong> {exercise.type}</li>
            <li><strong>Difficulté:</strong> {exercise.difficulty}/5</li>
            {exercise.estimatedDurationMinutes && (
              <li><strong>Durée estimée:</strong> {exercise.estimatedDurationMinutes} minutes</li>
            )}
            {exercise.ccpCode && (
              <li><strong>CCP:</strong> {exercise.ccpCode}</li>
            )}
            <li><strong>Statut:</strong> {exercise.isPublished ? 'Publié' : 'Brouillon'}</li>
            {exercise.createdAt && (
              <li><strong>Créé le:</strong> {new Date(exercise.createdAt).toLocaleDateString('fr-FR')}</li>
            )}
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-gray-700 mb-2">Réutilisation</h4>
          <ul className="space-y-1 text-sm text-gray-600">
            <li>
              <strong>Assignations:</strong>{' '}
              <span className={(exercise.assignmentsCount || assignments.length) > 0 ? 'text-purple-700 font-medium' : 'text-gray-500'}>
                {exercise.assignmentsCount !== undefined ? exercise.assignmentsCount : assignments.length}
              </span>
            </li>
            <li>
              <strong>Copies rendues:</strong>{' '}
              <span className={(apiStatistics?.totalSubmissions || exercise.submissionsCount || assignments.filter(a => a.hasSubmission || a.lastSubmission || a.submission).length) > 0 ? 'text-blue-700 font-medium' : 'text-gray-500'}>
                {apiStatistics?.totalSubmissions !== undefined 
                  ? apiStatistics.totalSubmissions 
                  : exercise.submissionsCount !== undefined 
                    ? exercise.submissionsCount 
                    : assignments.filter(a => a.hasSubmission || a.lastSubmission || a.submission).length}
              </span>
            </li>
            {(() => {
              const totalAssignments = apiStatistics?.totalAssignments !== undefined 
                ? apiStatistics.totalAssignments 
                : exercise.assignmentsCount !== undefined 
                  ? exercise.assignmentsCount 
                  : assignments.length;
              const totalSubmissions = apiStatistics?.totalSubmissions !== undefined 
                ? apiStatistics.totalSubmissions 
                : exercise.submissionsCount !== undefined 
                  ? exercise.submissionsCount 
                  : assignments.filter(a => a.hasSubmission || a.lastSubmission || a.submission).length;
              if (totalAssignments > 0) {
                return (
                  <li>
                    <strong>Taux de complétion:</strong>{' '}
                    <span className={totalSubmissions === totalAssignments ? 'text-green-700 font-medium' : 'text-orange-700 font-medium'}>
                      {Math.round((totalSubmissions / totalAssignments) * 100)}%
                    </span>
                  </li>
                );
              }
              return null;
            })()}
          </ul>
        </div>
      </div>

      {/* Liste des assignations */}
      {isLoading ? (
        <div className="mt-4 text-center text-gray-500 text-sm">
          <LoadingSpinner color="indigo" size="small" inline={true} />
          <span className="ml-2">Chargement des assignations...</span>
        </div>
      ) : assignmentsError && assignmentsError?.response?.status === 404 ? (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800 font-medium mb-2">
            ℹ️ Endpoint des assignations non disponible
          </p>
          <p className="text-xs text-blue-700 mb-3">
            L'endpoint pour récupérer la liste détaillée des assignations n'est pas encore implémenté côté backend.
            {exercise.assignmentsCount !== undefined && exercise.assignmentsCount > 0 && (
              <span className="block mt-2">
                Statistiques disponibles : <strong>{exercise.assignmentsCount}</strong> assignation{exercise.assignmentsCount > 1 ? 's' : ''}, 
                <strong> {exercise.submissionsCount || 0}</strong> copie{exercise.submissionsCount !== 1 ? 's' : ''} rendue{exercise.submissionsCount !== 1 ? 's' : ''}.
              </span>
            )}
          </p>
          <p className="text-xs text-blue-600">
            Les assignations sont bien enregistrées dans la base de données, mais nécessitent l'implémentation de l'endpoint 
            <code className="bg-blue-100 px-1 rounded">GET /api/formateurs/exercises/{'{id}'}/assignments</code> pour être affichées ici.
          </p>
        </div>
      ) : assignmentsError ? (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            ⚠️ Erreur lors du chargement des assignations. Vérifiez la console pour plus de détails.
          </p>
          <p className="text-xs text-yellow-600 mt-1">
            Les assignations peuvent être visibles dans la base de données mais l'endpoint API pourrait ne pas être disponible.
          </p>
        </div>
      ) : assignments.length > 0 ? (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-gray-700">Assignations ({assignments.length})</h4>
            <button
              onClick={onAssign}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              + Assigner à d'autres stagiaires
            </button>
          </div>
          <div className="bg-gray-50 rounded-lg divide-y divide-gray-200 max-h-64 overflow-y-auto">
            {assignments.map((assignment) => {
              const stagiaire = assignment.stagiaire;
              // Supporte plusieurs formats : lastSubmission (nouveau format API), submission (ancien format), ou hasSubmission
              const submission = assignment.lastSubmission || assignment.submission;
              const hasSubmission = assignment.hasSubmission || !!submission;
              const isDone = assignment.status === 'DONE';
              const isInProgress = assignment.status === 'IN_PROGRESS';
              
              return (
                <div key={assignment.id} className="p-3 hover:bg-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {stagiaire.prenom} {stagiaire.nom}
                      </p>
                      {stagiaire.email && (
                        <p className="text-xs text-gray-500">{stagiaire.email}</p>
                      )}
                      <div className="mt-1 flex flex-wrap gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          isDone
                            ? 'bg-green-100 text-green-800'
                            : isInProgress
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {isDone ? '✓ Terminé' : isInProgress ? '⏳ En cours' : '📋 Assigné'}
                        </span>
                        {assignment.dueAt && (
                          <span className="text-xs text-gray-600">
                            Échéance: {formatDateTime(assignment.dueAt)}
                          </span>
                        )}
                        {submission && submission.submittedAt && (
                          <span className="text-xs text-gray-600">
                            Rendu le: {formatDateTime(submission.submittedAt)}
                          </span>
                        )}
                      </div>
                      {hasSubmission && submission && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-gray-600">
                            Score: <strong>{submission.finalScore !== null && submission.finalScore !== undefined ? submission.finalScore : submission.autoScore || 0}</strong>/{submission.maxScore || '?'}
                          </span>
                          {submission.id && (
                            <Link
                              to={`/formateur/submissions/${submission.id}`}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                              Voir la copie →
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-4 text-center text-gray-500 text-sm py-4 bg-gray-50 rounded-lg">
          <p>Aucune assignation pour cet exercice.</p>
          <button
            onClick={onAssign}
            className="mt-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Assigner cet exercice →
          </button>
        </div>
      )}
    </div>
  );
};

// Composant modal pour créer un exercice
const CreateExerciseModal = ({ onClose, onCreateSuccess, createMutation }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'CAS_PRATIQUE',
    difficulty: 3,
    estimatedDurationMinutes: '',
    ccpCode: '',
    competences: '',
    isPublished: false,
    questions: [],
  });

  const [formErrors, setFormErrors] = useState({});

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Effacer l'erreur du champ modifié
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const parseCompetences = (competencesStr) => {
    if (!competencesStr.trim()) return [];
    
    try {
      // Essayer de parser comme JSON
      const parsed = JSON.parse(competencesStr);
      return Array.isArray(parsed) ? parsed : [competencesStr];
    } catch {
      // Sinon, traiter comme une liste séparée par des lignes ou virgules
      return competencesStr
        .split(/[\n,;]/)
        .map(s => s.trim())
        .filter(Boolean);
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.title.trim()) {
      errors.title = 'Le titre est obligatoire';
    }
    
    if (!formData.type) {
      errors.type = 'Le type d\'exercice est obligatoire';
    }
    
    if (!formData.difficulty || formData.difficulty < 1 || formData.difficulty > 5) {
      errors.difficulty = 'La difficulté doit être entre 1 et 5';
    }
    
    if (formData.estimatedDurationMinutes && (isNaN(formData.estimatedDurationMinutes) || formData.estimatedDurationMinutes < 1)) {
      errors.estimatedDurationMinutes = 'La durée doit être un nombre positif';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        type: formData.type,
        difficulty: parseInt(formData.difficulty, 10),
        estimatedDurationMinutes: formData.estimatedDurationMinutes ? parseInt(formData.estimatedDurationMinutes, 10) : null,
        ccpCode: formData.ccpCode.trim() || null,
        competences: parseCompetences(formData.competences),
        isPublished: formData.isPublished,
        questions: formData.questions.map((q, index) => ({
          position: q.position || index + 1,
          type: q.type,
          prompt: q.prompt,
          maxScore: q.maxScore,
          config: q.config,
        })),
      };

      const result = await createMutation.mutateAsync(payload);
      
      if (result?.id) {
        onCreateSuccess(result.id);
      } else {
        onCreateSuccess(null);
      }
    } catch (error) {
      console.error('Erreur lors de la création de l\'exercice:', error);
      setFormErrors({
        submit: error?.response?.data?.message || error?.message || 'Erreur lors de la création de l\'exercice',
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">
              Créer un nouvel exercice
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Remplissez les informations de base et ajoutez les questions.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={createMutation.isLoading}
          >
            <span className="material-symbols-rounded text-2xl">close</span>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Erreur globale */}
          {formErrors.submit && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
              {formErrors.submit}
            </div>
          )}

          {/* Section 1 : Informations générales */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Informations générales</h4>
            <div className="space-y-4">
              {/* Titre */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Titre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    formErrors.title ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Ex: Vérifier une identité à l'accueil"
                />
                {formErrors.title && (
                  <p className="text-xs text-red-600 mt-1">{formErrors.title}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description / Énoncé <span className="text-gray-400 text-xs">(recommandé)</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Décrivez le cas concret en français. C'est ici que vous posez le contexte pour le stagiaire..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Décrivez le contexte, les éléments fournis, et ce que le stagiaire doit faire.
                </p>
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type d'exercice <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => handleInputChange('type', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    formErrors.type ? 'border-red-300' : 'border-gray-300'
                  }`}
                >
                  <option value="QCM">QCM - Questions à choix multiples</option>
                  <option value="CAS_PRATIQUE">CAS_PRATIQUE - Cas pratique avec questions ouvertes</option>
                  <option value="TRANSCRIPTION">TRANSCRIPTION - Transcription d'un appel ou d'un document</option>
                  <option value="ETUDE_DOCUMENT">ETUDE_DOCUMENT - Analyse d'un document médical</option>
                </select>
                {formErrors.type && (
                  <p className="text-xs text-red-600 mt-1">{formErrors.type}</p>
                )}
              </div>

              {/* Difficulté et Durée */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Difficulté <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.difficulty}
                    onChange={(e) => handleInputChange('difficulty', parseInt(e.target.value, 10))}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      formErrors.difficulty ? 'border-red-300' : 'border-gray-300'
                    }`}
                  >
                    <option value={1}>1 - Très facile (débutant)</option>
                    <option value={2}>2 - Facile</option>
                    <option value={3}>3 - Moyen</option>
                    <option value={4}>4 - Difficile</option>
                    <option value={5}>5 - Très difficile (expert)</option>
                  </select>
                  {formErrors.difficulty && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.difficulty}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Durée estimée (minutes) <span className="text-gray-400 text-xs">(optionnel)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.estimatedDurationMinutes}
                    onChange={(e) => handleInputChange('estimatedDurationMinutes', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      formErrors.estimatedDurationMinutes ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Ex: 20"
                  />
                  {formErrors.estimatedDurationMinutes && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.estimatedDurationMinutes}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2 : Métadonnées pédagogiques */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Métadonnées pédagogiques</h4>
            <div className="space-y-4">
              {/* CCP Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CCP Code <span className="text-gray-400 text-xs">(recommandé)</span>
                </label>
                <input
                  type="text"
                  value={formData.ccpCode}
                  onChange={(e) => handleInputChange('ccpCode', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ex: CCP1, CCP2..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Associez votre exercice à un Certificat de Compétences Professionnelles (ex: CCP1 pour Accueil du patient)
                </p>
              </div>

              {/* Compétences */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Compétences <span className="text-gray-400 text-xs">(recommandé)</span>
                </label>
                <textarea
                  value={formData.competences}
                  onChange={(e) => handleInputChange('competences', e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                  placeholder="Une compétence par ligne ou format JSON:&#10;[\n  &quot;Vérifier la complétude d'un dossier&quot;,\n  &quot;Identifier les documents manquants&quot;\n]"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Liste les compétences fines travaillées. Une compétence par ligne ou format JSON array.
                </p>
              </div>
            </div>
          </div>

          {/* Section 3 : Questions */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">
                Questions ({formData.questions.length})
              </h4>
              <button
                type="button"
                onClick={() => {
                  const newQuestion = {
                    position: formData.questions.length + 1,
                    type: 'QCM',
                    prompt: '',
                    maxScore: 1,
                    config: {
                      options: [],
                      correctAnswers: [],
                      scoring: {
                        mode: 'all_or_nothing',
                        points_if_correct: 1,
                        points_if_wrong: 0,
                      },
                    },
                  };
                  handleInputChange('questions', [...formData.questions, newQuestion]);
                }}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 flex items-center gap-2"
              >
                <span className="material-symbols-rounded text-lg">add</span>
                Ajouter une question
              </button>
            </div>
            
            {formData.questions.length === 0 ? (
              <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500 text-sm">
                Aucune question pour le moment. Cliquez sur "Ajouter une question" pour commencer.
              </div>
            ) : (
              <div className="space-y-4">
                {formData.questions.map((q, index) => (
                  <QuestionEditor
                    key={q.id || index}
                    question={q}
                    index={index}
                    onUpdate={(updatedQuestion) => {
                      const newQuestions = [...formData.questions];
                      newQuestions[index] = updatedQuestion;
                      handleInputChange('questions', newQuestions);
                    }}
                    onDelete={() => {
                      const newQuestions = formData.questions.filter((_, i) => i !== index);
                      newQuestions.forEach((q, i) => {
                        q.position = i + 1;
                      });
                      handleInputChange('questions', newQuestions);
                    }}
                    onMoveUp={index > 0 ? () => {
                      const newQuestions = [...formData.questions];
                      [newQuestions[index - 1], newQuestions[index]] = [newQuestions[index], newQuestions[index - 1]];
                      newQuestions.forEach((q, i) => {
                        q.position = i + 1;
                      });
                      handleInputChange('questions', newQuestions);
                    } : null}
                    onMoveDown={index < formData.questions.length - 1 ? () => {
                      const newQuestions = [...formData.questions];
                      [newQuestions[index], newQuestions[index + 1]] = [newQuestions[index + 1], newQuestions[index]];
                      newQuestions.forEach((q, i) => {
                        q.position = i + 1;
                      });
                      handleInputChange('questions', newQuestions);
                    } : null}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Section 4 : Statut de publication */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Statut de publication</h4>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isPublished}
                onChange={(e) => handleInputChange('isPublished', e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Publier l'exercice</span>
                <p className="text-xs text-gray-500">
                  {formData.isPublished 
                    ? 'L\'exercice sera visible et assignable aux stagiaires immédiatement après création'
                    : 'L\'exercice sera créé en brouillon (non assignable). Vous pourrez le publier après la création.'}
                </p>
              </div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={createMutation.isLoading}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={createMutation.isLoading}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {createMutation.isLoading ? (
                <>
                  <LoadingSpinner color="white" size="small" inline={true} />
                  <span className="ml-2">Création...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-rounded text-xl">save</span>
                  Créer l'exercice
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Composant modal pour modifier un exercice existant
const EditExerciseModal = ({ exerciseId, onClose, onUpdateSuccess, updateMutation }) => {
  const { data: exercise, isLoading, error } = useFormateurExerciseDetail(exerciseId, !!exerciseId);

  const [formData, setFormData] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  // Initialiser le formulaire quand l'exercice est chargé
  React.useEffect(() => {
    if (exercise) {
      setFormData({
        title: exercise.title || '',
        description: exercise.description || '',
        type: exercise.type || 'CAS_PRATIQUE',
        difficulty: exercise.difficulty || 3,
        estimatedDurationMinutes: exercise.estimatedDurationMinutes?.toString() || '',
        ccpCode: exercise.ccpCode || '',
        competences: Array.isArray(exercise.competences) 
          ? JSON.stringify(exercise.competences, null, 2)
          : exercise.competences || '',
        isPublished: exercise.isPublished || false,
        questions: exercise.questions || [],
      });
    }
  }, [exercise]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md">
          <ErrorMessage
            message={String(error)}
            title="Erreur de chargement"
            dismissible={false}
          />
          <div className="mt-4 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!formData) {
    return null;
  }

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const parseCompetences = (competencesStr) => {
    if (!competencesStr.trim()) return [];
    
    try {
      const parsed = JSON.parse(competencesStr);
      return Array.isArray(parsed) ? parsed : [competencesStr];
    } catch {
      return competencesStr
        .split(/[\n,;]/)
        .map(s => s.trim())
        .filter(Boolean);
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.title.trim()) {
      errors.title = 'Le titre est obligatoire';
    }
    
    if (!formData.type) {
      errors.type = 'Le type d\'exercice est obligatoire';
    }
    
    if (!formData.difficulty || formData.difficulty < 1 || formData.difficulty > 5) {
      errors.difficulty = 'La difficulté doit être entre 1 et 5';
    }
    
    if (formData.estimatedDurationMinutes && (isNaN(formData.estimatedDurationMinutes) || formData.estimatedDurationMinutes < 1)) {
      errors.estimatedDurationMinutes = 'La durée doit être un nombre positif';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        type: formData.type,
        difficulty: parseInt(formData.difficulty, 10),
        estimatedDurationMinutes: formData.estimatedDurationMinutes ? parseInt(formData.estimatedDurationMinutes, 10) : null,
        ccpCode: formData.ccpCode.trim() || null,
        competences: parseCompetences(formData.competences),
        isPublished: formData.isPublished,
        questions: formData.questions, // Les questions sont conservées telles quelles
      };

      await updateMutation.mutateAsync({
        id: exerciseId,
        payload,
      });
      
      onUpdateSuccess();
    } catch (error) {
      console.error('Erreur lors de la modification de l\'exercice:', error);
      setFormErrors({
        submit: error?.response?.data?.message || error?.message || 'Erreur lors de la modification de l\'exercice',
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">
              Modifier l'exercice
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {formData.title || 'Sans titre'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={updateMutation.isLoading}
          >
            <span className="material-symbols-rounded text-2xl">close</span>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Erreur globale */}
          {formErrors.submit && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
              {formErrors.submit}
            </div>
          )}

          {/* Section 1 : Informations générales */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Informations générales</h4>
            <div className="space-y-4">
              {/* Titre */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Titre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    formErrors.title ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Ex: Vérifier une identité à l'accueil"
                />
                {formErrors.title && (
                  <p className="text-xs text-red-600 mt-1">{formErrors.title}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description / Énoncé
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Décrivez le cas concret en français..."
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type d'exercice <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => handleInputChange('type', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    formErrors.type ? 'border-red-300' : 'border-gray-300'
                  }`}
                >
                  <option value="QCM">QCM - Questions à choix multiples</option>
                  <option value="CAS_PRATIQUE">CAS_PRATIQUE - Cas pratique avec questions ouvertes</option>
                  <option value="TRANSCRIPTION">TRANSCRIPTION - Transcription d'un appel ou d'un document</option>
                  <option value="ETUDE_DOCUMENT">ETUDE_DOCUMENT - Analyse d'un document médical</option>
                </select>
              </div>

              {/* Difficulté et Durée */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Difficulté <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.difficulty}
                    onChange={(e) => handleInputChange('difficulty', parseInt(e.target.value, 10))}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      formErrors.difficulty ? 'border-red-300' : 'border-gray-300'
                    }`}
                  >
                    <option value={1}>1 - Très facile (débutant)</option>
                    <option value={2}>2 - Facile</option>
                    <option value={3}>3 - Moyen</option>
                    <option value={4}>4 - Difficile</option>
                    <option value={5}>5 - Très difficile (expert)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Durée estimée (minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.estimatedDurationMinutes}
                    onChange={(e) => handleInputChange('estimatedDurationMinutes', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      formErrors.estimatedDurationMinutes ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Ex: 20"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2 : Métadonnées pédagogiques */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Métadonnées pédagogiques</h4>
            <div className="space-y-4">
              {/* CCP Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CCP Code
                </label>
                <input
                  type="text"
                  value={formData.ccpCode}
                  onChange={(e) => handleInputChange('ccpCode', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ex: CCP1, CCP2..."
                />
              </div>

              {/* Compétences */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Compétences
                </label>
                <textarea
                  value={formData.competences}
                  onChange={(e) => handleInputChange('competences', e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                  placeholder="Format JSON ou une compétence par ligne"
                />
              </div>
            </div>
          </div>

          {/* Section 3 : Questions */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">
                Questions ({formData.questions.length})
              </h4>
              <button
                type="button"
                onClick={() => {
                  const newQuestion = {
                    position: formData.questions.length + 1,
                    type: 'QCM',
                    prompt: '',
                    maxScore: 1,
                    config: {
                      options: [],
                      correctAnswers: [],
                      scoring: {
                        mode: 'all_or_nothing',
                        points_if_correct: 1,
                        points_if_wrong: 0,
                      },
                    },
                  };
                  handleInputChange('questions', [...formData.questions, newQuestion]);
                }}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 flex items-center gap-2"
              >
                <span className="material-symbols-rounded text-lg">add</span>
                Ajouter une question
              </button>
            </div>
            
            {formData.questions.length === 0 ? (
              <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500 text-sm">
                Aucune question pour le moment. Cliquez sur "Ajouter une question" pour commencer.
              </div>
            ) : (
              <div className="space-y-4">
                {formData.questions.map((q, index) => (
                  <QuestionEditor
                    key={q.id || index}
                    question={q}
                    index={index}
                    onUpdate={(updatedQuestion) => {
                      const newQuestions = [...formData.questions];
                      newQuestions[index] = updatedQuestion;
                      handleInputChange('questions', newQuestions);
                    }}
                    onDelete={() => {
                      const newQuestions = formData.questions.filter((_, i) => i !== index);
                      // Réorganiser les positions
                      newQuestions.forEach((q, i) => {
                        q.position = i + 1;
                      });
                      handleInputChange('questions', newQuestions);
                    }}
                    onMoveUp={index > 0 ? () => {
                      const newQuestions = [...formData.questions];
                      [newQuestions[index - 1], newQuestions[index]] = [newQuestions[index], newQuestions[index - 1]];
                      newQuestions.forEach((q, i) => {
                        q.position = i + 1;
                      });
                      handleInputChange('questions', newQuestions);
                    } : null}
                    onMoveDown={index < formData.questions.length - 1 ? () => {
                      const newQuestions = [...formData.questions];
                      [newQuestions[index], newQuestions[index + 1]] = [newQuestions[index + 1], newQuestions[index]];
                      newQuestions.forEach((q, i) => {
                        q.position = i + 1;
                      });
                      handleInputChange('questions', newQuestions);
                    } : null}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Section 4 : Statut de publication */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Statut de publication</h4>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isPublished}
                onChange={(e) => handleInputChange('isPublished', e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Publier l'exercice</span>
                <p className="text-xs text-gray-500">
                  {formData.isPublished 
                    ? 'L\'exercice est publié et assignable aux stagiaires'
                    : 'L\'exercice est en brouillon (non assignable)'}
                </p>
              </div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={updateMutation.isLoading}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={updateMutation.isLoading}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {updateMutation.isLoading ? (
                <>
                  <LoadingSpinner color="white" size="small" inline={true} />
                  <span className="ml-2">Enregistrement...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-rounded text-xl">save</span>
                  Enregistrer les modifications
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Composant pour éditer une question individuelle
const QuestionEditor = ({ question, index, onUpdate, onDelete, onMoveUp, onMoveDown }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [qData, setQData] = useState(() => ({
    position: question.position || index + 1,
    type: question.type || 'QCM',
    prompt: question.prompt || '',
    maxScore: question.maxScore || 1,
    config: question.config || {
      options: [],
      correctAnswers: [],
      scoring: {
        mode: 'all_or_nothing',
        points_if_correct: 1,
        points_if_wrong: 0,
      },
    },
  }));

  React.useEffect(() => {
    onUpdate(qData);
  }, [qData]);

  const handleConfigChange = (field, value) => {
    setQData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        [field]: value,
      },
    }));
  };

  const handleScoringChange = (field, value) => {
    setQData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        scoring: {
          ...(prev.config?.scoring || {}),
          [field]: value,
        },
      },
    }));
  };

  const addOption = () => {
    const newOption = `Option ${(qData.config.options || []).length + 1}`;
    handleConfigChange('options', [...(qData.config.options || []), newOption]);
  };

  const updateOption = (optionIndex, value) => {
    const newOptions = [...(qData.config.options || [])];
    newOptions[optionIndex] = value;
    handleConfigChange('options', newOptions);
    
    // Retirer de correctAnswers si l'option est supprimée
    if (!value.trim() && qData.config.correctAnswers) {
      const oldValue = qData.config.options[optionIndex];
      handleConfigChange('correctAnswers', 
        qData.config.correctAnswers.filter(ans => ans !== oldValue && ans !== value)
      );
    }
  };

  const removeOption = (optionIndex) => {
    const optionToRemove = qData.config.options[optionIndex];
    const newOptions = qData.config.options.filter((_, i) => i !== optionIndex);
    handleConfigChange('options', newOptions);
    
    // Retirer de correctAnswers
    if (qData.config.correctAnswers) {
      handleConfigChange('correctAnswers', 
        qData.config.correctAnswers.filter(ans => ans !== optionToRemove)
      );
    }
  };

  const toggleCorrectAnswer = (option) => {
    const current = qData.config.correctAnswers || [];
    const isCorrect = current.includes(option);
    
    if (isCorrect) {
      handleConfigChange('correctAnswers', current.filter(ans => ans !== option));
    } else {
      handleConfigChange('correctAnswers', [...current, option]);
    }
  };

  const isTextQuestion = qData.type === 'TEXTE';
  const isQCMQuestion = qData.type === 'QCM' || qData.type === 'CASE_A_COCHER';
  const scoringMode = qData.config?.scoring?.mode || 'all_or_nothing';

  return (
    <div className="border border-gray-300 rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-500 hover:text-gray-700"
          >
            <span className="material-symbols-rounded">
              {isExpanded ? 'expand_less' : 'expand_more'}
            </span>
          </button>
          <span className="text-sm font-semibold text-gray-700">
            Question {qData.position} - {qData.type}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onMoveUp && (
            <button
              type="button"
              onClick={onMoveUp}
              className="text-gray-500 hover:text-gray-700"
              title="Déplacer vers le haut"
            >
              <span className="material-symbols-rounded text-xl">arrow_upward</span>
            </button>
          )}
          {onMoveDown && (
            <button
              type="button"
              onClick={onMoveDown}
              className="text-gray-500 hover:text-gray-700"
              title="Déplacer vers le bas"
            >
              <span className="material-symbols-rounded text-xl">arrow_downward</span>
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="text-red-500 hover:text-red-700"
            title="Supprimer cette question"
          >
            <span className="material-symbols-rounded text-xl">delete</span>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-4">
          {/* Type de question */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type de question <span className="text-red-500">*</span>
            </label>
            <select
              value={qData.type}
              onChange={(e) => {
                const newType = e.target.value;
                setQData(prev => {
                  const newConfig = { ...prev.config };
                  // Réinitialiser config selon le type
                  if (newType === 'TEXTE') {
                    newConfig.scoring = { mode: 'manual', max_score: prev.maxScore };
                  } else {
                    if (!newConfig.options) newConfig.options = [];
                    if (!newConfig.correctAnswers) newConfig.correctAnswers = [];
                    if (!newConfig.scoring) {
                      newConfig.scoring = {
                        mode: 'all_or_nothing',
                        points_if_correct: prev.maxScore,
                        points_if_wrong: 0,
                      };
                    }
                  }
                  return { ...prev, type: newType, config: newConfig };
                });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="QCM">QCM - Question à choix unique</option>
              <option value="CASE_A_COCHER">CASE_A_COCHER - Cases à cocher (réponses multiples)</option>
              <option value="TEXTE">TEXTE - Texte libre</option>
            </select>
          </div>

          {/* Prompt */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Intitulé / Prompt <span className="text-red-500">*</span>
            </label>
            <textarea
              value={qData.prompt}
              onChange={(e) => setQData(prev => ({ ...prev, prompt: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Ex: Q1 – D'après la situation, quels justificatifs manquent ?"
            />
          </div>

          {/* Score maximum */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Score maximum <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={qData.maxScore}
              onChange={(e) => {
                const newScore = parseFloat(e.target.value) || 0;
                setQData(prev => ({ ...prev, maxScore: newScore }));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Options pour QCM */}
          {isQCMQuestion && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Options de réponse
                </label>
                <button
                  type="button"
                  onClick={addOption}
                  className="text-xs text-indigo-600 hover:text-indigo-800"
                >
                  + Ajouter une option
                </button>
              </div>
              <div className="space-y-2">
                {(qData.config.options || []).map((option, optIndex) => (
                  <div key={optIndex} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={(qData.config.correctAnswers || []).includes(option)}
                      onChange={() => toggleCorrectAnswer(option)}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      disabled={!option.trim()}
                    />
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(optIndex, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder={`Option ${optIndex + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(optIndex)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <span className="material-symbols-rounded">close</span>
                    </button>
                  </div>
                ))}
                {(!qData.config.options || qData.config.options.length === 0) && (
                  <p className="text-xs text-gray-500">Aucune option. Cliquez sur "Ajouter une option" pour commencer.</p>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                ☑ Cochez les cases pour marquer les bonnes réponses
              </p>
            </div>
          )}

          {/* Configuration de scoring */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mode de scoring
            </label>
            <select
              value={scoringMode}
              onChange={(e) => {
                const mode = e.target.value;
                setQData(prev => ({
                  ...prev,
                  config: {
                    ...prev.config,
                    scoring: {
                      ...(prev.config?.scoring || {}),
                      mode,
                    },
                  },
                }));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
            >
              <option value="all_or_nothing">All or Nothing - Tout ou rien</option>
              <option value="per_option">Per Option - Points par option</option>
              {isTextQuestion && <option value="manual">Manual - Correction manuelle</option>}
            </select>

            {/* Configuration selon le mode */}
            {scoringMode === 'all_or_nothing' && (
              <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Points si correct
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={qData.config.scoring?.points_if_correct || qData.maxScore}
                    onChange={(e) => handleScoringChange('points_if_correct', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Points si incorrect
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={qData.config.scoring?.points_if_wrong || 0}
                    onChange={(e) => handleScoringChange('points_if_wrong', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
            )}

            {scoringMode === 'per_option' && (
              <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Points par bonne réponse
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={qData.config.scoring?.points_per_good || 1}
                    onChange={(e) => handleScoringChange('points_per_good', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Pénalité par mauvaise réponse
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={qData.config.scoring?.points_per_bad || 0}
                    onChange={(e) => handleScoringChange('points_per_bad', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Score minimum
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={qData.config.scoring?.min_score || 0}
                    onChange={(e) => handleScoringChange('min_score', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
            )}

            {scoringMode === 'manual' && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-600">
                  ⚠️ Cette question nécessitera une correction manuelle par le formateur. 
                  Le score automatique sera 0 et vous devrez attribuer le score final lors de la correction.
                </p>
                {qData.config.guidelines && (
                  <div className="mt-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Critères d'évaluation (optionnel, pour référence)
                    </label>
                    <textarea
                      value={Array.isArray(qData.config.guidelines) 
                        ? qData.config.guidelines.join('\n')
                        : qData.config.guidelines || ''}
                      onChange={(e) => {
                        const guidelines = e.target.value.split('\n').filter(l => l.trim());
                        handleConfigChange('guidelines', guidelines);
                      }}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
                      placeholder="Ex: Mentionner les documents manquants (2 pts)&#10;Explications claires (2 pts)"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FormateurExercises;
