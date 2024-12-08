import { Value } from "@sinclair/typebox/value"
import boxen from "boxen"
import chalk from "chalk"
import type { Static } from "elysia"
import { t } from "elysia"
import { merge } from "lodash"
import { construct } from "radash"
import YAML from "yaml"

export type Settings = Static<typeof TSettings>

export const TSettings = t.Object({
	dirs: t.Object({
		// most of these settings are for the PHP application
		dat: t.String({
			default: "/home/jutge/dat",
			description: "Data directory",
		}),
		tests: t.String({
			default: "/home/jutge/git/jutge-tests",
			description: "Directory with a clone of 'jutge-tests'",
		})
	}),
	database: t.Object({
		file: t.String({
			default: "/home/jutge/queue/queue.db",
			description: "The SQLite database file for the queue",
		}),
	}),
	queue: t.Object({
		baseurl: t.String({
			default: `http://localhost:8000/v1`,
			description: "The base URL for the testing queue",
		}),
		worker: t.Object({
			uri: t.String({
				default: `localhost`,
				description: `URI to use for a worker`
			})
		}),
		username: t.String({
			default: "admin",
			description: "Auth user",
		}),
		password: t.String({
			default: "changeme",
			description: "Auth password",
		}),
	}),
})

const readFileAsYaml = async (path: string) => {
	const file = Bun.file(path)
	if (!(await file.exists())) {
		console.log(
			chalk.yellow(`Warning: File '${path}' not found. Ignoring it.`)
		)
		return {}
	}
	try {
		const data = YAML.parse(await file.text())
		console.log(chalk.green(`Using file '${path}' for settings.`))
		return data
	} catch (e) {
		// TODO: decide if we want to throw an exception here or ignore it
		console.log(
			chalk.yellow(
				`Warning: Syntax error in file '${path}': ${e}. Ignoring it.`
			)
		)
		return {}
	}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const convert = (value: string): any => {
	if (value === "true") {
		return true
	} else if (value === "false") {
		return false
	} else if (!isNaN(Number(value))) {
		return Number(value)
	} else {
		return value
	}
}

/**
 * Reads and merges settings from environment variables, local file, and global file.
 *
 * @param env_vars - A record of environment variables where keys are strings and values are either strings or undefined.
 * @param local_path - The file path to the local settings file.
 * @param global_path - The file path to the global settings file.
 * @returns A promise that resolves to the merged and validated settings.
 *
 * It converts environment variables to an object with keys formatted according to the settings schema.
 *    - Only variables starting with `JUTGE_` and having a value are considered.
 *    - Underscores (`_`) separate levels of the hierarchy.
 *    - Double underscores (`__`) are replaced by a single underscore in the hierarchy.
 *    - Values are converted to the correct type: `true` -> `true`, `false` -> `false`, `123` -> `123`, `abc` -> `"abc"`.
 *
 * @throws Will log validation errors and throw an exception if the resulting settings are invalid.
 */
export async function readSettings(
	env_vars: Record<string, string | undefined>,
	local_path: string,
	global_path: string
): Promise<Settings> {
	const vars: Record<string, string> = {}
	for (const [key, value] of Object.entries(env_vars)) {
		if (key.startsWith("JUTGE_") && value !== undefined) {
			console.log(
				chalk.green(`Using settings var '${key}' for settings.`)
			)
			const new_key = key
				.replace("JUTGE_", "")
				.replaceAll("_", ".")
				.replaceAll("..", "_")
				.toLowerCase()
			vars[new_key] = convert(value)
		}
	}
	//    vars['database_url'] = process.env.DATABASE_URL || ''

	const env_data = construct(vars)
	const local_data = await readFileAsYaml(local_path)
	const global_data = await readFileAsYaml(global_path)
	const default_data = Value.Create(TSettings)

	const merged_data = merge(default_data, global_data, local_data, env_data)

	const cleaned_data = Value.Clean(TSettings, merged_data)
	if (!Value.Check(TSettings, cleaned_data)) {
		for (const error of [...Value.Errors(TSettings, cleaned_data)]) {
			console.error(
				`${error.message} for ${error.path} but got ${error.value}.`
			)
		}
		throw new Error("Invalid settings.")
	}
	return cleaned_data
}

/**
 * Reads the settings from the environment variables and default YAML files:
 * ./jutge.yml and $HOME/.jutge.yml.
 *
 * @returns A promise that resolves to the settings object.
 */
export async function read(): Promise<Settings> {
	return await readSettings(
		process.env,
		"./jutge.yml",
		`${process.env.HOME}/.jutge.yml`
	)
}

/**
 * Displays the given settings in a formatted box. If not provided,
 * uses the global `settings` object. Password fields are replaced by asterisks.
 */
export function show(s: Settings = settings): void {
	let _yaml: string = ""

	const _prval = (s: unknown): string => {
		if (typeof s === "boolean") {
			return s ? chalk.bgGreen(s) : chalk.bgRed(s)
		} else if (typeof s === "number") {
			return chalk.bgBlack(s)
		} else if (typeof s === "string") {
			return chalk.dim(`"`) + chalk.blue(s) + chalk.dim(`"`)
		} else {
			return String(s)
		}
	}

	const _print = (prefix: string, obj: Record<string, unknown>): void => {
		for (let [key, value] of Object.entries(obj)) {
			_yaml += `${prefix}${chalk.yellow(key)}:`
			if (typeof value === "object") {
				_yaml += `\n`
				_print(`${prefix}    `, value as Record<string, unknown>)
			} else {
				let _value =
					key === "password"
						? chalk.dim("**********")
						: _prval(value as string)
				_yaml += ` ${_value}\n`
			}
		}
	}

	_print("", s)

	const box = boxen(_yaml.trim(), {
		borderStyle: "round",
		padding: 1,
		title: "Settings",
	})
	console.log(`\n${box}\n`)
}

export const settings = await read()

show()
