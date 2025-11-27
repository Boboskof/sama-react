import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProgression } from '../../hooks/useExercises';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';

const ExerciseProgression = () => {
  const navigate = useNavigate();
  const { data, isLoading, error } = useProgression();

  const exercises = data?.data || [];

  const stats = useMemo(() => {
    const completed = exercises.filter(e => e.submission).length;
    const corrected = exercises.filter(e => e.submission?.isCorrected).length;
    const pending = exercises.filter(e => e.submission && !e.submission.isCorrected).length;
    return { completed, corrected, pending, total: exercises.length };
  }, [exercises]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner message="Chargement de votre progression..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen w-[95%] md:w-[90%] lg:w-[80%] mx-auto px-2 md:px-4 py-6">
        <ErrorMessage
          message={error}
          title="Erreur de chargement"
          dismissible={false}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-[95%] md:w-[90%] lg:w-[80%] mx-auto px-2 md:px-4 py-6 space-y-6">
      {/* En-tête */}
      <div className="bg-sky-200 rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-sky-900 mb-2">Ma progression</h1>
            <p className="text-sm text-sky-800">Vue d&apos;ensemble de tous vos exercices</p>
          </div>
          <Link
            to="/exercises"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white text-sky-700 hover:bg-sky-50 text-sm font-medium"
          >
            <span className="material-symbols-rounded text-base">arrow_back</span>
            Retour
          </Link>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Exercices terminés</h3>
          <p className="text-3xl font-bold text-sky-600">{stats.completed}</p>
          <p className="text-xs text-gray-500 mt-1">sur {stats.total} assignés</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Corrigés</h3>
          <p className="text-3xl font-bold text-emerald-600">{stats.corrected}</p>
          <p className="text-xs text-gray-500 mt-1">Score final disponible</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-1">En attente</h3>
          <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
          <p className="text-xs text-gray-500 mt-1">Correction en cours</p>
        </div>
      </div>

      {/* Liste des exercices */}
      {exercises.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <p className="text-gray-600">Aucun exercice assigné pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {exercises.map((item) => (
            <div
              key={item.assignmentId}
              className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {item.exercise.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 mb-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-50 text-sky-700">
                      {item.exercise.type}
                    </span>
                    {item.exercise.ccpCode && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                        CCP {item.exercise.ccpCode}
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
                      item.status === 'DONE'
                        ? 'bg-green-50 text-green-700'
                        : item.status === 'IN_PROGRESS'
                        ? 'bg-orange-50 text-orange-700'
                        : 'bg-blue-50 text-blue-700'
                    }`}>
                      {item.status === 'DONE' ? 'Terminé' : item.status === 'IN_PROGRESS' ? 'En cours' : 'À faire'}
                    </span>
                  </div>

                  {item.submission ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-xs text-gray-600">Score automatique</p>
                          <p className="text-sm font-semibold text-gray-900">
                            {item.submission.autoScore} / {item.submission.maxScore}
                          </p>
                        </div>
                        {item.submission.isCorrected && (
                          <div>
                            <p className="text-xs text-gray-600">Score final</p>
                            <p className="text-sm font-bold text-emerald-600">
                              {item.submission.finalScore} / {item.submission.maxScore}
                            </p>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        Soumis le {new Date(item.submission.submittedAt).toLocaleString('fr-FR')}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Non commencé</p>
                  )}
                </div>

                <div className="flex flex-col gap-2 ml-4">
                  {item.submission ? (
                    <button
                      onClick={() => navigate(`/exercises/results/${item.submission.id}`)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-medium hover:bg-sky-700"
                    >
                      <span className="material-symbols-rounded text-base">visibility</span>
                      Voir détails
                    </button>
                  ) : (
                    <Link
                      to={`/exercises/${item.assignmentId}`}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-medium hover:bg-sky-700"
                    >
                      <span className="material-symbols-rounded text-base">play_arrow</span>
                      Commencer
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExerciseProgression;



