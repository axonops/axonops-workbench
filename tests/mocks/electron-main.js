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

// Mock Electron for main process tests
const EventEmitter = require('events');

class MockBrowserWindow extends EventEmitter {
  constructor(options = {}) {
    super();
    this.id = Math.random();
    this.webContents = new MockWebContents();
    this.options = options;
    this._isDestroyed = false;
    this._isVisible = false;
    this._isFocused = false;
    this._isMinimized = false;
    this._isMaximized = false;
    this._isFullScreen = false;
  }

  loadURL = jest.fn().mockResolvedValue(true);
  loadFile = jest.fn().mockResolvedValue(true);
  show = jest.fn(() => { this._isVisible = true; });
  hide = jest.fn(() => { this._isVisible = false; });
  focus = jest.fn(() => { this._isFocused = true; });
  blur = jest.fn(() => { this._isFocused = false; });
  minimize = jest.fn(() => { this._isMinimized = true; });
  maximize = jest.fn(() => { this._isMaximized = true; });
  unmaximize = jest.fn(() => { this._isMaximized = false; });
  restore = jest.fn(() => { 
    this._isMinimized = false;
    this._isMaximized = false;
  });
  setFullScreen = jest.fn((flag) => { this._isFullScreen = flag; });
  close = jest.fn(() => { 
    this._isDestroyed = true;
    // Emit closed event synchronously as Electron does
    this.emit('closed');
  });
  destroy = jest.fn(() => { this._isDestroyed = true; });
  isDestroyed = jest.fn(() => this._isDestroyed);
  isVisible = jest.fn(() => this._isVisible);
  isFocused = jest.fn(() => this._isFocused);
  isMinimized = jest.fn(() => this._isMinimized);
  isMaximized = jest.fn(() => this._isMaximized);
  isFullScreen = jest.fn(() => this._isFullScreen);
  getBounds = jest.fn(() => ({ x: 0, y: 0, width: 800, height: 600 }));
  setBounds = jest.fn();
  getSize = jest.fn(() => [800, 600]);
  setSize = jest.fn();
  getPosition = jest.fn(() => [0, 0]);
  setPosition = jest.fn();
  setMenu = jest.fn();
  setMenuBarVisibility = jest.fn();
  setAlwaysOnTop = jest.fn();
  setSkipTaskbar = jest.fn();
  setIcon = jest.fn();
  setTitle = jest.fn();
  getTitle = jest.fn(() => 'Test Window');
  setProgressBar = jest.fn();
  flashFrame = jest.fn();
}

class MockWebContents extends EventEmitter {
  constructor() {
    super();
    this.id = Math.random();
    this.session = new MockSession();
  }

  send = jest.fn();
  insertCSS = jest.fn();
  executeJavaScript = jest.fn().mockResolvedValue(null);
  openDevTools = jest.fn();
  closeDevTools = jest.fn();
  isDevToolsOpened = jest.fn(() => false);
  reload = jest.fn();
  reloadIgnoringCache = jest.fn();
  getURL = jest.fn(() => 'http://localhost');
  getTitle = jest.fn(() => 'Test Page');
  isLoading = jest.fn(() => false);
  isLoadingMainFrame = jest.fn(() => false);
  stop = jest.fn();
  canGoBack = jest.fn(() => false);
  canGoForward = jest.fn(() => false);
  goBack = jest.fn();
  goForward = jest.fn();
  setUserAgent = jest.fn();
  getUserAgent = jest.fn(() => 'MockUserAgent');
  insertText = jest.fn();
  findInPage = jest.fn();
  stopFindInPage = jest.fn();
  print = jest.fn();
  printToPDF = jest.fn().mockResolvedValue(Buffer.from('mock-pdf'));
}

class MockSession extends EventEmitter {
  constructor() {
    super();
    this.protocol = {
      registerFileProtocol: jest.fn((scheme, handler, callback) => callback()),
      unregisterProtocol: jest.fn((scheme, callback) => callback()),
      isProtocolRegistered: jest.fn(() => false)
    };
  }

  clearStorageData = jest.fn().mockResolvedValue(undefined);
  clearCache = jest.fn().mockResolvedValue(undefined);
  setUserAgent = jest.fn();
  getUserAgent = jest.fn(() => 'MockUserAgent');
  setPermissionRequestHandler = jest.fn();
  setPermissionCheckHandler = jest.fn();
  getCacheSize = jest.fn().mockResolvedValue(0);
}

class MockMenu {
  constructor() {
    this.items = [];
  }

  static buildFromTemplate = jest.fn((template) => {
    const menu = new MockMenu();
    menu.items = template;
    return menu;
  });

  static setApplicationMenu = jest.fn();
  static getApplicationMenu = jest.fn(() => null);

  append = jest.fn((item) => this.items.push(item));
  popup = jest.fn();
}

class MockMenuItem {
  constructor(options = {}) {
    Object.assign(this, options);
  }
}

class MockApp extends EventEmitter {
  constructor() {
    super();
    this.isReady = false;
    this.isQuitting = false;
  }

  getPath = jest.fn((name) => {
    const paths = {
      userData: '/mock/userData',
      appData: '/mock/appData',
      temp: '/mock/temp',
      desktop: '/mock/desktop',
      documents: '/mock/documents',
      downloads: '/mock/downloads',
      home: '/mock/home',
      exe: '/mock/app.exe',
      module: '/mock/module',
      logs: '/mock/logs'
    };
    return paths[name] || `/mock/${name}`;
  });

  getAppPath = jest.fn(() => '/mock/app');
  getName = jest.fn(() => 'MockApp');
  setName = jest.fn();
  getVersion = jest.fn(() => '1.0.0');
  getLocale = jest.fn(() => 'en-US');
  getLocaleCountryCode = jest.fn(() => 'US');
  isPackaged = false;
  
  quit = jest.fn(() => {
    this.isQuitting = true;
    this.emit('will-quit');
    this.emit('quit');
  });
  
  exit = jest.fn();
  relaunch = jest.fn();
  focus = jest.fn();
  hide = jest.fn();
  show = jest.fn();
  
  isReady = jest.fn(() => this.isReady);
  whenReady = jest.fn(() => {
    this.isReady = true;
    return Promise.resolve();
  });
  
  requestSingleInstanceLock = jest.fn(() => true);
  releaseSingleInstanceLock = jest.fn();
  hasSingleInstanceLock = jest.fn(() => true);
  
  setUserTasks = jest.fn();
  setAsDefaultProtocolClient = jest.fn(() => true);
  removeAsDefaultProtocolClient = jest.fn(() => true);
  isDefaultProtocolClient = jest.fn(() => false);
  
  setAboutPanelOptions = jest.fn();
  showAboutPanel = jest.fn();
  
  setLoginItemSettings = jest.fn();
  getLoginItemSettings = jest.fn(() => ({
    openAtLogin: false,
    openAsHidden: false,
    wasOpenedAtLogin: false,
    wasOpenedAsHidden: false,
    restoreState: false
  }));
  
  setBadgeCount = jest.fn();
  getBadgeCount = jest.fn(() => 0);
  
  getGPUInfo = jest.fn().mockResolvedValue({});
  getGPUFeatureStatus = jest.fn(() => ({}));
  
  on = jest.fn((event, callback) => {
    if (event === 'ready' && !this.isReady) {
      this.isReady = true;
      setImmediate(callback);
    }
    return super.on(event, callback);
  });
}

const mockApp = new MockApp();

// Add static methods to BrowserWindow
MockBrowserWindow.getAllWindows = jest.fn(() => []);
MockBrowserWindow.getFocusedWindow = jest.fn(() => null);
MockBrowserWindow.fromWebContents = jest.fn((webContents) => {
  // Return the window that owns this webContents
  // In our mock, we'll create a new window for simplicity
  return new MockBrowserWindow();
});
MockBrowserWindow.fromId = jest.fn((id) => null);

module.exports = {
  app: mockApp,
  BrowserWindow: MockBrowserWindow,
  Menu: MockMenu,
  MenuItem: MockMenuItem,
  
  ipcMain: {
    handle: jest.fn(),
    handleOnce: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    removeHandler: jest.fn(),
    removeAllListeners: jest.fn()
  },
  
  dialog: {
    showOpenDialog: jest.fn().mockResolvedValue({ canceled: true, filePaths: [] }),
    showSaveDialog: jest.fn().mockResolvedValue({ canceled: true, filePath: undefined }),
    showMessageBox: jest.fn().mockResolvedValue({ response: 0 }),
    showErrorBox: jest.fn(),
    showCertificateTrustDialog: jest.fn()
  },
  
  shell: {
    openExternal: jest.fn().mockResolvedValue(undefined),
    openPath: jest.fn().mockResolvedValue(''),
    showItemInFolder: jest.fn(),
    moveItemToTrash: jest.fn().mockResolvedValue(true),
    beep: jest.fn(),
    writeShortcutLink: jest.fn(() => true),
    readShortcutLink: jest.fn(() => ({}))
  },
  
  nativeImage: {
    createEmpty: jest.fn(() => ({
      isEmpty: jest.fn(() => true),
      getSize: jest.fn(() => ({ width: 0, height: 0 })),
      resize: jest.fn(),
      crop: jest.fn(),
      toPNG: jest.fn(() => Buffer.from('')),
      toJPEG: jest.fn(() => Buffer.from(''))
    })),
    createFromPath: jest.fn((path) => ({
      isEmpty: jest.fn(() => false),
      getSize: jest.fn(() => ({ width: 100, height: 100 })),
      resize: jest.fn(),
      crop: jest.fn(),
      toPNG: jest.fn(() => Buffer.from('mock-png')),
      toJPEG: jest.fn(() => Buffer.from('mock-jpeg'))
    })),
    createFromBuffer: jest.fn((buffer) => ({
      isEmpty: jest.fn(() => false),
      getSize: jest.fn(() => ({ width: 100, height: 100 })),
      resize: jest.fn(),
      crop: jest.fn(),
      toPNG: jest.fn(() => buffer),
      toJPEG: jest.fn(() => buffer)
    }))
  },
  
  clipboard: {
    readText: jest.fn(() => ''),
    writeText: jest.fn(),
    readHTML: jest.fn(() => ''),
    writeHTML: jest.fn(),
    readImage: jest.fn(),
    writeImage: jest.fn(),
    clear: jest.fn()
  },
  
  globalShortcut: {
    register: jest.fn(() => true),
    registerAll: jest.fn(),
    isRegistered: jest.fn(() => false),
    unregister: jest.fn(),
    unregisterAll: jest.fn()
  },
  
  screen: {
    getPrimaryDisplay: jest.fn(() => ({
      id: 0,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1080 },
      size: { width: 1920, height: 1080 },
      workAreaSize: { width: 1920, height: 1080 },
      scaleFactor: 1,
      rotation: 0,
      internal: false,
      touchSupport: 'unknown'
    })),
    getAllDisplays: jest.fn(() => [{
      id: 0,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1080 },
      size: { width: 1920, height: 1080 },
      workAreaSize: { width: 1920, height: 1080 },
      scaleFactor: 1,
      rotation: 0,
      internal: false,
      touchSupport: 'unknown'
    }]),
    getDisplayMatching: jest.fn(),
    getDisplayNearestPoint: jest.fn(),
    getCursorScreenPoint: jest.fn(() => ({ x: 0, y: 0 })),
    on: jest.fn(),
    removeAllListeners: jest.fn()
  },
  
  Tray: jest.fn().mockImplementation(() => ({
    setImage: jest.fn(),
    setPressedImage: jest.fn(),
    setToolTip: jest.fn(),
    setTitle: jest.fn(),
    getTitle: jest.fn(() => ''),
    setIgnoreDoubleClickEvents: jest.fn(),
    displayBalloon: jest.fn(),
    popUpContextMenu: jest.fn(),
    setContextMenu: jest.fn(),
    getBounds: jest.fn(() => ({ x: 0, y: 0, width: 0, height: 0 })),
    isDestroyed: jest.fn(() => false),
    destroy: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn()
  })),
  
  Notification: jest.fn().mockImplementation(() => ({
    show: jest.fn(),
    close: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn()
  })),
  
  powerMonitor: {
    getSystemIdleState: jest.fn(() => 'active'),
    getSystemIdleTime: jest.fn(() => 0),
    on: jest.fn(),
    removeListener: jest.fn()
  },
  
  powerSaveBlocker: {
    start: jest.fn(() => 1),
    stop: jest.fn(),
    isStarted: jest.fn(() => false)
  },
  
  protocol: {
    registerFileProtocol: jest.fn((scheme, handler, callback) => callback()),
    unregisterProtocol: jest.fn((scheme, callback) => callback()),
    isProtocolRegistered: jest.fn(() => false),
    registerSchemesAsPrivileged: jest.fn()
  },
  
  session: {
    defaultSession: new MockSession(),
    fromPartition: jest.fn(() => new MockSession())
  },
  
  systemPreferences: {
    isDarkMode: jest.fn(() => false),
    isSwipeTrackingFromScrollEventsEnabled: jest.fn(() => false),
    getColor: jest.fn(() => '#ffffff'),
    getAccentColor: jest.fn(() => '#0000ff'),
    getSystemColor: jest.fn(() => '#000000'),
    getUserDefault: jest.fn(),
    setUserDefault: jest.fn(),
    removeUserDefault: jest.fn(),
    isAeroGlassEnabled: jest.fn(() => false),
    on: jest.fn(),
    removeListener: jest.fn()
  },
  
  webContents: {
    getAllWebContents: jest.fn(() => []),
    getFocusedWebContents: jest.fn(() => null),
    fromId: jest.fn(() => null)
  },
  
  // Constants
  isMainFrame: true,
  isRenderer: false
};