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

import { Decimal } from '@Exact-Realty/decimal.js-float';

import { SvgPath } from './SvgPath';
import { Strategy, sortPathsByRelativePosition } from './SvgPathReorderUtils';

describe('SvgPathReorderUtils', () => {
	it('CENTROID strategy relative to (0, 0)', () => {
		const path1 = SvgPath.fromString('M 45 45 h 10 v 10 h -10 v -10 Z');
		const path2 = SvgPath.fromString('M 90 0  h 10 v 10 h -10 v -10 Z');
		const path3 = SvgPath.fromString('M 0  90 h 10 v 10 h -10 v -10 Z');

		const result = sortPathsByRelativePosition(
			[path2, path3, path1],
			Strategy.CENTROID,
		);

		expect(result).to.deep.equal([path1, path2, path3]);
	});

	it('CENTROID strategy relative to (0, 45)', () => {
		const path1 = SvgPath.fromString('M 45 45 h 10 v 10 h -10 v -10 Z');
		const path2 = SvgPath.fromString('M 90 0  h 10 v 10 h -10 v -10 Z');
		const path3 = SvgPath.fromString('M 0  90 h 10 v 10 h -10 v -10 Z');

		const result = sortPathsByRelativePosition(
			[path2, path3, path1],
			Strategy.CENTROID,
			[new Decimal(0), new Decimal(45)],
		);

		expect(result).to.deep.equal([path3, path1, path2]);
	});

	it('START_END strategy relative to (0, 0)', () => {
		const path1 = SvgPath.fromString('M 45 45 h 10 v 10 h -10 v -10 Z');
		const path2 = SvgPath.fromString('M 90 0  h 10 v 10 h -10 v -10 Z');
		const path3 = SvgPath.fromString('M 0  90 h 10 v 10 h -10 v -10 Z');

		const result = sortPathsByRelativePosition(
			[path2, path3, path1],
			Strategy.START_END,
		);

		expect(result).to.deep.equal([path1, path2, path3]);
	});

	it('START_END strategy relative to (0, 45)', () => {
		const path1 = SvgPath.fromString('M 45 45 h 10 v 10 h -10 v -10 Z');
		const path2 = SvgPath.fromString('M 90 0  h 10 v 10 h -10 v -10 Z');
		const path3 = SvgPath.fromString('M 0  90 h 10 v 10 h -10 v -10 Z');

		const result = sortPathsByRelativePosition(
			[path2, path3, path1],
			Strategy.START_END,
			[new Decimal(0), new Decimal(45)],
		);

		expect(result).to.deep.equal([path3, path1, path2]);
	});

	it('error on invalid strategy', () => {
		expect(() =>
			sortPathsByRelativePosition([], ('x' as unknown) as Strategy),
		).to.throw();
	});
});
