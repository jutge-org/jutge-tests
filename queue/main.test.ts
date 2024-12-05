import { afterAll, beforeAll, describe, it, expect } from "bun:test"
import {
	checkWorkerTaskId,
	ensureQueueIsUp,
	prepareWorker,
	queueSendTask,
} from "./utils"
import { settings } from "./settings"
import { mkdtemp } from "fs/promises"
import { $ } from "bun"
import { parse as yamlParse } from "yaml"

describe("queue-tests", async () => {
	let task: any
	let submissionBytes: Uint8Array = new Uint8Array()

	beforeAll(async () => {
		await ensureQueueIsUp()
		await prepareWorker()
		submissionBytes = await Bun.file(`./submission.tar`).bytes()
	})

	/*
	Test 1: We can send a task to the queue while it is empty
	end the task takes around 6 seconds to complete.
	*/

	it("accepts a task", async () => {
		const file = new File([submissionBytes], "submission.tar")
		const taskName = `test-${Date.now()}`
		const response = await queueSendTask(taskName, file)
		expect(response.ok).toBe(true)
		task = await response.json()
		expect(task.id).toBeDefined()
		expect(task.name).toBe(taskName)
	})

	it("writes the task to disk", async () => {
		// Check that the task was written to disk
		const taskPath = `${settings.queue.taskDir}/${task.id}.input.tar`
		const taskFileBytes = await Bun.file(taskPath).bytes()
		expect(taskFileBytes).toEqual(submissionBytes)
	})

	it("assigns a worker", async () => {
		// Check that the worker is occupied with this task
		await Bun.sleep(200)
		await checkWorkerTaskId(1, task.id)
	})

	const longerTimeout = 10000
	it(
		"frees the worker",
		async () => {
			await Bun.sleep(7000) // Wait for it to be processed
			await checkWorkerTaskId(1, null)
		},
		longerTimeout
	)

	it("produces correct output", async () => {
		// Check the output files
		const tmpDir = await mkdtemp(`/tmp/queue-tests-`)
		const outputPath = `${settings.queue.taskDir}/${task.id}.output.tar.gz`
		expect(await Bun.file(outputPath).exists()).toBe(true)
		await $`tar -xzf ${outputPath} -C ${tmpDir}`
		const correction = await Bun.file(`${tmpDir}/correction.yml`).text()
		const { veredict } = yamlParse(correction)
		expect(veredict).toBe("AC")
	})
})
