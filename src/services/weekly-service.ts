import { JiraService } from "./jira-service";
import { LLMService } from "./llm-service";
import { StorageService } from "./storage-service";
import { CategorizationService } from "./categorization-service";
import type { ProcessedIssue, CategorizedTickets } from "../types";

/**
 * Service responsible for orchestrating weekly report generation
 * Coordinates between Jira, Storage, Categorization, and LLM services
 */
export class WeeklyService {
  constructor(
    private readonly jiraService: JiraService,
    private readonly storageService: StorageService,
    private readonly categorizationService: CategorizationService,
    private readonly llmService: LLMService
  ) {}

  /**
   * Takes a snapshot of current sprint issues and saves to storage
   * @param customDate - Optional custom date for filename
   * @returns The filename that was saved
   */
  async takeSnapshot(customDate?: string): Promise<string> {
    const processedIssues =
      await this.jiraService.fetchJiraIssuesForActiveSprint();

    return await this.storageService.saveSnapshot(
      processedIssues,
      customDate
    );
  }

  /**
   * Generates a categorized summary from a snapshot file
   * @param fileName - Optional filename to load (defaults to latest)
   * @returns Categorized tickets
   */
  async generateSummary(fileName?: string): Promise<CategorizedTickets> {
    const targetFile = fileName || (await this.storageService.getLatestSnapshot());

    const exists = await this.storageService.snapshotExists(targetFile);
    if (!exists) {
      throw new Error(`Snapshot file not found: ${targetFile}`);
    }

    const employeeTickets = await this.storageService.loadSnapshot(targetFile);

    // Flatten all tickets from all employees
    const allTickets: ProcessedIssue[] =
      Object.values(employeeTickets).flat();

    return this.categorizationService.categorizeTickets(allTickets);
  }

  /**
   * Generates an AI-powered summary from a snapshot file
   * @param fileName - Optional filename to load (defaults to latest)
   * @returns AI-generated summary text
   */
  async generateAISummary(fileName?: string): Promise<string> {
    const categorizedTickets = await this.generateSummary(fileName);
    return await this.llmService.generateWeeklySummary(categorizedTickets);
  }

  /**
   * Lists all available snapshot files
   * @returns Array of snapshot filenames, sorted most recent first
   */
  async listSnapshots(): Promise<string[]> {
    return await this.storageService.listSnapshots();
  }
}
