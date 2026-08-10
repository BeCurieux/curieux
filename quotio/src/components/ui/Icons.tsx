// Interface icons — line drawings on a 24×24 grid, 1.8px stroke, round caps.
//
// Deliberately separate from src/components/illustrations: those are colourful
// pictures of things, these are functional marks. Mixing the two vocabularies
// is the fastest way to make a product look untidy.

interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

function Icon({
  size = 20,
  className,
  strokeWidth = 1.8,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}

export const CheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Icon>
);

export const ArrowRightIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </Icon>
);

export const ArrowLeftIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M20 12H5M11 6l-6 6 6 6" />
  </Icon>
);

export const PlusIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const TrashIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </Icon>
);

export const CopyIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="9" y="9" width="11" height="11" rx="2.5" />
    <path d="M5 15V6a2 2 0 0 1 2-2h8" />
  </Icon>
);

export const DragIcon = (props: IconProps) => (
  <Icon {...props} strokeWidth={2}>
    <circle cx="9" cy="6" r="0.6" />
    <circle cx="9" cy="12" r="0.6" />
    <circle cx="9" cy="18" r="0.6" />
    <circle cx="15" cy="6" r="0.6" />
    <circle cx="15" cy="12" r="0.6" />
    <circle cx="15" cy="18" r="0.6" />
  </Icon>
);

export const SparkleIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3c.9 4.7 2.4 6.2 7 7-4.6.9-6.1 2.4-7 7-.9-4.6-2.4-6.1-7-7 4.6-.8 6.1-2.3 7-7Z" />
    <path d="M19 15.5c.3 1.6.8 2.1 2.4 2.4-1.6.3-2.1.8-2.4 2.4-.3-1.6-.8-2.1-2.4-2.4 1.6-.3 2.1-.8 2.4-2.4Z" />
  </Icon>
);

export const EyeIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

export const DesktopIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="2.5" y="4" width="19" height="13" rx="2" />
    <path d="M9 21h6M12 17v4" />
  </Icon>
);

export const TabletIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="5" y="2.5" width="14" height="19" rx="2.5" />
    <path d="M11 18.5h2" />
  </Icon>
);

export const MobileIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
    <path d="M11 18.5h2" />
  </Icon>
);

export const LinkIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M10 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.6 1.6" />
    <path d="M14 10.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.6-1.6" />
  </Icon>
);

export const CodeIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14" />
  </Icon>
);

export const ChartIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Icon>
);

export const SettingsIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3" />
  </Icon>
);

export const PaletteIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3a9 9 0 0 0 0 18c1.7 0 2-1.2 1.4-2.1-.7-1 0-2.4 1.3-2.4h1.8A5.5 5.5 0 0 0 22 11c0-4.4-4.5-8-10-8Z" />
    <circle cx="8" cy="11" r="1.1" />
    <circle cx="12" cy="8" r="1.1" />
    <circle cx="16" cy="10.5" r="1.1" />
  </Icon>
);

export const BranchIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="6" cy="5" r="2.2" />
    <circle cx="6" cy="19" r="2.2" />
    <circle cx="18" cy="12" r="2.2" />
    <path d="M6 7.2v9.6M8.2 5H12a3.8 3.8 0 0 1 3.8 3.8V10M8.2 19H12a3.8 3.8 0 0 0 3.8-3.8V14" />
  </Icon>
);

export const TextIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 6.5V5h16v1.5M12 5v14M9 19h6" />
  </Icon>
);

export const CloseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Icon>
);

export const ChevronDownIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);

export const ChevronRightIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m9 6 6 6-6 6" />
  </Icon>
);

export const RefreshIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M20 11a8 8 0 1 0-1.2 5.2M20 5.5V11h-5.5" />
  </Icon>
);
