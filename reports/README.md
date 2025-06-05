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

#### User Downloads by Operating System
- Tracks downloads for Windows, macOS, Linux, and Other platforms from user releases only
- Excludes internal release downloads for accurate user adoption metrics
- Shows week-over-week changes and percentage growth
- Visual trend indicators (📈 for >10% growth, 📉 for >10% decline, ➡️ for stable)

#### Latest User Release
- Highlights the most recent user release
- Shows publication date and days since release
- Displays OS-specific download breakdown
- Lists all assets with OS classification, download counts, and direct download links
- Excludes checksum files for cleaner presentation

### User Releases
- Top 10 downloaded assets with change tracking
- Top releases by downloads table showing the most popular versions
- All releases sorted by version number (newest first)
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
- OS-specific download trends

Internal releases are identified by having any of the following in their release name or tag:
- "internal" - Internal testing releases
- "beta" - Beta testing releases
- "alpha" - Alpha testing releases  
- "rc" - Release candidate versions

This ensures that only stable, production-ready releases are counted in user statistics.