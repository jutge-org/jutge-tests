import { $ } from "bun"

const makeTaskTar = async (folder: string) => {
  for (const part of ["driver", "problem", "submission"]) {
    await $`tar -czf ${part}.tgz -C ${folder}/${part} .`
  }
  await $`tar -cf ${folder}/task.tar driver.tgz problem.tgz submission.tgz`
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

export const submitProblem = async (folder: string) => {
  await makeTaskTar("tests/00-core/00-hello")

  const output = await pythonEnvRun([
    `jutge-run jutge-submit ${folder} < ${folder}/task.tar > correction.tgz`,
  ])
  const match = output.match(rVeredict)
  if (match === null) {
    throw new Error("No veredict found")
  }
  return match[1]
}

export const expectedVerdict = async (folder: string) =>
  await Bun.file(`${folder}/.verdict`).text()
