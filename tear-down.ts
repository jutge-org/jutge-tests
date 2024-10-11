import { PYTHON_ENV_DIR } from "./config"
import { removePath } from "./jutge"

const helloRoot = "tests/core/hello-world"

export default function TearDown() {
  removePath(`${helloRoot}/driver.tgz`)
  removePath(`${helloRoot}/problem.tgz`)
  // This takes quite a bit of time to create... so we don't want to remove it
  // removePath(PYTHON_ENV_DIR)
}
