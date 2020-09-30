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

import { SvgTransformMatrix, parse } from '@generated/svgtransform';

import { Decimal } from 'decimal.js';

export interface Ellipse {
	rx: Decimal;
	ry: Decimal;
	φ: Decimal;
}

const degToRad = Decimal.acos(0).div(90);

const identity: SvgTransformMatrix = [
	new Decimal(1),
	new Decimal(0),
	new Decimal(0),
	new Decimal(1),
	new Decimal(0),
	new Decimal(0),
];

// Test in browser with
// const catenate = (t) => `matrix(${(()=>{const el = document.createElementNS('http://www.w3.org/2000/svg', 'g'); el.setAttribute('transform', t); const m = x.transform.baseVal.consolidate().matrix; return [m.a, m.b, m.c, m.d, m.e, m.f]})(t).join(' ')}`);
const catenateTransform = (
	A: SvgTransformMatrix,
	B: SvgTransformMatrix,
): SvgTransformMatrix => [
	A[0].mul(B[0]).plus(B[1].mul(A[2])),
	B[0].mul(A[1]).plus(B[1].mul(A[3])),
	A[0].mul(B[2]).plus(A[2].mul(B[3])),
	A[1].mul(B[2]).plus(A[3].mul(B[3])),
	A[0].mul(B[4]).plus(A[2].mul(B[5])).plus(A[4]),
	A[1].mul(B[4]).plus(A[3].mul(B[5])).plus(A[5]),
];

const parseTransform = (transform: string): SvgTransformMatrix[] => {
	try {
		return parse(transform);
	} catch (e) {
		return [];
	}
};

export class SvgTransform {
	private 𝐌: SvgTransformMatrix;

	static IDENTITY = new SvgTransform(identity);

	private constructor(𝐌: SvgTransformMatrix) {
		this.𝐌 = 𝐌;
	}

	static fromString(
		transform: string,
		CTM: SvgTransform = SvgTransform.IDENTITY,
	): SvgTransform {
		return new SvgTransform(
			[transform]
				.flatMap(parseTransform)
				.reduce(
					(acc: SvgTransformMatrix, cv: SvgTransformMatrix) =>
						catenateTransform(acc, cv),
					CTM.𝐌,
				),
		);
	}

	toString(): string {
		return `matrix(${this.𝐌.join(' ')})`;
	}

	apply(coord: [Decimal, Decimal]): [Decimal, Decimal] {
		const [a, b, c, d, e, f] = this.𝐌;
		const [x, y] = coord;

		return [
			a.mul(x).plus(c.mul(y)).plus(e),
			b.mul(x).plus(d.mul(y)).plus(f),
		];
	}

	applyRelative(coord: [Decimal, Decimal]): [Decimal, Decimal] {
		const [a, b, c, d] = this.𝐌;
		const [x, y] = coord;

		return [a.mul(x).plus(c.mul(y)), b.mul(x).plus(d.mul(y))];
	}

	applyEllipse(ellipse: Ellipse): Ellipse {
		const [a, b, c, d] = this.𝐌;

		const sinφ = degToRad.mul(ellipse.φ).sin();
		const cosφ = degToRad.mul(ellipse.φ).cos();

		const 𝐌 = [
			ellipse.rx.mul(a.mul(cosφ).plus(c.mul(sinφ))),
			ellipse.rx.mul(b.mul(cosφ).plus(d.mul(sinφ))),
			ellipse.ry.mul(c.mul(cosφ).sub(a.mul(sinφ))),
			ellipse.ry.mul(d.mul(cosφ).sub(b.mul(sinφ))),
		];
		const 𝐌𝐌ᵀ: [Decimal, Decimal, undefined, Decimal] = [
			𝐌[0].pow(2).plus(𝐌[2].pow(2)),
			𝐌[0].mul(𝐌[1]).plus(𝐌[2].mul(𝐌[3])),
			undefined,
			𝐌[1].pow(2).plus(𝐌[3].pow(2)),
		];

		const λ = 𝐌𝐌ᵀ[0].plus(𝐌𝐌ᵀ[3]);
		const Δ = Decimal.max(
			0,
			λ.pow(2).sub(𝐌𝐌ᵀ[0].mul(𝐌𝐌ᵀ[3]).sub(𝐌𝐌ᵀ[1].pow(2)).mul(4)),
		).sqrt();

		const λ1 = λ.plus(Δ).div(2);
		const λ2 = λ.sub(Δ).div(2);
		const φ = Decimal.atan2(λ1.sub(𝐌𝐌ᵀ[0]), 𝐌𝐌ᵀ[1]).div(degToRad);

		return {
			rx: λ1.sqrt(),
			ry: λ2.sqrt(),
			φ: φ,
		};
	}

	get hasRotation(): boolean {
		return !this.𝐌[1].eq(0) || !this.𝐌[2].eq(0);
	}

	get orientationPreserving(): boolean {
		return this.𝐌[0].mul(this.𝐌[3]).sub(this.𝐌[1].mul(this.𝐌[2])).gte(0);
	}
}
