// ─── Orbital Studios brand mark — OFFICIAL GEOMETRY ─────────────────────────
// Emblem paths extracted verbatim from the marketing vector
// (public/brand/orbital-full-gradient.svg): two broken arcs + the satellite
// dot. Rendered inline so it can take the brand gradient, currentColor, spin
// for loading states, and scale crisply anywhere.
//
// Full lockups (emblem + official letterforms) live as static assets:
//   /brand/orbital-full-gradient.svg   — stacked, blue gradient (login hero)
//   /brand/orbital-horizontal.svg      — horizontal, black (print/light uses)

import clsx from 'clsx'

// Official brand gradient stops (from the marketing file)
export const BRAND_GRADIENT = { from: '#55c9ef', to: '#2a7bbb' }

let gradientSeq = 0

/**
 * The Orbital emblem.
 * @param size     px height of the mark
 * @param spin     slow continuous rotation — loading / ambient brand moments
 * @param gradient true → official blue gradient fill; false → currentColor
 */
export function OrbitalMark({ size = 32, spin = false, gradient = true, className = '', style }) {
  // Unique gradient id per instance so multiple marks don't collide
  const gid = (gradientSeq = (gradientSeq + 1) % 1e6, `orbital-grad-${gradientSeq}`)
  const fill = gradient ? `url(#${gid})` : 'currentColor'

  return (
    <svg
      viewBox="322 14 348 298"
      width={size * (348 / 298)}
      height={size}
      fill="none"
      aria-hidden="true"
      className={clsx(spin && 'animate-orbital-spin', className)}
      style={{ display: 'block', ...style }}
    >
      {gradient && (
        <defs>
          <linearGradient id={gid} x1="0" y1="14" x2="0" y2="312" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={BRAND_GRADIENT.from} />
            <stop offset="1" stopColor={BRAND_GRADIENT.to} />
          </linearGradient>
        </defs>
      )}
      <g fill={fill}>
        {/* Right arc */}
        <path d="M635.6,162.72c0,18.66-3.56,36.28-10.68,52.83-7.12,16.57-16.8,30.97-29.05,43.22-12.25,12.25-26.59,21.93-43.04,29.05-10.13,4.38-20.69,7.41-31.66,9.1v-43.11c5.21-1.2,10.28-2.87,15.21-5.01,11.32-4.89,21.17-11.54,29.57-19.94,8.4-8.39,15.04-18.25,19.94-29.57,4.9-11.32,7.35-23.5,7.35-36.57s-2.45-24.91-7.35-36.22c-4.9-11.3-11.54-21.17-19.94-29.57-8.4-8.39-18.26-15.05-29.57-19.94-4.93-2.14-10-3.81-15.21-5.01V28.87c10.97,1.68,21.53,4.71,31.66,9.09,16.44,7.12,30.79,16.8,43.04,29.05,12.25,12.25,21.93,26.6,29.05,43.04,7.11,16.44,10.68,34.01,10.68,52.67Z" />
        {/* Left arc */}
        <path d="M478.82,253.79c-5.24-1.2-10.31-2.87-15.22-5-11.32-4.89-21.17-11.54-29.57-19.94-8.39-8.39-15.04-18.25-19.94-29.57-4.9-11.32-7.35-23.5-7.35-36.57s2.45-24.91,7.35-36.22c4.9-11.3,11.55-21.17,19.94-29.57,8.4-8.39,18.26-15.05,29.57-19.94,4.91-2.13,9.98-3.79,15.22-5V28.92c-10.89,1.69-21.39,4.7-31.49,9.04-16.57,7.12-30.97,16.8-43.22,29.05-12.25,12.25-21.93,26.6-29.05,43.04-7.11,16.44-10.67,34.01-10.67,52.67s3.55,36.28,10.67,52.83c7.12,16.57,16.8,30.97,29.05,43.22,12.25,12.25,26.65,21.93,43.22,29.05,10.1,4.34,20.6,7.35,31.49,9.05v-43.08Z" />
        {/* Satellite dot */}
        <path d="M639.56,32.89c-8.6,0-15.56,6.97-15.56,15.56s6.97,15.56,15.56,15.56,15.56-6.97,15.56-15.56-6.97-15.56-15.56-15.56Z" />
      </g>
    </svg>
  )
}

/**
 * Mark + wordmark lockup for chrome (sidebar / topbar / footers).
 * Wordmark is set in the UI display face — the official letterform lockups
 * are used where the full marketing logo belongs (login hero).
 */
export function OrbitalLogo({ markSize = 26, gradient = true, className = '' }) {
  return (
    <div className={clsx('flex items-center gap-2.5', className)}>
      <OrbitalMark size={markSize} gradient={gradient} />
      <div className="flex flex-col justify-center">
        <span
          className="font-semibold text-orbital-text leading-none"
          style={{ fontSize: markSize * 0.52, letterSpacing: '0.28em', marginRight: '-0.28em' }}
        >
          ORBITAL
        </span>
        <span
          className="text-orbital-subtle leading-none"
          style={{ fontSize: markSize * 0.21, letterSpacing: '0.54em', marginRight: '-0.54em', marginTop: 3, fontWeight: 500 }}
        >
          STUDIOS
        </span>
      </div>
    </div>
  )
}
