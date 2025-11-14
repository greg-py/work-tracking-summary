import axios, { AxiosError } from "axios";
import { JiraConfig } from "../config/config";
import {
  JiraIssue,
  ProcessedIssue,
  ProcessedIssuesMap,
} from "../types";
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
    }/rest/api/3/search/jql?jql=${encodeURIComponent(
      jql
    )}&maxResults=${this.config.maxResults}&fields=${this.config.fields}&expand=${this.config.expand}`;

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
    } = fields;

    const parsedDescription = description?.content
      ? extractTextFromJiraDescription(description)
      : "No description";

    const daysInCurrentStatus = this.calculateDaysInStatus(
      statuscategorychangedate
    );

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
    const assigneesClause = `assignee IN (${this.config.assigneeEmails.map(
      (assignee) => `"${assignee}"`
    ).join(", ")})`;

    return sprint === "current"
      ? `sprint in openSprints() AND ${assigneesClause}`
      : `sprint in closedSprints() AND ${assigneesClause}`;
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

    return this.processIssues(allIssues);
  }

  /**
   * Fetches and processes Jira issues for the active sprint
   * @returns Promise resolving to processed issues map for active sprint
   */
  public async fetchJiraIssuesForActiveSprint(): Promise<ProcessedIssuesMap> {
    return this.fetchJiraIssues();
  }
}
