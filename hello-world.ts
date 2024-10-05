import { createTarGz, submitProblem, verdictFromFilename } from "@/jutge"
import { expect, test } from "@jest/globals"
import { execSync } from "child_process"
import * as fs from "fs"
import { basename, dirname, extname, join, resolve } from "path"

export const helloWorldTestForLanguage = (langdir: string) => () => {
  const outputDir = ".errors/hello"
  const language = basename(langdir)
  const testRoot = dirname(dirname(langdir))

  const getAllTestCases = () => {
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
    testDir: string,
    tmpDir: string,
    language: string,
    programFile: string
  ) => {
    // Create submission.tgz
    const extension = extname(programFile) // This _contains_ the dot '.'
    createTarGz(`${testDir}/submission.tgz`, {
      [`program${extension}`]: fs.readFileSync(programFile).toString(),
      [`submission.yml`]: `compiler_id: ${language}\n`,
    })

    // Copy driver.tgz and problem.tgz
    fs.copyFileSync(`${testRoot}/driver.tgz`, `${testDir}/driver.tgz`)
    fs.copyFileSync(`${testRoot}/problem.tgz`, `${testDir}/problem.tgz`)

    // Create task.tar with driver.tgz, problem.tgz and submission.tgz
    execSync(
      `tar -cf ${tmpDir}/task.tar -C ${testDir} driver.tgz problem.tgz submission.tgz`
    )
  }

  const cases = getAllTestCases()
  test.concurrent.each(cases)(
    "%s",
    async (programFile, programPath, expectedVerdict) => {
      const tmpDir = fs.mkdtempSync("/tmp/jutge-")
      const testDir = resolve(join(outputDir, language, programFile))

      fs.mkdirSync(testDir, { recursive: true })
      createHelloWorldTar(testDir, tmpDir, language, programPath)

      // NOTE(pauek):
      // The name "hello_world" we pass here becomes the name of a folder that 'jutge-submit'
      // creates. In the queue, the task folder is shared, and therefore this name is crucial.
      // Here in the tests, 'submitProblem' creates a temporary directory to launch 'jutge-run',
      // so the name is not so important.
      const verdict = submitProblem("hello_world", testDir, tmpDir)

      expect(verdict).toBe(expectedVerdict)

      // NOTE(pauek):
      // This is reached only if the test passes, since a failed expect throws
      // So we keep directories for failed tests ;)
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  )

  // Try to remove the language directory, which will succeed if it is empty
  afterAll(() => {
    try {
      fs.rmdirSync(join(outputDir, language))
    } catch (e) {
      // Ignore error if the directory is not empty
    }
  })
}
