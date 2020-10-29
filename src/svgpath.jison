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

%options flex

%{
	const Decimal = require('@Exact-Realty/decimal.js-float');
%}

/* lexical grammar */
%lex
%%

\s                                       /* ignore */
(?:(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[Ee][+-]?[0-9]+)?)
	%{ return ['0', '1'].indexOf(yytext) === -1 ? 'NUMBER' : yytext; %}
("none")                                 return 'NONE'
("+")                                    return '+'
("-")                                    return '-'
(",")                                    return ','
("M")                                    return 'M'
("m")                                    return 'M'
("L")                                    return 'L'
("l")                                    return 'L'
("H")                                    return 'H'
("h")                                    return 'H'
("V")                                    return 'V'
("v")                                    return 'V'
("Z")                                    return 'Z'
("z")                                    return 'Z'
("C")                                    return 'C'
("c")                                    return 'C'
("S")                                    return 'S'
("s")                                    return 'S'
("Q")                                    return 'Q'
("q")                                    return 'Q'
("T")                                    return 'T'
("t")                                    return 'T'
("A")                                    return 'A'
("a")                                    return 'A'
<<EOF>>                                  return 'EOF'
.                                        return 'INVALID'

/lex

%start root

%% /* language grammar */

root
	: svg_path EOF
		{ return $1; }
	;

svg_path
	: opt_wsp
		{ $$ = []; }
	| NONE
		{ $$ = []; }
	| svg_path_ne
	;
	
svg_path_ne
	: svg_path_start
	| svg_path_ne opt_wsp drawto_command
		{ $$ = [...$1, $3]; }
	;

svg_path_start
	: opt_wsp moveto
		{ $$ = [$2]; }
	;

drawto_command
	: moveto
	| closepath
	| lineto
	| horizontal_lineto
	| vertical_lineto
	| curveto
	| smooth_curveto
	| quadratic_bezier_curveto
	| smooth_quadratic_bezier_curveto
	| elliptical_arc
	;
	
moveto
	: M opt_wsp coordinate_pair_sequence
		{ $$ = [$1, $3]; }
	;

closepath
	: Z
		{ $$ = [$1]; }
	;

lineto
	: L opt_wsp coordinate_pair_sequence
		{ $$ = [$1, $3]; }
	;

horizontal_lineto
	: H opt_wsp coordinate_sequence
		{ $$ = [$1, $3]; }
	;

vertical_lineto
	: V opt_wsp coordinate_sequence
		{ $$ = [$1, $3]; }
	;

curveto
	: C opt_wsp curveto_coordinate_sequence
		{ $$ = [$1, $3]; }
	;

curveto_coordinate_sequence
	: coordinate_pair_triplet
		{ $$ = [$1]; }
	| coordinate_pair_triplet comma_wsp curveto_coordinate_sequence
		{ $$ = [$1, ...$3]; }
	;

smooth_curveto
	: S opt_wsp smooth_curveto_coordinate_sequence
		{ $$ = [$1, $3]; }
	;

smooth_curveto_coordinate_sequence
	: coordinate_pair_double
		{ $$ = [$1]; }
	| coordinate_pair_double comma_wsp smooth_curveto_coordinate_sequence
		{ $$ = [$1, ...$3]; }
	;

quadratic_bezier_curveto
	: Q opt_wsp quadratic_bezier_curveto_coordinate_sequence
		{ $$ = [$1, $3]; }
	;

quadratic_bezier_curveto_coordinate_sequence
	: coordinate_pair_double
		{ $$ = [$1]; }
	| coordinate_pair_double comma_wsp quadratic_bezier_curveto_coordinate_sequence
		{ $$ = [$1, ...$3]; }
	;

smooth_quadratic_bezier_curveto
	: T opt_wsp coordinate_pair_sequence
		{ $$ = [$1, $3]; }
	;

elliptical_arc
	: A opt_wsp elliptical_arc_argument_sequence
		{ $$ = [$1, $3]; }
	;

elliptical_arc_argument_sequence
	: elliptical_arc_argument
		{ $$ = [$1]; }
	| elliptical_arc_argument comma_wsp elliptical_arc_argument_sequence
		{ $$ = [$1, ...$3]; }
	;

elliptical_arc_argument
	: coordinate comma_wsp coordinate comma_wsp coordinate comma_wsp flag comma_wsp flag comma_wsp coordinate_pair
		{ $$ = [$1.abs(), $3.abs(), $5, $7, $9, $11]; }
	;

coordinate_pair_double
	: coordinate_pair comma_wsp coordinate_pair
		{ $$ = [$1, $3]; }
	;

coordinate_pair_triplet
	: coordinate_pair comma_wsp coordinate_pair comma_wsp coordinate_pair
		{ $$ = [$1, $3, $5]; }
	;

coordinate_pair_sequence
	: coordinate_pair
		{ $$ = [$1]; }
	| coordinate_pair comma_wsp coordinate_pair_sequence
		{ $$ = [$1, ...$3]; }
	;

coordinate_sequence
	: coordinate
		{ $$ = [$1]; }
	| coordinate comma_wsp coordinate_sequence
		{ $$ = [$1, ...$3]; }
	;

coordinate_pair
	: coordinate comma_wsp coordinate
		{ $$ = [ $1, $3 ]; }
	;

coordinate
	: number
	| sign number
		{ $$ = ($1 === '+' ? $2 : $2.neg()); }
	;

sign
	: '+'
	| '-'
	;

number
	: NUMBER
		{ $$ = new Decimal(yytext); }
	| '0'
		{ $$ = new Decimal(0); }
	| '1'
		{ $$ = new Decimal(1); }
	;

flag
	: '0'
		{ $$ = false; }
	| '1'
		{ $$ = true; }
	;

comma_wsp
	: %empty
	| ','
	;

wsp
	: %empty
	;

opt_wsp
	: %empty
	;
