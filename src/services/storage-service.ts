import fs from "fs/promises";
import path from "path";
import { ProcessedIssuesMap } from "../types";

/**
 * Service responsible for all file I/O operations
 * Handles snapshot storage, retrieval, and listing
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
}

