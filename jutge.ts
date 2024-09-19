import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs"
import { execSync, spawnSync } from "node:child_process"
import { dirname, extname, join } from "path"
import { parse as yamlParse, stringify as yamlStringify } from "yaml"
import { PYTHON_ENV_DIR } from "./config"

export const makeTaskTar = async (taskFolder: string) => {
  for (const part of ["driver", "problem", "submission"]) {
    execSync(`tar -czf ${part}.tgz -C ${`${taskFolder}/${part}`} .`)
  }
  execSync(
    `tar -cf ${`${taskFolder}/task.tar`} driver.tgz problem.tgz submission.tgz`
  )
  execSync(`rm -f driver.tgz problem.tgz submission.tgz`)
}

export const pythonEnvRun = (cmds: string[]) => {
  const script = ["source venv/bin/activate", ...cmds].join("; ")
  const { stdout, stderr } = spawnSync("bash", ["-c", `${script}`])
  return { stdout: stdout.toString(), stderr: stderr.toString() }
}

export const pythonEnvCreate = (packages: string[]) => {
  execSync(`python3 -m venv ${PYTHON_ENV_DIR}`)
  pythonEnvRun(packages.map((pkg) => `pip3 install ${pkg}`))
}

export const pythonEnvDestroy = () => {
  rmSync(PYTHON_ENV_DIR, { recursive: true, force: true })
}

export const rVeredict = /<<<< end with veredict (.*) >>>>/

export const submitProblem = (
  name: string,
  testDir: string,
  tmpDir: string
) => {
  const { stdout, stderr } = pythonEnvRun([
    `cd ${tmpDir}`, // Change to temporary, empty directory since 'jutge-run' will use it as the shared volue
    `jutge-run jutge-submit ${name} < ${tmpDir}/task.tar > ${testDir}/correction.tgz`,
  ])

  writeFileSync(`${testDir}/stdout.txt`, stdout)
  writeFileSync(`${testDir}/stderr.txt`, stderr)

  const match = stderr.match(rVeredict)
  if (!match) {
    throw new Error("No veredict found")
  }
  return match[1]
}

export const expectedVerdict = async (folder: string) =>
  readFileSync(`${folder}/.verdict`).toString().trim()

export const readYml = (path: string) => {
  try {
    const buf = readFileSync(path)
    return yamlParse(buf.toString())
  } catch (e) {
    return ""
  }
}

export const writeYml = async (path: string, obj: Record<string, any>) =>
  writeFileSync(path, yamlStringify(obj))

export const editYml = async (
  path: string,
  fn: (obj: Record<string, any>) => Record<string, any>
) => {
  const obj = await readYml(path)
  await writeYml(path, fn(obj))
}

export const subDirs = async (path: string) =>
  readdirSync(path, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => `${path}/${dirent.name}`)

export const setSubmissionDetails = async (
  taskFolder: string,
  programFile: string,
  language: string,
  verdict: string
) => {
  rmSync(`${taskFolder}/submission`, { recursive: true, force: true })
  mkdirSync(`${taskFolder}/submission`)
  const extension = extname(programFile)
  copyFileSync(programFile, `${taskFolder}/submission/program${extension}`)
  editYml(`${taskFolder}/submission/submission.yml`, (config) => ({
    ...config,
    compiler_id: language,
  }))
  writeFileSync(`${taskFolder}/.verdict`, verdict)
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
export const createTarGzFromDirectory = (dir: string) => {
  execSync(`tar -czf ${`${dir}.tgz`} -C ${dir} .`)
}

export const removeFile = (path: string) => {
  rmSync(path, { recursive: true, force: true })
}

export const createTemporaryDir = (prefix: string) => mkdtempSync(prefix)

type FileContents = string
export type TarFiles = {
  [filename: string]: FileContents
}
export const createTarGz = (path: string, files: TarFiles) => {
  const dir = dirname(path)
  mkdirSync(join(dir, "submission"), { recursive: true })
  for (const [filename, contents] of Object.entries(files)) {
    writeFileSync(join(dir, "submission", filename), contents)
  }
  execSync(
    `tar -czf ${path} -C ${join(dir, "submission")} ${Object.keys(files).join(
      " "
    )}`
  )
}

export const createTar = (
  destination: string,
  rootDir: string,
  localFiles: string[]
) => execSync(`tar -cf ${destination} -C ${rootDir} ${localFiles}`)
