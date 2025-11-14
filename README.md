# Weekly Jira Tracker

A clean, simple tool for generating weekly snapshots and summaries of Jira issues with optional AI-powered insights.

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
   pnpm weekly
   ```

That's it! See [SETUP.md](SETUP.md) for detailed configuration instructions.

## Features

- **Weekly Snapshots**: Automatically fetches and saves Jira issues to JSON files
- **Smart Categorization**: Categorizes tickets as completed, continued, or started based on status and time
- **AI Summaries**: Generate human-friendly summaries using Amazon Bedrock with Claude 3.5 Sonnet
- **Data Preservation**: All snapshots are saved to the `./data/` directory for historical tracking
- **Easy Configuration**: All settings in `.env` file - just copy `.env.example` and fill in your values

## Usage

### Basic Weekly Report
```bash
pnpm weekly
```

This will:
1. Fetch current Jira issues for your team
2. Generate a categorized summary showing completed, continued, and started items
3. Save the data to `./data/YYYY-MM-DD.json`

### AI-Powered Summary
```bash
pnpm weekly:ai
# or
pnpm weekly --ai-summary
```

This will:
1. Fetch current Jira issues
2. Generate an AI-powered, human-friendly summary using Amazon Bedrock
3. Save the data to `./data/YYYY-MM-DD.json`

## Configuration

All configuration is done via environment variables in your `.env` file:

### Required Configuration

```bash
# Jira Configuration
JIRA_URL=https://your-company.atlassian.net
JIRA_USERNAME=your-email@company.com
JIRA_TOKEN=your-jira-api-token-here
JIRA_ASSIGNEE_EMAILS=member1@company.com,member2@company.com
```

### Optional Configuration

```bash
# AWS Configuration (for AI summaries)
AWS_REGION=us-east-1

# Application Settings
DATA_DIRECTORY=./data
LLM_MODEL=anthropic.claude-3-5-sonnet-20240620-v1:0
LLM_TEMPERATURE=0.3
```

See `.env.example` for all available options with detailed comments.

## Project Structure

```
├── src/
│   ├── config/
│   │   └── config.ts              # Configuration management
│   ├── services/
│   │   ├── jira-service.ts        # Jira API integration
│   │   ├── llm-service.ts         # Amazon Bedrock integration
│   │   ├── storage-service.ts     # File I/O operations
│   │   ├── categorization-service.ts  # Ticket categorization
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

The tool automatically categorizes Jira issues:

- **Completed**: Issues marked as "Done" within the last 7 days
- **Continued**: Issues in progress (not "Done" or "TO DO") for more than 7 days
- **Started**: Issues in progress (not "Done" or "TO DO") for less than 7 days

### Data Storage

All snapshots are saved as JSON files in the `./data/` directory with the format `YYYY-MM-DD.json`. This allows you to:
- Track progress over time
- Generate historical reports
- Maintain a record of team activity

### AI Summaries

When using the `--ai-summary` flag, the tool:
1. Processes categorized tickets
2. Sends them to Amazon Bedrock (Claude 3.5 Sonnet)
3. Generates human-friendly, non-technical descriptions
4. Focuses on business value and outcomes

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
