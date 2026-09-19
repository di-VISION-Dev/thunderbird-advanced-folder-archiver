#!/usr/bin/env node
import { argv } from 'node:process';
import { realpath, stat, readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import path from 'node:path';
import * as zl from "zip-lib";

const DEFAULT_SOURCE_DIR = './build';
const DEFAULT_OUTPUT_DIR = './dist';

const nodePath = await realpath(argv[1]);
const modulePath = await realpath(fileURLToPath(import.meta.url));
const isCLI = nodePath === modulePath;

if (isCLI) cliStart();

function printUsage() {
	console.info(`Usage:\nmake-xpi <name> [(-s | --sourceDir) <path> - XPI source directory, default: '${DEFAULT_SOURCE_DIR}'] [(-o | --outputDir) <path> - XPI output directory, default: '${DEFAULT_OUTPUT_DIR}']`);
}

async function dirExists(path) {
	try {
		const stats = await stat(path);
		return stats.isDirectory();
	} catch { }
	return false;
}
async function fileExists(path) {
	try {
		const stats = await stat(path);
		return stats.isFile();
	} catch { }
	return false;
}

export async function cliStart() {
	const { values, positionals } = parseArgs({
		options: {
			version: {
				type: 'string',
				short: 'v'
			},
			restrictMax: {
				type: 'string',
				short: 'r'
			},
			sourceDir: {
				type: 'string',
				short: 's',
				default: DEFAULT_SOURCE_DIR
			},
			outputDir: {
				type: 'string',
				short: 'o',
				default: DEFAULT_OUTPUT_DIR
			}
		},
		strict: false,
		allowPositionals: true
	});

	if (!positionals.length) {
		printUsage();
		return;
	}
	values.name = positionals[0];
	await makeXpi(values);

}

export async function makeXpi({ name, version, restrictMax, sourceDir = DEFAULT_SOURCE_DIR, outputDir = DEFAULT_OUTPUT_DIR } = {}) {
	if (!name) {
		throw new Error("Name is required");
	}
	if (!(await dirExists(sourceDir))) {
		throw new Error(`${sourceDir} is not an accessible directory`);
	}
	const manifestPath = path.resolve(sourceDir, "manifest.json");
	const origManifest = await readFile(manifestPath, 'utf8');
	const manifest = JSON.parse(origManifest);
	if (!version) {
		version = manifest.version;
	}
	if (restrictMax) {
		manifest.browser_specific_settings.gecko.strict_max_version = restrictMax;
		await writeFile(manifestPath, JSON.stringify(manifest, undefined, 4), 'utf8');
	}
	if (!(await dirExists(outputDir))) {
		await mkdir(outputDir, { recursive: true });
	}
	const xpiPath = path.resolve(outputDir, `${name}-${version}.xpi`);
	console.info(`Creating ${xpiPath}`);

	if (await fileExists(xpiPath)) {
		await unlink(xpiPath);
	}
	await zl.archiveFolder(sourceDir, xpiPath);
	if (restrictMax) {
		await writeFile(manifestPath, origManifest, 'utf8');
	}
}