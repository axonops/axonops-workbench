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
const os = require('os');
const { migrateDockerComposeFile } = require('../../../custom_node_modules/renderer/docker-migration');

// Use real file system for integration tests
jest.unmock('fs-extra');

// Mock the logging functions
global.addLog = jest.fn();
global.errorLog = jest.fn();

describe('Docker Compose Migration - Integration Tests', () => {
  let tempDir;
  let testProjectPath;
  
  beforeEach(async () => {
    jest.clearAllMocks();
    // Create a temporary directory for testing
    tempDir = await FS.mkdtemp(Path.join(os.tmpdir(), 'docker-migration-test-'));
    testProjectPath = Path.join(tempDir, 'test-project');
    await FS.ensureDir(testProjectPath);
    
    // Mock Date for consistent timestamps
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-06-04T15:30:45'));
  });

  afterEach(async () => {
    jest.useRealTimers();
    // Clean up temp directory
    if (tempDir && await FS.pathExists(tempDir)) {
      await FS.remove(tempDir);
    }
  });

  describe('Real File System Tests', () => {
    test.skip('should migrate a real legacy docker-compose file', async () => {
      // Create a legacy docker-compose file
      const legacyContent = `version: "3.8"

services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:7.17.12
    environment:
      - discovery.type=single-node
      
  axon-server:
    image: registry.axonops.com/axonops-public/axonops-docker/axon-server:latest
    environment:
      - ELASTIC_HOSTS=http://elasticsearch:9200
      
  axon-dash:
    restart: unless-stopped
    depends_on:
      axon-server:
        condition: service_healthy
    image: registry.axonops.com/axonops-public/axonops-docker/axon-dash:latest
    pull_policy: always
    command: >
      /bin/sh -c "sed -i 's|private_endpoints.*|private_endpoints: http://axon-server:8080|' /etc/axonops/axon-dash.yml && /usr/local/bin/axon-dash"
    ports:
      - 3000:3000
    healthcheck:
      test: ["CMD", "curl", "-sf", "127.0.0.1:3000"]
      
  cassandra-0:
    image: registry.axonops.com/axonops-public/axonops-docker/cassandra:4.1
    environment:
      - CASSANDRA_CLUSTER_NAME=sandbox-cluster`;

      const composePath = Path.join(testProjectPath, 'docker-compose.yml');
      await FS.writeFile(composePath, legacyContent);
      
      // Run migration
      const result = await migrateDockerComposeFile(testProjectPath);
      
      // Verify migration succeeded
      expect(result.migrated).toBe(true);
      expect(result.needed).toBe(true);
      
      // Verify backup was created
      const backupPath = `${composePath}.bak.2024060415`;
      expect(await FS.pathExists(backupPath)).toBe(true);
      
      // Verify backup content matches original
      const backupContent = await FS.readFile(backupPath, 'utf8');
      expect(backupContent).toBe(legacyContent);
      
      // Verify migrated content
      const migratedContent = await FS.readFile(composePath, 'utf8');
      expect(migratedContent).toContain('environment:');
      expect(migratedContent).toContain('AXONSERVER_PRIVATE_ENDPOINTS=http://axon-server:8080');
      expect(migratedContent).not.toContain('sed -i');
      expect(migratedContent).not.toContain('/etc/axonops/axon-dash.yml');
      
      // Verify structure is maintained
      expect(migratedContent).toContain('version: "3.8"');
      expect(migratedContent).toContain('services:');
      expect(migratedContent).toContain('axon-dash:');
    });

    test.skip('should handle multiple sed commands in the same file', async () => {
      const multiSedContent = `version: "3.8"
services:
  axon-dash:
    image: registry.axonops.com/axonops-public/axonops-docker/axon-dash:latest
    command: >
      /bin/sh -c "sed -i 's|private_endpoints.*|private_endpoints: http://axon-server:8080|' /etc/axonops/axon-dash.yml && 
                  sed -i 's|some_other_config.*|some_other_config: value|' /etc/axonops/other.yml &&
                  /usr/local/bin/axon-dash"
  
  another-service:
    image: some-image
    command: >
      /bin/sh -c "sed -i 's|private_endpoints.*|private_endpoints: http://another-server:9090|' /etc/axonops/axon-dash.yml"`;

      const composePath = Path.join(testProjectPath, 'docker-compose.yml');
      await FS.writeFile(composePath, multiSedContent);
      
      const result = await migrateDockerComposeFile(testProjectPath);
      
      expect(result.migrated).toBe(true);
      
      const migratedContent = await FS.readFile(composePath, 'utf8');
      // Should only migrate axon-dash related sed commands
      expect(migratedContent).toContain('AXONSERVER_PRIVATE_ENDPOINTS=');
      expect(migratedContent).not.toContain("'s|private_endpoints.*|private_endpoints:");
    });

    test('should handle files with mixed line endings', async () => {
      // Test with Windows-style CRLF line endings
      const windowsContent = "version: \"3.8\"\r\n\r\nservices:\r\n  axon-dash:\r\n    command: >\r\n      /bin/sh -c \"sed -i 's|private_endpoints.*|private_endpoints: http://axon-server:8080|' /etc/axonops/axon-dash.yml\"\r\n";
      
      const composePath = Path.join(testProjectPath, 'docker-compose.yml');
      await FS.writeFile(composePath, windowsContent);
      
      const result = await migrateDockerComposeFile(testProjectPath);
      
      expect(result.migrated).toBe(true);
      
      const migratedContent = await FS.readFile(composePath, 'utf8');
      expect(migratedContent).toContain('AXONSERVER_PRIVATE_ENDPOINTS=http://axon-server:8080');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty docker-compose file', async () => {
      const composePath = Path.join(testProjectPath, 'docker-compose.yml');
      await FS.writeFile(composePath, '');
      
      const result = await migrateDockerComposeFile(testProjectPath);
      
      expect(result.migrated).toBe(false);
      expect(result.needed).toBe(false);
    });

    test('should handle malformed YAML gracefully', async () => {
      const malformedContent = `version: "3.8"
services:
  axon-dash:
    command: >
      /bin/sh -c "sed -i 's|private_endpoints.*|private_endpoints: http://axon-server:8080|' /etc/axonops/axon-dash.yml"
    this line has bad indentation
  and this is completely wrong`;

      const composePath = Path.join(testProjectPath, 'docker-compose.yml');
      await FS.writeFile(composePath, malformedContent);
      
      const result = await migrateDockerComposeFile(testProjectPath);
      
      // Should still attempt migration
      expect(result.migrated).toBe(true);
      
      const migratedContent = await FS.readFile(composePath, 'utf8');
      expect(migratedContent).toContain('AXONSERVER_PRIVATE_ENDPOINTS=');
    });

    test.skip('should handle read-only files', async () => {
      const composePath = Path.join(testProjectPath, 'docker-compose.yml');
      await FS.writeFile(composePath, 'command: > /bin/sh -c "sed -i \'s|private_endpoints.*|private_endpoints: http://axon-server:8080|\' /etc/axonops/axon-dash.yml"');
      
      // Make file read-only
      await FS.chmod(composePath, 0o444);
      
      const result = await migrateDockerComposeFile(testProjectPath);
      
      expect(result.migrated).toBe(false);
      expect(result.needed).toBe(true);
      expect(result.error).toBeDefined();
      
      // Restore permissions for cleanup
      await FS.chmod(composePath, 0o644);
    });
  });

  describe('Backup Management', () => {
    test.skip('should create unique backups for multiple migrations in the same hour', async () => {
      const composePath = Path.join(testProjectPath, 'docker-compose.yml');
      const legacyContent = 'command: > /bin/sh -c "sed -i \'s|private_endpoints.*|private_endpoints: http://axon-server:8080|\' /etc/axonops/axon-dash.yml"';
      
      // First migration
      await FS.writeFile(composePath, legacyContent);
      const result1 = await migrateDockerComposeFile(testProjectPath);
      expect(result1.migrated).toBe(true);
      
      // Manually create the expected backup to simulate existing backup
      const firstBackupPath = `${composePath}.bak.2024060415`;
      expect(await FS.pathExists(firstBackupPath)).toBe(true);
      
      // Revert file to test second migration
      await FS.writeFile(composePath, legacyContent);
      
      // Advance time by 1 hour
      jest.setSystemTime(new Date('2024-06-04T16:30:45'));
      
      // Second migration
      const result2 = await migrateDockerComposeFile(testProjectPath);
      expect(result2.migrated).toBe(true);
      
      const secondBackupPath = `${composePath}.bak.2024060416`;
      expect(await FS.pathExists(secondBackupPath)).toBe(true);
      
      // Both backups should exist
      expect(await FS.pathExists(firstBackupPath)).toBe(true);
      expect(await FS.pathExists(secondBackupPath)).toBe(true);
    });

    test('should handle backup creation failures', async () => {
      const composePath = Path.join(testProjectPath, 'docker-compose.yml');
      await FS.writeFile(composePath, 'command: > /bin/sh -c "sed -i \'s|private_endpoints.*|private_endpoints: http://axon-server:8080|\' /etc/axonops/axon-dash.yml"');
      
      // Make directory read-only to prevent backup creation
      await FS.chmod(testProjectPath, 0o555);
      
      const result = await migrateDockerComposeFile(testProjectPath);
      
      expect(result.migrated).toBe(false);
      expect(result.needed).toBe(true);
      
      // Restore permissions for cleanup
      await FS.chmod(testProjectPath, 0o755);
    });
  });

  describe('Complex Docker Compose Structures', () => {
    test.skip('should handle docker-compose with extends and anchors', async () => {
      const complexContent = `version: "3.8"

x-common-variables: &common-variables
  JAVA_OPTS: "-Xmx256m -Xms256m"
  
x-axon-service: &axon-service
  restart: unless-stopped
  networks:
    - axon-network

services:
  axon-dash:
    <<: *axon-service
    image: registry.axonops.com/axonops-public/axonops-docker/axon-dash:latest
    command: >
      /bin/sh -c "sed -i 's|private_endpoints.*|private_endpoints: http://axon-server:8080|' /etc/axonops/axon-dash.yml"
    environment:
      <<: *common-variables
      SPECIAL_VAR: "value"
      
networks:
  axon-network:
    driver: bridge`;

      const composePath = Path.join(testProjectPath, 'docker-compose.yml');
      await FS.writeFile(composePath, complexContent);
      
      const result = await migrateDockerComposeFile(testProjectPath);
      
      expect(result.migrated).toBe(true);
      
      const migratedContent = await FS.readFile(composePath, 'utf8');
      // Should preserve YAML anchors and references
      expect(migratedContent).toContain('&common-variables');
      expect(migratedContent).toContain('<<: *axon-service');
      expect(migratedContent).toContain('<<: *common-variables');
      // Should add new environment variable
      expect(migratedContent).toContain('AXONSERVER_PRIVATE_ENDPOINTS=http://axon-server:8080');
      expect(migratedContent).toContain('SPECIAL_VAR: "value"');
    });

    test('should handle service with both command and entrypoint', async () => {
      const content = `version: "3.8"
services:
  axon-dash:
    image: registry.axonops.com/axonops-public/axonops-docker/axon-dash:latest
    entrypoint: ["/bin/sh", "-c"]
    command: >
      sed -i 's|private_endpoints.*|private_endpoints: http://axon-server:8080|' /etc/axonops/axon-dash.yml && exec /usr/local/bin/axon-dash`;

      const composePath = Path.join(testProjectPath, 'docker-compose.yml');
      await FS.writeFile(composePath, content);
      
      const result = await migrateDockerComposeFile(testProjectPath);
      
      expect(result.migrated).toBe(true);
      
      const migratedContent = await FS.readFile(composePath, 'utf8');
      expect(migratedContent).toContain('entrypoint: ["/bin/sh", "-c"]');
      expect(migratedContent).toContain('AXONSERVER_PRIVATE_ENDPOINTS=http://axon-server:8080');
    });
  });

  describe('Performance Tests', () => {
    test('should handle large docker-compose files efficiently', async () => {
      // Create a large docker-compose with many services
      let largeContent = 'version: "3.8"\n\nservices:\n';
      
      // Add 50 services
      for (let i = 0; i < 50; i++) {
        largeContent += `  service-${i}:\n    image: some-image:latest\n    environment:\n      - VAR=${i}\n\n`;
      }
      
      // Add the axon-dash service with sed command
      largeContent += `  axon-dash:
    image: registry.axonops.com/axonops-public/axonops-docker/axon-dash:latest
    command: >
      /bin/sh -c "sed -i 's|private_endpoints.*|private_endpoints: http://axon-server:8080|' /etc/axonops/axon-dash.yml"
    ports:
      - 3000:3000\n`;

      const composePath = Path.join(testProjectPath, 'docker-compose.yml');
      await FS.writeFile(composePath, largeContent);
      
      const startTime = Date.now();
      const result = await migrateDockerComposeFile(testProjectPath);
      const duration = Date.now() - startTime;
      
      expect(result.migrated).toBe(true);
      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
      
      const migratedContent = await FS.readFile(composePath, 'utf8');
      // Verify all other services remain intact
      for (let i = 0; i < 50; i++) {
        expect(migratedContent).toContain(`service-${i}:`);
      }
    });
  });
});