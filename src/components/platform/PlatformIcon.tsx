import type { Platform, PlatformFamily } from '@/data/schema.ts';
import { PLATFORM_FAMILY } from '@/data/schema.ts';

/**
 * Platform glyphs, drawn per *family* rather than per console.
 *
 * A PS4 and a PS5 look identical at 14px, so separate glyphs would be noise;
 * the generation is carried by the label next to the icon instead. This also
 * keeps seven platforms from becoming seven near-identical silhouettes.
 *
 * Deliberately generic hardware silhouettes rather than manufacturer logos —
 * Ludex is unaffiliated with Microsoft, Sony and Nintendo, and baking their
 * trademarks into the chrome would be wrong. Each is recognizable by shape.
 *
 * Mirrors creative/icons/platforms.svg; inlined so the chrome needs no fetch.
 */

const FAMILY_PATHS: Record<PlatformFamily, React.ReactNode> = {
  // Windows — tilted four-pane window
  pc: (
    <path
      fill="currentColor"
      d="M3 5.4 10.6 4.3v7.2H3zM11.6 4.15 21 2.8v8.7h-9.4zM3 12.5h7.6v7.2L3 18.6zM11.6 12.5H21v8.7l-9.4-1.35z"
    />
  ),

  // PlayStation — DualShock/DualSense-style pad, d-pad left, four buttons right
  playstation: (
    <>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        d="M8.4 7h7.2c1.5 0 2.5.9 2.9 2.3l1.6 6c.4 1.6-.5 2.9-1.9 2.9-.9 0-1.5-.4-2.1-1.1L14.6 15H9.4l-1.5 2.1c-.6.7-1.2 1.1-2.1 1.1-1.4 0-2.3-1.3-1.9-2.9l1.6-6C5.9 7.9 6.9 7 8.4 7Z"
      />
      <path fill="currentColor" d="M7.2 10.4h1.1v1.2h1.2v1.1H8.3v1.2H7.2v-1.2H6v-1.1h1.2z" />
      <circle fill="currentColor" cx="16.3" cy="11" r=".95" />
      <circle fill="currentColor" cx="16.3" cy="13.9" r=".95" />
      <circle fill="currentColor" cx="14.85" cy="12.45" r=".95" />
      <circle fill="currentColor" cx="17.75" cy="12.45" r=".95" />
    </>
  ),

  // Xbox — broader pad with offset sticks, the shape that reads as "Xbox"
  xbox: (
    <>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        d="M8.6 6.6h6.8c1.9 0 3.2 1.2 3.7 3l1.3 5.1c.5 2-.6 3.6-2.3 3.6-1.1 0-1.9-.5-2.7-1.4l-1-1.2H9.6l-1 1.2c-.8.9-1.6 1.4-2.7 1.4-1.7 0-2.8-1.6-2.3-3.6l1.3-5.1c.5-1.8 1.8-3 3.7-3Z"
      />
      <circle fill="none" stroke="currentColor" strokeWidth="1.5" cx="8.2" cy="11.4" r="1.5" />
      <circle fill="none" stroke="currentColor" strokeWidth="1.5" cx="13.3" cy="13.8" r="1.35" />
      <circle fill="currentColor" cx="16.4" cy="10.9" r=".9" />
      <circle fill="currentColor" cx="14.4" cy="10.2" r=".8" />
    </>
  ),

  // Nintendo Switch — screen flanked by two detachable controllers
  nintendo: (
    <>
      <rect
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        x="8.6"
        y="3.2"
        width="6.8"
        height="17.6"
        rx="0.9"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        d="M8.6 3.2H6.2A3 3 0 0 0 3.2 6.2v11.6a3 3 0 0 0 3 3h2.4M15.4 3.2h2.4a3 3 0 0 1 3 3v11.6a3 3 0 0 1-3 3h-2.4"
      />
      <circle fill="currentColor" cx="6" cy="8.4" r="1.15" />
      <circle fill="currentColor" cx="18" cy="15.6" r="1.15" />
    </>
  ),
};

export function PlatformIcon({
  platform,
  className = 'h-5 w-5',
}: {
  platform: Platform;
  className?: string;
}) {
  return <FamilyIcon family={PLATFORM_FAMILY[platform]} className={className} />;
}

export function FamilyIcon({
  family,
  className = 'h-5 w-5',
}: {
  family: PlatformFamily;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      {FAMILY_PATHS[family]}
    </svg>
  );
}
