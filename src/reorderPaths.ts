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

import { Decimal } from 'decimal.js';

import {
	SvgPathTree,
	coordinate_pair,
	coordinate_pair_sequence,
	coordinate_sequence,
	curveto_coordinate_sequence,
	coordinate_pair_triplet,
	smooth_curveto_coordinate_sequence,
	coordinate_pair_double,
	quadratic_bezier_curveto_coordinate_sequence,
	elliptical_arc_argument_sequence,
	elliptical_arc_argument,
	moveto,
	parse,
} from '@generated/svgpath';

export enum Strategy {
	CENTROID,
	START_END,
}

const extractSubpaths = (parsedPath: SvgPathTree): SvgPathTree[] => {
	const subpaths: SvgPathTree[] = [];

	let subpath: SvgPathTree = parsedPath.slice(0, 1) as SvgPathTree;

	if (!subpath.length) {
		return subpaths;
	}

	if (subpath[0][0].toUpperCase() !== 'M') {
		throw new Error('Invalid start command');
	}

	let x = (subpath[0] as moveto)[1][0][0],
		y = (subpath[0] as moveto)[1][0][1];
	let sx = x,
		sy = y;

	for (const draw of parsedPath.slice(1) as SvgPathTree) {
		const [command, args] = draw;
		const commandUppercase = command.toUpperCase();
		const isRelative = command !== commandUppercase;

		switch (commandUppercase) {
			case 'M':
				if (subpath.length) {
					subpaths.push(subpath);
					subpath = [];
				}

				if (isRelative) {
					const extraArgs: coordinate_pair_sequence = (args as coordinate_pair_sequence).slice(
						1,
					);

					x = x.plus((args as coordinate_pair_sequence)[0][0]);
					y = y.plus((args as coordinate_pair_sequence)[0][1]);

					sx = x;
					sy = y;

					subpath.push([commandUppercase, [[x, y]]]);

					if (extraArgs.length) {
						for (const coordPair of extraArgs) {
							x = x.plus(coordPair[0]);
							y = x.plus(coordPair[1]);
						}

						subpath.push(['l', extraArgs]);
					}
				} else {
					const coordPairs = args as coordinate_pair_sequence;
					sx = coordPairs[0][0];
					sy = coordPairs[0][1];
					x = coordPairs[coordPairs.length - 1][0];
					y = coordPairs[coordPairs.length - 1][1];
					subpath.push([commandUppercase, coordPairs]);
				}

				break;
			case 'L':
				if (isRelative) {
					for (const coordPair of args as coordinate_pair_sequence) {
						x = x.plus(coordPair[0]);
						y = y.plus(coordPair[1]);
					}
				} else {
					const coordPairs = args as coordinate_pair_sequence;
					x = coordPairs[coordPairs.length - 1][0];
					y = coordPairs[coordPairs.length - 1][1];
				}
				subpath.push(draw);
				break;
			case 'H':
				if (isRelative) {
					for (const xCoord of args as coordinate_sequence) {
						x = x.plus(xCoord);
					}
				} else {
					const xCoords = args as coordinate_sequence;
					x = xCoords[xCoords.length - 1];
				}
				subpath.push(draw);
				break;
			case 'V':
				if (isRelative) {
					for (const yCoord of args as coordinate_sequence) {
						y = y.plus(yCoord);
					}
				} else {
					const yCoords = args as coordinate_sequence;
					y = yCoords[yCoords.length - 1];
				}
				subpath.push(draw);
				break;
			case 'Z':
				x = sx;
				y = sy;
				subpath.push(draw);
				break;
			case 'C':
				if (isRelative) {
					for (const curvetoCoordinate of args as curveto_coordinate_sequence) {
						x = x.plus(curvetoCoordinate[2][0]);
						y = y.plus(curvetoCoordinate[2][1]);
					}
				} else {
					const curvetoCoordinates = args as curveto_coordinate_sequence;
					x = curvetoCoordinates[curvetoCoordinates.length - 1][2][0];
					y = curvetoCoordinates[curvetoCoordinates.length - 1][2][1];
				}
				subpath.push(draw);
				break;
			case 'S':
				if (isRelative) {
					for (const smoothCurvetoCoordinate of args as smooth_curveto_coordinate_sequence) {
						x = x.plus(smoothCurvetoCoordinate[1][0]);
						y = y.plus(smoothCurvetoCoordinate[1][1]);
					}
				} else {
					const smoothCurvetoCoordinates = args as smooth_curveto_coordinate_sequence;
					x =
						smoothCurvetoCoordinates[
							smoothCurvetoCoordinates.length - 1
						][1][0];
					y =
						smoothCurvetoCoordinates[
							smoothCurvetoCoordinates.length - 1
						][1][1];
				}
				subpath.push(draw);
				break;
			case 'Q':
				if (isRelative) {
					for (const quadraticBezierCurvetoCoordinate of args as quadratic_bezier_curveto_coordinate_sequence) {
						x = x.plus(quadraticBezierCurvetoCoordinate[1][0]);
						y = y.plus(quadraticBezierCurvetoCoordinate[1][1]);
					}
				} else {
					const quadraticBezierCurvetoCoordinates = args as quadratic_bezier_curveto_coordinate_sequence;
					x =
						quadraticBezierCurvetoCoordinates[
							quadraticBezierCurvetoCoordinates.length - 1
						][1][0];
					y =
						quadraticBezierCurvetoCoordinates[
							quadraticBezierCurvetoCoordinates.length - 1
						][1][1];
				}
				subpath.push(draw);
				break;
			case 'T':
				if (isRelative) {
					for (const coordPair of args as coordinate_pair_sequence) {
						x = x.plus(coordPair[0]);
						y = y.plus(coordPair[1]);
					}
				} else {
					const coordPairs = args as coordinate_pair_sequence;
					x = coordPairs[coordPairs.length - 1][0];
					y = coordPairs[coordPairs.length - 1][1];
				}
				subpath.push(draw);
				break;
			case 'A':
				if (isRelative) {
					for (const ellipticalArcArgument of args as elliptical_arc_argument_sequence) {
						x = x.plus(ellipticalArcArgument[5][0]);
						y = y.plus(ellipticalArcArgument[5][1]);
					}
				} else {
					const ellipticalArcArguments = args as elliptical_arc_argument_sequence;
					x =
						ellipticalArcArguments[
							ellipticalArcArguments.length - 1
						][5][0];
					y =
						ellipticalArcArguments[
							ellipticalArcArguments.length - 1
						][5][1];
				}
				subpath.push(draw);
				break;
		}
	}

	if (subpath.length) {
		subpaths.push(subpath);
	}

	return subpaths;
};

const convertPathCommandsToAbsolute = (
	parsedPath: SvgPathTree,
): SvgPathTree => {
	const abspath: SvgPathTree = [];

	let x: Decimal = new Decimal(0),
		y: Decimal = x;
	let sx = x,
		sy = y;

	for (const [command_, args] of parsedPath) {
		const command = command_.toUpperCase();
		const isRelative = command !== command_;

		switch (command) {
			case 'M':
				if (isRelative) {
					const coordPairs: coordinate_pair_sequence = [];
					for (const coordPair of args as coordinate_pair_sequence) {
						x = x.plus(coordPair[0]);
						y = y.plus(coordPair[1]);
						coordPairs.push([x, y]);
					}
					sx = coordPairs[0][0];
					sy = coordPairs[0][1];
					abspath.push([command, coordPairs]);
				} else {
					const coordPairs = args as coordinate_pair_sequence;
					sx = coordPairs[0][0];
					sy = coordPairs[0][1];
					x = coordPairs[coordPairs.length - 1][0];
					y = coordPairs[coordPairs.length - 1][1];
					abspath.push([command, coordPairs]);
				}
				break;
			case 'L':
				if (isRelative) {
					const coordPairs: coordinate_pair_sequence = [];
					for (const coordPair of args as coordinate_pair_sequence) {
						x = x.plus(coordPair[0]);
						y = y.plus(coordPair[1]);
						coordPairs.push([x, y]);
					}
					abspath.push([command, coordPairs]);
				} else {
					const coordPairs = args as coordinate_pair_sequence;
					x = coordPairs[coordPairs.length - 1][0];
					y = coordPairs[coordPairs.length - 1][1];
					abspath.push([command, coordPairs]);
				}
				break;
			case 'H':
				if (isRelative) {
					const xCoords: coordinate_sequence = [];
					for (const xCoord of args as coordinate_sequence) {
						x = x.plus(xCoord);
						xCoords.push(x);
					}
					abspath.push([command, xCoords]);
				} else {
					const xCoords = args as coordinate_sequence;
					x = xCoords[xCoords.length - 1];
					abspath.push([command, xCoords]);
				}
				break;
			case 'V':
				if (isRelative) {
					const yCoords: coordinate_sequence = [];
					for (const yCoord of args as coordinate_sequence) {
						y = y.plus(yCoord);
						yCoords.push(y);
					}
					abspath.push([command, yCoords]);
				} else {
					const yCoords = args as coordinate_sequence;
					y = yCoords[yCoords.length - 1];
					abspath.push([command, yCoords]);
				}
				break;
			case 'Z':
				abspath.push(['Z']);
				x = sx;
				y = sy;
				break;
			case 'C':
				if (isRelative) {
					const curvetoCoordinates: curveto_coordinate_sequence = [];
					for (const curvetoCoordinate of args as curveto_coordinate_sequence) {
						const coordPair1: [Decimal, Decimal] = [
							curvetoCoordinate[0][0].plus(x),
							curvetoCoordinate[0][1].plus(y),
						];
						const coordPair2: [Decimal, Decimal] = [
							curvetoCoordinate[1][0].plus(x),
							curvetoCoordinate[1][1].plus(y),
						];
						x = x.plus(curvetoCoordinate[2][0]);
						y = y.plus(curvetoCoordinate[2][1]);
						curvetoCoordinates.push([
							coordPair1,
							coordPair2,
							[x, y],
						]);
					}
					abspath.push([command, curvetoCoordinates]);
				} else {
					const curvetoCoordinates = args as curveto_coordinate_sequence;
					x = curvetoCoordinates[curvetoCoordinates.length - 1][2][0];
					y = curvetoCoordinates[curvetoCoordinates.length - 1][2][1];
					abspath.push([command, curvetoCoordinates]);
				}
				break;
			case 'S':
				if (isRelative) {
					const smoothCurvetoCoordinates: smooth_curveto_coordinate_sequence = [];
					for (const smoothCurvetoCoordinate of args as smooth_curveto_coordinate_sequence) {
						const coordPair2: [Decimal, Decimal] = [
							smoothCurvetoCoordinate[0][0].plus(x),
							smoothCurvetoCoordinate[0][1].plus(y),
						];
						x = x.plus(smoothCurvetoCoordinate[1][0]);
						y = y.plus(smoothCurvetoCoordinate[1][1]);
						smoothCurvetoCoordinates.push([coordPair2, [x, y]]);
					}
					abspath.push([command, smoothCurvetoCoordinates]);
				} else {
					const smoothCurvetoCoordinates = args as smooth_curveto_coordinate_sequence;
					x =
						smoothCurvetoCoordinates[
							smoothCurvetoCoordinates.length - 1
						][1][0];
					y =
						smoothCurvetoCoordinates[
							smoothCurvetoCoordinates.length - 1
						][1][1];
					abspath.push([command, smoothCurvetoCoordinates]);
				}
				break;
			case 'Q':
				if (isRelative) {
					const quadraticBezierCurvetoCoordinates: quadratic_bezier_curveto_coordinate_sequence = [];
					for (const quadraticBezierCurvetoCoordinate of args as quadratic_bezier_curveto_coordinate_sequence) {
						const coordPair1: [Decimal, Decimal] = [
							quadraticBezierCurvetoCoordinate[0][0].plus(x),
							quadraticBezierCurvetoCoordinate[0][1].plus(y),
						];
						x = x.plus(quadraticBezierCurvetoCoordinate[1][0]);
						y = y.plus(quadraticBezierCurvetoCoordinate[1][1]);
						quadraticBezierCurvetoCoordinates.push([
							coordPair1,
							[x, y],
						]);
					}
					abspath.push([command, quadraticBezierCurvetoCoordinates]);
				} else {
					const quadraticBezierCurvetoCoordinates = args as quadratic_bezier_curveto_coordinate_sequence;
					x =
						quadraticBezierCurvetoCoordinates[
							quadraticBezierCurvetoCoordinates.length - 1
						][1][0];
					y =
						quadraticBezierCurvetoCoordinates[
							quadraticBezierCurvetoCoordinates.length - 1
						][1][1];
					abspath.push([command, quadraticBezierCurvetoCoordinates]);
				}
				break;
			case 'T':
				if (isRelative) {
					const coordPairs: coordinate_pair_sequence = [];
					for (const coordPair of args as coordinate_pair_sequence) {
						x = x.plus(coordPair[0]);
						y = y.plus(coordPair[1]);
						coordPairs.push([x, y]);
					}
					abspath.push([command, coordPairs]);
				} else {
					const coordPairs = args as coordinate_pair_sequence;
					x = coordPairs[coordPairs.length - 1][0];
					y = coordPairs[coordPairs.length - 1][1];
					abspath.push([command, coordPairs]);
				}
				break;
			case 'A':
				if (isRelative) {
					const ellipticalArcArguments: elliptical_arc_argument_sequence = [];
					for (const ellipticalArcArgument of args as elliptical_arc_argument_sequence) {
						x = x.plus(ellipticalArcArgument[5][0]);
						y = y.plus(ellipticalArcArgument[5][1]);
						ellipticalArcArguments.push(
							ellipticalArcArgument
								.slice(0, 5)
								.concat([[x, y]]) as elliptical_arc_argument,
						);
					}
					abspath.push([command, ellipticalArcArguments]);
				} else {
					const ellipticalArcArguments = args as elliptical_arc_argument_sequence;
					x =
						ellipticalArcArguments[
							ellipticalArcArguments.length - 1
						][5][0];
					y =
						ellipticalArcArguments[
							ellipticalArcArguments.length - 1
						][5][1];
					abspath.push([command, ellipticalArcArguments]);
				}
				break;
		}
	}

	return abspath;
};

const computePathCentroid = (parsedPath: SvgPathTree): [Decimal, Decimal] => {
	let count = 0;
	let x: Decimal = new Decimal(0),
		y: Decimal = x;
	let sx: Decimal = x,
		sy: Decimal = y;
	let Sx: Decimal = x,
		Sy: Decimal = y;

	for (const [command, args] of parsedPath) {
		switch (command) {
			case 'M':
				sx = (args as coordinate_pair_sequence)[0][0];
				sy = (args as coordinate_pair_sequence)[0][1];
			/* fallthrough */
			case 'L':
			/* fallthrough */
			case 'T':
				for (const coordPair of args as coordinate_pair_sequence) {
					x = coordPair[0];
					y = coordPair[1];
					Sx = Sx.plus(x);
					Sy = Sy.plus(y);
					count++;
				}
				break;
			case 'Z':
				x = sx;
				y = sy;
				break;
			case 'H':
				for (const xCoord of args as coordinate_sequence) {
					x = xCoord;
					Sx = Sx.plus(x);
					Sy = Sy.plus(y);
					count++;
				}
				break;
			case 'V':
				for (const yCoord of args as coordinate_sequence) {
					y = yCoord;
					Sx = Sx.plus(x);
					Sy = Sy.plus(y);
					count++;
				}
				break;
			case 'C':
				for (const curvetoCoordinate of args as curveto_coordinate_sequence) {
					x = curvetoCoordinate[2][0];
					y = curvetoCoordinate[2][1];
					Sx = Sx.plus(x);
					Sy = Sy.plus(y);
					count++;
				}
				break;
			case 'S':
				for (const smoothCurvetoCoordinate of args as smooth_curveto_coordinate_sequence) {
					x = smoothCurvetoCoordinate[1][0];
					y = smoothCurvetoCoordinate[1][1];
					Sx = Sx.plus(x);
					Sy = Sy.plus(y);
					count++;
				}
				break;
			case 'Q':
				for (const quadraticBezierCurvetoCoordinate of args as quadratic_bezier_curveto_coordinate_sequence) {
					x = quadraticBezierCurvetoCoordinate[1][0];
					y = quadraticBezierCurvetoCoordinate[1][1];
					Sx = Sx.plus(x);
					Sy = Sy.plus(y);
					count++;
				}
				break;
			case 'A':
				for (const ellipticalArcArgument of args as elliptical_arc_argument_sequence) {
					x = ellipticalArcArgument[5][0];
					y = ellipticalArcArgument[5][1];
					Sx = Sx.plus(x);
					Sy = Sy.plus(y);
					count++;
				}
				break;
		}
	}

	return [Sx.div(count), Sy.div(count)];
};

const computeStartOfPath = (parsedPath: SvgPathTree): Decimal[] => {
	let x: Decimal = new Decimal(0),
		y: Decimal = x;

	const [command, args] = parsedPath[0];
	const firstArg = args ? args[0] : undefined;

	switch (command) {
		case 'M':
			x = (firstArg as coordinate_pair)[0];
			y = (firstArg as coordinate_pair)[1];
			break;
		default:
			break;
	}

	return [x, y];
};

const computeEndOfPath = (parsedPath: SvgPathTree): Decimal[] => {
	let x: Decimal = new Decimal(0),
		y: Decimal = x;

	const [command, args] = parsedPath[parsedPath.length - 1];
	const lastArg = args ? args[args.length - 1] : undefined;

	switch (command) {
		case 'M':
		case 'L':
		case 'T':
			x = (lastArg as coordinate_pair)[0];
			y = (lastArg as coordinate_pair)[1];
			break;
		case 'H':
			x = lastArg as Decimal;
			break;
		case 'V':
			y = lastArg as Decimal;
			break;
		case 'Z':
			[x, y] = computeStartOfPath(parsedPath);
			break;
		case 'C':
			x = (lastArg as coordinate_pair_triplet)[2][0];
			y = (lastArg as coordinate_pair_triplet)[2][1];
			break;
		case 'S':
		case 'Q':
			x = (lastArg as coordinate_pair_double)[1][0];
			y = (lastArg as coordinate_pair_double)[1][1];
			break;
		case 'A':
			x = (lastArg as elliptical_arc_argument)[5][0];
			y = (lastArg as elliptical_arc_argument)[5][1];
			break;
	}

	return [x, y];
};

const computeDistance = (
	coordTuple1: Decimal[] | undefined,
	coordTuple2: Decimal[] | undefined,
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

	const sqSum = sq.reduce((acc, cv) => acc.plus(cv), new Decimal(0));

	return sqSum.sqrt();
};

const findClosestPathToPointByCentroid = (
	parsedPath: SvgPathTree[],
	coordPair: Decimal[],
): [number, Decimal[] | undefined, Decimal] => {
	return parsedPath
		.map((subpath: SvgPathTree, index: number): [
			number,
			Decimal[] | undefined,
			Decimal,
		] => {
			const c = computePathCentroid(subpath);
			return [index, c, computeDistance(coordPair, c)];
		})
		.reduce(
			(
				acc: [number, Decimal[] | undefined, Decimal],
				cv: [number, Decimal[] | undefined, Decimal],
			): [number, Decimal[] | undefined, Decimal] => {
				if (cv[2].lt(acc[2])) {
					return cv;
				} else {
					return acc;
				}
			},
			[NaN, undefined, new Decimal(Infinity)],
		);
};

const findClosestPathToPointByStartEnd = (
	parsedPath: SvgPathTree[],
	coordPair: Decimal[],
): [number, Decimal[] | undefined, Decimal] => {
	return parsedPath
		.map((subpath: SvgPathTree, index: number): [
			number,
			Decimal[] | undefined,
			Decimal,
		] => {
			const [s, e] = [
				computeStartOfPath(subpath),
				computeEndOfPath(subpath),
			];
			return [index, e, computeDistance(coordPair, s)];
		})
		.reduce(
			(
				acc: [number, Decimal[] | undefined, Decimal],
				cv: [number, Decimal[] | undefined, Decimal],
			): [number, Decimal[] | undefined, Decimal] => {
				if (cv[2].lt(acc[2])) {
					return cv;
				} else {
					return acc;
				}
			},
			[NaN, undefined, new Decimal(Infinity)],
		);
};

type StategyFunction = (
	parsedPath: SvgPathTree[],
	coordPair: Decimal[],
) => [number, Decimal[] | undefined, Decimal];

type StategyFunctionMap = {
	[K in Strategy]: StategyFunction;
};

const StrategyClosestFunctionMap: StategyFunctionMap = {
	[Strategy.CENTROID]: findClosestPathToPointByCentroid,
	[Strategy.START_END]: findClosestPathToPointByStartEnd,
};

const sortPathsByRelativePosition = (
	parsedPaths: SvgPathTree[],
	strategy: Strategy,
	origin?: [Decimal, Decimal],
) => {
	const sortedPaths = [];
	const parsedAbsolutePaths = parsedPaths.map(convertPathCommandsToAbsolute);

	const startingPosition: Decimal[] = origin || [
		new Decimal(0),
		new Decimal(0),
	];

	let c: Decimal[] = startingPosition; // Starting position

	if (!(strategy in StrategyClosestFunctionMap)) {
		throw new Error('Invalid strategy');
	}

	while (parsedAbsolutePaths.length) {
		const [index, next] = StrategyClosestFunctionMap[strategy](
			parsedAbsolutePaths,
			c,
		);

		if (!Number.isFinite(index)) {
			throw new Error('Error computing closest subpath');
		}

		sortedPaths.push(parsedPaths[index]);
		c = next || startingPosition;
		parsedAbsolutePaths.splice(index, 1);
		parsedPaths.splice(index, 1);
	}

	return sortedPaths;
};

const reconstructPathFromParsedPath = (parsedPath: SvgPathTree): string => {
	return parsedPath
		.map(([command, args]) => {
			switch (command.toUpperCase()) {
				case 'M':
				case 'L':
				case 'T':
					return `${command}${(args as coordinate_pair_sequence)
						.flat()
						.join(' ')}`;
				case 'H':
				case 'V':
					return `${command}${(args as coordinate_sequence).join(
						' ',
					)}`;
				case 'Z':
					return 'Z';
				case 'C':
				case 'S':
				case 'Q':
					return `${command}${(args as
						| curveto_coordinate_sequence
						| smooth_curveto_coordinate_sequence
						| quadratic_bezier_curveto_coordinate_sequence)
						.flat()
						.flat()
						.join(' ')}`;
				case 'A':
					return `${command}${(args as elliptical_arc_argument_sequence)
						.flat()
						.flat()
						.map((v) => Object(v) instanceof Boolean ? +v : v)
						.join(' ')}`;
			}
		})
		.join('');
};

export const reorderPaths = (
	paths: string[],
	strategy: Strategy,
	origin?: [Decimal, Decimal],
): string[] => {
	return sortPathsByRelativePosition(
		paths
			.map((path) => parse(path))
			.map(extractSubpaths)
			.flat(),
		strategy,
		origin,
	).map(reconstructPathFromParsedPath);
};
