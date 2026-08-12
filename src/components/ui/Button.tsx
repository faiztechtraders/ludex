import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 font-display font-semibold tracking-[0.06em] ' +
  'rounded-chip transition-all duration-[--dur-fast] ease-[--ease-arrival] ' +
  'disabled:opacity-40 disabled:pointer-events-none select-none ' +
  // Lift on hover, settle on press. Never scale — scaling blurs the glow.
  'hover:-translate-y-px active:translate-y-0';

const VARIANTS: Record<Variant, string> = {
  primary: 'brand-gradient text-text-inverse hover:shadow-[--glow-magenta]',
  secondary:
    'border border-hairline text-text bg-surface/40 hover:border-neon-cyan hover:text-neon-cyan',
  ghost: 'text-text-secondary hover:text-text hover:bg-surface-2',
  danger: 'border border-neon-magenta/50 text-neon-magenta hover:bg-neon-magenta/10',
};

const SIZES: Record<Size, string> = {
  sm: 'px-3.5 py-1.5 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-7 py-3.5 text-base',
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  className?: string;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

/** Same visual treatment, but a real anchor so routing and middle-click work. */
export function ButtonLink({
  to,
  variant = 'primary',
  size = 'md',
  className = '',
  children,
}: CommonProps & { to: string }) {
  return (
    <Link to={to} className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}>
      {children}
    </Link>
  );
}
