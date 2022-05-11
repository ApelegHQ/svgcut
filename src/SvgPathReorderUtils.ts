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

import { Decimal } from '@exact-realty/decimal.js-float';
import { SvgPath } from './SvgPath';

export enum Strategy {
	CENTROID,
	START_END,
}

interface StrategyResult {
	index: number;
	distance: Decimal;
	next?: Decimal[];
}

type StategyFunction = (
	paths: SvgPath[],
	coordPair: Decimal[],
) => StrategyResult;

type StategyFunctionMap = {
	[K in Strategy]: StategyFunction;
};

const zero = new Decimal(0);

const computeDistance = (
	coordTuple1?: Decimal[],
	coordTuple2?: Decimal[],
): Decimal => {
	if (
		!coordTuple1 ||
		!coordTuple2 ||
		coordTuple1.length !== coordTuple2.length
	) {
		return new Decimal(NaN);
	}

	const sq = [];

	for (let i = 0; i < coordTuple1.length; i++) {
		sq.push(coordTuple2[i].sub(coordTuple1[i]).pow(2));
	}

	const sqSum = sq.reduce((acc, cv) => acc.plus(cv), zero);

	return sqSum.sqrt();
};

const findClosestPathToPointByCentroid: StategyFunction = (
	paths: SvgPath[],
	coordPair: Decimal[],
): StrategyResult => {
	return paths
		.map((path: SvgPath, index: number) => {
			const c = path.centroid;
			return {
				index: index,
				distance: computeDistance(coordPair, c),
				next: c,
			};
		})
		.reduce(
			(acc: StrategyResult, cv: StrategyResult): StrategyResult =>
				cv.distance.lt(acc.distance) ? cv : acc,
			{
				index: NaN,
				distance: new Decimal(Infinity),
			},
		);
};

const findClosestPathToPointByStartEnd: StategyFunction = (
	paths: SvgPath[],
	coordPair: Decimal[],
): StrategyResult => {
	return paths
		.map((path: SvgPath, index: number) => {
			const [s, e] = [path.start, path.end];
			return {
				index: index,
				distance: computeDistance(coordPair, s),
				next: e,
			};
		})
		.reduce(
			(acc: StrategyResult, cv: StrategyResult): StrategyResult =>
				cv.distance.lt(acc.distance) ? cv : acc,
			{
				index: NaN,
				distance: new Decimal(Infinity),
			},
		);
};

const StrategyClosestFunctionMap: StategyFunctionMap = {
	[Strategy.CENTROID]: findClosestPathToPointByCentroid,
	[Strategy.START_END]: findClosestPathToPointByStartEnd,
};

export const sortPathsByRelativePosition = (
	paths: SvgPath[],
	strategy: Strategy,
	origin: [Decimal, Decimal] = [zero, zero],
): SvgPath[] => {
	const sortedPaths = [];

	const startingPosition: Decimal[] = origin;

	let c: Decimal[] = startingPosition; // Starting position

	if (!(strategy in StrategyClosestFunctionMap)) {
		throw new Error('Invalid strategy');
	}

	while (paths.length) {
		const { index, next } = StrategyClosestFunctionMap[strategy](paths, c);

		if (!Number.isFinite(index)) {
			throw new Error('Error computing closest subpath');
		}

		sortedPaths.push(paths[index]);
		c = next ?? startingPosition;
		paths.splice(index, 1);
	}

	return sortedPaths;
};
