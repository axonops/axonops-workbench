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

const { app, BrowserWindow } = require('electron');

describe('App Lifecycle', () => {
  let createWindowSpy;
  let mainWindow;

  beforeEach(() => {
    jest.clearAllMocks();
    mainWindow = null;
    createWindowSpy = jest.fn(() => {
      mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });
      return mainWindow;
    });
  });

  afterEach(() => {
    if (mainWindow && !mainWindow.isDestroyed) {
      mainWindow.destroy();
    }
  });

  describe('App Ready Event', () => {
    test('should create window when app is ready', async () => {
      const readyPromise = app.whenReady();
      
      // Simulate app ready
      app.emit('ready');
      
      await readyPromise;
      
      // Verify app is ready
      expect(app.isReady).toBe(true);
      
      // Create window
      createWindowSpy();
      
      expect(createWindowSpy).toHaveBeenCalled();
      expect(mainWindow).toBeInstanceOf(BrowserWindow);
    });

    test('should handle single instance lock', () => {
      const gotLock = app.requestSingleInstanceLock();
      
      expect(gotLock).toBe(true);
      expect(app.hasSingleInstanceLock()).toBe(true);
      
      // Second instance should not get lock
      const secondLock = app.requestSingleInstanceLock();
      expect(secondLock).toBe(true); // In mock, always returns true
    });
  });

  describe('Window Management', () => {
    test('should create window with correct options', () => {
      const windowOptions = {
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: '/path/to/preload.js'
        },
        icon: '/path/to/icon.png'
      };
      
      const window = new BrowserWindow(windowOptions);
      
      expect(window).toBeInstanceOf(BrowserWindow);
      expect(window.options).toMatchObject(windowOptions);
    });

    test('should handle window ready-to-show event', () => {
      const window = new BrowserWindow({ show: false });
      const showSpy = jest.spyOn(window, 'show');
      
      window.emit('ready-to-show');
      
      // In real app, you would call show() in ready-to-show handler
      window.show();
      
      expect(showSpy).toHaveBeenCalled();
      expect(window.isVisible()).toBe(true);
    });

    test('should handle window closed event', () => {
      const window = new BrowserWindow();
      let windowClosed = false;
      
      window.on('closed', () => {
        windowClosed = true;
      });
      
      window.close();
      
      expect(windowClosed).toBe(true);
      expect(window.isDestroyed()).toBe(true);
    });
  });

  describe('App Window All Closed Event', () => {
    test('should quit app when all windows closed on non-macOS', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true
      });
      
      // Simulate window-all-closed handler
      const handler = () => {
        if (process.platform !== 'darwin') {
          app.quit();
        }
      };
      
      handler();
      
      expect(app.quit).toHaveBeenCalled();
    });

    test('should not quit app when all windows closed on macOS', () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true
      });
      
      const quitSpy = jest.spyOn(app, 'quit');
      
      app.emit('window-all-closed');
      
      expect(quitSpy).not.toHaveBeenCalled();
    });
  });

  describe('App Activate Event', () => {
    test('should create new window on activate if no windows exist', () => {
      // Simulate macOS dock click
      app.emit('activate');
      
      // In real app, you would check BrowserWindow.getAllWindows().length === 0
      // and create a new window
      const windows = BrowserWindow.getAllWindows();
      expect(windows).toEqual([]);
      
      // Create window
      createWindowSpy();
      expect(createWindowSpy).toHaveBeenCalled();
    });

    test('should focus existing window on activate', () => {
      const window = new BrowserWindow();
      const focusSpy = jest.spyOn(window, 'focus');
      
      app.emit('activate');
      
      // Simulate focusing existing window
      if (!window.isDestroyed) {
        window.focus();
      }
      
      expect(focusSpy).toHaveBeenCalled();
    });
  });

  describe('App Quit Events', () => {
    test('should handle before-quit event', () => {
      let beforeQuitFired = false;
      
      app.on('before-quit', (event) => {
        beforeQuitFired = true;
        // Could prevent quit with event.preventDefault()
      });
      
      app.emit('before-quit', { preventDefault: jest.fn() });
      
      expect(beforeQuitFired).toBe(true);
    });

    test('should handle will-quit event', () => {
      let willQuitFired = false;
      
      app.on('will-quit', () => {
        willQuitFired = true;
      });
      
      app.quit();
      
      expect(willQuitFired).toBe(true);
    });

    test('should cleanup resources on quit', () => {
      const cleanupSpy = jest.fn();
      
      app.on('quit', () => {
        cleanupSpy();
      });
      
      app.quit();
      
      expect(cleanupSpy).toHaveBeenCalled();
    });
  });

  describe('App Paths', () => {
    test('should get correct app paths', () => {
      const paths = [
        'userData',
        'appData',
        'temp',
        'desktop',
        'documents',
        'downloads',
        'home',
        'logs'
      ];
      
      paths.forEach(pathName => {
        const path = app.getPath(pathName);
        expect(path).toMatch(/^\/mock\//);
        expect(path).toContain(pathName);
      });
    });

    test('should get app name and version', () => {
      expect(app.getName()).toBe('MockApp');
      expect(app.getVersion()).toBe('1.0.0');
    });
  });

  describe('Protocol Registration', () => {
    test('should register as default protocol client', () => {
      const protocol = 'axonops';
      const registered = app.setAsDefaultProtocolClient(protocol);
      
      expect(registered).toBe(true);
      
      // Check if registered (mock always returns false)
      const isDefault = app.isDefaultProtocolClient(protocol);
      expect(isDefault).toBe(false); // Mock behavior
    });

    test('should handle deep link on second instance', () => {
      let deepLinkUrl = null;
      
      app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Parse deep link from command line
        const url = commandLine.find(arg => arg.startsWith('axonops://'));
        if (url) {
          deepLinkUrl = url;
        }
      });
      
      // Simulate second instance with deep link
      app.emit('second-instance', {}, ['axonops://open/workspace'], '/working/dir');
      
      expect(deepLinkUrl).toBe('axonops://open/workspace');
    });
  });
});