import { $, readableStreamToBytes } from "bun"
import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { mkdtemp } from "fs/promises"
import { settings } from "./settings"
import {
    ensureQueueIsUp,
    getVeredictFromTgzFile,
    getWorkerTaskIdTimeout,
    queueSendTask,
    setupWorker,
    waitUntilFileAppears,
} from "./utils"

import Elysia from "elysia"
import { createSubmissionTar } from "../lib/submission"
import { withTmpDir } from "../lib/utils"

describe("One task - one worker", async () => {
    let task: any
    let tmpDir: string
    let submissionFilename: string
    let submissionBytes: Uint8Array = new Uint8Array()

    beforeAll(async () => {
        tmpDir = await mkdtemp(`/tmp/queue-tests-one-task-`)
        submissionFilename = `${tmpDir}/submission.tar`
        await createSubmissionTar(
            settings.dirs.tests,
            "hello-world",
            "P1++",
            "std",
            submissionFilename
        )
        submissionBytes = await Bun.file(submissionFilename).bytes()
        await ensureQueueIsUp()
        await setupWorker()
    })

    afterAll(async () => {
        await $`rm -rf ${tmpDir}`
    })

    /*
	Test 1: We can send a task to the queue while it is empty
	end the task takes around 6 seconds to complete.
	*/

    it("accepts a task", async () => {
        const taskName = `test-${Date.now()}`
        task = await queueSendTask({
            name: taskName,
            file: new File([submissionBytes], "submission.tar"),
            imageId: "cpp",
        })
        expect(task.id).toBeDefined()
        expect(task.name).toBe(taskName)
    })

    it("writes the task to disk", async () => {
        // Check that the task was written to disk
        const taskPath = `${settings.dirs.dat}/tasks/${task.id}.input.tar`
        const taskFileBytes = await Bun.file(taskPath).bytes()
        expect(taskFileBytes).toEqual(submissionBytes)
    })

    it("assigns a worker", async () => {
        // Check that the worker is occupied with this task
        const result = await getWorkerTaskIdTimeout("jutge", task.id)
        expect(result).toBe(true)
    })

    const taskProcessingTimeout = 12000
    it(
        "frees the worker",
        async () => {
            const result = await getWorkerTaskIdTimeout(
                "jutge",
                null,
                taskProcessingTimeout
            )
            expect(result).toBe(true)
        },
        { timeout: taskProcessingTimeout }
    )

    it("produces correct output", async () => {
        const outputPath = `${settings.dirs.dat}/tasks/${task.id}.output.tar.gz`
        await waitUntilFileAppears(outputPath)
        expect(await Bun.file(outputPath).exists()).toBe(true)

        // Check the output files
        const verdict = await getVeredictFromTgzFile(outputPath)
        expect(verdict).toBe("AC")
    })

    it(
        "receives the callback",
        (): Promise<void> => {
            return new Promise((resolve, reject) => {
                const server = new Elysia().put(
                    "/callback",
                    async ({ request }) => {
                        if (request.body !== null) {
                            const bytes = await readableStreamToBytes(
                                request.body
                            )
                            await withTmpDir(async (tmpDir) => {
                                const tgzPath = `${tmpDir}/callback.tgz`
                                await Bun.write(tgzPath, bytes)
                                const verdict = await getVeredictFromTgzFile(
                                    tgzPath
                                )
                                expect(verdict).toBe("AC")
                            })
                        }
                        server.stop()
                        resolve()
                    }
                )
                server.listen(15555)

                const taskName = `test-${Date.now()}`
                queueSendTask({
                    name: taskName,
                    file: new File([submissionBytes], "submission.tar"),
                    imageId: "cpp",
                    callback: "http://localhost:15555/callback",
                })

                const timeToFinishTask = taskProcessingTimeout
                setTimeout(
                    () => reject(`Timeout reached (${timeToFinishTask}ms)`),
                    taskProcessingTimeout
                )
            })
        },
        { timeout: taskProcessingTimeout }
    )
})
