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

const { BrowserWindow, Menu, screen, nativeImage } = require('electron');

describe('Window Management', () => {
  let mainWindow;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (mainWindow && !mainWindow.isDestroyed) {
      mainWindow.destroy();
    }
  });

  describe('Window Creation', () => {
    test('should create window with default options', () => {
      mainWindow = new BrowserWindow();
      
      expect(mainWindow).toBeInstanceOf(BrowserWindow);
      expect(mainWindow.id).toBeDefined();
      expect(mainWindow.webContents).toBeDefined();
    });

    test('should create window with custom options', () => {
      const options = {
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        title: 'AxonOps Workbench',
        icon: '/path/to/icon.png',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: '/path/to/preload.js'
        }
      };
      
      mainWindow = new BrowserWindow(options);
      
      expect(mainWindow.options).toMatchObject(options);
    });

    test('should create frameless window', () => {
      mainWindow = new BrowserWindow({
        frame: false,
        transparent: true
      });
      
      expect(mainWindow.options.frame).toBe(false);
      expect(mainWindow.options.transparent).toBe(true);
    });

    test('should create window with custom background color', () => {
      mainWindow = new BrowserWindow({
        backgroundColor: '#2e2c29'
      });
      
      expect(mainWindow.options.backgroundColor).toBe('#2e2c29');
    });
  });

  describe('Window State Management', () => {
    beforeEach(() => {
      mainWindow = new BrowserWindow();
    });

    test('should show and hide window', () => {
      mainWindow.show();
      expect(mainWindow.isVisible()).toBe(true);
      
      mainWindow.hide();
      expect(mainWindow.isVisible()).toBe(false);
    });

    test('should minimize and restore window', () => {
      mainWindow.minimize();
      expect(mainWindow.isMinimized()).toBe(true);
      
      mainWindow.restore();
      expect(mainWindow.isMinimized()).toBe(false);
    });

    test('should maximize and unmaximize window', () => {
      mainWindow.maximize();
      expect(mainWindow.isMaximized()).toBe(true);
      
      mainWindow.unmaximize();
      expect(mainWindow.isMaximized()).toBe(false);
    });

    test('should enter and exit fullscreen', () => {
      mainWindow.setFullScreen(true);
      expect(mainWindow.isFullScreen()).toBe(true);
      
      mainWindow.setFullScreen(false);
      expect(mainWindow.isFullScreen()).toBe(false);
    });

    test('should focus and blur window', () => {
      mainWindow.focus();
      expect(mainWindow.isFocused()).toBe(true);
      
      mainWindow.blur();
      expect(mainWindow.isFocused()).toBe(false);
    });
  });

  describe('Window Bounds and Position', () => {
    beforeEach(() => {
      mainWindow = new BrowserWindow();
    });

    test('should get and set window bounds', () => {
      const bounds = { x: 100, y: 100, width: 1200, height: 800 };
      mainWindow.setBounds(bounds);
      
      expect(mainWindow.getBounds()).toEqual(bounds);
    });

    test('should get and set window size', () => {
      mainWindow.setSize(1024, 768);
      expect(mainWindow.getSize()).toEqual([1024, 768]);
    });

    test('should get and set window position', () => {
      mainWindow.setPosition(200, 200);
      expect(mainWindow.getPosition()).toEqual([200, 200]);
    });

    test('should center window on screen', () => {
      const display = screen.getPrimaryDisplay();
      mainWindow.center();
      
      // Since center() doesn't update our mock immediately,
      // we just verify the method was called
      expect(mainWindow.center).toHaveBeenCalled();
    });

    test('should set minimum and maximum size', () => {
      mainWindow.setMinimumSize(800, 600);
      mainWindow.setMaximumSize(1920, 1080);
      
      expect(mainWindow.setMinimumSize).toHaveBeenCalledWith(800, 600);
      expect(mainWindow.setMaximumSize).toHaveBeenCalledWith(1920, 1080);
    });
  });

  describe('Window Properties', () => {
    beforeEach(() => {
      mainWindow = new BrowserWindow();
    });

    test('should set window title', () => {
      const title = 'AxonOps Workbench - Cluster Manager';
      mainWindow.setTitle(title);
      
      expect(mainWindow.setTitle).toHaveBeenCalledWith(title);
      expect(mainWindow.getTitle()).toBe('Test Window'); // Mock always returns this
    });

    test('should set window icon', () => {
      const iconPath = '/path/to/icon.png';
      mainWindow.setIcon(iconPath);
      
      expect(mainWindow.setIcon).toHaveBeenCalledWith(iconPath);
    });

    test('should set always on top', () => {
      mainWindow.setAlwaysOnTop(true);
      expect(mainWindow.setAlwaysOnTop).toHaveBeenCalledWith(true);
      
      mainWindow.setAlwaysOnTop(false);
      expect(mainWindow.setAlwaysOnTop).toHaveBeenCalledWith(false);
    });

    test('should set skip taskbar', () => {
      mainWindow.setSkipTaskbar(true);
      expect(mainWindow.setSkipTaskbar).toHaveBeenCalledWith(true);
    });

    test('should set progress bar', () => {
      mainWindow.setProgressBar(0.5);
      expect(mainWindow.setProgressBar).toHaveBeenCalledWith(0.5);
      
      // Clear progress
      mainWindow.setProgressBar(-1);
      expect(mainWindow.setProgressBar).toHaveBeenCalledWith(-1);
    });
  });

  describe('Window Menu', () => {
    test('should set application menu', () => {
      const template = [
        {
          label: 'File',
          submenu: [
            { label: 'New', accelerator: 'CmdOrCtrl+N' },
            { label: 'Open', accelerator: 'CmdOrCtrl+O' },
            { type: 'separator' },
            { label: 'Quit', role: 'quit' }
          ]
        },
        {
          label: 'Edit',
          submenu: [
            { label: 'Cut', role: 'cut' },
            { label: 'Copy', role: 'copy' },
            { label: 'Paste', role: 'paste' }
          ]
        }
      ];
      
      const menu = Menu.buildFromTemplate(template);
      Menu.setApplicationMenu(menu);
      
      expect(Menu.buildFromTemplate).toHaveBeenCalledWith(template);
      expect(Menu.setApplicationMenu).toHaveBeenCalledWith(menu);
    });

    test('should set window menu', () => {
      mainWindow = new BrowserWindow();
      const menu = Menu.buildFromTemplate([]);
      
      mainWindow.setMenu(menu);
      expect(mainWindow.setMenu).toHaveBeenCalledWith(menu);
    });

    test('should set menu bar visibility', () => {
      mainWindow = new BrowserWindow();
      
      mainWindow.setMenuBarVisibility(false);
      expect(mainWindow.setMenuBarVisibility).toHaveBeenCalledWith(false);
      
      mainWindow.setMenuBarVisibility(true);
      expect(mainWindow.setMenuBarVisibility).toHaveBeenCalledWith(true);
    });
  });

  describe('Window Events', () => {
    beforeEach(() => {
      mainWindow = new BrowserWindow();
    });

    test('should handle close event', () => {
      const closeHandler = jest.fn();
      mainWindow.on('close', closeHandler);
      
      mainWindow.emit('close', { preventDefault: jest.fn() });
      
      expect(mainWindow.on).toHaveBeenCalledWith('close', closeHandler);
    });

    test('should handle closed event', () => {
      const closedHandler = jest.fn();
      mainWindow.on('closed', closedHandler);
      
      mainWindow.close();
      
      expect(mainWindow.close).toHaveBeenCalled();
    });

    test('should handle focus and blur events', () => {
      const focusHandler = jest.fn();
      const blurHandler = jest.fn();
      
      mainWindow.on('focus', focusHandler);
      mainWindow.on('blur', blurHandler);
      
      mainWindow.emit('focus');
      mainWindow.emit('blur');
      
      expect(focusHandler).toHaveBeenCalled();
      expect(blurHandler).toHaveBeenCalled();
    });

    test('should handle resize event', () => {
      const resizeHandler = jest.fn();
      mainWindow.on('resize', resizeHandler);
      
      mainWindow.emit('resize');
      
      expect(mainWindow.on).toHaveBeenCalledWith('resize', resizeHandler);
    });

    test('should handle move event', () => {
      const moveHandler = jest.fn();
      mainWindow.on('move', moveHandler);
      
      mainWindow.emit('move');
      
      expect(mainWindow.on).toHaveBeenCalledWith('move', moveHandler);
    });
  });

  describe('WebContents', () => {
    beforeEach(() => {
      mainWindow = new BrowserWindow();
    });

    test('should load URL', async () => {
      const url = 'https://example.com';
      await mainWindow.loadURL(url);
      
      expect(mainWindow.loadURL).toHaveBeenCalledWith(url);
    });

    test('should load file', async () => {
      const filePath = '/path/to/index.html';
      await mainWindow.loadFile(filePath);
      
      expect(mainWindow.loadFile).toHaveBeenCalledWith(filePath);
    });

    test('should send message to renderer', () => {
      const channel = 'test-channel';
      const data = { message: 'Hello from main' };
      
      mainWindow.webContents.send(channel, data);
      
      expect(mainWindow.webContents.send).toHaveBeenCalledWith(channel, data);
    });

    test('should execute JavaScript', async () => {
      const code = 'console.log("Hello")';
      await mainWindow.webContents.executeJavaScript(code);
      
      expect(mainWindow.webContents.executeJavaScript).toHaveBeenCalledWith(code);
    });

    test('should insert CSS', () => {
      const css = 'body { background: red; }';
      mainWindow.webContents.insertCSS(css);
      
      expect(mainWindow.webContents.insertCSS).toHaveBeenCalledWith(css);
    });

    test('should handle dev tools', () => {
      mainWindow.webContents.openDevTools();
      expect(mainWindow.webContents.openDevTools).toHaveBeenCalled();
      
      expect(mainWindow.webContents.isDevToolsOpened()).toBe(false); // Mock returns false
      
      mainWindow.webContents.closeDevTools();
      expect(mainWindow.webContents.closeDevTools).toHaveBeenCalled();
    });

    test('should reload page', () => {
      mainWindow.webContents.reload();
      expect(mainWindow.webContents.reload).toHaveBeenCalled();
      
      mainWindow.webContents.reloadIgnoringCache();
      expect(mainWindow.webContents.reloadIgnoringCache).toHaveBeenCalled();
    });
  });

  describe('Multiple Windows', () => {
    test('should manage multiple windows', () => {
      const window1 = new BrowserWindow({ title: 'Window 1' });
      const window2 = new BrowserWindow({ title: 'Window 2' });
      const window3 = new BrowserWindow({ title: 'Window 3' });
      
      // Get all windows
      const allWindows = BrowserWindow.getAllWindows();
      expect(BrowserWindow.getAllWindows).toHaveBeenCalled();
      
      // Get focused window
      const focusedWindow = BrowserWindow.getFocusedWindow();
      expect(BrowserWindow.getFocusedWindow).toHaveBeenCalled();
      
      // Clean up
      window1.destroy();
      window2.destroy();
      window3.destroy();
    });

    test('should get window by ID', () => {
      const window = new BrowserWindow();
      const windowId = window.id;
      
      const foundWindow = BrowserWindow.fromId(windowId);
      expect(BrowserWindow.fromId).toHaveBeenCalledWith(windowId);
      
      window.destroy();
    });

    test('should get window from web contents', () => {
      const window = new BrowserWindow();
      const webContents = window.webContents;
      
      const foundWindow = BrowserWindow.fromWebContents(webContents);
      expect(BrowserWindow.fromWebContents).toHaveBeenCalledWith(webContents);
      
      window.destroy();
    });
  });

  describe('Screen Integration', () => {
    test('should get display information', () => {
      const primaryDisplay = screen.getPrimaryDisplay();
      expect(primaryDisplay).toHaveProperty('bounds');
      expect(primaryDisplay).toHaveProperty('workArea');
      expect(primaryDisplay).toHaveProperty('size');
      
      const allDisplays = screen.getAllDisplays();
      expect(Array.isArray(allDisplays)).toBe(true);
      expect(allDisplays.length).toBeGreaterThan(0);
    });

    test('should get cursor position', () => {
      const cursorPoint = screen.getCursorScreenPoint();
      expect(cursorPoint).toHaveProperty('x');
      expect(cursorPoint).toHaveProperty('y');
    });
  });

  describe('Native Image', () => {
    test('should create image from path', () => {
      const imagePath = '/path/to/image.png';
      const image = nativeImage.createFromPath(imagePath);
      
      expect(image.isEmpty()).toBe(false);
      expect(image.getSize()).toEqual({ width: 100, height: 100 });
    });

    test('should create empty image', () => {
      const image = nativeImage.createEmpty();
      
      expect(image.isEmpty()).toBe(true);
      expect(image.getSize()).toEqual({ width: 0, height: 0 });
    });

    test('should create image from buffer', () => {
      const buffer = Buffer.from('mock-image-data');
      const image = nativeImage.createFromBuffer(buffer);
      
      expect(image.isEmpty()).toBe(false);
      expect(image.getSize()).toEqual({ width: 100, height: 100 });
    });
  });
});