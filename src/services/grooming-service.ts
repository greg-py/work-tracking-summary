import { promises as fs } from "fs";
import { JiraService } from "./jira-service";
import { LLMService } from "./llm-service";
import {
  parseTicketList,
  groupTicketsByCategory,
  type ParsedTicket,
} from "../utils/ticket-parser";
import type {
  GroomingTicket,
  EngineerProfile,
  EpicContinuitySignal,
  AssignmentRecommendation,
  GroomingResult,
  ProcessedIssue,
} from "../types";

/**
 * In-progress statuses that count toward workload
 */
const IN_PROGRESS_STATUSES = [
  "in progress",
  "in development",
  "in review",
  "code review",
  "testing",
  "qa",
];

/**
 * Service for orchestrating grooming assignment recommendations
 */
export class GroomingService {
  constructor(
    private readonly jiraService: JiraService,
    private readonly llmService: LLMService
  ) {}

  /**
   * Generates assignment recommendations from a PM ticket list file
   * @param inputFilePath - Path to the file containing PM ticket list
   * @param verbose - Whether to include detailed reasoning
   * @returns Grooming result with recommendations
   */
  async generateRecommendations(
    inputFilePath: string,
    verbose: boolean
  ): Promise<GroomingResult> {
    // 1. Read and parse the PM ticket list
    const fileContent = await fs.readFile(inputFilePath, "utf-8");
    const { tickets: parsedTickets, unparsedLines } =
      parseTicketList(fileContent);

    if (parsedTickets.length === 0) {
      throw new Error(
        "No tickets found in input file. Make sure the file contains Jira URLs."
      );
    }

    if (unparsedLines.length > 0) {
      console.warn(
        `Warning: ${unparsedLines.length} lines could not be parsed:`,
        unparsedLines.slice(0, 3).join(", ") +
          (unparsedLines.length > 3 ? "..." : "")
      );
    }

    // 2. Fetch ticket details from Jira
    const ticketKeys = parsedTickets.map((t) => t.ticketKey);
    const { found: jiraIssues, notFound } =
      await this.jiraService.fetchIssuesByKeys(ticketKeys);

    // 3. Build grooming tickets by merging parsed data with Jira data
    const groomingTickets = this.buildGroomingTickets(parsedTickets, jiraIssues);

    // 4. Fetch engineer work history (uses GROOMING_ENGINEER_EMAILS if set)
    const engineerIssuesMap = await this.jiraService.fetchGroomingEngineerIssues();

    // 5. Build engineer profiles
    const engineerProfiles = this.buildEngineerProfiles(engineerIssuesMap);

    if (engineerProfiles.length === 0) {
      throw new Error(
        "No engineer profiles found. Check JIRA_ASSIGNEE_EMAILS configuration."
      );
    }

    // 6. Pre-compute epic continuity signals
    const epicContinuitySignals = this.buildEpicContinuitySignals(
      groomingTickets,
      engineerProfiles
    );

    // 7. Generate consensus recommendations using multiple LLM trials
    const recommendations = await this.llmService.generateConsensusRecommendations(
      groomingTickets,
      engineerProfiles,
      verbose,
      5,
      epicContinuitySignals
    );

    return {
      recommendations,
      engineerProfiles,
      notFoundTickets: notFound,
    };
  }

  /**
   * Pre-computes epic continuity signals by checking which engineers
   * have worked on sibling tickets under the same parent/epic as grooming tickets.
   */
  private buildEpicContinuitySignals(
    groomingTickets: GroomingTicket[],
    engineerProfiles: EngineerProfile[]
  ): EpicContinuitySignal[] {
    const signals: EpicContinuitySignal[] = [];

    // Only process grooming tickets that have a parent/epic
    const ticketsWithParent = groomingTickets.filter((t) => t.parent);

    if (ticketsWithParent.length === 0) {
      return signals;
    }

    // For each grooming ticket with a parent, find engineers who have
    // worked on other tickets under the same parent
    for (const ticket of ticketsWithParent) {
      const epicKey = ticket.parent!;

      for (const engineer of engineerProfiles) {
        // Find sibling tickets: engineer's tickets that share the same parent
        const siblingTickets = engineer.recentTickets.filter(
          (t) => t.parent === epicKey && t.ticketId !== ticket.ticketKey
        );

        if (siblingTickets.length > 0) {
          signals.push({
            ticketKey: ticket.ticketKey,
            epicKey,
            epicSummary: ticket.parentSummary,
            engineerName: engineer.name,
            siblingCount: siblingTickets.length,
            siblingTickets: siblingTickets
              .slice(0, 3)
              .map((t) => t.ticketId),
          });
        }
      }
    }

    return signals;
  }

  /**
   * Builds grooming tickets from parsed tickets and Jira data
   */
  private buildGroomingTickets(
    parsedTickets: ParsedTicket[],
    jiraIssues: ProcessedIssue[]
  ): GroomingTicket[] {
    // Create a map for quick lookup
    const jiraMap = new Map(jiraIssues.map((i) => [i.ticketId, i]));

    return parsedTickets.map((parsed) => {
      const jiraData = jiraMap.get(parsed.ticketKey);

      return {
        ticketKey: parsed.ticketKey,
        category: parsed.category,
        summary: jiraData?.summary || parsed.title,
        description: jiraData?.description || "",
        labels: jiraData?.labels || [],
        components: jiraData?.components || [],
        parent: jiraData?.parent || null,
        parentSummary: jiraData?.parentSummary || null,
      };
    });
  }

  /**
   * Builds engineer profiles from the issues map
   */
  private buildEngineerProfiles(
    issuesMap: Record<string, ProcessedIssue[]>
  ): EngineerProfile[] {
    const profiles: EngineerProfile[] = [];

    for (const [assigneeName, issues] of Object.entries(issuesMap)) {
      // Skip "Unassigned" pseudo-engineer
      if (assigneeName === "Unassigned") {
        continue;
      }

      // Calculate current workload (in-progress tickets)
      const currentWorkload = issues.filter((issue) =>
        IN_PROGRESS_STATUSES.includes(issue.status.toLowerCase())
      ).length;

      // Derive specializations from components and labels
      const specializations = this.deriveSpecializations(issues);

      profiles.push({
        name: assigneeName,
        email: "", // Email not available from display name
        recentTickets: issues,
        currentWorkload,
        specializations,
      });
    }

    return profiles;
  }

  /**
   * Derives specialization areas from an engineer's recent tickets
   */
  private deriveSpecializations(issues: ProcessedIssue[]): string[] {
    const componentCounts = new Map<string, number>();
    const labelCounts = new Map<string, number>();

    for (const issue of issues) {
      // Count components
      for (const component of issue.components) {
        componentCounts.set(
          component,
          (componentCounts.get(component) || 0) + 1
        );
      }

      // Count labels (filter out generic ones)
      for (const label of issue.labels) {
        if (!this.isGenericLabel(label)) {
          labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
        }
      }
    }

    // Get top components and labels as specializations
    const topComponents = [...componentCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);

    const topLabels = [...labelCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([name]) => name);

    return [...topComponents, ...topLabels];
  }

  /**
   * Checks if a label is too generic to be useful for specialization
   */
  private isGenericLabel(label: string): boolean {
    const genericLabels = [
      "bug",
      "feature",
      "enhancement",
      "task",
      "story",
      "spike",
      "tech-debt",
      "technical-debt",
      "backlog",
      "priority",
    ];
    return genericLabels.includes(label.toLowerCase());
  }

  /**
   * Formats recommendations for display
   * @param result - The grooming result
   * @param verbose - Whether to include detailed output
   * @returns Formatted string for display
   */
  formatRecommendations(result: GroomingResult, verbose: boolean): string {
    const lines: string[] = [];

    // Group recommendations by engineer
    const byEngineer = new Map<string, AssignmentRecommendation[]>();
    for (const rec of result.recommendations) {
      const existing = byEngineer.get(rec.recommendedEngineer) || [];
      existing.push(rec);
      byEngineer.set(rec.recommendedEngineer, existing);
    }

    // Sort engineers by number of tickets (descending), then alphabetically
    const sortedEngineers = [...byEngineer.entries()].sort((a, b) => {
      if (b[1].length !== a[1].length) {
        return b[1].length - a[1].length;
      }
      return a[0].localeCompare(b[0]);
    });

    // Format each engineer's assignments
    for (const [engineer, recs] of sortedEngineers) {
      lines.push(`\n${engineer}:`);

      recs.forEach((rec, index) => {
        const num = index + 1;
        const confidenceTag = rec.confidence ? ` (${rec.confidence} agreement)` : "";

        if (verbose) {
          lines.push(`  ${num}. [${rec.ticketKey}] ${rec.summary}${confidenceTag}`);
          lines.push(`     Category: ${rec.category}`);
          if (rec.reasoning) {
            lines.push(`     Reason: ${rec.reasoning}`);
          }
        } else {
          // Truncate long summaries for simple output
          const maxSummaryLen = 60;
          const shortSummary =
            rec.summary.length > maxSummaryLen
              ? rec.summary.substring(0, maxSummaryLen - 3) + "..."
              : rec.summary;
          lines.push(`  ${num}. [${rec.ticketKey}] ${shortSummary}${confidenceTag}`);
        }
      });
    }

    // Add summary stats
    const totalTickets = result.recommendations.length;
    const totalEngineers = byEngineer.size;
    lines.push(
      `\n${totalTickets} tickets assigned across ${totalEngineers} engineers`
    );

    // Add not found tickets warning
    if (result.notFoundTickets.length > 0) {
      lines.push(`\nWarning: ${result.notFoundTickets.length} tickets not found in Jira:`);
      lines.push(`  ${result.notFoundTickets.join(", ")}`);
    }

    return lines.join("\n");
  }
}
