# Setup Guide for Weekly Jira Tracker

This guide will walk you through setting up the Weekly Jira Tracker for your team.

## Prerequisites

- **Node.js** (v18 or higher)
- **pnpm** (recommended) or npm
- **Jira account** with API access
- **AWS account** with Bedrock access (optional, only for AI summaries)

## Step 1: Clone and Install

1. Clone this repository or use it as a template
2. Install dependencies:

```bash
pnpm install
```

## Step 2: Configure Jira

### 2.1 Get Your Jira API Token

1. Go to [Atlassian Account Security](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click **Create API token**
3. Give it a descriptive name (e.g., "Weekly Tracker")
4. Copy the generated token (you won't be able to see it again)

### 2.2 Find Your Jira URL

Your Jira URL is typically: `https://your-company.atlassian.net`

You can find it by:
- Looking at your browser's address bar when you're logged into Jira
- It's the domain before `/jira/` or `/browse/`

### 2.3 Gather Team Member Emails

Collect the email addresses of all team members you want to track. These should match the email addresses assigned to tickets in Jira.

## Step 3: Configure Environment Variables

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Edit the `.env` file and fill in your values:

```bash
# Required: Your Jira credentials
JIRA_URL=https://your-company.atlassian.net
JIRA_USERNAME=your-email@company.com
JIRA_TOKEN=your-jira-api-token-here

# Required: Team member emails (comma-separated)
JIRA_ASSIGNEE_EMAILS=alice@company.com,bob@company.com,charlie@company.com
```

### Important Notes

- **JIRA_URL**: No trailing slash, include `https://`
- **JIRA_USERNAME**: Your Jira account email
- **JIRA_TOKEN**: The API token from Step 2.1
- **JIRA_ASSIGNEE_EMAILS**: Comma-separated, no spaces around commas

## Step 4: Configure AWS (Optional - For AI Summaries)

If you want AI-powered summaries, you'll need AWS Bedrock access.

### Option A: AWS CLI Configuration (Recommended)

1. Install the [AWS CLI](https://aws.amazon.com/cli/)
2. Configure your credentials:

```bash
# For standard AWS credentials
aws configure

# For AWS SSO
aws configure sso
```

3. Add AWS region to your `.env`:

```bash
AWS_REGION=us-east-1
```

### Option B: Environment Variables

Add these to your `.env`:

```bash
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
```

### Enable Bedrock Model Access

1. Go to [AWS Bedrock Console](https://console.aws.amazon.com/bedrock/)
2. Navigate to **Model access**
3. Request access to **Anthropic Claude 3.5 Sonnet**
4. Wait for approval (usually instant)

## Step 5: Test Your Configuration

Run a basic weekly report to test your setup:

```bash
pnpm weekly
```

If everything is configured correctly, you should see:
1. A spinner while fetching issues
2. A success message with the snapshot filename
3. A categorized summary of tickets

### Common Issues

**"Missing required environment variable: JIRA_URL"**
- Check that your `.env` file exists in the project root
- Ensure all required variables are set

**"Invalid email format"**
- Check that `JIRA_ASSIGNEE_EMAILS` are properly formatted
- Ensure no spaces around commas
- Example: `alice@company.com,bob@company.com`

**"Error fetching issues"**
- Verify your `JIRA_URL` is correct (no trailing slash)
- Check that your `JIRA_TOKEN` is valid
- Ensure your account has permission to view the issues

**"No snapshots found"**
- This means you need to run `pnpm weekly` first to create a snapshot
- Snapshots are saved in the `./data/` directory

## Step 6: Customize for Your Team

### Adjust Data Directory

If you want to save snapshots in a different location, add to `.env`:

```bash
DATA_DIRECTORY=./custom-data-path
```

### Adjust Jira Fields

If you need additional custom fields from Jira, you can customize:

```bash
JIRA_FIELDS=assignee,status,created,summary,description,issuetype,statuscategorychangedate,parent,customfield_10026,sprint,customfield_12345
```

### Adjust AI Settings

Customize the AI model behavior:

```bash
# Use a different model
LLM_MODEL=anthropic.claude-3-5-sonnet-20241022-v2:0

# Adjust creativity (0.0 = deterministic, 1.0 = creative)
LLM_TEMPERATURE=0.5
```

## Step 7: Usage

### Generate a weekly report (categorized)

```bash
pnpm weekly
```

### Generate an AI-powered summary

```bash
pnpm weekly:ai
# or
pnpm weekly --ai-summary
```

## Data Storage

All snapshots are saved in the `./data/` directory (or your custom path) with the format:

```
data/
  2025-01-15.json
  2025-01-22.json
  2025-01-29.json
```

Each file contains:
- All issues assigned to your team members
- Issue details (status, description, story points, etc.)
- Timestamp of when the data was pulled

You can commit these files to version control to track progress over time.

## Automation (Optional)

### Run Weekly via Cron

Add to your crontab to run every Friday at 5 PM:

```bash
0 17 * * 5 cd /path/to/weekly-jira-tracker && pnpm weekly:ai
```

### Run via GitHub Actions

Create `.github/workflows/weekly-report.yml`:

```yaml
name: Weekly Report
on:
  schedule:
    - cron: '0 17 * * 5'  # Every Friday at 5 PM UTC
  workflow_dispatch:

jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm weekly:ai
        env:
          JIRA_URL: ${{ secrets.JIRA_URL }}
          JIRA_USERNAME: ${{ secrets.JIRA_USERNAME }}
          JIRA_TOKEN: ${{ secrets.JIRA_TOKEN }}
          JIRA_ASSIGNEE_EMAILS: ${{ secrets.JIRA_ASSIGNEE_EMAILS }}
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          AWS_REGION: us-east-1
```

## Need Help?

- Check the main [README.md](README.md) for more information
- Review your `.env` file against `.env.example`
- Ensure all dependencies are installed (`pnpm install`)
- Check that your Jira credentials have proper permissions

## Security Notes

- **Never commit your `.env` file** to version control
- The `.env` file is already in `.gitignore`
- Use environment variables or secrets management for production deployments
- Rotate your Jira API tokens regularly

