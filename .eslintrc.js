module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
    node: true,
    jest: true
  },
  extends: 'eslint:recommended',
  parserOptions: {
    ecmaVersion: 'latest'
  },
  rules: {
    'no-console': 'off',
    'no-unused-vars': ['warn', { 
      'argsIgnorePattern': '^_',
      'varsIgnorePattern': '^_'
    }],
    'no-empty': ['error', { 'allowEmptyCatch': true }],
    'no-control-regex': 'off',
    'no-useless-escape': 'off'
  },
  globals: {
    $: 'readonly',
    jQuery: 'readonly',
    mdb: 'readonly',
    monaco: 'readonly',
    Chart: 'readonly',
    Modules: 'readonly',
    IPCMain: 'readonly',
    Terminal: 'readonly',
    FS: 'readonly',
    Path: 'readonly',
    OS: 'readonly'
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'custom_node_modules/',
    'renderer/js/external/',
    'main/bin/',
    'coverage/',
    '*.min.js'
  ]
};