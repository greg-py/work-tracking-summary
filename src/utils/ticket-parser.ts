/**
 * Utility for parsing PM ticket list messages to extract Jira ticket information
 */

/**
 * Parsed ticket from a PM message
 */
export interface ParsedTicket {
  /** The category/section from the PM message (e.g., "Meetings", "PostHog") */
  category: string;
  /** The Jira ticket key (e.g., "PY-11474") */
  ticketKey: string;
  /** The full URL to the ticket */
  url: string;
  /** The ticket title/description from the PM message */
  title: string;
}

/**
 * Result of parsing a PM ticket list
 */
export interface ParsedTicketList {
  /** All parsed tickets */
  tickets: ParsedTicket[];
  /** Any lines that couldn't be parsed */
  unparsedLines: string[];
}

/**
 * Regex to match Jira ticket URLs
 * Captures: ticket key from URL like https://performyard.atlassian.net/browse/PY-11474
 */
const JIRA_URL_REGEX =
  /https?:\/\/[^\/]+\/browse\/([A-Z]+-\d+)/gi;

/**
 * Regex to match category headers (e.g., "Meetings:", "PostHog:", "AI Coaching - Post Meeting Analysis")
 * A category is a line that ends with a colon and doesn't contain a URL
 */
const CATEGORY_REGEX = /^([^:]+):$/;

/**
 * Parses a PM ticket list message to extract ticket information
 * 
 * @param message - The raw PM message containing ticket URLs
 * @returns Parsed ticket list with categories and ticket keys
 * 
 * @example
 * ```
 * const message = `
 * Meetings:
 * Add a "Add Meeting" button - https://performyard.atlassian.net/browse/PY-11474
 * PostHog:
 * Remove delighted survey - https://performyard.atlassian.net/browse/PY-11417
 * `;
 * const result = parseTicketList(message);
 * // result.tickets = [
 * //   { category: "Meetings", ticketKey: "PY-11474", url: "...", title: "Add a \"Add Meeting\" button" },
 * //   { category: "PostHog", ticketKey: "PY-11417", url: "...", title: "Remove delighted survey" }
 * // ]
 * ```
 */
export function parseTicketList(message: string): ParsedTicketList {
  const lines = message.split("\n").map((line) => line.trim());
  const tickets: ParsedTicket[] = [];
  const unparsedLines: string[] = [];

  let currentCategory = "Uncategorized";

  for (const line of lines) {
    // Skip empty lines
    if (!line) {
      continue;
    }

    // Check if this is a category header
    const categoryMatch = line.match(CATEGORY_REGEX);
    if (categoryMatch && !line.includes("http")) {
      currentCategory = categoryMatch[1].trim();
      continue;
    }

    // Check if this line contains a Jira URL
    const urlMatches = [...line.matchAll(JIRA_URL_REGEX)];
    if (urlMatches.length > 0) {
      for (const match of urlMatches) {
        const url = match[0];
        const ticketKey = match[1].toUpperCase();

        // Extract the title (text before the URL)
        let title = line.substring(0, line.indexOf(url)).trim();
        // Remove trailing separator characters
        title = title.replace(/[-–—]\s*$/, "").trim();
        // Handle parenthetical prefixes like "(Logan)"
        title = title.replace(/^\([^)]+\)\s*/, "").trim();

        tickets.push({
          category: currentCategory,
          ticketKey,
          url,
          title: title || ticketKey,
        });
      }
    } else if (line.length > 0 && !categoryMatch) {
      // Line has content but no URL - might be an unparsed ticket or continuation
      unparsedLines.push(line);
    }
  }

  return { tickets, unparsedLines };
}

/**
 * Extracts just the ticket keys from a PM message
 * 
 * @param message - The raw PM message containing ticket URLs
 * @returns Array of unique ticket keys
 */
export function extractTicketKeys(message: string): string[] {
  const { tickets } = parseTicketList(message);
  // Return unique ticket keys while preserving order
  return [...new Set(tickets.map((t) => t.ticketKey))];
}

/**
 * Groups parsed tickets by category
 * 
 * @param tickets - Array of parsed tickets
 * @returns Map of category name to tickets in that category
 */
export function groupTicketsByCategory(
  tickets: ParsedTicket[]
): Map<string, ParsedTicket[]> {
  const grouped = new Map<string, ParsedTicket[]>();

  for (const ticket of tickets) {
    const existing = grouped.get(ticket.category) || [];
    existing.push(ticket);
    grouped.set(ticket.category, existing);
  }

  return grouped;
}
