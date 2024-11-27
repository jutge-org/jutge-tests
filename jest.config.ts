/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
	maxConcurrency: 1,
	maxWorkers: 1,

	testTimeout: 20000, // FIXME(pauek): Go needs more than 5000 for now...

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
