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

import { expect } from 'chai';
import 'mocha';

import * as fs from 'fs/promises';
import * as path from 'path';

import { createCanvas, loadImage } from 'canvas';

import { Strategy } from '../src/SvgPathReorderUtils';
import { SvgDocument } from '../src/SvgDocument';

const testRender = async (
	testName: string,
	fileName: string,
	strategy: Strategy,
	usePhysicalDimensions = true,
) => {
	const filePath = path.join(__dirname, fileName);

	const input = await fs.readFile(filePath);

	const styleDocument = (s: string | Buffer | SvgDocument) =>
		Buffer.from(
			s
				.toString()
				.replace(
					/\b(?:[a-zA-Z]+:)?(style|stroke|fill|opacity|stroke-width|stroke-linecap|stroke-opacity|vector-effect)[\s]*=[\s]*(?:"[^"]*"|'[^']*')/g,
					'',
				)
				.replace(/<([a-zA-Z]+:)?style[^>]*>[\s\S]*?<\/\1style>/gu, '')
				.replace(
					/<([a-zA-Z]+:)?svg([^>]*)>/,
					'<$1svg$2>' +
						'<$1style type="text/css"><![CDATA[' +
						'path, line, rect, circle, ellipse, use, polygon, polyline, g {' +
						'fill:none;' +
						'stroke:black;' +
						'stroke-width:1px;' +
						'stroke-linecap:butt;' +
						'stroke-linejoin:miter;' +
						'stroke-opacity:1;' +
						'vector-effect: non-scaling-stroke;' +
						'}' +
						']]></$1style>',
				),
		);

	const docs = (await SvgDocument.fromString(input)).map((document) => {
		document.reorderPaths(strategy);
		return document;
	});

	expect(docs).to.be.an('array').that.has.lengthOf(1);

	const referenceImageSrc = styleDocument(input);
	const processedImageSrc = styleDocument(
		styleDocument(docs[0].toString(usePhysicalDimensions)),
	);

	const referenceImage = await loadImage(referenceImageSrc);
	const processedImage = await loadImage(processedImageSrc);

	const referenceCanvas = createCanvas(
		referenceImage.naturalWidth,
		referenceImage.naturalHeight,
	);
	const referenceCtx = referenceCanvas.getContext('2d');
	referenceCtx.drawImage(referenceImage, 0, 0);

	const processedCanvas = createCanvas(
		processedImage.naturalWidth,
		processedImage.naturalHeight,
	);
	const processedCtx = processedCanvas.getContext('2d');
	processedCtx.drawImage(processedImage, 0, 0);

	const referenceResult = referenceCanvas.toBuffer('raw');
	const processedResult = processedCanvas.toBuffer('raw');

	await fs.mkdir(path.join(__dirname, 'out', 'SvgDocument', testName), {
		recursive: true,
	});

	fs.writeFile(
		path.join(__dirname, 'out', 'SvgDocument', testName, 'reference.svg'),
		referenceImageSrc,
	);
	fs.writeFile(
		path.join(__dirname, 'out', 'SvgDocument', testName, 'processed.svg'),
		processedImageSrc,
	);
	fs.writeFile(
		path.join(__dirname, 'out', 'SvgDocument', testName, 'reference.png'),
		referenceCanvas.toBuffer(),
	);
	fs.writeFile(
		path.join(__dirname, 'out', 'SvgDocument', testName, 'processed.png'),
		processedCanvas.toBuffer(),
	);

	const result = Buffer.compare(referenceResult, processedResult);

	expect(processedImage.naturalWidth).to.equal(referenceImage.naturalWidth);
	expect(processedImage.naturalHeight).to.equal(referenceImage.naturalHeight);
	expect(result).to.equal(0);
};

describe('SvgDocument', () => {
	it('aligned_squares', async () => {
		await testRender(
			'aligned_squares',
			'aligned_squares.svg',
			Strategy.START_END,
		);
	});

	it('all_shapes', async () => {
		await testRender(
			'all_shapes',
			'test_all_shapes.svg',
			Strategy.CENTROID,
		);
	});

	it('all_shapes_use_ns', async () => {
		await testRender(
			'all_shapes_use_ns',
			'test_all_shapes_use_ns.svg',
			Strategy.CENTROID,
		);
	});

	it('arc', async () => {
		await testRender('arc', 'test_arc.svg', Strategy.START_END);
	});

	it('arc_transform', async () => {
		await testRender(
			'arc_transform',
			'test_arc_transform.svg',
			Strategy.START_END,
			false,
		);
	});

	it('circle', async () => {
		await testRender('circle', 'test_circle.svg', Strategy.START_END);
	});

	it('shapes', async () => {
		await testRender('shapes', 'test_shapes.svg', Strategy.START_END);
	});

	it('use', async () => {
		await testRender('use', 'test_use.svg', Strategy.START_END, false);
	});

	it('use_forward', async () => {
		await testRender(
			'use_forward',
			'test_use_forward.svg',
			Strategy.START_END,
			false,
		);
	});

	it('xml_namespaces', async () => {
		await testRender(
			'xml_namespaces',
			'test_xml_namespaces.svg',
			Strategy.START_END,
		);
	});

	it('transform', async () => {
		await testRender(
			'transform',
			'transform.svg',
			Strategy.START_END,
			false,
		);
	});
});
