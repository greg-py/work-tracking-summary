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
import { displayWeeklySummary, displayAISummary } from "./utils/display-utils";

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
  .action(async (options) => {
    try {
      // Validate configuration before starting
      validateConfig();
      const config = getConfig();

      // Initialize all services with dependency injection
      const jiraService = new JiraService(config.jira);
      const llmService = new LLMService(config.llm);
      const storageService = new StorageService(config.app.dataDirectory);
      const categorizationService = new CategorizationService();

      const weeklyService = new WeeklyService(
        jiraService,
        storageService,
        categorizationService,
        llmService
      );

      console.log(chalk.blue("🚀 Starting weekly workflow..."));

      // Take snapshot
      const spinner = ora("Fetching Jira issues...").start();
      const filename = await weeklyService.takeSnapshot();
      spinner.succeed(`Snapshot saved as ${chalk.green(filename)}`);

      // Generate summary
      if (options.aiSummary) {
        spinner.start("Generating AI summary...");
        const aiSummary = await weeklyService.generateAISummary(filename);
        spinner.succeed("AI summary generated!");
        displayAISummary(aiSummary, config.llm.model);
      } else {
        spinner.start("Generating summary...");
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
