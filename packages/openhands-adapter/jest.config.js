/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { module: 'CommonJS', esModuleInterop: true } }],
  },
  moduleNameMapper: {
    '^@openhands/typescript-client$': '<rootDir>/__mocks__/openhands-typescript-client.js',
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
};
