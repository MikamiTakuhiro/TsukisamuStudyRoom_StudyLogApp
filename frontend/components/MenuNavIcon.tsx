import type { ReactNode } from "react";

export type MenuNavIconName =
  | "home"
  | "attendance"
  | "reservations"
  | "live"
  | "aspirations"
  | "study-plans"
  | "exams"
  | "profile"
  | "admin-home"
  | "analytics"
  | "students"
  | "logout";

function IconSvg({ children, size = 30 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="menu-nav-icon shrink-0"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export default function MenuNavIcon({ name, size }: { name: MenuNavIconName; size?: number }) {
  switch (name) {
    case "admin-home":
      return (
        <IconSvg size={size}>
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" />
          <rect x="13" y="13" width="7" height="7" rx="1.5" />
        </IconSvg>
      );
    case "analytics":
      return (
        <IconSvg size={size}>
          <path d="M4 20V4M4 20h16" />
          <path d="M8 16v-4M12 16V8M16 16v-6" />
        </IconSvg>
      );
    case "students":
      return (
        <IconSvg size={size}>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
          <path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.8c1.8.7 3 2.3 3 5.2" />
        </IconSvg>
      );
    case "logout":
      return (
        <IconSvg size={size}>
          <path d="M10 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" />
          <path d="M15 8l4 4-4 4M19 12H9" />
        </IconSvg>
      );
    case "home":
      return (
        <IconSvg>
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
          <path d="M9 21V13h6v8" />
        </IconSvg>
      );
    case "attendance":
      return (
        <IconSvg>
          <rect x="4" y="5" width="16" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M4 11h16" />
          <path d="M9 15h2M13 15h2M9 18h2" />
        </IconSvg>
      );
    case "reservations":
      return (
        <IconSvg>
          <rect x="4" y="5" width="16" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M4 11h16" />
          <path d="M12 15v4M10 17h4" />
        </IconSvg>
      );
    case "live":
      return (
        <IconSvg>
          <circle cx="12" cy="12" r="2.5" />
          <path d="M7.5 7.5a7 7 0 0 0 0 9M16.5 7.5a7 7 0 0 1 0 9M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14" />
        </IconSvg>
      );
    case "aspirations":
      return (
        <IconSvg>
          <path d="M12 3 4 7v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V7l-8-4Z" />
          <path d="m9 12 2 2 4-4" />
        </IconSvg>
      );
    case "study-plans":
      return (
        <IconSvg>
          <path d="M6 4h8l4 4v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
          <path d="M14 4v4h4M8 13h8M8 17h8M8 9h3" />
        </IconSvg>
      );
    case "exams":
      return (
        <IconSvg>
          <path d="M7 4h7l3 3v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
          <path d="M14 4v4h4M8 12h8M8 16h5M8 8h2" />
        </IconSvg>
      );
    case "profile":
      return (
        <IconSvg>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
        </IconSvg>
      );
  }
}
