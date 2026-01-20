import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { generateText } from "ai";
import type {
  CategorizedTickets,
  Ticket,
  LLMTicketContext,
  TicketContext,
  ProgressStatus,
} from "../types";
import { LLMConfig } from "../config/config";

export class LLMService {
  private bedrock: ReturnType<typeof createAmazonBedrock>;

  constructor(private config: LLMConfig) {
    // Create Bedrock instance using AWS credential provider chain
    this.bedrock = createAmazonBedrock({
      region: this.config.region,
      credentialProvider: fromNodeProviderChain(),
    });
  }

  /**
   * Generates a human-friendly summary of the weekly tickets using LLM
   */
  async generateWeeklySummary(tickets: CategorizedTickets): Promise<string> {
    // Transform categorized tickets into enhanced LLM context
    const ticketContext = this.buildTicketContext(tickets);

    if (ticketContext.totalCount === 0) {
      return "No tickets found for this week.";
    }

    const prompt = this.buildPrompt(ticketContext);

    const { text } = await generateText({
      model: this.bedrock(this.config.model),
      prompt,
      temperature: this.config.temperature,
    });

    return text;
  }

  /**
   * Transforms categorized tickets into enhanced context for LLM
   * Preserves progress status and adds enriched metadata
   */
  private buildTicketContext(tickets: CategorizedTickets): LLMTicketContext {
    return {
      completed: tickets.completedItems.map((t) => this.ticketToContext(t)),
      continued: tickets.continuedItems.map((t) => this.ticketToContext(t)),
      started: tickets.startedItems.map((t) => this.ticketToContext(t)),
      totalCount:
        tickets.completedItems.length +
        tickets.continuedItems.length +
        tickets.startedItems.length,
    };
  }

  /**
   * Converts a Ticket to TicketContext with enriched information
   */
  private ticketToContext(ticket: Ticket): TicketContext {
    // Build parent context string if available
    let parentContext: string | null = null;
    if (ticket.parent && ticket.parentSummary) {
      parentContext = `Part of: ${ticket.parentSummary} (${ticket.parent})`;
    } else if (ticket.parent) {
      parentContext = `Part of: ${ticket.parent}`;
    }

    return {
      ticketId: ticket.ticketId,
      summary: ticket.summary,
      description: ticket.description,
      progressStatus: ticket.progressStatus,
      labels: ticket.labels,
      components: ticket.components,
      parentContext,
      daysInCurrentStatus: ticket.daysInCurrentStatus,
    };
  }

  /**
   * Formats a single ticket for LLM consumption with full context
   */
  private formatTicketForLLM(ticket: TicketContext): string {
    const lines: string[] = [];

    // Status indicator
    const statusPrefix = this.getStatusPrefix(ticket.progressStatus);
    lines.push(`${statusPrefix} [${ticket.ticketId}] ${ticket.summary}`);

    // Add labels/components as domain hints
    if (ticket.labels.length > 0 || ticket.components.length > 0) {
      const hints: string[] = [];
      if (ticket.labels.length > 0) {
        hints.push(`Labels: ${ticket.labels.join(", ")}`);
      }
      if (ticket.components.length > 0) {
        hints.push(`Components: ${ticket.components.join(", ")}`);
      }
      lines.push(`  Domain hints: ${hints.join(" | ")}`);
    }

    // Add parent context if available
    if (ticket.parentContext) {
      lines.push(`  ${ticket.parentContext}`);
    }

    // Add description if meaningful
    if (
      ticket.description &&
      ticket.description.trim() !== "" &&
      ticket.description !== "No description"
    ) {
      // Truncate very long descriptions
      const maxDescLength = 500;
      let desc = ticket.description.trim();
      if (desc.length > maxDescLength) {
        desc = desc.substring(0, maxDescLength) + "...";
      }
      lines.push(`  Description: ${desc}`);
    }

    return lines.join("\n");
  }

  /**
   * Gets a human-readable status prefix for ticket formatting
   */
  private getStatusPrefix(status: ProgressStatus): string {
    switch (status) {
      case "completed":
        return "[COMPLETED]";
      case "continued":
        return "[IN PROGRESS - ongoing]";
      case "started":
        return "[STARTED THIS WEEK]";
      default:
        return "[UNKNOWN]";
    }
  }

  /**
   * Formats all tickets grouped by progress status
   */
  private formatTicketsForLLM(context: LLMTicketContext): string {
    const sections: string[] = [];

    if (context.completed.length > 0) {
      sections.push("=== COMPLETED THIS WEEK ===");
      sections.push(
        context.completed.map((t) => this.formatTicketForLLM(t)).join("\n\n")
      );
    }

    if (context.started.length > 0) {
      sections.push("\n=== STARTED THIS WEEK ===");
      sections.push(
        context.started.map((t) => this.formatTicketForLLM(t)).join("\n\n")
      );
    }

    if (context.continued.length > 0) {
      sections.push("\n=== CONTINUED FROM PREVIOUS WEEKS ===");
      sections.push(
        context.continued.map((t) => this.formatTicketForLLM(t)).join("\n\n")
      );
    }

    return sections.join("\n");
  }

  /**
   * Builds the few-shot examples section if configured
   */
  private buildFewShotExamplesSection(): string {
    if (this.config.fewShotExamples.length === 0) {
      return "";
    }

    const examples = this.config.fewShotExamples
      .map((example, index) => `Example ${index + 1}:\n${example}`)
      .join("\n\n");

    return `
EXAMPLES OF DESIRED OUTPUT STYLE:
The following are real examples of the output format and style we want. Match this style closely:

${examples}

---
`;
  }

  /**
   * Builds the complete prompt for the LLM
   */
  private buildPrompt(context: LLMTicketContext): string {
    // Build domains list with "Other" as fallback
    const allDomains = [...this.config.businessDomains, "Other"];
    const domainsFormatted = allDomains.map((d) => `- ${d}`).join("\n");

    const ticketList = this.formatTicketsForLLM(context);
    const fewShotSection = this.buildFewShotExamplesSection();

    return `You are writing a weekly update for the ${this.config.teamName}. This summary will be shared with leadership and non-technical stakeholders.

${fewShotSection}IMPORTANT GUIDELINES:
- Write in simple, clear language that anyone can understand
- Focus on business value and user benefits, not technical details
- Avoid jargon, acronyms, and technical terms (no "API", "endpoint", "refactor", etc.)
- Use action-oriented language that describes outcomes

PROGRESS STATUS INDICATORS:
The tickets below are marked with their progress status:
- [COMPLETED] = Work that was finished this week - use phrases like "Fixed...", "Completed...", "Resolved..."
- [STARTED THIS WEEK] = New work that began this week - use phrases like "Started work on...", "Began implementing..."
- [IN PROGRESS - ongoing] = Work continuing from previous weeks - use phrases like "Continued progress on...", "Making progress on..."

DOMAIN CATEGORIZATION:
Categorize ALL work into these business domains. Use the "Other" category for work that doesn't fit elsewhere:

${domainsFormatted}

Use the Labels and Components hints on each ticket to help determine the correct domain.

FORMAT REQUIREMENTS:
- Start each section with the domain name in bold followed by a colon (e.g., "**AI:**")
- Write 1-2 concise sentences per domain summarizing the key work
- Combine related tickets into cohesive summaries
- Only include domains that have relevant work
- Aim for 3-6 domain sections total

TICKETS TO SUMMARIZE:

${ticketList}

Generate the weekly summary now. Remember to use appropriate language based on whether work was completed, started, or is ongoing.`;
  }
}
