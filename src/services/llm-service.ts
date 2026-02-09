import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { generateText } from "ai";
import type {
  CategorizedTickets,
  Ticket,
  LLMTicketContext,
  TicketContext,
  ProgressStatus,
  GroomingTicket,
  EngineerProfile,
  EpicContinuitySignal,
  AssignmentRecommendation,
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

  /**
   * Generates assignment recommendations for grooming tickets (single trial)
   * @param ticketsToGroom - Tickets that need engineer assignments
   * @param engineerProfiles - Profiles of available engineers
   * @param verbose - Whether to include detailed reasoning
   * @param epicSignals - Pre-computed epic continuity signals
   * @returns Array of assignment recommendations
   */
  async generateAssignmentRecommendations(
    ticketsToGroom: GroomingTicket[],
    engineerProfiles: EngineerProfile[],
    verbose: boolean,
    epicSignals: EpicContinuitySignal[] = []
  ): Promise<AssignmentRecommendation[]> {
    if (ticketsToGroom.length === 0) {
      return [];
    }

    const prompt = this.buildAssignmentPrompt(
      ticketsToGroom,
      engineerProfiles,
      verbose,
      epicSignals
    );

    const { text } = await generateText({
      model: this.bedrock(this.config.model),
      prompt,
      temperature: this.config.temperature,
    });

    return this.parseAssignmentResponse(text, ticketsToGroom, verbose);
  }

  /**
   * Generates consensus recommendations by running multiple trials in parallel
   * and aggregating via majority vote per ticket.
   * @param ticketsToGroom - Tickets that need engineer assignments
   * @param engineerProfiles - Profiles of available engineers
   * @param verbose - Whether to include detailed reasoning
   * @param numTrials - Number of parallel trials to run (default: 5)
   * @param epicSignals - Pre-computed epic continuity signals
   * @returns Array of assignment recommendations with confidence scores
   */
  async generateConsensusRecommendations(
    ticketsToGroom: GroomingTicket[],
    engineerProfiles: EngineerProfile[],
    verbose: boolean,
    numTrials: number = 5,
    epicSignals: EpicContinuitySignal[] = []
  ): Promise<AssignmentRecommendation[]> {
    if (ticketsToGroom.length === 0) {
      return [];
    }

    // Build non-verbose prompt for all trials (cheaper, no reasoning needed)
    const trialPrompt = this.buildAssignmentPrompt(
      ticketsToGroom,
      engineerProfiles,
      false,
      epicSignals
    );

    // Use slightly elevated temperature for trial diversity
    const trialTemperature = Math.min(this.config.temperature + 0.2, 1.0);

    // Fire all trials in parallel
    const trialPromises = Array.from({ length: numTrials }, () =>
      generateText({
        model: this.bedrock(this.config.model),
        prompt: trialPrompt,
        temperature: trialTemperature,
      })
        .then((result) =>
          this.parseAssignmentResponse(result.text, ticketsToGroom, false)
        )
        .catch(() => [] as AssignmentRecommendation[])
    );

    const allTrialResults = await Promise.all(trialPromises);

    // Filter out failed trials
    const validTrials = allTrialResults.filter((t) => t.length > 0);
    const totalValidTrials = validTrials.length;

    if (totalValidTrials === 0) {
      // All trials failed, fall back to single call
      return this.generateAssignmentRecommendations(
        ticketsToGroom,
        engineerProfiles,
        verbose,
        epicSignals
      );
    }

    // Aggregate: majority vote per ticket
    const consensusResults = this.aggregateTrialResults(
      ticketsToGroom,
      validTrials,
      totalValidTrials
    );

    // If verbose, make a single final call for reasoning on the consensus picks
    if (verbose) {
      return this.addConsensusReasoning(
        consensusResults,
        ticketsToGroom,
        engineerProfiles,
        epicSignals
      );
    }

    return consensusResults;
  }

  /**
   * Aggregates multiple trial results via majority vote per ticket
   */
  private aggregateTrialResults(
    originalTickets: GroomingTicket[],
    trials: AssignmentRecommendation[][],
    totalTrials: number
  ): AssignmentRecommendation[] {
    const ticketMap = new Map(
      originalTickets.map((t) => [t.ticketKey, t])
    );

    return originalTickets.map((ticket) => {
      // Count votes for each engineer on this ticket
      const votes = new Map<string, number>();

      for (const trial of trials) {
        const rec = trial.find((r) => r.ticketKey === ticket.ticketKey);
        if (rec) {
          votes.set(
            rec.recommendedEngineer,
            (votes.get(rec.recommendedEngineer) || 0) + 1
          );
        }
      }

      // Pick the engineer with the most votes
      let winner = "Unable to determine";
      let winnerVotes = 0;

      for (const [engineer, count] of votes) {
        if (count > winnerVotes) {
          winner = engineer;
          winnerVotes = count;
        }
      }

      const originalTicket = ticketMap.get(ticket.ticketKey);

      return {
        ticketKey: ticket.ticketKey,
        category: originalTicket?.category || "Unknown",
        summary: originalTicket?.summary || "",
        recommendedEngineer: winner,
        confidence: `${winnerVotes}/${totalTrials}`,
      };
    });
  }

  /**
   * Makes a single LLM call to add reasoning to consensus results
   */
  private async addConsensusReasoning(
    consensusResults: AssignmentRecommendation[],
    originalTickets: GroomingTicket[],
    engineerProfiles: EngineerProfile[],
    epicSignals: EpicContinuitySignal[] = []
  ): Promise<AssignmentRecommendation[]> {
    const ticketList = this.formatGroomingTickets(originalTickets);
    const engineerList = this.formatEngineerProfiles(engineerProfiles);
    const epicContinuitySection = this.formatEpicContinuitySignals(epicSignals);

    // Format the consensus assignments for the reasoning prompt
    const assignmentsList = consensusResults
      .map((r) => `- ${r.ticketKey}: ${r.summary} → ${r.recommendedEngineer}`)
      .join("\n");

    const prompt = `You are helping a tech lead understand grooming assignment decisions. The following ticket assignments have already been determined through multi-trial consensus analysis. Your job is to provide brief reasoning for each assignment.

The assignments were made using these criteria in priority order:
1. **Work Continuity** -- engineer already has context from working on the ticket's epic/parent
2. **Growth Opportunity** -- standalone ticket assigned to engineer lacking exposure to that domain
3. **Complexity-Weighted Distribution** -- balancing total effort (not just ticket count) across engineers
4. **Specialization** -- tiebreaker using relevant recent experience

AVAILABLE ENGINEERS:
${engineerList}

TICKETS:
${ticketList}

EPIC CONTINUITY SIGNALS:
${epicContinuitySection}

CONSENSUS ASSIGNMENTS:
${assignmentsList}

For each assignment, provide a concise explanation that includes:
- Which priority criterion (Work Continuity / Growth Opportunity / Distribution / Specialization) primarily drove this assignment
- A complexity assessment of the ticket (small/medium/large)
- Why this specific engineer is the right fit

OUTPUT FORMAT:
Return a JSON array with one object per ticket:
- "ticketKey": The ticket key
- "reasoning": A 1-2 sentence explanation covering the above points

Respond ONLY with the JSON array, no other text.`;

    try {
      const { text } = await generateText({
        model: this.bedrock(this.config.model),
        prompt,
        temperature: this.config.temperature,
      });

      // Parse the reasoning response
      let jsonStr = text.trim();
      if (jsonStr.startsWith("```json")) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith("```")) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();

      const reasonings = JSON.parse(jsonStr) as Array<{
        ticketKey: string;
        reasoning: string;
      }>;

      const reasoningMap = new Map(
        reasonings.map((r) => [r.ticketKey, r.reasoning])
      );

      // Merge reasoning into consensus results
      return consensusResults.map((rec) => ({
        ...rec,
        reasoning: reasoningMap.get(rec.ticketKey) || undefined,
      }));
    } catch {
      // If reasoning call fails, return results without reasoning
      return consensusResults;
    }
  }

  /**
   * Formats epic continuity signals for the prompt
   */
  private formatEpicContinuitySignals(
    signals: EpicContinuitySignal[]
  ): string {
    if (signals.length === 0) {
      return "No epic continuity signals detected for these tickets.";
    }

    // Group by ticket
    const byTicket = new Map<string, EpicContinuitySignal[]>();
    for (const signal of signals) {
      const existing = byTicket.get(signal.ticketKey) || [];
      existing.push(signal);
      byTicket.set(signal.ticketKey, existing);
    }

    const lines: string[] = [];
    for (const [ticketKey, ticketSignals] of byTicket) {
      const epicLabel = ticketSignals[0].epicSummary
        ? `${ticketSignals[0].epicKey} (${ticketSignals[0].epicSummary})`
        : ticketSignals[0].epicKey;

      lines.push(`${ticketKey} is part of epic ${epicLabel}:`);
      // Sort by sibling count descending
      const sorted = ticketSignals.sort(
        (a, b) => b.siblingCount - a.siblingCount
      );
      for (const signal of sorted) {
        lines.push(
          `  - ${signal.engineerName} has worked on ${signal.siblingCount} sibling ticket(s) under this epic: ${signal.siblingTickets.join(", ")}`
        );
      }
    }

    return lines.join("\n");
  }

  /**
   * Builds the prompt for assignment recommendations
   */
  private buildAssignmentPrompt(
    tickets: GroomingTicket[],
    engineers: EngineerProfile[],
    verbose: boolean,
    epicSignals: EpicContinuitySignal[] = []
  ): string {
    const ticketList = this.formatGroomingTickets(tickets);
    const engineerList = this.formatEngineerProfiles(engineers);
    const epicContinuitySection = this.formatEpicContinuitySignals(epicSignals);

    const ticketCount = tickets.length;
    const engineerCount = engineers.length;

    // Build the business domains reference
    const allDomains = [...this.config.businessDomains, "Other"];
    const domainsFormatted = allDomains.join(", ");

    return `You are helping a tech lead assign engineering leads to tickets for grooming. Each engineer will be the lead responsible for researching, subtasking, and driving the grooming of their assigned tickets.

TEAM DOMAINS: ${domainsFormatted}

AVAILABLE ENGINEERS (${engineerCount} total):
${engineerList}

TICKETS TO ASSIGN (${ticketCount} total):
${ticketList}

EPIC CONTINUITY SIGNALS:
The following tickets have been identified as part of epics/features where specific engineers have already been doing work. This is the strongest signal for assignment.
${epicContinuitySection}

ASSIGNMENT CRITERIA (in strict priority order):

**Priority 1 -- Work Continuity (highest weight):**
If a ticket is part of an epic or feature chain that an engineer has already been working on (see EPIC CONTINUITY SIGNALS above), assign it to that engineer. They already have the context and momentum from prior work on related tickets. This is the most important criterion -- maintaining continuity avoids ramp-up time and duplicated research.

**Priority 2 -- Growth Opportunity:**
For tickets that are standalone or NOT part of any engineer's existing work chain, look for opportunities to assign them to engineers who have limited recent exposure to that ticket's domain area (see each engineer's "Domains with NO recent work" list). Giving engineers exposure to new domain areas is valuable for team development. Only use this criterion when it does NOT conflict with Priority 1 for any ticket.

**Priority 3 -- Complexity-Weighted Distribution:**
Aim for roughly equal TOTAL EFFORT across engineers, not just equal ticket counts.
- Assess each ticket's complexity (small/medium/large) based on its description scope, technical breadth, and research required
- An engineer with 1-2 large complex tickets should receive fewer total tickets to balance against an engineer with several small ones
- Ticket counts do NOT need to be exactly even, but should be in the same general ballpark
- Allow the raw count per engineer to vary when justified by complexity differences

**Priority 4 -- Specialization (tiebreaker):**
When Priorities 1-3 do not produce a clear winner, fall back to the engineer with the most relevant recent experience in that ticket's component or label area.

OUTPUT FORMAT:
Return a JSON array with one object per ticket. ${
      verbose
        ? "Include detailed reasoning for each recommendation, noting which priority criterion drove the decision and the ticket's complexity (small/medium/large)."
        : "Keep reasoning brief or omit it."
    }

Each object must have these fields:
- "ticketKey": The ticket key (e.g., "PY-11474")
- "recommendedEngineer": The name of the best-fit engineer
${verbose ? '- "reasoning": A 1-2 sentence explanation noting which priority criterion applied, complexity assessment, and why this engineer is the best fit' : ""}

IMPORTANT:
- Respond ONLY with the JSON array, no other text
- Use the exact engineer names as provided
- Every ticket must have a recommendation
- ALWAYS honor work continuity (Priority 1) when epic signals exist for a ticket
- When no continuity signal exists, actively look for growth opportunities (Priority 2) before defaulting to specialization

Generate recommendations now:`;
  }

  /**
   * Formats grooming tickets for the prompt
   */
  private formatGroomingTickets(tickets: GroomingTicket[]): string {
    return tickets
      .map((ticket) => {
        const lines = [
          `[${ticket.ticketKey}] ${ticket.summary}`,
          `  Category: ${ticket.category}`,
        ];

        if (ticket.components.length > 0) {
          lines.push(`  Components: ${ticket.components.join(", ")}`);
        }

        if (ticket.labels.length > 0) {
          lines.push(`  Labels: ${ticket.labels.join(", ")}`);
        }

        if (ticket.parent) {
          const parentInfo = ticket.parentSummary
            ? `${ticket.parent} (${ticket.parentSummary})`
            : ticket.parent;
          lines.push(`  Parent: ${parentInfo}`);
        }

        if (
          ticket.description &&
          ticket.description !== "No description" &&
          ticket.description.trim()
        ) {
          // Truncate long descriptions
          let desc = ticket.description.trim();
          if (desc.length > 300) {
            desc = desc.substring(0, 300) + "...";
          }
          lines.push(`  Description: ${desc}`);
        }

        return lines.join("\n");
      })
      .join("\n\n");
  }

  /**
   * Formats engineer profiles for the prompt with rich context
   * Includes epic involvement, domain coverage, and structured recent work
   */
  private formatEngineerProfiles(engineers: EngineerProfile[]): string {
    const businessDomains = this.config.businessDomains;

    return engineers
      .map((eng) => {
        const lines = [
          `**${eng.name}**`,
          `  Current workload: ${eng.currentWorkload} tickets in progress`,
          `  Total recent tickets: ${eng.recentTickets.length}`,
        ];

        if (eng.specializations.length > 0) {
          lines.push(`  Specializations: ${eng.specializations.join(", ")}`);
        }

        // Epic/Parent involvement: group recent tickets by parent
        const epicMap = new Map<string, { summary: string | null; tickets: string[] }>();
        for (const ticket of eng.recentTickets) {
          if (ticket.parent) {
            const existing = epicMap.get(ticket.parent);
            if (existing) {
              existing.tickets.push(ticket.ticketId);
            } else {
              epicMap.set(ticket.parent, {
                summary: ticket.parentSummary,
                tickets: [ticket.ticketId],
              });
            }
          }
        }

        if (epicMap.size > 0) {
          lines.push(`  Epic/Parent involvement:`);
          // Sort by ticket count descending, show top 5 epics
          const sortedEpics = [...epicMap.entries()]
            .sort((a, b) => b[1].tickets.length - a[1].tickets.length)
            .slice(0, 5);
          for (const [epicKey, data] of sortedEpics) {
            const epicLabel = data.summary
              ? `${epicKey} (${data.summary})`
              : epicKey;
            lines.push(
              `    - ${epicLabel}: ${data.tickets.length} tickets (${data.tickets.slice(0, 3).join(", ")}${data.tickets.length > 3 ? "..." : ""})`
            );
          }
        }

        // Domain coverage analysis
        if (businessDomains.length > 0) {
          const coveredDomains = new Set<string>();
          const domainLower = businessDomains.map((d) => d.toLowerCase());

          for (const ticket of eng.recentTickets) {
            const ticketText = [
              ticket.summary,
              ...ticket.labels,
              ...ticket.components,
              ticket.parentSummary || "",
            ]
              .join(" ")
              .toLowerCase();

            for (let i = 0; i < businessDomains.length; i++) {
              if (ticketText.includes(domainLower[i])) {
                coveredDomains.add(businessDomains[i]);
              }
            }
          }

          const uncoveredDomains = businessDomains.filter(
            (d) => !coveredDomains.has(d)
          );

          if (coveredDomains.size > 0) {
            lines.push(
              `  Recent domain exposure: ${[...coveredDomains].join(", ")}`
            );
          }
          if (uncoveredDomains.length > 0) {
            lines.push(
              `  Domains with NO recent work (growth opportunities): ${uncoveredDomains.join(", ")}`
            );
          }
        }

        // Structured recent work (up to 10 tickets)
        if (eng.recentTickets.length > 0) {
          lines.push(`  Recent work:`);
          const recentSlice = eng.recentTickets.slice(0, 10);
          for (const t of recentSlice) {
            const parentNote = t.parent ? ` [parent: ${t.parent}]` : "";
            const componentNote =
              t.components.length > 0
                ? ` (${t.components.join(", ")})`
                : "";
            lines.push(
              `    - ${t.ticketId}: ${t.summary}${parentNote}${componentNote}`
            );
          }
        }

        return lines.join("\n");
      })
      .join("\n\n");
  }

  /**
   * Parses the LLM response into structured recommendations
   */
  private parseAssignmentResponse(
    response: string,
    originalTickets: GroomingTicket[],
    verbose: boolean
  ): AssignmentRecommendation[] {
    try {
      // Extract JSON from response (handle potential markdown wrapping)
      let jsonStr = response.trim();
      if (jsonStr.startsWith("```json")) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith("```")) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();

      const parsed = JSON.parse(jsonStr) as Array<{
        ticketKey: string;
        recommendedEngineer: string;
        reasoning?: string;
      }>;

      // Build a map for quick lookup of original ticket data
      const ticketMap = new Map(
        originalTickets.map((t) => [t.ticketKey, t])
      );

      return parsed.map((item) => {
        const originalTicket = ticketMap.get(item.ticketKey);
        return {
          ticketKey: item.ticketKey,
          category: originalTicket?.category || "Unknown",
          summary: originalTicket?.summary || "",
          recommendedEngineer: item.recommendedEngineer,
          reasoning: verbose ? item.reasoning : undefined,
        };
      });
    } catch (error) {
      console.error("Failed to parse LLM response:", error);
      console.error("Raw response:", response);

      // Return empty recommendations with error indicator
      return originalTickets.map((t) => ({
        ticketKey: t.ticketKey,
        category: t.category,
        summary: t.summary,
        recommendedEngineer: "Unable to determine",
        reasoning: verbose
          ? "Failed to parse LLM response"
          : undefined,
      }));
    }
  }
}
