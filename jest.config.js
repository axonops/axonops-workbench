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

module.exports = {
  // Use different configurations for main and renderer processes
  projects: [
    {
      displayName: 'main',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/unit/main/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/main.js'],
      moduleNameMapper: {
        '^electron$': '<rootDir>/tests/mocks/electron-main.js'
      },
      collectCoverageFrom: [
        'main/**/*.js',
        '!main/bin/**',
        '!main/**/*.min.js'
      ]
    },
    {
      displayName: 'renderer',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/tests/unit/renderer/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/renderer.js'],
      moduleNameMapper: {
        '^electron$': '<rootDir>/tests/mocks/electron-renderer.js',
        '\\.(css|less|scss|sass)$': '<rootDir>/tests/mocks/style-mock.js',
        '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/tests/mocks/file-mock.js'
      },
      collectCoverageFrom: [
        'renderer/js/**/*.js',
        '!renderer/js/external/**',
        '!renderer/js/**/*.min.js'
      ],
      testEnvironmentOptions: {
        url: 'http://localhost'
      }
    }
  ],
  
  // Common configuration
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },
  
  // Transform settings
  transform: {
    '^.+\\.js$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', {
          targets: {
            node: 'current'
          }
        }]
      ]
    }]
  },
  
  // Module directories
  moduleDirectories: ['node_modules', 'renderer/js', 'main'],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/custom_node_modules/',
    '/.git/'
  ],
  
  // Setup files
  setupFiles: ['<rootDir>/tests/setup/global.js'],
  
  // Verbose output
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks between tests
  restoreMocks: true,
  
  // Reset mocks between tests
  resetMocks: true,
  
  // Maximum worker threads
  maxWorkers: '50%'
};