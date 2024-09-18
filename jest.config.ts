/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
  extensionsToTreatAsEsm: [".ts"],
  testEnvironment: "node",
  moduleNameMapper: {
    "@/(.*)": "<rootDir>/$1",
  },
  transform: {
    "^.+.tsx?$": ["ts-jest", {}],
  },
  globalSetup: "./setup.ts",
  globalTeardown: "./tear-down.ts",
}
