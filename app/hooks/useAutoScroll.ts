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
 */
export function useAutoScroll(
  containerRef: React.RefObject<HTMLDivElement | null>,
  { isStreaming, threshold = 60 }: UseAutoScrollOptions
): UseAutoScrollReturn {
  const [autoScroll, setAutoScroll] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Lock to prevent programmatic scrolls from triggering user-scroll detection
  const isScrollingProgrammatically = useRef(false);
  // Latest content hash to detect new content for batched scroll
  const lastContentHeight = useRef(0);
  // rAF ID for batching scroll-to-bottom calls
  const scrollRafId = useRef<number | null>(null);

  /**
   * Check if the container is scrolled to the bottom (within threshold).
   */
  const isAtBottom = useCallback((): boolean => {
    const el = containerRef.current;
    if (!el) return true;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distanceFromBottom <= threshold;
  }, [containerRef, threshold]);

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
    // Using rAF ensures we miss no scroll events from this call.
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
    // Release lock after smooth scroll completes (give it time)
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
      if (rafId !== null) return; // Already scheduled
      rafId = requestAnimationFrame(() => {
        rafId = null;

        // Ignore scroll events from our own programmatic scrolls
        if (isScrollingProgrammatically.current) return;

        const atBottom = isAtBottom();
        setShowScrollButton(!atBottom);

        // If user scrolled to bottom, re-enable auto-scroll
        if (atBottom) {
          setAutoScroll(true);
        } else {
          // If user scrolled away from bottom, disable auto-scroll
          setAutoScroll(false);
        }
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      el.removeEventListener("scroll", onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [containerRef, isAtBottom]);

  /**
   * Auto-scroll when new content is appended during streaming.
   * Uses rAF to batch rapid consecutive token appends.
   */
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !isStreaming || !autoScroll) return;

    const currentHeight = el.scrollHeight;

    // Only scroll if content actually changed
    if (currentHeight === lastContentHeight.current) return;
    lastContentHeight.current = currentHeight;

    // Cancel any pending scroll
    if (scrollRafId.current !== null) {
      cancelAnimationFrame(scrollRafId.current);
    }

    // Schedule a new scroll-to-bottom
    scrollRafId.current = requestAnimationFrame(() => {
      scrollRafId.current = null;
      if (isAtBottom() || autoScroll) {
        scrollToBottomInstant();
      }
    });

    return () => {
      if (scrollRafId.current !== null) {
        cancelAnimationFrame(scrollRafId.current);
      }
    };
  }, [containerRef, isStreaming, autoScroll, isAtBottom, scrollToBottomInstant]);

  /**
   * Handle content changes when NOT streaming (e.g., new message sent).
   * This ensures we scroll to bottom on new user messages.
   */
  useEffect(() => {
    const el = containerRef.current;
    if (!el || isStreaming) return;

    const currentHeight = el.scrollHeight;

    if (currentHeight !== lastContentHeight.current) {
      lastContentHeight.current = currentHeight;
      // New content while not streaming — scroll to bottom
      if (autoScroll) {
        scrollToBottomInstant();
        setShowScrollButton(false);
      }
    }
  }, [containerRef, isStreaming, autoScroll, scrollToBottomInstant]);

  /**
   * Handle container resize: re-evaluate scroll button visibility
   * without toggling autoScroll state.
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
        // Don't change autoScroll on resize — only update button visibility
      });
    };

    const observer = new ResizeObserver(onResize);
    observer.observe(el);

    return () => {
      observer.disconnect();
      if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
    };
  }, [containerRef, isAtBottom]);

  /**
   * Reset autoScroll when isStreaming changes from false to true
   * (new streaming session started).
   */
  useEffect(() => {
    if (isStreaming) {
      setAutoScroll(true);
      setShowScrollButton(false);
      scrollToBottomInstant();
      lastContentHeight.current = containerRef.current?.scrollHeight ?? 0;
    }
  }, [isStreaming, scrollToBottomInstant, containerRef]);

  return {
    autoScroll,
    showScrollButton,
    scrollToBottom,
    containerRef,
  };
}
