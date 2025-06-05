# Download Reports

This directory contains automatically generated weekly download reports for AxonOps Workbench releases.

## Files

- `latest.md` - The most recent download report
- `weekly-download-report-YYYY-MM-DD.md` - Weekly download reports with date stamps
- `weekly-download-data-YYYY-MM-DD.json` - Raw download data in JSON format for comparison tracking

## Report Generation

Reports are generated automatically by GitHub Actions:
- **Schedule**: Weekly on Mondays at 00:00 UTC
- **Manual Trigger**: Can be triggered manually from the Actions tab
- **Retention**: Reports older than 12 months are automatically cleaned up

## Report Features

Each report includes:

### Executive Summary
- Total download counts with week-over-week changes
- Visual indicators for increases (▲), decreases (▼), or no change (→)
- Percentage changes for download trends

### User Releases
- Top 10 downloaded assets with change tracking
- Detailed breakdown of top 15 releases
- Direct links to GitHub release pages
- Download links for individual assets
- Collapsible sections for better readability

### Internal Releases
- Summary of internal release downloads
- Top downloaded internal assets
- Week-over-week change tracking

### Comparison Tracking
- Compares current week's data with previous week
- Shows download growth for individual releases
- Tracks new assets appearing in the top downloads

Internal releases are identified by having the word "internal" in their release name or tag.