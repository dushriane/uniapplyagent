// ─────────────────────────────────────────────────────────────────────────────
// UniApply Agent — Shared TypeScript Types
// ─────────────────────────────────────────────────────────────────────────────

// ── Enumerations ─────────────────────────────────────────────────────────────

export type UniversityStatus =
  | 'Exploratory'
  | 'Researching'
  | 'Applying'
  | 'Submitted'
  | 'Admitted'
  | 'Rejected'
  | 'Waitlisted'
  | 'Deferred'
  | 'Archived';

export type SchoolSize = 'Small' | 'Medium' | 'Large' | 'Very Large';
export type CostRange = 'Under $30k' | '$30k–$45k' | '$45k–$60k' | 'Over $60k';
export type Priority = 'Safety' | 'Match' | 'Reach' | 'Dream';
export type FlexLevel = 'High' | 'Medium' | 'Low';
export type AdvisingStrength = 'Excellent' | 'Good' | 'Fair' | 'Poor';
export type TaskStatus = 'Not Started' | 'In Progress' | 'Completed' | 'Overdue' | 'Waived';
export type EssayStatus =
  | 'Not Started'
  | 'Brainstorming'
  | 'Drafting'
  | 'In Review'
  | 'Polished'
  | 'Submitted';

export type DocumentType =
  | 'Personal Statement'
  | 'Supplemental Essay'
  | 'Resume'
  | 'Transcript'
  | 'Test Scores'
  | 'Letter of Recommendation'
  | 'Financial Aid'
  | 'Portfolio'
  | 'Other';

export type InterestType = 'Major' | 'Field' | 'Career' | 'Activity' | 'Value' | 'Course Topic';
export type InterestSource =
  | 'Article'
  | 'Video'
  | 'Quiz'
  | 'Conversation'
  | 'Personal'
  | 'Class'
  | 'Internship'
  | 'Email'
  | 'Clip';

export type LogActionType =
  | 'Read'
  | 'Write'
  | 'Email Parsed'
  | 'Email Draft'
  | 'Calendar'
  | 'Scoring'
  | 'Setup'
  | 'Archive'
  | 'AI Analysis';

// ── Core Domain Models ────────────────────────────────────────────────────────

export interface StudentPreferences {
  locationPreferences: string[];         // e.g. ["Northeast", "California"]
  maxDistance?: number;                  // miles from home
  schoolSizePreference?: SchoolSize[];
  maxTuition?: number;                   // annual sticker price
  undecidedFriendly: boolean;
  strongAdvising: boolean;
  liberalArtsFocus?: boolean;
  researchOpportunities?: boolean;
  targetRegions?: string[];
  gpa?: number;
  satScore?: number;
  actScore?: number;
  targetApplicationCount?: number;
  safetyCount?: number;
  matchCount?: number;
  reachCount?: number;

  // ── Phase 3: Balanced optional intake fields (all skippable) ──────────
  intendedMajors?: string[];             // e.g. ["Computer Science", "Philosophy"]
  testOptional?: boolean;                // true if test-optional schools are acceptable
  learningStyle?: string;                // e.g. "Collaborative", "Lecture-based"
  financialAidNeed?: number;             // 0–100, percent of cost student needs covered
  campusSetting?: 'Urban' | 'Suburban' | 'Rural';
  preferredClimate?: string;             // e.g. "Temperate", "Warm"
  distanceFromHome?: number;             // max miles acceptable
  advisingNeedLevel?: 'Low' | 'Medium' | 'High';
  accessibilityNeeds?: string;           // e.g. "Wheelchair accessible"
  communicationPreference?: 'Email' | 'SMS' | 'Both';
}

export interface University {
  notionId?: string;
  name: string;
  url?: string;
  location: string;
  state?: string;
  country?: string;
  size?: SchoolSize;
  costRange?: CostRange;
  tuition?: number;
  fitScore?: number;                     // 0–100, computed by FitScorer
  status: UniversityStatus;
  applicationDeadline?: Date;
  earlyDeadline?: Date;
  notes?: string;
  tags?: string[];
  priority?: Priority;
  portalUrl?: string;
  acceptanceRate?: number;              // 0–1
  undecidedFriendly?: boolean;
  curriculumFlexibility?: FlexLevel;
  advisingStrength?: AdvisingStrength;
  earlyDeclarationRequired?: boolean;
  firstYearFlexibility?: boolean;
  openCurriculum?: boolean;
}

export interface Program {
  notionId?: string;
  name: string;
  universityId?: string;
  universityName?: string;
  field: string;
  subfield?: string;
  undecidedFriendly: boolean;
  earlyDeclarationRequired: boolean;
  curriculumFlexibility: FlexLevel;
  advisingStrength?: AdvisingStrength;
  relatedFields?: string[];
  notes?: string;
  tags?: string[];
  url?: string;
}

export interface Essay {
  notionId?: string;
  title: string;
  universityId?: string;
  universityName?: string;
  type: DocumentType;
  prompt?: string;
  status: EssayStatus;
  wordLimit?: number;
  wordCount?: number;
  dueDate?: Date;
  driveLink?: string;
  notes?: string;
}

export interface Task {
  notionId?: string;
  title: string;
  universityId?: string;
  universityName?: string;
  type:
    | 'Application'
    | 'Essay'
    | 'Recommendation'
    | 'Document'
    | 'Interview'
    | 'Decision'
    | 'Financial Aid'
    | 'Campus Visit'
    | 'Other';
  status: TaskStatus;
  dueDate?: Date;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  notes?: string;
  emailThreadLink?: string;
  calendarEventId?: string;
}

export interface Interest {
  notionId?: string;
  title: string;
  type: InterestType;
  source: InterestSource;
  field?: string;
  subfield?: string;
  relatedProgramIds?: string[];
  notes?: string;
  dateAdded: Date;
  tags?: string[];
  url?: string;
  strength?: number;                     // 1–5 subjective weight
}

export interface ActivityLogEntry {
  notionId?: string;
  action: string;                        // human-readable description
  agentAction: string;                   // machine-readable identifier
  type: LogActionType;
  target: string;                        // what was affected
  status: 'Completed' | 'Pending' | 'Failed' | 'Skipped (User)';
  timestamp: Date;
  details?: string;
}

// ── Computed / Derived Types ──────────────────────────────────────────────────

export interface FitScoreBreakdown {
  total: number;                          // 0–100
  undecidedFriendlyPoints: number;        // 0–30
  curriculumFlexibilityPoints: number;    // 0–25
  advisingStrengthPoints: number;         // 0–25
  noEarlyDeclarationPoints: number;       // 0–20
  label: 'Excellent Fit' | 'Good Fit' | 'Fair Fit' | 'Poor Fit';
  strengths: string[];
  weaknesses: string[];
}

export interface InterestPattern {
  field: string;
  count: number;
  avgStrength: number;
  relatedFields: string[];
  suggestedPrograms: string[];
  insight: string;
}

export interface DeadlineAlert {
  university: University;
  task?: Task;
  daysUntilDeadline: number;
  urgency: 'Critical' | 'High' | 'Medium' | 'Low';
  message: string;
}

export interface WeeklyDigest {
  weekOf: Date;
  newUniversities: number;
  newInterests: number;
  tasksCompleted: number;
  tasksPending: number;
  upcomingDeadlines: DeadlineAlert[];
  topUndecidedMatches: University[];
  interestHighlights: InterestPattern[];
  suggestions: string[];
  notionPageId?: string;
}

export interface HealthReport {
  generatedAt: Date;
  overallScore: number;                  // 0–100
  totalUniversities: number;
  byStatus: Partial<Record<UniversityStatus, number>>;
  essayCompletionPct: number;
  tasksOverdue: number;
  tasksDueSoon: number;                  // next 7 days
  gaps: string[];
  recommendations: string[];
  streakDays: number;                    // consecutive activity days
  notionPageId?: string;
}

export interface ComparisonResult {
  universities: University[];
  criteria: Record<string, Record<string, string | number | boolean | undefined>>;
  winner?: string;
  undecidedRecommendation?: string;
  narrative: string;
  notionPageId?: string;
}

export interface EssayPersonalization {
  originalText: string;
  personalizedText: string;
  changes: string[];
  schoolSpecificPoints: string[];
  suggestedAnecdoteThemes: string[];
  wordCount: number;
  targetSchool: string;
  notionPageId?: string;
}

// ── Infrastructure Types ──────────────────────────────────────────────────────

export interface DatabaseIds {
  universities?: string;
  programs?: string;
  essays?: string;
  tasks?: string;
  interests?: string;
  activityLog?: string;
  settingsPageId?: string;
  dashboardPageId?: string;
}

export interface AgentConfig {
  notionToken: string;
  openaiApiKey?: string;
  gmailUser?: string;
  databaseIds: DatabaseIds;
  preferences: StudentPreferences;
  readOnlyMode: boolean;
  noAutoSend: boolean;
  scheduleEnabled: boolean;
}

export interface ConfirmationRequest {
  action: string;
  description: string;
  impact: string;
  reversible: boolean;
  data?: Record<string, unknown>;
}

export type ConfirmationResult = 'approved' | 'rejected' | 'modified';
