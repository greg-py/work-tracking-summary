/**
 * Validation utilities for configuration and inputs
 */

/**
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validates Jira URL format
 */
export function isValidJiraUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.hostname.length > 0
    );
  } catch {
    return false;
  }
}

/**
 * Validates that a string is not empty after trimming
 */
export function isNonEmptyString(value: string): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Validates a comma-separated list of emails
 * Returns an array of valid emails or throws an error
 */
export function validateEmailList(emailList: string): string[] {
  const emails = emailList
    .split(",")
    .map((email) => email.trim())
    .filter((email) => email.length > 0);

  if (emails.length === 0) {
    throw new Error("Email list cannot be empty");
  }

  const invalidEmails = emails.filter((email) => !isValidEmail(email));

  if (invalidEmails.length > 0) {
    throw new Error(
      `Invalid email format(s): ${invalidEmails.join(", ")}\n` +
        `Please ensure all emails follow the format: user@domain.com`
    );
  }

  return emails;
}

/**
 * Validates required environment variable
 */
export function validateRequired(
  name: string,
  value: string | undefined
): string {
  if (!value || !isNonEmptyString(value)) {
    throw new Error(
      `Missing required environment variable: ${name}\n` +
        `Please add this to your .env file. See .env.example for reference.`
    );
  }
  return value;
}

/**
 * Gets optional environment variable with default value
 */
export function getOptional(
  value: string | undefined,
  defaultValue: string
): string {
  return value && isNonEmptyString(value) ? value : defaultValue;
}

