// Task 5.5: the shared icon set. Every icon here is decorative — an icon
// never carries its own accessible name; the control that uses it (Button,
// IconButton, a labelled field, Banner, Badge) names itself with visible
// text or its own `aria-label`. specs/design-system/spec.md "Give every
// icon-only control an accessible name" requires decorative imagery —
// explicitly including icons — to be hidden from assistive technology
// rather than announced, so every icon below renders `aria-hidden="true"`
// and `focusable="false"` and exposes no `role`, `<title>`, or other
// accessible-name source. Geometry is a fresh 16x16 line-icon set (contract:
// design.md Decision 1 fixes token names/values verbatim from the prototype,
// not icon paths), so it does not reproduce the prototype's SVGs pixel for
// pixel.
import styles from "./icon.module.css";

export interface IconProps {
  size?: number;
  className?: string;
}

const VIEW_BOX = "0 0 16 16";

function baseAttrs({ size = 16, className }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: VIEW_BOX,
    "aria-hidden": "true" as const,
    focusable: "false" as const,
    className,
  };
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...baseAttrs(props)}>
      <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...baseAttrs(props)}>
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...baseAttrs(props)}>
      <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...baseAttrs(props)}>
      <circle cx="7" cy="7" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.3 10.3L13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <svg {...baseAttrs(props)}>
      <circle cx="8" cy="8" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 1.7v1.9M8 12.4v1.9M1.7 8h1.9M12.4 8h1.9M3.5 3.5l1.35 1.35M11.15 11.15l1.35 1.35M3.5 12.5l1.35-1.35M11.15 4.85l1.35-1.35"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <svg {...baseAttrs(props)}>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 7.2v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="5.1" r="0.2" fill="currentColor" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

export function WarningIcon(props: IconProps) {
  return (
    <svg {...baseAttrs(props)}>
      <path d="M8 2.2l6.2 10.8H1.8L8 2.2z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M8 6.8v3.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="11.6" r="0.2" fill="currentColor" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

export function ErrorIcon(props: IconProps) {
  return (
    <svg {...baseAttrs(props)}>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function SuccessIcon(props: IconProps) {
  return (
    <svg {...baseAttrs(props)}>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M5.2 8.2l1.9 1.9 3.7-4.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...baseAttrs(props)}>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 4.6V8l2.4 1.6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ExternalLinkIcon(props: IconProps) {
  return (
    <svg {...baseAttrs(props)}>
      <path
        d="M6.5 3.5H4A1.5 1.5 0 0 0 2.5 5v6.5A1.5 1.5 0 0 0 4 13h6.5a1.5 1.5 0 0 0 1.5-1.5V9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8.5 2.5H13v4.5M13 2.5L7 8.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SpinnerIcon(props: IconProps) {
  const { className, ...attrs } = baseAttrs(props);
  return (
    <svg {...attrs} className={[styles.spin, className].filter(Boolean).join(" ")}>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.25" />
      <path d="M14 8a6 6 0 0 0-6-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
