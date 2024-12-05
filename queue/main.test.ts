import { afterAll, beforeAll, describe, it } from "bun:test"
import { ensureQueueIsUp, prepareWorkers, sendTask } from "./utils"

describe("queue-tests", async () => {
	beforeAll(async () => {
		await ensureQueueIsUp()
		await prepareWorkers()
	})

	it('accepts a task', async () => {
		const bytes = await Bun.file(`./submission.tar`).bytes()
		const file = new File([bytes], 'submission.tar')
		const response = await sendTask(file)

		if (!response.ok) {
			const result = await response.json()
			console.error(result)
		}
		const result = await response.json()
		console.log(result)
	})

	afterAll(async () => {
	})
})
