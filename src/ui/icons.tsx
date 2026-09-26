/**
 * Icons from design/dtms/html — custom approximations of the SF Symbols named in DESIGN.md.
 * Generic utility icons not covered by the handoff (copy, external link, …) come from lucide-react.
 * Icons draw in `currentColor`; set the color with a text-* token on the icon or its parent.
 */
type P = { size?: number; color?: string; className?: string };

export const EyeFill = ({ size = 22, color = 'currentColor' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 5C5.5 5 2 12 2 12s3.5 7 10 7 10-7 10-7-3.5-7-10-7zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

export const EyeSlashFill = ({ size = 22, color = 'currentColor' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 5C5.5 5 2 12 2 12s3.5 7 10 7 10-7 10-7-3.5-7-10-7zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z" />
    <path d="M3.5 3.5 20.5 20.5" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

export const Triangle = ({ size = 12, color = 'currentColor', down = false }: P & { down?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={down ? { transform: 'rotate(180deg)' } : undefined}>
    <path d="M12 4 22 20H2z" />
  </svg>
);

export const ArrowUpCircleFill = ({ size = 22, color = 'currentColor' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 4.6-5 5 1.4 1.4 2.6-2.6V17h2v-6.6l2.6 2.6 1.4-1.4z" />
  </svg>
);

export const ArrowDownCircleFill = ({ size = 22, color = 'currentColor' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20zm0-4.6 5-5-1.4-1.4-2.6 2.6V7h-2v6.6L8.4 11 7 12.4z" />
  </svg>
);

export const SwapCircleFill = ({ size = 22, color = 'currentColor' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm2.5 4.5-1.4 1.4 1.1 1.1H7v2h7.2l-1.1 1.1 1.4 1.4L18 10zM9.5 11.5 6 15l3.5 3.5 1.4-1.4-1.1-1.1H17v-2H9.8l1.1-1.1z" />
  </svg>
);

export const PlusCircleFill = ({ size = 22, color = 'currentColor' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1 5v4H7v2h4v4h2v-4h4v-2h-4V7z" />
  </svg>
);

export const Chevron = () => (
  <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-chevron">
    <path d="m1 1 6 6-6 6" />
  </svg>
);

export const ChevronLeft = ({ size = 18, color = 'currentColor' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 5 8 12l7 7" />
  </svg>
);

export const WalletFill = ({ size = 24, color = 'currentColor' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M5 5h13a2 2 0 0 1 2 2v1h-5a4 4 0 0 0 0 8h5v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm10 5h6v4h-6a2 2 0 0 1 0-4z" />
  </svg>
);

export const GridFill = ({ size = 24, color = 'currentColor' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <rect x="3" y="3" width="8" height="8" rx="2.2" />
    <rect x="13" y="3" width="8" height="8" rx="2.2" />
    <rect x="3" y="13" width="8" height="8" rx="2.2" />
    <rect x="13" y="13" width="8" height="8" rx="2.2" />
  </svg>
);

export const ClockFill = ({ size = 24, color = 'currentColor' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm1 4.5h-2V13l4.6 2.7 1-1.7-3.6-2.1z" />
  </svg>
);

export const MagnifyingGlass = ({ size = 24, color = 'currentColor' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round">
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m20 20-4.8-4.8" />
  </svg>
);

export const XMark = ({ size = 16, color = 'currentColor' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round">
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const ArrowUp = ({ size = 18, color = 'currentColor' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20V4M5 11l7-7 7 7" />
  </svg>
);

export const SwapUnits = ({ size = 14, color = 'currentColor' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4" />
  </svg>
);

export const DeleteLeftFill = ({ size = 28, color = 'currentColor' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M9 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H9a2 2 0 0 1-1.5-.7L2 12l5.5-7.3A2 2 0 0 1 9 4zm2.8 4.4-1.4 1.4L12.6 12l-2.2 2.2 1.4 1.4L14 13.4l2.2 2.2 1.4-1.4-2.2-2.2 2.2-2.2-1.4-1.4L14 10.6z" />
  </svg>
);

export const LockFill = ({ size = 18, color = 'currentColor' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M7 10V7a5 5 0 0 1 10 0v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zm2 0h6V7a3 3 0 0 0-6 0z" />
  </svg>
);

export const Checkmark = ({ size = 50, color = 'currentColor', strokeWidth = 3 }: P & { strokeWidth?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

export const ShieldCheckFill = ({ size = 36, color = 'currentColor' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} className="shrink-0">
    <path d="M12 2 4 5.5v6c0 5 3.4 9.4 8 10.5 4.6-1.1 8-5.5 8-10.5v-6zm-1.2 13.6-3.5-3.5 1.4-1.4 2.1 2.1 4.6-4.6 1.4 1.4z" />
  </svg>
);

export const BoltFill = ({ size = 36, color = 'currentColor' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} className="shrink-0">
    <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
  </svg>
);

export const ChartBarFill = ({ size = 36, color = 'currentColor' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} className="shrink-0">
    <path d="M3 20h18v2H3zM5 11h3v7H5zm5.5-5h3v12h-3zM16 8h3v10h-3z" />
  </svg>
);

export const PeopleOutline = ({ size = 28, color = 'currentColor' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6">
    <circle cx="9" cy="8" r="3.2" />
    <circle cx="17" cy="9" r="2.4" />
    <path d="M3.5 19c.8-3.3 3-5 5.5-5s4.7 1.7 5.5 5M15 14.2c2.4-.3 4.6 1.1 5.4 4.3" strokeLinecap="round" />
  </svg>
);

/** DTMS app-icon glyph (hexagon). */
export const HexGlyph = ({ size = 44, color = 'currentColor' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ position: 'relative' }}>
    <path d="M12 2.5 4 7v10l8 4.5 8-4.5V7zm0 3.3 5 2.8v6.8l-5 2.8-5-2.8V8.6z" />
  </svg>
);

/** sidebar.right — "open in side panel". */
export const SidebarRight = ({ size = 22, color = 'currentColor' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="2.5" y="4" width="19" height="16" rx="3.2" stroke={color} strokeWidth="2" />
    <path d="M14.5 5h3.8A2.2 2.2 0 0 1 20.5 7.2v9.6a2.2 2.2 0 0 1-2.2 2.2h-3.8z" fill={color} />
  </svg>
);

/** rectangle.inset.topright.filled — "switch to popup". */
export const PopupWindow = ({ size = 22, color = 'currentColor' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="2.5" y="4" width="19" height="16" rx="3.2" stroke={color} strokeWidth="2" />
    <rect x="12" y="7" width="6.5" height="8" rx="1.6" fill={color} />
  </svg>
);
