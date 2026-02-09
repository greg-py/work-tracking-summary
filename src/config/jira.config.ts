import {
  validateRequired,
  validateEmailList,
  isValidJiraUrl,
  getOptional,
} from "../utils/validation";

/**
 * Jira API configuration
 */
export interface JiraConfig {
  url: string;
  username: string;
  token: string;
  assigneeEmails: string[];
  /** Engineers to consider for grooming assignments (defaults to assigneeEmails) */
  groomingEngineerEmails: string[];
  /** Number of days to look back for engineer work history in grooming (default: 90) */
  groomingLookbackDays: number;
  maxResults: number;
  fields: string;
  expand: string;
}

/**
 * Retrieves and validates Jira configuration from environment variables
 */
export function getJiraConfig(): JiraConfig {
  const url = validateRequired("JIRA_URL", process.env.JIRA_URL);
  const username = validateRequired("JIRA_USERNAME", process.env.JIRA_USERNAME);
  const token = validateRequired("JIRA_TOKEN", process.env.JIRA_TOKEN);
  const assigneeEmailsRaw = validateRequired(
    "JIRA_ASSIGNEE_EMAILS",
    process.env.JIRA_ASSIGNEE_EMAILS
  );

  // Validate Jira URL format
  if (!isValidJiraUrl(url)) {
    throw new Error(
      `Invalid JIRA_URL format: ${url}\n` +
        `Expected format: https://your-company.atlassian.net`
    );
  }

  // Parse and validate assignee emails
  const assigneeEmails = validateEmailList(assigneeEmailsRaw);

  // Parse grooming engineer emails (optional, falls back to assigneeEmails)
  const groomingEngineerEmailsRaw = getOptional(
    process.env.GROOMING_ENGINEER_EMAILS,
    ""
  );
  const groomingEngineerEmails = groomingEngineerEmailsRaw
    ? validateEmailList(groomingEngineerEmailsRaw)
    : assigneeEmails;

  // Parse grooming lookback days (default: 90 days)
  const groomingLookbackDays = parseInt(
    getOptional(process.env.GROOMING_LOOKBACK_DAYS, "90"),
    10
  );

  if (isNaN(groomingLookbackDays) || groomingLookbackDays < 1) {
    throw new Error(
      `Invalid GROOMING_LOOKBACK_DAYS: ${process.env.GROOMING_LOOKBACK_DAYS}\n` +
        `Expected a positive integer (default: 90)`
    );
  }

  // Optional fields with defaults
  const maxResults = parseInt(
    getOptional(process.env.JIRA_MAX_RESULTS, "1000"),
    10
  );

  const fields = getOptional(
    process.env.JIRA_FIELDS,
    "assignee,status,created,summary,description,issuetype,statuscategorychangedate,parent,customfield_10026,sprint,labels,components"
  );

  const expand = getOptional(process.env.JIRA_EXPAND, "changelog");

  return {
    url,
    username,
    token,
    assigneeEmails,
    groomingEngineerEmails,
    groomingLookbackDays,
    maxResults,
    fields,
    expand,
  };
}
