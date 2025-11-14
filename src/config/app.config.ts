import { getOptional } from "../utils/validation";

/**
 * Application configuration
 */
export interface AppConfig {
  dataDirectory: string;
}

/**
 * Retrieves and validates application configuration from environment variables
 */
export function getAppConfig(): AppConfig {
  const dataDirectory = getOptional(process.env.DATA_DIRECTORY, "./data");

  return {
    dataDirectory,
  };
}

