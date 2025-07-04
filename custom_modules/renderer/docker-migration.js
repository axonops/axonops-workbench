/*
 * © 2024 AxonOps Limited. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const FS = require('fs-extra');
const Path = require('path');

/**
 * Automatically migrate legacy docker-compose.yml files to use environment variables
 * instead of sed commands for AxonOps configuration
 *
 * @param {string} folderPath - Path to the folder containing docker-compose.yml
 * @returns {object} Migration result with status and details
 */
const migrateDockerComposeFile = async (folderPath) => {
  const composePath = Path.join(folderPath, 'docker-compose.yml');

  try {
    // Check if docker-compose.yml exists
    if (!FS.existsSync(composePath)) {
      return {
        migrated: false,
        needed: false,
        message: 'No docker-compose.yml found'
      };
    }

    // Read existing file
    let content = FS.readFileSync(composePath, 'utf8');
    const originalContent = content;

    // Check if already has environment variable in the axon-dash service
    // We need to be more specific - only skip if axon-dash already has the env var
    const axonDashMatch = content.match(/axon-dash:[\s\S]*?(?=^\s*\w+:|$)/m);
    if (axonDashMatch && axonDashMatch[0].includes('AXONSERVER_PRIVATE_ENDPOINTS')) {
      return {
        migrated: false,
        needed: false,
        message: 'Migration not needed - already using AXONSERVER_PRIVATE_ENDPOINTS'
      };
    }

    // Check if migration needed (contains sed command for axon-dash.yml)
    // Need to handle multi-line YAML where command: > is on one line and sed is on next
    // Exclude commented lines
    const contentLines = content.split('\n');
    let hasSedCommand = false;
    for (const line of contentLines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('#') && line.includes('sed') &&
        (line.includes('/etc/axonops/axon-dash.yml') ||
          contentLines.some(l => l.includes('/etc/axonops/axon-dash.yml')))) {
        hasSedCommand = true;
        break;
      }
    }

    const needsMigration = hasSedCommand && content.includes('private_endpoints');

    if (!needsMigration) {
      return {
        migrated: false,
        needed: false,
        message: 'Migration not needed - file is already in correct format'
      };
    }

    // Extract endpoint from sed command
    let extractedEndpoint = 'http://axon-server:8080';
    const endpointMatch = content.match(/private_endpoints:\s*([^|'"]+)[|'"]/);
    if (endpointMatch && endpointMatch[1]) {
      extractedEndpoint = endpointMatch[1].trim();
    }

    // Create backup with timestamp format: docker-compose.yml.bak.yyyymmddhh
    const now = new Date();
    const timestamp = now.getFullYear() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') +
      String(now.getHours()).padStart(2, '0');

    const backupPath = `${composePath}.bak.${timestamp}`;
    FS.copyFileSync(composePath, backupPath);

    // Log the backup creation
    try {
      addLog(`Created backup of docker-compose.yml at: ${backupPath}`, 'info');
    } catch (e) {}

    let modified = false;

    // Split content into lines for easier processing
    const lines = content.split('\n');
    const newLines = [];
    let inAxonDashService = false;
    let axonDashIndent = '';
    let hasEnvironmentSection = false;
    let environmentAdded = false;
    let needToAddEnvVar = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Detect axon-dash service
      if (trimmedLine === 'axon-dash:' || trimmedLine.startsWith('axon-dash:')) {
        inAxonDashService = true;
        hasEnvironmentSection = false;
        environmentAdded = false;
        needToAddEnvVar = false;
        axonDashIndent = line.match(/^(\s*)/)[1];

        newLines.push(line);
        continue;
      }

      // Detect other services (end of axon-dash)
      if (inAxonDashService && line.match(/^\s{0,2}\w[-\w]*:\s*$/) && !trimmedLine.startsWith('axon-dash')) {
        inAxonDashService = false;
        // If we need to add env var but haven't yet, add it before the next service
        if (needToAddEnvVar && !environmentAdded) {
          if (!hasEnvironmentSection) {
            newLines.push(`${axonDashIndent}  environment:`);
          }
          newLines.push(`${axonDashIndent}    - AXONSERVER_PRIVATE_ENDPOINTS=${extractedEndpoint}`);
          environmentAdded = true;
        }
      }

      // Check for environment section in axon-dash
      if (inAxonDashService && trimmedLine === 'environment:') {
        hasEnvironmentSection = true;
        newLines.push(line);
        continue;
      }

      // Detect command section in axon-dash
      if (inAxonDashService && trimmedLine.startsWith('command:')) {
        // Check if this is a sed command for axon-dash.yml
        let commandContent = line;
        let j = i + 1;
        while (j < lines.length && lines[j].match(/^\s+/) && !lines[j].trim().match(/^\w+:/)) {
          commandContent += '\n' + lines[j];
          j++;
        }

        if (commandContent.includes('sed') &&
          commandContent.includes('/etc/axonops/axon-dash.yml') &&
          commandContent.includes('private_endpoints')) {
          modified = true;
          needToAddEnvVar = true;

          // Skip the command and its content
          i = j - 1;
          continue;
        }
      }

      // Add environment variable to existing environment section
      if (inAxonDashService && hasEnvironmentSection && needToAddEnvVar && !environmentAdded) {
        if (trimmedLine.startsWith('-')) {
          // We're in the environment variables section
          newLines.push(line);
          newLines.push(`${axonDashIndent}    - AXONSERVER_PRIVATE_ENDPOINTS=${extractedEndpoint}`);
          environmentAdded = true;
          continue;
        } else if (trimmedLine !== '' && !line.match(/^\s+/) && trimmedLine !== 'environment:') {
          // We've hit a new property, add before it
          newLines.push(`${axonDashIndent}    - AXONSERVER_PRIVATE_ENDPOINTS=${extractedEndpoint}`);
          environmentAdded = true;
        }
      }

      newLines.push(line);
    }

    // Handle case where we reach end of file within axon-dash service
    if (inAxonDashService && needToAddEnvVar && !environmentAdded) {
      if (!hasEnvironmentSection) {
        newLines.push(`${axonDashIndent}  environment:`);
      }
      newLines.push(`${axonDashIndent}    - AXONSERVER_PRIVATE_ENDPOINTS=${extractedEndpoint}`);
      environmentAdded = true;
    }

    if (!modified) {
      // Remove backup if no changes were made
      try {
        FS.unlinkSync(backupPath);
      } catch (e) {}

      return {
        migrated: false,
        needed: false,
        message: 'Migration not needed - file is already in correct format'
      };
    }

    content = newLines.join('\n');

    // Clean up any double newlines that might have been created
    content = content.replace(/\n\n\n+/g, '\n\n');

    // Write updated file
    FS.writeFileSync(composePath, content);

    // Log successful migration
    try {
      addLog(`Successfully migrated docker-compose.yml to new format. Backup saved as: ${Path.basename(backupPath)}`, 'success');
    } catch (e) {}

    return {
      migrated: true,
      needed: true,
      backupPath,
      message: 'Successfully migrated to new format'
    };

  } catch (error) {
    // Log error but don't throw - we want to handle this gracefully
    try {
      errorLog(error, 'docker-compose migration');
    } catch (e) {}

    return {
      migrated: false,
      needed: true,
      error: error.message,
      message: `Migration failed: ${error.message}`
    };
  }
};

module.exports = {
  migrateDockerComposeFile
};
