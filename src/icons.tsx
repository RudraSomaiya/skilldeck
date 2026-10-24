// Inline SVG icons (no emoji, no icon font). Decorative unless the parent labels them.
const Svg = ({ d, size = 24 }: { d: string; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <path d={d} fill="currentColor" />
  </svg>
)

export const Star = ({ size = 16 }: { size?: number }) => (
  <Svg size={size} d="M12 2.8l2.8 5.7 6.3.9-4.6 4.4 1.1 6.2L12 17.1 6.4 20l1.1-6.2L2.9 9.4l6.3-.9z" />
)
