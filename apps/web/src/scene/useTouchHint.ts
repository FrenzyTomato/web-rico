import { useEffect, useRef } from 'react';

/** A long press inspects a piece; dragging/pinching never opens a tooltip or selects it. */
export function useTouchHint(show: () => void) {
  const press = useRef<{ x: number; y: number; id: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppress = useRef(false);
  const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; press.current = null; };
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const p = press.current;
      if (p && (e.pointerId !== p.id || Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10)) { suppress.current = true; clear(); }
    };
    const second = (e: PointerEvent) => { if (press.current && e.pointerId !== press.current.id) { suppress.current = true; clear(); } };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerdown', second);
    window.addEventListener('pointerup', clear);
    window.addEventListener('pointercancel', clear);
    return () => { clear(); window.removeEventListener('pointermove', move); window.removeEventListener('pointerdown', second); window.removeEventListener('pointerup', clear); window.removeEventListener('pointercancel', clear); };
  }, []);
  return {
    isTouch: (e: { pointerType?: string }) => e.pointerType === 'touch' && window.matchMedia('(max-width: 700px)').matches,
    down: (e: { clientX: number; clientY: number; pointerId: number }) => {
      clear(); suppress.current = false;
      press.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      timer.current = setTimeout(() => { suppress.current = true; show(); timer.current = null; }, 500);
    },
    cancel: clear,
    suppressClick: () => suppress.current,
  };
}
