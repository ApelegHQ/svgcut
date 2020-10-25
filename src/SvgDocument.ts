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
import { Parser } from 'xml2js';

import { SvgPath } from './SvgPath';
import { Strategy, sortPathsByRelativePosition } from './SvgPathReorderUtils';
import { SvgTransform } from './SvgTransform';

type XmlTree = {
	$?: {
		[attr: string]: {
			name: string;
			value: string;
			prefix: string;
			local: string;
			uri: string;
		};
	};
	$ns: {
		uri: string;
		local: string;
	};
	$$?: XmlTree[];
};

type SvgViewBox = {
	minX: Decimal;
	minY: Decimal;
	width: Decimal;
	height: Decimal;
};

type SvgDocumentProperties = {
	width: Decimal;
	height: Decimal;
	viewBox?: SvgViewBox;
	version: string;
};

type SvgDocumentStructure = {
	properties: SvgDocumentProperties;
	paths: SvgPath[];
};

type SvgParseArgs = {
	defs: { [id: string]: (SvgPath | UnresolvedSvgPath)[] };
	properties: SvgDocumentProperties;
	render: boolean;
	CTM?: SvgTransform;
};

type SvgParseResult = {
	paths?: (SvgPath | UnresolvedSvgPath)[];
};

const zero = new Decimal(0);
const one = new Decimal(1);
const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

/*
 * https://www.w3.org/TR/2006/REC-xml11-20060816/#NT-Name
 * [4]   	NameStartChar	   ::=   	":" | [A-Z] | "_" | [a-z] | [#xC0-#xD6] | [#xD8-#xF6] | [#xF8-#x2FF] | [#x370-#x37D] | [#x37F-#x1FFF] | [#x200C-#x200D] | [#x2070-#x218F] | [#x2C00-#x2FEF] | [#x3001-#xD7FF] | [#xF900-#xFDCF] | [#xFDF0-#xFFFD] | [#x10000-#xEFFFF]
 * [4a]   	NameChar	   ::=   	NameStartChar | "-" | "." | [0-9] | #xB7 | [#x0300-#x036F] | [#x203F-#x2040]
 * [5]   	Name	   ::=   	NameStartChar (NameChar)*
 */
// eslint-disable-next-line no-misleading-character-class
const idRegex = /^\s*([:A-Z_a-z\u{C0}-\u{D6}\u{D8}-\u{F6}\u{F8}-\u{2FF}\u{370}-\u{37D}\u{37F}-\u{1FFF}\u{200C}-\u{200D}\u{2070}-\u{218F}\u{2C00}-\u{2FEF}\u{3001}-\u{D7FF}\u{F900}-\u{FDCF}\u{FDF0}-\u{FFFD}\u{10000}-\u{EFFFF}][:A-Z_a-z\u{C0}-\u{D6}\u{D8}-\u{F6}\u{F8}-\u{2FF}\u{370}-\u{37D}\u{37F}-\u{1FFF}\u{200C}-\u{200D}\u{2070}-\u{218F}\u{2C00}-\u{2FEF}\u{3001}-\u{D7FF}\u{F900}-\u{FDCF}\u{FDF0}-\u{FFFD}\u{10000}-\u{EFFFF}.0-9\u{B7}\u{0300}-\u{036F}\u{203F}-\u{2040}-]*)\s*$/u;
// eslint-disable-next-line no-misleading-character-class
const hrefRegex = /^\s*#([:A-Z_a-z\u{C0}-\u{D6}\u{D8}-\u{F6}\u{F8}-\u{2FF}\u{370}-\u{37D}\u{37F}-\u{1FFF}\u{200C}-\u{200D}\u{2070}-\u{218F}\u{2C00}-\u{2FEF}\u{3001}-\u{D7FF}\u{F900}-\u{FDCF}\u{FDF0}-\u{FFFD}\u{10000}-\u{EFFFF}][:A-Z_a-z\u{C0}-\u{D6}\u{D8}-\u{F6}\u{F8}-\u{2FF}\u{370}-\u{37D}\u{37F}-\u{1FFF}\u{200C}-\u{200D}\u{2070}-\u{218F}\u{2C00}-\u{2FEF}\u{3001}-\u{D7FF}\u{F900}-\u{FDCF}\u{FDF0}-\u{FFFD}\u{10000}-\u{EFFFF}.0-9\u{B7}\u{0300}-\u{036F}\u{203F}-\u{2040}-]*)\s*$/u;

const lengthRegex = /^\s*([+-]?[0-9]+(?:[Ee][+-]?[0-9]+)?|[+-]?[0-9]*[.][0-9]+(?:[Ee][+-]?[0-9]+)?)(em|ex|px|in|cm|mm|pt|pc|%)?\s*$/;
const viewBoxRegex = /^\s*([+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[Ee][+-]?[0-9]+)?)(?:\s+|\s*,\s*|(?=[+-.]))([+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[Ee][+-]?[0-9]+)?)(?:\s+|\s*,\s*|(?=[+-.]))([+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[Ee][+-]?[0-9]+)?)(?:\s+|\s*,\s*|(?=[+-.]))([+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[Ee][+-]?[0-9]+)?)\s*$/;

class UnresolvedSvgPath {
	private _href: string;
	private _transform?: SvgTransform;
	private _result?: (SvgPath | UnresolvedSvgPath)[];

	constructor(href: string, transform?: SvgTransform) {
		this._href = href;
		this._transform = transform;
	}

	transform(transform?: SvgTransform): UnresolvedSvgPath {
		if (transform) {
			return new UnresolvedSvgPath(
				this._href,
				transform.catenate(this._transform),
			);
		} else {
			return this;
		}
	}

	resolve(defs: {
		[id: string]: (SvgPath | UnresolvedSvgPath)[];
	}): (SvgPath | UnresolvedSvgPath)[] {
		if (this._result) {
			return this._result;
		} else if (defs[this._href]) {
			this._result = [];
			const result = defs[this._href]
				.flatMap((path) =>
					path instanceof UnresolvedSvgPath
						? path.resolve(defs)
						: [path],
				)
				.map((path) => path.transform(this._transform));
			this._result = result;
			return result;
		} else {
			return [this];
		}
	}
}

const preserveAspectRatioRegex = /^\s*(x(Min|Mid|Max)Y(Min|Mid|Max)|none)\s*(meet|slice)?\s*$/;

const viewBoxTransform = (
	properties: SvgDocumentProperties,
	preserveAspectRatio?: string,
): SvgTransform | undefined => {
	if (!properties.viewBox) {
		return;
	}

	enum Align {
		None,
		Min,
		Mid,
		Max,
	}

	enum MeetOrSlice {
		Meet,
		Slice,
	}

	let alignX: Align = Align.Mid;
	let alignY: Align = Align.Mid;
	let meetOrSlice: MeetOrSlice = MeetOrSlice.Meet;

	const preserveAspectRatioParsed = preserveAspectRatio?.match(
		preserveAspectRatioRegex,
	);

	if (preserveAspectRatioParsed) {
		if (preserveAspectRatioParsed[1] === 'none') {
			alignX = alignY = Align.None;
		} else {
			if (preserveAspectRatioParsed[2] === 'Min') {
				alignX = Align.Min;
			} else if (preserveAspectRatioParsed[2] === 'Mid') {
				alignX = Align.Mid;
			} else if (preserveAspectRatioParsed[2] === 'Max') {
				alignX = Align.Max;
			}

			if (preserveAspectRatioParsed[3] === 'Min') {
				alignY = Align.Min;
			} else if (preserveAspectRatioParsed[3] === 'Mid') {
				alignY = Align.Mid;
			} else if (preserveAspectRatioParsed[3] === 'Max') {
				alignY = Align.Max;
			}

			if (preserveAspectRatioParsed[4] === 'meet') {
				meetOrSlice = MeetOrSlice.Meet;
			} else if (preserveAspectRatioParsed[4] === 'slice') {
				meetOrSlice = MeetOrSlice.Slice;
			}
		}
	}

	if (alignX === Align.None) {
		const [Sx, Sy] = [
			properties.width.div(properties.viewBox.width),
			properties.height.div(properties.viewBox.height),
		];

		return new SvgTransform([
			Sx,
			zero,
			zero,
			Sy,
			properties.viewBox.minX.neg().mul(Sx),
			properties.viewBox.minY.neg().mul(Sy),
		]);
	} else {
		let S: Decimal = one,
			ftx: Decimal = zero,
			fty: Decimal = zero,
			tx: Decimal,
			ty: Decimal;

		if (meetOrSlice === MeetOrSlice.Meet) {
			S = Decimal.min(
				properties.width.div(properties.viewBox.width),
				properties.height.div(properties.viewBox.height),
			);

			if (properties.width.gt(properties.height)) {
				ftx = one;
			} else if (properties.width.lt(properties.height)) {
				fty = one;
			}
		} else if (meetOrSlice === MeetOrSlice.Slice) {
			S = Decimal.max(
				properties.width.div(properties.viewBox.width),
				properties.height.div(properties.viewBox.height),
			);

			if (properties.width.lt(properties.height)) {
				ftx = one;
			} else if (properties.width.gt(properties.height)) {
				fty = one;
			}
		}

		tx = properties.viewBox.minX.neg().mul(S);
		ty = properties.viewBox.minY.neg().mul(S);

		if (alignX === Align.Mid) {
			tx = tx.plus(
				ftx.mul(
					properties.width
						.sub(properties.viewBox.width.mul(S))
						.div(2),
				),
			);
		} else if (alignX === Align.Max) {
			tx = tx.plus(
				ftx.mul(properties.width.sub(properties.viewBox.width.mul(S))),
			);
		}

		if (alignY === Align.Mid) {
			ty = ty.plus(
				fty.mul(
					properties.height
						.sub(properties.viewBox.height.mul(S))
						.div(2),
				),
			);
		} else if (alignY === Align.Max) {
			ty = ty.plus(
				fty.mul(
					properties.height.sub(properties.viewBox.height.mul(S)),
				),
			);
		}

		return new SvgTransform([S, zero, zero, S, tx, ty]);
	}
};

const parseLength = (value: string, baseLength: Decimal) => {
	const match = value.match(lengthRegex);
	if (match) {
		const length = new Decimal(match[1]);
		const unit = match[2];
		let scale: number | Decimal = 1;

		if (unit) {
			switch (unit) {
				case 'em':
					// Taking a guess 1em = 1pc
					scale = 16;
					break;
				case 'ex':
					// Taking a guess 1ex = 0.5em = 0.5pc
					scale = 8;
					break;
				case 'px':
					scale = 1;
					break;
				case 'in':
					scale = 96;
					break;
				case 'cm':
					scale = 9600 / 254;
					break;
				case 'mm':
					scale = 960 / 254;
					break;
				case 'pt':
					scale = 96 / 72;
					break;
				case 'pc':
					scale = 16;
					break;
				case '%':
					scale = baseLength.mul(length).div(100);
					break;
			}
		}

		const result = length.mul(scale);

		if (result.isFinite()) {
			return result;
		}
	}
};

export class SvgDocument {
	private structure: SvgDocumentStructure;

	private constructor(structure: SvgDocumentStructure) {
		this.structure = structure;
	}

	static async fromString(data: Buffer | string): Promise<SvgDocument[]> {
		const parser = new Parser({
			xmlns: true,
			preserveChildrenOrder: true,
			explicitChildren: true,
			explicitRoot: false,
		});

		const result = await parser.parseStringPromise(data);

		const documents: SvgDocumentStructure[] = [];

		const extractPaths = (
			el: XmlTree,
			args: SvgParseArgs | undefined = undefined,
		): SvgParseResult => {
			if (el['$ns']['uri'] === SVG_NS) {
				if (args === undefined && el['$ns']['local'] === 'svg') {
					let width: Decimal = new Decimal(300),
						height: Decimal = new Decimal(150),
						version = '1.1',
						transform: string | undefined,
						viewBox: SvgViewBox | undefined;

					for (const attr of Object.values(el['$'] ?? {})) {
						if (
							attr instanceof Object &&
							'uri' in attr &&
							'local' in attr &&
							'value' in attr &&
							([SVG_NS, ''].includes(attr['uri']) ||
								attr['name'] === 'xml:id')
						) {
							switch (attr['local']) {
								case 'width':
									width =
										parseLength(attr['value'], width) ??
										width;
									break;
								case 'height':
									height =
										parseLength(attr['value'], height) ??
										height;
									break;
								case 'viewBox':
									{
										const viewBoxValues = String(
											attr['value'],
										).match(viewBoxRegex);

										if (viewBoxValues) {
											viewBox = {
												minX: new Decimal(
													viewBoxValues[1],
												),
												minY: new Decimal(
													viewBoxValues[2],
												),
												width: new Decimal(
													viewBoxValues[3],
												),
												height: new Decimal(
													viewBoxValues[4],
												),
											};
										}
									}
									break;
								case 'version':
									version = attr['value'] ?? version;
									break;
								case 'transform':
									transform = attr['value'] ?? transform;
									break;
							}
						}
					}

					const svgTransform = SvgTransform.fromString(transform);

					const defs = {};
					const paths: (SvgPath | UnresolvedSvgPath)[] = [];

					const args_ = {
						properties: {
							height: height,
							width: width,
							version: version,
							viewBox: viewBox,
						},
						render: true,
						CTM: svgTransform,
						defs: defs,
					};

					(el['$$'] ?? []).forEach((node) => {
						const result = extractPaths(node, args_);
						if (result.paths) {
							paths.push(...result.paths);
						}
					});

					documents.push({
						properties: args_.properties,
						paths: paths
							.flatMap((path) =>
								path instanceof UnresolvedSvgPath
									? path.resolve(defs)
									: path,
							)
							.filter(
								(path) => path instanceof SvgPath,
							) as SvgPath[],
					});
				} else if (args === undefined) {
					return {};
				} else {
					const baseLengthX =
						args.properties.viewBox?.width ?? args.properties.width;
					const baseLengthY =
						args.properties.viewBox?.height ??
						args.properties.height;
					const baseLength = baseLengthX
						.pow(2)
						.plus(baseLengthY.pow(2))
						.div(2)
						.sqrt();

					switch (el['$ns']['local']) {
						case 'g': {
							let transform: string | undefined,
								id: string | undefined;

							for (const attr of Object.values(el['$'] ?? {})) {
								if (
									attr instanceof Object &&
									'uri' in attr &&
									'local' in attr &&
									([SVG_NS, ''].includes(attr['uri']) ||
										attr['name'] === 'xml:id')
								) {
									switch (attr['local']) {
										case 'transform':
											transform =
												attr['value'] ?? transform;
											break;
										case 'id':
											id =
												(attr['value'].match(idRegex) ||
													[])[1] ?? id;
											break;
									}
								}
							}

							if (Array.isArray(el['$$'])) {
								const svgTransform = SvgTransform.fromString(
									transform,
								);

								const args_ = {
									defs: args.defs,
									properties: args.properties,
									render: true,
									CTM: id
										? svgTransform
										: SvgTransform.catenate(
												svgTransform,
												args.CTM,
										  ),
								};

								const results = el['$$'].map((node) =>
									extractPaths(node, args_),
								);

								const paths: (
									| SvgPath
									| UnresolvedSvgPath
								)[] = results.flatMap(
									(result) => result.paths ?? [],
								);

								if (id) {
									args.defs[id] = paths;
								}

								if (args.render) {
									if (id && args.CTM) {
										return {
											paths: paths.map((svgPath) =>
												svgPath.transform(args.CTM),
											),
										};
									} else {
										return { paths: paths };
									}
								}
							}
							return {};
						}
						case 'defs':
							if (Array.isArray(el['$$'])) {
								const args_ = {
									defs: args.defs,
									properties: args.properties,
									render: false,
								};

								el['$$'].forEach((node) => {
									extractPaths(node, args_);
								});
							}
							return {};
						case 'svg': {
							// TODO: 'symbol'
							let width: Decimal | undefined,
								height: Decimal | undefined,
								x: Decimal | undefined,
								y: Decimal | undefined,
								preserveAspectRatio: string | undefined,
								viewBox: SvgViewBox | undefined,
								transform: string | undefined,
								id: string | undefined;

							for (const attr of Object.values(el['$'] ?? {})) {
								if (
									attr instanceof Object &&
									'uri' in attr &&
									'local' in attr &&
									([SVG_NS, ''].includes(attr['uri']) ||
										attr['name'] === 'xml:id')
								) {
									switch (attr['local']) {
										case 'width':
											width =
												parseLength(
													attr['value'],
													baseLengthX,
												) ?? width;
											break;
										case 'height':
											height =
												parseLength(
													attr['value'],
													baseLengthY,
												) ?? height;
											break;
										case 'x':
											x =
												parseLength(
													attr['value'],
													baseLengthX,
												) ?? x;
											break;
										case 'y':
											y =
												parseLength(
													attr['value'],
													baseLengthY,
												) ?? y;
											break;
										case 'preserveAspectRatio':
											preserveAspectRatio =
												attr['value'] ??
												preserveAspectRatio;
											break;
										case 'viewBox':
											{
												const viewBoxValues = String(
													attr['value'],
												).match(viewBoxRegex);

												if (viewBoxValues) {
													viewBox = {
														minX: new Decimal(
															viewBoxValues[1],
														),
														minY: new Decimal(
															viewBoxValues[2],
														),
														width: new Decimal(
															viewBoxValues[3],
														),
														height: new Decimal(
															viewBoxValues[4],
														),
													};
												}
											}
											break;
										case 'transform':
											transform =
												attr['value'] ?? transform;
											break;
										case 'id':
											id =
												(attr['value'].match(idRegex) ||
													[])[1] ?? id;
											break;
									}
								}
							}

							if (Array.isArray(el['$$'])) {
								const properties = {
									height:
										height ??
										args.properties.viewBox?.height ??
										args.properties.height,
									width:
										width ??
										args.properties.viewBox?.width ??
										args.properties.width,
									version: args.properties.version,
									viewBox: viewBox ?? args.properties.viewBox,
								};

								const useTranslateTransform =
									x ?? y
										? new SvgTransform([
												one,
												zero,
												zero,
												one,
												x ?? zero,
												y ?? zero,
										  ])
										: undefined;

								const svgTransform = SvgTransform.catenate(
									viewBoxTransform(
										properties,
										preserveAspectRatio,
									),
									useTranslateTransform,
									SvgTransform.fromString(transform),
								);

								const args_ = {
									defs: args.defs,
									properties: properties,
									render: true,
									CTM: id
										? svgTransform
										: SvgTransform.catenate(
												svgTransform,
												args.CTM,
										  ),
								};

								const results = el['$$'].map((node) =>
									extractPaths(node, args_),
								);

								const paths: (
									| SvgPath
									| UnresolvedSvgPath
								)[] = results.flatMap(
									(result) => result.paths ?? [],
								);

								// TODO: Use needs to handle width and height
								if (id) {
									args.defs[id] = paths;
								}

								if (args.render) {
									if (id && args.CTM) {
										return {
											paths: paths.map((svgPath) =>
												svgPath.transform(args.CTM),
											),
										};
									} else {
										return { paths: paths };
									}
								}
							}
							return {};
						}
						case 'circle':
							{
								let cx: Decimal | undefined,
									cy: Decimal | undefined,
									r: Decimal | undefined,
									transform: string | undefined,
									id: string | undefined;

								for (const attr of Object.values(
									el['$'] ?? {},
								)) {
									if (
										attr instanceof Object &&
										'uri' in attr &&
										'local' in attr &&
										([SVG_NS, ''].includes(attr['uri']) ||
											attr['name'] === 'xml:id')
									) {
										switch (attr['local']) {
											case 'cx':
												cx =
													parseLength(
														attr['value'],
														baseLengthX,
													) ?? cx;
												break;
											case 'cy':
												cy =
													parseLength(
														attr['value'],
														baseLengthY,
													) ?? cy;
												break;
											case 'r':
												r =
													parseLength(
														attr['value'],
														baseLength,
													) ?? r;
												break;
											case 'transform':
												transform =
													attr['value'] ?? transform;
												break;
											case 'id':
												id =
													(attr['value'].match(
														idRegex,
													) ?? [])[1] ?? id;
												break;
										}
									}
								}

								if (id) {
									const svgTransform = SvgTransform.fromString(
										transform,
									);
									const svgPath = SvgPath.fromCircle(
										cx,
										cy,
										r,
										svgTransform,
									);

									args.defs[id] = [svgPath];

									if (args.render) {
										return {
											paths: [
												svgPath.transform(args.CTM),
											],
										};
									}
								} else if (args.render) {
									return {
										paths: [
											SvgPath.fromCircle(
												cx,
												cy,
												r,
												SvgTransform.fromString(
													transform,
													args.CTM,
												),
											),
										],
									};
								}
							}
							return {};
						case 'ellipse':
							{
								let cx: Decimal | undefined,
									cy: Decimal | undefined,
									rx: Decimal | undefined,
									ry: Decimal | undefined,
									transform: string | undefined,
									id: string | undefined;

								for (const attr of Object.values(
									el['$'] ?? {},
								)) {
									if (
										attr instanceof Object &&
										'uri' in attr &&
										'local' in attr &&
										([SVG_NS, ''].includes(attr['uri']) ||
											attr['name'] === 'xml:id')
									) {
										switch (attr['local']) {
											case 'cx':
												cx =
													parseLength(
														attr['value'],
														baseLengthX,
													) ?? cx;
												break;
											case 'cy':
												cy =
													parseLength(
														attr['value'],
														baseLengthY,
													) ?? cy;
												break;
											case 'rx':
												if (attr['value'] !== 'auto') {
													rx =
														parseLength(
															attr['value'],
															baseLengthX,
														) ?? rx;
												}
												break;
											case 'ry':
												if (attr['value'] !== 'auto') {
													ry =
														parseLength(
															attr['value'],
															baseLengthY,
														) ?? ry;
												}
												break;
											case 'transform':
												transform =
													attr['value'] ?? transform;
												break;
											case 'id':
												id =
													(attr['value'].match(
														idRegex,
													) ?? [])[1] ?? id;
												break;
										}
									}
								}

								if (id) {
									const svgTransform = SvgTransform.fromString(
										transform,
									);
									const svgPath = SvgPath.fromEllipse(
										cx,
										cy,
										rx,
										ry,
										svgTransform,
									);

									args.defs[id] = [svgPath];

									if (args.render) {
										return {
											paths: [
												svgPath.transform(args.CTM),
											],
										};
									}
								} else if (args.render) {
									return {
										paths: [
											SvgPath.fromEllipse(
												cx,
												cy,
												rx,
												ry,
												SvgTransform.fromString(
													transform,
													args.CTM,
												),
											),
										],
									};
								}
							}
							return {};
						case 'line':
							{
								let x1: Decimal | undefined,
									x2: Decimal | undefined,
									y1: Decimal | undefined,
									y2: Decimal | undefined,
									transform: string | undefined,
									id: string | undefined;

								for (const attr of Object.values(
									el['$'] ?? {},
								)) {
									if (
										attr instanceof Object &&
										'uri' in attr &&
										'local' in attr &&
										([SVG_NS, ''].includes(attr['uri']) ||
											attr['name'] === 'xml:id')
									) {
										switch (attr['local']) {
											case 'x1':
												x1 =
													parseLength(
														attr['value'],
														baseLengthX,
													) ?? x1;
												break;
											case 'x2':
												x2 =
													parseLength(
														attr['value'],
														baseLengthX,
													) ?? x2;
												break;
											case 'y1':
												y1 =
													parseLength(
														attr['value'],
														baseLengthY,
													) ?? y1;
												break;
											case 'y2':
												y2 =
													parseLength(
														attr['value'],
														baseLengthY,
													) ?? y2;
												break;
											case 'transform':
												transform =
													attr['value'] ?? transform;
												break;
											case 'id':
												id =
													(attr['value'].match(
														idRegex,
													) ?? [])[1] ?? id;
												break;
										}
									}
								}

								if (id) {
									const svgTransform = SvgTransform.fromString(
										transform,
									);
									const svgPath = SvgPath.fromLine(
										x1,
										y1,
										x2,
										y2,
										svgTransform,
									);

									args.defs[id] = [svgPath];

									if (args.render) {
										return {
											paths: [
												svgPath.transform(args.CTM),
											],
										};
									}
								} else if (args.render) {
									return {
										paths: [
											SvgPath.fromLine(
												x1,
												y1,
												x2,
												x2,
												SvgTransform.fromString(
													transform,
													args.CTM,
												),
											),
										],
									};
								}
							}
							return {};
						case 'path':
							{
								let d: string | undefined,
									transform: string | undefined,
									id: string | undefined;

								for (const attr of Object.values(
									el['$'] ?? {},
								)) {
									if (
										attr instanceof Object &&
										'uri' in attr &&
										'local' in attr &&
										([SVG_NS, ''].includes(attr['uri']) ||
											attr['name'] === 'xml:id')
									) {
										switch (attr['local']) {
											case 'd':
												d = attr['value'] ?? d;
												break;
											case 'transform':
												transform =
													attr['value'] ?? transform;
												break;
											case 'id':
												id =
													(attr['value'].match(
														idRegex,
													) ?? [])[1] ?? id;
												break;
										}
									}
								}

								if (id) {
									const svgTransform = SvgTransform.fromString(
										transform,
									);
									const svgPaths = SvgPath.fromString(
										d,
										svgTransform,
									).extractSubpaths();

									args.defs[id] = svgPaths;

									if (args.render) {
										return {
											paths: svgPaths.map((svgPath) =>
												svgPath.transform(args.CTM),
											),
										};
									}
								} else if (args.render) {
									return {
										paths: SvgPath.fromString(
											d,
											SvgTransform.fromString(
												transform,
												args.CTM,
											),
										).extractSubpaths(),
									};
								}
							}
							return {};
						case 'polygon':
							{
								let points: string | undefined,
									transform: string | undefined,
									id: string | undefined;

								for (const attr of Object.values(
									el['$'] ?? {},
								)) {
									if (
										attr instanceof Object &&
										'uri' in attr &&
										'local' in attr &&
										([SVG_NS, ''].includes(attr['uri']) ||
											attr['name'] === 'xml:id')
									) {
										switch (attr['local']) {
											case 'points':
												points =
													attr['value'] ?? points;
												break;
											case 'transform':
												transform =
													attr['value'] ?? transform;
												break;
											case 'id':
												id =
													(attr['value'].match(
														idRegex,
													) ?? [])[1] ?? id;
												break;
										}
									}
								}

								if (id) {
									const svgTransform = SvgTransform.fromString(
										transform,
									);
									const svgPath = SvgPath.fromPolygon(
										points,
										svgTransform,
									);

									args.defs[id] = [svgPath];

									if (args.render) {
										return {
											paths: [
												svgPath.transform(args.CTM),
											],
										};
									}
								} else if (args.render) {
									return {
										paths: [
											SvgPath.fromPolygon(
												points,
												SvgTransform.fromString(
													transform,
													args.CTM,
												),
											),
										],
									};
								}
							}
							return {};
						case 'polyline':
							{
								let points: string | undefined,
									transform: string | undefined,
									id: string | undefined;

								for (const attr of Object.values(
									el['$'] ?? {},
								)) {
									if (
										attr instanceof Object &&
										'uri' in attr &&
										'local' in attr &&
										([SVG_NS, ''].includes(attr['uri']) ||
											attr['name'] === 'xml:id')
									) {
										switch (attr['local']) {
											case 'points':
												points =
													attr['value'] ?? points;
												break;
											case 'transform':
												transform =
													attr['value'] ?? transform;
												break;
											case 'id':
												id =
													(attr['value'].match(
														idRegex,
													) ?? [])[1] ?? id;
												break;
										}
									}
								}

								if (id) {
									const svgTransform = SvgTransform.fromString(
										transform,
									);
									const svgPath = SvgPath.fromPolyline(
										points,
										svgTransform,
									);

									args.defs[id] = [svgPath];

									if (args.render) {
										return {
											paths: [
												svgPath.transform(args.CTM),
											],
										};
									}
								} else if (args.render) {
									return {
										paths: [
											SvgPath.fromPolygon(
												points,
												SvgTransform.fromString(
													transform,
													args.CTM,
												),
											),
										],
									};
								}
							}
							return {};
						case 'rect':
							{
								let x: Decimal | undefined,
									y: Decimal | undefined,
									rx: Decimal | undefined,
									ry: Decimal | undefined,
									width: Decimal | undefined,
									height: Decimal | undefined,
									transform: string | undefined,
									id: string | undefined;

								for (const attr of Object.values(
									el['$'] ?? {},
								)) {
									if (
										attr instanceof Object &&
										'uri' in attr &&
										'local' in attr &&
										([SVG_NS, ''].includes(attr['uri']) ||
											attr['name'] === 'xml:id')
									) {
										switch (attr['local']) {
											case 'x':
												x =
													parseLength(
														attr['value'],
														baseLengthX,
													) ?? x;
												break;
											case 'y':
												y =
													parseLength(
														attr['value'],
														baseLengthY,
													) ?? y;
												break;
											case 'rx':
												if (attr['value'] !== 'auto') {
													rx =
														parseLength(
															attr['value'],
															baseLengthX,
														) ?? rx;
												}
												break;
											case 'ry':
												if (attr['value'] !== 'auto') {
													ry =
														parseLength(
															attr['value'],
															baseLengthY,
														) ?? ry;
												}
												break;
											case 'width':
												width =
													parseLength(
														attr['value'],
														baseLengthX,
													) ?? width;
												break;
											case 'height':
												height =
													parseLength(
														attr['value'],
														baseLengthY,
													) ?? height;
												break;
											case 'transform':
												transform =
													attr['value'] ?? transform;
												break;
											case 'id':
												id =
													(attr['value'].match(
														idRegex,
													) ?? [])[1] ?? id;
												break;
										}
									}
								}

								if (id) {
									const svgTransform = SvgTransform.fromString(
										transform,
									);
									const svgPath = SvgPath.fromRect(
										x,
										y,
										width,
										height,
										rx,
										ry,
										svgTransform,
									);

									args.defs[id] = [svgPath];

									if (args.render) {
										return {
											paths: [
												svgPath.transform(args.CTM),
											],
										};
									}
								} else if (args.render) {
									return {
										paths: [
											SvgPath.fromRect(
												x,
												y,
												width,
												height,
												rx,
												ry,
												SvgTransform.fromString(
													transform,
													args.CTM,
												),
											),
										],
									};
								}
							}
							return {};
						case 'use':
							{
								let x: Decimal | undefined,
									y: Decimal | undefined,
									width: Decimal | undefined,
									height: Decimal | undefined,
									href: string | undefined,
									transform: string | undefined,
									id: string | undefined;

								for (const attr of Object.values(
									el['$'] ?? {},
								)) {
									if (
										attr instanceof Object &&
										'uri' in attr &&
										'local' in attr
									) {
										if (
											[SVG_NS, ''].includes(
												attr['uri'],
											) ||
											attr['name'] === 'xml:id'
										) {
											switch (attr['local']) {
												case 'x':
													x =
														parseLength(
															attr['value'],
															baseLengthX,
														) ?? x;
													break;
												case 'y':
													y =
														parseLength(
															attr['value'],
															baseLengthY,
														) ?? y;
													break;
												case 'width':
													width =
														parseLength(
															attr['value'],
															baseLengthX,
														) ?? width;
													break;
												case 'height':
													height =
														parseLength(
															attr['value'],
															baseLengthY,
														) ?? height;
													break;
												case 'href':
													href =
														(attr['value'].match(
															hrefRegex,
														) ?? [])[1] ?? href;
													break;
												case 'transform':
													transform =
														attr['value'] ??
														transform;
													break;
												case 'id':
													id =
														(attr['value'].match(
															idRegex,
														) ?? [])[1] ?? id;
													break;
											}
										}

										if (
											attr['uri'] === XLINK_NS &&
											attr['local'] === 'href'
										) {
											href =
												(attr['value'].match(
													hrefRegex,
												) ?? [])[1] ?? href;
											console.log({ href });
										}
									}
								}

								if (!href) {
									return {};
								}

								const useTranslateTransform =
									x ?? y
										? new SvgTransform([
												one,
												zero,
												zero,
												one,
												x ?? zero,
												y ?? zero,
										  ])
										: undefined;

								if (id) {
									const svgTransform = SvgTransform.catenate(
										useTranslateTransform,
										SvgTransform.fromString(transform),
									);
									const svgPath = new UnresolvedSvgPath(
										href,
										svgTransform,
									);

									args.defs[id] = [svgPath];

									if (args.render) {
										return {
											paths: [
												svgPath.transform(args.CTM),
											],
										};
									}
								} else if (args.render) {
									const svgPath = new UnresolvedSvgPath(
										href,
										SvgTransform.catenate(
											useTranslateTransform,
											SvgTransform.fromString(
												transform,
												args.CTM,
											),
										),
									);

									return {
										paths: [svgPath],
									};
								}
							}
							return {};
					}
				}
			} else if (Array.isArray(el['$$'])) {
				el['$$'].forEach((node) => extractPaths(node, args));
			}

			return {};
		};

		extractPaths(result);

		return documents.map((document) => new SvgDocument(document));
	}

	toString(usePhysicalDimensions = true): string {
		// Use physical dimension units to support software that assumes PPI is not 96
		const [width, height] = [
			this.structure.properties.width,
			this.structure.properties.height,
		].map((dimension) =>
			usePhysicalDimensions ? `${dimension.mul(0.75)}pt` : `${dimension}`,
		);

		return `<svg width="${width}" height="${height}" version="${
			this.structure.properties.version
		}" ${
			this.structure.properties.viewBox
				? `viewBox="${this.structure.properties.viewBox.minX} ${this.structure.properties.viewBox.minY} ${this.structure.properties.viewBox.width} ${this.structure.properties.viewBox.height}"`
				: ''
		} xmlns="${SVG_NS}"><style type="text/css">@media only screen { path{fill:none;stroke:#000000;stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;stroke-opacity:1;} }</style><g>${
			this.structure.paths.length
				? this.structure.paths
						.map((path) => `<path d="${path}" />`)
						.join('')
				: ''
		}</g></svg>`;
	}

	reorderPaths(strategy: Strategy): void {
		const reorderedPaths = sortPathsByRelativePosition(
			this.structure.paths,
			strategy,
			this.structure.properties.viewBox
				? [
						this.structure.properties.viewBox.minX,
						this.structure.properties.viewBox.minY,
				  ]
				: undefined,
		);
		this.structure.paths = reorderedPaths;
	}
}
