# Testing Guide for AxonOps Workbench

<p align="center">
  <img src="https://img.shields.io/badge/Jest-29.7.0-C21325?style=for-the-badge&logo=jest&logoColor=white" alt="Jest" />
  <img src="https://img.shields.io/badge/Electron-31.6.0-47848F?style=for-the-badge&logo=electron&logoColor=white" alt="Electron" />
</p>

## 📋 Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Test Architecture](#test-architecture)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Test Coverage](#test-coverage)
- [Continuous Integration](#continuous-integration)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Resources](#resources)

## 🎯 Overview

The AxonOps Workbench testing suite provides comprehensive coverage for our Electron application, ensuring reliability and maintainability across all components. Our testing approach follows industry best practices established by major Electron applications like [Visual Studio Code](https://github.com/microsoft/vscode), [Slack Desktop](https://slack.engineering/building-hybrid-applications-with-electron/), and [Discord](https://discord.com/blog/how-discord-achieves-native-ios-performance-with-react-native).

### Key Features

- 🚀 **High code coverage** with comprehensive test suite
- 🔄 **Dual-process testing** for both main and renderer processes
- 🤖 **Automated CI/CD integration** with GitHub Actions
- 📦 **Comprehensive Electron API mocking**
- ⚡ **Fast test execution** with parallel test runners

### Technology Stack

| Tool | Version | Purpose |
|------|---------|---------|
| [Jest](https://jestjs.io/) | 29.7.0 | Testing framework |
| [Babel](https://babeljs.io/) | 7.24.0 | ES6+ transpilation |
| [ESLint](https://eslint.org/) | 8.57.0 | Code quality |
| [jest-environment-jsdom](https://github.com/jsdom/jsdom) | 29.7.0 | DOM simulation |

## 🚀 Quick Start

### Prerequisites

- Node.js v20.17.0 or higher
- pnpm v10.x or higher
- All project dependencies installed

### Installation

```bash
# Clone the repository
git clone https://github.com/axonops/axonops-workbench.git
cd axonops-workbench

# Install dependencies
pnpm install

# Run tests
pnpm test
```

### Essential Commands

```bash
# Run all tests with coverage
pnpm run test:coverage

# Run tests in watch mode (recommended for development)
pnpm run test:watch

# Run specific test suite
pnpm run test:main      # Main process tests only
pnpm run test:renderer  # Renderer process tests only
```

## 🏗️ Test Architecture

Our test architecture follows the [Electron Testing Best Practices](https://www.electronjs.org/docs/latest/tutorial/testing) guide, with adaptations for our specific use case.

### Directory Structure

```
axonops-workbench/
├── tests/
│   ├── unit/
│   │   ├── main/                 # Main process tests
│   │   │   ├── app-lifecycle.test.js
│   │   │   ├── ipc-handlers.test.js
│   │   │   ├── window-management.test.js
│   │   │   └── electron-api-coverage.test.js
│   │   └── renderer/             # Renderer process tests
│   │       ├── clusters-events.test.js
│   │       ├── funcs.test.js
│   │       ├── ipc-communication.test.js
│   │       ├── ui-interactions.test.js
│   │       └── electron-renderer-coverage.test.js
│   ├── integration/              # Integration tests (future)
│   ├── e2e/                     # End-to-end tests (future)
│   ├── setup/                   # Test configuration
│   │   ├── global.js            # Global test setup
│   │   ├── main.js              # Main process setup
│   │   └── renderer.js          # Renderer process setup
│   ├── mocks/                   # Mock implementations
│   │   ├── electron-main.js     # Main process Electron mocks
│   │   ├── electron-renderer.js # Renderer process Electron mocks
│   │   ├── style-mock.js        # CSS import mocks
│   │   └── file-mock.js         # Asset import mocks
│   └── fixtures/                # Test data
├── jest.config.js               # Jest configuration
├── .babelrc                     # Babel configuration
├── .eslintrc.js                # ESLint configuration
└── TESTING.md                   # This document
```

### Test Categories

#### 1. Unit Tests
- **Purpose**: Test individual functions and components in isolation
- **Location**: `tests/unit/`
- **Coverage**: Comprehensive test suite
- **Execution**: Fast execution time

#### 2. Integration Tests (Planned)
- **Purpose**: Test interaction between components
- **Location**: `tests/integration/`
- **Focus**: IPC communication, database operations

#### 3. End-to-End Tests (Planned)
- **Purpose**: Test complete user workflows
- **Tool**: [Playwright](https://playwright.dev/)
- **Focus**: Critical user paths

## 🧪 Running Tests

### Command Reference

| Command | Description | Use Case |
|---------|-------------|----------|
| `pnpm test` | Run all tests | Quick validation |
| `pnpm run test:watch` | Run tests in watch mode | Development |
| `pnpm run test:coverage` | Generate coverage report | CI/CD, reporting |
| `pnpm run test:main` | Test main process only | Main process development |
| `pnpm run test:renderer` | Test renderer process only | UI development |
| `pnpm run test:ci` | Optimized for CI | GitHub Actions |

### Running Specific Tests

```bash
# Run a specific test file
npx jest tests/unit/main/app-lifecycle.test.js

# Run tests matching a pattern
npx jest --testNamePattern="should handle window"

# Run tests in a specific directory
npx jest tests/unit/renderer

# Run tests with debugging
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Coverage Reports

After running `pnpm run test:coverage`, view the detailed HTML report:

```bash
# Open coverage report in browser (macOS)
open coverage/lcov-report/index.html

# Windows
start coverage/lcov-report/index.html

# Linux
xdg-open coverage/lcov-report/index.html
```

## ✍️ Writing Tests

### Test Structure

Follow the **AAA (Arrange-Act-Assert)** pattern:

```javascript
describe('Feature Name', () => {
  // Setup shared across tests
  let mockDependency;

  beforeEach(() => {
    // Reset mocks and state before each test
    jest.clearAllMocks();
    mockDependency = createMockDependency();
  });

  afterEach(() => {
    // Cleanup after each test
    cleanup();
  });

  describe('Specific Functionality', () => {
    test('should handle normal case', async () => {
      // Arrange - Set up test data and conditions
      const input = { name: 'test', value: 42 };
      const expected = { result: 'success', data: 42 };

      // Act - Execute the code under test
      const result = await functionUnderTest(input);

      // Assert - Verify the outcome
      expect(result).toEqual(expected);
      expect(mockDependency.process).toHaveBeenCalledWith(input);
    });

    test('should handle error case', async () => {
      // Arrange
      const error = new Error('Connection failed');
      mockDependency.process.mockRejectedValue(error);

      // Act & Assert
      await expect(functionUnderTest({})).rejects.toThrow('Connection failed');
    });
  });
});
```

### Testing Electron-Specific Features

#### Main Process Testing

```javascript
const { app, BrowserWindow, ipcMain } = require('electron');

describe('Main Process Features', () => {
  test('should handle app lifecycle', async () => {
    // Test app ready state
    const readyPromise = app.whenReady();
    app.emit('ready');
    await readyPromise;

    expect(app.isReady).toBe(true);
  });

  test('should handle IPC communication', () => {
    const handler = jest.fn().mockResolvedValue({ success: true });
    ipcMain.handle('test-channel', handler);

    // Simulate IPC call
    const event = { sender: { id: 1 } };
    const result = await handler(event, 'test-data');

    expect(result).toEqual({ success: true });
  });
});
```

#### Renderer Process Testing

```javascript
const { ipcRenderer } = require('electron');

describe('Renderer Process Features', () => {
  beforeEach(() => {
    // Set up DOM
    document.body.innerHTML = `
      <div id="app">
        <button id="test-button">Click Me</button>
      </div>
    `;
  });

  test('should handle user interactions', async () => {
    const button = document.getElementById('test-button');
    const clickHandler = jest.fn();

    button.addEventListener('click', clickHandler);
    button.click();

    expect(clickHandler).toHaveBeenCalled();
  });

  test('should communicate with main process', async () => {
    ipcRenderer.mockHandler('get-data', () => ({ data: 'test' }));

    const result = await ipcRenderer.invoke('get-data');
    expect(result).toEqual({ data: 'test' });
  });
});
```

### Mock Best Practices

1. **Always clear mocks between tests**
   ```javascript
   beforeEach(() => {
     jest.clearAllMocks();
   });
   ```

2. **Use mock implementations for external dependencies**
   ```javascript
   jest.mock('fs-extra', () => ({
     readFile: jest.fn().mockResolvedValue('content'),
     writeFile: jest.fn().mockResolvedValue(undefined)
   }));
   ```

3. **Create reusable mock factories**
   ```javascript
   function createMockWindow(options = {}) {
     return {
       id: Math.random(),
       isDestroyed: false,
       close: jest.fn(),
       ...options
     };
   }
   ```

## 📊 Test Coverage

### Coverage Goals

Our project maintains high test coverage across all metrics. To view current coverage:

```bash
# Generate coverage report
pnpm run test:coverage

# View detailed HTML report
open coverage/lcov-report/index.html  # macOS
# or
start coverage/lcov-report/index.html  # Windows
# or
xdg-open coverage/lcov-report/index.html  # Linux
```

The project enforces minimum coverage thresholds to ensure code quality remains high.

### Coverage Standards

We follow coverage standards similar to:
- [Jest's own standards](https://github.com/facebook/jest) (80%+ for critical paths)
- [Electron's standards](https://github.com/electron/electron) (Focus on API surface)
- [VS Code's approach](https://github.com/microsoft/vscode) (Comprehensive unit + integration)

### Viewing Coverage Details

```bash
# Generate and view coverage
pnpm run test:coverage

# View coverage in terminal
cat coverage/lcov-report/index.html

# Check specific file coverage
npx jest --coverage --collectCoverageFrom="main/main.js"
```

### Improving Coverage

1. **Identify uncovered lines**
   ```bash
   # Look for uncovered line numbers in the coverage report
   grep -n "Uncovered" coverage/lcov-report/index.html
   ```

2. **Focus on critical paths**
   - IPC handlers
   - Data persistence
   - User authentication
   - Error handling

3. **Skip non-critical coverage**
   - Build scripts
   - Development tools
   - Third-party integrations

## 🔄 Continuous Integration

### GitHub Actions Integration

Our CI pipeline runs on every push and pull request:

```yaml
name: Run Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
```

### CI Test Execution

1. **Multi-platform testing**: Ubuntu, Windows, macOS
2. **Parallel execution**: Utilizing GitHub Actions matrix
3. **Coverage reporting**: Automated coverage tracking
4. **Artifact storage**: Test results and coverage reports

### Local CI Simulation

```bash
# Simulate CI environment locally
NODE_ENV=test ELECTRON_IS_TEST=1 pnpm run test:ci

# Run with CI-like constraints
pnpm run test:ci -- --maxWorkers=2 --coverage
```

## 📚 Best Practices

### 1. Test Organization

- **Group related tests** using `describe` blocks
- **Use descriptive test names** that explain the expected behavior
- **Follow the AAA pattern** (Arrange, Act, Assert)
- **Keep tests focused** - one concept per test

### 2. Performance

- **Mock heavy operations** (file I/O, network requests)
- **Use `beforeAll` wisely** for expensive setup
- **Parallelize when possible** using Jest's default behavior
- **Skip slow tests in watch mode** using `test.skip`

### 3. Maintainability

- **DRY principle** - extract common test utilities
- **Update tests with code** - tests are documentation
- **Use data-driven tests** for multiple scenarios
- **Keep mocks close to reality**

### 4. Debugging

```javascript
// Add debug output
test('debugging example', () => {
  const result = complexFunction();

  // Temporary debug output
  console.log('Result:', JSON.stringify(result, null, 2));

  expect(result).toBeDefined();
});

// Use debugger
test('debugger example', () => {
  debugger; // Pause here when running with --inspect-brk
  const result = functionToDebug();
  expect(result).toBe(expected);
});
```

## 🔧 Troubleshooting

### Common Issues and Solutions

#### 1. Module Not Found
```
Cannot find module 'electron' from 'tests/...'
```
**Solution**: Ensure mocks are properly configured in `jest.config.js`

#### 2. Async Test Timeout
```
Timeout - Async callback was not invoked within 5000ms
```
**Solution**: Increase timeout or check for unresolved promises
```javascript
test('long running test', async () => {
  // Test code
}, 10000); // 10 second timeout
```

#### 3. Mock Not Working
```
TypeError: mockFunction is not a function
```
**Solution**: Clear mocks and ensure proper mock setup
```javascript
beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});
```

#### 4. DOM Not Found
```
Cannot read property 'click' of null
```
**Solution**: Ensure DOM is set up in beforeEach
```javascript
beforeEach(() => {
  document.body.innerHTML = '<div id="test"></div>';
});
```

### Debug Commands

```bash
# Run with verbose output
pnpm test -- --verbose

# Run with detective mode
pnpm test -- --detectOpenHandles

# Run single test with debugging
node --inspect-brk node_modules/.bin/jest --runInBand path/to/test.js
```

## 🤝 Contributing

### Adding New Tests

1. **Identify the test category** (unit, integration, e2e)
2. **Create test file** following naming convention: `*.test.js`
3. **Follow the established patterns** in existing tests
4. **Ensure coverage doesn't decrease**
5. **Update this documentation** if adding new patterns

### Test Review Checklist

- [ ] Tests follow AAA pattern
- [ ] Mocks are properly cleared
- [ ] Async operations are properly handled
- [ ] Error cases are tested
- [ ] Test names are descriptive
- [ ] No console.log statements
- [ ] Coverage meets project thresholds

### Submitting Tests

1. Run full test suite: `pnpm test`
2. Check coverage: `pnpm run test:coverage`
3. Fix any linting issues: `pnpm run lint`
4. Commit with descriptive message
5. Create pull request with test summary

## 📖 Resources

### Official Documentation
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Electron Testing Guide](https://www.electronjs.org/docs/latest/tutorial/testing)
- [Testing Library](https://testing-library.com/docs/)

### Best Practices Guides
- [JavaScript Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Electron Best Practices](https://www.electronjs.org/docs/latest/tutorial/best-practices)
- [Jest Best Practices](https://github.com/facebook/jest/tree/main/docs)

### Example Projects
- [Electron React Boilerplate](https://github.com/electron-react-boilerplate/electron-react-boilerplate)
- [VS Code Tests](https://github.com/microsoft/vscode/tree/main/src/vs/base/test)
- [Atom Editor Tests](https://github.com/atom/atom/tree/master/spec)

### Tools and Extensions
- [Jest VS Code Extension](https://marketplace.visualstudio.com/items?itemName=Orta.vscode-jest)
- [Coverage Gutters](https://marketplace.visualstudio.com/items?itemName=ryanluker.vscode-coverage-gutters)
- [Test Explorer UI](https://marketplace.visualstudio.com/items?itemName=hbenl.vscode-test-explorer)

### Continuous Learning
- [Testing JavaScript](https://testingjavascript.com/) by Kent C. Dodds
- [Electron in Action](https://www.manning.com/books/electron-in-action) by Steve Kinney
- [Jest Handbook](https://github.com/jest-handbook/jest-handbook) - Community resource

---

<p align="center">
  <strong>Questions or Issues?</strong><br>
  Open an issue on <a href="https://github.com/axonops/axonops-workbench/issues">GitHub</a> or contact the development team.
</p>
