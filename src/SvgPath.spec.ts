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
import {
	coordinate_pair_sequence,
	elliptical_arc_argument_sequence,
	parse,
} from '@generated/svgpath';

import { SvgPath } from './SvgPath';
import { SvgTransform } from './SvgTransform';

const pathEquals = (expected: string, actual: SvgPath) => {
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

const degToRad = Decimal.acos(0).div(90);

const checkEllipse = (
	type: 'circle' | 'ellipse' | 'rect',
	cx: number,
	cy: number,
	rx: number | 'auto',
	ry: number | 'auto',
	transform: SvgTransform | undefined,
) => {
	const c = { x: new Decimal(cx), y: new Decimal(cy) };
	const ct = (() => {
		const ct_ = (transform ?? SvgTransform.IDENTITY).apply([c.x, c.y]);
		return { x: ct_[0], y: ct_[1] };
	})();
	const r = {
		x: new Decimal(rx !== 'auto' ? rx : ry !== 'auto' ? ry : 0),
		y: new Decimal(ry !== 'auto' ? ry : rx !== 'auto' ? rx : 0),
	};
	const rt = (() => {
		const args = {
			rx: r.x,
			ry: r.y,
			φ: new Decimal(0),
		};

		const rt_ = transform?.applyEllipse(args) ?? args;

		return rt_;
	})();

	const path =
		type === 'circle'
			? SvgPath.fromCircle(c.x, c.y, r.x, transform)
			: type === 'ellipse'
			? SvgPath.fromEllipse(
					c.x,
					c.y,
					rx === 'auto' ? rx : r.x,
					ry === 'auto' ? ry : r.y,
					transform,
			  )
			: SvgPath.fromRect(
					c.x.sub(r.x),
					c.y.sub(r.y),
					r.x.mul(2),
					r.y.mul(2),
					r.x,
					r.y,
					transform,
			  );

	expect(path.extractSubpaths()).to.be.an('array').that.has.lengthOf(1);

	const result = parse(path.toString());

	const p = { x: new Decimal(0), y: new Decimal(0) };
	const s = { x: new Decimal(0), y: new Decimal(0) };

	// Equations of the form θ1 + Δθ x = 0, x ∈ [0, 1]
	const eqs: [Decimal, Decimal][] = [];

	for (const draw of result) {
		const [command, args] = draw;

		expect(command).to.be.oneOf(['M', 'm', 'A', 'a', 'Z', 'z']);

		switch (command) {
			case 'M':
				[p.x, p.y] = (args as coordinate_pair_sequence)[
					(args as coordinate_pair_sequence).length - 1
				];
				[s.x, s.y] = [p.x, p.y];
				break;
			case 'm':
				[p.x, p.y] = [
					p.x.plus(
						(args as coordinate_pair_sequence)[
							(args as coordinate_pair_sequence).length - 1
						][0],
					),
					p.y.plus(
						(args as coordinate_pair_sequence)[
							(args as coordinate_pair_sequence).length - 1
						][0],
					),
				];
				[s.x, s.y] = [p.x, p.y];
				break;
			case 'A':
			case 'a':
				for (const arc of args as elliptical_arc_argument_sequence) {
					const r_ = { x: arc[0].abs(), y: arc[1].abs() };
					const e =
						command === 'A'
							? { x: arc[5][0], y: arc[5][1] }
							: {
									x: p.x.plus(arc[5][0]),
									y: p.y.plus(arc[5][1]),
							  };

					expect(
						[arc[0], arc[1], arc[2]].map((v) => +v.toDP(6)),
					).to.deep.equal(
						[rt.rx, rt.ry, rt.φ].map((v) => +v.toDP(6)),
					);

					if (r_.x.gt(0) && r_.y.gt(0)) {
						const rads = degToRad.mul(arc[2]);
						const cosφ = rads.cos();
						const sinφ = rads.sin();
						const auxT1 = new SvgTransform([
							cosφ,
							sinφ.neg(),
							sinφ,
							cosφ,
							new Decimal(0),
							new Decimal(0),
						]);
						const auxT2 = new SvgTransform([
							cosφ,
							sinφ,
							sinφ.neg(),
							cosφ,
							p.x.plus(e.x).div(2),
							p.y.plus(e.y).div(2),
						]);

						const [x1__, y1__] = auxT1.applyRelative([
							p.x.sub(e.x).div(2),
							p.y.sub(e.y).div(2),
						]);
						const Λ = Decimal.add(
							x1__.div(r_.x).pow(2),
							y1__.div(r_.y).pow(2),
						);

						if (Λ.gt(1)) {
							// § B.2.5. Correction of out-of-range radii
							const sqrtΛ = Λ.sqrt();
							[r_.x, r_.y] = [sqrtΛ.mul(r_.x), sqrtΛ.mul(r_.y)];
						}

						const sqrtH = Decimal.max(
							0,
							Decimal.div(
								r_.x
									.mul(r_.y)
									.pow(2)
									.sub(r_.x.mul(y1__).pow(2))
									.sub(r_.y.mul(x1__).pow(2)),
								Decimal.add(
									r_.x.mul(y1__).pow(2),
									r_.y.mul(x1__).pow(2),
								),
							),
						)
							.sqrt()
							.mul(+(!!arc[3] !== !!arc[4]) * 2 - 1);
						const c__ = {
							x: sqrtH.mul(r_.x.mul(y1__).div(r_.y)),
							y: sqrtH.mul(r_.y.mul(x1__).div(r_.x)).neg(),
						};
						const c_ = auxT2.apply([c__.x, c__.y]);

						// Expect c_ === c;
						expect(c_.map((v) => +v.toDP(6))).to.deep.equal(
							[ct.x, ct.y].map((v) => +v.toDP(6)),
						);

						const angle = (
							𝐮: { x: Decimal; y: Decimal },
							𝐯: { x: Decimal; y: Decimal },
						) =>
							Decimal.div(
								Decimal.add(𝐮.x.mul(𝐯.x), 𝐮.y.mul(𝐯.y)),
								Decimal.mul(
									𝐮.x.pow(2).plus(𝐮.y.pow(2)).sqrt(),
									𝐯.x.pow(2).plus(𝐯.y.pow(2)).sqrt(),
								),
							)
								.acos()
								.mul(
									𝐮.x.mul(𝐯.y).sub(𝐮.y.mul(𝐯.x)).isNegative()
										? -1
										: 1,
								);

						const 𝐮 = {
							x: x1__.sub(c__.x).div(r_.x),
							y: y1__.sub(c__.y).div(r_.y),
						};
						const 𝐯 = {
							x: x1__.neg().sub(c__.x).div(r_.x),
							y: y1__.neg().sub(c__.y).div(r_.y),
						};
						const θ1 = angle(
							{ x: new Decimal(1), y: new Decimal(0) },
							𝐮,
						);
						const Δθ = [angle(𝐮, 𝐯)].map((θ) => {
							if (!arc[4] && θ.gt(0)) {
								return θ.sub(Decimal.acos(-1).mul(2));
							} else if (arc[4] && θ.lt(0)) {
								return θ.plus(Decimal.acos(-1).mul(2));
							}
							return θ;
						})[0];

						eqs.push([θ1, Δθ]);
					}
					[p.x, p.y] = [e.x, e.y];
				}
				break;
			case 'Z':
			case 'z':
				expect([p.x, p.y].map((v) => +v.toDP(6))).to.deep.equal(
					[s.x, s.y].map((v) => +v.toDP(6)),
				);
				[p.x, p.y] = [s.x, s.y];
				break;
		}
	}

	if (eqs.length) {
		eqs.reduce((eq1, eq2) => {
			const [θ1_1, Δθ_1] = eq1;
			const [θ1_2, Δθ_2] = eq2;

			// Check all have the same sign
			const eqSlns = [
				θ1_1.sub(θ1_2),
				θ1_1.sub(θ1_2).plus(Δθ_1),
				θ1_1.sub(θ1_2).sub(Δθ_2),
				θ1_1.sub(θ1_2).plus(Δθ_1).sub(Δθ_1),
			];

			// Expect that there be no overlap in the angles
			expect(
				Math.max(
					eqSlns.filter((v) => v.toDP(6).lte(0)).length,
					eqSlns.filter((v) => v.toDP(6).gte(0)).length,
				),
			).to.equal(4);

			return eq2;
		});

		// Expect the sum of angles to be a full circle
		const sum = eqs.reduce((acc, cv) => {
			return acc.plus(cv[1].abs());
		}, new Decimal(0));

		expect(+sum.toDP(6)).to.equal(6.283185);
	}
};

describe('SvgPath', () => {
	it('.fromString() should return empty', () => {
		const result = SvgPath.fromString();

		pathEquals('', result);

		expect(result.start.map((v) => +v.toDP(6))).to.deep.equal([0, 0]);
		expect(result.end.map((v) => +v.toDP(6))).to.deep.equal([0, 0]);
		expect(result.centroid.map((v) => +v.toDP(6))).to.deep.equal([0, 0]);
	});

	it(".fromString('M 0, 0')", () => {
		const result = SvgPath.fromString('M 0, 0');

		pathEquals('M 0, 0', result);

		expect(result.start.map((v) => +v.toDP(6))).to.deep.equal([0, 0]);
		expect(result.end.map((v) => +v.toDP(6))).to.deep.equal([0, 0]);
		expect(result.centroid.map((v) => +v.toDP(6))).to.deep.equal([0, 0]);

		expect(result.start.map((v) => +v.toDP(6))).to.deep.equal([0, 0]);
		expect(result.end.map((v) => +v.toDP(6))).to.deep.equal([0, 0]);
		expect(result.centroid.map((v) => +v.toDP(6))).to.deep.equal([0, 0]);
	});

	it('l', () => {
		const result = SvgPath.fromString('M 2 3 l 5 7 11 13');

		pathEquals('M 2 3 l 5 7 11 13', result);
		pathEquals('M 2 3 L 7 10 18 23', result.toAbsoluteCommands());

		expect(result.start.map((v) => +v.toDP(6))).to.deep.equal([2, 3]);
		expect(result.end.map((v) => +v.toDP(6))).to.deep.equal([18, 23]);
		expect(result.centroid.map((v) => +v.toDP(6))).to.deep.equal([9, 12]);
	});

	it('L', () => {
		const result = SvgPath.fromString('M 2 3 L 5 7 11 13');

		pathEquals('M 2 3 L 5 7 11 13', result);
		pathEquals('M 2 3 L 5 7 11 13', result.toAbsoluteCommands());

		expect(result.start.map((v) => +v.toDP(6))).to.deep.equal([2, 3]);
		expect(result.end.map((v) => +v.toDP(6))).to.deep.equal([11, 13]);
		expect(result.centroid.map((v) => +v.toDP(6))).to.deep.equal([
			6, 7.666667,
		]);
	});

	it('h', () => {
		const result = SvgPath.fromString('M 2 3 h 5 7 11 13');

		pathEquals('M 2 3 h 5 7 11 13', result);
		pathEquals('M 2 3 H 7 14 25 38', result.toAbsoluteCommands());

		expect(result.start.map((v) => +v.toDP(6))).to.deep.equal([2, 3]);
		expect(result.end.map((v) => +v.toDP(6))).to.deep.equal([38, 3]);
		expect(result.centroid.map((v) => +v.toDP(6))).to.deep.equal([17.2, 3]);
	});

	it('H', () => {
		const result = SvgPath.fromString('M 2 3 H 5 7 11 13');

		pathEquals('M 2 3 H 5 7 11 13', result);
		pathEquals('M 2 3 H 5 7 11 13', result.toAbsoluteCommands());

		expect(result.start.map((v) => +v.toDP(6))).to.deep.equal([2, 3]);
		expect(result.end.map((v) => +v.toDP(6))).to.deep.equal([13, 3]);
		expect(result.centroid.map((v) => +v.toDP(6))).to.deep.equal([7.6, 3]);
	});

	it('v', () => {
		const result = SvgPath.fromString('M 2 3 v 5 7 11 13');

		pathEquals('M 2 3 v 5 7 11 13', result);
		pathEquals('M 2 3 V 8 15 26 39', result.toAbsoluteCommands());

		expect(result.start.map((v) => +v.toDP(6))).to.deep.equal([2, 3]);
		expect(result.end.map((v) => +v.toDP(6))).to.deep.equal([2, 39]);
		expect(result.centroid.map((v) => +v.toDP(6))).to.deep.equal([2, 18.2]);
	});

	it('V', () => {
		const result = SvgPath.fromString('M 2 3 V 5 7 11 13');

		pathEquals('M 2 3 V 5 7 11 13', result);
		pathEquals('M 2 3 V 5 7 11 13', result.toAbsoluteCommands());

		expect(result.start.map((v) => +v.toDP(6))).to.deep.equal([2, 3]);
		expect(result.end.map((v) => +v.toDP(6))).to.deep.equal([2, 13]);
		expect(result.centroid.map((v) => +v.toDP(6))).to.deep.equal([2, 7.8]);
	});

	it('c', () => {
		const result = SvgPath.fromString('M 2 3 c 5 7 11 13 17 19');

		pathEquals('M 2 3 c 5 7 11 13 17 19', result);
		pathEquals('M 2 3 C 7 10 13 16 19 22', result.toAbsoluteCommands());

		expect(result.start.map((v) => +v.toDP(6))).to.deep.equal([2, 3]);
		expect(result.end.map((v) => +v.toDP(6))).to.deep.equal([19, 22]);
		expect(result.centroid.map((v) => +v.toDP(6))).to.deep.equal([
			10.5, 12.5,
		]);
	});

	it('C', () => {
		const result = SvgPath.fromString('M 2 3 C 5 7 11 13 17 19');

		pathEquals('M 2 3 C 5 7 11 13 17 19', result);
		pathEquals('M 2 3 C 5 7 11 13 17 19', result.toAbsoluteCommands());

		expect(result.start.map((v) => +v.toDP(6))).to.deep.equal([2, 3]);
		expect(result.end.map((v) => +v.toDP(6))).to.deep.equal([17, 19]);
		expect(result.centroid.map((v) => +v.toDP(6))).to.deep.equal([9.5, 11]);
	});

	it('s', () => {
		const result = SvgPath.fromString('M 2 3 s 5 7 11 13');

		pathEquals('M 2 3 s 5 7 11 13', result);
		pathEquals('M 2 3 S 7 10 13 16', result.toAbsoluteCommands());

		expect(result.start.map((v) => +v.toDP(6))).to.deep.equal([2, 3]);
		expect(result.end.map((v) => +v.toDP(6))).to.deep.equal([13, 16]);
		expect(result.centroid.map((v) => +v.toDP(6))).to.deep.equal([
			7.5, 9.5,
		]);
	});

	it('S', () => {
		const result = SvgPath.fromString('M 2 3 S 5 7 11 13');

		pathEquals('M 2 3 S 5 7 11 13', result);
		pathEquals('M 2 3 S 5 7 11 13', result.toAbsoluteCommands());

		expect(result.start.map((v) => +v.toDP(6))).to.deep.equal([2, 3]);
		expect(result.end.map((v) => +v.toDP(6))).to.deep.equal([11, 13]);
		expect(result.centroid.map((v) => +v.toDP(6))).to.deep.equal([6.5, 8]);
	});

	it('q', () => {
		const result = SvgPath.fromString('M 2 3 q 5 7 11 13');

		pathEquals('M 2 3 q 5 7 11 13', result);
		pathEquals('M 2 3 Q 7 10 13 16', result.toAbsoluteCommands());

		expect(result.start.map((v) => +v.toDP(6))).to.deep.equal([2, 3]);
		expect(result.end.map((v) => +v.toDP(6))).to.deep.equal([13, 16]);
		expect(result.centroid.map((v) => +v.toDP(6))).to.deep.equal([
			7.5, 9.5,
		]);
	});

	it('Q', () => {
		const result = SvgPath.fromString('M 2 3 Q 5 7 11 13');

		pathEquals('M 2 3 Q 5 7 11 13', result);
		pathEquals('M 2 3 Q 5 7 11 13', result.toAbsoluteCommands());

		expect(result.start.map((v) => +v.toDP(6))).to.deep.equal([2, 3]);
		expect(result.end.map((v) => +v.toDP(6))).to.deep.equal([11, 13]);
		expect(result.centroid.map((v) => +v.toDP(6))).to.deep.equal([6.5, 8]);
	});

	it('t', () => {
		const result = SvgPath.fromString('M 2 3 t 5 7 11 13');

		pathEquals('M 2 3 t 5 7 11 13', result);
		pathEquals('M 2 3 T 7 10 18 23', result.toAbsoluteCommands());

		expect(result.start.map((v) => +v.toDP(6))).to.deep.equal([2, 3]);
		expect(result.end.map((v) => +v.toDP(6))).to.deep.equal([18, 23]);
		expect(result.centroid.map((v) => +v.toDP(6))).to.deep.equal([9, 12]);
	});

	it('T', () => {
		const result = SvgPath.fromString('M 2 3 T 5 7 11 13');

		pathEquals('M 2 3 T 5 7 11 13', result);
		pathEquals('M 2 3 T 5 7 11 13', result.toAbsoluteCommands());

		expect(result.start.map((v) => +v.toDP(6))).to.deep.equal([2, 3]);
		expect(result.end.map((v) => +v.toDP(6))).to.deep.equal([11, 13]);
		expect(result.centroid.map((v) => +v.toDP(6))).to.deep.equal([
			6, 7.666667,
		]);
	});

	it('a', () => {
		const result = SvgPath.fromString('M 2 3 a 13 17 11 0 1 5 7');

		pathEquals('M 2 3 a 13 17 11 0 1 5 7', result);
		pathEquals('M 2 3 A 13 17 11 0 1 7 10', result.toAbsoluteCommands());

		expect(result.start.map((v) => +v.toDP(6))).to.deep.equal([2, 3]);
		expect(result.end.map((v) => +v.toDP(6))).to.deep.equal([7, 10]);
		expect(result.centroid.map((v) => +v.toDP(6))).to.deep.equal([
			4.5, 6.5,
		]);
	});

	it('A', () => {
		const result = SvgPath.fromString('M 2 3 A 13 17 11 0 1 5 7');

		pathEquals('M 2 3 A 13 17 11 0 1 5 7', result);
		pathEquals('M 2 3 A 13 17 11 0 1 5 7', result.toAbsoluteCommands());

		expect(result.start.map((v) => +v.toDP(6))).to.deep.equal([2, 3]);
		expect(result.end.map((v) => +v.toDP(6))).to.deep.equal([5, 7]);
		expect(result.centroid.map((v) => +v.toDP(6))).to.deep.equal([3.5, 5]);
	});

	it(".fromPolygon('1 2 3 4')", () => {
		const result = SvgPath.fromPolygon('1 2 3 4');

		pathEquals('M 1 2 3 4 Z', result);

		expect(result.start.map((v) => +v.toDP(6))).to.deep.equal([1, 2]);
		expect(result.end.map((v) => +v.toDP(6))).to.deep.equal([1, 2]);
		expect(result.centroid.map((v) => +v.toDP(6))).to.deep.equal([2, 3]);
	});

	it(".fromPolygon('1 2 3 4', 'skewX(56.3099325) skewY(51.3401917)')", () => {
		const result = SvgPath.fromPolygon(
			'1 2 3 4',
			SvgTransform.fromString('skewX(56.3099325) skewY(51.3401917)'),
		);

		pathEquals('M 5.875 3.25 14.625 7.75 Z', result);

		expect(result.start.map((d) => +d.toDP(6))).to.deep.equal([
			5.875, 3.25,
		]);
		expect(result.end.map((d) => +d.toDP(6))).to.deep.equal([5.875, 3.25]);
		expect(result.centroid.map((d) => +d.toDP(6))).to.deep.equal([
			10.25, 5.5,
		]);
	});

	it(".fromPolyline('1 2 3 4')", () => {
		const result = SvgPath.fromPolyline('1 2 3 4');

		pathEquals('M 1 2 3 4', result);

		expect(result.start.map((v) => +v.toDP(6))).to.deep.equal([1, 2]);
		expect(result.end.map((v) => +v.toDP(6))).to.deep.equal([3, 4]);
		expect(result.centroid.map((v) => +v.toDP(6))).to.deep.equal([2, 3]);
	});

	it(".fromPolyline('1 2 3 4', 'skewX(56.3099325) skewY(51.3401917)')", () => {
		const result = SvgPath.fromPolyline(
			'1 2 3 4',
			SvgTransform.fromString('skewX(56.3099325) skewY(51.3401917)'),
		);

		pathEquals('M 5.875 3.25 14.625 7.75', result);

		expect(result.start.map((d) => +d.toDP(6))).to.deep.equal([
			5.875, 3.25,
		]);
		expect(result.end.map((d) => +d.toDP(6))).to.deep.equal([14.625, 7.75]);
		expect(result.centroid.map((d) => +d.toDP(6))).to.deep.equal([
			10.25, 5.5,
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

		expect(result.start.map((v) => +v.toDP(6))).to.deep.equal([2, 3]);
		expect(result.end.map((v) => +v.toDP(6))).to.deep.equal([5, 7]);
		expect(result.centroid.map((v) => +v.toDP(6))).to.deep.equal([3.5, 5]);
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
			9.227241, 3.598076,
		]);
		expect(result.end.map((d) => +d.toDP(6))).to.deep.equal([
			22.235572, 8.562178,
		]);
		expect(result.centroid.map((d) => +d.toDP(6))).to.deep.equal([
			15.731406, 6.080127,
		]);
	});

	it('.fromCircle(23, 29, 11)', () => {
		checkEllipse('circle', 23, 29, 11, 'auto', undefined);
	});

	it('.fromCircle(23, 29, 11, undefined, SvgTransform.IDENTITY)', () => {
		checkEllipse('circle', 23, 29, 11, 'auto', SvgTransform.IDENTITY);
	});

	it(".fromCircle(23, 29, 11, undefined, 'skewX(25)')", () => {
		checkEllipse(
			'circle',
			23,
			29,
			11,
			'auto',
			SvgTransform.fromString('skewX(25)'),
		);
	});

	it('.fromEllipse(599, 601, 457, 337)', () => {
		checkEllipse('ellipse', 599, 601, 457, 337, undefined);
	});

	it(".fromEllipse(599, 601, 457, 'auto')", () => {
		checkEllipse('ellipse', 599, 601, 457, 'auto', undefined);
	});

	it(".fromEllipse(599, 601, 'auto', 337)", () => {
		checkEllipse('ellipse', 599, 601, 'auto', 337, undefined);
	});

	it(".fromEllipse(599, 601, 'auto', 'auto')", () => {
		checkEllipse('ellipse', 599, 601, 'auto', 'auto', undefined);
	});

	it('.fromEllipse(599, 601, 457, 337, SvgTransform.IDENTITY)', () => {
		checkEllipse('ellipse', 599, 601, 457, 337, SvgTransform.IDENTITY);
	});

	it(".fromEllipse(599, 601, 457, 337, 'scale(-1 1)')", () => {
		checkEllipse(
			'ellipse',
			599,
			601,
			457,
			337,
			SvgTransform.fromString('scale(-1 1)'),
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

	it('.fromRect(199, 211, 223, 227, 223/2, 227/2)', () => {
		checkEllipse(
			'rect',
			199 + 223 / 2,
			211 + 227 / 2,
			223 / 2,
			227 / 2,
			SvgTransform.IDENTITY,
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

		expect(result.start.map((v) => +v.toDP(6))).to.deep.equal([19, 31]);
		expect(result.end.map((v) => +v.toDP(6))).to.deep.equal([19, 31]);
		expect(result.centroid.map((v) => +v.toDP(6))).to.deep.equal([
			24.75, 36.75,
		]);

		expect(result.start.map((v) => +v.toDP(6))).to.deep.equal([19, 31]);
		expect(result.end.map((v) => +v.toDP(6))).to.deep.equal([19, 31]);
		expect(result.centroid.map((v) => +v.toDP(6))).to.deep.equal([
			24.75, 36.75,
		]);
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
			'm 13 17 89 101 h 11 H 19 v -23 V 37 z c 2 3 5 7 29 31 C 53 59 61 67 71 73 S 127 131 137 83 s 37 41 43 47 Q 73 89 97 101 q 137 179 149 -41 T 193 197 t 199 239 Z a 281 283 0 0 0 317 331 A 293 307 30 0 0 311 313 l 2 18 L 337 347 m 1 2 3 4 M 1 2 3 4',
		).extractSubpaths();

		expect(paths).to.be.an('array').that.has.lengthOf(3);

		pathEquals(
			'm 13 17 89 101 h 11 H 19 v -23 V 37 Z c 2 3 5 7 29 31 C 53 59 61 67 71 73 S 127 131 137 83 s 37 41 43 47 Q 73 89 97 101 q 137 179 149 -41 T 193 197 t 199 239 Z a 281 283 0 0 0 317 331 A 293 307 30 0 0 311 313 l 2 18 L 337 347',
			paths[0],
		);

		pathEquals('M 338 349 l 3 4', paths[1]);

		pathEquals('M 1 2 3 4', paths[2]);

		pathEquals(
			'M 13 17 102 118 H 113 H 19 V 95 V 37 Z C 15 20 18 24 42 48 C 53 59 61 67 71 73 S 127 131 137 83 S 174 124 180 130 Q 73 89 97 101 Q 234 280 246 60 T 193 197 T 392 436 Z A 281 283 0 0 0 330 348 A 293 307 30 0 0 311 313 L 313 331 L 337 347',
			paths[0].toAbsoluteCommands(),
		);

		expect(paths[0].start.map((v) => +v.toDP(6))).to.deep.equal([13, 17]);
		expect(paths[0].end.map((v) => +v.toDP(6))).to.deep.equal([337, 347]);
		expect(paths[0].centroid.map((v) => +v.toDP(6))).to.deep.equal([
			163, 165,
		]);
	});

	it('all elements transform', () => {
		const result = SvgPath.fromString(
			'm 13 17 89 101 h 11 H 19 v -23 V 37 z c 2 3 5 7 29 31 C 53 59 61 67 71 73 S 127 131 137 83 s 37 41 43 47 Q 73 89 97 101 q 137 179 149 -41 T 193 197 t 199 239 Z a 281 283 0 0 0 317 331 A 293 307 30 0 0 311 313 l 2 18 L 337 347',
			SvgTransform.fromString('rotate(180 5 -5)'),
		);

		pathEquals(
			'm -3 -27 -89 -101 l -11 0 L -9 -128 l 0 23 L -9 -47 Z c -2 -3 -5 -7 -29 -31 C -43 -69 -51 -77 -61 -83 S -117 -141 -127 -93 s -37 -41 -43 -47 Q -63 -99 -87 -111 q -137 -179 -149 41 T -183 -207 t -199 -239 Z a 283 281 90 0 0 -317 -331 A 307 293 -60 0 0 -301 -323 l -2 -18 L -327 -357',
			result,
		);

		expect(result.start.map((v) => +v.toDP(6))).to.deep.equal([-3, -27]);
		expect(result.end.map((v) => +v.toDP(6))).to.deep.equal([-327, -357]);
		expect(result.centroid.map((v) => +v.toDP(6))).to.deep.equal([
			-153, -175,
		]);
	});
});
