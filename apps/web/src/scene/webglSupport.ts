/** Three.js needs WebGL 2. Probe once per page and immediately release the temporary context.
 * Probing during every React render exhausts the browser's context limit and evicts the board.
 */
let supported: boolean | undefined;
export function webglAvailable(): boolean {
  if (supported !== undefined) return supported;
  supported = false;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('webgl2');
    supported = context !== null;
    context?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    // Some browsers throw instead of returning null when graphics are unavailable.
  }
  return supported;
}
