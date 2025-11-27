// src/types/api.ts
export type ID = string | number;

export type User = {
  id: ID;
  email: string;
  password?: string;
  prenom?: string;           // Prénom de l'utilisateur (100 chars)
  nom?: string;              // Nom de famille de l'utilisateur (100 chars)
  statut?: boolean;          // Statut actif/inactif (default: true)
  roles: string[];           // Rôles de l'utilisateur (json)
  createdAt?: string;        // Date de création du compte (datetime_immutable)
  typeStagiaire?: string;    // Type de stagiaire (enum TypeStagiaire, nullable)
  section?: string;          // Section de formation (100 chars, nullable)
  primaryRole?: string;      // Rôle principal (32 chars, nullable)
  
  // Relations
  auditLogs?: any[];         // Collection<AuditLog>
  patients?: any[];          // Collection<Patient>
  rendezVous?: any[];        // Collection<RendezVous>
  documents?: any[];         // Collection<Document>
  communications?: any[];    // Collection<Communication>
  medecins?: any[];          // Collection<Medecin>
};

export type Patient = {
  id: ID;
  
  // Champs principaux de l'entité Patient (selon l'entité Symfony réelle)
  numeroSecu?: string;        // Numéro de sécurité sociale (20 chars, unique, nullable)
  organismeSecu?: string;     // Organisme de sécurité sociale (100 chars, nullable)
  prenom: string;             // Prénom du patient (100 chars) - REQUIS
  nom: string;                // Nom de famille du patient (100 chars) - REQUIS
  genre: string;              // Genre du patient (enum Genre: Mr, Mme, Dr, etc.) - REQUIS
  dateNaissance: string;       // Date de naissance du patient (date) - REQUIS
  email?: string;             // Adresse email du patient (180 chars, nullable)
  telephone?: string;         // Numéro de téléphone du patient (30 chars, nullable)
  adresseL1?: string;         // Première ligne d'adresse (255 chars, nullable)
  adresseL2?: string;         // Deuxième ligne d'adresse (255 chars, nullable)
  codePostal?: string;        // Code postal (12 chars, nullable)
  ville?: string;             // Ville de résidence (120 chars, nullable)
  notes?: string;             // Notes médicales et observations (text, nullable)
  createdAt?: string;         // Date de création du dossier (datetime_immutable)
  updatedAt?: string;         // Date de dernière modification (datetime)
  
  // Relations
  createdBy?: any;            // User qui a créé le patient
  created_by?: any;           // Alternative backend
  creator?: any;              // Alternative backend
  user_id?: any;              // Alternative backend
  
  // Relations (collections)
  rendezVous?: any[];         // Collection<RendezVous>
  documents?: any[];          // Collection<Document>
  communications?: any[];     // Collection<Communication>
  couvertures?: any[];        // Collection<Couverture>
};

export type Medecin = {
  id: ID;
  nom?: string;              // Nom du médecin (100 chars)
  prenom?: string;           // Prénom du médecin (100 chars)
  specialite?: string;       // Spécialité médicale (100 chars, nullable)
  emailPro?: string;        // Email professionnel (180 chars, nullable)
  phonePro?: string;         // Téléphone professionnel (30 chars, nullable)
  disponible?: boolean;      // Statut de disponibilité (default: true)
  
  // Relations
  createdBy?: any;           // User qui a créé le médecin
};

export type AppointmentStatus = "pending" | "confirmed" | "canceled" | "unknown";

export type RendezVous = {
  id: ID;
  startAt?: string;         // Date et heure de début (datetime)
  endAt?: string;           // Date et heure de fin (datetime)
  motif?: string;           // Motif du rendez-vous (255 chars, nullable)
  notes?: string;           // Notes complémentaires (text, nullable)
  statut?: string;          // Statut du rendez-vous (enum StatutRendezVous)
  createdAt?: string;       // Date de création (datetime_immutable)
  updatedAt?: string;       // Date de dernière modification (datetime)
  
  // Relations
  patient?: Patient;        // Patient concerné
  medecin?: Medecin;        // Médecin assigné (nullable)
  createdBy?: any;          // User qui a créé le RDV (nullable)
  communications?: any[];   // Collection<Communication>
};

export type AuditActivity = {
  id: ID;
  description: string;
  createdAt?: string; // ISO
};

export type AuditStats = {
  activeFiles: number;
  upcomingAppointments: number;
  pendingDocuments: number;
  notifications: number;
};

export type Communication = {
  id: ID;
  type?: string;            // Type de communication (enum TypeCommunication)
  canal?: string;           // Canal de communication (enum CanalCommunication)
  toEmail?: string;         // Email destinataire (180 chars, nullable)
  toPhone?: string;         // Téléphone destinataire (30 chars, nullable)
  sujet?: string;           // Sujet de la communication (180 chars, nullable)
  contenu?: string;         // Contenu du message (text, nullable)
  statut?: string;          // Statut de la communication (enum StatutCommunication)
  sentAt?: string;          // Date d'envoi (datetime, nullable)
  createdAt?: string;       // Date de création (datetime_immutable)
  
  // Relations
  patient?: Patient;        // Patient destinataire
  rendezVous?: any;         // RendezVous lié (nullable)
  createdBy?: any;          // User qui a créé (nullable)
  template?: any;           // Template utilisé (Notification, nullable)
};

export type Document = {
  id: ID;
  type?: string;            // Type de document médical (enum TypeDocument)
  fileName?: string;        // Nom du fichier stocké (255 chars)
  mimeType?: string;        // Type MIME du fichier (100 chars)
  size?: number;            // Taille du fichier en octets (integer)
  originalName?: string;    // Nom original du fichier (255 chars)
  archived?: boolean;       // Statut d'archivage (default: false)
  archivedAt?: string;      // Date d'archivage (datetime, nullable)
  tags?: any;              // Tags pour catégorisation (json, nullable)
  createdAt?: string;       // Date d'upload (datetime_immutable)
  updatedAt?: string;      // Date de dernière modification (datetime)
  
  // Relations
  patient?: Patient;        // Patient propriétaire du document
  uploadedBy?: any;         // User qui a uploadé (nullable)
};

// Type pour les réponses API avec pagination
export type ApiResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

// Type pour les réponses API simples (sans pagination)
export type SimpleApiResponse<T> = T[];

// Autres entités
export type Mutuelle = {
  id: ID;
  nom?: string;             // Nom complet de la mutuelle/organisme (120 chars)
  type?: string;           // Type de couverture (20 chars: AMO, AMC, CSS, AUTRE)
  code?: string;           // Code court de la mutuelle (10 chars, nullable)
  numeroAdherent?: string; // Numéro d'adhérent de la mutuelle (50 chars, nullable)
  active?: boolean;        // Statut actif/inactif (default: true)
  
  // Relations
  couvertures?: any[];     // Collection<Couverture>
};

export type Couverture = {
  id: ID;
  numeroAdherent: string;   // Numéro d'adhérent/contrat (50 chars) - REQUIS
  dateDebut?: string;       // Date de début de validité (date, nullable)
  dateFin?: string;         // Date de fin de validité (date, nullable)
  valide?: boolean;         // Statut valide/invalide (default: true)
  
  // Relations
  patient?: Patient;       // Patient propriétaire de cette couverture
  mutuelle?: Mutuelle;     // Mutuelle/organisme de cette couverture
};

export type Notification = {
  id: ID;
  code?: string;           // Code unique du template (50 chars, unique)
  libelle?: string;        // Libellé du template (100 chars)
  canalParDefaut?: string; // Canal par défaut (20 chars)
  sujet?: string;          // Sujet du template (180 chars)
  corps?: string;          // Corps du message (text)
  
  // Relations
  communications?: any[];  // Collection<Communication>
};

// ---- Exercices / entraînement ----

export type ExerciseType = 'QCM' | 'CAS_PRATIQUE' | 'TRANSCRIPTION' | 'ETUDE_DOCUMENT';

export type ExerciseAssignmentStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'REVIEWED';

export interface ExerciseTemplateSummary {
  id: string;
  title: string;
  description?: string | null;
  type: ExerciseType;
  difficulty: number; // 1–5
  estimatedDurationMinutes?: number | null;
  ccpCode?: string | null;
  competences?: any[] | null; // JSON libre
  isPublished: boolean;
  createdAt: string; // "YYYY-MM-DD HH:MM:SS"
  // Statistiques de réutilisation (optionnelles, fournies par le backend si disponible)
  assignmentsCount?: number;
  submissionsCount?: number;
}

export interface ExerciseQuestion {
  id: string;
  position: number;
  type: 'QCM' | 'TEXTE' | 'CASE_A_COCHER';
  prompt: string;
  config?: any;      // options, etc.
  maxScore: number;
}

export interface ExerciseTemplateDetail extends ExerciseTemplateSummary {
  questions: ExerciseQuestion[];
}

export interface ExerciseAssignmentSummary {
  assignmentId: string;
  status: ExerciseAssignmentStatus;
  dueAt?: string | null;     // "YYYY-MM-DD HH:MM:SS"
  createdAt: string;
  exercise: {
    id: string;
    title: string;
    type: ExerciseType;
    difficulty: number;
    estimatedDurationMinutes?: number | null;
    ccpCode?: string | null;
  };
}

export interface ExerciseAnswerDetail {
  id: string;
  questionId: string;
  question: {
    position: number;
    type: 'QCM' | 'TEXTE' | 'CASE_A_COCHER';
    prompt: string;
    config: any | null; // contient les options QCM, bonnes réponses, etc.
    maxScore: number;
  };
  answer: any; // format dépend du type : { selected: [...] } pour QCM, { text: "..." } pour TEXTE
  autoScore: number;
  trainerComment: string | null;
}

export interface ExerciseSubmissionDetail {
  id: string;
  submittedAt: string; // "YYYY-MM-DD HH:MM:SS"
  autoScore: number;
  maxScore: number;
  finalScore: number | null;
  trainerFeedback: string | null;
  validatedBy: {
    id: string;
    email: string;
    nom: string;
    prenom: string;
  } | null;
  stagiaire: {
    id: string;
    email: string;
    nom: string;
    prenom: string;
  };
  exercise: {
    id: string;
    title: string;
    type: ExerciseType;
  };
  answers: ExerciseAnswerDetail[];
}

export interface ReviewSubmissionPayload {
  finalScore?: number;
  trainerFeedback?: string;
  answers?: Array<{
    answerId: string;
    autoScore?: number;  // Pour ajuster le score automatique de chaque réponse
    trainerComment?: string;
  }>;
}

export interface ReviewSubmissionResponse {
  message: string;
  finalScore: number;
}

export type AuditLog = {
  id: ID;
  action?: string;         // Action effectuée (64 chars: CREATE, UPDATE, DELETE, SEND...)
  entityType?: string;     // Type d'entité concernée (64 chars)
  entityId?: string;       // ID de l'entité concernée (36 chars)
  payload?: any;           // Données de l'action (json, nullable)
  message?: string;        // Message prêt à l'emploi (si exposé côté back)
  // Nouveau format uniformisé côté back pour les transitions
  before?: Record<string, unknown>; // sous-ensemble des champs pertinents avant
  after?: Record<string, unknown>;  // sous-ensemble des champs pertinents après
  metadata?: { patient_id?: string; [k: string]: unknown }; // métadonnées (contient toujours patient_id)
  ip?: string;             // Adresse IP (64 chars, nullable)
  createdAt?: string;      // Date de l'action (datetime_immutable)
  
  // Relations
  user?: any;              // User qui a effectué l'action (nullable)
};

export type StagiaireNote = {
  id: ID;
  contenu: string;         // Contenu de la note (texte libre)
  categorie: 'GENERAL' | 'FEEDBACK' | 'ALERTE' | 'INFORMATION'; // Catégorie de la note
  importance: 'INFO' | 'WARNING' | 'URGENT'; // Niveau d'importance
  createdAt?: string;      // Date de création (datetime_immutable)
  
  // Relations
  formateur?: {            // Formateur auteur de la note
    id: string;
    nom: string;
    prenom: string;
    email?: string;
  };
  stagiaire?: {           // Stagiaire destinataire de la note
    id: string;
    nom: string;
    prenom: string;
  };
};
