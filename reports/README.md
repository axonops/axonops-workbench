# Download Reports

This directory contains automatically generated download reports for AxonOps Workbench releases.

## Files

- `latest.md` - The most recent download report
- `download-report-YYYY-MM-DD.md` - Daily download reports with date stamps
- `download-data-YYYY-MM-DD.json` - Raw download data in JSON format

## Report Generation

Reports are generated automatically by GitHub Actions:
- **Schedule**: Daily at 00:00 UTC
- **Manual Trigger**: Can be triggered manually from the Actions tab

## Report Contents

Each report includes:
- Total download counts
- Separation of user releases vs internal releases
- Top downloaded assets
- Detailed breakdown by release with download counts per asset

Internal releases are identified by having the word "internal" in their release name or tag.