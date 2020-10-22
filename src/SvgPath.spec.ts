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

import { Decimal } from 'decimal.js';
import { parse } from '@generated/svgpath';

import { SvgPath } from './SvgPath';
import { SvgTransform } from './SvgTransform';

export const pathEquals = (expected: string, actual: SvgPath): void => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const replacer = (key: any, value: any) => {
		if (value instanceof Decimal) {
			return +value.toDP(6);
		} else if (Object(value) instanceof String) {
			const n = +value;
			return n === n ? +n.toFixed(6) : value;
		} else {
			return value;
		}
	};

	expect(
		JSON.parse(JSON.stringify(parse(actual.toString()), replacer)),
	).to.deep.equal(JSON.parse(JSON.stringify(parse(expected), replacer)));
};

describe('SvgPath', () => {
	it('.fromString() should return empty', () => {
		const result = SvgPath.fromString();

		pathEquals('', result);

		expect(result.start.map((d) => +d)).to.deep.equal([0, 0]);
		expect(result.end.map((d) => +d)).to.deep.equal([0, 0]);
		expect(result.centroid.map((d) => +d)).to.deep.equal([0, 0]);
	});

	it(".fromString('M 0, 0')", () => {
		const result = SvgPath.fromString('M 0, 0');

		pathEquals('M 0, 0', result);

		expect(result.start.map((d) => +d)).to.deep.equal([0, 0]);
		expect(result.end.map((d) => +d)).to.deep.equal([0, 0]);
		expect(result.centroid.map((d) => +d)).to.deep.equal([0, 0]);

		expect(result.start.map((d) => +d)).to.deep.equal([0, 0]);
		expect(result.end.map((d) => +d)).to.deep.equal([0, 0]);
		expect(result.centroid.map((d) => +d)).to.deep.equal([0, 0]);
	});

	it(".fromPolygon('1 2 3 4')", () => {
		const result = SvgPath.fromPolygon('1 2 3 4');

		pathEquals('M 1 2 3 4 Z', result);

		expect(result.start.map((d) => +d)).to.deep.equal([1, 2]);
		expect(result.end.map((d) => +d)).to.deep.equal([1, 2]);
		expect(result.centroid.map((d) => +d)).to.deep.equal([2, 3]);
	});

	it(".fromPolygon('1 2 3 4', 'skewX(56.3099325) skewY(51.3401917)')", () => {
		const result = SvgPath.fromPolygon(
			'1 2 3 4',
			SvgTransform.fromString('skewX(56.3099325) skewY(51.3401917)'),
		);

		pathEquals('M 5.875 3.25 14.625 7.75 Z', result);

		expect(result.start.map((d) => +d.toDP(5))).to.deep.equal([
			5.875,
			3.25,
		]);
		expect(result.end.map((d) => +d.toDP(5))).to.deep.equal([5.875, 3.25]);
		expect(result.centroid.map((d) => +d.toDP(5))).to.deep.equal([
			10.25,
			5.5,
		]);
	});

	it(".fromPolyline('1 2 3 4')", () => {
		const result = SvgPath.fromPolyline('1 2 3 4');

		pathEquals('M 1 2 3 4', result);

		expect(result.start.map((d) => +d)).to.deep.equal([1, 2]);
		expect(result.end.map((d) => +d)).to.deep.equal([3, 4]);
		expect(result.centroid.map((d) => +d)).to.deep.equal([2, 3]);
	});

	it(".fromPolyline('1 2 3 4', 'skewX(56.3099325) skewY(51.3401917)')", () => {
		const result = SvgPath.fromPolyline(
			'1 2 3 4',
			SvgTransform.fromString('skewX(56.3099325) skewY(51.3401917)'),
		);

		pathEquals('M 5.875 3.25 14.625 7.75', result);

		expect(result.start.map((d) => +d.toDP(6))).to.deep.equal([
			5.875,
			3.25,
		]);
		expect(result.end.map((d) => +d.toDP(6))).to.deep.equal([14.625, 7.75]);
		expect(result.centroid.map((d) => +d.toDP(6))).to.deep.equal([
			10.25,
			5.5,
		]);
	});

	it('.fromLine(2, 3, 5, 7)', () => {
		const result = SvgPath.fromLine(
			new Decimal(2),
			new Decimal(3),
			new Decimal(5),
			new Decimal(7),
		);

		pathEquals('M 2 3 5 7', result);

		expect(result.start.map((d) => +d)).to.deep.equal([2, 3]);
		expect(result.end.map((d) => +d)).to.deep.equal([5, 7]);
		expect(result.centroid.map((d) => +d)).to.deep.equal([3.5, 5]);
	});

	it(".fromLine(2, 3, 5, 7, 'skewX(68.1985905) rotate(30)')", () => {
		const result = SvgPath.fromLine(
			new Decimal(2),
			new Decimal(3),
			new Decimal(5),
			new Decimal(7),
			SvgTransform.fromString('skewX(68.1985905) rotate(30)'),
		);

		pathEquals('M 9.227241 3.598076 22.235572 8.562178', result);

		expect(result.start.map((d) => +d.toDP(6))).to.deep.equal([
			9.227241,
			3.598076,
		]);
		expect(result.end.map((d) => +d.toDP(6))).to.deep.equal([
			22.235572,
			8.562178,
		]);
		expect(result.centroid.map((d) => +d.toDP(6))).to.deep.equal([
			15.731406,
			6.080127,
		]);
	});

	it('.fromCircle(23, 29, 11)', () => {
		const result = SvgPath.fromCircle(
			new Decimal(23),
			new Decimal(29),
			new Decimal(11),
		);

		// TODO: Do this in a way that is not implementation-specific (i.e., checking arcs make 360 degrees)
		pathEquals('M 12 29 a 11 11 0 1 1 11 11 11 11 0 0 1 -11 -11 Z', result);
	});

	it('.fromEllipse(599, 601, 457, 337)', () => {
		const result = SvgPath.fromEllipse(
			new Decimal(599),
			new Decimal(601),
			new Decimal(457),
			new Decimal(337),
		);

		// TODO: Do this in a way that is not implementation-specific (i.e., checking arcs make 360 degrees)
		pathEquals(
			'M 142 601 a 457 337 0 1 1 457 337 457 337 0 0 1 -457 -337 Z',
			result,
		);
	});

	it(".fromEllipse(599, 601, 457, 337, 'scale(-1 1)')", () => {
		const result = SvgPath.fromEllipse(
			new Decimal(599),
			new Decimal(601),
			new Decimal(457),
			new Decimal(337),
			SvgTransform.fromString('scale(-1 1)'),
		);

		// TODO: Do this in a way that is not implementation-specific (i.e., checking arcs make 360 degrees)
		pathEquals(
			'M-142 601 a 457 337 0 1 0 -457 337 457 337 0 0 0 457 -337 Z',
			result,
		);
	});

	it('.fromRect(199, 211, 223, 227)', () => {
		const result = SvgPath.fromRect(
			new Decimal(199),
			new Decimal(211),
			new Decimal(223),
			new Decimal(227),
		);

		// TODO: Do this in a way that is not implementation-specific (i.e., support reordering)
		pathEquals('M 199 211 h 223 v 227 h -223 v -227 Z', result);
	});

	it(".fromRect(199, 211, 223, 227, 29, 'auto')", () => {
		const result = SvgPath.fromRect(
			new Decimal(199),
			new Decimal(211),
			new Decimal(223),
			new Decimal(227),
			new Decimal(29),
			'auto',
		);

		// TODO: Do this in a way that is not implementation-specific (i.e., support reordering)
		pathEquals(
			'M228 211 h 165 a 29 29 0 0 1 29 29 v 169 a 29 29 0 0 1 -29 29 h -165 a 29 29 0 0 1 -29 -29 v -169 a 29 29 0 0 1 29 -29 Z',
			result,
		);
	});

	it(".fromRect(199, 211, 223, 227, 'auto', 37)", () => {
		const result = SvgPath.fromRect(
			new Decimal(199),
			new Decimal(211),
			new Decimal(223),
			new Decimal(227),
			'auto',
			new Decimal(37),
		);

		// TODO: Do this in a way that is not implementation-specific (i.e., support reordering)
		pathEquals(
			'M 236 211 h 149 a 37 37 0 0 1 37 37 v 153 a 37 37 0 0 1 -37 37 h -149 a 37 37 0 0 1 -37 -37 v -153 a 37 37 0 0 1 37 -37 Z',
			result,
		);
	});

	it('.fromRect(199, 211, 223, 227, 29, 37)', () => {
		const result = SvgPath.fromRect(
			new Decimal(199),
			new Decimal(211),
			new Decimal(223),
			new Decimal(227),
			new Decimal(29),
			new Decimal(37),
		);

		// TODO: Do this in a way that is not implementation-specific (i.e., support reordering)
		pathEquals(
			'M 228 211 h 165 a 29 37 0 0 1 29 37 v 153 a 29 37 0 0 1 -29 37 h -165 a 29 37 0 0 1 -29 -37 v -153 a 29 37 0 0 1 29 -37 Z',
			result,
		);
	});

	it('.fromRect(199, 211, 223, 227, 1024, 37)', () => {
		const result = SvgPath.fromRect(
			new Decimal(199),
			new Decimal(211),
			new Decimal(223),
			new Decimal(227),
			new Decimal(1024),
			new Decimal(37),
		);

		// TODO: Do this in a way that is not implementation-specific (i.e., support reordering)
		pathEquals(
			'M422 248 v 153 a 111.5 37 0 0 1 -223 0 v -153 a 111.5 37 0 0 1 223 0 Z',
			result,
		);
	});

	it('.fromRect(199, 211, 223, 227, 29, 1024)', () => {
		const result = SvgPath.fromRect(
			new Decimal(199),
			new Decimal(211),
			new Decimal(223),
			new Decimal(227),
			new Decimal(1024),
			new Decimal(37),
		);

		// TODO: Do this in a way that is not implementation-specific (i.e., support reordering)
		pathEquals(
			'M422 248v153a111.5 37 0 0 1 -223 0v-153a111.5 37 0 0 1 223 0Z',
			result,
		);
	});

	it('.fromRect(199, 211, 223, 227, 1024, 1024)', () => {
		const result = SvgPath.fromRect(
			new Decimal(199),
			new Decimal(211),
			new Decimal(223),
			new Decimal(227),
			new Decimal(1024),
			new Decimal(1024),
		);

		// TODO: Do this in a way that is not implementation-specific (i.e., support reordering)
		pathEquals(
			'M422 324.5a111.5 113.5 0 0 1 -223 0 111.5 113.5 0 0 1 223 0Z',
			result,
		);
	});

	it('cached properties twice', () => {
		const result = SvgPath.fromString('M 19 31 l 1 1 5 5 10 10 z');

		pathEquals('M 19 31 l 1 1 5 5 10 10 Z', result);

		pathEquals(
			'M 19 31 L 20 32 25 37 35 47 Z',
			result.toAbsoluteCommands(),
		);
		pathEquals(
			'M 19 31 L 20 32 25 37 35 47 Z',
			result.toAbsoluteCommands(),
		);

		expect(result.start.map((d) => +d)).to.deep.equal([19, 31]);
		expect(result.end.map((d) => +d)).to.deep.equal([19, 31]);
		expect(result.centroid.map((d) => +d)).to.deep.equal([24.75, 36.75]);

		expect(result.start.map((d) => +d)).to.deep.equal([19, 31]);
		expect(result.end.map((d) => +d)).to.deep.equal([19, 31]);
		expect(result.centroid.map((d) => +d)).to.deep.equal([24.75, 36.75]);
	});

	it('Stairs_stroke_MHVZ = Stairs_stroke_mhvz', () => {
		const Stairs_stroke_MHVZ =
			'M 240.00000 56.00000 H 270.00000 V 86.00000 H 300.00000 V 116.00000 H 330.00000 V 146.00000 H 240.00000 V 56.00000 Z';
		const Stairs_stroke_mhvz = SvgPath.fromString(
			'm 240.00000 190.00000 h 30.00000 v 30.00000 h 30.00000 v 30.00000 h 30.00000 v 30.00000 h -90.00000 v -90.00000 z',
			SvgTransform.fromString('translate(0 -134)'),
		).toAbsoluteCommands();

		pathEquals(Stairs_stroke_MHVZ, Stairs_stroke_mhvz);
	});

	it('post transform is the same as transform upon creation', () => {
		const pathSpec =
			'M50, 200 c0,-100 150,-100 150,0 0,-100 150,-100 150,0 M50 300 Q 125 275 200 300 275 325 350 300 M425 25 T 425 75 425 125 M400,300 a25 25 0 0 0 25 -50 25 25 0 0 0 -25 50';
		const transform = SvgTransform.fromString('matrix(1 -2 3 4 -5 -6)');

		pathEquals(
			SvgPath.fromString(pathSpec, transform).toString(),
			SvgPath.fromString(pathSpec).transform(transform),
		);
	});

	it('extract subpaths', () => {
		const paths = SvgPath.fromString(
			'M50, 200 c0,-100 150,-100 150,0 0,-100 150,-100 150,0 M50 300 Q 125 275 200 300 275 325 350 300 M425 25 T 425 75 425 125 M400,300 a25 25 0 0 0 25 -50 25 25 0 0 0 -25 50',
		).extractSubpaths();

		expect(paths).has.lengthOf(4);

		pathEquals(
			'M50, 200 c0,-100 150,-100 150,0 0,-100 150,-100 150,0',
			paths[0],
		);
		pathEquals('M50 300 Q 125 275 200 300 275 325 350 300', paths[1]);
		pathEquals('M425 25 T 425 75 425 125', paths[2]);
		pathEquals('M400,300 a25 25 0 0 0 25 -50 25 25 0 0 0 -25 50', paths[3]);
	});

	it('all elements', () => {
		const paths = SvgPath.fromString(
			'm 13 17 89 101 h 11 H 19 v -23 V 37 z c 2 3 5 7 29 31 C 53 59 61 67 71 73 S 127 131 137 83 s 37 41 43 47 Q 73 89 97 101 q 137 179 149 -41 T 193 197 t 199 239 Z a 281 283 0 0 0 317 331 A 293 307 30 0 0 311 313 l 2 18 L 337 347',
		).extractSubpaths();

		expect(paths).has.lengthOf(1);

		pathEquals(
			'm 13 17 89 101 h 11 H 19 v -23 V 37 Z c 2 3 5 7 29 31 C 53 59 61 67 71 73 S 127 131 137 83 s 37 41 43 47 Q 73 89 97 101 q 137 179 149 -41 T 193 197 t 199 239 Z a 281 283 0 0 0 317 331 A 293 307 30 0 0 311 313 l 2 18 L 337 347',
			paths[0],
		);

		pathEquals(
			'M 13 17 102 118 H 113 H 19 V 95 V 37 Z C 15 20 18 24 42 48 C 53 59 61 67 71 73 S 127 131 137 83 S 174 124 180 130 Q 73 89 97 101 Q 234 280 246 60 T 193 197 T 392 436 Z A 281 283 0 0 0 330 348 A 293 307 30 0 0 311 313 L 313 331 L 337 347',
			paths[0]?.toAbsoluteCommands(),
		);

		expect(paths[0].start.map((d) => +d)).to.deep.equal([13, 17]);
		expect(paths[0].end.map((d) => +d)).to.deep.equal([337, 347]);
		expect(paths[0].centroid.map((d) => +d)).to.deep.equal([163, 165]);
	});

	it('all elements transform', () => {
		const result = SvgPath.fromString(
			'm 13 17 89 101 h 11 H 19 v -23 V 37 z c 2 3 5 7 29 31 C 53 59 61 67 71 73 S 127 131 137 83 s 37 41 43 47 Q 73 89 97 101 q 137 179 149 -41 T 193 197 t 199 239 Z a 281 283 0 0 0 317 331 A 293 307 30 0 0 311 313 l 2 18 L 337 347',
			SvgTransform.fromString('rotate(180 5 -5)'),
		);

		pathEquals(
			'm -3 -27 -89 -101 l -11 0 L -9 -128 l 0 23 L -9 -47 Z c -2 -3 -5 -7 -29 -31 C -43 -69 -51 -77 -61 -83 S -117 -141 -127 -93 s -37 -41 -43 -47 Q -63 -99 -87 -111 q -137 -179 -149 41 T -183 -207 t -199 -239 Z a 283 281 90 0 0 -317 -331 A 307 293 120 0 0 -301 -323 l -2 -18 L -327 -357',
			result,
		);

		expect(result.start.map((d) => +d)).to.deep.equal([-3, -27]);
		expect(result.end.map((d) => +d)).to.deep.equal([-327, -357]);
		expect(result.centroid.map((d) => +d)).to.deep.equal([-153, -175]);
	});
});
