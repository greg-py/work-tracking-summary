/**
 * Type definitions for the Weekly Jira Tracker
 */

// ============================================
// Jira API Types
// ============================================

/**
 * Jira content structure (for descriptions)
 */
export interface JiraContent {
  type?: string;
  text?: string;
  content?: JiraContent[];
}

/**
 * Raw Jira issue from API
 */
export interface JiraIssue {
  key: string;
  fields: {
    assignee: { displayName: string } | null;
    status: { name: string };
    created: string;
    summary: string;
    description: JiraContent | null;
    issuetype: { name: string };
    statuscategorychangedate: string;
    parent: { key: string; fields?: { summary: string } } | null;
    customfield_10026: number | null;
    labels?: string[];
    components?: { name: string }[];
  };
}

/**
 * Processed Jira issue with normalized fields
 */
export interface ProcessedIssue {
  ticketId: string;
  summary: string;
  assignee: string;
  status: string;
  created: string;
  daysInCurrentStatus: number;
  issueType: string;
  description: string;
  storyPoints: number | null;
  parent: string | null;
  parentSummary: string | null;
  labels: string[];
  components: string[];
  datePulled: string;
}

/**
 * Map of processed issues grouped by assignee
 */
export type ProcessedIssuesMap = Record<string, ProcessedIssue[]>;

// ============================================
// Categorized Ticket Types
// ============================================

/**
 * Progress status for categorized tickets
 */
export type ProgressStatus = "completed" | "continued" | "started";

/**
 * Simplified ticket representation for categorization
 */
export interface Ticket {
  ticketId: string;
  summary: string;
  status: string;
  daysInCurrentStatus: number;
  issueType: string;
  description: string;
  labels: string[];
  components: string[];
  parent: string | null;
  parentSummary: string | null;
  progressStatus: ProgressStatus;
}

/**
 * Tickets categorized by completion status
 */
export interface CategorizedTickets {
  completedItems: Ticket[];
  continuedItems: Ticket[];
  startedItems: Ticket[];
}

// ============================================
// Snapshot Comparison Types
// ============================================

/**
 * Represents changes between two snapshots
 */
export interface SnapshotDiff {
  /** Tickets that are new (not in previous snapshot) */
  newTickets: ProcessedIssue[];
  /** Tickets that changed status since previous snapshot */
  statusChanges: StatusChange[];
  /** Tickets that were completed this period */
  completedThisPeriod: ProcessedIssue[];
  /** Tickets that are no longer in current snapshot (removed or reassigned) */
  removedTickets: ProcessedIssue[];
}

/**
 * Represents a status change for a ticket
 */
export interface StatusChange {
  ticket: ProcessedIssue;
  previousStatus: string;
  currentStatus: string;
}

// ============================================
// LLM Context Types
// ============================================

/**
 * Enhanced ticket context for LLM processing
 * Includes all relevant information for generating summaries
 */
export interface TicketContext {
  ticketId: string;
  summary: string;
  description: string;
  progressStatus: ProgressStatus;
  labels: string[];
  components: string[];
  parentContext: string | null;
  daysInCurrentStatus: number;
}

/**
 * Grouped tickets ready for LLM processing
 */
export interface LLMTicketContext {
  completed: TicketContext[];
  continued: TicketContext[];
  started: TicketContext[];
  totalCount: number;
}

// ============================================
// Grooming Assignment Types
// ============================================

/**
 * A ticket that needs grooming/assignment
 */
export interface GroomingTicket {
  /** The Jira ticket key (e.g., "PY-11474") */
  ticketKey: string;
  /** The category from the PM message (e.g., "Meetings", "PostHog") */
  category: string;
  /** The ticket summary/title */
  summary: string;
  /** The full ticket description */
  description: string;
  /** Labels assigned to the ticket */
  labels: string[];
  /** Components the ticket belongs to */
  components: string[];
  /** Parent ticket key if this is a subtask */
  parent: string | null;
  /** Parent ticket summary if available */
  parentSummary: string | null;
}

/**
 * Profile of an engineer with their recent work history
 */
export interface EngineerProfile {
  /** Engineer's display name */
  name: string;
  /** Engineer's email address */
  email: string;
  /** Recent tickets the engineer has worked on */
  recentTickets: ProcessedIssue[];
  /** Number of tickets currently in progress */
  currentWorkload: number;
  /** Areas of specialization derived from recent work */
  specializations: string[];
}

/**
 * A recommendation for who should be assigned to a ticket
 */
export interface AssignmentRecommendation {
  /** The Jira ticket key */
  ticketKey: string;
  /** The category from the PM message */
  category: string;
  /** The ticket summary */
  summary: string;
  /** The recommended engineer's name */
  recommendedEngineer: string;
  /** Reasoning for the recommendation (included when verbose) */
  reasoning?: string;
  /** How many trials recommended this engineer (e.g., "4/5") */
  confidence?: string;
}

/**
 * Signal indicating an engineer has continuity on a grooming ticket's epic/parent
 */
export interface EpicContinuitySignal {
  /** The grooming ticket key */
  ticketKey: string;
  /** The parent/epic key that links this ticket to prior work */
  epicKey: string;
  /** The parent/epic summary */
  epicSummary: string | null;
  /** Engineer who has worked on sibling tickets under this epic */
  engineerName: string;
  /** Number of sibling tickets the engineer has worked on under this epic */
  siblingCount: number;
  /** Example sibling ticket keys the engineer worked on */
  siblingTickets: string[];
}

/**
 * Result of the grooming assignment process
 */
export interface GroomingResult {
  /** All assignment recommendations */
  recommendations: AssignmentRecommendation[];
  /** Engineer profiles used for analysis */
  engineerProfiles: EngineerProfile[];
  /** Tickets that couldn't be found in Jira */
  notFoundTickets: string[];
}
