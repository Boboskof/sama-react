import Axios from './caller.service';
import type {
  ExerciseAssignmentSummary,
  ExerciseAssignmentStatus,
  ExerciseTemplateDetail,
  ExerciseTemplateSummary,
  ExerciseSubmissionDetail,
  ExerciseType,
  ReviewSubmissionPayload,
  ReviewSubmissionResponse,
} from '../types/api';

const exerciseService = {
  // Liste des exercices assignés au stagiaire
  async getStagiaireExercises(): Promise<ExerciseAssignmentSummary[]> {
    const res = await Axios.get('/stagiaires/exercises');
    const raw = res.data;
    const list = Array.isArray(raw?.data) ? raw.data : raw;
    return Array.isArray(list) ? list : [];
  },

  // Détail d'un exercice (questions, config, etc.) pour un stagiaire
  async getExerciseDetail(exerciseId: string): Promise<ExerciseTemplateDetail> {
    const res = await Axios.get(`/stagiaires/exercises/${exerciseId}`);
    const data = res.data ?? {};
    return data as ExerciseTemplateDetail;
  },

  // Démarrer un exercice pour un assignment donné
  async startAssignment(assignmentId: string): Promise<{ message: string }> {
    const res = await Axios.post(
      `/stagiaires/exercises/assignments/${assignmentId}/start`,
      {},
    );
    return res.data;
  },

  // Soumettre les réponses d'un exercice
  async submitAssignment(
    assignmentId: string,
    answers: Array<{ questionId: string; answer: any }>,
  ): Promise<{
    message: string;
    submissionId: string;
    autoScore: number;
    maxScore: number;
  }> {
    const res = await Axios.post(
      `/stagiaires/exercises/assignments/${assignmentId}/submit`,
      { answers },
    );
    return res.data;
  },

  // Récupérer les résultats d'une soumission (pour stagiaire)
  async getSubmissionResults(submissionId: string): Promise<ExerciseSubmissionDetail> {
    const res = await Axios.get(`/stagiaires/exercises/submissions/${submissionId}`);
    return res.data as ExerciseSubmissionDetail;
  },

  // Récupérer la progression globale du stagiaire
  async getProgression(): Promise<{
    data: Array<{
      assignmentId: string;
      status: ExerciseAssignmentStatus;
      exercise: {
        id: string;
        title: string;
        type: ExerciseType;
        ccpCode: string | null;
      };
      submission?: {
        id: string;
        submittedAt: string;
        autoScore: number;
        maxScore: number;
        finalScore: number | null;
        isCorrected: boolean;
      } | null;
    }>;
  }> {
    const res = await Axios.get('/stagiaires/exercises/profile/progression');
    return res.data;
  },

  // --- Côté formateur ---

  // Lister les exercices créés par le formateur
  async getFormateurExercises(params: {
    ccp?: string;
    published?: boolean;
  } = {}): Promise<ExerciseTemplateSummary[]> {
    const res = await Axios.get('/formateurs/exercises', {
      params: {
        ...(params.ccp ? { ccp: params.ccp } : {}),
        ...(typeof params.published === 'boolean'
          ? { published: params.published }
          : {}),
      },
    });
    const raw = res.data;
    const list = Array.isArray(raw?.data) ? raw.data : raw;
    return Array.isArray(list) ? list : [];
  },

  // Créer un exercice (structure similaire à ExerciseTemplateDetail, sans id / createdAt)
  async createExercise(
    payload: Omit<ExerciseTemplateDetail, 'id' | 'createdAt'>,
  ): Promise<{ id: string }> {
    const res = await Axios.post('/formateurs/exercises', payload);
    return res.data as { id: string };
  },

  // Récupérer le détail d'un exercice avec questions (pour formateur)
  async getFormateurExerciseDetail(exerciseId: string): Promise<ExerciseTemplateDetail> {
    const res = await Axios.get(`/formateurs/exercises/${exerciseId}`);
    return res.data as ExerciseTemplateDetail;
  },

  // Modifier un exercice existant
  async updateExercise(
    id: string,
    payload: Partial<Omit<ExerciseTemplateDetail, 'id' | 'createdAt'>>,
  ): Promise<void> {
    await Axios.patch(`/formateurs/exercises/${id}`, payload);
  },

  // Publier un exercice
  async publishExercise(id: string): Promise<{ message: string }> {
    const res = await Axios.post(`/formateurs/exercises/${id}/publish`, {});
    return res.data as { message: string };
  },

  // Assigner un exercice à des stagiaires
  async assignExercise(
    id: string,
    body: { stagiaireIds: string[]; dueAt?: string | null },
  ): Promise<{ message: string; assignments: string[] }> {
    const res = await Axios.post(`/formateurs/exercises/${id}/assign`, body);
    return res.data as { message: string; assignments: string[] };
  },

  // Récupérer le détail d'une copie soumise
  async getSubmissionDetail(submissionId: string): Promise<ExerciseSubmissionDetail> {
    const res = await Axios.get(`/formateurs/submissions/${submissionId}`);
    return res.data as ExerciseSubmissionDetail;
  },

  // Corriger une copie (score final, feedback, commentaires)
  async reviewSubmission(
    submissionId: string,
    payload: ReviewSubmissionPayload,
  ): Promise<ReviewSubmissionResponse> {
    const res = await Axios.post(
      `/formateurs/submissions/${submissionId}/review`,
      payload,
    );
    return res.data as ReviewSubmissionResponse;
  },

  // Récupérer les assignations d'un exercice (optionnel, pour voir qui a reçu l'exercice)
  async getExerciseAssignments(exerciseId: string): Promise<{
    assignments: Array<{
      id: string;
      stagiaire: { id: string; prenom: string; nom: string; email: string };
      status: ExerciseAssignmentStatus;
      dueAt?: string | null;
      createdAt: string;
      hasSubmission?: boolean;
      submissionsCount?: number;
      lastSubmission?: {
        id: string;
        submittedAt: string;
        autoScore: number;
        finalScore?: number | null;
        maxScore?: number;
        isReviewed?: boolean;
      };
      submission?: {
        id: string;
        submittedAt: string;
        autoScore: number;
        finalScore?: number | null;
        maxScore?: number;
      };
    }>;
    statistics?: {
      totalAssignments: number;
      totalSubmissions: number;
      completionRate: number;
      statusCounts?: Record<string, number>;
    };
  }> {
    try {
      const res = await Axios.get(`/formateurs/exercises/${exerciseId}/assignments`);
      const data = res.data;
      
      // Normaliser la structure de réponse (support plusieurs formats)
      let assignments: any[] = [];
      let statistics: any = undefined;
      
      if (Array.isArray(data)) {
        // Si la réponse est directement un tableau
        assignments = data;
      } else if (data?.assignments && Array.isArray(data.assignments)) {
        // Si la réponse est { assignments: [...] }
        assignments = data.assignments;
        statistics = data.statistics;
      } else if (data?.data && Array.isArray(data.data)) {
        // Si la réponse est { data: [...], statistics: {...} }
        assignments = data.data;
        statistics = data.statistics;
      } else if (data?.['hydra:member'] && Array.isArray(data['hydra:member'])) {
        // Support Hydra (API Platform)
        assignments = data['hydra:member'];
        statistics = data['hydra:totalItems'] !== undefined ? {
          totalAssignments: data['hydra:totalItems'],
        } : undefined;
      } else {
        console.warn('Format de réponse inattendu pour getExerciseAssignments:', data);
        assignments = [];
      }
      
      return { assignments, ...(statistics ? { statistics } : {}) };
    } catch (error: any) {
      // Logger l'erreur complète pour déboguer
      console.error('Erreur lors de la récupération des assignations:', {
        exerciseId,
        error: error?.response?.data || error?.message || error,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      
      // Si l'endpoint n'existe pas encore ou erreur 404, retourner un objet vide
      if (error?.response?.status === 404) {
        console.warn(`Endpoint /formateurs/exercises/${exerciseId}/assignments non trouvé (404)`);
      }
      return { assignments: [] };
    }
  },
};

export default exerciseService;

