import { $ } from "bun"
import { describe, expect, test, beforeAll } from "bun:test"
import { readdir } from "fs/promises"
import { basename, extname } from "path"
import {
  createTarGz,
  createTemporaryDir,
  setSubmissionDetails,
  subDirs,
  submitProblem,
  verdictFromFilename,
} from "../../../jutge"

const outputDir = ".output"
const testRoot = "tests/core/hello"

const getAllTestCases = async () => {
  const result: string[][] = []

  for (const langdir of await subDirs(`${testRoot}/all-languages`)) {
    // Skip directories starting with "_"
    if (langdir.startsWith("_")) {
      continue
    }

    const language = basename(langdir)
    for (const ent of await readdir(langdir, { withFileTypes: true })) {
      // Skip files starting with "_"
      if (ent.name.startsWith("_")) {
        continue
      }
      if (ent.isFile()) {
        const programFile = ent.name
        const programPath = `${langdir}/${programFile}`
        const verdict = verdictFromFilename(programFile)
        result.push([language, programFile, programPath, verdict])
      }
    }
  }

  return result
}

const createHelloWorldTar = async (
  tmpdir: string,
  language: string,
  programFile: string
) => {
  // Create submission.tgz
  const extension = extname(programFile) // This _contains_ the dot '.'
  await createTarGz(`${tmpdir}/submission.tgz`, {
    [`program${extension}`]: await Bun.file(programFile).text(),
    [`submission.yml`]: `compiler_id: ${language}\n`,
  })

  // Copy driver.tgz and problem.tgz
  await $`cp ${`${testRoot}/driver.tgz`} ${tmpdir}`
  await $`cp ${`${testRoot}/problem.tgz`} ${tmpdir}`

  // Create task.tar with driver.tgz, problem.tgz and submission.tgz
  await $`tar -cf ${`${tmpdir}/task.tar`} -C ${tmpdir} driver.tgz problem.tgz submission.tgz`
}

const cases = await getAllTestCases()

describe("Hello world", async () => {
  test.each(cases)(
    "%s (%s)",
    async (language, _programFile, programPath, expectedVerdict) => {
      const tmpdir = `${outputDir}/${language}/${programPath}.dir`
      await $`mkdir -p ${tmpdir}`
      await createHelloWorldTar(tmpdir, language, programPath)
      const verdict = await submitProblem("hello_world", tmpdir)
      expect(verdict).toBe(expectedVerdict)
      // TODO: Retrieve 'correction.tgz' (for what?)
    }
  )
})
