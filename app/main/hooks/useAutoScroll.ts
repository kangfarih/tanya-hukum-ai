"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseAutoScrollOptions {
  /** Whether the current session is actively streaming */
  isStreaming: boolean;
  /** Distance from bottom (px) to consider "at bottom" */
  threshold?: number;
}

interface UseAutoScrollReturn {
  /** Whether auto-scroll is currently enabled */
  autoScroll: boolean;
  /** Whether to show the scroll-to-bottom button */
  showScrollButton: boolean;
  /** Programmatically scroll to bottom (smooth) */
  scrollToBottom: () => void;
  /** Ref to attach to the scrollable container */
  containerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Auto-scroll hook for chat interfaces.
 *
 * Tracks scroll position to determine if the user is "at bottom" and
 * automatically scrolls to bottom while streaming new content.
 *
 * Uses a "scroll lock" pattern to avoid feedback loops:
 * When we programmatically scroll (via scrollTo), we set `isScrollingProgrammatically`
 * which tells the scroll event listener to ignore that particular scroll event.
 * This prevents our own scrollTo() from triggering "user scrolled up" logic.
 *
 * Uses ResizeObserver to detect content growth during streaming — this fires
 * on every DOM size change (token appends), unlike React useEffect which only
 * re-runs when its dependency array changes.
 */
export function useAutoScroll(
  containerRef: React.RefObject<HTMLDivElement | null>,
  { isStreaming, threshold = 60 }: UseAutoScrollOptions
): UseAutoScrollReturn {
  const [autoScroll, setAutoScroll] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Lock to prevent programmatic scrolls from triggering user-scroll detection
  const isScrollingProgrammatically = useRef(false);
  // Refs to read latest values inside observers/callbacks without re-attaching
  const autoScrollRef = useRef(autoScroll);
  const isStreamingRef = useRef(isStreaming);
  const thresholdRef = useRef(threshold);

  // Keep refs in sync with state
  useEffect(() => { autoScrollRef.current = autoScroll; }, [autoScroll]);
  useEffect(() => { isStreamingRef.current = isStreaming; }, [isStreaming]);
  useEffect(() => { thresholdRef.current = threshold; }, [threshold]);

  /**
   * Check if the container is scrolled to the bottom (within threshold).
   */
  const isAtBottom = useCallback((): boolean => {
    const el = containerRef.current;
    if (!el) return true;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distanceFromBottom <= thresholdRef.current;
  }, [containerRef]);

  /**
   * Scroll the container to the bottom instantly.
   * Sets the programmatic scroll lock so the scroll listener
   * ignores this event and doesn't disable autoScroll.
   */
  const scrollToBottomInstant = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    isScrollingProgrammatically.current = true;
    el.scrollTop = el.scrollHeight;
    // Release the lock after the browser has processed the scroll event.
    requestAnimationFrame(() => {
      isScrollingProgrammatically.current = false;
    });
  }, [containerRef]);

  /**
   * Public API: smooth scroll to bottom.
   * Also sets the lock so the scroll listener doesn't misinterpret it.
   */
  const scrollToBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    isScrollingProgrammatically.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setTimeout(() => {
      isScrollingProgrammatically.current = false;
    }, 500);
  }, [containerRef]);

  /**
   * Scroll event listener: detect user scroll position.
   * Throttled via rAF to avoid running on every pixel.
   */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let rafId: number | null = null;

    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;

        // Ignore scroll events from our own programmatic scrolls
        if (isScrollingProgrammatically.current) return;

        const atBottom = isAtBottom();
        setShowScrollButton(!atBottom);

        // If user scrolled to bottom, re-enable auto-scroll
        // If user scrolled away from bottom, disable auto-scroll
        setAutoScroll(atBottom);
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      el.removeEventListener("scroll", onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [containerRef, isAtBottom]);

  /**
   * ResizeObserver: detect content growth and handle auto-scroll + button visibility.
   *
   * This is the primary mechanism for streaming auto-scroll. Unlike useEffect
   * with dependency arrays, ResizeObserver fires on every DOM size change,
   * which happens every time a new token is appended to the message.
   */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let resizeRaf: number | null = null;

    const onResize = () => {
      if (resizeRaf !== null) return;
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = null;

        const atBottom = isAtBottom();
        setShowScrollButton(!atBottom);

        // During streaming: if autoScroll is on, always scroll to bottom
        // when content grows (user hasn't scrolled up).
        // When not streaming: only scroll on new content if autoScroll is on.
        const streaming = isStreamingRef.current;
        const scrolling = autoScrollRef.current;

        if (scrolling) {
          if (streaming || atBottom) {
            scrollToBottomInstant();
          }
        }
      });
    };

    const observer = new ResizeObserver(onResize);
    observer.observe(el);

    return () => {
      observer.disconnect();
      if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
    };
  }, [containerRef, isAtBottom, scrollToBottomInstant]);

  /**
   * Reset autoScroll when isStreaming changes from false to true
   * (new streaming session started).
   */
  useEffect(() => {
    if (isStreaming) {
      setAutoScroll(true);
      setShowScrollButton(false);
      scrollToBottomInstant();
    }
  }, [isStreaming, scrollToBottomInstant]);

  return {
    autoScroll,
    showScrollButton,
    scrollToBottom,
    containerRef,
  };
}
