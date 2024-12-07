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
	let tmpDir: string
	let submissionFilename: string
	let submissionBytes: Uint8Array = new Uint8Array()
	const sentTasks: Task[] = []

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

	test.each([1, 2, 3, 4, 5])("accepts task %i", async (i) => {
		const taskName = `test-${Date.now()}`
		const task = await queueSendTask({
			name: taskName,
			file: new File([submissionBytes], "submission.tar"),
			imageId: "cpp",
		})
		expect(task.id).toBeDefined()
		expect(task.name).toBe(taskName)
		sentTasks.push(task)
	})

	it("registered all tasks", async () => {
		const pendingTasks = queueGetTasksById(sentTasks.map((t) => t.id))
		// The returned objects match
		expect(pendingTasks).toContainValues([
			expect.objectContaining({
				id: expect.any(String),
				name: expect.stringContaining("test-"),
			}),
		])
		for (const ptask of pendingTasks) {
			const sentTaskOrNot = sentTasks.find((t) => t.id === ptask.id)
			expect(sentTaskOrNot).toBeDefined()
			const sentTask: Task = sentTaskOrNot!
			expect(sentTask.id).toBe(ptask.id)
			expect(sentTask.name).toBe(ptask.name)
		}
	})

	test.each([1, 2, 3, 4, 5])('has processed task %i', async (index: number) => {
		const task = sentTasks[index-1]
		while (true) {
			const [processed] = queueGetTasksById([task.id])
			if (processed && processed.state === "completed") {
				break
			}
			await Bun.sleep(500)
		}
	}, { timeout: 10000 })
})