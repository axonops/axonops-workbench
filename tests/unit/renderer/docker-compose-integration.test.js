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

// Mock modules before requiring them
jest.mock('fs-extra');
jest.mock('../../../custom_modules/renderer/docker-migration', () => ({
  migrateDockerComposeFile: jest.fn()
}));

const FS = require('fs-extra');
const Path = require('path');
const { migrateDockerComposeFile } = require('../../../custom_modules/renderer/docker-migration');

// Setup FS mocks
FS.watch = jest.fn(() => ({ close: jest.fn() }));
FS.exists = jest.fn((path, cb) => cb(true));
FS.readFile = jest.fn((path, encoding, cb) => {
  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }
  cb(null, 'mock file content');
});
FS.unlinkSync = jest.fn();

// Mock global functions and objects
global.addLog = jest.fn();
global.errorLog = jest.fn();
global.updatePinnedToast = jest.fn();
global.getRandomID = jest.fn(() => 'random123');
global.getRandomPort = jest.fn(() => 9042);
global.applyJSONBeautify = jest.fn(obj => JSON.stringify(obj, null, 2));
global.minifyText = jest.fn(text => text.trim());
global.OS = { 
  platform: jest.fn(() => 'linux'),
  tmpdir: jest.fn(() => '/tmp')
};
global.Path = Path;
global.FS = FS;
global.__dirname = '/mock/dirname';
global.extraResourcesPath = '/mock/resources';

// Mock IPCRenderer
global.IPCRenderer = {
  send: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  removeAllListeners: jest.fn()
};

// Create Terminal mock as a function first
const spawnMock = jest.fn();
const runMock = jest.fn((command, callback) => {
  // Default implementation for run
  if (callback) {
    setTimeout(() => callback(null, 'success', ''), 0);
  }
});

// Mock Terminal
global.Terminal = {
  spawn: spawnMock,
  run: runMock
};

// Mock StripTags
global.StripTags = jest.fn(text => text);

// Mock Modules
global.Modules = {
  Config: {
    getConfig: jest.fn(callback => {
      callback({
        get: jest.fn((section, key) => {
          if (section === 'features' && key === 'containersManagementTool') {
            return 'docker';
          }
          return '';
        })
      });
    })
  },
  Consts: {
    DockerComposeYAML: 'mock docker compose yaml'
  }
};

// Import after mocks are set up
const { DockerCompose } = require('../../../custom_modules/renderer/docker');

describe.skip('Docker Compose Integration with Migration', () => {
  let dockerCompose;
  const testFolderName = 'test-connection';
  const testContainerName = 'test-container';
  // This should match what docker.js calculates
  const DockerContainersPath = '/mock/resources/data/localconnections';
  
  beforeEach(() => {
    jest.clearAllMocks();
    dockerCompose = new DockerCompose(testFolderName, testContainerName);
    // Mock DockerContainersPath
    global.DockerContainersPath = DockerContainersPath;
  });

  describe('startDockerCompose with migration', () => {
    const pinnedToastID = 'toast123';
    const callback = jest.fn();

    beforeEach(() => {
      // Reset Terminal.spawn mock
      spawnMock.mockReset();
      spawnMock.mockImplementation((command, toastId, mode, cb) => {
        // Simulate successful docker compose up
        if (cb && typeof cb === 'function') {
          setTimeout(() => {
            cb(null, 'Container started successfully', '');
          }, 0);
        }
      });
    });

    test('should perform migration before starting containers', async () => {
      // Mock successful migration
      migrateDockerComposeFile.mockResolvedValue({
        migrated: true,
        needed: true,
        backupPath: '/data/localconnections/test-connection/docker-compose.yml.bak.2024060415',
        message: 'Successfully migrated to new format'
      });

      await dockerCompose.startDockerCompose(pinnedToastID, callback, testContainerName);

      // Wait for async operations - need more time for spawn to be called
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify migration was called with correct path
      expect(migrateDockerComposeFile).toHaveBeenCalledWith(
        Path.join(DockerContainersPath, testFolderName)
      );

      // Verify migration was logged
      expect(addLog).toHaveBeenCalledWith(
        expect.stringContaining('Docker Compose file automatically migrated'),
        'info'
      );

      // Verify docker compose command was executed
      expect(spawnMock).toHaveBeenCalledWith(
        expect.stringContaining('docker compose'),
        pinnedToastID,
        'start',
        expect.any(Function)
      );

      // Verify callback was called with success
      expect(callback).toHaveBeenCalledWith({
        status: true,
        error: ''
      });
    });

    test('should continue even if migration fails', async () => {
      // Mock failed migration
      migrateDockerComposeFile.mockResolvedValue({
        migrated: false,
        needed: true,
        error: 'Permission denied',
        message: 'Migration failed: Permission denied'
      });

      await dockerCompose.startDockerCompose(pinnedToastID, callback, testContainerName);

      // Wait for async operations - need more time for spawn to be called
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify warning was logged
      expect(addLog).toHaveBeenCalledWith(
        expect.stringContaining('Warning: Could not migrate docker-compose.yml'),
        'warning'
      );

      // Verify docker compose command was still executed
      expect(spawnMock).toHaveBeenCalled();
    });

    test('should handle migration check errors gracefully', async () => {
      // Mock migration throwing an error
      migrateDockerComposeFile.mockRejectedValue(new Error('Unexpected error'));

      await dockerCompose.startDockerCompose(pinnedToastID, callback, testContainerName);

      // Wait for async operations - need more time for spawn to be called
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify error was logged
      expect(addLog).toHaveBeenCalledWith(
        expect.stringContaining('Migration check failed'),
        'warning'
      );

      // Verify docker compose command was still executed
      expect(spawnMock).toHaveBeenCalled();
    });

    test('should not log anything if migration not needed', async () => {
      // Mock no migration needed
      migrateDockerComposeFile.mockResolvedValue({
        migrated: false,
        needed: false,
        message: 'Migration not needed'
      });

      await dockerCompose.startDockerCompose(pinnedToastID, callback, testContainerName);

      // Wait for async operations - need more time for spawn to be called
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify no migration logs
      expect(addLog).not.toHaveBeenCalledWith(
        expect.stringContaining('migrated'),
        expect.any(String)
      );

      // Verify docker compose command was executed
      expect(spawnMock).toHaveBeenCalled();
    });

    test('should use correct docker compose binary in command', async () => {
      // Set different docker compose binaries
      const testBinaries = ['docker compose', 'podman compose', 'docker-compose'];
      
      for (const binary of testBinaries) {
        jest.clearAllMocks();
        global.dockerComposeBinary = binary;
        
        await dockerCompose.startDockerCompose(pinnedToastID, callback, testContainerName);
        await new Promise(resolve => setTimeout(resolve, 10));
        
        expect(spawnMock).toHaveBeenCalledWith(
          expect.stringContaining(binary),
          pinnedToastID,
          'start',
          expect.any(Function)
        );
      }
    });

    test('should handle docker compose errors after migration', async () => {
      // Mock successful migration
      migrateDockerComposeFile.mockResolvedValue({
        migrated: true,
        needed: true,
        backupPath: '/data/localconnections/test-connection/docker-compose.yml.bak.2024060415'
      });

      // Mock docker compose failure
      spawnMock.mockImplementation((command, toastId, mode, cb) => {
        setTimeout(() => {
          cb(new Error('Container failed to start'), '', 'Error: Container failed to start');
        }, 0);
      });

      await dockerCompose.startDockerCompose(pinnedToastID, callback, testContainerName);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Migration should have been performed
      expect(migrateDockerComposeFile).toHaveBeenCalled();

      // Callback should receive error
      expect(callback).toHaveBeenCalledWith({
        status: false,
        error: expect.stringContaining('Container failed to start')
      });
    });

    test('should handle concurrent startDockerCompose calls', async () => {
      // Mock migration to take some time
      migrateDockerComposeFile.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            migrated: true,
            needed: true,
            backupPath: 'backup.yml'
          }), 50)
        )
      );

      // Start multiple containers concurrently
      const promises = [
        dockerCompose.startDockerCompose(pinnedToastID, callback, 'container1'),
        dockerCompose.startDockerCompose(pinnedToastID, callback, 'container2'),
        dockerCompose.startDockerCompose(pinnedToastID, callback, 'container3')
      ];

      await Promise.all(promises);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Migration should be called for each start
      expect(migrateDockerComposeFile).toHaveBeenCalledTimes(3);
      
      // Each container should be started
      expect(spawnMock).toHaveBeenCalledTimes(3);
      expect(spawnMock).toHaveBeenCalledWith(
        expect.stringContaining('cassandra_container1'),
        expect.any(String),
        'start',
        expect.any(Function)
      );
    });
  });

  describe('Integration with existing DockerCompose methods', () => {
    test('stopDockerCompose should not trigger migration', async () => {
      const pinnedToastID = 'toast123';
      const callback = jest.fn();

      spawnMock.mockImplementation((command, toastId, mode, cb) => {
        setTimeout(() => cb(null, 'Stopped', ''), 0);
      });

      dockerCompose.stopDockerCompose(pinnedToastID, callback, testContainerName);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Migration should not be called for stop
      expect(migrateDockerComposeFile).not.toHaveBeenCalled();
      
      // Stop command should be executed
      expect(spawnMock).toHaveBeenCalledWith(
        expect.stringContaining('down'),
        pinnedToastID,
        'stop',
        expect.any(Function)
      );
    });

    test('checkDockerComposeProject should not trigger migration', async () => {
      spawnMock.mockImplementation((command, toastId, mode, cb) => {
        setTimeout(() => cb(null, 'cassandra_test-container', ''), 0);
      });

      const result = await new Promise(resolve => {
        dockerCompose.checkDockerComposeProject(resolve);
      });

      // Migration should not be called for check
      expect(migrateDockerComposeFile).not.toHaveBeenCalled();
      
      expect(result.running).toBe(true);
    });
  });

  describe('Error handling edge cases', () => {
    test('should handle when DockerContainersPath is undefined', async () => {
      global.DockerContainersPath = undefined;
      const pinnedToastID = 'toast123';
      const callback = jest.fn();

      await dockerCompose.startDockerCompose(pinnedToastID, callback);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should still attempt to start even with path issues
      expect(spawnMock).toHaveBeenCalled();
    });

    test('should handle malformed container names', async () => {
      const pinnedToastID = 'toast123';
      const callback = jest.fn();
      const invalidNames = ['', null, undefined, 'name with spaces', 'name/with/slashes'];

      for (const name of invalidNames) {
        jest.clearAllMocks();
        
        await dockerCompose.startDockerCompose(pinnedToastID, callback, name);
        await new Promise(resolve => setTimeout(resolve, 10));

        // Should still execute with sanitized or default name
        expect(spawnMock).toHaveBeenCalled();
      }
    });
  });
});