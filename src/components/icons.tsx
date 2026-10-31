// Line icons from the mockups: 24×24, stroke 2.2–2.6, no fill.

type IconProps = { size?: number; className?: string; strokeWidth?: number };

function Svg({
  size = 22,
  className,
  strokeWidth = 2.4,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

export const BackIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M15 6l-6 6 6 6" />
  </Svg>
);

export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

export const ChevronIcon = (p: IconProps) => (
  <Svg size={16} {...p}>
    <path d="M9 6l6 6-6 6" />
  </Svg>
);

export const PlusIcon = (p: IconProps) => (
  <Svg size={26} strokeWidth={2.6} {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const ArrowUpIcon = (p: IconProps) => (
  <Svg strokeWidth={2.2} {...p}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Svg>
);

export const EnvelopeIcon = (p: IconProps) => (
  <Svg size={20} strokeWidth={2.2} {...p}>
    <path d="M4 7h16v11H4z" />
    <path d="M4 7l8 6 8-6" />
  </Svg>
);

export const CardIcon = (p: IconProps) => (
  <Svg size={20} strokeWidth={2.2} {...p}>
    <path d="M4 6h16v12H4z" />
    <path d="M4 10h16" />
  </Svg>
);

export const SettingsIcon = (p: IconProps) => (
  <Svg size={20} strokeWidth={2.2} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
  </Svg>
);

export const ArrowDownIcon = (p: IconProps) => (
  <Svg size={20} strokeWidth={2.2} {...p}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Svg>
);

export const HandleIcon = (p: IconProps) => (
  <Svg size={18} strokeWidth={2.2} {...p}>
    <path d="M5 9h14M5 15h14" />
  </Svg>
);
