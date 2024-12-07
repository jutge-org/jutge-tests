import boxen from "boxen"
import { Database } from "bun:sqlite"
import { expect } from "bun:test"
import { settings } from "./settings"
import { mkdtemp } from "fs/promises"
import { $ } from "bun"
import { parse as yamlParse } from "yaml"

export interface Task {
    id: string
    name: string
    state: string
}

const errorBox = (msg: string) => {
    console.error(boxen(msg, { padding: 1 }))
}

const openQueueDatabase = () => {
    try {
        const options = { readwrite: true, strict: true, create: false }
        return new Database(settings.database.file, options)
    } catch (e: any) {
        errorBox(
            `Can't open database ${settings.database.file}.\n` +
                `${e.toString()}`
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

export const flushQueue = async () => {
    await queueCallEndpoint("GET", "/admin/flush")
}

export const setupWorker = async (name: string = "jutge") => {
    // Delete all workers
    queuedb.run(`DELETE FROM workers`)
    const empty = queuedb.query(`select * from workers`).all()
    expect(empty).toEqual([])

    // Add one worker which is just localhost
    queuedb.run(
        `INSERT INTO workers VALUES (1, '${name}', '${settings.queue.worker.uri}', 1, null)`
    )
    const testWorkers = queuedb.query(`select * from workers`).all()
    const ssh_uri = settings.queue.worker.uri
    expect(testWorkers).toEqual([
        { id: 1, name, ssh_uri, enabled: 1, task_id: null },
    ])
}

export const basicAuth = () => {
    const { username, password } = settings.queue
    const userpass64 = Buffer.from(`${username}:${password}`).toString("base64")
    return { Authorization: `Basic ${userpass64}` }
}

export const queueCallEndpoint = async (method: string, path: string) => {
    const response = await fetch(`${settings.queue.baseUrl}${path}`, {
        method,
        headers: { ...basicAuth() },
    })
    if (!response.ok) {
        throw new Error(`HTTP call ${method} ${path} returned error: ${response.status} ${response.statusText}`)
    }
    return await response.json()
}

export const getWorkerTaskIdTimeout = async (
    workerName: string,
    targetTaskId: string | null,
    timeout: number = 1000
) => {
    // Wait until the worker has a task_id
    const start = performance.now()
    while (true) {
        const { task_id } = await queueCallEndpoint(
            "GET",
            `/workers/${workerName}`
        )
        if (task_id === targetTaskId) {
            return true
        } else if (performance.now() - start > timeout) {
            return false
        }
        await Bun.sleep(500)
    }
}

export const waitUntilFileAppears = async (
    path: string,
    timeout: number = 1000
) => {
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

export const waitUntilTaskCompleted = async (taskId: string, timeout: number = 30_000) => {
    const start = performance.now()
    while (true) {
        const task = await queueCallEndpoint('GET', `/tasks/${taskId}`)
        if (task.state === "completed") {
            break
        } else if (performance.now() - start > timeout) {
            throw new Error(`Task ${taskId} did not complete in ${timeout}ms`)
        }
        await Bun.sleep(500)
    }
}

interface QueueSendTask {
    name: string
    file: File
    imageId: string
    callback?: string
}
export const queueSendTask = async (taskInfo: QueueSendTask) => {
    const formData = new FormData()
    formData.append("name", taskInfo.name)
    formData.append("file", taskInfo.file)
    formData.append("image_id", taskInfo.imageId)
    if (taskInfo.callback) {
        formData.append("callback", taskInfo.callback)
    }

    const response = await fetch(`${settings.queue.baseUrl}/tasks`, {
        method: "PUT",
        headers: { ...basicAuth() },
        body: formData,
    })
    if (!response.ok) {
        console.error(response.status, response.statusText)
        const { stack } = await response.json()
        console.error(stack)
    }
    expect(response.ok).toBe(true)
    return await response.json()
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

export const isTarArchive = async (blob: Blob) => {
    // Detect if the file is a tar archive from the bytes themselves
    const bytes = await blob.bytes()

    // https://www.gnu.org/software/tar/manual/html_node/Standard.html
    const magic_bytes = bytes.slice(257, 263).toString()
    return magic_bytes === "ustar\0"
}

export const getVeredictFromTgzFile = async (tgzPath: string) => {
    const tmpDir = await mkdtemp(`/tmp/queue-tests-`)
    await $`tar -xzf ${tgzPath} -C ${tmpDir}`
    const correction = await Bun.file(`${tmpDir}/correction.yml`).text()
    const { veredict } = yamlParse(correction)
    return veredict
}

export const yamlParseFile = async (path: string): Promise<any> => {
    const content = await Bun.file(path).text()
    return yamlParse(content)
}