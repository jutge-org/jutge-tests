/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
	/* NOTE(pauek): These two lines are extremely important for now!
	      Concurrency in the tests produces errors :( */
	maxConcurrency: 1,
	maxWorkers: 1,

	testTimeout: 10000, // FIXME(pauek): Go needs more than 5000 for now...

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
