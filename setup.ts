import { createTarGzFromDirectory, pythonEnvCreate } from "./jutge"
import * as fs from "fs"

const helloRoot = "./tests/core/hello-world"

export default function Setup() {
  fs.rmSync(`.errors`, { force: true, recursive: true })
  pythonEnvCreate([
    "./dockerfiles/jutge-toolkit",
    "./dockerfiles/jutge-server-toolkit",
  ])
  createTarGzFromDirectory("driver", `${helloRoot}/driver/std`)
  createTarGzFromDirectory("problem", `${helloRoot}/problem`)
  fs.renameSync(`driver.tgz`, `${helloRoot}/driver.tgz`)
  fs.renameSync(`problem.tgz`, `${helloRoot}/problem.tgz`)
}
