import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import exerciseService from '../_services/exercise.service';
import type {
  ExerciseAssignmentSummary,
  ExerciseTemplateDetail,
  ExerciseTemplateSummary,
  ExerciseSubmissionDetail,
  ReviewSubmissionPayload,
} from '../types/api';

// --- Côté stagiaire ---

// Liste des exercices assignés au stagiaire
export const useStagiaireExercises = () => {
  return useQuery<ExerciseAssignmentSummary[], Error>({
    queryKey: ['exercises', 'stagiaire', 'list'],
    queryFn: () => exerciseService.getStagiaireExercises(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  });
};

// Détail d'un exercice (questions, etc.) pour un stagiaire
export const useExerciseDetail = (
  exerciseId: string | null,
  enabled: boolean = true,
) => {
  return useQuery<ExerciseTemplateDetail, Error>({
    queryKey: ['exercises', 'detail', exerciseId],
    queryFn: () => exerciseService.getExerciseDetail(exerciseId as string),
    enabled: enabled && !!exerciseId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Démarrer un exercice (assignment)
export const useStartExerciseAssignment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (assignmentId: string) =>
      exerciseService.startAssignment(assignmentId),
    onSuccess: () => {
      // Recharger la liste des exercices assignés
      queryClient.invalidateQueries({
        queryKey: ['exercises', 'stagiaire', 'list'],
      });
    },
  });
};

// Soumettre les réponses d'un exercice
export const useSubmitExerciseAssignment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      assignmentId: string;
      answers: Array<{ questionId: string; answer: any }>;
    }) => exerciseService.submitAssignment(params.assignmentId, params.answers),
    onSuccess: () => {
      // Recharger la liste des exercices assignés (statut DONE, etc.)
      queryClient.invalidateQueries({
        queryKey: ['exercises', 'stagiaire', 'list'],
      });
      // Invalider aussi la progression
      queryClient.invalidateQueries({
        queryKey: ['exercises', 'stagiaire', 'progression'],
      });
    },
  });
};

// Récupérer les résultats d'une soumission (pour stagiaire)
export const useSubmissionResults = (submissionId: string | null) => {
  return useQuery<ExerciseSubmissionDetail, Error>({
    queryKey: ['exercises', 'stagiaire', 'submission', submissionId],
    queryFn: () => exerciseService.getSubmissionResults(submissionId as string),
    enabled: !!submissionId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Récupérer la progression globale du stagiaire
export const useProgression = () => {
  return useQuery({
    queryKey: ['exercises', 'stagiaire', 'progression'],
    queryFn: () => exerciseService.getProgression(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  });
};

// --- Côté formateur ---

// Lister les exercices créés par le formateur
export const useFormateurExercises = (params: {
  ccp?: string;
  published?: boolean;
} = {}) => {
  return useQuery<ExerciseTemplateSummary[], Error>({
    queryKey: ['exercises', 'formateur', params],
    queryFn: () => exerciseService.getFormateurExercises(params),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

// Récupérer le détail d'un exercice avec questions (pour formateur)
export const useFormateurExerciseDetail = (
  exerciseId: string | null,
  enabled: boolean = true,
) => {
  return useQuery<ExerciseTemplateDetail, Error>({
    queryKey: ['exercises', 'formateur', 'detail', exerciseId],
    queryFn: () => exerciseService.getFormateurExerciseDetail(exerciseId as string),
    enabled: enabled && !!exerciseId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Créer un exercice
export const useCreateExercise = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Omit<ExerciseTemplateDetail, 'id' | 'createdAt'>) =>
      exerciseService.createExercise(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['exercises', 'formateur'],
      });
    },
  });
};

// Modifier un exercice
export const useUpdateExercise = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      id: string;
      payload: Partial<Omit<ExerciseTemplateDetail, 'id' | 'createdAt'>>;
    }) => exerciseService.updateExercise(params.id, params.payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['exercises', 'formateur'],
      });
      // Invalider aussi le détail de cet exercice
      queryClient.invalidateQueries({
        queryKey: ['exercises', 'formateur', 'detail', variables.id],
      });
    },
  });
};

// Publier un exercice
export const usePublishExercise = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => exerciseService.publishExercise(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['exercises', 'formateur'],
      });
    },
  });
};

// Assigner un exercice à des stagiaires
export const useAssignExercise = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      id: string;
      stagiaireIds: string[];
      dueAt?: string | null;
    }) => exerciseService.assignExercise(params.id, {
      stagiaireIds: params.stagiaireIds,
      dueAt: params.dueAt,
    }),
    onSuccess: (_, variables) => {
      // Invalider les listes côté formateur et stagiaire
      queryClient.invalidateQueries({
        queryKey: ['exercises', 'formateur'],
      });
      queryClient.invalidateQueries({
        queryKey: ['exercises', 'stagiaire', 'list'],
      });
      // IMPORTANT: Invalider aussi le cache des assignations pour cet exercice
      queryClient.invalidateQueries({
        queryKey: ['exercises', 'assignments', variables.id],
      });
    },
  });
};

// Récupérer le détail d'une copie soumise
export const useSubmissionDetail = (submissionId: string | null) => {
  return useQuery<ExerciseSubmissionDetail, Error>({
    queryKey: ['submission', submissionId],
    queryFn: () => exerciseService.getSubmissionDetail(submissionId as string),
    enabled: !!submissionId,
    staleTime: 5 * 60 * 1000, // 5 minutes (données de soumission peu susceptibles de changer)
    refetchOnWindowFocus: false, // Éviter les refetch inutiles
  });
};

// Corriger une copie (score final, feedback, commentaires)
export const useReviewSubmission = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      submissionId: string;
      payload: ReviewSubmissionPayload;
    }) => exerciseService.reviewSubmission(params.submissionId, params.payload),
    onSuccess: (_, variables) => {
      // Invalider le cache pour recharger la copie corrigée
      queryClient.invalidateQueries({
        queryKey: ['submission', variables.submissionId],
      });
      queryClient.invalidateQueries({
        queryKey: ['submissions'],
      });
    },
  });
};

// Récupérer les assignations d'un exercice (pour voir qui a reçu l'exercice)
export const useExerciseAssignments = (
  exerciseId: string | null,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: ['exercises', 'assignments', exerciseId],
    queryFn: () => exerciseService.getExerciseAssignments(exerciseId as string),
    enabled: enabled && !!exerciseId,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
};

