import { getOptional } from "../utils/validation";

/**
 * LLM/AI configuration
 */
export interface LLMConfig {
  model: string;
  temperature: number;
  region: string;
}

/**
 * Retrieves and validates LLM configuration from environment variables
 */
export function getLLMConfig(): LLMConfig {
  const model = getOptional(
    process.env.LLM_MODEL,
    "us.anthropic.claude-sonnet-4-20250514-v1:0"
  );

  const temperature = parseFloat(
    getOptional(process.env.LLM_TEMPERATURE, "0.3")
  );

  const region = getOptional(process.env.AWS_REGION, "us-east-1");

  // Validate temperature range
  if (isNaN(temperature) || temperature < 0 || temperature > 1) {
    throw new Error(
      `Invalid LLM_TEMPERATURE: ${process.env.LLM_TEMPERATURE}\n` +
        `Expected a number between 0 and 1 (default: 0.3)`
    );
  }

  return {
    model,
    temperature,
    region,
  };
}

