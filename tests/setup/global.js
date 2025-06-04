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

// Global test setup
const path = require('path');

// Set up environment variables for testing
process.env.NODE_ENV = 'test';
process.env.ELECTRON_IS_TEST = '1';

// Suppress console output during tests unless explicitly needed
if (!process.env.DEBUG_TESTS) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
}

// Mock timers to speed up tests
global.setTimeout = jest.fn((fn, delay) => {
  if (typeof fn === 'function') {
    return process.nextTick(fn);
  }
  return 0;
});

global.setInterval = jest.fn(() => 0);
global.clearTimeout = jest.fn();
global.clearInterval = jest.fn();

// Mock localStorage for renderer tests
if (typeof window !== 'undefined') {
  const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    key: jest.fn(),
    length: 0
  };
  global.localStorage = localStorageMock;
  global.sessionStorage = localStorageMock;
}

// Add custom matchers
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false
      };
    }
  },
  
  toContainObject(received, argument) {
    const pass = this.equals(received,
      expect.arrayContaining([
        expect.objectContaining(argument)
      ])
    );
    if (pass) {
      return {
        message: () => `expected ${this.utils.printReceived(received)} not to contain object ${this.utils.printExpected(argument)}`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${this.utils.printReceived(received)} to contain object ${this.utils.printExpected(argument)}`,
        pass: false
      };
    }
  }
});

// Helper function to wait for async operations
global.waitFor = (condition, timeout = 5000) => {
  return new Promise((resolve, reject) => {
    const interval = 50;
    let elapsed = 0;
    
    const check = () => {
      if (condition()) {
        resolve();
      } else if (elapsed >= timeout) {
        reject(new Error('Timeout waiting for condition'));
      } else {
        elapsed += interval;
        setTimeout(check, interval);
      }
    };
    
    check();
  });
};

// Helper to create mock file objects
global.createMockFile = (name, content, type = 'text/plain') => {
  return new File([content], name, { type });
};

// Helper to create mock events
global.createMockEvent = (type, props = {}) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, props);
  return event;
};