import boxen from "boxen"
import { Database } from "bun:sqlite"
import { expect } from "bun:test"
import chalk from "chalk"
import { settings } from "./settings"

export interface Task {
	id: string
	name: string
	state: string
}

const queuedb = new Database(settings.database.file, {
	readwrite: true,
	strict: true,
	create: false,
})

export const ensureQueueIsUp = async () => {
	const { ok } = await fetch(`${settings.queue.baseUrl}/misc/ping`)
	if (!ok) {
		console.error(
			boxen(`The test queue is not responding.`, { padding: 1 })
		)
		process.exit(1)
	}
}

export const setupWorker = async () => {
	console.log(chalk.dim(`Setting up the worker...`))

	// Delete all workers
	queuedb.run(`DELETE FROM workers`)
	const empty = queuedb.query(`select * from workers`).all()
	expect(empty).toEqual([])

	// Add one worker which is just localhost
	queuedb.run(
		`INSERT INTO workers VALUES (1, 'jutge', '${settings.queue.worker.uri}', 1, null)`
	)
	const testWorkers = queuedb.query(`select * from workers`).all()
	expect(testWorkers).toEqual([
		{
			id: 1,
			name: "jutge",
			ssh_uri: settings.queue.worker.uri,
			enabled: 1,
			task_id: null,
		},
	])
}

export const checkWorkerTaskId = async (id: number, taskId: string | null) => {
	const [worker]: any[] = queuedb
		.query(`SELECT * FROM workers WHERE id = ?`)
		.all(id)
	expect(worker.task_id).toBe(taskId)
}

export const queueSendTask = async (name: string, file: File) => {
	const formData = new FormData()
	formData.append("name", name)
	formData.append("file", file)

	const basicAuth = Buffer.from(
		`${settings.queue.username}:${settings.queue.password}`
	).toString("base64")

	return await fetch(`${settings.queue.baseUrl}/tasks`, {
		method: "PUT",
		headers: { Authorization: `Basic ${basicAuth}` },
		body: formData,
	})
}

export const queueGetTasksById = (ids: string[]): Task[] => {
	try {
		return ids.map(id => queuedb.query(`select * from tasks where id = ?`).get(id) as Task)
	} catch (e) {
		return []
	}
}
