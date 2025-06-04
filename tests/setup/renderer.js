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

// Setup for renderer process tests

// Mock jQuery and jQuery UI
global.$ = global.jQuery = jest.fn((selector) => {
  const element = {
    on: jest.fn().mockReturnThis(),
    off: jest.fn().mockReturnThis(),
    trigger: jest.fn().mockReturnThis(),
    click: jest.fn().mockReturnThis(),
    focus: jest.fn().mockReturnThis(),
    blur: jest.fn().mockReturnThis(),
    val: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    html: jest.fn().mockReturnThis(),
    attr: jest.fn().mockReturnThis(),
    prop: jest.fn().mockReturnThis(),
    css: jest.fn().mockReturnThis(),
    addClass: jest.fn().mockReturnThis(),
    removeClass: jest.fn().mockReturnThis(),
    toggleClass: jest.fn().mockReturnThis(),
    hasClass: jest.fn(() => false),
    show: jest.fn().mockReturnThis(),
    hide: jest.fn().mockReturnThis(),
    toggle: jest.fn().mockReturnThis(),
    fadeIn: jest.fn().mockReturnThis(),
    fadeOut: jest.fn().mockReturnThis(),
    slideUp: jest.fn().mockReturnThis(),
    slideDown: jest.fn().mockReturnThis(),
    animate: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    parent: jest.fn().mockReturnThis(),
    parents: jest.fn().mockReturnThis(),
    children: jest.fn().mockReturnThis(),
    find: jest.fn().mockReturnThis(),
    filter: jest.fn().mockReturnThis(),
    first: jest.fn().mockReturnThis(),
    last: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    next: jest.fn().mockReturnThis(),
    prev: jest.fn().mockReturnThis(),
    siblings: jest.fn().mockReturnThis(),
    closest: jest.fn().mockReturnThis(),
    data: jest.fn().mockReturnThis(),
    removeData: jest.fn().mockReturnThis(),
    each: jest.fn(function(callback) {
      callback.call(this, 0, this);
      return this;
    }),
    append: jest.fn().mockReturnThis(),
    prepend: jest.fn().mockReturnThis(),
    after: jest.fn().mockReturnThis(),
    before: jest.fn().mockReturnThis(),
    remove: jest.fn().mockReturnThis(),
    empty: jest.fn().mockReturnThis(),
    clone: jest.fn().mockReturnThis(),
    width: jest.fn(() => 100),
    height: jest.fn(() => 100),
    outerWidth: jest.fn(() => 100),
    outerHeight: jest.fn(() => 100),
    offset: jest.fn(() => ({ top: 0, left: 0 })),
    position: jest.fn(() => ({ top: 0, left: 0 })),
    scrollTop: jest.fn().mockReturnThis(),
    scrollLeft: jest.fn().mockReturnThis(),
    is: jest.fn(() => false),
    length: 1,
    get: jest.fn(() => document.createElement('div')),
    toArray: jest.fn(() => [document.createElement('div')])
  };
  
  // Make it array-like
  element[0] = document.createElement('div');
  
  return element;
});

// jQuery static methods
$.extend = jest.fn((target, ...sources) => Object.assign(target, ...sources));
$.ajax = jest.fn().mockResolvedValue({});
$.get = jest.fn().mockResolvedValue({});
$.post = jest.fn().mockResolvedValue({});
$.getJSON = jest.fn().mockResolvedValue({});
$.each = jest.fn((collection, callback) => {
  if (Array.isArray(collection)) {
    collection.forEach((item, index) => callback(index, item));
  } else {
    Object.keys(collection).forEach(key => callback(key, collection[key]));
  }
});
$.map = jest.fn((array, callback) => array.map(callback));
$.grep = jest.fn((array, callback) => array.filter(callback));
$.merge = jest.fn((first, second) => first.concat(second));
$.parseJSON = jest.fn(JSON.parse);
$.parseHTML = jest.fn((html) => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return Array.from(div.childNodes);
});
$.trim = jest.fn((str) => str.trim());
$.isArray = jest.fn(Array.isArray);
$.isFunction = jest.fn((obj) => typeof obj === 'function');
$.isPlainObject = jest.fn((obj) => obj !== null && typeof obj === 'object' && obj.constructor === Object);
$.inArray = jest.fn((value, array) => array.indexOf(value));
$.noop = jest.fn();
$.now = jest.fn(Date.now);
$.Deferred = jest.fn(() => ({
  resolve: jest.fn(),
  reject: jest.fn(),
  promise: jest.fn(() => Promise.resolve())
}));

// jQuery UI
$.ui = {
  dialog: jest.fn(),
  draggable: jest.fn(),
  droppable: jest.fn(),
  resizable: jest.fn(),
  selectable: jest.fn(),
  sortable: jest.fn(),
  accordion: jest.fn(),
  autocomplete: jest.fn(),
  button: jest.fn(),
  datepicker: jest.fn(),
  menu: jest.fn(),
  progressbar: jest.fn(),
  selectmenu: jest.fn(),
  slider: jest.fn(),
  spinner: jest.fn(),
  tabs: jest.fn(),
  tooltip: jest.fn()
};

// Mock MDB (Material Design Bootstrap)
global.mdb = {
  Input: {
    init: jest.fn(),
    getInstance: jest.fn(),
    getOrCreateInstance: jest.fn()
  },
  Dropdown: {
    init: jest.fn(),
    getInstance: jest.fn(),
    getOrCreateInstance: jest.fn()
  },
  Modal: {
    init: jest.fn(),
    getInstance: jest.fn(),
    getOrCreateInstance: jest.fn(() => ({
      show: jest.fn(),
      hide: jest.fn(),
      toggle: jest.fn(),
      dispose: jest.fn()
    }))
  },
  Tab: {
    init: jest.fn(),
    getInstance: jest.fn(),
    getOrCreateInstance: jest.fn()
  },
  Tooltip: {
    init: jest.fn(),
    getInstance: jest.fn(),
    getOrCreateInstance: jest.fn()
  },
  Collapse: {
    init: jest.fn(),
    getInstance: jest.fn(),
    getOrCreateInstance: jest.fn()
  },
  Alert: {
    init: jest.fn(),
    getInstance: jest.fn(),
    getOrCreateInstance: jest.fn()
  }
};

// Mock global MDB objects array
global.mdbObjects = [];

// Mock Monaco Editor
global.monaco = {
  editor: {
    create: jest.fn(() => ({
      dispose: jest.fn(),
      layout: jest.fn(),
      getValue: jest.fn(() => ''),
      setValue: jest.fn(),
      getModel: jest.fn(() => ({
        getValue: jest.fn(() => ''),
        setValue: jest.fn(),
        onDidChangeContent: jest.fn()
      })),
      onDidChangeModelContent: jest.fn(),
      updateOptions: jest.fn(),
      getAction: jest.fn(),
      trigger: jest.fn(),
      focus: jest.fn()
    })),
    setTheme: jest.fn(),
    defineTheme: jest.fn(),
    setModelLanguage: jest.fn()
  },
  languages: {
    register: jest.fn(),
    setMonarchTokensProvider: jest.fn(),
    registerCompletionItemProvider: jest.fn()
  },
  KeyMod: {
    CtrlCmd: 2048,
    Shift: 1024,
    Alt: 512,
    WinCtrl: 256
  },
  KeyCode: {
    F1: 59,
    F2: 60,
    Enter: 3,
    Space: 10,
    Tab: 2,
    Escape: 9
  }
};

// Mock Chart.js
global.Chart = jest.fn().mockImplementation(() => ({
  destroy: jest.fn(),
  update: jest.fn(),
  render: jest.fn(),
  stop: jest.fn(),
  resize: jest.fn(),
  clear: jest.fn(),
  toBase64Image: jest.fn(),
  generateLegend: jest.fn(),
  data: {},
  options: {}
}));

// Mock Lottie Player
global.LottiePlayer = {
  loadAnimation: jest.fn(() => ({
    play: jest.fn(),
    stop: jest.fn(),
    pause: jest.fn(),
    setSpeed: jest.fn(),
    setDirection: jest.fn(),
    destroy: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  }))
};

// Mock xterm
global.Terminal = jest.fn().mockImplementation(() => ({
  open: jest.fn(),
  write: jest.fn(),
  writeln: jest.fn(),
  clear: jest.fn(),
  reset: jest.fn(),
  dispose: jest.fn(),
  focus: jest.fn(),
  blur: jest.fn(),
  resize: jest.fn(),
  scrollToBottom: jest.fn(),
  scrollToTop: jest.fn(),
  selectAll: jest.fn(),
  getSelection: jest.fn(() => ''),
  onData: jest.fn(),
  onKey: jest.fn(),
  onLineFeed: jest.fn(),
  onScroll: jest.fn(),
  onSelectionChange: jest.fn(),
  onRender: jest.fn(),
  onResize: jest.fn(),
  onTitleChange: jest.fn(),
  loadAddon: jest.fn()
}));

// Mock Modules object (from renderer)
global.Modules = {
  Clusters: {
    getClusters: jest.fn().mockResolvedValue([]),
    saveCluster: jest.fn().mockResolvedValue(true),
    deleteCluster: jest.fn().mockResolvedValue(true),
    updateCluster: jest.fn().mockResolvedValue(true)
  },
  Docker: {
    getProjects: jest.fn().mockResolvedValue([]),
    createProject: jest.fn().mockResolvedValue(true),
    deleteProject: jest.fn().mockResolvedValue(true),
    startProject: jest.fn().mockResolvedValue(true),
    stopProject: jest.fn().mockResolvedValue(true)
  },
  Workspaces: {
    getWorkspaces: jest.fn().mockResolvedValue([]),
    createWorkspace: jest.fn().mockResolvedValue(true),
    deleteWorkspace: jest.fn().mockResolvedValue(true),
    updateWorkspace: jest.fn().mockResolvedValue(true)
  },
  Variables: {
    getVariables: jest.fn().mockResolvedValue([]),
    saveVariable: jest.fn().mockResolvedValue(true),
    deleteVariable: jest.fn().mockResolvedValue(true)
  }
};

// Mock window.electron (contextBridge API)
window.electron = {
  invoke: jest.fn().mockResolvedValue(null),
  send: jest.fn(),
  on: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn()
};

// Mock other global functions that might be used
global.getElementMDBObject = jest.fn((element, type = 'Input') => {
  // Return appropriate MDB instance based on type
  const instances = {
    Modal: {
      show: jest.fn(),
      hide: jest.fn(),
      toggle: jest.fn(),
      dispose: jest.fn()
    },
    Dropdown: {
      show: jest.fn(),
      hide: jest.fn(),
      toggle: jest.fn(),
      dispose: jest.fn(),
      update: jest.fn()
    },
    Tooltip: {
      show: jest.fn(),
      hide: jest.fn(),
      toggle: jest.fn(),
      dispose: jest.fn(),
      enable: jest.fn(),
      disable: jest.fn(),
      update: jest.fn()
    },
    Input: {
      init: jest.fn(),
      dispose: jest.fn(),
      update: jest.fn()
    }
  };
  return instances[type] || instances.Input;
});
global.showNotification = jest.fn();
global.showError = jest.fn();
global.showSuccess = jest.fn();
global.showWarning = jest.fn();
global.showInfo = jest.fn();

// Import helper functions from global setup
global.createMockEvent = (type, props = {}) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, props);
  return event;
};

global.createMockFile = (name, content, type = 'text/plain') => {
  return new File([content], name, { type });
};

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));

// Mock MutationObserver
global.MutationObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  takeRecords: jest.fn(() => [])
}));

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  global.mdbObjects = [];
});

// Clean up after all tests
afterAll(() => {
  jest.restoreAllMocks();
});