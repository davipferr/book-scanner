/** Longest side of a stored page image; enough for OCR without filling the phone's storage. */
export const MAX_PAGE_SIDE = 2400;

export interface Size {
  width: number;
  height: number;
}

/** Scales a size down (never up) so its longest side is at most `maxSide`, keeping the aspect ratio. */
export function fitWithin(size: Size, maxSide: number): Size {
  const longest = Math.max(size.width, size.height);
  if (longest <= maxSide || longest === 0) return { width: size.width, height: size.height };
  const scale = maxSide / longest;
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}
