import React, { type ReactNode, useEffect, useRef } from 'react';

export type PixelRange = {
  start: { x: number; y: number };
  end: { x: number; y: number };
};

export type Props = {
  /**
   * Range of pixels to transform. Can be a single pixel or a range.
   * If array has one element, it transforms that single pixel.
   * If array has two elements, it transforms the range from start to end (inclusive).
   */
  readonly range: [{ x: number; y: number }] | [{ x: number; y: number }, { x: number; y: number }];

  /**
   * Function which transforms the content at the specified pixels.
   * It receives the current string content and should return the transformed content.
   */
  readonly transform: (content: string) => string;

  readonly children?: ReactNode;
};

// Global registry for pixel transformations
const pixelTransformations = new Set<{
  range: PixelRange;
  transform: (content: string) => string;
}>();

export const getPixelTransformations = () => pixelTransformations;

export const clearPixelTransformations = () => {
  pixelTransformations.clear();
};

/**
 * PixelTransform component allows you to apply chalk transformations to specific pixel coordinates
 * in the terminal. These transformations are applied after all other styles to ensure they are not overwritten.
 * 
 * Example:
 * ```jsx
 * <Box>
 *   <Text>Hello there</Text>
 *   <PixelTransform 
 *     range={[{ x: 2, y: 0 }, { x: 6, y: 0 }]} 
 *     transform={string => chalk.inverse(string)} 
 *   />
 * </Box>
 * ```
 */
export default function PixelTransform({ range, transform, children }: Props) {
  const transformationRef = useRef<{
    range: PixelRange;
    transform: (content: string) => string;
  } | null>(null);

  useEffect(() => {
    // Clean up previous transformation if it exists
    if (transformationRef.current) {
      pixelTransformations.delete(transformationRef.current);
    }

    // Normalize range - if single element, make it a range of one pixel
    const normalizedRange: PixelRange = range.length === 1
      ? { start: range[0], end: range[0] }
      : { start: range[0], end: range[1] };

    // Create new transformation object
    const transformation = {
      range: normalizedRange,
      transform,
    };

    // Store reference and add to global registry
    transformationRef.current = transformation;
    pixelTransformations.add(transformation);

    // Cleanup function to remove transformation when component unmounts or changes
    return () => {
      if (transformationRef.current) {
        pixelTransformations.delete(transformationRef.current);
        transformationRef.current = null;
      }
    };
  }, [range, transform]);

  // This component doesn't render anything itself, it just registers transformations
  return children ? <>{children}</> : null;
} 