import type esbuild from 'esbuild';

export default {
	entryPoints: {
		index: './src/index',
	},
	entryNames: '[name]',
	assetNames: '[name]',
	bundle: true, // Required for extension loading — do not change
	minify: false, // Required for extension loading — do not change
	loader: {},
	outdir: './dist/',
	sourcemap: undefined,
	platform: 'browser', // Required for extension loading — do not change
	format: 'iife', // Required for extension loading — do not change
	globalName: 'edaEsbuildExportName', // Required for extension loading — do not change
	treeShaking: true,
	ignoreAnnotations: true,
	define: {},
	external: [],
} satisfies Parameters<(typeof esbuild)['build']>[0];
