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
const { migrateDockerComposeFile } = require('../../../custom_node_modules/renderer/docker-migration');

// Mock fs-extra
jest.mock('fs-extra');

// Mock the logging functions
global.addLog = jest.fn();
global.errorLog = jest.fn();

describe('Docker Compose Migration', () => {
  const testFolderPath = '/test/localclusters/test-project';
  const composePath = Path.join(testFolderPath, 'docker-compose.yml');
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock Date to have consistent timestamps
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-06-04T15:00:00'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('File Detection', () => {
    test('should return false when docker-compose.yml does not exist', async () => {
      FS.existsSync.mockReturnValue(false);
      
      const result = await migrateDockerComposeFile(testFolderPath);
      
      expect(result).toEqual({
        migrated: false,
        needed: false,
        message: 'No docker-compose.yml found'
      });
    });

    test('should detect file does not need migration when already using environment variables', async () => {
      FS.existsSync.mockReturnValue(true);
      FS.readFileSync.mockReturnValue(`
version: "3.8"
services:
  axon-dash:
    image: registry.axonops.com/axonops-public/axonops-docker/axon-dash:latest
    environment:
      - AXONSERVER_PRIVATE_ENDPOINTS=http://axon-server:8080
      `);
      
      const result = await migrateDockerComposeFile(testFolderPath);
      
      expect(result.migrated).toBe(false);
      expect(result.needed).toBe(false);
    });
  });

  describe('Migration Process', () => {
    const legacyContent = `
version: "3.8"
services:
  axon-dash:
    restart: unless-stopped
    image: registry.axonops.com/axonops-public/axonops-docker/axon-dash:latest
    command: >
      /bin/sh -c "sed -i 's|private_endpoints.*|private_endpoints: http://axon-server:8080|' /etc/axonops/axon-dash.yml && /axon-dash"
    ports:
      - 3000:3000`;

    test('should migrate legacy sed command to environment variable', async () => {
      FS.existsSync.mockReturnValue(true);
      FS.readFileSync.mockReturnValue(legacyContent);
      FS.copyFileSync.mockReturnValue(undefined);
      FS.writeFileSync.mockReturnValue(undefined);
      
      const result = await migrateDockerComposeFile(testFolderPath);
      
      expect(result.migrated).toBe(true);
      expect(result.needed).toBe(true);
      expect(result.backupPath).toBe(`${composePath}.bak.2024060415`);
      
      // Verify backup was created
      expect(FS.copyFileSync).toHaveBeenCalledWith(
        composePath,
        `${composePath}.bak.2024060415`
      );
      
      // Verify file was written with new content
      expect(FS.writeFileSync).toHaveBeenCalled();
      const writtenContent = FS.writeFileSync.mock.calls[0][1];
      expect(writtenContent).toContain('environment:');
      expect(writtenContent).toContain('AXONSERVER_PRIVATE_ENDPOINTS=http://axon-server:8080');
      expect(writtenContent).not.toContain('sed -i');
    });

    test('should handle existing environment section', async () => {
      const contentWithEnv = `version: "3.8"
services:
  axon-dash:
    image: registry.axonops.com/axonops-public/axonops-docker/axon-dash:latest
    environment:
      - SOME_OTHER_VAR=value
    command: >
      /bin/sh -c "sed -i 's|private_endpoints.*|private_endpoints: http://axon-server:8080|' /etc/axonops/axon-dash.yml && /usr/local/bin/axon-dash"
    ports:
      - 3000:3000`;

      FS.existsSync.mockReturnValue(true);
      FS.readFileSync.mockReturnValue(contentWithEnv);
      FS.copyFileSync.mockReturnValue(undefined);
      FS.writeFileSync.mockReturnValue(undefined);
      
      const result = await migrateDockerComposeFile(testFolderPath);
      
      expect(result.migrated).toBe(true);
      
      const writtenContent = FS.writeFileSync.mock.calls[0][1];
      expect(writtenContent).toContain('SOME_OTHER_VAR=value');
      expect(writtenContent).toContain('AXONSERVER_PRIVATE_ENDPOINTS=http://axon-server:8080');
      expect(writtenContent).not.toContain('command:');
    });

    test('should extract custom endpoint from sed command', async () => {
      const customEndpointContent = `
services:
  axon-dash:
    command: >
      /bin/sh -c "sed -i 's|private_endpoints.*|private_endpoints: http://custom-server:9090|' /etc/axonops/axon-dash.yml"`;

      FS.existsSync.mockReturnValue(true);
      FS.readFileSync.mockReturnValue(customEndpointContent);
      FS.copyFileSync.mockReturnValue(undefined);
      FS.writeFileSync.mockReturnValue(undefined);
      
      await migrateDockerComposeFile(testFolderPath);
      
      const writtenContent = FS.writeFileSync.mock.calls[0][1];
      expect(writtenContent).toContain('AXONSERVER_PRIVATE_ENDPOINTS=http://custom-server:9090');
    });
  });

  describe('Error Handling', () => {
    test('should handle read errors gracefully', async () => {
      FS.existsSync.mockReturnValue(true);
      FS.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      const result = await migrateDockerComposeFile(testFolderPath);
      
      expect(result.migrated).toBe(false);
      expect(result.needed).toBe(true);
      expect(result.error).toBe('Permission denied');
      expect(errorLog).toHaveBeenCalled();
    });

    test('should handle write errors gracefully', async () => {
      FS.existsSync.mockReturnValue(true);
      FS.readFileSync.mockReturnValue(`services:
  axon-dash:
    command: > 
      sed -i 's|private_endpoints.*|private_endpoints: http://axon-server:8080|' /etc/axonops/axon-dash.yml`);
      FS.copyFileSync.mockReturnValue(undefined);
      FS.writeFileSync.mockImplementation(() => {
        throw new Error('Disk full');
      });
      
      const result = await migrateDockerComposeFile(testFolderPath);
      
      expect(result.migrated).toBe(false);
      expect(result.needed).toBe(true);
      expect(result.message).toContain('Disk full');
    });
  });

  describe('Backup Creation', () => {
    test('should create backup with correct timestamp format', async () => {
      // Test different times to ensure padding works
      const testCases = [
        { date: new Date('2024-01-05T09:30:00'), expected: '2024010509' },
        { date: new Date('2024-12-25T23:45:00'), expected: '2024122523' },
        { date: new Date('2024-06-04T00:00:00'), expected: '2024060400' }
      ];

      for (const testCase of testCases) {
        jest.setSystemTime(testCase.date);
        
        FS.existsSync.mockReturnValue(true);
        FS.readFileSync.mockReturnValue(`services:
  axon-dash:
    command: > 
      /bin/sh -c "sed -i 's|private_endpoints.*|private_endpoints: http://axon-server:8080|' /etc/axonops/axon-dash.yml"`);
        FS.copyFileSync.mockReturnValue(undefined);
        FS.writeFileSync.mockReturnValue(undefined);
        
        const result = await migrateDockerComposeFile(testFolderPath);
        
        expect(result.backupPath).toBe(`${composePath}.bak.${testCase.expected}`);
      }
    });
  });

  describe('Complex Migration Scenarios', () => {
    test('should handle sed command with additional flags and options', async () => {
      const complexSedContent = `
services:
  axon-dash:
    command: >
      /bin/sh -c "sed -i.bak -e 's|private_endpoints.*|private_endpoints: http://axon-server:8080|g' /etc/axonops/axon-dash.yml && rm /etc/axonops/axon-dash.yml.bak"`;

      FS.existsSync.mockReturnValue(true);
      FS.readFileSync.mockReturnValue(complexSedContent);
      FS.copyFileSync.mockReturnValue(undefined);
      FS.writeFileSync.mockReturnValue(undefined);
      
      const result = await migrateDockerComposeFile(testFolderPath);
      
      expect(result.migrated).toBe(true);
      const writtenContent = FS.writeFileSync.mock.calls[0][1];
      expect(writtenContent).toContain('AXONSERVER_PRIVATE_ENDPOINTS=http://axon-server:8080');
    });

    test('should handle command with multiple lines and complex formatting', async () => {
      const multilineContent = `
services:
  axon-dash:
    command: >
      /bin/sh -c "
        echo 'Starting configuration...' &&
        sed -i 's|private_endpoints.*|private_endpoints: http://axon-server:8080|' /etc/axonops/axon-dash.yml &&
        echo 'Configuration complete' &&
        exec /usr/local/bin/axon-dash
      "`;

      FS.existsSync.mockReturnValue(true);
      FS.readFileSync.mockReturnValue(multilineContent);
      FS.copyFileSync.mockReturnValue(undefined);
      FS.writeFileSync.mockReturnValue(undefined);
      
      const result = await migrateDockerComposeFile(testFolderPath);
      
      expect(result.migrated).toBe(true);
      const writtenContent = FS.writeFileSync.mock.calls[0][1];
      expect(writtenContent).toContain('environment:');
      expect(writtenContent).toContain('AXONSERVER_PRIVATE_ENDPOINTS=http://axon-server:8080');
    });

    test('should preserve indentation and formatting', async () => {
      const indentedContent = `version: "3.8"
services:
  axon-dash:
    image: registry.axonops.com/axonops-public/axonops-docker/axon-dash:latest
    command: >
      /bin/sh -c "sed -i 's|private_endpoints.*|private_endpoints: http://axon-server:8080|' /etc/axonops/axon-dash.yml"
    ports:
      - 3000:3000`;

      FS.existsSync.mockReturnValue(true);
      FS.readFileSync.mockReturnValue(indentedContent);
      FS.copyFileSync.mockReturnValue(undefined);
      FS.writeFileSync.mockReturnValue(undefined);
      
      const result = await migrateDockerComposeFile(testFolderPath);
      
      expect(result.migrated).toBe(true);
      const writtenContent = FS.writeFileSync.mock.calls[0][1];
      // Should maintain consistent indentation
      expect(writtenContent).toMatch(/^\s{4}environment:/m);
      expect(writtenContent).toMatch(/^\s{4}ports:/m);
    });

    test('should handle IPv6 addresses in endpoints', async () => {
      const ipv6Content = `
services:
  axon-dash:
    command: >
      /bin/sh -c "sed -i 's|private_endpoints.*|private_endpoints: http://[2001:db8::1]:8080|' /etc/axonops/axon-dash.yml"`;

      FS.existsSync.mockReturnValue(true);
      FS.readFileSync.mockReturnValue(ipv6Content);
      FS.copyFileSync.mockReturnValue(undefined);
      FS.writeFileSync.mockReturnValue(undefined);
      
      const result = await migrateDockerComposeFile(testFolderPath);
      
      expect(result.migrated).toBe(true);
      const writtenContent = FS.writeFileSync.mock.calls[0][1];
      expect(writtenContent).toContain('AXONSERVER_PRIVATE_ENDPOINTS=http://[2001:db8::1]:8080');
    });

    test('should handle URLs with authentication in endpoints', async () => {
      const authUrlContent = `
services:
  axon-dash:
    command: >
      /bin/sh -c "sed -i 's|private_endpoints.*|private_endpoints: http://user:pass@axon-server:8080/path|' /etc/axonops/axon-dash.yml"`;

      FS.existsSync.mockReturnValue(true);
      FS.readFileSync.mockReturnValue(authUrlContent);
      FS.copyFileSync.mockReturnValue(undefined);
      FS.writeFileSync.mockReturnValue(undefined);
      
      const result = await migrateDockerComposeFile(testFolderPath);
      
      expect(result.migrated).toBe(true);
      const writtenContent = FS.writeFileSync.mock.calls[0][1];
      expect(writtenContent).toContain('AXONSERVER_PRIVATE_ENDPOINTS=http://user:pass@axon-server:8080/path');
    });
  });

  describe('Migration Detection Logic', () => {
    test('should not migrate sed commands for other files', async () => {
      const otherSedContent = `
services:
  axon-dash:
    command: >
      /bin/sh -c "sed -i 's|some_config.*|some_config: value|' /etc/other/config.yml"`;

      FS.existsSync.mockReturnValue(true);
      FS.readFileSync.mockReturnValue(otherSedContent);
      
      const result = await migrateDockerComposeFile(testFolderPath);
      
      expect(result.migrated).toBe(false);
      expect(result.needed).toBe(false);
    });

    test('should not migrate if already has AXONSERVER_PRIVATE_ENDPOINTS', async () => {
      const alreadyMigratedContent = `
services:
  axon-dash:
    environment:
      - AXONSERVER_PRIVATE_ENDPOINTS=http://axon-server:8080
    # Old command commented out
    # command: > 
    #   /bin/sh -c "sed -i 's|private_endpoints.*|private_endpoints: http://axon-server:8080|' /etc/axonops/axon-dash.yml"`;

      FS.existsSync.mockReturnValue(true);
      FS.readFileSync.mockReturnValue(alreadyMigratedContent);
      
      const result = await migrateDockerComposeFile(testFolderPath);
      
      expect(result.migrated).toBe(false);
      expect(result.needed).toBe(false);
      expect(FS.copyFileSync).not.toHaveBeenCalled();
    });

    test('should handle commented out sed commands', async () => {
      const commentedContent = `
services:
  axon-dash:
    # command: >
    #   /bin/sh -c "sed -i 's|private_endpoints.*|private_endpoints: http://axon-server:8080|' /etc/axonops/axon-dash.yml"
    image: registry.axonops.com/axonops-public/axonops-docker/axon-dash:latest`;

      FS.existsSync.mockReturnValue(true);
      FS.readFileSync.mockReturnValue(commentedContent);
      
      const result = await migrateDockerComposeFile(testFolderPath);
      
      expect(result.migrated).toBe(false);
      expect(result.needed).toBe(false);
    });
  });

  describe('File System Edge Cases', () => {
    test('should handle backup creation when backup already exists', async () => {
      FS.existsSync.mockReturnValue(true);
      FS.readFileSync.mockReturnValue('command: > /bin/sh -c "sed -i \'s|private_endpoints.*|private_endpoints: http://axon-server:8080|\' /etc/axonops/axon-dash.yml"');
      // First call to copyFileSync fails (backup exists)
      FS.copyFileSync.mockImplementationOnce(() => {
        throw new Error('EEXIST: file already exists');
      });
      FS.writeFileSync.mockReturnValue(undefined);
      
      const result = await migrateDockerComposeFile(testFolderPath);
      
      // Should still fail gracefully
      expect(result.migrated).toBe(false);
      expect(result.needed).toBe(true);
    });

    test('should handle YAML files with BOM', async () => {
      // UTF-8 BOM + content
      const bomContent = '\ufeffversion: "3.8"\nservices:\n  axon-dash:\n    command: >\n      /bin/sh -c "sed -i \'s|private_endpoints.*|private_endpoints: http://axon-server:8080|\' /etc/axonops/axon-dash.yml"';
      
      FS.existsSync.mockReturnValue(true);
      FS.readFileSync.mockReturnValue(bomContent);
      FS.copyFileSync.mockReturnValue(undefined);
      FS.writeFileSync.mockReturnValue(undefined);
      
      const result = await migrateDockerComposeFile(testFolderPath);
      
      expect(result.migrated).toBe(true);
      const writtenContent = FS.writeFileSync.mock.calls[0][1];
      // BOM should be preserved
      expect(writtenContent.charCodeAt(0)).toBe(0xFEFF);
      expect(writtenContent).toContain('AXONSERVER_PRIVATE_ENDPOINTS=');
    });
  });

  describe('Logging Coverage', () => {
    test('should log all major operations', async () => {
      FS.existsSync.mockReturnValue(true);
      FS.readFileSync.mockReturnValue(`services:
  axon-dash:
    image: registry.axonops.com/axonops-public/axonops-docker/axon-dash:latest
    command: > 
      /bin/sh -c "sed -i 's|private_endpoints.*|private_endpoints: http://axon-server:8080|' /etc/axonops/axon-dash.yml && /usr/local/bin/axon-dash"`);
      FS.copyFileSync.mockReturnValue(undefined);
      FS.writeFileSync.mockReturnValue(undefined);
      
      await migrateDockerComposeFile(testFolderPath);
      
      // Should log backup creation
      expect(addLog).toHaveBeenCalledWith(
        expect.stringContaining('Created backup'),
        'info'
      );
      
      // Should log successful migration - may have multiple calls
      expect(addLog).toHaveBeenCalled();
      
      // Find the success call
      const successCall = addLog.mock.calls.find(call => 
        call[1] === 'success' && call[0].includes('Successfully migrated')
      );
      expect(successCall).toBeDefined();
    });

    test('should log errors appropriately', async () => {
      FS.existsSync.mockReturnValue(true);
      FS.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      await migrateDockerComposeFile(testFolderPath);
      
      expect(errorLog).toHaveBeenCalledWith(
        expect.any(Error),
        'docker-compose migration'
      );
    });
  });
});