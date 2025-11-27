import { useState, useEffect, useCallback } from 'react';

interface ExerciseSession {
  exerciseId: string;
  assignmentId: string;
  startedAt: string;
  answers: Record<string, any>; // questionId -> answer
  currentQuestionIndex: number;
  isStarted: boolean;
}

const STORAGE_KEY_PREFIX = 'exercise_session_';
const SESSION_EXPIRY_HOURS = 24;

export function useExerciseSession(exerciseId: string, assignmentId: string) {
  const [session, setSession] = useState<ExerciseSession | null>(null);

  // Charger la session depuis localStorage au montage
  useEffect(() => {
    if (!assignmentId) return;
    
    const storageKey = `${STORAGE_KEY_PREFIX}${assignmentId}`;
    const saved = localStorage.getItem(storageKey);
    
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ExerciseSession;
        // Vérifier que la session n'est pas expirée
        const startedAt = new Date(parsed.startedAt);
        const now = new Date();
        const hoursDiff = (now.getTime() - startedAt.getTime()) / (1000 * 60 * 60);
        
        if (hoursDiff < SESSION_EXPIRY_HOURS) {
          setSession(parsed);
        } else {
          // Session expirée, nettoyer
          localStorage.removeItem(storageKey);
        }
      } catch (e) {
        console.error('Erreur lors du chargement de la session:', e);
        localStorage.removeItem(storageKey);
      }
    }
  }, [assignmentId]);

  // Sauvegarder la session dans localStorage
  const saveSessionToStorage = useCallback((sessionData: ExerciseSession) => {
    if (!assignmentId) return;
    const storageKey = `${STORAGE_KEY_PREFIX}${assignmentId}`;
    localStorage.setItem(storageKey, JSON.stringify(sessionData));
  }, [assignmentId]);

  // Démarrer une nouvelle session
  const startSession = useCallback(() => {
    if (!exerciseId || !assignmentId) return;
    
    const newSession: ExerciseSession = {
      exerciseId,
      assignmentId,
      startedAt: new Date().toISOString(),
      answers: {},
      currentQuestionIndex: 0,
      isStarted: true,
    };
    setSession(newSession);
    saveSessionToStorage(newSession);
  }, [exerciseId, assignmentId, saveSessionToStorage]);

  // Sauvegarder une réponse
  const saveAnswer = useCallback((questionId: string, answer: any) => {
    if (!session) return;

    const updatedSession: ExerciseSession = {
      ...session,
      answers: {
        ...session.answers,
        [questionId]: answer,
      },
    };
    setSession(updatedSession);
    saveSessionToStorage(updatedSession);
  }, [session, saveSessionToStorage]);

  // Changer de question
  const goToQuestion = useCallback((index: number) => {
    if (!session) return;

    const updatedSession: ExerciseSession = {
      ...session,
      currentQuestionIndex: index,
    };
    setSession(updatedSession);
    saveSessionToStorage(updatedSession);
  }, [session, saveSessionToStorage]);

  // Nettoyer la session (après soumission)
  const clearSession = useCallback(() => {
    if (!assignmentId) return;
    const storageKey = `${STORAGE_KEY_PREFIX}${assignmentId}`;
    localStorage.removeItem(storageKey);
    setSession(null);
  }, [assignmentId]);

  return {
    session,
    startSession,
    saveAnswer,
    goToQuestion,
    clearSession,
    isSessionActive: !!session?.isStarted,
  };
}

