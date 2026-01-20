import { JiraService } from "./jira-service";
import { LLMService } from "./llm-service";
import { StorageService } from "./storage-service";
import { CategorizationService } from "./categorization-service";
import type {
  ProcessedIssue,
  CategorizedTickets,
  SnapshotDiff,
} from "../types";

/**
 * Options for generating summaries
 */
export interface SummaryOptions {
  /** Use snapshot comparison to enhance context */
  useComparison?: boolean;
  /** Specific snapshot file to use (defaults to latest) */
  snapshotFile?: string;
}

/**
 * Result of a weekly report generation
 */
export interface WeeklyReportResult {
  /** The AI-generated summary text */
  summary: string;
  /** Categorized tickets used for the summary */
  categorizedTickets: CategorizedTickets;
  /** Snapshot comparison data (if comparison was used) */
  comparison?: SnapshotDiff;
  /** Path to the snapshot file used */
  snapshotFile: string;
}

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

    return await this.storageService.saveSnapshot(processedIssues, customDate);
  }

  /**
   * Generates a categorized summary from a snapshot file
   * @param fileName - Optional filename to load (defaults to latest)
   * @returns Categorized tickets
   */
  async generateSummary(fileName?: string): Promise<CategorizedTickets> {
    const targetFile =
      fileName || (await this.storageService.getLatestSnapshot());

    const exists = await this.storageService.snapshotExists(targetFile);
    if (!exists) {
      throw new Error(`Snapshot file not found: ${targetFile}`);
    }

    const employeeTickets = await this.storageService.loadSnapshot(targetFile);

    // Flatten all tickets from all employees
    const allTickets: ProcessedIssue[] = Object.values(employeeTickets).flat();

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
   * Generates a comprehensive weekly report with optional comparison
   * @param options - Options for report generation
   * @returns Complete weekly report result
   */
  async generateWeeklyReport(
    options: SummaryOptions = {}
  ): Promise<WeeklyReportResult> {
    const snapshotFile =
      options.snapshotFile ||
      (await this.storageService.getLatestSnapshot());

    const categorizedTickets = await this.generateSummary(snapshotFile);

    // Get comparison data if requested and previous snapshot exists
    let comparison: SnapshotDiff | undefined;
    if (options.useComparison) {
      const previousSnapshot =
        await this.storageService.getPreviousSnapshot();
      if (previousSnapshot) {
        comparison = await this.storageService.compareSnapshots(
          snapshotFile,
          previousSnapshot
        );
      }
    }

    // Generate AI summary
    const summary =
      await this.llmService.generateWeeklySummary(categorizedTickets);

    return {
      summary,
      categorizedTickets,
      comparison,
      snapshotFile,
    };
  }

  /**
   * Generates a comparison summary between the two most recent snapshots
   * @returns Comparison summary text, or null if not enough snapshots
   */
  async generateComparisonSummary(): Promise<string | null> {
    const latestSnapshot = await this.storageService.getLatestSnapshot();
    const previousSnapshot = await this.storageService.getPreviousSnapshot();

    if (!previousSnapshot) {
      return null;
    }

    return await this.storageService.generateComparisonSummary(
      latestSnapshot,
      previousSnapshot
    );
  }

  /**
   * Lists all available snapshot files
   * @returns Array of snapshot filenames, sorted most recent first
   */
  async listSnapshots(): Promise<string[]> {
    return await this.storageService.listSnapshots();
  }

  /**
   * Gets snapshot diff data between two snapshots
   * @param currentSnapshot - Path to current snapshot
   * @param previousSnapshot - Path to previous snapshot
   * @returns Snapshot diff data
   */
  async getSnapshotDiff(
    currentSnapshot: string,
    previousSnapshot: string
  ): Promise<SnapshotDiff> {
    return await this.storageService.compareSnapshots(
      currentSnapshot,
      previousSnapshot
    );
  }
}
