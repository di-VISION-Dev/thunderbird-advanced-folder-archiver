import terser from '@rollup/plugin-terser';
import { cleandir } from 'rollup-plugin-cleandir';
import copy from 'rollup-plugin-copy';
import { createTransform } from 'rollup-copy-transform-css';
import createHandlebarsTransform from 'rollup-copy-transform-handlebars';
import jscc from 'rollup-plugin-jscc';
import path from 'node:path';

import hbshelpers from './scripts/hbshelpers.mjs';
import pkg from './package.json' with { type: "json" };

const mode = process.env.mode || 'development';
const isProduction = 'production' == mode;
const isWatched = '1' == process.env.watched;

const targetDir = 'build';
const targetDirApi = `${targetDir}/api`;
const targetDirUi = `${targetDir}/ui`;

const hbsTransform = createHandlebarsTransform({
	context: {
		common: {
			package: {
				name: pkg.name,
				version: pkg.version
			}
		}
	},
	partialResolver: (name) => {
		return path.resolve(import.meta.dirname, 'src/ui/partials', `${name}.hbs`);
	},
	helpers: hbshelpers
});
const cssTransform = createTransform({ inline: true, map: false, minify: isProduction });

const conf = {
	input: {
		'scripts/background': 'src/scripts/background.js',
		'ui/options': 'src/ui/options.js',
		'ui/folder-policy': 'src/ui/folder-policy.js',
		'ui/bs': 'node_modules/bootstrap/dist/js/bootstrap.js'
	},
	output: {
		dir: targetDir,
		chunkFileNames: "_imports/[name]-[hash].js"
		// entryFileNames: '[name].js'
	},
	moduleContext: {
		'node_modules/bootstrap/dist/js/bootstrap.js': 'this'
	},
	plugins: [
		!isWatched && cleandir(targetDir, { hook: "options", order: "pre", runSync: true }),
		jscc({
			values: {
				_MODE_: mode,
				_VERSION_: pkg.version,
				_BGHCHECK_: isProduction ? 60 * 12 : 0,
				_DEBUG: isProduction ? 0 : 1,
				_MANIFEST_V3_: 2 < pkg.config.manifest_version ? 1 : 0
			},
			exclude: "**/node_modules/**/*"
		}),
		copy({
			targets: [{
				src: 'src/manifest.json',
				dest: targetDir,
				transform: async (contents, filename) => {
					const json = JSON.parse(contents);
					json.manifest_version = pkg.config.manifest_version;
					json.version = pkg.version;
					json.author = pkg.author;
					return isProduction ? JSON.stringify(json) : JSON.stringify(json, undefined, 4);
				}
			}, {
				src: 'src/_locales/**/*',
				dest: `${targetDir}/_locales`
			}, {
				src: 'src/api/schema.json',
				dest: targetDirApi
			}, {
				// XPCOM extension can't be "rolled-up"!
				src: 'src/api/*.js',
				dest: targetDirApi
			}, {
				src: 'src/images/**/*',
				dest: `${targetDir}/images`
			}, {
				src: 'src/ui/*.html',
				dest: targetDirUi
			}, {
				src: 'src/ui/*.hbs',
				dest: targetDirUi,
				rename: (name, extension) => `${name}.html`,
				transform: hbsTransform
			}, {
				src: 'node_modules/bootstrap/dist/css/bootstrap.css',
				dest: targetDirUi,
				rename: 'bs.css',
				transform: cssTransform
			}, {
				src: 'src/ui/*.css',
				dest: targetDirUi,
				transform: cssTransform
			}],
			copySync: true
		})
	]
};
if (isProduction) {
	conf.plugins.push(terser({
		compress: {
			dead_code: true,
			unused: true,
			drop_console: ['log'],
			drop_debugger: true
		},
		mangle: {
			toplevel: true
		}
	}));
}
export default conf;