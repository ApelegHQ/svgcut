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

import { promises as fs } from 'fs';
import * as svgcut from './index';

void (async () => {
	const showHelp = (isError: boolean) => {
		const myProcess = process as typeof process & {
			pkg?: { entrypoint?: string };
		};

		const progName =
			'pkg' in myProcess &&
			myProcess['pkg'] &&
			'entrypoint' in myProcess['pkg'] &&
			myProcess['pkg']['entrypoint'] === process.argv[1]
				? process.argv[0]
				: process.argv.slice(0, 2).join(' ');

		(isError ? process.stderr : process.stdout).write(
			`Usage: ${progName} [--] [input svg file] [output svg file]\n`,
		);
		process.exit(isError ? 1 : 0);
	};

	if (
		!process.argv ||
		process.argv.length < 2 ||
		process.argv.length > 5 ||
		['-h', '-?', '--help', '/h', '/?', '/help'].includes(process.argv[3])
	) {
		showHelp(true);
	}
	if (['-h', '-?', '--help', '/h', '/?', '/help'].includes(process.argv[2])) {
		showHelp(false);
	}

	const endOfOptions = process.argv[2] === '--';

	const inputFile = process.argv[endOfOptions ? 3 : 2];
	const outputFile = process.argv[endOfOptions ? 4 : 3];

	const input =
		!inputFile || (inputFile === '-' && !endOfOptions)
			? await new Promise<Buffer>((resolve, reject) => {
					const chunks: Buffer[] = [];
					process.stdin.resume();
					process.stdin.on('data', (chunk) => chunks.push(chunk));
					process.stdin.on('end', () => {
						resolve(Buffer.concat(chunks));
					});
					process.stdin.on('error', reject);
			  })
			: await fs.readFile(inputFile);
	const result = await svgcut.reorderSvgPaths(
		input,
		svgcut.Strategy.START_END,
	);

	if (result.length !== 1) {
		throw new Error('The number of SVG documents is not 1');
	}

	const output = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">',
		...result,
		'',
	].join('\n');

	if (!outputFile || (outputFile === '-' && !endOfOptions)) {
		process.stdout.write(output);
	} else {
		await fs.writeFile(outputFile, output);
	}
})().catch((e) => {
	console.dir(e);
	process.exit(1);
});
