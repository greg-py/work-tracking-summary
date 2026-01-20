import chalk from "chalk";
import type { CategorizedTickets, Ticket } from "../types";

/**
 * Displays the weekly summary in a formatted, readable way
 */
export function displayWeeklySummary(summary: CategorizedTickets): void {
  const { completedItems, continuedItems, startedItems } = summary;

  // Display section headers and items
  displaySection("✅ Completed Items", completedItems, chalk.green);
  displaySection("🔄 Continued Items", continuedItems, chalk.yellow);
  displaySection("🆕 Started Items", startedItems, chalk.blue);

  // Display summary statistics
  displayReportStats(summary);
}

/**
 * Displays report statistics in a formatted way
 */
export function displayReportStats(summary: CategorizedTickets): void {
  const { completedItems, continuedItems, startedItems } = summary;

  console.log("\n" + chalk.bold("📈 Summary Statistics:"));
  console.log(`  ${chalk.green("Completed:")} ${completedItems.length}`);
  console.log(`  ${chalk.yellow("Continued:")} ${continuedItems.length}`);
  console.log(`  ${chalk.blue("Started:")} ${startedItems.length}`);
  console.log(
    `  ${chalk.white("Total:")} ${
      completedItems.length + continuedItems.length + startedItems.length
    }`
  );
}

/**
 * Displays a section of tickets with consistent formatting
 */
function displaySection(
  title: string,
  tickets: Ticket[],
  colorFn: (text: string) => string
): void {
  console.log("\n" + chalk.bold(title));

  if (tickets.length === 0) {
    console.log(chalk.gray("  No items in this category"));
    return;
  }

  tickets.forEach((ticket) => {
    const statusInfo = getStatusInfo(ticket.status, ticket.daysInCurrentStatus);
    console.log(
      `  ${colorFn("•")} ${chalk.bold(ticket.ticketId)}: ${ticket.summary}`
    );
    console.log(
      `    ${chalk.gray(`Status: ${ticket.status} (${statusInfo})`)}`
    );

    // Show labels and components if present
    if (ticket.labels.length > 0 || ticket.components.length > 0) {
      const hints: string[] = [];
      if (ticket.labels.length > 0) {
        hints.push(`Labels: ${ticket.labels.join(", ")}`);
      }
      if (ticket.components.length > 0) {
        hints.push(`Components: ${ticket.components.join(", ")}`);
      }
      console.log(`    ${chalk.gray(hints.join(" | "))}`);
    }

    // Show parent context if present
    if (ticket.parent) {
      const parentInfo = ticket.parentSummary
        ? `${ticket.parent}: ${ticket.parentSummary}`
        : ticket.parent;
      console.log(`    ${chalk.gray(`Part of: ${parentInfo}`)}`);
    }
  });
}

/**
 * Displays a comparison summary between snapshots
 */
export function displayComparisonSummary(summary: string): void {
  console.log("\n" + chalk.bold.cyan("📊 Week-over-Week Comparison") + "\n");
  console.log(chalk.white(summary));
}

/**
 * Formats status information with days in current status
 */
function getStatusInfo(status: string, daysInCurrentStatus: number): string {
  const dayText = daysInCurrentStatus === 1 ? "day" : "days";

  if (status === "Done") {
    return `completed ${daysInCurrentStatus} ${dayText} ago`;
  }

  return `${daysInCurrentStatus} ${dayText} in status`;
}

/**
 * Displays error messages in a consistent format
 */
export function displayError(message: string, error?: Error): void {
  console.error(chalk.red("❌ Error:"), message);
  if (error && process.env.NODE_ENV === "development") {
    console.error(chalk.gray(error.stack));
  }
}

/**
 * Displays success messages in a consistent format
 */
export function displaySuccess(message: string): void {
  console.log(chalk.green("✅"), message);
}

/**
 * Displays warning messages in a consistent format
 */
export function displayWarning(message: string): void {
  console.log(chalk.yellow("⚠️"), message);
}

/**
 * Displays info messages in a consistent format
 */
export function displayInfo(message: string): void {
  console.log(chalk.blue("ℹ️"), message);
}

/**
 * Extracts a human-friendly model name from the Bedrock model ID
 */
function getModelDisplayName(modelId: string): string {
  // Map common model IDs to friendly names
  const modelMappings: Record<string, string> = {
    "claude-sonnet-4": "Claude Sonnet 4",
    "claude-3-5-sonnet": "Claude 3.5 Sonnet",
    "claude-3-sonnet": "Claude 3 Sonnet",
    "claude-3-haiku": "Claude 3 Haiku",
    "claude-3-opus": "Claude 3 Opus",
  };

  for (const [pattern, name] of Object.entries(modelMappings)) {
    if (modelId.includes(pattern)) {
      return name;
    }
  }

  // Fallback: extract the model name from the ID
  return modelId.split(":")[0].split(".").pop() || modelId;
}

/**
 * Displays an AI-generated summary with proper formatting
 * @param summary - The AI-generated summary text
 * @param modelId - Optional model ID for display (defaults to generic message)
 */
export function displayAISummary(summary: string, modelId?: string): void {
  console.log(
    "\n" + chalk.bold.magenta("🤖 AI-Generated Weekly Summary") + "\n"
  );

  // Split the summary into lines and add some formatting
  const lines = summary.split("\n");
  lines.forEach((line) => {
    if (line.trim() === "") {
      console.log("");
    } else if (line.match(/^\*\*[^*]+:\*\*/)) {
      // Domain headers with colon (e.g., "**Workflows:**")
      // Extract the domain name and the rest of the line
      const match = line.match(/^\*\*([^*]+):\*\*\s*(.*)/);
      if (match) {
        const [, domain, description] = match;
        console.log(
          `${chalk.bold.cyan(`• ${domain}:`)} ${chalk.white(description)}`
        );
      } else {
        console.log(chalk.white(line));
      }
    } else if (line.startsWith("**") && line.endsWith("**")) {
      // Section headers without description
      const header = line.replace(/\*\*/g, "");
      console.log(chalk.bold.cyan(`• ${header}`));
    } else if (line.startsWith("- ") || line.startsWith("• ")) {
      // Bullet points - format the domain if present
      const bulletContent = line.replace(/^[-•]\s*/, "");
      const match = bulletContent.match(/^\*\*([^*]+):\*\*\s*(.*)/);
      if (match) {
        const [, domain, description] = match;
        console.log(
          `  ${chalk.bold.cyan(`${domain}:`)} ${chalk.white(description)}`
        );
      } else {
        console.log(chalk.white(`  ${bulletContent}`));
      }
    } else {
      // Regular text
      console.log(chalk.white(line));
    }
  });

  const modelName = modelId ? getModelDisplayName(modelId) : "Claude";
  console.log(
    "\n" + chalk.gray(`Generated using Amazon Bedrock with ${modelName}`)
  );
}
