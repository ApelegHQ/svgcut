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

import { Decimal } from '@exact-realty/decimal.js-float';

import { SvgTransform } from './SvgTransform';

const extractMatrixValues = (str?: string) =>
	str &&
	str
		.match(
			/^\s*matrix\(\s*([^\s,]+)[\s,]+([^\s,]+)[\s,]+([^\s,]+)[\s,]+([^\s,]+)[\s,]+([^\s,]+)[\s,]+([^\s,]+)\s*\)\s*$/,
		)
		?.slice(1)
		.map((v) => +(+v).toFixed(6))
		.map((v) => (v === 0 ? 0 : v));

const transformEllipse = (
	transform: string,
	rx: number,
	ry: number,
	φ: number,
) => {
	const result = SvgTransform.fromString(transform)?.applyEllipse({
		rx: new Decimal(rx),
		ry: new Decimal(ry),
		φ: new Decimal(φ),
	});
	return [result?.rx, result?.ry, result?.φ].map((v) =>
		v === undefined ? undefined : +v.toDP(5) || 0,
	);
};

describe('SvgTransform', () => {
	it('.fromString() should return undefined', () => {
		const result = SvgTransform.fromString();
		expect(result).to.be.undefined;
	});

	it(".fromString('') should return undefined", () => {
		const result = SvgTransform.fromString('');
		expect(result).to.be.undefined;
	});

	it(".fromString('invalid syntax') should return undefined", () => {
		const result = SvgTransform.fromString('invalid syntax');
		expect(result).to.be.undefined;
	});

	it(".fromString('invalid syntax', SvgTransform.IDENTITY) should return SvgTransform.IDENTITY", () => {
		const result = SvgTransform.fromString(
			'invalid syntax',
			SvgTransform.IDENTITY,
		);
		expect(result).to.equal(SvgTransform.IDENTITY);
	});

	it('.fromString(undefined, SvgTransform.IDENTITY) should return SvgTransform.IDENTITY', () => {
		const result = SvgTransform.fromString(
			undefined,
			SvgTransform.IDENTITY,
		);
		expect(result).to.equal(SvgTransform.IDENTITY);
	});

	it('SvgTransform.IDENTITY.catenate(undefined) should return SvgTransform.IDENTITY', () => {
		const result = SvgTransform.IDENTITY.catenate(undefined);
		expect(result).to.equal(SvgTransform.IDENTITY);
	});

	it('SvgTransform.IDENTITY.catenate(SvgTransform.IDENTITY) should return [1, 0, 0, 1, 0, 0]', () => {
		const result = SvgTransform.IDENTITY.catenate(SvgTransform.IDENTITY);
		expect(extractMatrixValues(result?.toString())).to.deep.equal([
			1, 0, 0, 1, 0, 0,
		]);
	});

	it('SvgTransform.catenate(SvgTransform.IDENTITY, undefined) should return [1, 0, 0, 1, 0, 0]', () => {
		const result = SvgTransform.catenate(SvgTransform.IDENTITY, undefined);
		expect(extractMatrixValues(result?.toString())).to.deep.equal([
			1, 0, 0, 1, 0, 0,
		]);
	});

	it("'rotate(30 97 89)' is equivalent to 'translate(97 89) rotate(30) translate(-97 -89)'", () => {
		const rotate = SvgTransform.fromString('rotate(30 97 89)');
		const rotateAndTranslate = SvgTransform.fromString(
			'translate(97 89) rotate(30) translate(-97 -89)',
		);
		expect(rotate).not.to.be.undefined;
		expect(rotateAndTranslate).not.to.be.undefined;
		expect(extractMatrixValues(rotate?.toString())).to.deep.equal([
			0.866025, 0.5, -0.5, 0.866025, 57.495536, -36.576261,
		]);
		expect(
			extractMatrixValues(rotateAndTranslate?.toString()),
		).to.deep.equal([0.866025, 0.5, -0.5, 0.866025, 57.495536, -36.576261]);
	});

	it("'scale(11)' is equivalent to 'scale(11 11)'", () => {
		const scaleSingleArg = SvgTransform.fromString('scale(11)');
		const scaleTwoArgs = SvgTransform.fromString('scale(11 11)');
		expect(scaleSingleArg).not.to.be.undefined;
		expect(scaleTwoArgs).not.to.be.undefined;
		expect(extractMatrixValues(scaleSingleArg?.toString())).to.deep.equal([
			11, 0, 0, 11, 0, 0,
		]);
		expect(extractMatrixValues(scaleTwoArgs?.toString())).to.deep.equal([
			11, 0, 0, 11, 0, 0,
		]);
	});

	it("'translate(17)' is equivalent to 'translate(17 0)'", () => {
		const translateSingleArg = SvgTransform.fromString('translate(17)');
		const translateTwoArgs = SvgTransform.fromString('translate(17 0)');
		expect(translateSingleArg).not.to.be.undefined;
		expect(translateTwoArgs).not.to.be.undefined;
		expect(
			extractMatrixValues(translateSingleArg?.toString()),
		).to.deep.equal([1, 0, 0, 1, 17, 0]);
		expect(extractMatrixValues(translateTwoArgs?.toString())).to.deep.equal(
			[1, 0, 0, 1, 17, 0],
		);
	});

	it(".fromString('', SvgTransform.IDENTITY) should return SvgTransform.IDENTITY", () => {
		const result = SvgTransform.fromString('', SvgTransform.IDENTITY);
		expect(result).to.equal(SvgTransform.IDENTITY);
	});

	it('parse coords-transformattr-01-f', () => {
		const transformStrings = [
			'translate(50 50)rotate(45)skewX(15)scale(0.8)',
			'translate(50 50),rotate(45),skewX(15),scale(0.8)',
			'translate(50 50)\u0020rotate(45)\u0020\u0020skewX(15)\u0020\u0020\u0020\u0020\u0020scale(0.8)',
			'translate(50 50)\u0009rotate(45)\u0009\u0009skewX(15)\u0009\u0009\u0009\u0009\u0009scale(0.8)',
			'translate(50 50)\u000Drotate(45)\u000D\u000DskewX(15)\u000D\u000D\u000D\u000D\u000Dscale(0.8)',
			'translate(50 50)\u000Arotate(45)\u000A\u000AskewX(15)\u000A\u000A\u000A\u000A\u000Ascale(0.8)',
			'translate(50 50),rotate(45)\u0020\u0009skewX(15)\u000D\u000Ascale(0.8)',
		];

		const values = transformStrings.map((str) =>
			SvgTransform.fromString(str),
		);

		values.forEach((transform) => {
			expect(transform).not.to.be.undefined;
			expect(transform?.hasRotation).to.be.true;
			expect(transform?.orientationPreserving).to.be.true;

			expect(extractMatrixValues(transform?.toString())).to.deep.equal([
				0.565685, 0.565685, -0.41411, 0.71726, 50, 50,
			]);
		});
	});

	it('catenate', () => {
		const inverseTransform = SvgTransform.fromString(
			'scale(1.25) skewX(-15) rotate(-45) translate(-50 -50)',
		);
		const transform = SvgTransform.fromString(
			'translate(50 50) rotate(45) skewX(15) scale(0.8)',
		);

		expect(transform).not.to.be.undefined;
		expect(inverseTransform).not.to.be.undefined;

		expect(
			extractMatrixValues(
				inverseTransform?.catenate(transform).toString(),
			),
		).to.deep.equal([1, 0, 0, 1, 0, 0]);
		expect(
			extractMatrixValues(
				transform?.catenate(inverseTransform).toString(),
			),
		).to.deep.equal([1, 0, 0, 1, 0, 0]);
	});

	it('CTM', () => {
		const inverseTransform = SvgTransform.fromString(
			'scale(1.25) skewX(-15) rotate(-45) translate(-50 -50)',
		);
		const transform = SvgTransform.fromString(
			'translate(50 50) rotate(45) skewX(15) scale(0.8)',
			inverseTransform,
		);

		expect(transform).not.to.be.undefined;
		expect(inverseTransform).not.to.be.undefined;

		expect(extractMatrixValues(transform?.toString())).to.deep.equal([
			1, 0, 0, 1, 0, 0,
		]);
	});

	it('coords-transformattr-05-f', () => {
		const outer = SvgTransform.fromString('translate(50 15)');
		const t1 = SvgTransform.fromString(
			'matrix(0.96592582628906829 0.25881904510252076 -0.25881904510252076 0.96592582628906829 0 0)',
			outer,
		);
		const t2 = SvgTransform.fromString('rotate(15)', outer);
		const inner = SvgTransform.fromString('translate(10)', t2);

		expect(outer?.hasRotation).to.be.false;
		expect(t1?.hasRotation).to.be.true;
		expect(t2?.hasRotation).to.be.true;
		expect(inner?.hasRotation).to.be.true;

		expect(outer?.orientationPreserving).to.be.true;
		expect(t1?.orientationPreserving).to.be.true;
		expect(t2?.orientationPreserving).to.be.true;
		expect(inner?.orientationPreserving).to.be.true;

		expect(extractMatrixValues(outer?.toString())).to.deep.equal([
			1, 0, 0, 1, 50, 15,
		]);
		expect(extractMatrixValues(t1?.toString())).to.deep.equal([
			0.965926, 0.258819, -0.258819, 0.965926, 50, 15,
		]);
		expect(extractMatrixValues(t2?.toString())).to.deep.equal([
			0.965926, 0.258819, -0.258819, 0.965926, 50, 15,
		]);
		expect(extractMatrixValues(inner?.toString())).to.deep.equal([
			0.965926, 0.258819, -0.258819, 0.965926, 59.659258, 17.58819,
		]);
	});

	it('coords-trans-01-b', () => {
		const testApply = (
			transform: SvgTransform | undefined,
			values: {
				input: [number, number];
				absolute: [number, number];
				relative: [number, number];
			}[],
		) => {
			values.forEach((value) => {
				const input = value.input.map((v) => new Decimal(v)) as [
					Decimal,
					Decimal,
				];
				expect(
					transform?.apply(input).map((r) => +r.toDP(5) || 0),
				).to.deep.equal(value.absolute);
				expect(
					transform?.applyRelative(input).map((r) => +r.toDP(5) || 0),
				).to.deep.equal(value.relative);
			});
		};

		const translate = SvgTransform.fromString('translate(50, 50)');
		expect(translate?.hasRotation).to.be.false;
		expect(translate?.orientationPreserving).to.be.true;
		testApply(translate, [
			{
				input: [0, 0],
				absolute: [50, 50],
				relative: [0, 0],
			},
			{
				input: [20, 0],
				absolute: [70, 50],
				relative: [20, 0],
			},
			{
				input: [0, 20],
				absolute: [50, 70],
				relative: [0, 20],
			},
		]);

		const rotate = SvgTransform.fromString(
			'translate(150, 70) rotate(-90)',
		);
		expect(rotate?.hasRotation).to.be.true;
		expect(rotate?.orientationPreserving).to.be.true;
		testApply(rotate, [
			{
				input: [0, 0],
				absolute: [150, 70],
				relative: [0, 0],
			},
			{
				input: [20, 0],
				absolute: [150, 50],
				relative: [0, -20],
			},
			{
				input: [0, 20],
				absolute: [170, 70],
				relative: [20, 0],
			},
		]);

		const skewX = SvgTransform.fromString('translate(250, 50) skewX(45)');
		expect(skewX?.hasRotation).to.be.true;
		expect(skewX?.orientationPreserving).to.be.true;
		testApply(skewX, [
			{
				input: [0, 0],
				absolute: [250, 50],
				relative: [0, 0],
			},
			{
				input: [20, 0],
				absolute: [270, 50],
				relative: [20, 0],
			},
			{
				input: [0, 20],
				absolute: [270, 70],
				relative: [20, 20],
			},
		]);

		const skewY = SvgTransform.fromString('translate(350, 50) skewY(45)');
		expect(skewY?.hasRotation).to.be.true;
		expect(skewY?.orientationPreserving).to.be.true;
		testApply(skewY, [
			{
				input: [0, 0],
				absolute: [350, 50],
				relative: [0, 0],
			},
			{
				input: [20, 0],
				absolute: [370, 70],
				relative: [20, 20],
			},
			{
				input: [0, 20],
				absolute: [350, 70],
				relative: [0, 20],
			},
		]);

		const scale2 = SvgTransform.fromString('translate(210, 120) scale(2)');
		expect(scale2?.hasRotation).to.be.false;
		expect(scale2?.orientationPreserving).to.be.true;
		testApply(scale2, [
			{
				input: [0, 0],
				absolute: [210, 120],
				relative: [0, 0],
			},
			{
				input: [20, 0],
				absolute: [250, 120],
				relative: [40, 0],
			},
			{
				input: [0, 20],
				absolute: [210, 160],
				relative: [0, 40],
			},
		]);

		const scale_translate = SvgTransform.fromString(
			'scale(3, 2) translate(16.666667, 105)',
		);
		expect(scale_translate?.hasRotation).to.be.false;
		expect(scale_translate?.orientationPreserving).to.be.true;
		testApply(scale_translate, [
			{
				input: [0, 0],
				absolute: [50, 210],
				relative: [0, 0],
			},
			{
				input: [20, 0],
				absolute: [110, 210],
				relative: [60, 0],
			},
			{
				input: [0, 20],
				absolute: [50, 250],
				relative: [0, 40],
			},
		]);

		const scale_translate_successive = SvgTransform.catenate(
			SvgTransform.fromString('translate(16.666667, 105)'),
			SvgTransform.fromString('scale(3, 2)'),
			SvgTransform.fromString('translate(200, 0)'),
		);
		expect(scale_translate_successive?.hasRotation).to.be.false;
		expect(scale_translate_successive?.orientationPreserving).to.be.true;
		testApply(scale_translate_successive, [
			{
				input: [0, 0],
				absolute: [250, 210],
				relative: [0, 0],
			},
			{
				input: [20, 0],
				absolute: [310, 210],
				relative: [60, 0],
			},
			{
				input: [0, 20],
				absolute: [250, 250],
				relative: [0, 40],
			},
		]);
	});

	it('orientationPreserving should be false', () => {
		[
			[-1, 0, 0, 1, 14, 0],
			[1, 0, 0, -1, 14, 0],
			[1, 2, 2, 1, 14, 0],
			[-1, 2, 2, -1, 14, 0],
			[-1, -2, -1, -1, 14, 0],
		]
			.map(
				(matrix) =>
					new SvgTransform(
						matrix.map((v) => new Decimal(v)) as [
							Decimal,
							Decimal,
							Decimal,
							Decimal,
							Decimal,
							Decimal,
						],
					),
			)
			.forEach((transform) => {
				expect(transform.orientationPreserving).to.be.false;
			});
	});

	it('orientationPreserving should be true', () => {
		[
			[1, 0, 0, 1, 14, 0],
			[-1, 0, 0, -1, 14, 0],
			[1, -2, 2, 1, 14, 0],
			[1, 2, -2, 1, 14, 0],
			[-1, 2, -1, -1, 14, 0],
		]
			.map(
				(matrix) =>
					new SvgTransform(
						matrix.map((v) => new Decimal(v)) as [
							Decimal,
							Decimal,
							Decimal,
							Decimal,
							Decimal,
							Decimal,
						],
					),
			)
			.forEach((transform) => {
				expect(transform.orientationPreserving).to.be.true;
			});
	});

	it('transform ellipse rotation', () => {
		expect(transformEllipse('rotate(-60)', 3, 2, 30)).to.deep.equal([
			3, 2, -30,
		]);
		expect(transformEllipse('rotate(-45)', 3, 2, 30)).to.deep.equal([
			3, 2, -15,
		]);
		expect(transformEllipse('rotate(-30)', 3, 2, 30)).to.deep.equal([
			3, 2, 0,
		]);
		expect(transformEllipse('rotate(-15)', 3, 2, 30)).to.deep.equal([
			3, 2, 15,
		]);
		expect(transformEllipse('rotate(0)  ', 3, 2, 30)).to.deep.equal([
			3, 2, 30,
		]);
		expect(transformEllipse('rotate(+15)', 3, 2, 30)).to.deep.equal([
			3, 2, 45,
		]);
		expect(transformEllipse('rotate(+30)', 3, 2, 30)).to.deep.equal([
			3, 2, 60,
		]);
		expect(transformEllipse('rotate(+45)', 3, 2, 30)).to.deep.equal([
			3, 2, 75,
		]);
		expect(transformEllipse('rotate(+60)', 3, 2, 30)).to.deep.equal([
			3, 2, 90,
		]);

		expect(transformEllipse('rotate(-60)', 3, 5, 30)).to.deep.equal([
			5, 3, 60,
		]);
		expect(transformEllipse('rotate(-45)', 3, 5, 30)).to.deep.equal([
			5, 3, 75,
		]);
		expect(transformEllipse('rotate(-30)', 3, 5, 30)).to.deep.equal([
			5, 3, 90,
		]);

		expect(transformEllipse('rotate(-15)', 3, 5, 30)).to.deep.equal([
			5, 3, -75,
		]);
		expect(transformEllipse('rotate(0)  ', 3, 5, 30)).to.deep.equal([
			5, 3, -60,
		]);
		expect(transformEllipse('rotate(+15)', 3, 5, 30)).to.deep.equal([
			5, 3, -45,
		]);
		expect(transformEllipse('rotate(+30)', 3, 5, 30)).to.deep.equal([
			5, 3, -30,
		]);
		expect(transformEllipse('rotate(+45)', 3, 5, 30)).to.deep.equal([
			5, 3, -15,
		]);
		expect(transformEllipse('rotate(+60)', 3, 5, 30)).to.deep.equal([
			5, 3, 0,
		]);
	});

	it('transform ellipse degenerate', () => {
		expect(transformEllipse('scale(1 1e-8)', 2, 2, 45)).to.deep.equal([
			0, 0, 0,
		]);
		expect(transformEllipse('scale(1e-8 1)', 3, 5, 90)).to.deep.equal([
			0, 0, 0,
		]);
		expect(transformEllipse('scale(1 1e-8)', 7, 5, -90)).to.deep.equal([
			0, 0, 0,
		]);
	});

	it('transform circle', () => {
		expect(transformEllipse('scale(1)', 2, 2, 30)).to.deep.equal([2, 2, 0]);
		expect(transformEllipse('scale(3)', 3, 3, 45)).to.deep.equal([9, 9, 0]);
	});

	it('scale ellipse', () => {
		expect(transformEllipse('scale(1)', 2, 2, 30)).to.deep.equal([2, 2, 0]);
		expect(transformEllipse('scale(2)', 2, 2, 45)).to.deep.equal([4, 4, 0]);

		// Ellipse scale transform
		expect(transformEllipse('scale(1 1.5)', 3, 2, 0)).to.deep.equal([
			3, 3, 0,
		]);
		expect(transformEllipse('scale(1 1.5)', 3, 2, 30)).to.deep.equal([
			3.68941, 2.43941, 61.01222,
		]);
		expect(transformEllipse('scale(1 1.5)', 3, 2, 60)).to.deep.equal([
			4.27187, 2.10681, 75.97256,
		]);

		expect(transformEllipse('scale(1 1.5)', 2, 3, 0)).to.deep.equal([
			4.5, 2, 90,
		]);
		expect(transformEllipse('scale(1 1.5)', 2, 3, 30)).to.deep.equal([
			4.27187, 2.10681, -75.97256,
		]);
		expect(transformEllipse('scale(1 1.5)', 2, 3, 60)).to.deep.equal([
			3.68941, 2.43941, -61.01222,
		]);
	});
});
