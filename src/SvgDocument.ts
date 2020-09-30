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

type SvgDocumentStructure = {
	properties: {
		width: Decimal;
		height: Decimal;
		viewBox?: SvgViewBox;
		version: string;
	};
	paths: SvgPath[];
};

const SVG_NS = 'http://www.w3.org/2000/svg';

const parseLength = (value: string, baseLength: Decimal) => {
	const match = value.match(
		/^\s*([+-]?[0-9]+(?:[Ee][+-]?[0-9]+)?|[+-]?[0-9]*[.][0-9]+(?:[Ee][+-]?[0-9]+)?)(em|ex|px|in|cm|mm|pt|pc|%)?\s*$/,
	);
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
			document: SvgDocumentStructure | undefined = undefined,
			currentTransform: SvgTransform | undefined = undefined,
		) => {
			if (el['$ns']['uri'] === SVG_NS) {
				if (el['$ns']['local'] === 'svg') {
					if (document) {
						throw new Error('Unsupported nested document');
					}

					document = {
						properties: {
							width: new Decimal(300),
							height: new Decimal(150),
							version: '1.1',
						},
						paths: [],
					};
					documents.push(document);

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
									document.properties.width =
										parseLength(
											attr['value'],
											document.properties.width,
										) ?? document.properties.width;
									break;
								case 'height':
									document.properties.height =
										parseLength(
											attr['value'],
											document.properties.height,
										) ?? document.properties.height;
									break;
								case 'viewBox':
									{
										const viewBox = String(
											attr['value'],
										).match(
											/^\s*([+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[Ee][+-]?[0-9]+)?)(?:\s+|\s*,\s*|(?=[+-.]))([+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[Ee][+-]?[0-9]+)?)(?:\s+|\s*,\s*|(?=[+-.]))([+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[Ee][+-]?[0-9]+)?)(?:\s+|\s*,\s*|(?=[+-.]))([+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[Ee][+-]?[0-9]+)?)\s*$/,
										);
										if (viewBox) {
											document.properties.viewBox = {
												minX: new Decimal(viewBox[1]),
												minY: new Decimal(viewBox[2]),
												width: new Decimal(viewBox[3]),
												height: new Decimal(viewBox[4]),
											};
										}
									}
									break;
								case 'version':
									document.properties.version = attr['value'];
									break;
								case 'transform':
									currentTransform = SvgTransform.fromString(
										attr['value'],
										currentTransform,
									);
									break;
							}
						}
					}
				} else if (document === undefined) {
					return;
				} else {
					const baseLengthX =
						document.properties.viewBox?.width ??
						document.properties.width;
					const baseLengthY =
						document.properties.viewBox?.height ??
						document.properties.height;
					const baseLength = baseLengthX
						.pow(2)
						.plus(baseLengthY.pow(2))
						.div(2)
						.sqrt();

					switch (el['$ns']['local']) {
						case 'g':
							for (const attr of Object.values(el['$'] ?? {})) {
								if (
									attr instanceof Object &&
									'uri' in attr &&
									'local' in attr &&
									[SVG_NS, ''].includes(attr['uri'])
								) {
									switch (attr['local']) {
										case 'transform':
											currentTransform = SvgTransform.fromString(
												attr['value'],
												currentTransform,
											);
											break;
									}
								}
							}
							break;
						case 'circle':
							{
								let cx: Decimal | undefined,
									cy: Decimal | undefined,
									r: Decimal | undefined;

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
												currentTransform = SvgTransform.fromString(
													attr['value'],
													currentTransform,
												);
												break;
										}
									}
								}

								document.paths.push(
									SvgPath.fromCircle(
										cx,
										cy,
										r,
										currentTransform,
									),
								);
							}
							return;
						case 'ellipse':
							{
								let cx: Decimal | undefined,
									cy: Decimal | undefined,
									rx: Decimal | undefined,
									ry: Decimal | undefined;

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
												currentTransform = SvgTransform.fromString(
													attr['value'],
													currentTransform,
												);
												break;
										}
									}
								}

								document.paths.push(
									SvgPath.fromEllipse(
										cx,
										cy,
										rx,
										ry,
										currentTransform,
									),
								);
							}
							return;
						case 'line':
							{
								let x1: Decimal | undefined,
									x2: Decimal | undefined,
									y1: Decimal | undefined,
									y2: Decimal | undefined;

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
												currentTransform = SvgTransform.fromString(
													attr['value'],
													currentTransform,
												);
												break;
										}
									}
								}

								document.paths.push(
									SvgPath.fromLine(
										x1,
										y1,
										x1,
										y2,
										currentTransform,
									),
								);
							}
							return;
						case 'path':
							{
								let d: string | undefined;

								for (const attr of Object.values(
									el['$'] ?? {},
								)) {
									if (
										attr instanceof Object &&
										'uri' in attr &&
										'local' in attr &&
										[SVG_NS, ''].includes(attr['uri'])
									) {
										if (attr['local'] === 'd') {
											d = attr['value'] ?? d;
										} else if (
											attr['local'] === 'transform'
										) {
											currentTransform = SvgTransform.fromString(
												attr['value'],
												currentTransform,
											);
										}
									}
								}

								document.paths.push(
									...SvgPath.fromString(
										d,
										currentTransform,
									).extractSubpaths(),
								);
							}
							return;
						case 'polygon':
							{
								let points: string | undefined;

								for (const attr of Object.values(
									el['$'] ?? {},
								)) {
									if (
										attr instanceof Object &&
										'uri' in attr &&
										'local' in attr &&
										[SVG_NS, ''].includes(attr['uri'])
									) {
										if (attr['local'] === 'points') {
											points = attr['value'] ?? points;
										} else if (
											attr['local'] === 'transform'
										) {
											currentTransform = SvgTransform.fromString(
												attr['value'],
												currentTransform,
											);
										}
									}
								}

								document.paths.push(
									SvgPath.fromPolygon(
										points,
										currentTransform,
									),
								);
							}
							return;
						case 'polyline':
							{
								let points: string | undefined;

								for (const attr of Object.values(
									el['$'] ?? {},
								)) {
									if (
										attr instanceof Object &&
										'uri' in attr &&
										'local' in attr &&
										[SVG_NS, ''].includes(attr['uri'])
									) {
										if (attr['local'] === 'points') {
											points = attr['value'] ?? points;
										} else if (
											attr['local'] === 'transform'
										) {
											currentTransform = SvgTransform.fromString(
												attr['value'],
												currentTransform,
											);
										}
									}
								}

								document.paths.push(
									SvgPath.fromPolyline(
										points,
										currentTransform,
									),
								);
							}
							return;
						case 'rect':
							{
								let x: Decimal | undefined,
									y: Decimal | undefined,
									rx: Decimal | undefined,
									ry: Decimal | undefined,
									width: Decimal | undefined,
									height: Decimal | undefined;

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
												currentTransform = SvgTransform.fromString(
													attr['value'],
													currentTransform,
												);
												break;
										}
									}
								}

								document.paths.push(
									SvgPath.fromRect(
										x,
										y,
										width,
										height,
										rx,
										ry,
										currentTransform,
									),
								);
							}
							return;
					}
				}
			}
			if (Array.isArray(el['$$'])) {
				el['$$'].forEach((node) =>
					extractPaths(node, document, currentTransform),
				);
			}
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
