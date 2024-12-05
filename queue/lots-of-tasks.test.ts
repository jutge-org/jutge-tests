import { beforeAll, describe, expect, it } from "bun:test"
import type { Task } from "./utils"
import {
	ensureQueueIsUp,
	queueGetTasksById,
	queueSendTask,
	setupWorker,
} from "./utils"

describe("Lots of tasks - one worker", async () => {
	const numTasks = 5

	let sentTasks: Task[] = []
	let submissionBytes: Uint8Array = new Uint8Array()

	beforeAll(async () => {
		await ensureQueueIsUp()
		await setupWorker()
		submissionBytes = await Bun.file(`./submission.tar`).bytes()
	})

	/*
	Test 1: We can send a task to the queue while it is empty
	end the task takes around 6 seconds to complete.
	*/

	const moreTime = 6000
	it(
		"accepts all tasks",
		async () => {
			const file = new File([submissionBytes], "submission.tar")
			for (let i = 0; i < numTasks; i++) {
				const taskName = `test-${Date.now()}`
				const response = await queueSendTask(taskName, file)
				expect(response.ok).toBe(true)
				const task = await response.json()
				expect(task.id).toBeDefined()
				expect(task.name).toBe(taskName)
				sentTasks.push(task)
			}
		},
		moreTime
	)

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

	const checkTask = async (index: number) => {
		const task = sentTasks[index]
		while (true) {
			const [processed] = queueGetTasksById([task.id])
			if (processed && processed.state === "completed") {
				break
			}
			await Bun.sleep(500)
		}
	}

	const taskTime = 8000
	it(`has processed task 1`, async () => checkTask(0), taskTime)
	it(`has processed task 2`, async () => checkTask(1), taskTime)
	it(`has processed task 3`, async () => checkTask(2), taskTime)
	it(`has processed task 4`, async () => checkTask(3), taskTime)
	it(`has processed task 5`, async () => checkTask(4), taskTime)
})
