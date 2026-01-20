#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import dotenv from "dotenv";
import { getConfig, validateConfig } from "./config/config";
import { JiraService } from "./services/jira-service";
import { LLMService } from "./services/llm-service";
import { StorageService } from "./services/storage-service";
import { CategorizationService } from "./services/categorization-service";
import { WeeklyService } from "./services/weekly-service";
import {
  displayWeeklySummary,
  displayAISummary,
  displayComparisonSummary,
  displayReportStats,
} from "./utils/display-utils";

// Load environment variables
dotenv.config();

/**
 * Main CLI program
 */
const program = new Command();

program
  .name("weekly-jira-tracker")
  .description("Generate weekly Jira snapshots and summaries")
  .version("1.0.0")
  .option("-a, --ai-summary", "Generate AI-powered summary using LLM")
  .option(
    "-c, --compare",
    "Include week-over-week comparison with previous snapshot"
  )
  .option("-s, --snapshot-only", "Only take a snapshot without generating summary")
  .option(
    "-f, --file <path>",
    "Use a specific snapshot file instead of fetching new data"
  )
  .action(async (options) => {
    try {
      // Validate configuration before starting
      validateConfig();
      const config = getConfig();

      // Initialize all services with dependency injection
      const jiraService = new JiraService(config.jira);
      const llmService = new LLMService(config.llm);
      const storageService = new StorageService(config.app.dataDirectory);
      const categorizationService = new CategorizationService(config.app);

      const weeklyService = new WeeklyService(
        jiraService,
        storageService,
        categorizationService,
        llmService
      );

      console.log(chalk.blue("🚀 Starting weekly workflow..."));

      let filename: string;

      // Either use provided file or take a new snapshot
      if (options.file) {
        filename = options.file;
        console.log(chalk.gray(`Using existing snapshot: ${filename}`));
      } else {
        const spinner = ora("Fetching Jira issues...").start();
        filename = await weeklyService.takeSnapshot();
        spinner.succeed(`Snapshot saved as ${chalk.green(filename)}`);
      }

      // If snapshot-only mode, exit here
      if (options.snapshotOnly) {
        console.log(chalk.green("\n✅ Snapshot complete!"));
        return;
      }

      // Show comparison if requested
      if (options.compare) {
        const comparisonSpinner = ora(
          "Comparing with previous snapshot..."
        ).start();
        const comparisonSummary =
          await weeklyService.generateComparisonSummary();
        if (comparisonSummary) {
          comparisonSpinner.succeed("Comparison complete!");
          displayComparisonSummary(comparisonSummary);
        } else {
          comparisonSpinner.warn(
            "No previous snapshot found for comparison"
          );
        }
      }

      // Generate summary
      if (options.aiSummary) {
        const spinner = ora("Generating AI summary...").start();
        const report = await weeklyService.generateWeeklyReport({
          snapshotFile: filename,
          useComparison: options.compare,
        });
        spinner.succeed("AI summary generated!");

        // Display stats about what was processed
        displayReportStats(report.categorizedTickets);

        // Display the AI summary
        displayAISummary(report.summary, config.llm.model);
      } else {
        const spinner = ora("Generating summary...").start();
        const summary = await weeklyService.generateSummary(filename);
        spinner.succeed("Summary generated!");
        console.log("\n" + chalk.bold.blue("📊 Weekly Summary") + "\n");
        displayWeeklySummary(summary);
      }
    } catch (error) {
      console.error(
        chalk.red("\n❌ Error:"),
        error instanceof Error ? error.message : "Unknown error"
      );
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);
