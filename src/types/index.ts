export interface ParagraphBlock {
  type: 'paragraph';
  text: string;
}

export interface HeadingBlock {
  type: 'heading';
  text: string;
  level?: string | number;
}

export interface ListBlock {
  type: 'list';
  ordered?: boolean;
  items: string[];
}

export type ContentBlock = ParagraphBlock | HeadingBlock | ListBlock;

export interface QuestionOption {
  id: string;
  label: string;
}

export type InteractionType = 'single_choice' | 'multiple_choice';

export interface QuestionInteraction {
  type: InteractionType;
  options: QuestionOption[];
  correctOptionIds: string[];
}

export interface OptionExplanation {
  optionId: string;
  content: ContentBlock[];
}

export interface QuestionSource {
  name: string;
  locator: string;
  url: string;
}

export interface QuestionReview {
  status: string;
  notes: string[];
}

export interface Question {
  id: string;
  topicId: string;
  title: string;
  prompt: ContentBlock[];
  contextId: string | null;
  difficulty: string;
  interaction: QuestionInteraction;
  explanation: ContentBlock[];
  optionExplanations: OptionExplanation[];
  source: QuestionSource;
  review: QuestionReview;
  /** Rule-derived study tags (kept separate from original topicId) */
  derivedTags?: string[];
  /** Source/conversion notes applicable to this question */
  sourceNotes?: string[];
  /** 1-based ordinal index in original bank (1..110) */
  number?: number;
}

export interface TopicInfo {
  id: string;
  title: string;
  description: string;
}

export interface ConversionMetadata {
  inputName: string;
  coverage: string;
  notes: string[];
  unresolved: string[];
}

export interface ExtractionMetadata {
  sourceUrl: string;
  retrievedDate: string;
  timezone: string;
  questionCount: number;
  singleChoiceCount: number;
  multipleChoiceCount: number;
  sourceAuthor: string;
  note: string;
}

export interface QuestionBankRoot {
  schemaVersion: string;
  id: string;
  revision: number;
  title: string;
  subtitle?: string;
  description?: string;
  language: string;
  icon?: string;
  accent?: string;
  coverImage?: string;
  status?: string;
  topics: TopicInfo[];
  contexts: unknown[];
  questions: Question[];
  sources: unknown[];
  conversion: ConversionMetadata;
  extraction: ExtractionMetadata;
}

export interface DatasetValidationReport {
  isValid: boolean;
  errors: string[];
  totalQuestions: number;
  uniqueIdsCount: number;
  singleChoiceCount: number;
  multipleChoiceCount: number;
  multipleChoiceQuestions: Array<{ id: string; correctOptionIds: string[] }>;
  unresolvedReferencesCount: number;
}

export type StudyMode = 'study' | 'practice' | 'exam';

export interface AttemptRecord {
  id: string;
  questionId: string;
  selectedOptionIds: string[];
  correctOptionIds: string[];
  isCorrect: boolean;
  answeredAt: string;
  sessionId: string;
  mode: StudyMode;
  revealedBeforeCheck: boolean;
}

export interface SRSItemState {
  questionId: string;
  /** Current unassisted correct streak index (0..5) */
  streak: number;
  /** Current interval in days (1, 3, 7, 14, 30) */
  intervalDays: number;
  /** Calendar date YYYY-MM-DD in Asia/Ho_Chi_Minh */
  dueDate: string;
  lastReviewedAt: string;
  lastOutcome: 'correct_unassisted' | 'wrong' | 'revealed';
}

export interface CheckedQuestionState {
  isCorrect: boolean;
  revealedBeforeCheck: boolean;
  answeredAt: string;
  attemptId: string;
}

export interface ActiveSession {
  id: string;
  mode: StudyMode;
  title: string;
  filterLabel: string;
  questionOrder: string[];
  currentQuestionId: string;
  selections: Record<string, string[]>;
  checkedQuestions: Record<string, CheckedQuestionState>;
  revealedQuestions: Record<string, boolean>;
  flaggedQuestions: Record<string, boolean>;
  startedAt: string;
  /** Absolute epoch ms deadline for exam mode */
  deadline: number | null;
  durationMinutes: number | null;
  targetScorePercent: number | null;
  submittedAt: string | null;
  status: 'in_progress' | 'completed';
  autoSubmittedByTimeout?: boolean;
}

export interface SessionHistoryItem {
  id: string;
  mode: StudyMode;
  title: string;
  filterLabel: string;
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  scorePercent: number;
  targetScorePercent: number | null;
  passed: boolean | null;
  startedAt: string;
  submittedAt: string;
  durationSeconds: number;
  autoSubmittedByTimeout?: boolean;
  questionOrder: string[];
  selections: Record<string, string[]>;
  flaggedQuestions?: Record<string, boolean>;
}

export interface StudySessionProgress {
  currentQuestionId: string;
  filterType: QuestionFilterType;
  derivedTag: string;
  searchQuery: string;
  selectionsByQuestion: Record<string, string[]>;
  checkedByQuestion: Record<string, { checked: boolean; revealedBeforeCheck: boolean }>;
  updatedAt: string;
}

export interface CustomExamPack {
  id: string;
  name: string;
  questionIds: string[];
  durationMinutes: number;
  targetScorePercent: number;
  shuffleQuestions: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AppProgressState {
  schemaVersion: number;
  courseId: string;
  courseRevision: number;
  viewedQuestions: Record<string, string>;
  bookmarks: Record<string, boolean>;
  notes: Record<string, string>;
  attempts: AttemptRecord[];
  srs: Record<string, SRSItemState>;
  activeSession: ActiveSession | null;
  studyProgress: StudySessionProgress | null;
  lastActiveTab?: NavigationTab;
  sessionHistory: SessionHistoryItem[];
  customExamPacks: CustomExamPack[];
  lastStudiedQuestionId: string | null;
  updatedAt: string;
}

export interface BackupPayload {
  backupFormatVersion: number;
  exportedAt: string;
  courseId: string;
  courseRevision: number;
  questionCount: number;
  data: AppProgressState;
}

export interface BackupPreview {
  isValid: boolean;
  errors: string[];
  exportedAt?: string;
  courseId?: string;
  courseRevision?: number;
  counts?: {
    viewedCount: number;
    answeredQuestionsCount: number;
    totalAttemptsCount: number;
    bookmarksCount: number;
    notesCount: number;
    srsCount: number;
    sessionsCount: number;
  };
  payload?: BackupPayload;
}

export type NavigationTab =
  | 'overview'
  | 'study'
  | 'practice'
  | 'exam'
  | 'review'
  | 'admin';

export interface AuthUser {
  username: string;
  displayName: string;
  role: 'admin' | 'user';
  createdAt: string;
  lastLoginAt: string;
}

export interface UserTelemetrySummary {
  ipAddress: string;
  location: string;
  userAgent: string;
  os: string;
  browser: string;
  deviceType: 'Desktop' | 'Mobile' | 'Tablet';
  screenResolution?: string;
  viewport?: string;
  language?: string;
  timezone?: string;
  cpuCores?: number | null;
  deviceMemoryGb?: number | null;
  currentTab?: string;
  activityStatus?: string;
  currentQuestionId?: string | null;
  liveExamState?: {
    mode: string;
    title: string;
    currentQuestionIndex: number;
    totalQuestions: number;
    answeredCount: number;
    remainingSeconds: number | null;
    startedAt: string;
  } | null;
  lastSeenAt: string;
}

export interface AdminLearnerReport {
  username: string;
  displayName: string;
  role: 'admin' | 'user';
  createdAt: string;
  lastLoginAt: string;
  updatedAt: string;
  isOnline?: boolean;
  isRecentlyActive?: boolean;
  secondsSinceLastSeen?: number;
  telemetry?: UserTelemetrySummary | null;
  ipHistory?: Array<{ ip: string; device: string; seenAt: string }>;
  viewedCount: number;
  bookmarksCount: number;
  notesCount: number;
  attempts: AttemptRecord[];
  sessionHistory: SessionHistoryItem[];
  activeSession: ActiveSession | null;
}

export type QuestionFilterType =
  | 'all'
  | 'unanswered'
  | 'answered'
  | 'wrong_latest'
  | 'wrong_ever'
  | 'correct_latest'
  | 'bookmarked'
  | 'due'
  | 'viewed_unanswered'
  | 'multiple_choice'
  | 'has_note';
