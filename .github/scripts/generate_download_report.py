#!/usr/bin/env python3
"""
Generate weekly download report for GitHub releases.
Includes comparison with previous report and maintains 12-month history.
"""

import os
import json
import requests
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from pathlib import Path
import glob
import re

GITHUB_API_URL = "https://api.github.com"
REPO_OWNER = os.environ.get('GITHUB_REPOSITORY_OWNER', '')
REPO_NAME = os.environ.get('GITHUB_REPOSITORY', '').split('/')[-1]
GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN', '')
REPORT_DIR = Path("reports")

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
        name_lower = release['name'].lower() if release['name'] else ''
        tag_lower = release['tag_name'].lower()
        
        # Check if it's an internal release (includes beta releases)
        if ('internal' in name_lower or 'internal' in tag_lower or
            'beta' in name_lower or 'beta' in tag_lower or
            'alpha' in name_lower or 'alpha' in tag_lower or
            'rc' in name_lower or 'rc' in tag_lower):
            internal_releases.append(release)
        else:
            user_releases.append(release)
    
    return internal_releases, user_releases

def get_os_from_asset_name(asset_name):
    """Determine OS from asset filename."""
    asset_lower = asset_name.lower()
    if 'win' in asset_lower or '.msi' in asset_lower or '.exe' in asset_lower:
        return 'Windows'
    elif 'mac' in asset_lower or '.dmg' in asset_lower or '.pkg' in asset_lower:
        return 'macOS'
    elif 'linux' in asset_lower or '.deb' in asset_lower or '.rpm' in asset_lower or '.tar.gz' in asset_lower:
        return 'Linux'
    return 'Other'

def calculate_statistics(releases):
    """Calculate download statistics for a set of releases."""
    total_downloads = 0
    asset_downloads = defaultdict(int)
    os_downloads = defaultdict(int)
    release_stats = []
    
    for release in releases:
        release_total = 0
        release_info = {
            'name': release['name'] or release['tag_name'],
            'tag': release['tag_name'],
            'published_at': release['published_at'],
            'html_url': release['html_url'],
            'created_at': release['created_at'],
            'assets': []
        }
        
        for asset in release.get('assets', []):
            download_count = asset['download_count']
            release_total += download_count
            total_downloads += download_count
            asset_downloads[asset['name']] += download_count
            
            # Track OS-specific downloads (exclude checksum files)
            if not asset['name'].endswith('.sha256sum'):
                os_type = get_os_from_asset_name(asset['name'])
                os_downloads[os_type] += download_count
            
            release_info['assets'].append({
                'name': asset['name'],
                'downloads': download_count,
                'size': asset['size'],
                'browser_download_url': asset['browser_download_url']
            })
        
        release_info['total_downloads'] = release_total
        release_stats.append(release_info)
    
    return {
        'total_downloads': total_downloads,
        'asset_downloads': dict(asset_downloads),
        'os_downloads': dict(os_downloads),
        'releases': sorted(release_stats, key=lambda x: x['total_downloads'], reverse=True)
    }

def get_latest_user_release(user_releases):
    """Find the most recent user release by creation date."""
    if not user_releases:
        return None
    
    # Sort by created_at date to get the most recent
    sorted_releases = sorted(user_releases, 
                           key=lambda x: datetime.fromisoformat(x['created_at'].replace('Z', '+00:00')), 
                           reverse=True)
    
    # Find the first non-prerelease, or fallback to first release
    for release in sorted_releases:
        if not release.get('prerelease', False):
            return release
    
    return sorted_releases[0] if sorted_releases else None

def load_previous_report():
    """Load the most recent previous report data."""
    json_files = sorted(glob.glob(str(REPORT_DIR / "weekly-download-data-*.json")))
    if json_files:
        with open(json_files[-1], 'r') as f:
            return json.load(f)
    return None

def calculate_changes(current_stats, previous_stats):
    """Calculate changes between current and previous reports."""
    if not previous_stats:
        return None
    
    changes = {
        'total_change': current_stats['total_downloads'] - previous_stats['total_downloads'],
        'total_percent': 0,
        'release_changes': {},
        'os_changes': {}
    }
    
    if previous_stats['total_downloads'] > 0:
        changes['total_percent'] = ((current_stats['total_downloads'] - previous_stats['total_downloads']) 
                                   / previous_stats['total_downloads'] * 100)
    
    # Map previous releases by tag for comparison
    prev_releases = {r['tag']: r for r in previous_stats.get('releases', [])}
    
    for release in current_stats['releases']:
        tag = release['tag']
        if tag in prev_releases:
            prev_downloads = prev_releases[tag]['total_downloads']
            curr_downloads = release['total_downloads']
            changes['release_changes'][tag] = {
                'previous': prev_downloads,
                'current': curr_downloads,
                'change': curr_downloads - prev_downloads
            }
    
    # Calculate OS-specific changes
    prev_os = previous_stats.get('os_downloads', {})
    for os_type, current_count in current_stats.get('os_downloads', {}).items():
        prev_count = prev_os.get(os_type, 0)
        changes['os_changes'][os_type] = {
            'current': current_count,
            'previous': prev_count,
            'change': current_count - prev_count,
            'percent': ((current_count - prev_count) / prev_count * 100) if prev_count > 0 else 0
        }
    
    return changes

def format_size(bytes):
    """Format bytes to human readable size."""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes < 1024.0:
            return f"{bytes:.1f} {unit}"
        bytes /= 1024.0
    return f"{bytes:.1f} TB"

def format_change(change, show_percent=False, percent_value=None):
    """Format change value with appropriate sign and color."""
    if change > 0:
        result = f"▲ +{change:,}"
    elif change < 0:
        result = f"▼ {change:,}"
    else:
        result = "→ 0"
    
    if show_percent and percent_value is not None:
        result += f" ({percent_value:+.1f}%)"
    
    return result

def parse_version(version_string):
    """Parse version string to comparable tuple."""
    # Remove 'v' prefix if present
    version = version_string.lstrip('v')
    
    # Handle beta/alpha/rc versions
    match = re.match(r'(\d+)\.(\d+)\.(\d+)(?:-(.+))?', version)
    if match:
        major, minor, patch, pre = match.groups()
        major, minor, patch = int(major), int(minor), int(patch)
        
        # Handle pre-release versions
        if pre:
            # Parse pre-release (beta3, rc1, etc)
            pre_match = re.match(r'(alpha|beta|rc)(\d+)?', pre)
            if pre_match:
                pre_type, pre_num = pre_match.groups()
                pre_num = int(pre_num) if pre_num else 0
                # alpha < beta < rc < release
                pre_order = {'alpha': 0, 'beta': 1, 'rc': 2}
                pre_value = pre_order.get(pre_type, 3)
                return (major, minor, patch, pre_value, pre_num)
            else:
                # Unknown pre-release format
                return (major, minor, patch, 0, 0)
        else:
            # Regular release (highest priority)
            return (major, minor, patch, 99, 0)
    
    # Fallback for non-standard versions
    return (0, 0, 0, 0, 0)

def generate_markdown_report(internal_stats, user_stats, previous_data):
    """Generate enhanced markdown report with comparisons."""
    report_date = datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')
    
    # Calculate changes
    prev_internal = previous_data['internal_releases'] if previous_data else None
    prev_user = previous_data['user_releases'] if previous_data else None
    
    internal_changes = calculate_changes(internal_stats, prev_internal)
    user_changes = calculate_changes(user_stats, prev_user)
    
    # Get latest user release
    latest_release = None
    if user_stats['releases']:
        # Find the most recently created release
        latest_release = sorted(user_stats['releases'], 
                              key=lambda x: datetime.fromisoformat(x['created_at'].replace('Z', '+00:00')), 
                              reverse=True)[0]
    
    # Header
    report = f"""# 📊 AxonOps Workbench Weekly Download Report

**Generated on:** {report_date}  
**Repository:** [{REPO_OWNER}/{REPO_NAME}](https://github.com/{REPO_OWNER}/{REPO_NAME})

## 📈 Executive Summary

"""
    
    # Summary table with changes
    total_downloads = internal_stats['total_downloads'] + user_stats['total_downloads']
    total_change = 0
    if internal_changes and user_changes:
        total_change = internal_changes['total_change'] + user_changes['total_change']
    
    report += "| Metric | Current | Change from Last Week |\n"
    report += "|--------|---------|----------------------|\n"
    report += f"| **Total Downloads** | **{total_downloads:,}** | "
    
    if total_change != 0:
        report += f"**{format_change(total_change)}** |\n"
    else:
        report += "*First report* |\n"
    
    report += f"| User Release Downloads | {user_stats['total_downloads']:,} | "
    if user_changes:
        report += f"{format_change(user_changes['total_change'], True, user_changes['total_percent'])} |\n"
    else:
        report += "*First report* |\n"
    
    report += f"| Internal Release Downloads | {internal_stats['total_downloads']:,} | "
    if internal_changes:
        report += f"{format_change(internal_changes['total_change'], True, internal_changes['total_percent'])} |\n"
    else:
        report += "*First report* |\n"
    
    # Add OS-specific tracking (User releases only)
    report += "\n### 💻 User Downloads by Operating System\n\n"
    report += "_Note: This tracks downloads from user releases only, excluding internal releases._\n\n"
    report += "| OS | Downloads | Change | Trend |\n"
    report += "|----|-----------|--------|-------|\n"
    
    os_order = ['Windows', 'macOS', 'Linux', 'Other']
    for os_type in os_order:
        if os_type in user_stats.get('os_downloads', {}):
            downloads = user_stats['os_downloads'][os_type]
            report += f"| {os_type} | {downloads:,} | "
            
            if user_changes and os_type in user_changes.get('os_changes', {}):
                os_change = user_changes['os_changes'][os_type]
                report += f"{format_change(os_change['change'], True, os_change['percent'])} | "
                # Add sparkline-like trend
                if os_change['percent'] > 10:
                    report += "📈 |"
                elif os_change['percent'] < -10:
                    report += "📉 |"
                else:
                    report += "➡️ |"
            else:
                report += "*First report* | - |"
            report += "\n"
    
    # Latest User Release section
    if latest_release:
        report += f"\n### 🆕 Latest User Release: {latest_release['name']}\n\n"
        report += f"**Version:** [{latest_release['tag']}]({latest_release['html_url']})  \n"
        published_date = datetime.fromisoformat(latest_release['published_at'].replace('Z', '+00:00'))
        days_ago = (datetime.now(timezone.utc) - published_date).days
        report += f"**Published:** {latest_release['published_at'][:10]} ({days_ago} days ago)  \n"
        report += f"**Total Downloads:** {latest_release['total_downloads']:,}\n\n"
        
        # Calculate OS-specific downloads for latest release
        latest_os_downloads = defaultdict(int)
        for asset in latest_release['assets']:
            if not asset['name'].endswith('.sha256sum'):
                os_type = get_os_from_asset_name(asset['name'])
                latest_os_downloads[os_type] += asset['downloads']
        
        # Show OS breakdown if we have downloads
        if latest_os_downloads:
            report += "**Downloads by OS:**\n"
            for os_type in ['Windows', 'macOS', 'Linux', 'Other']:
                if os_type in latest_os_downloads:
                    report += f"- {os_type}: {latest_os_downloads[os_type]:,}\n"
            report += "\n"
        
        if latest_release['assets']:
            report += "| Asset | OS | Downloads | Size |\n"
            report += "|-------|----|-----------|------|\n"
            for asset in sorted(latest_release['assets'], key=lambda x: x['downloads'], reverse=True):
                if not asset['name'].endswith('.sha256sum'):  # Skip checksum files
                    asset_name = asset['name']
                    if len(asset_name) > 40:
                        asset_name = asset_name[:37] + "..."
                    os_type = get_os_from_asset_name(asset['name'])
                    report += f"| [{asset_name}]({asset['browser_download_url']}) | {os_type} | {asset['downloads']:,} | {format_size(asset['size'])} |\n"
    
    report += "\n---\n\n"
    
    # User Releases Section
    report += f"""## 🚀 User Releases

### Overview
- **Total Downloads:** {user_stats['total_downloads']:,}
"""
    
    if user_changes:
        report += f"- **Weekly Change:** {format_change(user_changes['total_change'], True, user_changes['total_percent'])}\n"
    
    report += "\n### 📥 Top Downloaded Assets\n\n"
    report += "| Asset | Downloads | Change |\n"
    report += "|-------|-----------|--------|\n"
    
    # Track previous asset downloads for comparison
    prev_asset_downloads = {}
    if prev_user:
        prev_asset_downloads = prev_user.get('asset_downloads', {})
    
    sorted_user_assets = sorted(user_stats['asset_downloads'].items(), key=lambda x: x[1], reverse=True)[:10]
    for asset_name, downloads in sorted_user_assets:
        prev_downloads = prev_asset_downloads.get(asset_name, 0)
        change = downloads - prev_downloads
        report += f"| {asset_name} | {downloads:,} | "
        if prev_downloads > 0:
            report += f"{format_change(change)} |\n"
        else:
            report += "*New* |\n"
    
    report += "\n### 🏆 Top Releases by Downloads\n\n"
    report += "| Release | Version | Downloads | Change |\n"
    report += "|---------|---------|-----------|--------|\n"
    
    # Show top 10 releases by download count
    for release in user_stats['releases'][:10]:
        if release['total_downloads'] > 0:
            report += f"| {release['name']} | [{release['tag']}]({release['html_url']}) | {release['total_downloads']:,} | "
            if user_changes and release['tag'] in user_changes['release_changes']:
                change_info = user_changes['release_changes'][release['tag']]
                report += f"{format_change(change_info['change'])} |\n"
            else:
                report += "*New* |\n"
    
    report += "\n### 📦 All User Releases (Newest First)\n\n"
    report += "_Sorted by version number, showing up to 15 user releases with downloads_\n\n"
    
    # Sort releases by version number (newest first)
    sorted_releases = sorted(user_stats['releases'], 
                           key=lambda r: parse_version(r['tag']), 
                           reverse=True)
    
    # User release details with enhanced formatting
    shown_count = 0
    for release in sorted_releases:
        if release['total_downloads'] > 0 and shown_count < 15:  # Show up to 15 releases with downloads
            shown_count += 1
            report += f"<details>\n<summary><strong>{release['name']}</strong> - {release['total_downloads']:,} downloads"
            
            # Add change indicator if available
            if user_changes and release['tag'] in user_changes['release_changes']:
                change_info = user_changes['release_changes'][release['tag']]
                report += f" {format_change(change_info['change'])}"
            
            report += "</summary>\n\n"
            report += f"- **Version:** [{release['tag']}]({release['html_url']})\n"
            report += f"- **Published:** {release['published_at'][:10]}\n"
            report += f"- **Total Downloads:** {release['total_downloads']:,}\n\n"
            
            if release['assets']:
                report += "| Asset | Downloads | Size | Link |\n"
                report += "|-------|-----------|------|------|\n"
                for asset in sorted(release['assets'], key=lambda x: x['downloads'], reverse=True)[:5]:
                    asset_name = asset['name']
                    if len(asset_name) > 40:
                        asset_name = asset_name[:37] + "..."
                    report += f"| {asset_name} | {asset['downloads']:,} | {format_size(asset['size'])} | [⬇]({asset['browser_download_url']}) |\n"
            
            report += "\n</details>\n\n"
    
    # Internal Releases Section
    report += """---

## 🔧 Internal Releases

### Overview
"""
    report += f"- **Total Downloads:** {internal_stats['total_downloads']:,}\n"
    
    if internal_changes:
        report += f"- **Weekly Change:** {format_change(internal_changes['total_change'], True, internal_changes['total_percent'])}\n"
    
    if internal_stats['releases'] and any(r['total_downloads'] > 0 for r in internal_stats['releases']):
        report += "\n### 📥 Top Downloaded Assets\n\n"
        report += "| Asset | Downloads |\n"
        report += "|-------|-----------|"
        
        sorted_internal_assets = sorted(internal_stats['asset_downloads'].items(), key=lambda x: x[1], reverse=True)[:5]
        for asset_name, downloads in sorted_internal_assets:
            if downloads > 0:
                report += f"\n| {asset_name} | {downloads:,} |"
        
        report += "\n\n### 📦 Recent Releases\n\n"
        
        # Show only internal releases with downloads
        shown_internal = 0
        for release in internal_stats['releases']:
            if release['total_downloads'] > 0 and shown_internal < 5:
                report += f"- **{release['name']}** - {release['total_downloads']:,} downloads\n"
                shown_internal += 1
    else:
        report += "\n*No internal release downloads this week.*\n"
    
    report += "\n---\n\n"
    report += f"*📅 This report is automatically generated weekly by GitHub Actions.*  \n"
    report += f"*📊 [View all releases](https://github.com/{REPO_OWNER}/{REPO_NAME}/releases)*\n"
    
    return report

def cleanup_old_reports():
    """Remove reports older than 12 months."""
    cutoff_date = datetime.now() - timedelta(days=365)
    
    # Clean up JSON files
    for json_file in glob.glob(str(REPORT_DIR / "weekly-download-data-*.json")):
        try:
            date_str = Path(json_file).stem.split('-')[-3:]
            file_date = datetime.strptime('-'.join(date_str), '%Y-%m-%d')
            if file_date < cutoff_date:
                os.remove(json_file)
                print(f"Removed old report: {json_file}")
        except Exception as e:
            print(f"Error processing {json_file}: {e}")
    
    # Clean up markdown files
    for md_file in glob.glob(str(REPORT_DIR / "weekly-download-report-*.md")):
        try:
            date_str = Path(md_file).stem.split('-')[-3:]
            file_date = datetime.strptime('-'.join(date_str), '%Y-%m-%d')
            if file_date < cutoff_date:
                os.remove(md_file)
                print(f"Removed old report: {md_file}")
        except Exception as e:
            print(f"Error processing {md_file}: {e}")

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
    
    # Load previous report for comparison
    previous_data = load_previous_report()
    if previous_data:
        print("Loaded previous report for comparison.")
    else:
        print("No previous report found. This will be the baseline.")
    
    # Generate report
    report = generate_markdown_report(internal_stats, user_stats, previous_data)
    
    # Save report
    REPORT_DIR.mkdir(exist_ok=True)
    
    # Save with date in filename
    date_str = datetime.now().strftime('%Y-%m-%d')
    report_path = REPORT_DIR / f"weekly-download-report-{date_str}.md"
    
    with open(report_path, 'w') as f:
        f.write(report)
    
    # Also save as latest.md for easy access
    latest_path = REPORT_DIR / "latest.md"
    with open(latest_path, 'w') as f:
        f.write(report)
    
    print(f"Report generated: {report_path}")
    print(f"Latest report: {latest_path}")
    
    # Save raw data as JSON for next comparison
    data = {
        'generated_at': datetime.now().isoformat(),
        'internal_releases': internal_stats,
        'user_releases': user_stats
    }
    
    json_path = REPORT_DIR / f"weekly-download-data-{date_str}.json"
    with open(json_path, 'w') as f:
        json.dump(data, f, indent=2)
    
    print(f"Raw data saved: {json_path}")
    
    # Clean up old reports (older than 12 months)
    print("\nCleaning up old reports...")
    cleanup_old_reports()
    print("Cleanup complete.")

if __name__ == "__main__":
    main()