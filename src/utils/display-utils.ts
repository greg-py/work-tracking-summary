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
  });
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
 * Displays an AI-generated summary with proper formatting
 */
export function displayAISummary(summary: string): void {
  console.log(
    "\n" + chalk.bold.magenta("🤖 AI-Generated Weekly Summary") + "\n"
  );

  // Split the summary into lines and add some formatting
  const lines = summary.split("\n");
  lines.forEach((line) => {
    if (line.trim() === "") {
      console.log("");
    } else if (line.startsWith("**") && line.endsWith("**")) {
      // Section headers
      const header = line.replace(/\*\*/g, "");
      console.log(chalk.bold.cyan(header));
    } else if (line.startsWith("- ")) {
      // Bullet points
      console.log(chalk.white(line));
    } else {
      // Regular text
      console.log(chalk.white(line));
    }
  });

  console.log(
    "\n" + chalk.gray("Generated using Amazon Bedrock with Claude 3.5 Sonnet")
  );
}
