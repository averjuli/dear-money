import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  EnvelopeIcon,
  SettingsIcon,
} from "./icons";

export type SectionKey = "envelopes" | "daily" | "income" | "settings";

export interface Section {
  key: SectionKey;
  href: string;
  label: string;
  Icon: typeof EnvelopeIcon;
}

/** Main sections: the bottom menu. */
export const SECTIONS: Section[] = [
  {
    key: "envelopes",
    href: "/",
    label: "Конверты",
    Icon: EnvelopeIcon,
  },
  {
    key: "daily",
    href: "/daily",
    label: "Траты",
    Icon: ArrowDownIcon,
  },
  {
    key: "income",
    href: "/income",
    label: "Пришли деньги",
    Icon: ArrowUpIcon,
  },
  {
    key: "settings",
    href: "/settings",
    label: "Настройки",
    Icon: SettingsIcon,
  },
];

/** The menu is shown only on the four section screens themselves. */
export function menuSection(pathname: string): SectionKey | null {
  return SECTIONS.find((s) => s.href === pathname)?.key ?? null;
}

/**
 * One section link: icon above a small label. In a window narrower than the
 * `labels` breakpoint the label is hidden visually but still names the link.
 */
export function NavItem({
  section,
  active,
}: {
  section: Section;
  active: boolean;
}) {
  return (
    <Link
      href={section.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-[14px] px-1 text-center text-[11px] leading-tight no-underline",
        active
          ? "bg-accent-soft font-semibold text-accent-strong"
          : "font-medium text-ink-muted",
      )}
    >
      <section.Icon />
      <span className="max-labels:sr-only">{section.label}</span>
    </Link>
  );
}
