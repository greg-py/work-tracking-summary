import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { generateText } from "ai";
import type { CategorizedTickets, Ticket } from "../types";
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
    // Format the tickets into a list for the LLM
    const ticketList = this.formatTicketsForLLM(tickets);

    if (ticketList.trim() === "") {
      return "No tickets found for this week.";
    }

    const prompt = this.buildPrompt(ticketList);

    const { text } = await generateText({
      model: this.bedrock(this.config.model),
      prompt,
      temperature: this.config.temperature,
    });

    return text;
  }

  /**
   * Formats the categorized tickets into a readable list for the LLM
   */
  private formatTicketsForLLM(tickets: CategorizedTickets): string {
    // Flatten all tickets into a single list
    const allTickets: Ticket[] = [
      ...tickets.completedItems,
      ...tickets.continuedItems,
      ...tickets.startedItems,
    ];

    if (allTickets.length === 0) {
      return "";
    }

    // Format each ticket with both title and description
    const formattedTickets = allTickets.map((ticket: Ticket) => {
      let formatted = `[${ticket.ticketId}] ${ticket.summary}`;
      if (ticket.description && ticket.description.trim() !== "") {
        formatted += `\nDescription: ${ticket.description}`;
      }
      return formatted;
    });

    return formattedTickets.join("\n\n");
  }

  /**
   * Builds the prompt for the LLM
   */
  private buildPrompt(ticketList: string): string {
    const domainsFormatted = this.config.businessDomains
      .map((d) => `- ${d}`)
      .join("\n");

    return `Analyze the following software development tickets and create a brief weekly summary.

IMPORTANT: This summary will be shared company-wide with non-technical audiences. Write in simple, clear language that anyone can understand.

CRITICAL REQUIREMENT - DOMAIN CATEGORIZATION:
You MUST categorize ALL work into ONLY the following business domains. Do not create your own categories or use different names:

${domainsFormatted}

Your task:
1. Review all ticket titles and descriptions to understand the work completed and in progress
2. Categorize each piece of work into one of the EXACT domains listed above
3. Only include domains that have relevant work (aim for 3-5 sections total)
4. Write a SHORT, punchy summary for each domain (1-2 sentences max)

Format your response as bullet points where:
- Each bullet starts with the EXACT domain name in bold (e.g., "**Workflows:**")
- Follow with a BRIEF summary (1-2 sentences) of the key work in that area
- Use simple, non-technical language - avoid jargon, acronyms, and technical terms (no "API", "RESTful", "ECS", etc.)
- Focus on the business value or user benefit, not technical implementation
- Be concise and direct - focus on the most important accomplishments
- Avoid ticket numbers and excessive detail
- Write for a general company-wide audience
- Skip domains that have no relevant work this week

Example format:
**Workflows:** Made improvements to review workflows so deleted templates can still be used, streamlined the process for creating and managing review forms.

**User Management:** Enhanced user onboarding experience with clearer instructions and faster account setup.

**Documents:** Improved document sharing capabilities and fixed issues with file uploads.

Now analyze these tickets:

${ticketList}

Provide 3-5 bullet points using ONLY the exact domain names listed above. Skip any domains with no relevant work. Keep each bullet concise (1-2 sentences) and non-technical.`;
  }
}
