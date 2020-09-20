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

/* eslint-disable @typescript-eslint/no-var-requires */

const fs = require('fs/promises'),
	path = require('path'),
	svgcut = require('../dist/index.js');

void (async () => {
	if (
		process.argv &&
		process.argv.length !== 2 &&
		process.argv.length !== 3
	) {
		process.stderr.write(
			`Usage: ${process.argv[0]} ${process.argv[1]} [svg file]\n`,
		);
		process.exit(1);
	}

	const filePath = process.argv[2] || path.join(__dirname, 'test_shapes.svg');

	const file = await fs.readFile(filePath);
	const result = await svgcut.reorderSvgPaths(
		file,
		svgcut.Strategy.START_END,
	);

	if (result.length !== 1) {
		throw new Error('The number of SVG documents is not 1');
	}

	process.stdout.write('<?xml version="1.0" encoding="UTF-8"?>\n');
	process.stdout.write(
		'<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n',
	);
	process.stdout.write(result.join('\n'));
	process.stdout.write('\n');
})().catch((e) => {
	console.dir(e);
	process.exit(1);
});
