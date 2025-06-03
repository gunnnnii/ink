import React, { type ReactNode, useEffect, useRef, useContext, useState, useCallback } from 'react';
import { createContext } from 'react';
import Text from './Text.js';

/**
 * Context for triggering re-renders when pixel transformations change.
 */
const PixelTransformContext = createContext<() => void>(null!);

PixelTransformContext.displayName = 'PixelTransformContext';

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

export function PixelTransformProvider({ children }: { children: ReactNode }) {
  const [, forceUpdate] = useState(Symbol());

  const handleForceUpdate = useCallback(() => {
    forceUpdate(Symbol());
  }, []);

  return (
    <PixelTransformContext.Provider value={handleForceUpdate}>
      {children}
    </PixelTransformContext.Provider>
  );
}

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
  const [id, forceUpdate] = useState(0);
  // const forceUpdate = useContext(PixelTransformContext);
  const transformationRef = useRef<{
    range: PixelRange;
    transform: (content: string) => string;
  } | null>(null);

  // Store previous values to compare for changes
  const previousValuesRef = useRef<{
    range: typeof range;
    transform: typeof transform;
  } | null>(null);

  useEffect(() => {
    // Check if the range or transform has actually changed
    const hasChanged = !previousValuesRef.current ||
      JSON.stringify(previousValuesRef.current.range) !== JSON.stringify(range) ||
      previousValuesRef.current.transform !== transform;

    // Store current values for next comparison
    previousValuesRef.current = { range, transform };

    // Only proceed if something actually changed
    if (!hasChanged) {
      return;
    }

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

    // Trigger a re-render of the entire app only when something changed
    forceUpdate((id) => id + 1);

    // Cleanup function to remove transformation when component unmounts or changes
    return () => {
      if (transformationRef.current) {
        pixelTransformations.delete(transformationRef.current);
        transformationRef.current = null;
        // Trigger update when transformation is removed
      }
    };
  }, [range, transform, forceUpdate]);

  // This component doesn't render anything itself, it just registers transformations
  return children ? <><Text key={id}>{""}</Text>{children}</> : <Text key={id}>{""}</Text>;
} 