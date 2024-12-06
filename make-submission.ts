#!/usr/bin/env bun

import { createSubmissionTar } from "./lib/submission"

const [_bun, _script, ...args] = process.argv
let [problem, language, driver] = args
if (!problem || !language) {
	console.error(
		`Usage: make-submission <problem> <language> [<driver>="std"]`
	)
	process.exit(1)
}
if (!driver) {
	driver = "std"
}

createSubmissionTar(problem, language, driver, './sub.tar')
