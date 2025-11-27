import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useSubmissionDetail, useReviewSubmission } from '../../hooks/useExercises';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import { formatDateTime } from '../../utils/dateHelpers';

const ExerciseSubmissionReview = () => {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const { data: submission, isLoading, error } = useSubmissionDetail(submissionId || null);
  const reviewMutation = useReviewSubmission();

  const [finalScore, setFinalScore] = useState(null);
  const [trainerFeedback, setTrainerFeedback] = useState('');
  const [answerComments, setAnswerComments] = useState({});
  const [answerScores, setAnswerScores] = useState({}); // Pour ajuster le score de chaque réponse
  const [uiError, setUiError] = useState(null);

  // Trier les réponses une seule fois avec useMemo (optimisation performance)
  const sortedAnswers = useMemo(() => {
    if (!submission?.answers) return [];
    return [...submission.answers].sort((a, b) => {
      const posA = a.question?.position ?? 0;
      const posB = b.question?.position ?? 0;
      return posA - posB;
    });
  }, [submission?.answers]);

  // Initialiser les valeurs depuis la soumission (une seule fois)
  const isInitialized = useRef(false);
  useEffect(() => {
    if (submission && !isInitialized.current) {
      isInitialized.current = true;
      setFinalScore(submission.finalScore ?? submission.autoScore);
      setTrainerFeedback(submission.trainerFeedback ?? '');
      // Initialiser les commentaires existants
      const comments = {};
      const scores = {};
      submission.answers.forEach((answer) => {
        if (answer.trainerComment) {
          comments[answer.id] = answer.trainerComment;
        }
        // Pour les questions TEXTE, initialiser à 0 si pas encore corrigé (pas de score automatique)
        // Pour les autres, utiliser le score automatique
        const isTextQuestion = answer.question.type === 'TEXTE' || answer.question.type === 'TEXTE_LIBRE';
        if (isTextQuestion) {
          // Si le score final existe déjà (déjà corrigé), l'utiliser, sinon 0
          scores[answer.id] = answer.trainerScore !== undefined ? answer.trainerScore : (answer.finalScore !== undefined ? answer.finalScore : 0);
        } else {
          // Pour les autres types, utiliser le score automatique
          scores[answer.id] = answer.autoScore ?? 0;
        }
      });
      setAnswerComments(comments);
      setAnswerScores(scores);
    }
  }, [submission]);

  // Calculer le score final automatiquement en additionnant les scores ajustés
  const calculatedFinalScore = useMemo(() => {
    if (!sortedAnswers.length) return submission?.autoScore ?? 0;
    
    let totalScore = 0;
    sortedAnswers.forEach((answer) => {
      const adjustedScore = answerScores[answer.id];
      // Si un score ajusté existe, l'utiliser, sinon utiliser le score automatique
      const scoreToUse = adjustedScore !== undefined ? adjustedScore : (answer.autoScore ?? 0);
      totalScore += scoreToUse;
    });
    
    return totalScore;
  }, [sortedAnswers, answerScores, submission?.autoScore]);

  // Flag pour savoir si le formateur a modifié manuellement le score final
  const isManualScore = useRef(false);
  
  // Initialiser le score final au chargement
  useEffect(() => {
    if (submission && Object.keys(answerScores).length > 0) {
      // Si un score final existe déjà (déjà corrigé), l'utiliser, sinon calculer
      if (submission.finalScore !== null && submission.finalScore !== undefined) {
        setFinalScore(submission.finalScore);
        isManualScore.current = true; // Considérer comme manuel si déjà défini
      } else {
        setFinalScore(calculatedFinalScore);
        isManualScore.current = false;
      }
    }
  }, [submission]);

  // Mettre à jour le score final automatiquement quand les scores ajustés changent
  // (seulement si le formateur ne l'a pas modifié manuellement)
  useEffect(() => {
    if (Object.keys(answerScores).length > 0 && !isManualScore.current) {
      setFinalScore(calculatedFinalScore);
    }
  }, [calculatedFinalScore]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!submission) return;

    setUiError(null);

    // Vérifier que toutes les questions TEXTE ont un score défini
    const texteQuestionsWithoutScore = sortedAnswers.filter(answer => {
      const isTextQuestion = answer.question.type === 'TEXTE' || answer.question.type === 'TEXTE_LIBRE';
      const adjustedScore = answerScores[answer.id];
      return isTextQuestion && (adjustedScore === undefined || adjustedScore === null);
    });

    if (texteQuestionsWithoutScore.length > 0) {
      setUiError(`Veuillez attribuer un score à toutes les questions de type texte (Question ${texteQuestionsWithoutScore.map(a => a.question.position).join(', ')})`);
      return;
    }

    // Construire le tableau des réponses avec commentaires et scores ajustés
    const answers = sortedAnswers
      .map((answer) => {
        const comment = answerComments[answer.id];
        const adjustedScore = answerScores[answer.id];
        const originalScore = answer.autoScore ?? 0;
        const isTextQuestion = answer.question.type === 'TEXTE' || answer.question.type === 'TEXTE_LIBRE';
        
        // Pour les questions TEXTE, toujours inclure le score (obligatoire)
        // Pour les autres, inclure seulement si modifié ou si commentaire
        const hasComment = comment?.trim();
        const hasAdjustedScore = adjustedScore !== undefined && (isTextQuestion || adjustedScore !== originalScore);
        
        if (hasComment || hasAdjustedScore) {
          return {
            answerId: answer.id,
            ...(hasComment ? { trainerComment: comment.trim() } : {}),
            // Toujours envoyer le score si c'est une question TEXTE ou si le score a été ajusté
            ...(hasAdjustedScore ? { autoScore: adjustedScore } : {}),
          };
        }
        return null;
      })
      .filter(Boolean);

    // Utiliser le score final calculé automatiquement (somme des scores ajustés)
    // Si le formateur a modifié le score final manuellement, utiliser celui-ci
    const scoreToUse = finalScore !== null && finalScore !== undefined && Math.abs(finalScore - calculatedFinalScore) > 0.01
      ? finalScore 
      : calculatedFinalScore;

    try {
      await reviewMutation.mutateAsync({
        submissionId: submission.id,
        payload: {
          // TOUJOURS envoyer le score final pour s'assurer qu'il est pris en compte
          finalScore: scoreToUse,
          trainerFeedback: trainerFeedback.trim() || undefined,
          answers: answers.length > 0 ? answers : undefined,
        },
      });

      // Rediriger vers la liste des exercices ou afficher un message de succès
      alert('Copie corrigée avec succès !');
      navigate('/formateur/exercises');
    } catch (err) {
      setUiError(err?.response?.data?.message || 'Erreur lors de la correction de la copie');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-indigo-100">
        <LoadingSpinner message="Chargement de la copie..." size="large" color="indigo" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 bg-indigo-100 min-h-screen w-[95%] md:w-[90%] lg:w-[80%] mx-auto px-2 md:px-4 py-6">
        <ErrorMessage
          message={String(error)}
          title="Erreur de chargement"
          dismissible={false}
        />
        <Link
          to="/formateur/exercises"
          className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Retour aux exercices
        </Link>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="space-y-6 bg-indigo-100 min-h-screen w-[95%] md:w-[90%] lg:w-[80%] mx-auto px-2 md:px-4 py-6">
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <p className="text-gray-600">Copie non trouvée</p>
          <Link
            to="/formateur/exercises"
            className="inline-block mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Retour aux exercices
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-indigo-100 min-h-screen w-[95%] md:w-[90%] lg:w-[80%] mx-auto px-2 md:px-4 py-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Correction de copie
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Stagiaire : {submission.stagiaire.prenom} {submission.stagiaire.nom}
            </p>
            <p className="text-sm text-gray-600">
              Exercice : {submission.exercise.title}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Soumis le : {formatDateTime(submission.submittedAt)}
            </p>
          </div>
          <Link
            to="/formateur/exercises"
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Retour
          </Link>
        </div>

        {uiError && (
          <ErrorMessage
            message={uiError}
            title="Erreur"
            dismissible
            onDismiss={() => setUiError(null)}
          />
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Scores */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Scores</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Score automatique
                </label>
                <div className="text-lg font-semibold text-gray-900">
                  {submission.autoScore} / {submission.maxScore}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Score final (calculé automatiquement)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max={submission.maxScore}
                  value={finalScore ?? calculatedFinalScore ?? ''}
                  onChange={(e) => {
                    const newScore = e.target.value ? parseFloat(e.target.value) : null;
                    setFinalScore(newScore);
                    // Si le formateur modifie le score, marquer comme manuel
                    // Sauf si c'est la même valeur que le calculé (alors réactiver le calcul auto)
                    if (newScore !== null && Math.abs(newScore - calculatedFinalScore) > 0.01) {
                      isManualScore.current = true;
                    } else {
                      isManualScore.current = false;
                      setFinalScore(calculatedFinalScore);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <small className="text-xs text-gray-500">
                  Score calculé automatiquement à partir des scores ajustés : {calculatedFinalScore.toFixed(1)} / {submission.maxScore}. Vous pouvez le modifier manuellement si nécessaire.
                </small>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Score final (affiché)
                </label>
                <div className="text-lg font-semibold text-indigo-600">
                  {(finalScore ?? calculatedFinalScore ?? submission.finalScore ?? submission.autoScore).toFixed(1)} / {submission.maxScore}
                </div>
              </div>
            </div>
          </div>

          {/* Feedback global */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Feedback global
            </label>
            <textarea
              value={trainerFeedback}
              onChange={(e) => setTrainerFeedback(e.target.value)}
              rows={4}
              placeholder="Commentaire général sur la copie..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Réponses par question */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Réponses et commentaires
            </h2>
            <div className="space-y-4">
              {sortedAnswers.map((answer) => (
                  <div
                    key={answer.id}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                  >
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-md font-semibold text-gray-900">
                          Question {answer.question.position}
                        </h3>
                        <div className="text-sm text-gray-600">
                          Score auto : {answer.autoScore} / {answer.question.maxScore}
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">
                        {answer.question.prompt}
                      </p>
                    </div>

                    <div className="mb-3 bg-white rounded p-3 border border-gray-200">
                      <p className="text-xs font-medium text-gray-600 mb-1">
                        Réponse du stagiaire :
                      </p>
                      {answer.question.type === 'QCM' && answer.answer?.selected ? (
                        <div className="text-sm text-gray-900">
                          {Array.isArray(answer.answer.selected)
                            ? answer.answer.selected.join(', ')
                            : String(answer.answer.selected)}
                        </div>
                      ) : answer.question.type === 'CASE_A_COCHER' && answer.answer?.selected ? (
                        <div className="text-sm text-gray-900">
                          {Array.isArray(answer.answer.selected)
                            ? answer.answer.selected.map((item, idx) => (
                                <span key={idx} className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded mr-1 mb-1 text-xs">
                                  {String(item)}
                                </span>
                              ))
                            : String(answer.answer.selected)}
                        </div>
                      ) : answer.question.type === 'TEXTE' && answer.answer?.text ? (
                        <div className="text-sm text-gray-900 whitespace-pre-wrap">
                          {answer.answer.text}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 italic">
                          {JSON.stringify(answer.answer)}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className={`block text-xs font-medium mb-1 ${
                          (answer.question.type === 'TEXTE' || answer.question.type === 'TEXTE_LIBRE') 
                            ? 'text-red-700' 
                            : 'text-gray-700'
                        }`}>
                          Score ajusté {(() => {
                            const isTextQuestion = answer.question.type === 'TEXTE' || answer.question.type === 'TEXTE_LIBRE';
                            return isTextQuestion ? '(obligatoire pour les questions texte)' : '(optionnel)';
                          })()} :
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max={answer.question.maxScore ?? 0}
                          value={answerScores[answer.id] ?? answer.autoScore ?? 0}
                          onChange={(e) => {
                            const newScore = e.target.value ? parseFloat(e.target.value) : 0;
                            setAnswerScores({
                              ...answerScores,
                              [answer.id]: newScore,
                            });
                          }}
                          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                            (answer.question.type === 'TEXTE' || answer.question.type === 'TEXTE_LIBRE') 
                              ? 'border-red-300 focus:ring-red-500 bg-red-50' 
                              : 'border-gray-300 focus:ring-indigo-500'
                          }`}
                          placeholder={`Score auto: ${answer.autoScore ?? 0}`}
                          required={(answer.question.type === 'TEXTE' || answer.question.type === 'TEXTE_LIBRE')}
                        />
                        <small className={`text-xs ${
                          (answer.question.type === 'TEXTE' || answer.question.type === 'TEXTE_LIBRE') 
                            ? 'text-red-600 font-medium' 
                            : 'text-gray-500'
                        }`}>
                          {(() => {
                            const isTextQuestion = answer.question.type === 'TEXTE' || answer.question.type === 'TEXTE_LIBRE';
                            if (isTextQuestion) {
                              return '⚠️ Pour les questions texte, vous devez attribuer manuellement un score. Le score automatique est 0.';
                            }
                            return `Score automatique : ${answer.autoScore ?? 0} / ${answer.question.maxScore ?? 0}. Modifiez si nécessaire.`;
                          })()}
                        </small>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Commentaire formateur :
                        </label>
                        <textarea
                          value={answerComments[answer.id] ?? ''}
                          onChange={(e) =>
                            setAnswerComments({
                              ...answerComments,
                              [answer.id]: e.target.value,
                            })
                          }
                          rows={2}
                          placeholder="Commentaire pour cette réponse..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Link
              to="/formateur/exercises"
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Annuler
            </Link>
            <button
              type="submit"
              disabled={reviewMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {reviewMutation.isPending ? 'Enregistrement...' : 'Enregistrer la correction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExerciseSubmissionReview;

