import { getOptional } from "../utils/validation";

/**
 * Application configuration
 */
export interface AppConfig {
  dataDirectory: string;
  /** Number of days used as threshold for categorization (default: 7) */
  categorizationThresholdDays: number;
  /** Issue types to exclude from summaries (e.g., "Automated Test,Sub Test Execution") */
  excludedIssueTypes: string[];
  /** Whether to include sub-tasks in output (aggregated under parents) */
  includeSubTasks: boolean;
}

/**
 * Parses a comma-separated list of issue types to exclude
 */
function parseExcludedIssueTypes(raw: string): string[] {
  if (!raw || raw.trim() === "") {
    return [];
  }
  return raw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
}

/**
 * Retrieves and validates application configuration from environment variables
 */
export function getAppConfig(): AppConfig {
  const dataDirectory = getOptional(process.env.DATA_DIRECTORY, "./data");

  const categorizationThresholdDays = parseInt(
    getOptional(process.env.CATEGORIZATION_THRESHOLD_DAYS, "7"),
    10
  );

  if (isNaN(categorizationThresholdDays) || categorizationThresholdDays < 1) {
    throw new Error(
      `Invalid CATEGORIZATION_THRESHOLD_DAYS: ${process.env.CATEGORIZATION_THRESHOLD_DAYS}\n` +
        `Expected a positive integer (default: 7)`
    );
  }

  const excludedIssueTypes = parseExcludedIssueTypes(
    getOptional(process.env.EXCLUDED_ISSUE_TYPES, "")
  );

  const includeSubTasks =
    getOptional(process.env.INCLUDE_SUBTASKS, "true").toLowerCase() === "true";

  return {
    dataDirectory,
    categorizationThresholdDays,
    excludedIssueTypes,
    includeSubTasks,
  };
}
