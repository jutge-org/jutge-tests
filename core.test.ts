import { $ } from "bun"
import { expect, test } from "bun:test"
import { copyFile, mkdir, readdir, rm } from "fs/promises"
import { basename, extname } from "path"
import { parse as yamlParse, stringify as yamlStringify } from "yaml"

const makeTaskTar = async (taskFolder: string) => {
  for (const part of ["driver", "problem", "submission"]) {
    await $`tar -czf ${part}.tgz -C ${`${taskFolder}/${part}`} .`
  }
  await $`tar -cf ${`${taskFolder}/task.tar`} driver.tgz problem.tgz submission.tgz`
  await $`rm -f driver.tgz problem.tgz submission.tgz`
}

const pythonEnvCreate = async () => {
  await $`python3 -m venv venv`
}

const pythonEnvRun = async (cmds: string[]) => {
  const script = new Response(["source venv/bin/activate", ...cmds].join("\n"))
  const { stderr } = await $`cat < ${script} | bash`.quiet()
  return stderr.toString()
}

export const prepareEnv = async () => {
  // await $`make -C src/dockerfiles server`;
  console.log(`Make tar...`)
  console.log(`Create python environment`)
  await pythonEnvCreate()
  console.log(`Install toolkits`)
  await pythonEnvRun([
    "pip3 install src/toolkit",
    "pip3 install src/server-toolkit",
  ])
}

const rVeredict = /<<<< end with veredict (.*) >>>>/

export const submitProblem = async (name: string, folder: string) => {
  await makeTaskTar(folder)

  const output = await pythonEnvRun([
    `jutge-run jutge-submit ${name} < ${folder}/task.tar > correction.tgz`,
  ])
  await Bun.write(`output.txt`, output)
  const match = output.match(rVeredict)
  if (match === null) {
    throw new Error("No veredict found")
  }
  return match[1]
}

export const expectedVerdict = async (folder: string) =>
  (await Bun.file(`${folder}/.verdict`).text()).trim()

export const readYml = async (path: string) => {
  try {
    return yamlParse(await Bun.file(path).text())
  } catch (e) {
    return ""
  }
}

export const writeYml = async (path: string, obj: Record<string, any>) =>
  await Bun.write(path, yamlStringify(obj))

export const editYml = async (
  path: string,
  fn: (obj: Record<string, any>) => Record<string, any>
) => {
  const obj = await readYml(path)
  await writeYml(path, fn(obj))
}

export const subDirs = async (path: string) =>
  (await readdir(path, { withFileTypes: true }))
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => `${path}/${dirent.name}`)

export const setSubmissionDetails = async (
  taskFolder: string,
  programFile: string,
  language: string,
  verdict: string
) => {
  await rm(`${taskFolder}/submission`, { recursive: true, force: true })
  await mkdir(`${taskFolder}/submission`)
  const extension = extname(programFile)
  await copyFile(programFile, `${taskFolder}/submission/program${extension}`)
  await editYml(`${taskFolder}/submission/submission.yml`, (config) => ({
    ...config,
    compiler_id: language,
  }))
  await Bun.write(`${taskFolder}/.verdict`, verdict)
}

const rVerdictFilename = /^(\w+)(-.*)?\..*$/
const verdictFromFilename = (filename: string) => {
  const match = filename.match(rVerdictFilename)
  if (match === null) {
    throw new Error(`Could not extract veredict from filename: ${filename}`)
  }
  return match[1]
}

const testProblem = async (problemDir: string, programFile: string) => {
  const verdict = await submitProblem("hello", problemDir)
  const expected = await expectedVerdict(problemDir)
  expect(
    verdict,
    `Program "${programFile}" failed test [${verdict} != ${expected}]`
  ).toBe(expected)
}

////////////////////////////////////////////////////////////////////////////////

await prepareEnv()

const root = "tests/core/00-hello"
for (const langdir of await subDirs(`${root}/all-languages`)) {
  for (const ent of await readdir(langdir, { withFileTypes: true })) {
    // Skip files starting with "_"
    if (ent.name.startsWith("_")) {
      continue
    }
    if (ent.isFile()) {
      const programFile = ent.name
      const language = basename(langdir)
      const programPath = `${langdir}/${programFile}`

      // NOTE(pauek): The name of the file is the veredict that it should have
      const verdict = verdictFromFilename(programFile)
      await setSubmissionDetails(root, programPath, language, verdict)

      test(`Hello world in ${language} (${programFile})`, async () => {
        await testProblem(root, `${langdir}/${programFile}`)
      })
    }
  }
}

