import sliceAnsi from 'slice-ansi';
import stringWidth from 'string-width';
import widestLine from 'widest-line';
import {
	type StyledChar,
	styledCharsFromTokens,
	styledCharsToString,
	tokenize,
} from '@alcalzone/ansi-tokenize';
import {type OutputTransformer} from './render-node-to-output.js';
import {getPixelTransformations} from './components/PixelTransform.js';

/**
 * "Virtual" output class
 *
 * Handles the positioning and saving of the output of each node in the tree.
 * Also responsible for applying transformations to each character of the output.
 *
 * Used to generate the final output of all nodes before writing it to actual output stream (e.g. stdout)
 */

type Options = {
	width: number;
	height: number;
};

type Operation = WriteOperation | ClipOperation | UnclipOperation;

type WriteOperation = {
	type: 'write';
	x: number;
	y: number;
	text: string;
	transformers: OutputTransformer[];
};

type ClipOperation = {
	type: 'clip';
	clip: Clip;
};

type Clip = {
	x1: number | undefined;
	x2: number | undefined;
	y1: number | undefined;
	y2: number | undefined;
};

type UnclipOperation = {
	type: 'unclip';
};

export default class Output {
	width: number;
	height: number;

	private readonly operations: Operation[] = [];

	constructor(options: Options) {
		const {width, height} = options;

		this.width = width;
		this.height = height;
	}

	write(
		x: number,
		y: number,
		text: string,
		options: {transformers: OutputTransformer[]},
	): void {
		const {transformers} = options;

		if (!text) {
			return;
		}

		this.operations.push({
			type: 'write',
			x,
			y,
			text,
			transformers,
		});
	}

	clip(clip: Clip) {
		this.operations.push({
			type: 'clip',
			clip,
		});
	}

	unclip() {
		this.operations.push({
			type: 'unclip',
		});
	}

	get(): {output: string; height: number} {
		// Initialize output array with a specific set of rows, so that margin/padding at the bottom is preserved
		const output: StyledChar[][] = [];

		for (let y = 0; y < this.height; y++) {
			const row: StyledChar[] = [];

			for (let x = 0; x < this.width; x++) {
				row.push({
					type: 'char',
					value: ' ',
					fullWidth: false,
					styles: [],
				});
			}

			output.push(row);
		}

		const clips: Clip[] = [];

		for (const operation of this.operations) {
			if (operation.type === 'clip') {
				clips.push(operation.clip);
			}

			if (operation.type === 'unclip') {
				clips.pop();
			}

			if (operation.type === 'write') {
				const {text, transformers} = operation;
				let {x, y} = operation;
				let lines = text.split('\n');

				const clip = clips.at(-1);

				if (clip) {
					const clipHorizontally =
						typeof clip?.x1 === 'number' && typeof clip?.x2 === 'number';

					const clipVertically =
						typeof clip?.y1 === 'number' && typeof clip?.y2 === 'number';

					// If text is positioned outside of clipping area altogether,
					// skip to the next operation to avoid unnecessary calculations
					if (clipHorizontally) {
						const width = widestLine(text);

						if (x + width < clip.x1! || x > clip.x2!) {
							continue;
						}
					}

					if (clipVertically) {
						const height = lines.length;

						if (y + height < clip.y1! || y > clip.y2!) {
							continue;
						}
					}

					if (clipHorizontally) {
						lines = lines.map(line => {
							const from = x < clip.x1! ? clip.x1! - x : 0;
							const width = stringWidth(line);
							const to = x + width > clip.x2! ? clip.x2! - x : width;

							return sliceAnsi(line, from, to);
						});

						if (x < clip.x1!) {
							x = clip.x1!;
						}
					}

					if (clipVertically) {
						const from = y < clip.y1! ? clip.y1! - y : 0;
						const height = lines.length;
						const to = y + height > clip.y2! ? clip.y2! - y : height;

						lines = lines.slice(from, to);

						if (y < clip.y1!) {
							y = clip.y1!;
						}
					}
				}

				let offsetY = 0;

				for (let [index, line] of lines.entries()) {
					const currentLine = output[y + offsetY];

					// Line can be missing if `text` is taller than height of pre-initialized `this.output`
					if (!currentLine) {
						continue;
					}

					for (const transformer of transformers) {
						line = transformer(line, index);
					}

					const characters = styledCharsFromTokens(tokenize(line));
					let offsetX = x;

					for (const character of characters) {
						currentLine[offsetX] = character;

						// Some characters take up more than one column. In that case, the following
						// pixels need to be cleared to avoid printing extra characters
						const isWideCharacter =
							character.fullWidth || character.value.length > 1;

						if (isWideCharacter) {
							currentLine[offsetX + 1] = {
								type: 'char',
								value: '',
								fullWidth: false,
								styles: character.styles,
							};
						}

						offsetX += isWideCharacter ? 2 : 1;
					}

					offsetY++;
				}
			}
		}

		let generatedOutput = output.map(line => {
			// See https://github.com/vadimdemedes/ink/pull/564#issuecomment-1637022742
			const lineWithoutEmptyItems = line.filter(item => item !== undefined);
			return styledCharsToString(lineWithoutEmptyItems).trimEnd();
		});

		// Apply pixel transformations last to ensure they are not overwritten
		generatedOutput = this.applyPixelTransformations(generatedOutput);

		return {
			output: generatedOutput.join('\n'),
			height: output.length,
		};
	}

	private applyPixelTransformations(lines: string[]): string[] {
		const pixelTransformations = getPixelTransformations();

		if (pixelTransformations.size === 0) {
			return lines;
		}

		// Create a copy of lines to avoid modifying the original
		const transformedLines = [...lines];

		// Apply all pixel transformations
		for (const {range, transform} of pixelTransformations) {
			const {start, end} = range;

			// Handle multi-line ranges
			for (let y = start.y; y <= end.y && y < transformedLines.length; y++) {
				const line = transformedLines[y];
				if (!line) continue;

				let startX: number;
				let endX: number;

				if (start.y === end.y) {
					// Single line transformation
					startX = start.x;
					endX = end.x;
				} else if (y === start.y) {
					// First line of multi-line transformation
					startX = start.x;
					endX = stringWidth(line) - 1;
				} else if (y === end.y) {
					// Last line of multi-line transformation
					startX = 0;
					endX = end.x;
				} else {
					// Middle lines of multi-line transformation
					startX = 0;
					endX = stringWidth(line) - 1;
				}

				// Ensure coordinates are within bounds
				const lineWidth = stringWidth(line);
				startX = Math.max(0, Math.min(startX, lineWidth));
				endX = Math.max(startX, Math.min(endX, lineWidth - 1));

				// Use ANSI-aware slicing to avoid corrupting escape sequences
				const before = sliceAnsi(line, 0, startX);
				const toTransform = sliceAnsi(line, startX, endX + 1);
				const after = sliceAnsi(line, endX + 1);

				if (toTransform) {
					// Apply the transformation
					let transformed = transform(toTransform);

					// Ensure transformed content maintains the same visual width
					const originalWidth = stringWidth(toTransform);
					const transformedWidth = stringWidth(transformed);

					if (transformedWidth > originalWidth) {
						// Truncate if too long
						transformed = sliceAnsi(transformed, 0, originalWidth);
					} else if (transformedWidth < originalWidth) {
						// Pad with spaces if too short
						transformed =
							transformed + ' '.repeat(originalWidth - transformedWidth);
					}

					transformedLines[y] = before + transformed + after;
				}
			}
		}

		return transformedLines;
	}
}
