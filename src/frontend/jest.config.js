module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src/tests/backend'],
  testMatch: [
    '**/__tests__/**/*.(js|jsx|ts|tsx)',
    '**/*.(test|spec).(js|jsx|ts|tsx)'
  ],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(some-es6-package|another-es6-package)/)',
  ],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@backend/(.*)$': '<rootDir>/src/backend/$1',
    '^@tests/(.*)$': '<rootDir>/src/tests/$1',
  },
  setupFilesAfterEnv: [
    '<rootDir>/src/tests/backend/setup.js'
  ],
  collectCoverageFrom: [
    'src/backend/**/*.{js,jsx,ts,tsx}',
    '!src/backend/**/*.d.ts',
    '!src/backend/migrations/**',
    '!src/backend/seeders/**',
    '!src/backend/config/**',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/dist/',
    '/build/',
  ],
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    'src/backend/controllers/': {
      branches: 80,
      functions: 90,
      lines: 85,
      statements: 85,
    },
    'src/backend/services/': {
      branches: 75,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    'src/backend/middleware/': {
      branches: 80,
      functions: 90,
      lines: 85,
      statements: 85,
    },
  },
  testTimeout: 30000,
  maxWorkers: 4,
  verbose: true,
  bail: false,
  clearMocks: true,
  restoreMocks: true,
  detectOpenHandles: true,
  forceExit: true,
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
  moduleDirectories: ['node_modules', '<rootDir>/'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/coverage/',
  ],
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname',
  ],
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'test-results',
        outputName: 'junit.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true,
      },
    ],
    [
      'jest-html-reporters',
      {
        publicPath: 'test-results',
        filename: 'backend-test-report.html',
        expand: true,
      },
    ],
  ],
  globalSetup: '<rootDir>/src/tests/backend/globalSetup.js',
  globalTeardown: '<rootDir>/src/tests/backend/globalTeardown.js',
};