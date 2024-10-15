import { readdirSync } from "fs"
import * as fs from "fs/promises"
import { mkdir } from "fs/promises"
import { rmdir } from "fs/promises"
import { rm } from "fs/promises"
import { copyFile } from "fs/promises"
import { readFile } from "fs/promises"
import { exec, spawn } from "node:child_process"
import { basename, dirname, extname, join, resolve } from "path"
import { parse as yamlParse, stringify as yamlStringify } from "yaml"

export const PYTHON_ENV_DIR = "venv"
export const TEST_ROOT = __dirname

export const asyncExec = (cmd: string) =>
	new Promise((resolve, reject) => {
		exec(cmd, (error, stdout, stderr) => {
			if (error) return reject(error)
			if (stderr) return reject(stderr)
			resolve(stdout)
		})
	})

export const asyncSpawn = (
	cmd: string,
	args: string[]
): Promise<{ stdout: string; stderr: string }> =>
	new Promise((resolve, reject) => {
		const process = spawn(cmd, args)
		let stdout = ""
		let stderr = ""

		process.stdout.on("data", (data) => (stdout += data))
		process.stderr.on("data", (data) => (stderr += data))
		process.on("error", (err) => reject(err))
		process.on("close", (code) => {
			if (code === 0) {
				resolve({ stdout, stderr })
			} else {
				reject(
					new Error(
						`Executing '${cmd}' failed with code ${code}:\n` +
							`STDOUT:\n${stdout}\n` +
							`STDERR:\n${stderr}\n`
					)
				)
			}
		})
	})

export const makeTaskTar = async (taskFolder: string) => {
	for (const part of ["driver", "problem", "submission"]) {
		await asyncExec(`tar -czf ${part}.tgz -C ${`${taskFolder}/${part}`} .`)
	}
	await asyncExec(
		`tar -cf ${`${taskFolder}/task.tar`} driver.tgz problem.tgz submission.tgz`
	)
	await asyncExec(`rm -f driver.tgz problem.tgz submission.tgz`)
}

export const runScript = async (cmds: string[]) => {
	const script = [...cmds].join("; ")
	const { stdout, stderr } = await asyncSpawn("bash", ["-c", script])
	return { stdout: stdout.toString(), stderr: stderr.toString() }
}

export const rVeredict = /<<<< end with veredict (.*) >>>>/

export const submitProblem = async (name: string, testDir: string) => {
	try {
		const { stdout, stderr } = await runScript([
			`cd ${testDir}`, // Change to temporary, empty directory since 'jutge-run' will use it as the shared volue
			`jutge-run jutge-submit ${name} < ${testDir}/task.tar > ${testDir}/correction.tgz`,
		])

		await fs.writeFile(`${testDir}/submit.stdout.txt`, stdout)
		await fs.writeFile(`${testDir}/submit.stderr.txt`, stderr)

		const match = stderr.match(rVeredict)
		if (!match) {
			throw new Error("No veredict found")
		}
		return match[1]
	} catch (e) {
		throw new Error(`submitProblem failed: ${e}`)
	}
}

export const expectedVerdict = async (folder: string) =>
	fs.readFile(`${folder}/.verdict`).toString().trim()

export const readYml = async (path: string) => {
	try {
		const buf = await fs.readFile(path)
		return yamlParse(buf.toString())
	} catch (e) {
		return ""
	}
}

export const writeYml = async (path: string, obj: Record<string, any>) =>
	fs.writeFile(path, yamlStringify(obj))

export const editYml = async (
	path: string,
	fn: (obj: Record<string, any>) => Record<string, any>
) => {
	const obj = await readYml(path)
	await writeYml(path, fn(obj))
}

export const subDirs = async (path: string) => {
	let subdirs: string[] = []
	for (const ent of await fs.readdir(path, { withFileTypes: true })) {
		if (ent.isDirectory()) {
			subdirs.push(`${path}/${ent.name}`)
		}
	}
	return subdirs
}

export const setSubmissionDetails = async (
	taskFolder: string,
	programFile: string,
	language: string,
	verdict: string
) => {
	const extension = extname(programFile)
	await fs.rm(`${taskFolder}/submission`, { recursive: true, force: true })
	await fs.mkdir(`${taskFolder}/submission`)
	await fs.copyFile(
		programFile,
		`${taskFolder}/submission/program${extension}`
	)
	await editYml(`${taskFolder}/submission/submission.yml`, (config) => ({
		...config,
		compiler_id: language,
	}))
	await fs.writeFile(`${taskFolder}/.verdict`, verdict)
}

const regexVerdictFilename = /^(\w+)(-.*)?\..*$/

export const verdictFromFilename = (filename: string) => {
	const match = filename.match(regexVerdictFilename)
	if (match === null) {
		throw new Error(`Could not extract veredict from filename: ${filename}`)
	}
	return match[1]
}

/**
 * Creates a tar.gz file from a directory (BASE/"mydir" => BASE/"mydir.tar.gz")
 * @param dir
 */
export const createTarGzFromDirectory = async (dir: string, filepath: string) =>
	asyncExec(`tar -czf ${filepath} -C ${dir} .`)

export const removeFile = async (path: string) =>
	fs.rm(path, { recursive: true, force: true })

export const createTemporaryDir = async (prefix: string) => fs.mkdtemp(prefix)

type FileContents = string
export type TarFiles = {
	[filename: string]: FileContents
}
export const createTarGz = async (path: string, files: TarFiles) => {
	const dir = dirname(path)
	await fs.mkdir(join(dir, "submission"), { recursive: true })
	for (const [filename, contents] of Object.entries(files)) {
		await fs.writeFile(join(dir, "submission", filename), contents)
	}
	const targetdir = join(dir, "submission")
	const filenames = Object.keys(files)
	await asyncExec(`tar -czf ${path} -C ${targetdir} ${filenames.join(" ")}`)
}

export const createTar = async (
	destination: string,
	rootDir: string,
	localFiles: string[]
) => asyncExec(`tar -cf ${destination} -C ${rootDir} ${localFiles}`)

export const createHelloWorldTar = async (
	dir: string,
	testDir: string,
	language: string,
	programFile: string
) => {
	// Create submission.tgz
	const extension = extname(programFile) // This _contains_ the dot '.'
	await createTarGz(`${testDir}/submission.tgz`, {
		[`program${extension}`]: (await readFile(programFile)).toString(),
		[`submission.yml`]: `compiler_id: ${language}\n`,
	})

	await copyFile(`${dir}/driver.tgz`, `${testDir}/driver.tgz`)
	await copyFile(`${dir}/problem.tgz`, `${testDir}/problem.tgz`)

	const filenames = ["driver.tgz", "problem.tgz", "submission.tgz"]
	await asyncExec(
		`tar -cf ${testDir}/task.tar -C ${testDir} ${filenames.join(" ")}`
	)
}

export const getAllTestCases = (langdir: string) => {
	const result: string[][] = []

	for (const ent of readdirSync(langdir, { withFileTypes: true })) {
		// Skip files starting with "_"
		if (
			ent.name.startsWith("_") ||
			ent.name.endsWith(".test.ts") ||
			ent.name.endsWith(".tgz")
		) {
			continue
		}
		if (ent.isFile()) {
			const programFile = ent.name
			const programPath = `${langdir}/${programFile}`
			const verdict = verdictFromFilename(programFile)
			result.push([programFile, programPath, verdict])
		}
	}

	return result
}

export const helloWorldTestForLanguage = (dir: string) => {
	const language = basename(dir)
	const outputDir = join(dir, ".errors")
	const testCases = getAllTestCases(dir)
	test.each(testCases)(
		"%s",
		async (programFile, programPath, expectedVerdict) => {
			const testDir = resolve(join(outputDir, programFile))

			await mkdir(testDir, { recursive: true })
			await createHelloWorldTar(dir, testDir, language, programPath)

			// NOTE(pauek):
			// The name "hello_world" we pass here becomes the name of a folder that 'jutge-submit'
			// creates. In the queue, the task folder is shared, and therefore this name is crucial.
			// Here in the tests, 'submitProblem' creates a temporary directory to launch 'jutge-run',
			// so the name is not so important.
			const verdict = await submitProblem("hello_world", testDir)

			expect(verdict).toBe(expectedVerdict)

			// NOTE(pauek):
			// This is reached only if the test passes, since a failed expect throws
			// So we keep directories for failed tests ;)
			await rm(testDir, { recursive: true, force: true })
		}
	)

	// Try to remove the language directory, which will succeed if it is empty
	afterAll(async () => {
		try {
			await rmdir(outputDir)
		} catch (e) {
			// Ignore error if the directory is not empty
		}
	})
}

export const createDriverAndProblem = (dir: string) => async () => {
	await rm(join(TEST_ROOT, ".error"), { force: true, recursive: true })
	await createTarGzFromDirectory(
		`${TEST_ROOT}/driver`,
		join(dir, "driver.tgz")
	)
	await createTarGzFromDirectory(
		`${TEST_ROOT}/problem`,
		join(dir, "problem.tgz")
	)
}

export const removeDriverAndProblem = (dir: string) => async () => {
	await removeFile(`${TEST_ROOT}/driver.tgz`)
	await removeFile(`${TEST_ROOT}/problem.tgz`)
}

export const doHelloWorldTest = (dir: string) => {
	beforeAll(createDriverAndProblem(dir))
	afterAll(removeDriverAndProblem(dir))
	helloWorldTestForLanguage(dir)
}
