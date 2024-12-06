import { $ } from "bun"
import { afterAll, beforeAll, describe, expect, it, test } from "bun:test"
import { mkdtemp } from "fs/promises"
import { createSubmissionTar } from "../lib/submission"
import { settings } from "./settings"
import type { Task } from "./utils"
import {
	ensureQueueIsUp,
	queueGetTasksById,
	queueSendTask,
	setupWorker,
} from "./utils"

describe("Many tasks - one worker", async () => {
	let task: Task
	let tmpDir: string
	let submissionFilename: string
	let submissionBytes: Uint8Array = new Uint8Array()
	const sentTasks: Task[] = []

	beforeAll(async () => {
		tmpDir = await mkdtemp(`/tmp/queue-tests-one-task-`)
		submissionFilename = `${tmpDir}/submission.tar`
		await createSubmissionTar(
			settings.dirs.tests,
			"huge-files",
			"G++",
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

	it("accepts task with big file", async (i) => {
		const taskName = `test-${Date.now()}`
		const response = await queueSendTask({
			name: taskName,
			file: new File([submissionBytes], "submission.tar"),
			imageId: "cpp",
		})
		expect(response.ok).toBe(true)
		task = await response.json()
		expect(task.id).toBeDefined()
		expect(task.name).toBe(taskName)
		sentTasks.push(task)
	})


	it('has processed task with big file', async () => {
		while (true) {
			const [processed] = queueGetTasksById([task.id])
			if (processed && processed.state === "completed") {
				break
			}
			await Bun.sleep(500)
		}
	}, { timeout: 10000 })
})
