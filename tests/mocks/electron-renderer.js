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

// Mock Electron for renderer process tests
const EventEmitter = require('events');

class MockIpcRenderer extends EventEmitter {
  constructor() {
    super();
    this.handlers = new Map();
  }

  send = jest.fn((channel, ...args) => {
    this.emit('send', channel, ...args);
  });

  sendSync = jest.fn((channel, ...args) => {
    this.emit('sendSync', channel, ...args);
    return null;
  });

  sendToHost = jest.fn((channel, ...args) => {
    this.emit('sendToHost', channel, ...args);
  });

  invoke = jest.fn((channel, ...args) => {
    this.emit('invoke', channel, ...args);
    
    // Simulate async response
    const handler = this.handlers.get(channel);
    if (handler) {
      return Promise.resolve(handler(...args));
    }
    
    // Default responses for common channels
    const defaultResponses = {
      'get-app-path': '/mock/app',
      'get-user-data-path': '/mock/userData',
      'get-version': '1.0.0',
      'get-platform': 'darwin',
      'get-arch': 'x64',
      'get-system-info': {
        platform: 'darwin',
        arch: 'x64',
        version: '1.0.0',
        electron: '31.6.0',
        node: '20.17.0'
      }
    };
    
    if (defaultResponses[channel] !== undefined) {
      return Promise.resolve(defaultResponses[channel]);
    }
    
    return Promise.resolve(null);
  });

  on = jest.fn((channel, listener) => {
    super.on(channel, listener);
    return this;
  });

  once = jest.fn((channel, listener) => {
    super.once(channel, listener);
    return this;
  });

  removeListener = jest.fn((channel, listener) => {
    super.removeListener(channel, listener);
    return this;
  });

  removeAllListeners = jest.fn((channel) => {
    if (channel) {
      super.removeAllListeners(channel);
    } else {
      super.removeAllListeners();
    }
    return this;
  });

  // Helper method for tests to register mock handlers
  mockHandler(channel, handler) {
    this.handlers.set(channel, handler);
  }

  // Helper method to clear all mock handlers
  clearMockHandlers() {
    this.handlers.clear();
  }

  // Helper method to simulate incoming IPC messages
  simulateMessage(channel, ...args) {
    this.emit(channel, { sender: { id: 1 } }, ...args);
  }
}

const mockIpcRenderer = new MockIpcRenderer();

module.exports = {
  ipcRenderer: mockIpcRenderer,

  contextBridge: {
    exposeInMainWorld: jest.fn((apiName, api) => {
      // In tests, we can access the exposed API directly
      global[apiName] = api;
    })
  },

  remote: {
    app: {
      getPath: jest.fn((name) => {
        const paths = {
          userData: '/mock/userData',
          appData: '/mock/appData',
          temp: '/mock/temp',
          desktop: '/mock/desktop',
          documents: '/mock/documents',
          downloads: '/mock/downloads',
          home: '/mock/home'
        };
        return paths[name] || `/mock/${name}`;
      }),
      getVersion: jest.fn(() => '1.0.0'),
      getName: jest.fn(() => 'MockApp'),
      getLocale: jest.fn(() => 'en-US'),
      quit: jest.fn(),
      exit: jest.fn(),
      relaunch: jest.fn()
    },

    dialog: {
      showOpenDialog: jest.fn().mockResolvedValue({ canceled: true, filePaths: [] }),
      showSaveDialog: jest.fn().mockResolvedValue({ canceled: true, filePath: undefined }),
      showMessageBox: jest.fn().mockResolvedValue({ response: 0 }),
      showErrorBox: jest.fn()
    },

    getCurrentWindow: jest.fn(() => ({
      id: 1,
      close: jest.fn(),
      minimize: jest.fn(),
      maximize: jest.fn(),
      unmaximize: jest.fn(),
      isMaximized: jest.fn(() => false),
      isMinimized: jest.fn(() => false),
      isFullScreen: jest.fn(() => false),
      setFullScreen: jest.fn(),
      focus: jest.fn(),
      blur: jest.fn(),
      isFocused: jest.fn(() => true),
      show: jest.fn(),
      hide: jest.fn(),
      isVisible: jest.fn(() => true),
      setTitle: jest.fn(),
      getTitle: jest.fn(() => 'Test Window'),
      flashFrame: jest.fn(),
      setSkipTaskbar: jest.fn(),
      setProgressBar: jest.fn(),
      setOverlayIcon: jest.fn(),
      setBounds: jest.fn(),
      getBounds: jest.fn(() => ({ x: 0, y: 0, width: 800, height: 600 })),
      setSize: jest.fn(),
      getSize: jest.fn(() => [800, 600]),
      setMinimumSize: jest.fn(),
      getMinimumSize: jest.fn(() => [400, 300]),
      setMaximumSize: jest.fn(),
      getMaximumSize: jest.fn(() => [9999, 9999]),
      setResizable: jest.fn(),
      isResizable: jest.fn(() => true),
      setMovable: jest.fn(),
      isMovable: jest.fn(() => true),
      setMinimizable: jest.fn(),
      isMinimizable: jest.fn(() => true),
      setMaximizable: jest.fn(),
      isMaximizable: jest.fn(() => true),
      setFullScreenable: jest.fn(),
      isFullScreenable: jest.fn(() => true),
      setClosable: jest.fn(),
      isClosable: jest.fn(() => true),
      setAlwaysOnTop: jest.fn(),
      isAlwaysOnTop: jest.fn(() => false),
      center: jest.fn(),
      setPosition: jest.fn(),
      getPosition: jest.fn(() => [0, 0]),
      loadURL: jest.fn().mockResolvedValue(true),
      loadFile: jest.fn().mockResolvedValue(true),
      reload: jest.fn(),
      setMenu: jest.fn(),
      webContents: {
        send: jest.fn(),
        executeJavaScript: jest.fn().mockResolvedValue(null),
        insertCSS: jest.fn(),
        openDevTools: jest.fn(),
        closeDevTools: jest.fn(),
        isDevToolsOpened: jest.fn(() => false),
        toggleDevTools: jest.fn(),
        inspectElement: jest.fn(),
        print: jest.fn(),
        printToPDF: jest.fn().mockResolvedValue(Buffer.from('mock-pdf')),
        getURL: jest.fn(() => 'http://localhost'),
        getTitle: jest.fn(() => 'Test Page'),
        reload: jest.fn(),
        reloadIgnoringCache: jest.fn(),
        stop: jest.fn(),
        canGoBack: jest.fn(() => false),
        canGoForward: jest.fn(() => false),
        goBack: jest.fn(),
        goForward: jest.fn(),
        setZoomFactor: jest.fn(),
        getZoomFactor: jest.fn(() => 1),
        setZoomLevel: jest.fn(),
        getZoomLevel: jest.fn(() => 0),
        findInPage: jest.fn(),
        stopFindInPage: jest.fn()
      }
    })),

    getGlobal: jest.fn((name) => {
      const globals = {
        sharedData: {},
        appConfig: {
          version: '1.0.0',
          platform: 'darwin'
        }
      };
      return globals[name];
    }),

    require: jest.fn((module) => {
      if (module === 'electron') {
        return module.exports;
      }
      return jest.requireActual(module);
    }),

    process: {
      platform: 'darwin',
      arch: 'x64',
      version: 'v20.17.0',
      versions: {
        node: '20.17.0',
        electron: '31.6.0',
        chrome: '130.0.0',
        v8: '11.8.0'
      }
    },

    screen: {
      getPrimaryDisplay: jest.fn(() => ({
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        workArea: { x: 0, y: 0, width: 1920, height: 1080 },
        size: { width: 1920, height: 1080 },
        workAreaSize: { width: 1920, height: 1080 }
      })),
      getAllDisplays: jest.fn(() => [{
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        workArea: { x: 0, y: 0, width: 1920, height: 1080 },
        size: { width: 1920, height: 1080 },
        workAreaSize: { width: 1920, height: 1080 }
      }]),
      getCursorScreenPoint: jest.fn(() => ({ x: 0, y: 0 }))
    },

    Menu: {
      buildFromTemplate: jest.fn((template) => ({
        popup: jest.fn(),
        items: template
      })),
      setApplicationMenu: jest.fn()
    },

    MenuItem: jest.fn((options) => options)
  },

  shell: {
    openExternal: jest.fn().mockResolvedValue(undefined),
    openPath: jest.fn().mockResolvedValue(''),
    showItemInFolder: jest.fn(),
    moveItemToTrash: jest.fn().mockResolvedValue(true),
    beep: jest.fn()
  },

  clipboard: {
    readText: jest.fn(() => ''),
    writeText: jest.fn(),
    readHTML: jest.fn(() => ''),
    writeHTML: jest.fn(),
    clear: jest.fn(),
    availableFormats: jest.fn(() => []),
    has: jest.fn(() => false),
    read: jest.fn(() => ''),
    write: jest.fn()
  },

  nativeImage: {
    createEmpty: jest.fn(() => ({
      isEmpty: jest.fn(() => true),
      getSize: jest.fn(() => ({ width: 0, height: 0 }))
    })),
    createFromPath: jest.fn(() => ({
      isEmpty: jest.fn(() => false),
      getSize: jest.fn(() => ({ width: 100, height: 100 }))
    })),
    createFromBuffer: jest.fn(() => ({
      isEmpty: jest.fn(() => false),
      getSize: jest.fn(() => ({ width: 100, height: 100 }))
    }))
  },

  webFrame: {
    setZoomFactor: jest.fn(),
    getZoomFactor: jest.fn(() => 1),
    setZoomLevel: jest.fn(),
    getZoomLevel: jest.fn(() => 0),
    setVisualZoomLevelLimits: jest.fn(),
    setSpellCheckProvider: jest.fn(),
    insertCSS: jest.fn(),
    insertText: jest.fn(),
    executeJavaScript: jest.fn().mockResolvedValue(null),
    getResourceUsage: jest.fn(() => ({
      images: { size: 0, liveSize: 0, count: 0 },
      scripts: { size: 0, liveSize: 0, count: 0 },
      cssStyleSheets: { size: 0, liveSize: 0, count: 0 },
      fonts: { size: 0, liveSize: 0, count: 0 },
      other: { size: 0, liveSize: 0, count: 0 },
      total: { size: 0, liveSize: 0, count: 0 }
    })),
    clearCache: jest.fn()
  },

  desktopCapturer: {
    getSources: jest.fn().mockResolvedValue([])
  },

  // Constants
  isMainFrame: false,
  isRenderer: true
};