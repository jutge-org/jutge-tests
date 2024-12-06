import { $ } from "bun"
import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { mkdtemp } from "fs/promises"
import { parse as yamlParse } from "yaml"
import { settings } from "./settings"
import {
	ensureQueueIsUp,
	getWorkerTaskIdChangeTimeout,
	queueSendTask,
	setupWorker,
	waitUntilFileAppears
} from "./utils"

import { createSubmissionTar } from '../lib/submission'
import chalk from "chalk"

describe("Big file task", async () => {
	let task: any
	let tmpDir : string
	let submissionFilename: string
	let submissionBytes: Uint8Array = new Uint8Array()
	
	beforeAll(async () => {
		tmpDir = await mkdtemp(`/tmp/queue-tests-one-task-`)
		submissionFilename = `${tmpDir}/submission.tar`
		console.log(chalk.dim(`Creating big submission file...`))
		await createSubmissionTar(settings.dirs.tests, 'huge-files', 'G++', 'std', submissionFilename)
		console.log(chalk.dim(`Submission file created`))
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

	it("accepts the task", async () => {
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
	})

	it("writes the task to disk", async () => {
		// Check that the task was written to disk
		const taskPath = `${settings.dirs.dat}/tasks/${task.id}.input.tar`
		const taskFileBytes = await Bun.file(taskPath).bytes()
		expect(taskFileBytes).toEqual(submissionBytes)
	})

	it("assigns a worker", async () => {
		// Check that the worker is occupied with this task
		const taskId = await getWorkerTaskIdChangeTimeout("jutge")
		expect(taskId).toBe(task.id)
	})

	it(
		"frees the worker",
		async () => {
			const taskId = await getWorkerTaskIdChangeTimeout("jutge")
			expect(taskId).toBe(null)
		},
		{ timeout: 30_000 }
	)

	it("produces correct output", async () => {
		const outputPath = `${settings.dirs.dat}/tasks/${task.id}.output.tar.gz`
		await waitUntilFileAppears(outputPath)

		// Check the output files
		const tmpDir = await mkdtemp(`/tmp/queue-tests-`)
		expect(await Bun.file(outputPath).exists()).toBe(true)
		await $`tar -xzf ${outputPath} -C ${tmpDir}`
		const correction = await Bun.file(`${tmpDir}/correction.yml`).text()
		const { veredict } = yamlParse(correction)
		expect(veredict).toBe("AC")
	})
})
