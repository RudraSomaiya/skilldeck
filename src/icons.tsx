// Inline SVG icons (no emoji, no icon font). Decorative: the button around them carries the label.
const Icon = ({ d, size = 24, fill = false }: { d: string; size?: number; fill?: boolean }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <path
      d={d}
      fill={fill ? 'currentColor' : 'none'}
      stroke={fill ? 'none' : 'currentColor'}
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export const Star = ({ size = 16 }: { size?: number }) => (
  <Icon fill size={size} d="M12 2.8l2.8 5.7 6.3.9-4.6 4.4 1.1 6.2L12 17.1 6.4 20l1.1-6.2L2.9 9.4l6.3-.9z" />
)
export const X = ({ size = 28 }: { size?: number }) => <Icon size={size} d="M6 6l12 12M18 6L6 18" />
export const Undo = ({ size = 22 }: { size?: number }) => <Icon size={size} d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 010 11H11" />
export const Flip = ({ size = 22 }: { size?: number }) => (
  <Icon size={size} d="M4 12a8 8 0 0113.7-5.6L20 8.7M20 4v4.7h-4.7M20 12a8 8 0 01-13.7 5.6L4 15.3M4 20v-4.7h4.7" />
)
export const External = ({ size = 16 }: { size?: number }) => (
  <Icon size={size} d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />
)
