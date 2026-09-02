"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseAutoScrollOptions {
  /** Whether the current session is actively streaming */
  isStreaming: boolean;
  /** Distance from bottom (px) to consider "at bottom" */
  threshold?: number;
}

interface UseAutoScrollReturn {
  /** Whether to show the scroll-to-bottom button */
  showScrollButton: boolean;
  /** Programmatically scroll to bottom (smooth) and re-arm autoscroll */
  scrollToBottom: () => void;
  /** Ref to attach to the scrollable container */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Ref to attach to the content wrapper inside the scroll container (for ResizeObserver) */
  contentRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Auto-scroll hook for chat interfaces.
 *
 * Architecture:
 * - The scroll container is the overflow-y:auto div (passed as containerRef).
 * - The content wrapper is a child div inside the container (passed as contentRef).
 *   ResizeObserver watches the content wrapper to detect content growth during streaming.
 *
 * User scroll detection:
 * - We listen to `wheel`, `touchmove`, and `pointerdown` events on the scroll container
 *   to detect user-initiated scrolls. These events fire BEFORE the scroll happens,
 *   so we can set a flag to ignore the subsequent scroll event.
 * - We do NOT use the `scroll` event alone for user detection, because our own
 *   programmatic scrollTo calls also fire scroll events.
 *
 * The `scroll` event listener is still used for one purpose: updating showScrollButton
 * visibility when the user drags the scrollbar (which doesn't fire wheel/touchmove).
 * But the programmatic-scroll lock prevents it from toggling autoScroll.
 */
export function useAutoScroll(
  containerRef: React.RefObject<HTMLDivElement | null>,
  { isStreaming, threshold = 120 }: UseAutoScrollOptions
): UseAutoScrollReturn {
  const [showScrollButton, setShowScrollButton] = useState(false);

  // "is near bottom" state — when true, autoscroll follows streaming content.
  // Starts true so the first stream auto-scrolls.
  const isNearBottomRef = useRef(true);

  // Lock: set before our own scrollTo calls, cleared on next frame.
  // The scroll event listener checks this to skip programmatic scrolls.
  const isProgrammaticScroll = useRef(false);

  // Content ref — the caller attaches this to a wrapper div inside the scroll container.
  // ResizeObserver watches this element for content growth.
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Keep latest values in refs for callbacks
  const isStreamingRef = useRef(isStreaming);
  const thresholdRef = useRef(threshold);
  useEffect(() => { isStreamingRef.current = isStreaming; }, [isStreaming]);
  useEffect(() => { thresholdRef.current = threshold; }, [threshold]);

  /**
   * Compute distance from bottom: scrollHeight - scrollTop - clientHeight.
   * Returns 0 when fully scrolled to bottom.
   */
  const getDistanceFromBottom = useCallback((): number => {
    const el = containerRef.current;
    if (!el) return 0;
    return el.scrollHeight - el.scrollTop - el.clientHeight;
  }, [containerRef]);

  /**
   * Check if the container is scrolled to the bottom (within threshold).
   */
  const isAtBottom = useCallback((): boolean => {
    return getDistanceFromBottom() <= thresholdRef.current;
  }, [getDistanceFromBottom]);

  /**
   * Scroll the container to the bottom instantly.
   * Sets the programmatic scroll lock so the scroll listener
   * ignores this event and doesn't disable auto-scroll.
   */
  const scrollToBottomInstant = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    isProgrammaticScroll.current = true;
    el.scrollTop = el.scrollHeight;
    // Release the lock after the browser has processed the scroll event.
    // Two rAFs ensures the scroll event has been delivered and processed.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isProgrammaticScroll.current = false;
      });
    });
  }, [containerRef]);

  /**
   * Public API: smooth scroll to bottom.
   * Also re-arms autoscroll so it resumes following new streamed content.
   */
  const scrollToBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    isProgrammaticScroll.current = true;
    isNearBottomRef.current = true;
    setShowScrollButton(false);
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    // Release lock after smooth scroll completes (use transitionend as a backup)
    const onTransitionEnd = () => {
      isProgrammaticScroll.current = false;
      el.removeEventListener("scroll", onTransitionEnd);
    };
    el.addEventListener("scroll", onTransitionEnd, { once: true });
    // Fallback timeout in case scroll event doesn't fire (e.g. already at bottom)
    setTimeout(() => {
      isProgrammaticScroll.current = false;
    }, 500);
  }, [containerRef]);

  // ─── User intent detection via wheel / touchmove / pointerdown ───────────
  //
  // These events fire BEFORE the scroll occurs, so we can set a flag to tell
  // the scroll event listener "this scroll was user-initiated, not ours".
  // We do NOT use these to directly set autoScroll — we let the scroll position
  // check in the scroll listener handle that (so scrollbar drags are also caught).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // When a user gesture starts, mark that the next scroll event is user-initiated.
    // We use a counter instead of a boolean so that multiple rapid events don't
    // clear the flag before the scroll event fires.
    let userGestureCount = 0;

    const markUserGesture = () => {
      userGestureCount++;
      // The scroll event handler decrements this. If it reaches 0, we know
      // no more user gestures are pending.
    };

    const onWheel = () => markUserGesture();
    const onTouchMove = () => markUserGesture();
    const onPointerDown = (e: PointerEvent) => {
      // Only count pointer down on the scrollbar area or inside the container.
      // Pointer down on buttons/links inside messages shouldn't count.
      if (e.target instanceof Element && e.target.closest("button, a, input, textarea")) return;
      markUserGesture();
    };

    el.addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("pointerdown", onPointerDown, { passive: true });

    // The scroll event listener:
    // - Updates button visibility (for scrollbar drag, which doesn't fire wheel/touch).
    // - Detects if user scrolled away from bottom → disable autoscroll.
    // - Ignores programmatic scrolls via the lock.
    let scrollRaf: number | null = null;

    const onScroll = () => {
      if (scrollRaf !== null) return;
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = null;

        // If this scroll was caused by our own scrollTo calls, skip.
        if (isProgrammaticScroll.current) return;

        // If a user gesture (wheel/touch/pointer) preceded this scroll,
        // it's definitely user-initiated.
        const isUserGesture = userGestureCount > 0;
        if (isUserGesture) {
          userGestureCount = Math.max(0, userGestureCount - 1);
        }

        const distance = getDistanceFromBottom();
        const atBottom = distance <= thresholdRef.current;

        if (isUserGesture) {
          // User scrolled — update autoscroll state based on position.
          isNearBottomRef.current = atBottom;
        }

        // Always update button visibility regardless of scroll source.
        setShowScrollButton(!atBottom);
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("scroll", onScroll);
      if (scrollRaf !== null) cancelAnimationFrame(scrollRaf);
    };
  }, [containerRef, getDistanceFromBottom]);

  // ─── ResizeObserver on CONTENT wrapper ───────────────────────────────────
  //
  // The key fix: we observe the content wrapper (not the scroll container).
  // When tokens are streamed, the content grows, the content wrapper's height
  // increases, and the ResizeObserver fires. Then we check if we should scroll.
  useEffect(() => {
    const contentEl = contentRef.current;
    if (!contentEl) return;

    let resizeRaf: number | null = null;

    const onResize = () => {
      if (resizeRaf !== null) return;
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = null;

        // Update button visibility in case content grew but user hasn't scrolled.
        const distance = getDistanceFromBottom();
        const atBottom = distance <= thresholdRef.current;
        isNearBottomRef.current = atBottom;
        setShowScrollButton(!atBottom);

        // If autoscroll is armed and we're streaming (or were near bottom),
        // scroll to bottom to follow new content.
        if (isNearBottomRef.current) {
          if (isStreamingRef.current || atBottom) {
            scrollToBottomInstant();
          }
        }
      });
    };

    const observer = new ResizeObserver(onResize);
    observer.observe(contentEl);

    return () => {
      observer.disconnect();
      if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
    };
  }, [contentRef, getDistanceFromBottom, scrollToBottomInstant]);

  // ─── Reset when streaming starts ─────────────────────────────────────────
  //
  // When isStreaming transitions false→true, a new stream has started.
  // Force auto-scroll on and scroll to bottom instantly.
  const prevStreamingRef = useRef(false);
  useEffect(() => {
    if (isStreaming && !prevStreamingRef.current) {
      isNearBottomRef.current = true;
      setShowScrollButton(false);
      scrollToBottomInstant();
    }
    prevStreamingRef.current = isStreaming;
  }, [isStreaming, scrollToBottomInstant]);

  return {
    showScrollButton,
    scrollToBottom,
    containerRef,
    contentRef,
  };
}
