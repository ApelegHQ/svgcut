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
	drawto_command,
	moveto,
	parse as parseSvgPath,
} from '@generated/svgpath';

import { SvgTransform } from './SvgTransform';
import { Decimal } from 'decimal.js';

const zero = new Decimal(0);

const HVtoL = (tree: SvgPathTree): SvgPathTree => {
	let x: Decimal = zero,
		y: Decimal = zero;
	let sx = x,
		sy = y;

	const outTree: SvgPathTree = [];

	for (const [command, args] of tree) {
		const command_ = command.toUpperCase();
		const isRelative = command !== command_;

		switch (command_) {
			case 'M': {
				const coordPairs = args as coordinate_pair_sequence;
				if (isRelative) {
					sx = x.plus(coordPairs[0][0]);
					sy = y.plus(coordPairs[0][1]);
					[x, y] = coordPairs.reduce(
						(acc, cv) => [acc[0].plus(cv[0]), acc[1].plus(cv[1])],
						[x, y],
					);
				} else {
					sx = coordPairs[0][0];
					sy = coordPairs[0][1];
					[x, y] = coordPairs[coordPairs.length - 1];
				}
				outTree.push([command as 'M' | 'm', coordPairs]);
				break;
			}
			case 'L': {
				const coordPairs = args as coordinate_pair_sequence;
				if (isRelative) {
					[x, y] = coordPairs.reduce(
						(acc, cv) => [acc[0].plus(cv[0]), acc[1].plus(cv[1])],
						[x, y],
					);
				} else {
					[x, y] = coordPairs[coordPairs.length - 1];
				}
				outTree.push([command as 'L' | 'l', coordPairs]);
				break;
			}
			case 'H': {
				const xCoords = args as coordinate_sequence;
				if (isRelative) {
					x = xCoords.reduce((acc, cv) => acc.plus(cv), x);
					outTree.push(['l', xCoords.map((x) => [x, zero])]);
				} else {
					x = xCoords[xCoords.length - 1];
					outTree.push(['L', xCoords.map((x) => [x, y])]);
				}
				break;
			}
			case 'V': {
				const yCoords = args as coordinate_sequence;
				if (isRelative) {
					y = yCoords.reduce((acc, cv) => acc.plus(cv), y);
					outTree.push(['l', yCoords.map((y) => [zero, y])]);
				} else {
					y = yCoords[yCoords.length - 1];
					outTree.push(['L', yCoords.map((y) => [x, y])]);
				}
				break;
			}
			case 'Z':
				outTree.push(['Z']);
				[x, y] = [sx, sy];
				break;
			case 'C': {
				const curvetoCoordinates = args as curveto_coordinate_sequence;
				if (isRelative) {
					[x, y] = curvetoCoordinates.reduce(
						(acc, cv) => [
							acc[0].plus(cv[2][0]),
							acc[1].plus(cv[2][1]),
						],
						[x, y],
					);
				} else {
					[x, y] = curvetoCoordinates[
						curvetoCoordinates.length - 1
					][2];
				}
				outTree.push([command as 'C' | 'c', curvetoCoordinates]);
				break;
			}
			case 'S': {
				const smoothCurvetoCoordinates = args as smooth_curveto_coordinate_sequence;
				if (isRelative) {
					[x, y] = smoothCurvetoCoordinates.reduce(
						(acc, cv) => [
							acc[0].plus(cv[1][0]),
							acc[1].plus(cv[1][1]),
						],
						[x, y],
					);
				} else {
					[x, y] = smoothCurvetoCoordinates[
						smoothCurvetoCoordinates.length - 1
					][1];
				}
				outTree.push([command as 'S' | 's', smoothCurvetoCoordinates]);
				break;
			}
			case 'Q': {
				const quadraticBezierCurvetoCoordinates = args as quadratic_bezier_curveto_coordinate_sequence;
				if (isRelative) {
					[x, y] = quadraticBezierCurvetoCoordinates.reduce(
						(acc, cv) => [
							acc[0].plus(cv[1][0]),
							acc[1].plus(cv[1][1]),
						],
						[x, y],
					);
				} else {
					[x, y] = quadraticBezierCurvetoCoordinates[
						quadraticBezierCurvetoCoordinates.length - 1
					][1];
				}
				outTree.push([
					command as 'Q' | 'q',
					quadraticBezierCurvetoCoordinates,
				]);
				break;
			}
			case 'T': {
				const coordPairs = args as coordinate_pair_sequence;
				if (isRelative) {
					[x, y] = coordPairs.reduce(
						(acc, cv) => [acc[0].plus(cv[0]), acc[1].plus(cv[1])],
						[x, y],
					);
				} else {
					[x, y] = coordPairs[coordPairs.length - 1];
				}
				outTree.push([command as 'T' | 't', coordPairs]);
				break;
			}
			case 'A': {
				const ellipticalArcArguments = args as elliptical_arc_argument_sequence;
				if (isRelative) {
					[x, y] = ellipticalArcArguments.reduce(
						(acc, cv) => [
							acc[0].plus(cv[5][0]),
							acc[1].plus(cv[5][1]),
						],
						[x, y],
					);
				} else {
					[x, y] = ellipticalArcArguments[
						ellipticalArcArguments.length - 1
					][5];
				}
				outTree.push([command as 'A' | 'a', ellipticalArcArguments]);
				break;
			}
			default:
				throw new Error(`Invalid command ${command}`);
		}
	}

	return outTree;
};

const transformTree = (
	tree: SvgPathTree,
	transform?: SvgTransform,
): SvgPathTree => {
	if (!transform) {
		return tree;
	} else if (transform.hasRotation) {
		tree = HVtoL(tree);
	}

	return tree.map(
		([command, args]): drawto_command => {
			const command_ = command.toUpperCase();
			const isRelative = command !== command_;

			switch (command_) {
				case 'M':
					return [
						command as 'M' | 'm',
						(args as coordinate_pair_sequence).map((c, i) =>
							isRelative && i > 0
								? transform.applyRelative(c)
								: transform.apply(c),
						),
					];
				case 'L':
					return [
						command as 'L' | 'l',
						(args as coordinate_pair_sequence).map((c) =>
							isRelative
								? transform.applyRelative(c)
								: transform.apply(c),
						),
					];
				case 'T':
					return [
						command as 'T' | 't',
						(args as coordinate_pair_sequence).map((c) =>
							isRelative
								? transform.applyRelative(c)
								: transform.apply(c),
						),
					];
				case 'H':
					return [
						command as 'H' | 'h',
						(args as coordinate_sequence).map(
							(c) =>
								(isRelative
									? transform.applyRelative([c, zero])
									: transform.apply([c, zero]))[0],
						),
					];
				case 'V':
					return [
						command as 'V' | 'v',
						(args as coordinate_sequence).map(
							(c) =>
								(isRelative
									? transform.applyRelative([zero, c])
									: transform.apply([zero, c]))[1],
						),
					];
				case 'Z':
					return [command as 'Z' | 'z'];
				case 'C':
					return [
						command as 'C' | 'c',
						(args as curveto_coordinate_sequence).map(
							(cs: coordinate_pair_triplet) =>
								cs.map((c) =>
									isRelative
										? transform.applyRelative(c)
										: transform.apply(c),
								) as coordinate_pair_triplet,
						),
					];
				case 'S':
					return [
						command as 'S' | 's',
						(args as smooth_curveto_coordinate_sequence).map(
							(cs: coordinate_pair_double) =>
								cs.map((c) =>
									isRelative
										? transform.applyRelative(c)
										: transform.apply(c),
								) as coordinate_pair_double,
						),
					];
				case 'Q':
					return [
						command as 'Q' | 'q',
						(args as quadratic_bezier_curveto_coordinate_sequence).map(
							(cs: coordinate_pair_double) =>
								cs.map((c) =>
									isRelative
										? transform.applyRelative(c)
										: transform.apply(c),
								) as coordinate_pair_double,
						),
					];
				case 'A':
					return [
						command as 'A' | 'a',
						(args as elliptical_arc_argument_sequence).map(
							(arc) => {
								const ellipse = transform.applyEllipse({
									rx: arc[0],
									ry: arc[1],
									φ: arc[2],
								});

								return [
									ellipse.rx,
									ellipse.ry,
									ellipse.φ,
									arc[3],
									!(
										+arc[4] ^
										+transform.orientationPreserving
									),
									isRelative
										? transform.applyRelative(arc[5])
										: transform.apply(arc[5]),
								];
							},
						),
					];
			}

			return ['Z'];
		},
	);
};

export class SvgPath {
	private _tree: SvgPathTree;
	private _absoluteTree?: SvgPathTree;
	private _start?: [Decimal, Decimal];
	private _end?: [Decimal, Decimal];
	private _centroid?: [Decimal, Decimal];

	private constructor(tree: SvgPathTree, transform?: SvgTransform) {
		this._tree = transformTree(tree, transform);
	}

	toAbsoluteCommands(): SvgPath {
		if (this._absoluteTree) {
			return new SvgPath(this._absoluteTree);
		}

		const absTree: SvgPathTree = [];

		let x: Decimal = zero,
			y: Decimal = zero;
		let sx = x,
			sy = y;

		for (const [command_, args] of this._tree) {
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
						absTree.push([command, coordPairs]);
					} else {
						const coordPairs = args as coordinate_pair_sequence;
						sx = coordPairs[0][0];
						sy = coordPairs[0][1];
						x = coordPairs[coordPairs.length - 1][0];
						y = coordPairs[coordPairs.length - 1][1];
						absTree.push([command, coordPairs]);
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
						absTree.push([command, coordPairs]);
					} else {
						const coordPairs = args as coordinate_pair_sequence;
						x = coordPairs[coordPairs.length - 1][0];
						y = coordPairs[coordPairs.length - 1][1];
						absTree.push([command, coordPairs]);
					}
					break;
				case 'H':
					if (isRelative) {
						const xCoords: coordinate_sequence = [];
						for (const xCoord of args as coordinate_sequence) {
							x = x.plus(xCoord);
							xCoords.push(x);
						}
						absTree.push([command, xCoords]);
					} else {
						const xCoords = args as coordinate_sequence;
						x = xCoords[xCoords.length - 1];
						absTree.push([command, xCoords]);
					}
					break;
				case 'V':
					if (isRelative) {
						const yCoords: coordinate_sequence = [];
						for (const yCoord of args as coordinate_sequence) {
							y = y.plus(yCoord);
							yCoords.push(y);
						}
						absTree.push([command, yCoords]);
					} else {
						const yCoords = args as coordinate_sequence;
						y = yCoords[yCoords.length - 1];
						absTree.push([command, yCoords]);
					}
					break;
				case 'Z':
					absTree.push(['Z']);
					[x, y] = [sx, sy];
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
						absTree.push([command, curvetoCoordinates]);
					} else {
						const curvetoCoordinates = args as curveto_coordinate_sequence;
						x =
							curvetoCoordinates[
								curvetoCoordinates.length - 1
							][2][0];
						y =
							curvetoCoordinates[
								curvetoCoordinates.length - 1
							][2][1];
						absTree.push([command, curvetoCoordinates]);
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
						absTree.push([command, smoothCurvetoCoordinates]);
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
						absTree.push([command, smoothCurvetoCoordinates]);
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
						absTree.push([
							command,
							quadraticBezierCurvetoCoordinates,
						]);
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
						absTree.push([
							command,
							quadraticBezierCurvetoCoordinates,
						]);
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
						absTree.push([command, coordPairs]);
					} else {
						const coordPairs = args as coordinate_pair_sequence;
						x = coordPairs[coordPairs.length - 1][0];
						y = coordPairs[coordPairs.length - 1][1];
						absTree.push([command, coordPairs]);
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
									.concat([
										[x, y],
									]) as elliptical_arc_argument,
							);
						}
						absTree.push([command, ellipticalArcArguments]);
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
						absTree.push([command, ellipticalArcArguments]);
					}
					break;
			}
		}

		this._absoluteTree = absTree;
		return new SvgPath(absTree);
	}

	extractSubpaths(): SvgPath[] {
		const subpaths: SvgPathTree[] = [];

		let subpath: SvgPathTree = this._tree.slice(0, 1) as SvgPathTree;

		if (!subpath.length) {
			return subpaths.map((subpath) => new SvgPath(subpath));
		}

		if (subpath[0][0].toUpperCase() !== 'M') {
			throw new Error('Invalid start command');
		}

		let x = (subpath[0] as moveto)[1][0][0],
			y = (subpath[0] as moveto)[1][0][1];
		let sx = x,
			sy = y;

		for (const draw of this._tree.slice(1) as SvgPathTree) {
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
					[x, y] = [sx, sy];
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
						[x, y] = curvetoCoordinates[
							curvetoCoordinates.length - 1
						][2];
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
						[x, y] = smoothCurvetoCoordinates[
							smoothCurvetoCoordinates.length - 1
						][1];
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
						[x, y] = quadraticBezierCurvetoCoordinates[
							quadraticBezierCurvetoCoordinates.length - 1
						][1];
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
						[x, y] = coordPairs[coordPairs.length - 1];
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
						[x, y] = ellipticalArcArguments[
							ellipticalArcArguments.length - 1
						][5];
					}
					subpath.push(draw);
					break;
			}
		}

		if (subpath.length) {
			subpaths.push(subpath);
		}

		return subpaths.map((subpath) => new SvgPath(subpath));
	}

	toString(): string {
		return this._tree
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
							.map((v) => (Object(v) instanceof Boolean ? +v : v))
							.join(' ')}`;
				}
			})
			.join('');
	}

	get start(): [Decimal, Decimal] {
		if (this._start) {
			return this._start;
		}

		let x: Decimal = zero,
			y: Decimal = zero;

		const [command, args] = this._tree[0];
		const firstArg = args ? args[0] : undefined;

		switch (command) {
			case 'M':
			case 'm':
				x = (firstArg as coordinate_pair)[0];
				y = (firstArg as coordinate_pair)[1];
				break;
			default:
				break;
		}

		return (this._start = [x, y]);
	}

	get end(): [Decimal, Decimal] {
		if (this._end) {
			return this._end;
		}

		let x: Decimal = zero,
			y: Decimal = zero;

		if (!this._absoluteTree) {
			this.toAbsoluteCommands();
		}

		const [command, args] = (this._absoluteTree as SvgPathTree)[
			(this._absoluteTree as SvgPathTree).length - 1
		];
		const lastArg = args ? args[args.length - 1] : undefined;

		switch (command) {
			case 'M':
			case 'L':
			case 'T':
				[x, y] = lastArg as coordinate_pair;
				break;
			case 'H':
				x = lastArg as Decimal;
				break;
			case 'V':
				y = lastArg as Decimal;
				break;
			case 'Z':
				[x, y] = this.start;
				break;
			case 'C':
				[x, y] = (lastArg as coordinate_pair_triplet)[2];
				break;
			case 'S':
			case 'Q':
				[x, y] = (lastArg as coordinate_pair_double)[1];
				break;
			case 'A':
				[x, y] = (lastArg as elliptical_arc_argument)[5];
				break;
		}

		return (this._end = [x, y]);
	}

	get centroid(): [Decimal, Decimal] {
		if (this._centroid) {
			return this._centroid;
		}

		let count = 0;
		let x: Decimal = zero,
			y: Decimal = zero;
		let sx: Decimal = x,
			sy: Decimal = y;
		let Sx: Decimal = x,
			Sy: Decimal = y;

		if (!this._absoluteTree) {
			this.toAbsoluteCommands();
		}

		for (const [command, args] of this._absoluteTree as SvgPathTree) {
			switch (command) {
				case 'M':
					[sx, sy] = (args as coordinate_pair_sequence)[0];
				/* fallthrough */
				case 'L':
				/* fallthrough */
				case 'T':
					for (const coordPair of args as coordinate_pair_sequence) {
						[x, y] = coordPair;
						Sx = Sx.plus(x);
						Sy = Sy.plus(y);
						count++;
					}
					break;
				case 'Z':
					[x, y] = [sx, sy];
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
						[x, y] = curvetoCoordinate[2];
						Sx = Sx.plus(x);
						Sy = Sy.plus(y);
						count++;
					}
					break;
				case 'S':
					for (const smoothCurvetoCoordinate of args as smooth_curveto_coordinate_sequence) {
						[x, y] = smoothCurvetoCoordinate[1];
						Sx = Sx.plus(x);
						Sy = Sy.plus(y);
						count++;
					}
					break;
				case 'Q':
					for (const quadraticBezierCurvetoCoordinate of args as quadratic_bezier_curveto_coordinate_sequence) {
						[x, y] = quadraticBezierCurvetoCoordinate[1];
						Sx = Sx.plus(x);
						Sy = Sy.plus(y);
						count++;
					}
					break;
				case 'A':
					for (const ellipticalArcArgument of args as elliptical_arc_argument_sequence) {
						[x, y] = ellipticalArcArgument[5];
						Sx = Sx.plus(x);
						Sy = Sy.plus(y);
						count++;
					}
					break;
			}
		}

		return (this._centroid = [Sx.div(count), Sy.div(count)]);
	}

	static fromString(path = '', transform?: SvgTransform): SvgPath {
		const tree = parseSvgPath(path);
		return new SvgPath(tree, transform);
	}

	static fromCircle(
		cx: Decimal = zero,
		cy: Decimal = zero,
		r: Decimal = zero,
		transform?: SvgTransform,
	): SvgPath {
		if (r.lte(zero)) {
			return new SvgPath([['M', [[cx, cy]]]], transform);
		}
		return new SvgPath(
			[
				['M', [[cx.sub(r), cy]]],
				[
					'a',
					[
						[r, r, zero, true, true, [r, r]],
						[r, r, zero, false, true, [r.neg(), r.neg()]],
					],
				],
				['Z'],
			],
			transform,
		);
	}

	static fromEllipse(
		cx: Decimal = zero,
		cy: Decimal = zero,
		rx_: Decimal | 'auto' = 'auto',
		ry_: Decimal | 'auto' = 'auto',
		transform?: SvgTransform,
	): SvgPath {
		if (rx_ === 'auto' && ry_ !== 'auto') {
			rx_ = ry_;
		} else if (rx_ !== 'auto' && ry_ === 'auto') {
			ry_ = rx_;
		} else if (rx_ === 'auto' && ry_ === 'auto') {
			rx_ = ry_ = zero;
		}

		const rx = rx_ as Decimal;
		const ry = ry_ as Decimal;

		if (rx.lte(zero) || ry.lte(zero)) {
			return new SvgPath([['M', [[cx, cy]]]], transform);
		}

		return new SvgPath(
			[
				['M', [[cx.sub(rx), cy]]],
				[
					'a',
					[
						[rx, ry, zero, true, true, [rx, ry]],
						[rx, ry, zero, false, true, [rx.neg(), ry.neg()]],
					],
				],
				['Z'],
			],
			transform,
		);
	}

	static fromLine(
		x1: Decimal = zero,
		y1: Decimal = zero,
		x2: Decimal = zero,
		y2: Decimal = zero,
		transform?: SvgTransform,
	): SvgPath {
		return new SvgPath(
			[
				[
					'M',
					[
						[x1, y1],
						[x2, y2],
					],
				],
			],
			transform,
		);
	}

	static fromPolygon(points = '', transform?: SvgTransform): SvgPath {
		return SvgPath.fromString(`M${points}Z`, transform);
	}

	static fromPolyline(points = '', transform?: SvgTransform): SvgPath {
		return SvgPath.fromString(`M${points}`, transform);
	}

	static fromRect(
		x: Decimal = zero,
		y: Decimal = zero,
		width: Decimal = zero,
		height: Decimal = zero,
		rx_: Decimal | 'auto' = 'auto',
		ry_: Decimal | 'auto' = 'auto',
		transform?: SvgTransform,
	): SvgPath {
		if (rx_ === 'auto' && ry_ !== 'auto') {
			rx_ = ry_;
		} else if (rx_ !== 'auto' && ry_ === 'auto') {
			ry_ = rx_;
		} else if (rx_ === 'auto' && ry_ === 'auto') {
			rx_ = ry_ = zero;
		}

		const rx = rx_ as Decimal;
		const ry = ry_ as Decimal;

		if (width.lte(zero) || height.lte(zero)) {
			return new SvgPath([['M', [[x, y]]]], transform);
		} else if (rx.lte(zero) || ry.lte(zero)) {
			return new SvgPath(
				[
					['M', [[x, y]]],
					['h', [width]],
					['v', [height]],
					['h', [width.neg()]],
					['v', [height.neg()]],
					['Z'],
				],
				transform,
			);
		} else if (rx.lte(width.div(2)) && ry.lte(height.div(2))) {
			return new SvgPath(
				[
					['M', [[x.plus(rx), y]]],
					['h', [width.sub(rx.mul(2))]],
					['a', [[rx, ry, zero, false, true, [rx, ry]]]],
					['v', [height.sub(ry.mul(2))]],
					['a', [[rx, ry, zero, false, true, [rx.neg(), ry]]]],
					['h', [rx.mul(2).sub(width)]],
					['a', [[rx, ry, zero, false, true, [rx.neg(), ry.neg()]]]],
					['v', [ry.mul(2).sub(height)]],
					['a', [[rx, ry, zero, false, true, [rx, ry.neg()]]]],
					['Z'],
				],
				transform,
			);
		} else if (rx.lte(width.div(2))) {
			return new SvgPath(
				[
					['M', [[x.plus(rx), y]]],
					['h', [width.sub(rx.mul(2))]],
					[
						'a',
						[
							[
								rx,
								height.div(2),
								zero,
								false,
								true,
								[zero, height],
							],
						],
					],
					['h', [rx.mul(2).sub(width)]],
					[
						'a',
						[
							[
								rx,
								height.div(2),
								zero,
								false,
								true,
								[zero, height.neg()],
							],
						],
					],
					['Z'],
				],
				transform,
			);
		} else if (ry.lte(height.div(2))) {
			return new SvgPath(
				[
					['M', [[x.plus(width), y.plus(ry)]]],
					['v', [height.sub(ry.mul(2))]],
					[
						'a',
						[
							[
								width.div(2),
								ry,
								zero,
								false,
								true,
								[width.neg(), zero],
							],
						],
					],
					['v', [ry.mul(2).sub(height)]],
					[
						'a',
						[[width.div(2), ry, zero, false, true, [width, zero]]],
					],
					['Z'],
				],
				transform,
			);
		} else {
			return new SvgPath(
				[
					['M', [[x.plus(width), y.plus(height.div(2))]]],
					[
						'a',
						[
							[
								width.div(2),
								height.div(2),
								zero,
								false,
								true,
								[width.neg(), zero],
							],
							[
								width.div(2),
								height.div(2),
								zero,
								false,
								true,
								[width, zero],
							],
						],
					],
					['Z'],
				],
				transform,
			);
		}
	}
}
