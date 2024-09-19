import { helloWorldTestForLanguage } from "@/hello-world"
import { describe } from "@jest/globals"

describe("hello world zig", helloWorldTestForLanguage(__dirname))
