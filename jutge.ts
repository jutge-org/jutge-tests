import { $ } from "bun"
import { expect } from "bun:test"
import { copyFile, mkdir, readdir, rm } from "fs/promises"
import { extname } from "path"
import { parse as yamlParse, stringify as yamlStringify } from "yaml"
import { PYTHON_ENV_DIR } from "./config"

const makeTaskTar = async (taskFolder: string) => {
  for (const part of ["driver", "problem", "submission"]) {
    await $`tar -czf ${part}.tgz -C ${`${taskFolder}/${part}`} .`
  }
  await $`tar -cf ${`${taskFolder}/task.tar`} driver.tgz problem.tgz submission.tgz`
  await $`rm -f driver.tgz problem.tgz submission.tgz`
}

export const pythonEnvRun = async (cmds: string[]) => {
  const script = new Response(["source venv/bin/activate", ...cmds].join("\n"))
  const { stdout, stderr } = await $`cat < ${script} | bash`.quiet()
  return {
    stdout: stdout.toString(),
    stderr: stderr.toString(),
  }
}

export const pythonEnvCreate = async (packages: string[]) => {
  await $`python3 -m venv ${PYTHON_ENV_DIR}`
  await pythonEnvRun(packages.map((pkg) => `pip3 install ${pkg}`))
}

export const pythonEnvDestroy = async () => {
  await $`rm -rf ${PYTHON_ENV_DIR}`
}

export const rVeredict = /<<<< end with veredict (.*) >>>>/

export const submitProblem = async (name: string, folder: string) => {
  await makeTaskTar(folder)

  const { stdout, stderr } = await pythonEnvRun([
    `jutge-run jutge-submit ${name} < ${folder}/task.tar > correction.tgz`,
  ])
  // await Bun.write(`stdout.txt`, stdout)
  // await Bun.write(`stderr.txt`, stderr)

  const match = stderr.match(rVeredict)
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
export const verdictFromFilename = (filename: string) => {
  const match = filename.match(rVerdictFilename)
  if (match === null) {
    throw new Error(`Could not extract veredict from filename: ${filename}`)
  }
  return match[1]
}

export const testProblem = async (problemDir: string, programFile: string) => {
  const verdict = await submitProblem("hello", problemDir)
  const expected = await expectedVerdict(problemDir)
  expect(
    verdict,
    `Program "${programFile}" failed test [${verdict} != ${expected}]`
  ).toBe(expected)
}
