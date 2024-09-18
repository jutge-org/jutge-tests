import { createTarGzFromDirectory, pythonEnvCreate } from "./jutge"
import { rmSync } from "fs"

const helloRoot = "tests/core/hello-world"

export default function Setup() {
  rmSync(`.errors`, { force: true, recursive: true })
  pythonEnvCreate(["src/toolkit", "src/server-toolkit"])
  createTarGzFromDirectory(`${helloRoot}/driver`)
  createTarGzFromDirectory(`${helloRoot}/problem`)
}