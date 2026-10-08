import type { SVGProps } from "react";

/**
 * British Quilting icon set.
 *
 * Drawn on a 24px grid with a fine 1.4 stroke. The house signature is the
 * running stitch: a dashed line (dash 1.6, gap 1.6) used as a secondary
 * detail wherever an icon has an edge that could be sewn. Keep new icons to
 * the same grid, stroke and stitch rhythm.
 */

type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { strokeWidth?: number; title?: string };

const STITCH = "1.6 1.6";

function Svg({ children, strokeWidth = 1.4, title, className, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      className={className ?? "size-5"}
      {...rest}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

const Stitch = (p: SVGProps<SVGPathElement>) => <path strokeDasharray={STITCH} strokeWidth={1.1} {...p} />;

/* ─────────────────────────── directional */

export const IconArrowRight = (p: IconProps) => (
  <Svg {...p}><path d="M3.5 12h16" /><path d="M14.5 6.5 20 12l-5.5 5.5" /></Svg>
);
export const IconArrowLeft = (p: IconProps) => (
  <Svg {...p}><path d="M20.5 12h-16" /><path d="M9.5 6.5 4 12l5.5 5.5" /></Svg>
);
export const IconArrowUpRight = (p: IconProps) => (
  <Svg {...p}><path d="M6 18 18 6" /><path d="M9 6h9v9" /></Svg>
);
export const IconChevronDown = (p: IconProps) => (
  <Svg {...p}><path d="m6 9.5 6 6 6-6" /></Svg>
);
export const IconChevronRight = (p: IconProps) => (
  <Svg {...p}><path d="m9.5 6 6 6-6 6" /></Svg>
);
export const IconChevronLeft = (p: IconProps) => (
  <Svg {...p}><path d="m14.5 6-6 6 6 6" /></Svg>
);
export const IconExternal = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13 4h7v7" /><path d="M20 4 11 13" />
    <path d="M17.5 14v5.5h-13v-13H10" />
  </Svg>
);

/* ─────────────────────────── controls */

/** A tick finished like a tailor's tack: short lead-in, long confident stroke */
export const IconCheck = (p: IconProps) => (
  <Svg {...p}><path d="M4.5 12.5 9.5 17.5 19.5 6" /></Svg>
);
export const IconClose = (p: IconProps) => (
  <Svg {...p}><path d="M6 6 18 18" /><path d="M18 6 6 18" /></Svg>
);
export const IconPlus = (p: IconProps) => (
  <Svg {...p}><path d="M12 5v14" /><path d="M5 12h14" /></Svg>
);
export const IconMinus = (p: IconProps) => (
  <Svg {...p}><path d="M5 12h14" /></Svg>
);
/** Three rules of unequal length, like a hem, a seam and a stitch line */
export const IconMenu = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 7h17" />
    <path d="M3.5 12h11" />
    <Stitch d="M3.5 17h17" />
  </Svg>
);
export const IconSearch = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="m15 15 5.5 5.5" />
    <Stitch d="M7.5 9.5a3.4 3.4 0 0 1 2-2" />
  </Svg>
);
export const IconFilter = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h9" /><path d="M17 7h3" /><circle cx="15" cy="7" r="2" />
    <path d="M4 17h3" /><path d="M11 17h9" /><circle cx="9" cy="17" r="2" />
  </Svg>
);
export const IconGrip = (p: IconProps) => (
  <Svg {...p} strokeWidth={2.2}>
    <path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" />
  </Svg>
);
export const IconSpinner = ({ className, ...p }: IconProps) => (
  <Svg {...p} className={`${className ?? "size-5"} animate-spin`}>
    <circle cx="12" cy="12" r="8" strokeOpacity={0.2} />
    <path d="M20 12a8 8 0 0 0-8-8" />
  </Svg>
);

/* ─────────────────────────── commerce */

/** A haberdasher's carrier bag: pinked top edge, twisted handle */
export const IconBasket = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 8.5h14l-1.1 11.2a1 1 0 0 1-1 .9H7.1a1 1 0 0 1-1-.9L5 8.5Z" />
    <path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" />
    <Stitch d="M6.3 12h11.4" />
  </Svg>
);
export const IconUser = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20c.8-3.6 3.8-5.8 7.5-5.8s6.7 2.2 7.5 5.8" />
  </Svg>
);
export const IconUsers = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8.5" r="3.2" />
    <path d="M2.8 19.5c.7-3.2 3.2-5.1 6.2-5.1s5.5 1.9 6.2 5.1" />
    <path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8" />
    <path d="M17.8 14.6c1.8.7 3 2.4 3.4 4.9" />
  </Svg>
);
export const IconHeart = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 19.5s-7.5-4.4-7.5-10A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 2.5c0 5.6-7.5 10-7.5 10Z" />
  </Svg>
);
/** Star with slightly concave arms, closer to an engraved mark than a UI star */
export const IconStar = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5 14.3 9l5.9.5-4.5 3.9 1.4 5.8L12 16.1l-5.1 3.1 1.4-5.8-4.5-3.9L9.7 9 12 3.5Z" />
  </Svg>
);
/** A swing tag with a stitched border */
export const IconTag = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1 1 0 0 1 0 1.4l-7.3 7.3a1 1 0 0 1-1.4 0l-8.3-8.3Z" />
    <circle cx="8" cy="8" r="1.4" />
    <Stitch d="M11 6.2 17.8 13" />
  </Svg>
);
/** A sale roundel with a percent mark, ringed in stitching, for special offers */
export const IconOffer = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8" />
    <Stitch d="M12 1.5a10.5 10.5 0 1 1 0 21a10.5 10.5 0 1 1 0-21" />
    <path d="m9.2 14.8 5.6-5.6" />
    <circle cx="9.6" cy="9.6" r="1.1" />
    <circle cx="14.4" cy="14.4" r="1.1" />
  </Svg>
);
export const IconCard = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
    <path d="M3 9.5h18" />
    <Stitch d="M6 15h5" />
  </Svg>
);
/** A brown-paper parcel tied with string */
export const IconParcel = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="6.5" width="17" height="13" rx="1" />
    <path d="M12 6.5v13" />
    <path d="M3.5 12h17" />
    <path d="M12 6.5c-1.5-2.8-4.5-3.2-4.5-1.3 0 1.2 2 1.3 4.5 1.3Zm0 0c1.5-2.8 4.5-3.2 4.5-1.3 0 1.2-2 1.3-4.5 1.3Z" />
  </Svg>
);
/** A London delivery van, side-on */
export const IconVan = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 6.5h11v10h-11z" />
    <path d="M13.5 9.5h4l3 3.4v3.6h-7" />
    <circle cx="6.5" cy="17.5" r="1.8" />
    <circle cx="17" cy="17.5" r="1.8" />
    <Stitch d="M4.5 9.5h6.5" />
  </Svg>
);

/* ─────────────────────────── the workroom */

/** Dressmaker's shears, bent handle */
export const IconScissors = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="6" cy="17.5" r="2.6" />
    <circle cx="6" cy="6.5" r="2.6" />
    <path d="M8.2 15.9 20.5 5" />
    <path d="M8.2 8.1 20.5 19" />
    <Stitch d="M13 12h8" />
  </Svg>
);
/** A tape measure, unrolling */
export const IconTape = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="8.5" cy="11" r="5.5" />
    <circle cx="8.5" cy="11" r="1.5" />
    <path d="M8.5 16.5h12v3h-12" />
    <path d="M12 16.5v1.4M15 16.5v1.4M18 16.5v1.4" strokeWidth={1.1} />
  </Svg>
);
/** Cotton reel */
export const IconSpool = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 4h12" /><path d="M6 20h12" />
    <path d="M7.5 4v16M16.5 4v16" />
    <path d="M7.5 8l9 2M7.5 11l9 2M7.5 14l9 2" strokeWidth={1.1} />
  </Svg>
);
export const IconNeedle = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20 18.2 5.8a1.7 1.7 0 0 1 2.4 2.4L6.4 22" transform="translate(0 -2)" />
    <path d="m16.8 5.2 2 2" transform="translate(0 -2)" />
    <Stitch d="M3 15c2.5-1 3.5 2 6 1s2-4 5-4" />
  </Svg>
);
/** A bolt of cloth, end-on, with its tail unrolled */
export const IconBolt = (p: IconProps) => (
  <Svg {...p}>
    <ellipse cx="7" cy="8.5" rx="3.5" ry="4.5" />
    <ellipse cx="7" cy="8.5" rx="1.2" ry="1.6" />
    <path d="M7 4h11c2 0 2.5 9 0 9H7" />
    <path d="M18 13v6.5l-2-1.2-2 1.2V13" />
  </Svg>
);
/** A pinked-edge fabric swatch */
export const IconSwatch = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 4.5 6.3 3.5l1.3 1 1.3-1 1.3 1 1.3-1 1.3 1 1.3-1 1.3 1 1.3-1L19 4.5v15l-1.3 1-1.3-1-1.3 1-1.3-1-1.3 1-1.3-1-1.3 1-1.3-1-1.3 1L5 19.5Z" />
    <Stitch d="M8 8h8" />
    <Stitch d="M8 16h8" />
  </Svg>
);
/** The crown from the BQ mark */
export const IconCrown = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 8.5 7.5 13 12 5.5l4.5 7.5L21 8.5l-2 10H5Z" />
    <Stitch d="M6 16h12" />
  </Svg>
);

/* ─────────────────────────── contact & place */

export const IconMail = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="5.5" width="18" height="13" rx="1" />
    <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
  </Svg>
);
export const IconPhone = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6.5 3.5h3l1.5 4-2 1.3a10 10 0 0 0 6.2 6.2l1.3-2 4 1.5v3a2 2 0 0 1-2 2C11 19.5 4.5 13 4.5 5.5a2 2 0 0 1 2-2Z" />
  </Svg>
);
/** A map pin with a pin-head, like a dressmaker's pin */
export const IconPin = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10" r="2.2" />
  </Svg>
);
export const IconHome = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 10.5 12 4l8 6.5V20H4Z" />
    <path d="M9.5 20v-5.5h5V20" />
  </Svg>
);
export const IconCalendar = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15" rx="1" />
    <path d="M3.5 9.5h17" /><path d="M8 3v4M16 3v4" />
    <Stitch d="M7 13.5h10" /><Stitch d="M7 16.5h6" />
  </Svg>
);
export const IconClock = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7v5l3.5 2" />
  </Svg>
);

/* ─────────────────────────── editing & admin */

export const IconPencil = (p: IconProps) => (
  <Svg {...p}>
    <path d="M15.5 4.5 19.5 8.5 8.5 19.5H4.5v-4Z" />
    <path d="m13 7 4 4" />
  </Svg>
);
export const IconTrash = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6.5h16" />
    <path d="M9.5 6.5V4.5h5v2" />
    <path d="M6 6.5 7 20h10l1-13.5" />
    <Stitch d="M10 10v6.5M14 10v6.5" />
  </Svg>
);
export const IconCopy = (p: IconProps) => (
  <Svg {...p}>
    <rect x="8.5" y="8.5" width="11.5" height="11.5" rx="1" />
    <path d="M15.5 8.5V4H4v11.5h4.5" />
  </Svg>
);
export const IconPrint = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 8.5V3.5h10v5" />
    <path d="M7 16.5H4.5v-8h15v8H17" />
    <path d="M7 13.5h10v7H7z" />
    <Stitch d="M9.5 16.5h5" />
  </Svg>
);
export const IconUpload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 15.5V4" /><path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
    <path d="M4 14.5v5.5h16v-5.5" />
  </Svg>
);
export const IconImage = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="1" />
    <path d="m3.5 16 5-5 4 4 2.5-2.5 5.5 5.5" />
    <circle cx="15.5" cy="9" r="1.5" />
  </Svg>
);
export const IconDocument = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 3.5h8l4.5 4.5v12.5H6Z" />
    <path d="M14 3.5V8h4.5" />
    <Stitch d="M9 12.5h6.5M9 15.5h6.5M9 18.5h4" />
  </Svg>
);
export const IconChart = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 4v16h16" />
    <path d="m7 15 3.5-4 3 2.5L19 7" />
  </Svg>
);
/** Settings as a tailor's button with four holes, not a cog */
export const IconSettings = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="6" strokeDasharray={STITCH} strokeWidth={1.1} />
    <circle cx="10.3" cy="10.3" r=".9" /><circle cx="13.7" cy="10.3" r=".9" />
    <circle cx="10.3" cy="13.7" r=".9" /><circle cx="13.7" cy="13.7" r=".9" />
  </Svg>
);
export const IconLogout = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4.5H5v15h9" />
    <path d="M10 12h10.5" /><path d="m17 8.5 3.5 3.5-3.5 3.5" />
  </Svg>
);
export const IconLock = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="1" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    <path d="M12 14.5v2.5" />
  </Svg>
);
export const IconEye = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);
export const IconEyeOff = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 4 20 20" />
    <path d="M9.9 6A10 10 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M14.1 17.9a10 10 0 0 1-2.1.6C6 18.5 2.5 12 2.5 12A17 17 0 0 1 6.3 7.5" />
    <path d="M9.9 10a3 3 0 0 0 4.1 4.1" />
  </Svg>
);
export const IconInfo = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.5" /><path d="M12 7.6v.01" strokeWidth={2} />
  </Svg>
);
export const IconWarning = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4 21 19.5H3Z" />
    <path d="M12 10v4.5" /><path d="M12 17v.01" strokeWidth={2} />
  </Svg>
);

/* ─────────────────────────── third-party marks (filled, brand-accurate) */

export const IconGoogle = ({ className, ...p }: IconProps) => (
  <svg viewBox="0 0 24 24" aria-hidden className={className ?? "size-5"} {...p}>
    <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3Z" />
    <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z" />
    <path fill="#FBBC05" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14Z" />
    <path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.7 9.4 5.9 12 5.9Z" />
  </svg>
);
export const IconApple = ({ className, ...p }: IconProps) => (
  <svg viewBox="0 0 24 24" aria-hidden className={className ?? "size-5"} fill="currentColor" {...p}>
    <path d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7a4.5 4.5 0 0 0-3.5-1.9c-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8a4.7 4.7 0 0 0-4 2.4c-1.7 3-.4 7.3 1.2 9.7.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.2-1.2 3-2.4a10 10 0 0 0 1.4-2.8 4.3 4.3 0 0 1-2.6-3.8ZM14 5.4a4.3 4.3 0 0 0 1-3.1 4.4 4.4 0 0 0-2.9 1.5 4.1 4.1 0 0 0-1 3 3.7 3.7 0 0 0 2.9-1.4Z" />
  </svg>
);

/* ─────────────────────────── social platforms (stroke, inherits text colour) */

export const IconInstagram = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="16" height="16" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <path d="M16.5 7.5v.01" strokeWidth={2.2} />
  </Svg>
);
export const IconFacebook = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M13.6 20v-6.6h2.1l.4-2.6h-2.5V9.1c0-.8.2-1.3 1.4-1.3h1.2V5.5c-.3 0-1.1-.1-2-.1-2 0-3.3 1.2-3.3 3.4v2h-2.1v2.6h2.1V20" />
  </Svg>
);
export const IconPinterest = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.6 19c.5-1.6 1.5-5.6 1.5-5.6m0 0c-.4-.8-.6-2.5.2-3.5.9-1.2 2.6-.8 2.9.5.3 1.2-.6 2.9-1 4-.3 1 .4 1.9 1.4 1.9 1.7 0 2.9-2.2 2.9-4.3 0-2.2-1.7-3.9-4.2-3.9-2.9 0-4.6 2.1-4.6 4.4 0 .8.3 1.4.6 1.8" />
  </Svg>
);
