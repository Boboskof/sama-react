import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStagiaireExercises, useExerciseDetail, useStartExerciseAssignment, useSubmitExerciseAssignment } from '../../hooks/useExercises';
import { useExerciseSession } from '../../hooks/useExerciseSession';
import { usePreventNavigation } from '../../hooks/usePreventNavigation';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';

const ExerciseExam = () => {
  const { assignmentId } = useParams();
  const navigate = useNavigate();

  const {
    data: assignments = [],
    isLoading: listLoading,
  } = useStagiaireExercises();

  const assignment = useMemo(
    () => assignments.find((a) => a.assignmentId === assignmentId),
    [assignments, assignmentId],
  );

  const exerciseId = assignment?.exercise?.id || assignmentId || null;

  const {
    data: exercise,
    isLoading: detailLoading,
    error: detailError,
  } = useExerciseDetail(exerciseId, !!exerciseId);

  const startMutation = useStartExerciseAssignment();
  const submitMutation = useSubmitExerciseAssignment();

  // États locaux (déclarés en premier)
  const [started, setStarted] = useState(
    assignment?.status === 'IN_PROGRESS' || assignment?.status === 'COMPLETED' || assignment?.status === 'REVIEWED',
  );
  const [submitted, setSubmitted] = useState(assignment?.status === 'COMPLETED' || assignment?.status === 'REVIEWED');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  // Gestion de la session avec sauvegarde automatique
  const {
    session,
    startSession,
    saveAnswer: saveAnswerToSession,
    goToQuestion: goToQuestionInSession,
    clearSession,
    isSessionActive,
  } = useExerciseSession(exerciseId || '', assignmentId || '');

  // Synchroniser started avec isSessionActive
  useEffect(() => {
    if (isSessionActive && !started) {
      setStarted(true);
    }
  }, [isSessionActive, started]);

  // Bloquer la navigation une fois l'exercice commencé (mais pas si déjà soumis)
  usePreventNavigation(
    isSessionActive && !submitted,
    'Vous êtes en train de faire un exercice. Voulez-vous vraiment quitter ? Votre progression sera sauvegardée.'
  );

  const questions = exercise?.questions || [];
  const totalQuestions = questions.length;
  const currentQuestion = questions[currentIndex] || null;

  // Restaurer la session au chargement (seulement si l'exercice n'est pas déjà soumis)
  // Utiliser un ref pour éviter de restaurer plusieurs fois et éviter d'écraser les modifications
  const hasRestoredSession = useRef(false);
  
  useEffect(() => {
    if (session && session.isStarted && exercise && !submitted && !hasRestoredSession.current) {
      setStarted(true);
      if (session.answers && Object.keys(session.answers).length > 0 && Object.keys(answers).length === 0) {
        const restoredAnswers = {};
        Object.entries(session.answers).forEach(([questionId, answer]) => {
          if (answer && typeof answer === 'object') {
            restoredAnswers[questionId] = answer;
          }
        });
        setAnswers(restoredAnswers);
      }
      // Restaurer l'index de la question courante
      if (session.currentQuestionIndex !== undefined) {
        setCurrentIndex(session.currentQuestionIndex);
      }
      hasRestoredSession.current = true;
    } else if (submitted && session) {
      // Si l'exercice est soumis, nettoyer la session
      clearSession();
      hasRestoredSession.current = false;
    }
  }, [session, exercise, submitted, clearSession]);

  // Vérifier l'expiration de la session
  useEffect(() => {
    if (!session) return;

    const checkSessionExpiry = setInterval(() => {
      const startedAt = new Date(session.startedAt);
      const now = new Date();
      const hoursDiff = (now.getTime() - startedAt.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff >= 24) {
        alert('Votre session a expiré. Vous allez être redirigé.');
        clearSession();
        navigate('/exercises');
      }
    }, 60000); // Vérifier toutes les minutes

    return () => clearInterval(checkSessionExpiry);
  }, [session, clearSession, navigate]);

  // Vérifier si toutes les questions sont répondues
  const allAnswered = useMemo(() => {
    return questions.every(q => {
      const answer = answers[q.id];
      if (!answer) return false;
      if (q.type === 'TEXTE') {
        return answer.text && answer.text.trim().length > 0;
      }
      if (q.type === 'QCM') {
        return answer.selected && answer.selected.length > 0;
      }
      if (q.type === 'CASE_A_COCHER') {
        return Array.isArray(answer.selected) && answer.selected.length > 0;
      }
      return false;
    });
  }, [answers, questions]);

  const handleStart = async () => {
    if (!assignmentId) return;
    try {
      await startMutation.mutateAsync(assignmentId);
      setStarted(true);
      // Démarrer la session locale
      startSession();
    } catch (e) {
      // L'erreur est déjà loggée dans le service / mutation
    }
  };

  const updateAnswer = (questionId, newValue) => {
    if (isSessionActive) {
      saveAnswerToSession(questionId, newValue);
    }
    setAnswers((prev) => ({
      ...prev,
      [questionId]: newValue,
    }));
  };

  const handleSubmit = async () => {
    if (!assignmentId || !questions.length) return;
    if (!allAnswered) {
      alert('Veuillez répondre à toutes les questions avant de soumettre.');
      return;
    }
    
    if (!window.confirm('Êtes-vous sûr de vouloir soumettre votre exercice ? Vous ne pourrez plus le modifier.')) {
      return;
    }

    if (isSessionActive) {
      Object.entries(answers).forEach(([questionId, answerValue]) => {
        if (answerValue) {
          saveAnswerToSession(questionId, answerValue);
        }
      });
    }
    const payload = questions.map((q) => {
      const answer = answers[q.id];
      let formattedAnswer = {};
      
      if (answer) {
        const questionType = (q.type || '').toUpperCase();
        
        if (typeof answer === 'object' && !Array.isArray(answer)) {
          if (questionType === 'TEXTE' && answer.text !== undefined) {
            formattedAnswer = { text: answer.text };
          } else if (questionType === 'CASE_A_COCHER' && answer.selected !== undefined) {
            formattedAnswer = { 
              selected: Array.isArray(answer.selected) 
                ? answer.selected 
                : [answer.selected].filter(Boolean) 
            };
          } else if (answer.selected !== undefined) {
            formattedAnswer = answer;
          } else {
            formattedAnswer = answer;
          }
        } else if (Array.isArray(answer)) {
          formattedAnswer = { selected: answer };
        } else {
          if (questionType === 'TEXTE') {
            formattedAnswer = { text: String(answer) };
          } else {
            formattedAnswer = { selected: answer };
          }
        }
      }
      
      return {
        questionId: q.id,
        answer: formattedAnswer,
      };
    });
    
    try {
      const res = await submitMutation.mutateAsync({
        assignmentId,
        answers: payload,
      });
      setResult(res);
      setSubmitted(true);
      
      // Nettoyer la session après soumission
      clearSession();
      
      // Rediriger vers la page de résultats après 2 secondes
      setTimeout(() => {
        navigate(`/exercises/results/${res.submissionId}`);
      }, 2000);
    } catch (e) {
      console.error('Erreur lors de la soumission:', e);
      // Erreur déjà gérée par le service
    }
  };

  // Affichage intro avant de commencer
  if (!started && !submitted && exercise) {
    return (
      <div className="min-h-screen w-[95%] md:w-[90%] lg:w-[80%] mx-auto px-2 md:px-4 py-6 space-y-6">
        <div className="bg-sky-200 rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-sky-900 mb-4">{exercise.title}</h1>
          {exercise.description && (
            <div className="bg-white rounded-lg p-4 mb-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Description</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{exercise.description}</p>
            </div>
          )}
          <div className="bg-white rounded-lg p-4 mb-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Type</p>
              <p className="font-semibold text-gray-900">{exercise.type}</p>
            </div>
            <div>
              <p className="text-gray-600">Difficulté</p>
              <p className="font-semibold text-gray-900">{exercise.difficulty}/5</p>
            </div>
            {exercise.estimatedDurationMinutes && (
              <div>
                <p className="text-gray-600">Durée estimée</p>
                <p className="font-semibold text-gray-900">{exercise.estimatedDurationMinutes} min</p>
              </div>
            )}
            {exercise.ccpCode && (
              <div>
                <p className="text-gray-600">CCP</p>
                <p className="font-semibold text-gray-900">{exercise.ccpCode}</p>
              </div>
            )}
          </div>
          {exercise.competences && exercise.competences.length > 0 && (
            <div className="bg-white rounded-lg p-4 mb-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Compétences travaillées</h3>
              <ul className="list-disc list-inside text-sm text-gray-700">
                {exercise.competences.map((comp, idx) => (
                  <li key={idx}>{comp}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="bg-white rounded-lg p-4">
            <p className="text-sm text-gray-700 mb-4">
              Cet exercice contient <strong>{totalQuestions}</strong> question{totalQuestions > 1 ? 's' : ''}.
            </p>
            <button
              type="button"
              onClick={handleStart}
              disabled={startMutation.isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-50"
            >
              <span className="material-symbols-rounded text-base">
                play_arrow
              </span>
              Commencer l&apos;exercice
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (listLoading || detailLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner message="Chargement de l'exercice..." />
      </div>
    );
  }

  if (detailError || !exercise) {
    return (
      <div className="min-h-screen w-[95%] md:w-[90%] lg:w-[80%] mx-auto px-2 md:px-4 py-6">
        <ErrorMessage
          message={detailError || "Impossible de charger l'exercice."}
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

  return (
    <div className="min-h-screen w-[95%] md:w-[90%] lg:w-[80%] mx-auto px-2 md:px-4 py-6 space-y-6">
      {/* En-tête exercice */}
      <div className="bg-sky-200 rounded-lg shadow p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-sky-900">{exercise.title}</h1>
            {assignment?.dueAt && (
              <p className="mt-2 text-xs text-sky-800">
                À rendre avant{' '}
                <span className="font-semibold">{new Date(assignment.dueAt).toLocaleString('fr-FR')}</span>
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 text-xs text-sky-900">
            <p>
              Question{' '}
              <span className="font-semibold">
                {currentIndex + 1} / {totalQuestions || 0}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Résultat après soumission */}
      {submitted && result && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-emerald-800 mb-2">
            Exercice soumis avec succès !
          </h2>
          <p className="text-sm text-emerald-700">
            Score automatique :{' '}
            <span className="font-bold">
              {result.autoScore} / {result.maxScore}
            </span>
          </p>
          <p className="text-xs text-emerald-700 mt-2">
            Redirection vers les résultats...
          </p>
        </div>
      )}

      {/* Corps de l'examen */}
      {started && !submitted && currentQuestion && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          {/* Progression */}
          <div>
            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
              <span>
                Question {currentIndex + 1} sur {totalQuestions}
              </span>
              <span>
                {Object.keys(answers).length} / {totalQuestions} répondues
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-sky-500 h-2 rounded-full transition-all"
                style={{
                  width:
                    totalQuestions > 0
                      ? `${(Object.keys(answers).length / totalQuestions) * 100}%`
                      : '0%',
                }}
              />
            </div>
          </div>

          {/* Énoncé */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Question {currentQuestion.position} <span className="text-sm font-normal text-gray-500">({currentQuestion.maxScore} pts)</span>
            </h2>
            <p className="text-gray-800 mb-4">{currentQuestion.prompt}</p>
          </div>

          {/* Zone de réponse */}
          <div className="space-y-3">
            {(() => {
              // Normaliser le type de question pour gérer les variations de casse
              const questionType = (currentQuestion.type || '').toUpperCase();
              
              if (questionType === 'QCM') {
                return (
                  <QcmAnswer
                    question={currentQuestion}
                    value={answers[currentQuestion.id]?.selected || ''}
                    onChange={(selected) =>
                      updateAnswer(currentQuestion.id, { selected })
                    }
                  />
                );
              }
              
              if (questionType === 'TEXTE' || questionType === 'TEXT') {
                return (
                  <TextAnswer
                    question={currentQuestion}
                    value={answers[currentQuestion.id]?.text || ''}
                    onChange={(text) =>
                      updateAnswer(currentQuestion.id, { text })
                    }
                  />
                );
              }
              
              if (questionType === 'CASE_A_COCHER') {
                // Utiliser la même logique que QCM : extraire directement selected
                const currentAnswer = answers[currentQuestion.id];
                // Pour CASE_A_COCHER, selected est un tableau
                const selectedValues = currentAnswer?.selected || [];
                
                return (
                  <CaseACocherAnswer
                    question={currentQuestion}
                    value={Array.isArray(selectedValues) ? selectedValues : []}
                    onChange={(selected) => {
                      // Même logique que QCM : mettre à jour directement avec { selected: [...] }
                      updateAnswer(currentQuestion.id, { selected: Array.isArray(selected) ? selected : [] });
                    }}
                  />
                );
              }
              
              // Fallback : si le type n'est pas reconnu, afficher un message ou un champ texte par défaut
              console.warn('Type de question non reconnu:', currentQuestion.type, 'Question:', currentQuestion);
              return (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800 mb-2">
                    Type de question non reconnu: <strong>{currentQuestion.type}</strong>. Affichage d'un champ texte par défaut.
                  </p>
                  <TextAnswer
                    question={currentQuestion}
                    value={answers[currentQuestion.id]?.text || ''}
                    onChange={(text) =>
                      updateAnswer(currentQuestion.id, { text })
                    }
                  />
                </div>
              );
            })()}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => {
                const newIndex = Math.max(0, currentIndex - 1);
                setCurrentIndex(newIndex);
                if (isSessionActive) {
                  goToQuestionInSession(newIndex);
                }
              }}
              disabled={currentIndex === 0}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <span className="material-symbols-rounded text-base">
                chevron_left
              </span>
              Précédent
            </button>

            <div className="flex items-center gap-2">
              {currentIndex < totalQuestions - 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const newIndex = Math.min(totalQuestions - 1, currentIndex + 1);
                    setCurrentIndex(newIndex);
                    if (isSessionActive) {
                      goToQuestionInSession(newIndex);
                    }
                  }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-medium hover:bg-sky-700"
                >
                  Suivant
                  <span className="material-symbols-rounded text-base">
                    chevron_right
                  </span>
                </button>
              )}

              {currentIndex === totalQuestions - 1 && (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitMutation.isLoading || !allAnswered}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-rounded text-base">
                    task_alt
                  </span>
                  {submitMutation.isLoading ? 'Envoi...' : 'Soumettre l\'exercice'}
                </button>
              )}
            </div>
          </div>

          {!allAnswered && currentIndex === totalQuestions - 1 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs text-yellow-800">
                ⚠️ Veuillez répondre à toutes les questions avant de soumettre.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Indicateur de sauvegarde automatique */}
      {isSessionActive && (
        <div className="fixed bottom-4 right-4 bg-green-50 border border-green-200 rounded-lg px-3 py-2 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-green-700">
            <span className="material-symbols-rounded text-sm">check_circle</span>
            <span>Sauvegardé automatiquement</span>
          </div>
        </div>
      )}
    </div>
  );
};

// QCM : une seule réponse (radio buttons)
const QcmAnswer = ({ question, value, onChange }) => {
  const options = question?.config?.options || [];

  return (
    <div className="space-y-2">
      {options.map((opt, idx) => {
        const optionValue = typeof opt === 'string' ? opt : (opt.value || opt.label || opt);
        const optionLabel = typeof opt === 'string' ? opt : (opt.label || opt.value || opt);
        return (
          <label
            key={idx}
            className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
          >
            <input
              type="radio"
              name={`question-${question.id}`}
              value={optionValue}
              checked={value === optionValue}
              onChange={(e) => onChange(e.target.value)}
              className="border-gray-300 text-sky-600 focus:ring-sky-500"
            />
            <span className="text-sm text-gray-800 flex-1">{optionLabel}</span>
          </label>
        );
      })}
    </div>
  );
};

// CASE_A_COCHER : plusieurs réponses possibles (checkboxes)
const CaseACocherAnswer = ({ question, value, onChange }) => {
  const options = question?.config?.options || [];

  const toggle = (optValue) => {
    // Utiliser la même logique simple que QCM
    // Normaliser la valeur actuelle pour s'assurer que c'est un tableau
    const current = Array.isArray(value) ? value : (value ? [value] : []);
    
    // Normaliser toutes les valeurs pour la comparaison
    const normalizeValue = (val) => String(val || '').trim();
    const normalizedCurrent = current.map(normalizeValue);
    const normalizedOptValue = normalizeValue(optValue);
    
    // Vérifier si l'option est déjà sélectionnée (avec comparaison normalisée)
    const isSelected = normalizedCurrent.includes(normalizedOptValue);
    
    // Créer le nouveau tableau avec les valeurs originales (pas normalisées)
    const newValue = isSelected
      ? current.filter(v => normalizeValue(v) !== normalizedOptValue)
      : [...current, optValue];
    
    onChange(newValue);
  };

  return (
    <div className="space-y-2">
      {options.map((opt, idx) => {
        const optionValue = typeof opt === 'string' 
          ? opt 
          : (opt.value !== undefined && opt.value !== null ? opt.value : (opt.label || String(opt)));
        const optionLabel = typeof opt === 'string' 
          ? opt 
          : (opt.label || opt.value || String(opt));
        
        const normalizeValue = (val) => String(val || '').trim();
        const normalizedOptionValue = normalizeValue(optionValue);
        const normalizedValues = Array.isArray(value) 
          ? value.map(normalizeValue) 
          : [];
        
        const checked = normalizedValues.includes(normalizedOptionValue);
        
        return (
          <label
            key={idx}
            className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(optionValue)}
              className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
            />
            <span className="text-sm text-gray-800 flex-1">{optionLabel}</span>
          </label>
        );
      })}
    </div>
  );
};

// TEXTE : texte libre avec guidelines si disponibles
const TextAnswer = ({ question, value, onChange }) => {
  const guidelines = question?.config?.guidelines || [];
  
  return (
    <div className="space-y-3">
      <textarea
        className="w-full min-h-[150px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Votre réponse..."
      />
      {guidelines.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-blue-900 mb-2">Critères d&apos;évaluation :</p>
          <ul className="list-disc list-inside space-y-1">
            {guidelines.map((guideline, idx) => (
              <li key={idx} className="text-xs text-blue-800">{guideline}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ExerciseExam;
