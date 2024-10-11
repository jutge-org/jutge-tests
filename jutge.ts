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

export const makeTaskTar = (taskFolder: string) => {
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

export const submitProblem = (name: string, dir: string) => {
  pythonEnvRun([
    `jutge-run jutge-submit ${name} < ${dir}/task.tar > ${dir}/correction.tgz`,
  ])

  // Decompress correction
  extractTarGz(`${dir}/correction.tgz`, `${dir}/correction`)

  try {
    const correctionInfo: Record<string, any> = readYml(`${dir}/correction/correction.yml`)
    return correctionInfo.veredict // NOTE(pauek): change "ver[e]dict" to "verdict" everywhere
  } catch (e) {
    throw new Error(`Could not read correction file: ${e}`)
  }
}

export const expectedVerdict = (folder: string) =>
  readFileSync(`${folder}/.verdict`).toString().trim()

export const readYml = (path: string) => {
  try {
    const buf = readFileSync(path)
    return yamlParse(buf.toString())
  } catch (e) {
    return ""
  }
}

export const writeYml = (path: string, obj: Record<string, any>) =>
  writeFileSync(path, yamlStringify(obj))

export const editYml = (
  path: string,
  fn: (obj: Record<string, any>) => Record<string, any>
) => {
  const obj = readYml(path)
  writeYml(path, fn(obj))
}

export const subDirs = (path: string) =>
  readdirSync(path, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => `${path}/${dirent.name}`)

export const setSubmissionDetails = (
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

export const extractTarGz = (path: string, destination: string) => {
  mkdirSync(destination, { recursive: true })
  execSync(`tar -xzf ${path} -C ${destination}`)
}

export const removePath = (path: string) => {
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
  const filenames = Object.keys(files).join(" ")
  execSync(`tar -czf ${path} -C ${join(dir, "submission")} ${filenames}`)
}

export const createTar = (
  destination: string,
  rootDir: string,
  localFiles: string[]
) => execSync(`tar -cf ${destination} -C ${rootDir} ${localFiles}`)
