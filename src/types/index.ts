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
    parent: { key: string } | null;
    customfield_10026: number | null;
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
 * Simplified ticket representation for categorization
 */
export interface Ticket {
  ticketId: string;
  summary: string;
  status: string;
  daysInCurrentStatus: number;
  issueType: string;
  description: string;
}

/**
 * Tickets categorized by completion status
 */
export interface CategorizedTickets {
  completedItems: Ticket[];
  continuedItems: Ticket[];
  startedItems: Ticket[];
}

