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
	const zero = new Decimal(0);
	const one = new Decimal(1);
	const degToRad = Decimal.acos(0).div(90);
%}

/* lexical grammar */
%lex
%%

\s                                       /* ignore */
(?:(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[Ee][+-]?[0-9]+)?)
	return 'NUMBER'
("+")                                    return '+'
("-")                                    return '-'
("(")                                    return '('
(")")                                    return ')'
(",")                                    return ','
("matrix")                               return 'MATRIX'
("rotate")                               return 'ROTATE'
("scale")                                return 'SCALE'
("skewX")                                return 'SKEWX'
("skewY")                                return 'SKEWY'
("translate")                            return 'TRANSLATE'
<<EOF>>                                  return 'EOF'
.                                        return 'INVALID'

/lex

%start root

%% /* language grammar */

root
	: transform_sequence_or_empty EOF
		{ return $1; }
	;

transform_sequence_or_empty
	: %empty
		{ $$ = [ ]; }
	| transform_sequence
	;

transform_sequence
	: transform
		{ $$ = [ $1 ]; }
	| transform_sequence comma_wsp transform
		{ $$ = [...$1, $3]; }
	;

transform
	: matrix
	| rotate
	| scale
	| skewX
	| skewY
	| translate
	;

matrix
	: MATRIX opt_wsp '(' opt_wsp value comma_wsp value comma_wsp value comma_wsp value comma_wsp value comma_wsp value opt_wsp ')'
		{
			$$ = [
				$5,
				$7,
				$9,
				$11,
				$13,
				$15,
			];
		}
	;

rotate
	: ROTATE opt_wsp '(' opt_wsp rotate_args opt_wsp ')'
		{ $$ = $5; }
	;
    
rotate_args
	: value
		{
			{
				const rads = degToRad.mul($1);
				$$ = [
						rads.cos(),
						rads.sin(),
						rads.sin().neg(),
						rads.cos(),
						zero,
						zero,
				];
			}
		}
	| value comma_wsp value comma_wsp value
		{
			{
				const rads = degToRad.mul($1);
				$$ = [
					rads.cos(),
					rads.sin(),
					rads.sin().neg(),
					rads.cos(),
					rads.cos().mul($3).plus(rads.sin().neg().mul($5)).sub($3).neg(),
					rads.sin().mul($3).plus(rads.cos().mul($5)).sub($5).neg(),
				];
			}
		}
	;

scale
	: SCALE opt_wsp '(' opt_wsp scale_args opt_wsp ')'
		{ $$ = $5; }
	;

scale_args
	: value
		{
			$$ = [
				$1,
				zero,
				zero,
				$1,
				zero,
				zero,
			];
		}
	| value comma_wsp value
		{
			$$ = [
				$1,
				zero,
				zero,
				$3,
				zero,
				zero,
			];
		}
	;

skewX
	: SKEWX opt_wsp '(' opt_wsp value opt_wsp ')'
		{
			$$ = [
				one,
				zero,
				degToRad.mul($5).tan(),
				one,
				zero,
				zero,
			];
		}
	;

skewY
	: SKEWY opt_wsp '(' opt_wsp value opt_wsp ')'
		{
			$$ = [
				one,
				degToRad.mul($5).tan(),
				zero,
				one,
				zero,
				zero,
			];
		}
	;

translate
	: TRANSLATE opt_wsp '(' opt_wsp translate_args opt_wsp ')'
		{ $$ = $5; }
	;

translate_args
	: value
		{
			$$ = [
				one,
				zero,
				zero,
				one,
				$1,
				zero,
			];
		}
	| value comma_wsp value
		{
			$$ = [
				one,
				zero,
				zero,
				one,
				$1,
				$3,
			];
		}
	;

value
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
		{ $$ = new Decimal($1); }
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
