import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSubmissionResults } from '../../hooks/useExercises';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';

const ExerciseSubmissionResults = () => {
  const { submissionId } = useParams();
  const navigate = useNavigate();

  const { data: submission, isLoading, error } = useSubmissionResults(submissionId || null);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner message="Chargement des résultats..." />
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="min-h-screen w-[95%] md:w-[90%] lg:w-[80%] mx-auto px-2 md:px-4 py-6">
        <ErrorMessage
          message={error || "Impossible de charger les résultats."}
          title="Erreur de chargement"
          dismissible={false}
        />
        <div className="mt-4">
          <button
            type="button"
            onClick={() => navigate('/exercises')}
            className="px-4 py-2 rounded-lg bg-sky-600 text-white hover:bg-sky-700"
          >
            Retour à la liste des exercices
          </button>
        </div>
      </div>
    );
  }

  const isCorrected = submission.finalScore !== null;
  const displayScore = isCorrected ? submission.finalScore : submission.autoScore;

  return (
    <div className="min-h-screen w-[95%] md:w-[90%] lg:w-[80%] mx-auto px-2 md:px-4 py-6 space-y-6">
      {/* En-tête */}
      <div className="bg-sky-200 rounded-lg shadow p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-sky-900 mb-2">Résultats de l&apos;exercice</h1>
            <p className="text-sm text-sky-800">{submission.exercise.title}</p>
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

      {/* Résumé des scores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Score automatique</h3>
          <p className="text-3xl font-bold text-sky-600">
            {submission.autoScore} / {submission.maxScore}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Score calculé automatiquement pour les questions QCM et à cocher
          </p>
        </div>

        {isCorrected && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Score final</h3>
            <p className="text-3xl font-bold text-emerald-600">
              {submission.finalScore} / {submission.maxScore}
            </p>
            {submission.validatedBy && (
              <p className="text-xs text-gray-600 mt-2">
                Corrigé par {submission.validatedBy.prenom} {submission.validatedBy.nom}
              </p>
            )}
          </div>
        )}

        {!isCorrected && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Statut</h3>
            <p className="text-lg font-semibold text-yellow-800">
              En attente de correction
            </p>
            <p className="text-xs text-gray-600 mt-2">
              Les questions à texte libre nécessitent une correction manuelle par le formateur.
            </p>
          </div>
        )}
      </div>

      {/* Commentaire global du formateur */}
      {submission.trainerFeedback && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">Commentaire du formateur</h3>
          <p className="text-sm text-blue-800 whitespace-pre-wrap">{submission.trainerFeedback}</p>
        </div>
      )}

      {/* Détail des réponses */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Détail des réponses</h2>
        <div className="space-y-6">
          {submission.answers.map((answer) => (
            <div key={answer.id} className="border-b border-gray-200 last:border-0 pb-6 last:pb-0">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    Question {answer.question.position}
                  </h3>
                  <p className="text-sm text-gray-700 mt-1">{answer.question.prompt}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">
                    {answer.autoScore} / {answer.question.maxScore} pts
                  </p>
                  {answer.question.type === 'TEXTE' && !isCorrected && (
                    <p className="text-xs text-yellow-600 mt-1">En attente</p>
                  )}
                </div>
              </div>

              {/* Votre réponse */}
              <div className="bg-gray-50 rounded-lg p-3 mb-3">
                <p className="text-xs font-semibold text-gray-700 mb-1">Votre réponse :</p>
                {answer.question.type === 'TEXTE' ? (
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{answer.answer.text || '—'}</p>
                ) : (
                  <div className="text-sm text-gray-800">
                    {Array.isArray(answer.answer.selected) ? (
                      <ul className="list-disc list-inside space-y-1">
                        {answer.answer.selected.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>{answer.answer.selected || '—'}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Bonnes réponses si la réponse est incorrecte */}
              {answer.autoScore < answer.question.maxScore && 
               answer.question.config?.correctAnswers && 
               answer.question.config.correctAnswers.length > 0 &&
               answer.question.type !== 'TEXTE' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                  <p className="text-xs font-semibold text-green-900 mb-1">✓ Bonne(s) réponse(s) :</p>
                  <div className="text-sm text-green-800">
                    {Array.isArray(answer.question.config.correctAnswers) ? (
                      <ul className="list-disc list-inside space-y-1">
                        {answer.question.config.correctAnswers.map((correctAnswer, idx) => (
                          <li key={idx}>{correctAnswer}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>{answer.question.config.correctAnswers}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Commentaire du formateur sur cette réponse */}
              {answer.trainerComment && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-blue-900 mb-1">Commentaire :</p>
                  <p className="text-sm text-blue-800">{answer.trainerComment}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Informations de soumission */}
      <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-600">
        <p>
          Soumis le {new Date(submission.submittedAt).toLocaleString('fr-FR')}
        </p>
      </div>
    </div>
  );
};

export default ExerciseSubmissionResults;



