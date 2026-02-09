import { getOptional, validateRequired } from "../utils/validation";

/**
 * LLM/AI configuration
 */
export interface LLMConfig {
  model: string;
  temperature: number;
  region: string;
  businessDomains: string[];
  /** Custom example summaries to guide the LLM output style */
  fewShotExamples: string[];
  /** Team/pod name for personalized output */
  teamName: string;
}

/**
 * Parses and validates the business domains from a comma-separated string
 */
function parseBusinessDomains(domainsRaw: string): string[] {
  const domains = domainsRaw
    .split(",")
    .map((d) => d.trim())
    .filter((d) => d.length > 0);

  if (domains.length === 0) {
    throw new Error(
      `Invalid BUSINESS_DOMAINS: no valid domains found after parsing.\n` +
        `Provide a comma-separated list of domain names (e.g., "Workflows,Documents,AI")`
    );
  }

  return domains;
}

/**
 * Parses few-shot examples from a delimiter-separated string
 * Examples are separated by "|||" to allow for complex multi-line examples
 */
function parseFewShotExamples(raw: string): string[] {
  if (!raw || raw.trim() === "") {
    return [];
  }
  return raw
    .split("|||")
    .map((e) => e.trim())
    .filter((e) => e.length > 0);
}

/**
 * Retrieves and validates LLM configuration from environment variables
 */
export function getLLMConfig(): LLMConfig {
  const model = getOptional(
    process.env.LLM_MODEL,
    "us.anthropic.claude-sonnet-4-5-20250929-v1:0"
  );

  const temperature = parseFloat(
    getOptional(process.env.LLM_TEMPERATURE, "0.3")
  );

  const region = getOptional(process.env.AWS_REGION, "us-east-1");

  // Business domains are required
  const domainsRaw = validateRequired(
    "BUSINESS_DOMAINS",
    process.env.BUSINESS_DOMAINS
  );
  const businessDomains = parseBusinessDomains(domainsRaw);

  // Few-shot examples are optional
  const fewShotExamples = parseFewShotExamples(
    getOptional(process.env.FEW_SHOT_EXAMPLES, "")
  );

  // Team name is optional
  const teamName = getOptional(process.env.TEAM_NAME, "Engineering Team");

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
    businessDomains,
    fewShotExamples,
    teamName,
  };
}
