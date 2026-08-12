import { useEffect } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { useLudexStore } from '@/store/useLudexStore.ts';
import { Header } from './Header.tsx';

/**
 * App shell. Owns the three cross-cutting behaviours that would otherwise be
 * duplicated on every route: streak registration, scroll restoration, and the
 * skip link.
 */
export function Layout() {
  const { pathname } = useLocation();
  const registerVisit = useLudexStore((s) => s.registerVisit);

  // Streak is counted once per calendar day, on first load of any route.
  useEffect(() => {
    registerVisit();
  }, [registerVisit]);

  // React Router keeps scroll position across navigations by default, which
  // lands users mid-page on a route they have never seen.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-chip focus:bg-neon-magenta focus:px-4 focus:py-2 focus:font-display focus:text-sm focus:text-text-inverse"
      >
        Skip to content
      </a>

      <Header />

      <main id="main" className="mx-auto w-full max-w-[--width-content] flex-1 px-5 py-10 lg:px-8 lg:py-16">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-hairline">
      <div className="mx-auto flex max-w-[--width-content] flex-col gap-3 px-5 py-8 text-xs text-text-muted lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <p>
          <span className="brand-gradient-text font-display font-bold">LUDEX</span> — a curated,
          hand-tagged library. No accounts, no tracking; everything you do stays in this browser.
        </p>
        <nav className="flex gap-4" aria-label="Footer">
          <Link to="/browse" className="hover:text-text">
            Browse all
          </Link>
          <Link to="/collection" className="hover:text-text">
            Collection
          </Link>
          <Link to="/about" className="hover:text-text">
            How it works
          </Link>
        </nav>
      </div>
    </footer>
  );
}
