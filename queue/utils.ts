import boxen from "boxen"
import { Database } from "bun:sqlite"
import { expect } from "bun:test"
import chalk from "chalk"
import { settings } from "./settings"

export const ensureQueueIsUp = async () => {
	const { ok } = await fetch(`${settings.queue.baseUrl}/misc/ping`)
	if (!ok) {
		console.error(
			boxen(`The test queue is not responding.`, { padding: 1 })
		)
		process.exit(1)
	}
}

export const prepareWorkers = async () => {
	console.log(chalk.dim(`Preparing workers...`))
	const queuedb = new Database(settings.database.file, {
		readwrite: true,
		strict: true,
		create: false,
	})
	// queuedb.run("PRAGMA journal_mode = WAL;")

	// Delete all workers
	queuedb.run(`DELETE FROM workers`)
	const empty = queuedb.query(`select * from workers`).all()
	expect(empty).toEqual([])

	// Add one worker which is just localhost
	queuedb.run(
		`INSERT INTO workers VALUES (1, 'jutge', 'localhost', 1, null)`
	)
	const testWorkers = queuedb.query(`select * from workers`).all()
	expect(testWorkers).toEqual([
		{
			id: 1,
			name: "jutge",
			ssh_uri: "localhost",
			enabled: 1,
			task_id: null,
		},
	])
}

export const sendTask = async (file: File) => {
	const formData = new FormData()
	formData.append("name", "test-task")
	formData.append("file", file)
	const basicAuth = Buffer.from(`${settings.queue.username}:${settings.queue.password}`).toString('base64')
	return await fetch(`${settings.queue.baseUrl}/tasks`, {
		method: "PUT",
		headers: {
			"Authorization": `Basic ${basicAuth}`
		},
		body: formData,
	})
}
