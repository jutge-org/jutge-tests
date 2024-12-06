import { mkdtemp, rmdir } from "fs/promises"

/**
 * Executes a function with a temporary directory path and cleans up the directory afterwards.
 *
 * @param fn - The function to be executed with the temporary directory path.
 * @returns A promise that resolves to the result of the function.
 */
export async function withTmpDir<T>(
	fn: (tmp: string) => Promise<T>
): Promise<T> {
	const dir = await mkdtemp("/tmp/jutge-tmp-")
	try {
		return await fn(dir)
	} finally {
		await rmdir(dir, { recursive: true })
	}
}
