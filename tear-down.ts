import { removeFile } from "./jutge"

const helloRoot = "tests/core/hello-world"

export default function TearDown() {
  removeFile(`${helloRoot}/driver.tgz`)
  removeFile(`${helloRoot}/problem.tgz`)
}
