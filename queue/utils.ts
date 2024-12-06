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

const openQueueDatabase = () => {
	try {
		const db = new Database(settings.database.file, {
			readwrite: true,
			strict: true,
			create: false,
		})
		return db
	} catch (e: any) {
		console.error(
			boxen(
				`Can't open database ${
					settings.database.file
				}.\n${e.toString()}`,
				{
					padding: 1,
				}
			)
		)
		process.exit(1)
	}
}

const queuedb = openQueueDatabase()

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

export const queueCallEndpoint = async (method: string, path: string) => {
	const response = await fetch(`${settings.queue.baseUrl}${path}`, {
		method,
		headers: {
			Authorization: `Basic ${Buffer.from(
				`${settings.queue.username}:${settings.queue.password}`
			).toString("base64")}`,
		},
	})
	return await response.json()
}

export const getWorkerTaskIdChangeTimeout = async (
	workerName: string,
	timeout: number = 10000
) => {
	// Wait until the worker has a task_id
	const start = performance.now()
	const { task_id: initialTaskId } = await queueCallEndpoint(
		"GET",
		`/workers/${workerName}`
	)
	while (true) {
		const { task_id } = await queueCallEndpoint(
			"GET",
			`/workers/${workerName}`
		)
		if (task_id !== initialTaskId) {
			return task_id
		} else if (performance.now() - start > timeout) {
			return task_id
		}
		await Bun.sleep(400)
	}
}

export const waitUntilFileAppears = async (path: string, timeout: number = 1000) => {
	const start = performance.now()
	while (true) {
		if (await Bun.file(path).exists()) {
			return
		}
		await Bun.sleep(400)
		if (performance.now() - start > timeout) {
			throw new Error(`File ${path} did not appear in ${timeout}ms`)
		}
	}
}

interface QueueSendTask {
	name: string
	file: File
	imageId: string
}
export const queueSendTask = async ({ name, file, imageId }: QueueSendTask) => {
	const formData = new FormData()
	formData.append("name", name)
	formData.append("file", file)
	formData.append("image_id", imageId)

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
		return ids.map(
			(id) =>
				queuedb
					.query(`select * from tasks where id = ?`)
					.get(id) as Task
		)
	} catch (e) {
		return []
	}
}
