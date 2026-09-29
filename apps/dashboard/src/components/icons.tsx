// Icons from the design screens. All decorative: pair them with visible text or an aria-label.
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 18, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="24" height="24" rx="6" fill="var(--accent)" />
      <rect x="6.5" y="7" width="5.5" height="12" rx="1.5" fill="#FFFFFF" />
      <rect x="14" y="7" width="5.5" height="12" rx="1.5" fill="var(--highlight)" />
    </svg>
  );
}

export const ProjectsIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="3" width="6" height="6" rx="1.5" />
    <rect x="11" y="3" width="6" height="6" rx="1.5" />
    <rect x="3" y="11" width="6" height="6" rx="1.5" />
    <rect x="11" y="11" width="6" height="6" rx="1.5" />
  </Icon>
);

export const TeamIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="8" cy="7" r="3" />
    <path d="M2.5 17c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5M13 4.5a3 3 0 0 1 0 5M15 12.8c1.3.6 2.2 1.9 2.5 4.2" />
  </Icon>
);

export const ExperimentsIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 3h4M9 3v5l-5 8.5a1 1 0 0 0 .9 1.5h10.2a1 1 0 0 0 .9-1.5L11 8V3" />
  </Icon>
);

export const AudiencesIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 5h14l-5.5 6.5V16l-3 1.5v-6L3 5z" />
  </Icon>
);

export const MetricsIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="10" cy="10" r="7" />
    <circle cx="10" cy="10" r="3" />
  </Icon>
);

export const InstallIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 6l-4 4 4 4M13 6l4 4-4 4" />
  </Icon>
);

export const SettingsIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 6h14M3 14h14" />
    <circle cx="7" cy="6" r="2" fill="var(--ink)" />
    <circle cx="13" cy="14" r="2" fill="var(--ink)" />
  </Icon>
);

export const ChevronUpDownIcon = (p: IconProps) => (
  <Icon size={16} {...p}>
    <path d="M7 8l3-3 3 3M7 12l3 3 3-3" />
  </Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon size={16} strokeWidth={2} {...p}>
    <path d="M4 10l4 4 8-8" />
  </Icon>
);

export const PlusIcon = (p: IconProps) => (
  <Icon size={16} strokeWidth={2} {...p}>
    <path d="M10 4v12M4 10h12" />
  </Icon>
);

export const SearchIcon = (p: IconProps) => (
  <Icon size={16} strokeWidth={1.7} {...p}>
    <circle cx="9" cy="9" r="5.5" />
    <path d="M13.5 13.5L17 17" />
  </Icon>
);

export const MoreIcon = (p: IconProps) => (
  <Icon size={18} stroke="none" fill="currentColor" {...p}>
    <circle cx="4.5" cy="10" r="1.6" />
    <circle cx="10" cy="10" r="1.6" />
    <circle cx="15.5" cy="10" r="1.6" />
  </Icon>
);
