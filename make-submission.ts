#!/usr/bin/env bun

import { $, Glob } from "bun"
import { join, dirname, extname, resolve } from "path"
import { mkdir, writeFile, mkdtemp } from "fs/promises"

type FileContents = string
export type TarFiles = {
	[filename: string]: FileContents
}
export const createTarGz = async (path: string, files: TarFiles) => {
	const tmpdir = await mkdtemp(`/tmp/submission-`)
	await mkdir(tmpdir, { recursive: true })
	for (const [filename, contents] of Object.entries(files)) {
		await writeFile(join(tmpdir, filename), contents)
	}
	await $`tar -czf ${path} -C ${tmpdir} .`
	await $`rm -rf ${tmpdir}`
}

const findProgram = async (problem: string, language: string) => {
	const glob = new Glob(`AC.*`)
	for await (const path of glob.scan({
		cwd: resolve(`./tests/${problem}/languages/${language}`),
	})) {
		return path
	}
	return null
}

const createSubmissionTar = async (
	problem: string,
	language: string,
	driver: string
) => {
	const program = await findProgram(problem, language)
	if (!program) {
		console.error(`No program found for ${problem} in ${language}`)
		process.exit(1)
	}
	const extension = extname(program)

	// problem.tgz
	await $`tar -czf problem.tgz -C tests/${problem}/problem .`

	// driver.tgz
	await $`tar -czf driver.tgz -C drivers/${driver}/${driver} .`

	// submission.tgz
	await createTarGz(resolve(`submission.tgz`), {
		[`program${extension}`]: await Bun.file(
			`tests/${problem}/languages/${language}/AC${extension}`
		).text(),
		[`submission.yml`]: `compiler_id: ${language}\n`,
	})

	// Create submission.tar
	await $`tar -cf submission.tar problem.tgz driver.tgz submission.tgz`

	// Clean up
	await $`rm -f problem.tgz driver.tgz submission.tgz`
}

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

createSubmissionTar(problem, language, driver)
