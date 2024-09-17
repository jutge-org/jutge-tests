import { expect, test } from "bun:test"
import { readdir } from "fs/promises"
import { expectedVerdict, prepareEnv, submitProblem } from "./jutge-tests"

await prepareEnv()

// Function that returns a stream of directories
const subDirs = async (path: string) =>
  (await readdir(path, { withFileTypes: true }))
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => `${path}/${dirent.name}`)

test("All tests", async () => {
  for (const subdir of await subDirs("tests")) {
    for (const subsubdir of await subDirs(subdir)) {
      const verdict = await submitProblem(subsubdir)
      const expected = await expectedVerdict(subsubdir)
      expect(verdict, `Folder "${subsubdir}" failed test [${verdict} != ${expected}]`).toBe(expected)
    }
  }
})
