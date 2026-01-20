import axios, { AxiosError } from "axios";
import { JiraConfig } from "../config/config";
import { JiraIssue, ProcessedIssue, ProcessedIssuesMap } from "../types";
import { extractTextFromJiraDescription } from "../utils/jira-description-parser";

/**
 * Parameters for fetching Jira issues
 */
interface FetchJiraIssuesParams {
  /** Whether to limit to active sprint issues - deprecated, always fetches both */
  sprint?: "current" | "previous";
}

/**
 * Parameters for creating a processed issue
 */
interface CreateProcessedIssueParams {
  /** Jira issue key */
  key: string;
  /** Fields object from Jira issue */
  fields: JiraIssue["fields"];
  /** ISO timestamp when data was retrieved */
  datePulled: string;
}

/**
 * Service class for interacting with Jira API
 */
export class JiraService {
  private readonly headers: { Authorization: string; Accept: string };

  constructor(private readonly config: JiraConfig) {
    this.headers = {
      Authorization: `Basic ${Buffer.from(
        `${this.config.username}:${this.config.token}`
      ).toString("base64")}`,
      Accept: "application/json",
    };
  }

  /**
   * Fetches Jira issues based on provided JQL query
   * @param jql - JQL (Jira Query Language) string to filter issues
   * @returns Promise resolving to array of JiraIssue objects
   * @throws {AxiosError} When API request fails
   */
  private async fetchJiraIssuesWithJql(jql: string): Promise<JiraIssue[]> {
    const url = `${
      this.config.url
    }/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=${
      this.config.maxResults
    }&fields=${this.config.fields}&expand=${this.config.expand}`;

    try {
      const response = await axios.get<{ issues: JiraIssue[] }>(url, {
        headers: this.headers,
      });
      return response.data.issues;
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error(`Error fetching issues: ${axiosError.message}`);
      throw error; // Re-throw to handle at caller level
    }
  }

  /**
   * Processes array of Jira issues into a map grouped by assignee
   * @param issues - Array of raw Jira issues to process
   * @returns Promise resolving to processed issues map keyed by assignee
   */
  private processIssues(issues: JiraIssue[]): ProcessedIssuesMap {
    const allIssues: ProcessedIssuesMap = {};
    const datePulled = new Date().toISOString();

    issues.forEach((issue) => {
      const { key, fields } = issue;
      const processedIssue = this.createProcessedIssue({
        key,
        fields,
        datePulled,
      });

      if (allIssues[processedIssue.assignee]) {
        allIssues[processedIssue.assignee].push(processedIssue);
      } else {
        allIssues[processedIssue.assignee] = [processedIssue];
      }
    });

    return allIssues;
  }

  /**
   * Creates a processed issue object from raw Jira issue data
   * @param params - Parameters for creating a processed issue
   * @returns Processed issue object with normalized data
   */
  private createProcessedIssue(
    params: CreateProcessedIssueParams
  ): ProcessedIssue {
    const { key, fields, datePulled } = params;
    const {
      assignee,
      status,
      created,
      summary,
      description,
      issuetype,
      statuscategorychangedate,
      parent,
      customfield_10026,
      labels,
      components,
    } = fields;

    const parsedDescription = description?.content
      ? extractTextFromJiraDescription(description)
      : "No description";

    const daysInCurrentStatus = this.calculateDaysInStatus(
      statuscategorychangedate
    );

    // Extract parent summary if available (from expanded parent fields)
    const parentSummary = parent?.fields?.summary || null;

    // Extract labels as string array
    const extractedLabels = labels || [];

    // Extract component names from component objects
    const extractedComponents = components ? components.map((c) => c.name) : [];

    return {
      ticketId: key,
      summary,
      assignee: assignee ? assignee.displayName : "Unassigned",
      status: status.name,
      created,
      daysInCurrentStatus,
      issueType: issuetype.name,
      description: parsedDescription,
      storyPoints: customfield_10026,
      parent: parent ? parent.key : null,
      parentSummary,
      labels: extractedLabels,
      components: extractedComponents,
      datePulled,
    };
  }

  /**
   * Calculates number of days an issue has been in its current status
   * @param statusChangeDate - ISO timestamp of last status change
   * @returns Number of days since last status change
   */
  private calculateDaysInStatus(statusChangeDate: string): number {
    const timeInCurrentStatus =
      new Date().getTime() - new Date(statusChangeDate).getTime();
    return Math.floor(timeInCurrentStatus / (1000 * 60 * 60 * 24));
  }

  /**
   * Builds a JQL query for specified assignees
   * @param inActiveSprint - Whether to limit to active sprint issues
   * @returns JQL query string
   */
  private buildAssigneeJql({
    sprint = "current",
  }: FetchJiraIssuesParams = {}): string {
    const assigneesClause = `assignee IN (${this.config.assigneeEmails
      .map((assignee) => `"${assignee}"`)
      .join(", ")})`;

    return sprint === "current"
      ? `sprint in openSprints() AND ${assigneesClause}`
      : `sprint in closedSprints() AND ${assigneesClause}`;
  }

  /**
   * Fetches a single Jira issue by key
   * @param issueKey - The Jira issue key (e.g., "PY-1234")
   * @returns Promise resolving to the issue or null if not found
   */
  private async fetchSingleIssue(issueKey: string): Promise<JiraIssue | null> {
    const url = `${this.config.url}/rest/api/3/issue/${issueKey}?fields=summary`;

    try {
      const response = await axios.get<JiraIssue>(url, {
        headers: this.headers,
      });
      return response.data;
    } catch {
      // Issue not found or not accessible
      return null;
    }
  }

  /**
   * Resolves parent ticket summaries for issues that have parents but no summary
   * @param issues - Array of processed issues
   * @returns Promise resolving to issues with resolved parent summaries
   */
  private async resolveParentSummaries(
    issues: ProcessedIssue[]
  ): Promise<ProcessedIssue[]> {
    // Find issues with parent but no parent summary
    const issuesNeedingParent = issues.filter(
      (issue) => issue.parent && !issue.parentSummary
    );

    if (issuesNeedingParent.length === 0) {
      return issues;
    }

    // Get unique parent keys
    const parentKeys = [
      ...new Set(issuesNeedingParent.map((issue) => issue.parent!)),
    ];

    // Fetch parent summaries in parallel (batch of 10 to avoid overwhelming API)
    const parentSummaries = new Map<string, string>();
    const batchSize = 10;

    for (let i = 0; i < parentKeys.length; i += batchSize) {
      const batch = parentKeys.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map((key) => this.fetchSingleIssue(key))
      );

      results.forEach((result, index) => {
        if (result?.fields?.summary) {
          parentSummaries.set(batch[index], result.fields.summary);
        }
      });
    }

    // Update issues with resolved parent summaries
    return issues.map((issue) => {
      if (issue.parent && !issue.parentSummary) {
        const resolvedSummary = parentSummaries.get(issue.parent);
        if (resolvedSummary) {
          return { ...issue, parentSummary: resolvedSummary };
        }
      }
      return issue;
    });
  }

  /**
   * Fetches and processes Jira issues from both current and previous sprints
   * @param params - Parameters for fetching Jira issues (sprint parameter ignored)
   * @returns Promise resolving to processed issues map
   */
  public async fetchJiraIssues(
    params: FetchJiraIssuesParams = {}
  ): Promise<ProcessedIssuesMap> {
    // Always fetch both current and previous sprint issues
    const currentSprintJql = this.buildAssigneeJql({ sprint: "current" });
    const previousSprintJql = this.buildAssigneeJql({ sprint: "previous" });

    // Fetch both sprints in parallel
    const [currentSprintIssues, previousSprintIssues] = await Promise.all([
      this.fetchJiraIssuesWithJql(currentSprintJql),
      this.fetchJiraIssuesWithJql(previousSprintJql),
    ]);

    // Combine issues from both sprints, removing duplicates based on key
    const allIssues = [...currentSprintIssues];
    const currentIssueKeys = new Set(
      currentSprintIssues.map((issue) => issue.key)
    );

    // Add previous sprint issues that aren't already in current sprint
    previousSprintIssues.forEach((issue) => {
      if (!currentIssueKeys.has(issue.key)) {
        allIssues.push(issue);
      }
    });

    // Process issues first
    const processedMap = this.processIssues(allIssues);

    // Resolve parent summaries for all issues
    const allProcessedIssues = Object.values(processedMap).flat();
    const resolvedIssues = await this.resolveParentSummaries(
      allProcessedIssues
    );

    // Rebuild the map with resolved issues
    const resolvedMap: ProcessedIssuesMap = {};
    resolvedIssues.forEach((issue) => {
      if (resolvedMap[issue.assignee]) {
        resolvedMap[issue.assignee].push(issue);
      } else {
        resolvedMap[issue.assignee] = [issue];
      }
    });

    return resolvedMap;
  }

  /**
   * Fetches and processes Jira issues for the active sprint
   * @returns Promise resolving to processed issues map for active sprint
   */
  public async fetchJiraIssuesForActiveSprint(): Promise<ProcessedIssuesMap> {
    return this.fetchJiraIssues();
  }
}
