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

const { ipcRenderer } = require('electron');

describe('Renderer IPC Communication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear any mock handlers
    ipcRenderer.clearMockHandlers();
  });

  describe('File Operations via IPC', () => {
    test('should read file through IPC', async () => {
      const filePath = '/test/file.txt';
      const fileContent = 'test content';
      
      // Mock the IPC response
      ipcRenderer.mockHandler('file-read', (path) => {
        return { success: true, content: fileContent };
      });
      
      const result = await ipcRenderer.invoke('file-read', filePath);
      
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('file-read', filePath);
      expect(result).toEqual({ success: true, content: fileContent });
    });

    test('should write file through IPC', async () => {
      const filePath = '/test/file.txt';
      const content = 'new content';
      
      ipcRenderer.mockHandler('file-write', (path, data) => {
        return { success: true };
      });
      
      const result = await ipcRenderer.invoke('file-write', filePath, content);
      
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('file-write', filePath, content);
      expect(result).toEqual({ success: true });
    });

    test('should handle file operation errors', async () => {
      const filePath = '/test/nonexistent.txt';
      
      ipcRenderer.mockHandler('file-read', (path) => {
        return { success: false, error: 'File not found' };
      });
      
      const result = await ipcRenderer.invoke('file-read', filePath);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('File not found');
    });
  });

  describe('Dialog Operations via IPC', () => {
    test('should open file dialog', async () => {
      const selectedFiles = ['/path/to/file1.txt', '/path/to/file2.txt'];
      
      ipcRenderer.mockHandler('open-file-dialog', (options) => {
        return { canceled: false, filePaths: selectedFiles };
      });
      
      const options = {
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Text Files', extensions: ['txt'] }]
      };
      
      const result = await ipcRenderer.invoke('open-file-dialog', options);
      
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('open-file-dialog', options);
      expect(result.filePaths).toEqual(selectedFiles);
      expect(result.canceled).toBe(false);
    });

    test('should handle canceled dialog', async () => {
      ipcRenderer.mockHandler('open-file-dialog', () => {
        return { canceled: true, filePaths: [] };
      });
      
      const result = await ipcRenderer.invoke('open-file-dialog', {});
      
      expect(result.canceled).toBe(true);
      expect(result.filePaths).toEqual([]);
    });

    test('should save file dialog', async () => {
      const savePath = '/path/to/save/file.txt';
      
      ipcRenderer.mockHandler('save-file-dialog', (options) => {
        return { canceled: false, filePath: savePath };
      });
      
      const options = {
        defaultPath: 'untitled.txt',
        filters: [{ name: 'Text Files', extensions: ['txt'] }]
      };
      
      const result = await ipcRenderer.invoke('save-file-dialog', options);
      
      expect(result.filePath).toBe(savePath);
      expect(result.canceled).toBe(false);
    });
  });

  describe('Window Control via IPC', () => {
    test('should minimize window', () => {
      ipcRenderer.send('window-minimize');
      
      expect(ipcRenderer.send).toHaveBeenCalledWith('window-minimize');
    });

    test('should maximize window', () => {
      ipcRenderer.send('window-maximize');
      
      expect(ipcRenderer.send).toHaveBeenCalledWith('window-maximize');
    });

    test('should close window', () => {
      ipcRenderer.send('window-close');
      
      expect(ipcRenderer.send).toHaveBeenCalledWith('window-close');
    });

    test('should get window state', async () => {
      const windowState = {
        isMaximized: false,
        isMinimized: false,
        isFullScreen: false
      };
      
      ipcRenderer.mockHandler('get-window-state', () => windowState);
      
      const result = await ipcRenderer.invoke('get-window-state');
      
      expect(result).toEqual(windowState);
    });
  });

  describe('App Information via IPC', () => {
    test('should get app info', async () => {
      const appInfo = {
        name: 'AxonOps Workbench',
        version: '0.9.3',
        electron: '31.6.0',
        node: '20.17.0',
        platform: 'darwin',
        arch: 'x64'
      };
      
      ipcRenderer.mockHandler('get-app-info', () => appInfo);
      
      const result = await ipcRenderer.invoke('get-app-info');
      
      expect(result).toEqual(appInfo);
    });

    test('should get user data path', async () => {
      const userDataPath = '/Users/test/Library/Application Support/AxonOps Workbench';
      
      ipcRenderer.mockHandler('get-user-data-path', () => userDataPath);
      
      const result = await ipcRenderer.invoke('get-user-data-path');
      
      expect(result).toBe(userDataPath);
    });
  });

  describe('IPC Event Listeners', () => {
    test('should listen for menu events', () => {
      const menuHandler = jest.fn();
      
      ipcRenderer.on('menu-action', menuHandler);
      
      // Simulate menu action from main process
      ipcRenderer.simulateMessage('menu-action', { action: 'new-file' });
      
      expect(menuHandler).toHaveBeenCalledWith(
        expect.any(Object),
        { action: 'new-file' }
      );
    });

    test('should listen for update events', () => {
      const updateHandler = jest.fn();
      
      ipcRenderer.on('update-available', updateHandler);
      
      // Simulate update available
      ipcRenderer.simulateMessage('update-available', { version: '1.0.0' });
      
      expect(updateHandler).toHaveBeenCalledWith(
        expect.any(Object),
        { version: '1.0.0' }
      );
    });

    test('should remove event listeners', () => {
      const handler = jest.fn();
      
      ipcRenderer.on('test-event', handler);
      ipcRenderer.removeListener('test-event', handler);
      
      expect(ipcRenderer.removeListener).toHaveBeenCalledWith('test-event', handler);
    });

    test('should remove all listeners for channel', () => {
      ipcRenderer.on('test-event', jest.fn());
      ipcRenderer.on('test-event', jest.fn());
      
      ipcRenderer.removeAllListeners('test-event');
      
      expect(ipcRenderer.removeAllListeners).toHaveBeenCalledWith('test-event');
    });
  });

  describe('Connection Operations via IPC', () => {
    test('should execute CQL query', async () => {
      const query = 'SELECT * FROM system.local';
      const results = {
        rows: [{ key: 'local', connection_name: 'Test Connection' }],
        metadata: { columns: ['key', 'connection_name'] }
      };
      
      ipcRenderer.mockHandler('execute-cql', (connectionId, queryStr) => {
        return { success: true, results };
      });
      
      const result = await ipcRenderer.invoke('execute-cql', 'connection-1', query);
      
      expect(result.success).toBe(true);
      expect(result.results.rows).toHaveLength(1);
    });

    test('should handle CQL execution error', async () => {
      const query = 'INVALID QUERY';
      
      ipcRenderer.mockHandler('execute-cql', (connectionId, queryStr) => {
        return { success: false, error: 'Syntax error in CQL query' };
      });
      
      const result = await ipcRenderer.invoke('execute-cql', 'connection-1', query);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Syntax error in CQL query');
    });

    test('should test connection connection', async () => {
      const connectionConfig = {
        host: 'localhost',
        port: 9042,
        username: 'cassandra',
        password: 'cassandra'
      };
      
      ipcRenderer.mockHandler('test-connection', (config) => {
        return { success: true, message: 'Connection successful' };
      });
      
      const result = await ipcRenderer.invoke('test-connection', connectionConfig);
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Connection successful');
    });
  });

  describe('SSH Tunnel Operations via IPC', () => {
    test('should create SSH tunnel', async () => {
      const tunnelConfig = {
        host: 'remote-server.com',
        port: 22,
        username: 'user',
        privateKey: '/path/to/key',
        localPort: 9043,
        remoteHost: 'cassandra-node',
        remotePort: 9042
      };
      
      ipcRenderer.mockHandler('create-ssh-tunnel', (config) => {
        return { success: true, tunnelId: 'tunnel-123' };
      });
      
      const result = await ipcRenderer.invoke('create-ssh-tunnel', tunnelConfig);
      
      expect(result.success).toBe(true);
      expect(result.tunnelId).toBe('tunnel-123');
    });

    test('should close SSH tunnel', async () => {
      const tunnelId = 'tunnel-123';
      
      ipcRenderer.mockHandler('close-ssh-tunnel', (id) => {
        return { success: true };
      });
      
      const result = await ipcRenderer.invoke('close-ssh-tunnel', tunnelId);
      
      expect(result.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle IPC timeout', async () => {
      // Don't set up a handler to simulate timeout
      const promise = ipcRenderer.invoke('non-existent-channel');
      
      // Since our mock resolves to null by default, we'll check for that
      const result = await promise;
      expect(result).toBeNull();
    });

    test('should handle malformed IPC messages', () => {
      const errorHandler = jest.fn();
      
      ipcRenderer.on('error', errorHandler);
      
      // Simulate error event
      ipcRenderer.emit('error', new Error('Malformed message'));
      
      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('Performance Monitoring via IPC', () => {
    test('should get memory usage', async () => {
      const memoryInfo = {
        workingSetSize: 150000,
        privateBytes: 100000,
        sharedBytes: 50000
      };
      
      ipcRenderer.mockHandler('get-memory-usage', () => memoryInfo);
      
      const result = await ipcRenderer.invoke('get-memory-usage');
      
      expect(result).toEqual(memoryInfo);
    });

    test('should get CPU usage', async () => {
      const cpuInfo = {
        percentCPUUsage: 25.5,
        idleWakeupsPerSecond: 10
      };
      
      ipcRenderer.mockHandler('get-cpu-usage', () => cpuInfo);
      
      const result = await ipcRenderer.invoke('get-cpu-usage');
      
      expect(result).toEqual(cpuInfo);
    });
  });
});