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

// TODO: Support for whole range of characters allowed in the SVG spec
const hrefRegex = /^\s*#([:A-Z_a-z]*)\s*$/u;
const idRegex = /^[:A-Z_a-z][-.0-9:A-Z_a-z]*$/u;
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
							[SVG_NS, ''].includes(attr['uri'])
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

					const svgTransform: SvgTransform = SvgTransform.fromString(
						transform,
					);

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
									[SVG_NS, ''].includes(attr['uri'])
								) {
									switch (attr['local']) {
										case 'transform':
											transform =
												attr['value'] ?? transform;
											break;
										case 'id':
											id =
												(attr['value'].match(idRegex) ||
													[])[0] ?? id;
											break;
									}
								}
							}

							if (Array.isArray(el['$$'])) {
								const svgTransform = transform
									? SvgTransform.fromString(transform)
									: undefined;

								const args_ = {
									defs: args.defs,
									properties: args.properties,
									render: true,
									CTM:
										(id
											? svgTransform
											: args.CTM?.catenate(
													svgTransform,
											  )) ?? svgTransform,
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
										[SVG_NS, ''].includes(attr['uri'])
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
													) || [])[0] ?? id;
												break;
										}
									}
								}

								if (id) {
									const svgTransform = transform
										? SvgTransform.fromString(transform)
										: undefined;
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
										[SVG_NS, ''].includes(attr['uri'])
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
													) || [])[0] ?? id;
												break;
										}
									}
								}

								if (id) {
									const svgTransform = transform
										? SvgTransform.fromString(transform)
										: undefined;
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
										[SVG_NS, ''].includes(attr['uri'])
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
													) || [])[0] ?? id;
												break;
										}
									}
								}

								if (id) {
									const svgTransform = transform
										? SvgTransform.fromString(transform)
										: undefined;
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
										[SVG_NS, ''].includes(attr['uri'])
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
													) || [])[0] ?? id;
												break;
										}
									}
								}

								if (id) {
									const svgTransform = transform
										? SvgTransform.fromString(transform)
										: undefined;
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
										[SVG_NS, ''].includes(attr['uri'])
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
													) || [])[0] ?? id;
												break;
										}
									}
								}

								if (id) {
									const svgTransform = transform
										? SvgTransform.fromString(transform)
										: undefined;
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
										[SVG_NS, ''].includes(attr['uri'])
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
													) || [])[0] ?? id;
												break;
										}
									}
								}

								if (id) {
									const svgTransform = transform
										? SvgTransform.fromString(transform)
										: undefined;
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
										[SVG_NS, ''].includes(attr['uri'])
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
													) || [])[0] ?? id;
												break;
										}
									}
								}

								if (id) {
									const svgTransform = transform
										? SvgTransform.fromString(transform)
										: undefined;
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
											[SVG_NS, ''].includes(attr['uri'])
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
														) || [])[0] ?? id;
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
										}
									}
								}

								if (!href) {
									return {};
								}
								const useTranslateTransform =
									x || y
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
									const svgTransform =
										transform || useTranslateTransform
											? SvgTransform.fromString(
													transform,
											  ).catenate(useTranslateTransform)
											: undefined;
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
										transform || args.CTM
											? SvgTransform.fromString(
													transform,
													args.CTM,
											  ).catenate(useTranslateTransform)
											: useTranslateTransform,
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

	toString(): string {
		return `<svg width="${this.structure.properties.width}" height="${
			this.structure.properties.height
		}" version="${this.structure.properties.version}" ${
			this.structure.properties.viewBox
				? `viewBox="${this.structure.properties.viewBox.minX} ${this.structure.properties.viewBox.minY} ${this.structure.properties.viewBox.width} ${this.structure.properties.viewBox.height}"`
				: ''
		} xmlns="${SVG_NS}"><style type="text/css">path{fill:none;stroke:#000000;stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;stroke-opacity:1;}</style><g>${
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
