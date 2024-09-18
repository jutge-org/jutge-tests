import { helloWorldTestForLanguage } from "@/hello-world"
import { describe } from "@jest/globals"

describe("hello world chicken scheme", helloWorldTestForLanguage(__dirname))
