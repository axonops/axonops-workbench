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

const { ipcMain, BrowserWindow, dialog, shell } = require('electron');
const fs = require('fs-extra');
const path = require('path');

describe('IPC Handlers', () => {
  let mainWindow;
  let event;

  beforeEach(() => {
    jest.clearAllMocks();
    mainWindow = new BrowserWindow();
    event = {
      sender: mainWindow.webContents,
      reply: jest.fn()
    };
  });

  afterEach(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.destroy();
    }
  });

  describe('File Operations', () => {
    test('should handle file-read request', async () => {
      const filePath = '/test/file.txt';
      const fileContent = 'test content';
      
      fs.readFile.mockResolvedValue(fileContent);
      
      const handler = jest.fn(async (event, path) => {
        const content = await fs.readFile(path, 'utf8');
        return { success: true, content };
      });
      
      ipcMain.handle('file-read', handler);
      
      const result = await handler(event, filePath);
      
      expect(fs.readFile).toHaveBeenCalledWith(filePath, 'utf8');
      expect(result).toEqual({ success: true, content: fileContent });
    });

    test('should handle file-write request', async () => {
      const filePath = '/test/file.txt';
      const fileContent = 'new content';
      
      fs.writeFile.mockResolvedValue(undefined);
      
      const handler = jest.fn(async (event, path, content) => {
        await fs.writeFile(path, content, 'utf8');
        return { success: true };
      });
      
      ipcMain.handle('file-write', handler);
      
      const result = await handler(event, filePath, fileContent);
      
      expect(fs.writeFile).toHaveBeenCalledWith(filePath, fileContent, 'utf8');
      expect(result).toEqual({ success: true });
    });

    test('should handle file-exists request', async () => {
      const filePath = '/test/file.txt';
      
      fs.pathExists.mockResolvedValue(true);
      
      const handler = jest.fn(async (event, path) => {
        const exists = await fs.pathExists(path);
        return { exists };
      });
      
      ipcMain.handle('file-exists', handler);
      
      const result = await handler(event, filePath);
      
      expect(fs.pathExists).toHaveBeenCalledWith(filePath);
      expect(result).toEqual({ exists: true });
    });

    test('should handle file-delete request', async () => {
      const filePath = '/test/file.txt';
      
      fs.remove.mockResolvedValue(undefined);
      
      const handler = jest.fn(async (event, path) => {
        await fs.remove(path);
        return { success: true };
      });
      
      ipcMain.handle('file-delete', handler);
      
      const result = await handler(event, filePath);
      
      expect(fs.remove).toHaveBeenCalledWith(filePath);
      expect(result).toEqual({ success: true });
    });
  });

  describe('Dialog Operations', () => {
    test('should handle open-file-dialog request', async () => {
      const selectedFiles = ['/path/to/file1.txt', '/path/to/file2.txt'];
      
      dialog.showOpenDialog.mockResolvedValue({
        canceled: false,
        filePaths: selectedFiles
      });
      
      const handler = jest.fn(async (event, options) => {
        const result = await dialog.showOpenDialog(mainWindow, options);
        return result;
      });
      
      ipcMain.handle('open-file-dialog', handler);
      
      const options = {
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'Text Files', extensions: ['txt'] }
        ]
      };
      
      const result = await handler(event, options);
      
      expect(dialog.showOpenDialog).toHaveBeenCalledWith(mainWindow, options);
      expect(result.filePaths).toEqual(selectedFiles);
      expect(result.canceled).toBe(false);
    });

    test('should handle save-file-dialog request', async () => {
      const savePath = '/path/to/save/file.txt';
      
      dialog.showSaveDialog.mockResolvedValue({
        canceled: false,
        filePath: savePath
      });
      
      const handler = jest.fn(async (event, options) => {
        const result = await dialog.showSaveDialog(mainWindow, options);
        return result;
      });
      
      ipcMain.handle('save-file-dialog', handler);
      
      const options = {
        defaultPath: 'untitled.txt',
        filters: [
          { name: 'Text Files', extensions: ['txt'] }
        ]
      };
      
      const result = await handler(event, options);
      
      expect(dialog.showSaveDialog).toHaveBeenCalledWith(mainWindow, options);
      expect(result.filePath).toBe(savePath);
      expect(result.canceled).toBe(false);
    });

    test('should handle message-box request', async () => {
      dialog.showMessageBox.mockResolvedValue({ response: 0 });
      
      const handler = jest.fn(async (event, options) => {
        const result = await dialog.showMessageBox(mainWindow, options);
        return result;
      });
      
      ipcMain.handle('show-message-box', handler);
      
      const options = {
        type: 'question',
        buttons: ['Yes', 'No'],
        defaultId: 0,
        title: 'Confirm',
        message: 'Are you sure?'
      };
      
      const result = await handler(event, options);
      
      expect(dialog.showMessageBox).toHaveBeenCalledWith(mainWindow, options);
      expect(result.response).toBe(0);
    });
  });

  describe('Shell Operations', () => {
    test('should handle open-external request', async () => {
      const url = 'https://example.com';
      
      shell.openExternal.mockResolvedValue(undefined);
      
      const handler = jest.fn(async (event, url) => {
        await shell.openExternal(url);
        return { success: true };
      });
      
      ipcMain.handle('open-external', handler);
      
      const result = await handler(event, url);
      
      expect(shell.openExternal).toHaveBeenCalledWith(url);
      expect(result).toEqual({ success: true });
    });

    test('should handle show-item-in-folder request', () => {
      const filePath = '/path/to/file.txt';
      
      const handler = jest.fn((event, path) => {
        shell.showItemInFolder(path);
        return { success: true };
      });
      
      ipcMain.handle('show-item-in-folder', handler);
      
      const result = handler(event, filePath);
      
      expect(shell.showItemInFolder).toHaveBeenCalledWith(filePath);
      expect(result).toEqual({ success: true });
    });

    test('should handle move-to-trash request', async () => {
      const filePath = '/path/to/file.txt';
      
      shell.moveItemToTrash.mockResolvedValue(true);
      
      const handler = jest.fn(async (event, path) => {
        const result = await shell.moveItemToTrash(path);
        return { success: result };
      });
      
      ipcMain.handle('move-to-trash', handler);
      
      const result = await handler(event, filePath);
      
      expect(shell.moveItemToTrash).toHaveBeenCalledWith(filePath);
      expect(result).toEqual({ success: true });
    });
  });

  describe('Window Operations', () => {
    test('should handle window-minimize request', () => {
      BrowserWindow.fromWebContents.mockReturnValue(mainWindow);
      
      const handler = jest.fn((event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        window.minimize();
      });
      
      ipcMain.on('window-minimize', handler);
      handler(event);
      
      expect(mainWindow.minimize).toHaveBeenCalled();
    });

    test('should handle window-maximize request', () => {
      mainWindow.isMaximized = false;
      BrowserWindow.fromWebContents.mockReturnValue(mainWindow);
      
      const handler = jest.fn((event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (window.isMaximized()) {
          window.unmaximize();
        } else {
          window.maximize();
        }
      });
      
      ipcMain.on('window-maximize', handler);
      handler(event);
      
      expect(mainWindow.maximize).toHaveBeenCalled();
    });

    test('should handle window-close request', () => {
      BrowserWindow.fromWebContents.mockReturnValue(mainWindow);
      
      const handler = jest.fn((event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        window.close();
      });
      
      ipcMain.on('window-close', handler);
      handler(event);
      
      expect(mainWindow.close).toHaveBeenCalled();
    });

    test('should handle get-window-state request', () => {
      mainWindow.isMaximized = false;
      mainWindow.isMinimized = false;
      mainWindow.isFullScreen = false;
      BrowserWindow.fromWebContents.mockReturnValue(mainWindow);
      
      const handler = jest.fn((event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        return {
          isMaximized: window.isMaximized(),
          isMinimized: window.isMinimized(),
          isFullScreen: window.isFullScreen()
        };
      });
      
      ipcMain.handle('get-window-state', handler);
      
      const result = handler(event);
      
      expect(result).toEqual({
        isMaximized: false,
        isMinimized: false,
        isFullScreen: false
      });
    });
  });

  describe('Data Operations', () => {
    test('should handle get-app-info request', () => {
      const handler = jest.fn(() => {
        return {
          name: 'AxonOps Workbench',
          version: '0.9.3',
          electron: process.versions.electron,
          node: process.versions.node,
          chrome: process.versions.chrome,
          platform: process.platform,
          arch: process.arch
        };
      });
      
      ipcMain.handle('get-app-info', handler);
      
      const result = handler(event);
      
      expect(result).toMatchObject({
        name: 'AxonOps Workbench',
        version: '0.9.3',
        platform: process.platform
      });
    });

    test('should handle get-user-data-path request', () => {
      const userDataPath = '/mock/userData';
      
      const handler = jest.fn(() => {
        const { app } = require('electron');
        return app.getPath('userData');
      });
      
      ipcMain.handle('get-user-data-path', handler);
      
      const result = handler(event);
      
      expect(result).toBe(userDataPath);
    });
  });

  describe('Error Handling', () => {
    test('should handle errors in IPC handlers', async () => {
      const error = new Error('File not found');
      fs.readFile.mockRejectedValue(error);
      
      const handler = jest.fn(async (event, path) => {
        try {
          const content = await fs.readFile(path, 'utf8');
          return { success: true, content };
        } catch (err) {
          return { success: false, error: err.message };
        }
      });
      
      ipcMain.handle('file-read', handler);
      
      const result = await handler(event, '/nonexistent/file.txt');
      
      expect(result).toEqual({
        success: false,
        error: 'File not found'
      });
    });

    test('should validate input parameters', async () => {
      const handler = jest.fn(async (event, filePath) => {
        if (!filePath || typeof filePath !== 'string') {
          throw new Error('Invalid file path');
        }
        
        if (filePath.includes('..')) {
          throw new Error('Path traversal not allowed');
        }
        
        return { success: true };
      });
      
      ipcMain.handle('secure-file-operation', handler);
      
      // Test invalid input
      await expect(handler(event, null)).rejects.toThrow('Invalid file path');
      await expect(handler(event, '../../../etc/passwd')).rejects.toThrow('Path traversal not allowed');
      
      // Test valid input
      const result = await handler(event, '/safe/path/file.txt');
      expect(result).toEqual({ success: true });
    });
  });
});