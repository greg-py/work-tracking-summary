import { ProcessedIssue, Ticket, CategorizedTickets } from "../types";

/**
 * Number of days used as threshold for categorization
 * - Completed: Done within this many days
 * - Continued: In progress for more than this many days
 * - Started: In progress for less than this many days
 */
const CATEGORIZATION_THRESHOLD_DAYS = 7;

/**
 * Service responsible for categorizing tickets based on status and time
 */
export class CategorizationService {
  /**
   * Categorizes tickets into completed, continued, and started items
   * @param tickets - Array of processed issues to categorize
   * @returns Categorized tickets organized by status
   */
  categorizeTickets(tickets: ProcessedIssue[]): CategorizedTickets {
    const completedItems: Ticket[] = [];
    const continuedItems: Ticket[] = [];
    const startedItems: Ticket[] = [];

    tickets.forEach((ticket) => {
      // Skip sub-tasks - we only want parent-level items
      if (this.isSubTask(ticket.issueType)) {
        return;
      }

      const categorizedTicket = this.toTicket(ticket);

      if (this.isCompleted(ticket)) {
        completedItems.push(categorizedTicket);
      } else if (this.isContinued(ticket)) {
        continuedItems.push(categorizedTicket);
      } else if (this.isStarted(ticket)) {
        startedItems.push(categorizedTicket);
      }
    });

    return { completedItems, continuedItems, startedItems };
  }

  /**
   * Checks if a ticket is a sub-task
   */
  private isSubTask(issueType: string): boolean {
    return issueType.toLowerCase().includes("sub-task");
  }

  /**
   * Checks if a ticket is completed (Done status within threshold days)
   */
  private isCompleted(ticket: ProcessedIssue): boolean {
    return (
      ticket.status === "Done" &&
      ticket.daysInCurrentStatus < CATEGORIZATION_THRESHOLD_DAYS
    );
  }

  /**
   * Checks if a ticket is continued (In progress for more than threshold days)
   */
  private isContinued(ticket: ProcessedIssue): boolean {
    return (
      ticket.status !== "Done" &&
      ticket.status !== "TO DO" &&
      ticket.daysInCurrentStatus > CATEGORIZATION_THRESHOLD_DAYS
    );
  }

  /**
   * Checks if a ticket is started (In progress for less than threshold days)
   */
  private isStarted(ticket: ProcessedIssue): boolean {
    return (
      ticket.status !== "Done" &&
      ticket.status !== "TO DO" &&
      ticket.daysInCurrentStatus < CATEGORIZATION_THRESHOLD_DAYS
    );
  }

  /**
   * Converts a ProcessedIssue to a Ticket
   */
  private toTicket(issue: ProcessedIssue): Ticket {
    return {
      ticketId: issue.ticketId,
      summary: issue.summary,
      status: issue.status,
      daysInCurrentStatus: issue.daysInCurrentStatus,
      issueType: issue.issueType,
      description: issue.description,
    };
  }
}

