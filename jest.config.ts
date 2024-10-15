/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
	maxConcurrency: 1, // No concurrency 😥
	maxWorkers: 1, // No concurrency 😥
	extensionsToTreatAsEsm: [".ts"],
	testEnvironment: "node",
	moduleNameMapper: {
		"@/(.*)": "<rootDir>/$1",
	},
	transform: {
		"^.+.tsx?$": ["ts-jest", {}],
	},
	globalSetup: "./setup.ts",
	globalTeardown: "./teardown.ts",
}
