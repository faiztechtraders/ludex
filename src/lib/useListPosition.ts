import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Remember where a user was in a long list, so opening a game and pressing
 * Back returns them to the row they clicked rather than to the top.
 *
 * Two things have to be restored, and restoring only one is useless:
 *
 *  1. **How many rows were revealed.** "Show more" lived in `useState`, so it
 *     reset to the first page on unmount. Scrolling to row 40 does nothing if
 *     only 12 rows exist to scroll through.
 *  2. **The scroll offset**, and only *after* those rows are in the DOM.
 *
 * `sessionStorage`, deliberately, not `localStorage`: a scroll offset is worth
 * keeping for the length of a tab session and nothing longer. Returning to a
 * week-old position would be a bug, not a feature.
 */

const PREFIX = 'ludex:pos:';

interface ListPosition {
  limit: number;
  scrollY: number;
}

function read(key: string): ListPosition | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as ListPosition) : null;
  } catch {
    // Private browsing and disabled storage both throw. Losing a scroll
    // position is a non-event; a white screen is not.
    return null;
  }
}

function write(key: string, value: ListPosition): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* nothing useful to do */
  }
}

export function useListPosition(key: string, firstPage: number) {
  // Lazy initialiser, so the restored rows are present in the very first
  // paint. Setting this in an effect would render the short list first and
  // leave nothing to scroll to.
  const [limit, setLimit] = useState(() => read(key)?.limit ?? firstPage);

  const pending = useRef(read(key)?.scrollY ?? 0);
  const started = useRef(false);
  /**
   * True while we are driving the scroll ourselves. `scrollTo` fires scroll
   * events like any other scroll, so without this the listener below writes
   * each intermediate offset back to storage and overwrites the very target we
   * are trying to reach.
   */
  const restoring = useRef(false);

  /**
   * Take scroll restoration away from the browser.
   *
   * Chrome defaults to `scrollRestoration: 'auto'` and restores the offset
   * itself on a back navigation — asynchronously, and *after* our own restore
   * has run. It restores against the page as it was at first paint, which is
   * shorter than the fully-rendered list, so it would reliably drag the user
   * back to a position part-way up. Two systems doing the same job is worse
   * than either alone; ours knows about the revealed rows, so it wins.
   */
  useEffect(() => {
    if (typeof window === 'undefined' || !('scrollRestoration' in window.history)) return;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  useLayoutEffect(() => {
    if (started.current) return;
    started.current = true;
    const y = pending.current;
    if (y <= 0) return;

    // The rows are in the DOM immediately, but the document can still be
    // shorter than the saved offset while fonts settle and images resolve, so
    // an early scrollTo silently clamps to the current bottom. Keep trying on a
    // time budget rather than a frame count — a fixed number of frames gave up
    // at ~200ms and landed the user two thirds of the way up the list.
    restoring.current = true;
    const deadline = performance.now() + 2000;

    const settle = () => {
      window.scrollTo(0, y);
      const close = Math.abs(window.scrollY - y) <= 2;
      if (close || performance.now() > deadline) {
        // One frame of grace so the final scrollTo's own event fires while the
        // listener is still suppressed.
        requestAnimationFrame(() => {
          restoring.current = false;
        });
        return;
      }
      requestAnimationFrame(settle);
    };
    requestAnimationFrame(settle);
  }, []);

  // Track the offset continuously rather than on unmount: a route change can
  // reset scroll before an unmount handler ever runs.
  useEffect(() => {
    const onScroll = () => {
      if (restoring.current) return;
      write(key, { limit, scrollY: window.scrollY });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [key, limit]);

  const showMore = useCallback(
    (step: number) =>
      setLimit((current) => {
        const next = current + step;
        write(key, { limit: next, scrollY: window.scrollY });
        return next;
      }),
    [key],
  );

  /** Collapse back to page one — for when filters change and the list is new. */
  const reset = useCallback(() => {
    setLimit(firstPage);
    write(key, { limit: firstPage, scrollY: 0 });
  }, [key, firstPage]);

  return { limit, showMore, reset };
}
