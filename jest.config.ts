/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
	/* NOTE(pauek): These two lines are extremely important for now!
	      Concurrency in the tests produces errors :( */
	maxConcurrency: 1,
	maxWorkers: 1,

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
