import type { ReactNode } from "react";

export type MenuNavIconName =
  | "home"
  | "attendance"
  | "reservations"
  | "live"
  | "aspirations"
  | "study-plans"
  | "exams"
  | "profile";

function IconSvg({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
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

export default function MenuNavIcon({ name }: { name: MenuNavIconName }) {
  switch (name) {
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
