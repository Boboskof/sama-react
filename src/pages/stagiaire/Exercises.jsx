import React from 'react';
import { Link } from 'react-router-dom';
import { useStagiaireExercises } from '../../hooks/useExercises';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';

const difficultyLabel = (d) => {
  if (d <= 1) return 'Très facile';
  if (d === 2) return 'Facile';
  if (d === 3) return 'Intermédiaire';
  if (d === 4) return 'Difficile';
  return 'Très difficile';
};

const typeLabel = (t) => {
  switch (t) {
    case 'QCM':
      return 'QCM';
    case 'CAS_PRATIQUE':
      return 'Cas pratique';
    case 'TRANSCRIPTION':
      return 'Transcription';
    case 'ETUDE_DOCUMENT':
      return 'Étude de document';
    default:
      return t;
  }
};

const statusBadgeClass = (status) => {
  switch (status) {
    case 'ASSIGNED':
      return 'bg-blue-100 text-blue-800';
    case 'IN_PROGRESS':
      return 'bg-orange-100 text-orange-800';
    case 'DONE':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const statusLabel = (status) => {
  switch (status) {
    case 'ASSIGNED':
      return 'À faire';
    case 'IN_PROGRESS':
      return 'En cours';
    case 'DONE':
      return 'Terminé';
    default:
      return status;
  }
};

const formatDateTime = (s) => {
  if (!s) return '—';
  try {
    const d = new Date(s.replace(' ', 'T'));
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return s;
  }
};

const Exercises = () => {
  const { data: assignments = [], isLoading, error } = useStagiaireExercises();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner message="Chargement de vos exercices..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Titre */}
      <div className="text-center py-6">
        <div className="bg-sky-200 rounded-lg shadow p-6 max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-16 h-16 bg-sky-100 rounded-full flex items-center justify-center shadow-sm">
              <span className="material-symbols-rounded text-sky-600 text-3xl">school</span>
            </div>
            <h1 className="text-2xl font-bold text-sky-800">Mes exercices</h1>
          </div>
          <p className="text-sky-700 text-sm mb-4">
            Espace d&apos;entraînement – exercices assignés par votre formateur
          </p>
          <Link
            to="/exercises/progression"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            <span className="material-symbols-rounded text-base">trending_up</span>
            Voir ma progression
          </Link>
        </div>
      </div>

      {error && (
        <ErrorMessage
          message={error}
          title="Erreur de chargement"
          dismissible={false}
        />
      )}

      {assignments.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <p className="text-gray-600">
            Aucun exercice ne vous a encore été assigné.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assignments.map((a) => (
            <div
              key={a.assignmentId}
              className="bg-white rounded-lg shadow p-4 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-gray-900">
                    {a.exercise.title}
                  </h2>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(
                      a.status
                    )}`}
                  >
                    {statusLabel(a.status)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-50 text-sky-700">
                    <span className="material-symbols-rounded text-sm">assignment</span>
                    {typeLabel(a.exercise.type)}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                    <span className="material-symbols-rounded text-sm">speed</span>
                    {difficultyLabel(a.exercise.difficulty)}
                  </span>
                  {a.exercise.estimatedDurationMinutes && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                      <span className="material-symbols-rounded text-sm">schedule</span>
                      ~{a.exercise.estimatedDurationMinutes} min
                    </span>
                  )}
                  {a.exercise.ccpCode && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                      CCP {a.exercise.ccpCode}
                    </span>
                  )}
                </div>
                <div className="mt-2 text-xs text-gray-500 space-y-1">
                  <p>
                    Assigné le{' '}
                    <span className="font-medium">{formatDateTime(a.createdAt)}</span>
                  </p>
                  {a.dueAt && (
                    <p>
                      À rendre avant{' '}
                      <span className="font-medium">{formatDateTime(a.dueAt)}</span>
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                {a.status === 'DONE' && (
                  <Link
                    to="/exercises/progression"
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                  >
                    <span className="material-symbols-rounded text-base">trending_up</span>
                    Voir progression
                  </Link>
                )}
                <Link
                  to={`/exercises/${a.assignmentId}`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-600 text-white hover:bg-sky-700 transition-colors"
                >
                  <span className="material-symbols-rounded text-base">play_arrow</span>
                  {a.status === 'DONE' ? 'Revoir' : "Commencer"}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Exercises;


