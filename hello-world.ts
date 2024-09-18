import { createTarGz, submitProblem, verdictFromFilename } from "@/jutge"
import { execSync } from "child_process"
import { copyFileSync, mkdirSync, readdirSync, rmSync, readFileSync } from "fs"
import { basename, dirname, extname } from "path"

export const helloWorldTestForLanguage = (langdir: string) => () => {
  const outputDir = ".errors/hello"
  const language = basename(langdir)
  const testRoot = dirname(dirname(langdir))

  const getAllTestCases = () => {
    const result: string[][] = []

    for (const ent of readdirSync(langdir, { withFileTypes: true })) {
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
    tmpdir: string,
    language: string,
    programFile: string
  ) => {
    // Create submission.tgz
    const extension = extname(programFile) // This _contains_ the dot '.'
    createTarGz(`${tmpdir}/submission.tgz`, {
      [`program${extension}`]: readFileSync(programFile).toString(),
      [`submission.yml`]: `compiler_id: ${language}\n`,
    })

    // Copy driver.tgz and problem.tgz
    copyFileSync(`${testRoot}/driver.tgz`, `${tmpdir}/driver.tgz`)
    copyFileSync(`${testRoot}/problem.tgz`, `${tmpdir}/problem.tgz`)

    // Create task.tar with driver.tgz, problem.tgz and submission.tgz
    execSync(
      `tar -cf ${tmpdir}/task.tar -C ${tmpdir} driver.tgz problem.tgz submission.tgz`
    )
  }

  const cases = getAllTestCases()
  test.concurrent.each(cases)(
    "%s",
    (programFile, programPath, expectedVerdict) => {
      const tmpdir = `${outputDir}/${language}/${programFile}`
      mkdirSync(tmpdir, { recursive: true })
      createHelloWorldTar(tmpdir, language, programPath)
      const verdict = submitProblem("hello_world", tmpdir)
      expect(verdict).toBe(expectedVerdict)

      // NOTE(pauek):
      // This is reached only if the test passes, since a failed expect throws
      // So we keep directories for failed tests ;)
      rmSync(tmpdir, { recursive: true, force: true })
    }
  )
}
