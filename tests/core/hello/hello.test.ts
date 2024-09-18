import { beforeAll, describe, test } from "bun:test"
import { readdir } from "fs/promises"
import { basename } from "path"
import {
  pythonEnvCreate,
  setSubmissionDetails,
  subDirs,
  testProblem,
  verdictFromFilename,
} from "../../../jutge"

const root = "tests/core/hello"

const getAllTestCases = async () => {
  const result: string[][] = []

  for (const langdir of await subDirs(`${root}/all-languages`)) {
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
        result.push([language, programPath, verdict])
      }
    }
  }

  return result
}

const cases = await getAllTestCases()

beforeAll(async () => {
  await pythonEnvCreate(["src/toolkit", "src/server-toolkit"])
})

describe("Hello world", async () => {
  test.each(cases)("%p (%p)", async (language, programPath, verdict) => {
    await setSubmissionDetails(root, programPath, language, verdict)
    await testProblem(root, programPath)
  })
})
