/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { module: 'CommonJS', esModuleInterop: true } }],
  },
  moduleNameMapper: {
    '^@kilocode/sdk$': '<rootDir>/__mocks__/kilocode-sdk.js',
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
};
