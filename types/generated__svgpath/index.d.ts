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

declare module '@generated/svgpath' {
	import { Decimal } from '@Exact-Realty/decimal.js-float';

	export type coordinate_pair = [Decimal, Decimal];
	export type coordinate_pair_sequence = coordinate_pair[];
	export type coordinate_sequence = Decimal[];
	export type curveto_coordinate_sequence = coordinate_pair_triplet[];
	export type coordinate_pair_triplet = [
		coordinate_pair,
		coordinate_pair,
		coordinate_pair,
	];
	export type smooth_curveto_coordinate_sequence = coordinate_pair_double[];
	export type coordinate_pair_double = [coordinate_pair, coordinate_pair];
	export type quadratic_bezier_curveto_coordinate_sequence = coordinate_pair_double[];
	export type elliptical_arc_argument_sequence = elliptical_arc_argument[];
	export type elliptical_arc_argument = [
		Decimal,
		Decimal,
		Decimal,
		boolean,
		boolean,
		coordinate_pair,
	];

	export type moveto = ['M' | 'm', coordinate_pair_sequence];

	type closepath = ['Z' | 'z'];

	type lineto = ['L' | 'l', coordinate_pair_sequence];

	type horizontal_lineto = ['H' | 'h', coordinate_sequence];

	type vertical_lineto = ['V' | 'v', coordinate_sequence];

	type curveto = ['C' | 'c', curveto_coordinate_sequence];

	type smooth_curveto = ['S' | 's', smooth_curveto_coordinate_sequence];

	type quadratic_bezier_curveto = [
		'Q' | 'q',
		quadratic_bezier_curveto_coordinate_sequence,
	];

	type smooth_quadratic_bezier_curveto = [
		'T' | 't',
		coordinate_pair_sequence,
	];

	type elliptical_arc = ['A' | 'a', elliptical_arc_argument_sequence];

	type drawto_command =
		| moveto
		| closepath
		| lineto
		| horizontal_lineto
		| vertical_lineto
		| curveto
		| smooth_curveto
		| quadratic_bezier_curveto
		| smooth_quadratic_bezier_curveto
		| elliptical_arc;

	export type SvgPathTree = drawto_command[];

	export function parse(input: string): SvgPathTree;
}
