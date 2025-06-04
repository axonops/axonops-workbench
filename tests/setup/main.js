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

// Setup for main process tests

// Mock v8-compile-cache
jest.mock('v8-compile-cache', () => ({}), { virtual: true });

// Mock global modules that main process uses
global.IPCMain = require('../mocks/electron-main').ipcMain;
global.Terminal = {
  get: jest.fn().mockImplementation((cmd, callback) => {
    if (callback) callback(null, '', '');
  }),
  run: jest.fn().mockImplementation((cmd, callback) => {
    if (callback) callback(null, '', '');
  })
};

// Mock fs-extra
jest.mock('fs-extra', () => ({
  ...jest.requireActual('fs-extra'),
  ensureDir: jest.fn().mockResolvedValue(undefined),
  ensureDirSync: jest.fn(),
  pathExists: jest.fn().mockResolvedValue(true),
  pathExistsSync: jest.fn(() => true),
  readFile: jest.fn().mockResolvedValue('mock file content'),
  readFileSync: jest.fn(() => 'mock file content'),
  writeFile: jest.fn().mockResolvedValue(undefined),
  writeFileSync: jest.fn(),
  readJson: jest.fn().mockResolvedValue({}),
  readJsonSync: jest.fn(() => ({})),
  writeJson: jest.fn().mockResolvedValue(undefined),
  writeJsonSync: jest.fn(),
  copy: jest.fn().mockResolvedValue(undefined),
  copySync: jest.fn(),
  move: jest.fn().mockResolvedValue(undefined),
  moveSync: jest.fn(),
  remove: jest.fn().mockResolvedValue(undefined),
  removeSync: jest.fn(),
  emptyDir: jest.fn().mockResolvedValue(undefined),
  emptyDirSync: jest.fn(),
  stat: jest.fn().mockResolvedValue({
    isFile: () => true,
    isDirectory: () => false,
    size: 1024
  }),
  statSync: jest.fn(() => ({
    isFile: () => true,
    isDirectory: () => false,
    size: 1024
  }))
}));

global.FS = require('fs-extra');
global.Path = require('path');
global.OS = require('os');

// Mock process.platform for cross-platform testing
Object.defineProperty(process, 'platform', {
  value: 'darwin',
  configurable: true
});

// Mock node-pty
jest.mock('node-pty', () => ({
  spawn: jest.fn(() => ({
    pid: 12345,
    process: 'mock-process',
    write: jest.fn(),
    resize: jest.fn(),
    destroy: jest.fn(),
    kill: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn()
  }))
}));

// Mock better-sqlite3
jest.mock('better-sqlite3', () => {
  return jest.fn(() => ({
    prepare: jest.fn(() => ({
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn(() => []),
      pluck: jest.fn(() => ({
        get: jest.fn(),
        all: jest.fn(() => [])
      }))
    })),
    exec: jest.fn(),
    close: jest.fn(),
    transaction: jest.fn((fn) => fn),
    pragma: jest.fn()
  }));
});

// Mock SSH2
jest.mock('ssh2', () => ({
  Client: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    connect: jest.fn(),
    end: jest.fn(),
    destroy: jest.fn(),
    exec: jest.fn((cmd, callback) => {
      const stream = {
        on: jest.fn((event, cb) => {
          if (event === 'close') {
            setTimeout(() => cb(0, null), 10);
          }
          return stream;
        }),
        stderr: {
          on: jest.fn()
        }
      };
      callback(null, stream);
    }),
    shell: jest.fn((callback) => {
      const stream = {
        on: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
        stderr: {
          on: jest.fn()
        }
      };
      callback(null, stream);
    }),
    forwardOut: jest.fn((srcIP, srcPort, destIP, destPort, callback) => {
      const stream = {
        on: jest.fn(),
        write: jest.fn(),
        end: jest.fn()
      };
      callback(null, stream);
    })
  })),
  utils: {
    parseKey: jest.fn(() => ({ type: 'ssh-rsa' }))
  }
}));

// Mock child_process
jest.mock('child_process', () => ({
  spawn: jest.fn(() => ({
    pid: 12345,
    stdout: {
      on: jest.fn(),
      pipe: jest.fn()
    },
    stderr: {
      on: jest.fn(),
      pipe: jest.fn()
    },
    on: jest.fn(),
    kill: jest.fn()
  })),
  exec: jest.fn((cmd, options, callback) => {
    if (typeof options === 'function') {
      callback = options;
    }
    if (callback) {
      callback(null, 'mock output', '');
    }
  }),
  execSync: jest.fn(() => 'mock output'),
  fork: jest.fn(() => ({
    pid: 12345,
    on: jest.fn(),
    send: jest.fn(),
    kill: jest.fn()
  }))
}));

// Mock axios
jest.mock('axios', () => ({
  get: jest.fn().mockResolvedValue({ data: {} }),
  post: jest.fn().mockResolvedValue({ data: {} }),
  put: jest.fn().mockResolvedValue({ data: {} }),
  delete: jest.fn().mockResolvedValue({ data: {} }),
  create: jest.fn(() => ({
    get: jest.fn().mockResolvedValue({ data: {} }),
    post: jest.fn().mockResolvedValue({ data: {} }),
    put: jest.fn().mockResolvedValue({ data: {} }),
    delete: jest.fn().mockResolvedValue({ data: {} })
  }))
}));

// Mock keytar
jest.mock('keytar', () => ({
  getPassword: jest.fn().mockResolvedValue(null),
  setPassword: jest.fn().mockResolvedValue(undefined),
  deletePassword: jest.fn().mockResolvedValue(true),
  findPassword: jest.fn().mockResolvedValue(null),
  findCredentials: jest.fn().mockResolvedValue([])
}));

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

// Clean up after all tests
afterAll(() => {
  jest.restoreAllMocks();
});