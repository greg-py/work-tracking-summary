# Weekly Jira Tracker

A powerful tool for generating weekly snapshots and AI-powered summaries of Jira issues. Designed to produce manager-ready weekly updates with minimal manual editing.

## Quick Start

1. **Install dependencies**:

   ```bash
   pnpm install
   ```

2. **Configure your environment**:

   ```bash
   cp .env.example .env
   # Edit .env with your Jira credentials and team members
   ```

3. **Run your first report**:
   ```bash
   pnpm weekly:ai
   ```

That's it! See [SETUP.md](SETUP.md) for detailed configuration instructions.

## Features

- **Weekly Snapshots**: Automatically fetches and saves Jira issues to JSON files
- **Smart Categorization**: Categorizes tickets as completed, continued, or started based on status and time
- **Progress-Aware Summaries**: AI uses appropriate language based on whether work was completed, started, or is ongoing
- **Domain Categorization**: Automatically categorizes work into your team's business domains with "Other" fallback
- **Label/Component Hints**: Uses Jira labels and components to improve domain classification
- **Parent Ticket Context**: Automatically fetches parent ticket summaries for sub-tasks
- **Issue Type Filtering**: Exclude automated tests and other noise from summaries
- **Week-over-Week Comparison**: Compare snapshots to see what changed since last week
- **Few-Shot Learning**: Provide example outputs to match your preferred writing style
- **Configurable Thresholds**: Customize the categorization threshold to match your sprint cadence
- **AI Summaries**: Generate human-friendly summaries using Amazon Bedrock with Claude

## Usage

### Basic Weekly Report

```bash
pnpm weekly
```

This will:

1. Fetch current Jira issues for your team
2. Generate a categorized summary showing completed, continued, and started items
3. Save the data to `./data/YYYY-MM-DD.json`

### AI-Powered Summary (Recommended)

```bash
pnpm weekly:ai
# or
pnpm weekly --ai-summary
```

This will:

1. Fetch current Jira issues
2. Generate an AI-powered, human-friendly summary using Amazon Bedrock
3. Use progress status to write "Completed...", "Started work on...", or "Continued progress on..."
4. Save the data to `./data/YYYY-MM-DD.json`

### With Week-over-Week Comparison

```bash
pnpm weekly --ai-summary --compare
```

This adds a comparison showing:
- New tickets added this period
- Tickets completed this period
- Status changes
- Tickets removed from tracking

### Snapshot Only (No Summary)

```bash
pnpm weekly --snapshot-only
```

Just fetch and save the data without generating a summary.

### Use Existing Snapshot

```bash
pnpm weekly --ai-summary --file ./data/2026-01-09.json
```

Generate a summary from a previously saved snapshot.

## Configuration

All configuration is done via environment variables in your `.env` file:

### Required Configuration

```bash
# Jira Configuration
JIRA_URL=https://your-company.atlassian.net
JIRA_USERNAME=your-email@company.com
JIRA_TOKEN=your-jira-api-token-here
JIRA_ASSIGNEE_EMAILS=member1@company.com,member2@company.com

# Business Domains for AI Summary Categorization
# The AI will categorize work into these domains (plus "Other" as fallback)
BUSINESS_DOMAINS=AI,Meetings,Integrations,PerformYard API,User Management,Documents,Workflows
```

### Team & Filtering Configuration

```bash
# Your team/pod name (used in generated summaries)
TEAM_NAME=Street Sharks Pod

# Issue types to exclude from summaries (e.g., automated tests)
EXCLUDED_ISSUE_TYPES=Automated Test,Sub Test Execution

# Whether to include sub-tasks (with parent context)
INCLUDE_SUBTASKS=true
```

### Categorization Settings

```bash
# Days threshold for categorization (default: 7)
# - Completed: Done within this many days
# - Started: In progress for <= this many days  
# - Continued: In progress for > this many days
CATEGORIZATION_THRESHOLD_DAYS=7
```

### Few-Shot Examples (Advanced)

Provide example outputs to teach the AI your preferred style:

```bash
# Separate multiple examples with "|||"
FEW_SHOT_EXAMPLES=**AI:** Reorganized AI settings in the administration page, making it easier for users to manage AI-powered features. Fixed an issue with review cycle summarization.|||**Meetings:** Started work on implementing a new table-based landing page design for meetings.
```

### AWS/LLM Configuration

```bash
AWS_REGION=us-east-1
LLM_MODEL=us.anthropic.claude-sonnet-4-20250514-v1:0
LLM_TEMPERATURE=0.3
```

See `.env.example` for all available options with detailed comments.

## Project Structure

```
├── src/
│   ├── config/
│   │   ├── config.ts              # Configuration aggregation
│   │   ├── app.config.ts          # App settings (thresholds, filtering)
│   │   ├── jira.config.ts         # Jira connection settings
│   │   └── llm.config.ts          # LLM/AI settings & few-shot examples
│   ├── services/
│   │   ├── jira-service.ts        # Jira API integration & parent resolution
│   │   ├── llm-service.ts         # Amazon Bedrock with progress-aware prompts
│   │   ├── storage-service.ts     # File I/O & snapshot comparison
│   │   ├── categorization-service.ts  # Configurable ticket categorization
│   │   └── weekly-service.ts      # Orchestration layer
│   ├── types/
│   │   └── index.ts               # TypeScript type definitions
│   ├── utils/
│   │   ├── display-utils.ts       # Console output formatting
│   │   ├── jira-description-parser.ts  # Jira content parsing
│   │   └── validation.ts          # Configuration validation
│   └── index.ts                   # CLI entry point
├── data/                          # Generated snapshots
├── .env.example                   # Example configuration
├── SETUP.md                       # Detailed setup guide
└── package.json
```

## How It Works

### Issue Categorization

The tool automatically categorizes Jira issues based on configurable thresholds:

- **Completed**: Issues marked as "Done" within the threshold days
- **Started**: Issues in progress for <= threshold days (new work this period)
- **Continued**: Issues in progress for > threshold days (ongoing work)

The default threshold is 7 days, configurable via `CATEGORIZATION_THRESHOLD_DAYS`.

### Progress-Aware AI Summaries

When generating AI summaries, the tool:

1. **Preserves progress status**: Each ticket is tagged as completed, started, or continued
2. **Enriches context**: Fetches parent ticket summaries for sub-tasks
3. **Uses domain hints**: Passes Jira labels and components to help categorization
4. **Applies few-shot learning**: Uses your example outputs to match your style
5. **Uses appropriate language**: 
   - Completed → "Fixed...", "Completed...", "Resolved..."
   - Started → "Started work on...", "Began implementing..."
   - Continued → "Continued progress on...", "Making progress on..."

### Issue Type Filtering

Exclude noise from summaries by configuring `EXCLUDED_ISSUE_TYPES`:

```bash
# Filter out automated test tickets
EXCLUDED_ISSUE_TYPES=Automated Test,Sub Test Execution
```

### Sub-Task Handling

When `INCLUDE_SUBTASKS=true` (default), sub-tasks are included with their parent context:
- Parent ticket summary is automatically fetched
- Displayed as "Part of: [Parent Summary]"
- Helps AI understand the broader context

### Week-over-Week Comparison

The `--compare` flag analyzes differences between snapshots:

- **New tickets**: Issues added since the last snapshot
- **Completed this period**: Issues that moved to "Done"
- **Status changes**: All status transitions
- **Removed tickets**: Issues no longer in the sprint

### Data Storage

All snapshots are saved as JSON files in the `./data/` directory with the format `YYYY-MM-DD.json`. This allows you to:

- Track progress over time
- Generate historical reports
- Compare week-over-week changes
- Re-generate summaries from past data

## Architecture

The codebase follows clean architecture principles:

- **Single Responsibility**: Each service has one clear purpose
- **Separation of Concerns**: Clear boundaries between layers
- **Dependency Injection**: Services are composed, not hard-coded
- **Configuration**: All environment-specific settings in `.env`

### Services

- **JiraService**: Handles all Jira API interactions
- **StorageService**: Manages file I/O operations
- **CategorizationService**: Implements ticket categorization logic
- **LLMService**: Interfaces with Amazon Bedrock for AI summaries
- **WeeklyService**: Orchestrates the workflow between services

## Troubleshooting

### Jira Connection Issues

- Verify your `.env` file has correct `JIRA_URL`, `JIRA_USERNAME`, and `JIRA_TOKEN`
- Ensure your API token has the necessary permissions
- Check that your `JIRA_URL` has no trailing slash

### AWS/AI Summary Issues

- Check your AWS credentials configuration (`aws configure`)
- Ensure you have permissions for Amazon Bedrock
- Verify the Claude model is available in your region
- Confirm you've requested model access in the Bedrock console

### Invalid Configuration

- Compare your `.env` file against `.env.example`
- Check email formats in `JIRA_ASSIGNEE_EMAILS` (no spaces around commas)
- Validate your `JIRA_URL` includes `https://`

### No Issues Found

- Verify team members are correctly listed in `JIRA_ASSIGNEE_EMAILS`
- Check that issues are assigned to active sprints
- Ensure the email addresses match those in Jira

## For New Teams

1. Read [SETUP.md](SETUP.md) for step-by-step setup instructions
2. Copy `.env.example` to `.env` and fill in your values
3. Run `pnpm weekly` to test your configuration
4. Customize as needed for your workflow

## Development

The codebase is designed for maintainability:

- **TypeScript**: Full type safety throughout
- **Clean Architecture**: Easy to test and extend
- **Modern JavaScript**: Uses async/await, ES modules
- **Single Responsibility**: Each module does one thing well

## Contributing

When adding features or fixing bugs:

1. Keep services focused on single responsibilities
2. Use dependency injection for testability
3. Add configuration options to `.env.example`
4. Update documentation in both README.md and SETUP.md

## License

ISC
