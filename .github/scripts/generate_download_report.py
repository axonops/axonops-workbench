#!/usr/bin/env python3
"""
Generate download report for GitHub releases.
Separates internal releases from user releases.
"""

import os
import json
import requests
from datetime import datetime
from collections import defaultdict

GITHUB_API_URL = "https://api.github.com"
REPO_OWNER = os.environ.get('GITHUB_REPOSITORY_OWNER', '')
REPO_NAME = os.environ.get('GITHUB_REPOSITORY', '').split('/')[-1]
GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN', '')

def get_all_releases():
    """Fetch all releases from GitHub API."""
    headers = {
        'Authorization': f'token {GITHUB_TOKEN}',
        'Accept': 'application/vnd.github.v3+json'
    }
    
    releases = []
    page = 1
    
    while True:
        url = f"{GITHUB_API_URL}/repos/{REPO_OWNER}/{REPO_NAME}/releases?page={page}&per_page=100"
        response = requests.get(url, headers=headers)
        
        if response.status_code != 200:
            print(f"Error fetching releases: {response.status_code}")
            break
            
        page_releases = response.json()
        if not page_releases:
            break
            
        releases.extend(page_releases)
        page += 1
    
    return releases

def categorize_releases(releases):
    """Separate internal releases from user releases."""
    internal_releases = []
    user_releases = []
    
    for release in releases:
        if 'internal' in release['name'].lower() or 'internal' in release['tag_name'].lower():
            internal_releases.append(release)
        else:
            user_releases.append(release)
    
    return internal_releases, user_releases

def calculate_statistics(releases):
    """Calculate download statistics for a set of releases."""
    total_downloads = 0
    asset_downloads = defaultdict(int)
    release_stats = []
    
    for release in releases:
        release_total = 0
        release_info = {
            'name': release['name'] or release['tag_name'],
            'tag': release['tag_name'],
            'published_at': release['published_at'],
            'assets': []
        }
        
        for asset in release.get('assets', []):
            download_count = asset['download_count']
            release_total += download_count
            total_downloads += download_count
            asset_downloads[asset['name']] += download_count
            
            release_info['assets'].append({
                'name': asset['name'],
                'downloads': download_count,
                'size': asset['size']
            })
        
        release_info['total_downloads'] = release_total
        release_stats.append(release_info)
    
    return {
        'total_downloads': total_downloads,
        'asset_downloads': dict(asset_downloads),
        'releases': sorted(release_stats, key=lambda x: x['total_downloads'], reverse=True)
    }

def format_size(bytes):
    """Format bytes to human readable size."""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes < 1024.0:
            return f"{bytes:.1f} {unit}"
        bytes /= 1024.0
    return f"{bytes:.1f} TB"

def generate_markdown_report(internal_stats, user_stats):
    """Generate markdown report."""
    report_date = datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')
    
    report = f"""# AxonOps Workbench Download Report

**Generated on:** {report_date}

## Summary

- **Total Downloads (All Releases):** {internal_stats['total_downloads'] + user_stats['total_downloads']:,}
- **User Release Downloads:** {user_stats['total_downloads']:,}
- **Internal Release Downloads:** {internal_stats['total_downloads']:,}

---

## User Releases

### Total Downloads: {user_stats['total_downloads']:,}

### Top Downloaded Assets
| Asset Name | Downloads |
|------------|-----------|
"""
    
    # Add top 10 user release assets
    sorted_user_assets = sorted(user_stats['asset_downloads'].items(), key=lambda x: x[1], reverse=True)[:10]
    for asset_name, downloads in sorted_user_assets:
        report += f"| {asset_name} | {downloads:,} |\n"
    
    report += "\n### Release Details\n\n"
    
    # Add user release details
    for release in user_stats['releases'][:20]:  # Top 20 releases
        if release['total_downloads'] > 0:
            report += f"#### {release['name']}\n"
            report += f"- **Tag:** {release['tag']}\n"
            report += f"- **Published:** {release['published_at'][:10]}\n"
            report += f"- **Total Downloads:** {release['total_downloads']:,}\n\n"
            
            if release['assets']:
                report += "| Asset | Downloads | Size |\n"
                report += "|-------|-----------|------|\n"
                for asset in sorted(release['assets'], key=lambda x: x['downloads'], reverse=True):
                    report += f"| {asset['name']} | {asset['downloads']:,} | {format_size(asset['size'])} |\n"
                report += "\n"
    
    report += """---

## Internal Releases

### Total Downloads: """ + f"{internal_stats['total_downloads']:,}\n\n"
    
    if internal_stats['releases']:
        report += "### Top Downloaded Assets\n"
        report += "| Asset Name | Downloads |\n"
        report += "|------------|-----------|"
        
        # Add top 10 internal release assets
        sorted_internal_assets = sorted(internal_stats['asset_downloads'].items(), key=lambda x: x[1], reverse=True)[:10]
        for asset_name, downloads in sorted_internal_assets:
            report += f"\n| {asset_name} | {downloads:,} |"
        
        report += "\n\n### Release Details\n\n"
        
        # Add internal release details
        for release in internal_stats['releases'][:10]:  # Top 10 internal releases
            if release['total_downloads'] > 0:
                report += f"#### {release['name']}\n"
                report += f"- **Tag:** {release['tag']}\n"
                report += f"- **Published:** {release['published_at'][:10]}\n"
                report += f"- **Total Downloads:** {release['total_downloads']:,}\n\n"
                
                if release['assets']:
                    report += "| Asset | Downloads | Size |\n"
                    report += "|-------|-----------|------|\n"
                    for asset in sorted(release['assets'], key=lambda x: x['downloads'], reverse=True):
                        report += f"| {asset['name']} | {asset['downloads']:,} | {format_size(asset['size'])} |\n"
                    report += "\n"
    else:
        report += "*No internal releases found.*\n"
    
    report += "\n---\n\n*This report is automatically generated daily by GitHub Actions.*\n"
    
    return report

def main():
    """Main function."""
    print("Fetching releases from GitHub API...")
    releases = get_all_releases()
    
    if not releases:
        print("No releases found.")
        return
    
    print(f"Found {len(releases)} releases.")
    
    # Categorize releases
    internal_releases, user_releases = categorize_releases(releases)
    print(f"User releases: {len(user_releases)}, Internal releases: {len(internal_releases)}")
    
    # Calculate statistics
    internal_stats = calculate_statistics(internal_releases)
    user_stats = calculate_statistics(user_releases)
    
    # Generate report
    report = generate_markdown_report(internal_stats, user_stats)
    
    # Save report
    report_dir = "reports"
    os.makedirs(report_dir, exist_ok=True)
    
    # Save with date in filename
    date_str = datetime.now().strftime('%Y-%m-%d')
    report_path = os.path.join(report_dir, f"download-report-{date_str}.md")
    
    with open(report_path, 'w') as f:
        f.write(report)
    
    # Also save as latest.md for easy access
    latest_path = os.path.join(report_dir, "latest.md")
    with open(latest_path, 'w') as f:
        f.write(report)
    
    print(f"Report generated: {report_path}")
    print(f"Latest report: {latest_path}")
    
    # Save raw data as JSON for potential future use
    data = {
        'generated_at': datetime.now().isoformat(),
        'internal_releases': internal_stats,
        'user_releases': user_stats
    }
    
    json_path = os.path.join(report_dir, f"download-data-{date_str}.json")
    with open(json_path, 'w') as f:
        json.dump(data, f, indent=2)
    
    print(f"Raw data saved: {json_path}")

if __name__ == "__main__":
    main()