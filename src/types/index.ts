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
