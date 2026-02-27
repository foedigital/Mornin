import { useRef, useCallback } from "react";

interface SwipeNavigationOptions {
  onNext: () => void;
  onPrev: () => void;
  swipeThreshold?: number;
}

/**
 * Reliable touch navigation for mobile cards.
 *
 * Handles tap (→ next), swipe-right (→ prev), swipe-left (→ next).
 * Ignores touches on interactive children (buttons, links) so their
 * own handlers fire instead.  Skips vertical scrolls so the page
 * still scrolls normally.  Prevents the synthetic click that browsers
 * fire after touchend from double-advancing.
 */
export function useSwipeNavigation({
  onNext,
  onPrev,
  swipeThreshold = 50,
}: SwipeNavigationOptions) {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchHandled = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return;

      // Don't navigate if touch landed on an interactive child element
      const target = e.target as HTMLElement;
      if (target.closest('button, a, input, select, textarea, [role="button"]')) {
        touchStartX.current = null;
        touchStartY.current = null;
        return;
      }

      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = e.changedTouches[0].clientY - touchStartY.current;

      // If vertical movement dominates, user is scrolling — bail out
      if (Math.abs(dy) > 30 && Math.abs(dy) > Math.abs(dx)) {
        touchStartX.current = null;
        touchStartY.current = null;
        return;
      }

      if (dx > swipeThreshold) {
        onPrev(); // swipe right → previous
      } else if (dx < -swipeThreshold) {
        onNext(); // swipe left → next
      } else {
        onNext(); // small movement = tap → next
      }

      touchHandled.current = true;
      touchStartX.current = null;
      touchStartY.current = null;
    },
    [onNext, onPrev, swipeThreshold]
  );

  // Desktop mouse clicks still work; on touch devices we skip the
  // synthetic click that fires after our touchEnd already handled it.
  const handleClick = useCallback(() => {
    if (touchHandled.current) {
      touchHandled.current = false;
      return;
    }
    onNext();
  }, [onNext]);

  return { handleTouchStart, handleTouchEnd, handleClick };
}
