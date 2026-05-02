import fs from 'node:fs';
import Handlebars from 'handlebars';
import path from 'node:path';

function defaultPartialResolver(name) {
	return path.resolve(`./src/partials`, `${name}.hbs`);
}

export default function createHandlebarsTransform({ partialResolver = defaultPartialResolver, context = {}, helpers } = {}) {
	const resolvedPartials = {};
	global.dynamicHbPartialLoader = (name) => {
		if (!resolvedPartials[name]) {
			resolvedPartials[name] = fs.readFileSync(partialResolver(name), 'utf8').toString();
		}
		return resolvedPartials[name];
	};

	const hb = Handlebars.create();
	if (helpers) {
		hb.registerHelper(helpers);
	}

	const OrigResolvePartial = hb.VM.resolvePartial;
	hb.VM.resolvePartial = function (partial, context, options) {
		let result = OrigResolvePartial.apply(this, arguments);
		if (undefined == result) {
			result = dynamicHbPartialLoader(options.name);
		}
		return result;
	};

	const OrigComplier = hb.JavaScriptCompiler;
	function DynamicLookupCompiler() {
		OrigComplier.apply(this, arguments);
	}
	DynamicLookupCompiler.prototype = Object.create(OrigComplier.prototype);
	DynamicLookupCompiler.prototype.compiler = DynamicLookupCompiler;
	DynamicLookupCompiler.prototype.nameLookup = function (parent, name, type) {
		// console.log("nameLookup", parent, name, type);
		if ('partial' == type && '@partial-block' != name) {
			return `dynamicHbPartialLoader("${name}")`;
		}
		return OrigComplier.prototype.nameLookup.apply(this, arguments);
	};
	hb.JavaScriptCompiler = DynamicLookupCompiler;

	return async (contents, filename) => {
		const ctx = {
			common: context.common
		};
		if (context[filename]) {
			ctx.local = context[filename];
		}
		if (!ctx.common && !ctx.local) {
			ctx.common = context;
		}
		const template = hb.compile(contents.toString());
		return template(ctx);
	};
}