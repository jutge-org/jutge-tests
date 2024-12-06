#!/usr/bin/env bun

import { $, Glob } from "bun"
import { mkdir, mkdtemp, writeFile } from "fs/promises"
import { extname, join, resolve } from "path"
import { withTmpDir } from "./utils"

const _findProgram = async (jutgeTestsDir: string, problem: string, language: string) => {
	const glob = new Glob(`AC.*`)
	for await (const path of glob.scan({
		cwd: resolve(`${jutgeTestsDir}/tests/${problem}/languages/${language}`),
	})) {
		return path
	}
	return null
}

export const createSubmissionTar = async (
	jutgeTestsDir: string,
	problem: string,
	language: string,
	driver: string,
	submissionTarFile: string
) => {
	const program = await _findProgram(jutgeTestsDir, problem, language)
	if (!program) {
		console.error(`No program found for ${problem} in ${language}`)
		process.exit(1)
	}
	const extension = extname(program)

	// Create temporary folder
	await withTmpDir(async (tmpDir) => {
		const problemTgz = `${tmpDir}/problem.tgz`
		const driverTgz = `${tmpDir}/driver.tgz`
		const submissionTgz = `${tmpDir}/submission.tgz`

		await $`tar -czf ${problemTgz} -C ${jutgeTestsDir}/tests/${problem}/problem .`
		await $`tar -czf ${driverTgz}  -C ${jutgeTestsDir}/drivers/${driver}/${driver} .`

		// submission.tgz
		await createTarGz(submissionTgz, {
			[`program${extension}`]: await Bun.file(
				`${jutgeTestsDir}/tests/${problem}/languages/${language}/AC${extension}`
			).text(),
			[`submission.yml`]: `compiler_id: ${language}\n`,
		})

		// Create submissionTarFile
		await $`tar -cf ${submissionTarFile} -C ${tmpDir} problem.tgz driver.tgz submission.tgz`
	})
}

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
