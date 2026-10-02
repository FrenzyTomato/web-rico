/** Fixed world-space dimensions keep the glyph/model ratio unchanged at every zoom. */
export function labelWorldSize(height: number, canvasWidth: number, canvasHeight: number, maxWidth = Infinity) {
  const unit = Math.min(height * 0.34 / 64, maxWidth / canvasWidth);
  return [canvasWidth * unit, canvasHeight * unit] as const;
}
