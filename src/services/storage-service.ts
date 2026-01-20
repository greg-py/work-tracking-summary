import fs from "fs/promises";
import path from "path";
import {
  ProcessedIssuesMap,
  ProcessedIssue,
  SnapshotDiff,
  StatusChange,
} from "../types";

/**
 * Service responsible for all file I/O operations
 * Handles snapshot storage, retrieval, listing, and comparison
 */
export class StorageService {
  constructor(private readonly dataDirectory: string) {}

  /**
   * Ensures the data directory exists
   */
  async ensureDataDirectory(): Promise<void> {
    try {
      await fs.access(this.dataDirectory);
    } catch {
      await fs.mkdir(this.dataDirectory, { recursive: true });
    }
  }

  /**
   * Saves a snapshot to a JSON file
   * @param data - Processed issues to save
   * @param customDate - Optional custom date for filename (defaults to today)
   * @returns The filename that was saved
   */
  async saveSnapshot(
    data: ProcessedIssuesMap,
    customDate?: string
  ): Promise<string> {
    await this.ensureDataDirectory();

    const date = customDate || new Date().toISOString().split("T")[0];
    const fileName = path.join(this.dataDirectory, `${date}.json`);
    const fileContent = JSON.stringify(data, null, 2);

    await fs.writeFile(fileName, fileContent, "utf-8");

    return fileName;
  }

  /**
   * Loads a snapshot from a JSON file
   * @param fileName - Path to the snapshot file
   * @returns Processed issues from the snapshot
   */
  async loadSnapshot(fileName: string): Promise<ProcessedIssuesMap> {
    const data = await fs.readFile(fileName, "utf-8");
    return JSON.parse(data) as ProcessedIssuesMap;
  }

  /**
   * Lists all available snapshot files
   * @returns Array of snapshot filenames, sorted most recent first
   */
  async listSnapshots(): Promise<string[]> {
    await this.ensureDataDirectory();

    const files = await fs.readdir(this.dataDirectory);
    return files
      .filter((file) => file.endsWith(".json") && !file.includes("summary"))
      .sort()
      .reverse();
  }

  /**
   * Gets the path to the most recent snapshot file
   * @returns Full path to the latest snapshot
   * @throws {Error} If no snapshots exist
   */
  async getLatestSnapshot(): Promise<string> {
    const snapshots = await this.listSnapshots();

    if (snapshots.length === 0) {
      throw new Error("No snapshots found. Please take a snapshot first.");
    }

    return path.join(this.dataDirectory, snapshots[0]);
  }

  /**
   * Gets the path to the previous snapshot file (second most recent)
   * @returns Full path to the previous snapshot, or null if not available
   */
  async getPreviousSnapshot(): Promise<string | null> {
    const snapshots = await this.listSnapshots();

    if (snapshots.length < 2) {
      return null;
    }

    return path.join(this.dataDirectory, snapshots[1]);
  }

  /**
   * Checks if a snapshot file exists
   * @param fileName - Path to check
   * @returns True if file exists, false otherwise
   */
  async snapshotExists(fileName: string): Promise<boolean> {
    try {
      await fs.access(fileName);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Compares two snapshots and returns the differences
   * @param currentSnapshot - Path to the current (newer) snapshot
   * @param previousSnapshot - Path to the previous (older) snapshot
   * @returns SnapshotDiff containing all changes between snapshots
   */
  async compareSnapshots(
    currentSnapshot: string,
    previousSnapshot: string
  ): Promise<SnapshotDiff> {
    const [currentData, previousData] = await Promise.all([
      this.loadSnapshot(currentSnapshot),
      this.loadSnapshot(previousSnapshot),
    ]);

    // Flatten both snapshots into arrays
    const currentIssues = this.flattenSnapshot(currentData);
    const previousIssues = this.flattenSnapshot(previousData);

    // Build maps for quick lookup
    const currentMap = new Map(currentIssues.map((i) => [i.ticketId, i]));
    const previousMap = new Map(previousIssues.map((i) => [i.ticketId, i]));

    // Find new tickets (in current but not in previous)
    const newTickets: ProcessedIssue[] = [];
    currentIssues.forEach((issue) => {
      if (!previousMap.has(issue.ticketId)) {
        newTickets.push(issue);
      }
    });

    // Find status changes
    const statusChanges: StatusChange[] = [];
    currentIssues.forEach((issue) => {
      const previousIssue = previousMap.get(issue.ticketId);
      if (previousIssue && previousIssue.status !== issue.status) {
        statusChanges.push({
          ticket: issue,
          previousStatus: previousIssue.status,
          currentStatus: issue.status,
        });
      }
    });

    // Find tickets completed this period (status changed to Done)
    const completedThisPeriod: ProcessedIssue[] = statusChanges
      .filter((change) => change.currentStatus === "Done")
      .map((change) => change.ticket);

    // Find removed tickets (in previous but not in current)
    const removedTickets: ProcessedIssue[] = [];
    previousIssues.forEach((issue) => {
      if (!currentMap.has(issue.ticketId)) {
        removedTickets.push(issue);
      }
    });

    return {
      newTickets,
      statusChanges,
      completedThisPeriod,
      removedTickets,
    };
  }

  /**
   * Flattens a ProcessedIssuesMap into an array of ProcessedIssue
   */
  private flattenSnapshot(data: ProcessedIssuesMap): ProcessedIssue[] {
    return Object.values(data).flat();
  }

  /**
   * Generates a comparison summary between two snapshots
   * @param currentSnapshot - Path to the current snapshot
   * @param previousSnapshot - Path to the previous snapshot
   * @returns Human-readable summary of changes
   */
  async generateComparisonSummary(
    currentSnapshot: string,
    previousSnapshot: string
  ): Promise<string> {
    const diff = await this.compareSnapshots(currentSnapshot, previousSnapshot);

    const lines: string[] = [];
    lines.push("=== Snapshot Comparison ===\n");

    lines.push(`New tickets this period: ${diff.newTickets.length}`);
    if (diff.newTickets.length > 0) {
      diff.newTickets.slice(0, 10).forEach((t) => {
        lines.push(`  • [${t.ticketId}] ${t.summary}`);
      });
      if (diff.newTickets.length > 10) {
        lines.push(`  ... and ${diff.newTickets.length - 10} more`);
      }
    }

    lines.push(`\nCompleted this period: ${diff.completedThisPeriod.length}`);
    if (diff.completedThisPeriod.length > 0) {
      diff.completedThisPeriod.forEach((t) => {
        lines.push(`  ✓ [${t.ticketId}] ${t.summary}`);
      });
    }

    lines.push(`\nStatus changes: ${diff.statusChanges.length}`);
    if (diff.statusChanges.length > 0) {
      diff.statusChanges.slice(0, 10).forEach((change) => {
        lines.push(
          `  • [${change.ticket.ticketId}] ${change.previousStatus} → ${change.currentStatus}`
        );
      });
      if (diff.statusChanges.length > 10) {
        lines.push(`  ... and ${diff.statusChanges.length - 10} more`);
      }
    }

    lines.push(`\nRemoved from tracking: ${diff.removedTickets.length}`);
    if (diff.removedTickets.length > 0) {
      diff.removedTickets.slice(0, 5).forEach((t) => {
        lines.push(`  − [${t.ticketId}] ${t.summary}`);
      });
      if (diff.removedTickets.length > 5) {
        lines.push(`  ... and ${diff.removedTickets.length - 5} more`);
      }
    }

    return lines.join("\n");
  }
}

