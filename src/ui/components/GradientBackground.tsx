import { memo } from 'react';

/**
 * Static full-bleed background gradient (DESIGN.md "Background gradient"). Mounted once at the
 * app root behind every screen; it takes no props, so it never re-renders. Colors and opacities
 * come from the theme layer and switch with prefers-color-scheme without React involvement.
 */
export const GradientBackground = memo(function GradientBackground() {
  return (
    <div aria-hidden className="gradient-bg">
      <span className="blob-magenta" />
      <span className="blob-blue" />
      <span className="blob-coral" />
      <span className="blob-lilac" />
    </div>
  );
});
