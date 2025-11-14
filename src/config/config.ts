import { JiraConfig, getJiraConfig } from "./jira.config";
import { LLMConfig, getLLMConfig } from "./llm.config";
import { AppConfig, getAppConfig } from "./app.config";

/**
 * Complete application configuration
 */
export interface Config {
  jira: JiraConfig;
  llm: LLMConfig;
  app: AppConfig;
}

/**
 * Re-export individual config interfaces for convenience
 */
export type { JiraConfig, LLMConfig, AppConfig };

/**
 * Retrieves complete application configuration with validation
 * This is the main entry point for accessing configuration
 */
export function getConfig(): Config {
  return {
    jira: getJiraConfig(),
    llm: getLLMConfig(),
    app: getAppConfig(),
  };
}

/**
 * Validates that all required configuration is present and valid
 * Throws descriptive errors if configuration is missing or invalid
 */
export function validateConfig(): void {
  try {
    getConfig();
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Configuration Error:\n${error.message}\n\n` +
          `Please check your .env file. See .env.example for reference.`
      );
    }
    throw error;
  }
}
