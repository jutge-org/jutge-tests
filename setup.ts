import { pythonEnvCreate } from "./tests/core/hello-world/hello-world"

export default () => {
	pythonEnvCreate(["src/toolkit", "src/server-toolkit"])
}
