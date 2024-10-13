import { helloWorldTestForLanguage } from "@/hello-world"
import { describe } from "@jest/globals"

describe("hello world PHP", helloWorldTestForLanguage(__dirname))
