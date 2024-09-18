import { beforeAll, afterAll, describe, expect, test } from "bun:test"
import { createTarGzFromDirectory, pythonEnvCreate, removeFile } from "./jutge"

// For the hello world tests

const helloRoot = "tests/core/hello"
beforeAll(async () => {
  await pythonEnvCreate(["src/toolkit", "src/server-toolkit"])
  createTarGzFromDirectory(`${helloRoot}/driver`)
  createTarGzFromDirectory(`${helloRoot}/problem`)
  console.log("Created driver.tgz and problem.tgz")
})

afterAll(async () => {
  removeFile(`${helloRoot}/driver.tgz`)
  removeFile(`${helloRoot}/problem.tgz`)
  console.log("Removed driver.tgz and problem.tgz")
})
