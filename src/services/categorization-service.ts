import {
  ProcessedIssue,
  Ticket,
  CategorizedTickets,
  ProgressStatus,
} from "../types";
import { AppConfig } from "../config/config";

/**
 * Configuration options for the categorization service
 */
export interface CategorizationConfig {
  /** Number of days used as threshold for categorization */
  thresholdDays: number;
  /** Issue types to exclude from summaries (lowercase) */
  excludedIssueTypes: string[];
  /** Whether to include sub-tasks in output */
  includeSubTasks: boolean;
}

/**
 * Service responsible for categorizing tickets based on status and time
 */
export class CategorizationService {
  private readonly config: CategorizationConfig;

  constructor(appConfig?: AppConfig) {
    this.config = {
      thresholdDays: appConfig?.categorizationThresholdDays ?? 7,
      excludedIssueTypes: appConfig?.excludedIssueTypes ?? [],
      includeSubTasks: appConfig?.includeSubTasks ?? true,
    };
  }

  /**
   * Categorizes tickets into completed, continued, and started items
   * @param tickets - Array of processed issues to categorize
   * @returns Categorized tickets organized by status
   */
  categorizeTickets(tickets: ProcessedIssue[]): CategorizedTickets {
    const completedItems: Ticket[] = [];
    const continuedItems: Ticket[] = [];
    const startedItems: Ticket[] = [];

    // Build a map of parent tickets for sub-task aggregation
    const parentTicketMap = this.buildParentTicketMap(tickets);

    tickets.forEach((ticket) => {
      // Skip excluded issue types
      if (this.isExcludedIssueType(ticket.issueType)) {
        return;
      }

      // Handle sub-tasks based on configuration
      if (this.isSubTask(ticket.issueType)) {
        if (!this.config.includeSubTasks) {
          return;
        }
        // Sub-tasks are included but with parent context enriched
      }

      // Determine progress status
      let progressStatus: ProgressStatus;
      if (this.isCompleted(ticket)) {
        progressStatus = "completed";
      } else if (this.isContinued(ticket)) {
        progressStatus = "continued";
      } else if (this.isStarted(ticket)) {
        progressStatus = "started";
      } else {
        // Skip tickets that don't fit any category (e.g., TO DO status)
        return;
      }

      // Create categorized ticket with progress status
      const categorizedTicket = this.toTicket(ticket, progressStatus);

      // Add to appropriate category
      switch (progressStatus) {
        case "completed":
          completedItems.push(categorizedTicket);
          break;
        case "continued":
          continuedItems.push(categorizedTicket);
          break;
        case "started":
          startedItems.push(categorizedTicket);
          break;
      }
    });

    return { completedItems, continuedItems, startedItems };
  }

  /**
   * Builds a map of parent ticket IDs to their details for sub-task enrichment
   */
  private buildParentTicketMap(
    tickets: ProcessedIssue[]
  ): Map<string, ProcessedIssue> {
    const parentMap = new Map<string, ProcessedIssue>();
    tickets.forEach((ticket) => {
      parentMap.set(ticket.ticketId, ticket);
    });
    return parentMap;
  }

  /**
   * Checks if an issue type should be excluded
   */
  private isExcludedIssueType(issueType: string): boolean {
    const normalizedType = issueType.toLowerCase();
    return this.config.excludedIssueTypes.some(
      (excluded) =>
        normalizedType.includes(excluded) || excluded.includes(normalizedType)
    );
  }

  /**
   * Checks if a ticket is a sub-task
   */
  private isSubTask(issueType: string): boolean {
    const normalizedType = issueType.toLowerCase();
    return (
      normalizedType.includes("sub-task") ||
      normalizedType.includes("subtask") ||
      normalizedType === "sub-task"
    );
  }

  /**
   * Checks if a ticket is completed (Done status within threshold days)
   */
  private isCompleted(ticket: ProcessedIssue): boolean {
    return (
      ticket.status === "Done" &&
      ticket.daysInCurrentStatus < this.config.thresholdDays
    );
  }

  /**
   * Checks if a ticket is continued (In progress for more than threshold days)
   */
  private isContinued(ticket: ProcessedIssue): boolean {
    return (
      ticket.status !== "Done" &&
      ticket.status !== "TO DO" &&
      ticket.daysInCurrentStatus > this.config.thresholdDays
    );
  }

  /**
   * Checks if a ticket is started (In progress for less than threshold days)
   */
  private isStarted(ticket: ProcessedIssue): boolean {
    return (
      ticket.status !== "Done" &&
      ticket.status !== "TO DO" &&
      ticket.daysInCurrentStatus <= this.config.thresholdDays
    );
  }

  /**
   * Converts a ProcessedIssue to a Ticket with progress status
   */
  private toTicket(
    issue: ProcessedIssue,
    progressStatus: ProgressStatus
  ): Ticket {
    return {
      ticketId: issue.ticketId,
      summary: issue.summary,
      status: issue.status,
      daysInCurrentStatus: issue.daysInCurrentStatus,
      issueType: issue.issueType,
      description: issue.description,
      labels: issue.labels,
      components: issue.components,
      parent: issue.parent,
      parentSummary: issue.parentSummary,
      progressStatus,
    };
  }
}
