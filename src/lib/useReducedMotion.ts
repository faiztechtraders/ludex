import { useEffect, useState } from 'react';

/**
 * Whether the user has asked the system to reduce motion.
 *
 * The global CSS backstop in index.css collapses transitions, but that is not
 * enough on its own: components that use motion to *convey information* have
 * to take a different path entirely. The Daily Spin, in particular, must cut
 * straight to its result rather than play a 1ms reel that shows nothing.
 *
 * Live-updating, because users toggle this in OS settings mid-session.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
