import { readableStreamToBytes } from "bun"
import { afterAll, beforeAll, describe, expect, test, it } from "bun:test"
import Elysia from "elysia"
import { readdir } from "fs/promises"
import { basename, join } from "path"
import { createSubmissionTarFromPath } from "../lib/submission"
import { withTmpDir } from "../lib/utils"
import { settings } from "./settings"
import {
    ensureQueueIsUp,
    getVeredictFromTgzFile,
    queueSendTask,
    setupWorker,
    waitUntilTaskCompleted,
    yamlParseFile,
} from "./utils"

interface TestProblem {
    problem: string
    language: string
    index: number
    codePath: string
    imageId: string
}

const possibleVeredicts = ["AC", "WA", "PE", "CE", "SE", "EE", "IC"]

const enumerateTests = async function* (): AsyncGenerator<TestProblem> {
    const root = join(settings.dirs.tests, "tests")
    for (const entProb of await readdir(root, {
        withFileTypes: true,
    })) {
        if (entProb.isDirectory() && !entProb.name.startsWith("_")) {
            const problemDir = join(root, entProb.name)
            const languagesDir = join(problemDir, "languages")
            for (const entLang of await readdir(languagesDir, {
                withFileTypes: true,
            })) {
                if (entLang.isDirectory() && !entLang.name.startsWith("_")) {
                    const langDir = join(languagesDir, entLang.name)
                    const { imageName: imageId } = await yamlParseFile(
                        join(langDir, "image.yml")
                    )
                    let index = 1
                    for (const entCode of await readdir(langDir, {
                        withFileTypes: true,
                    })) {
                        if (
                            entCode.isFile() &&
                            possibleVeredicts.includes(
                                entCode.name.slice(0, 2)
                            ) &&
                            !entCode.name.endsWith(".test.ts") &&
                            !entCode.name.endsWith(".yml")
                        ) {
                            yield {
                                problem: entProb.name,
                                language: entLang.name,
                                index,
                                codePath: join(langDir, entCode.name),
                                imageId,
                            }
                            index++
                        }
                    }
                }
            }
        }
    }
}

describe("All test problems", async () => {
    beforeAll(async () => {
        await ensureQueueIsUp()
        await setupWorker()
    })

    const allTests: Array<string[]> = []
    for await (const test of enumerateTests()) {
        const { problem, language, index, codePath, imageId } = test
        const verdict = basename(codePath).slice(0, 2)
        allTests.push([
            problem,
            language,
            String(index),
            verdict,
            codePath,
            imageId,
        ])
    }

    const taskProcessingTimeout = 30_000
    const serverPort = 15555

    // send task, put verdict, receive callback, remove if correct
    const verdictMap: Map<string, string> = new Map()

    const server = new Elysia().put(
        "/callback/:taskname",
        async ({ request, params: { taskname } }) => {
            if (request.body !== null) {
                const bytes = await readableStreamToBytes(request.body)
                await withTmpDir(async (tmpDir) => {
                    const tgzPath = `${tmpDir}/callback.tgz`
                    await Bun.write(tgzPath, bytes)
                    const verdict = await getVeredictFromTgzFile(tgzPath)
                    verdictMap.set(taskname, verdict)
                })
            }
        }
    )

    beforeAll(async () => {
        server.listen(serverPort)
    })

    afterAll(async () => {
        await server.stop()
    })

    test.each(allTests)(
        "%s - %s - %s (%s)",
        async (
            problem,
            language,
            _1,
            expectedVerdict,
            codePath,
            imageId
        ): Promise<void> => {
            await withTmpDir(async (tmpDir) => {
                const submissionTar = `${tmpDir}/submission.tar`
                await createSubmissionTarFromPath(
                    codePath,
                    settings.dirs.tests,
                    problem,
                    language,
                    "std",
                    submissionTar
                )
                const taskName = `test-${Date.now()}`
                const bytes = await Bun.file(submissionTar).bytes()

                const task = await queueSendTask({
                    name: taskName,
                    file: new File([bytes], "submission.tar"),
                    imageId,
                    callback: `http://localhost:${serverPort}/callback/${taskName}`,
                })

                await waitUntilTaskCompleted(task.id, taskProcessingTimeout)

                const verdict = verdictMap.get(taskName)
                expect(verdict).toBe(expectedVerdict)
                verdictMap.delete(taskName)
            })
        },
        { timeout: taskProcessingTimeout }
    )

    it("all tests were run", async () => {
        expect(verdictMap).toBeEmpty()
    })
})
