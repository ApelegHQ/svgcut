/* Copyright 2020 Ricardo Iván Vieitez Parra
 *
 * All rights reserved.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 * REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
 * AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 * INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
 * LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
 * OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 * PERFORMANCE OF THIS SOFTWARE.
 */

module.exports = (grunt) => {
	grunt.initConfig({
		jison: {
			svgpath: {
				files: {
					'node_modules/@generated/svgpath/index.js':
						'./src/svgpath.jison',
				},
			},
			svgtransform: {
				files: {
					'node_modules/@generated/svgtransform/index.js':
						'./src/svgtransform.jison',
				},
			},
		},
		browserify: {
			lib: {
				files: {
					'dist/index.js': ['./src/index.ts'],
				},
				options: {
					plugin: [
						'tsify',
						process.env.NODE_ENV === 'production' ? 'tinyify' : '',
					].filter((p) => !!p),
					browserifyOptions: {
						node: true,
						debug: true,
						standalone: 'svgcut',
					},
				},
			},
			app: {
				files: {
					'dist/app.js': ['./src/app.ts'],
				},
				options: {
					plugin: [
						'tsify',
						process.env.NODE_ENV === 'production' ? 'tinyify' : '',
					].filter((p) => !!p),
					browserifyOptions: {
						node: true,
						debug: true,
						standalone: 'xx',
					},
				},
			},
		},
		exorcise: {
			lib: {
				options: {},
				files: {
					'dist/index.js.map': ['dist/index.js'],
				},
			},
			app: {
				options: {},
				files: {
					'dist/app.js.map': ['dist/app.js'],
				},
			},
		},
	});

	grunt.loadNpmTasks('grunt-jison');
	grunt.loadNpmTasks('grunt-browserify');
	grunt.loadNpmTasks('@exact-realty/grunt-exorcise');

	grunt.registerTask('default', [
		'jison',
		'browserify:lib',
		'exorcise:lib',
		'browserify:app',
		'exorcise:app',
	]);
};
