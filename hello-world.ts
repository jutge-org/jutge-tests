import { createTarGz, submitProblem, verdictFromFilename } from "@/jutge"
import { expect, test } from "@jest/globals"
import { execSync } from "child_process"
import * as fs from "fs"
import { basename, dirname, extname, join, resolve } from "path"

const WORK_DIR = ".errors/hello"

const getAllTestCases = (langdir: string) => {
  const result: string[][] = []

  for (const ent of fs.readdirSync(langdir, { withFileTypes: true })) {
    // Skip files starting with "_"
    if (ent.name.startsWith("_") || ent.name.endsWith(".test.ts")) {
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

const createHelloWorldTar = (
  testRoot: string,
  workDir: string,
  language: string,
  programFile: string
) => {
  // Create submission.tgz
  const extension = extname(programFile) // This _contains_ the dot '.'
  createTarGz(`${workDir}/submission.tgz`, {
    [`program${extension}`]: fs.readFileSync(programFile).toString(),
    [`submission.yml`]: `compiler_id: ${language}\n`,
  })

  // Copy driver.tgz and problem.tgz
  fs.copyFileSync(`${testRoot}/driver.tgz`, `${workDir}/driver.tgz`)
  fs.copyFileSync(`${testRoot}/problem.tgz`, `${workDir}/problem.tgz`)

  // Create task.tar with driver.tgz, problem.tgz and submission.tgz
  execSync(
    `tar -cf ${workDir}/task.tar -C ${workDir} driver.tgz problem.tgz submission.tgz`
  )
}

const testLanguageSubmission =
  (testRoot: string, language: string) =>
  (programFile: string, programPath: string, expectedVerdict: string) => {
    const workDir = resolve(join(WORK_DIR, language, programFile)) // NOTE(pauek): Yes, a directory with the same name as the file
    fs.mkdirSync(workDir, { recursive: true })

    createHelloWorldTar(testRoot, workDir, language, programPath)

    // NOTE(pauek):
    // The name "hello_world" we pass here becomes the name of a folder that 'jutge-submit'
    // creates. In the queue, the task folder is shared, and therefore this name is crucial.
    // Here in the tests, 'submitProblem' creates a temporary directory to launch 'jutge-run',
    // so the name is not so important.
    const verdict = submitProblem("hello_world", workDir)

    expect(verdict).toBe(expectedVerdict)

    // NOTE(pauek):
    // This is reached only if the test passes, since a failed expect throws
    // So we keep directories for failed tests ;)
    fs.rmSync(workDir, { recursive: true, force: true })
  }

export const helloWorldTestForLanguage = (langdir: string) => () => {
  const language = basename(langdir)
  const testRoot = dirname(dirname(langdir))

  const cases = getAllTestCases(langdir)
  test.each(cases)("%s", testLanguageSubmission(testRoot, language))

  // Try to remove the language directory, which will succeed if it is empty
  afterAll(() => {
    try {
      fs.rmdirSync(join(WORK_DIR, language))
    } catch (e) {
      // Ignore error if the directory is not empty
    }
  })
}
