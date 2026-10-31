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
  /** Other screens that belong to this section. */
  paths: string[];
}

/** Main sections: the side menu on a computer, the bottom row on a phone. */
export const SECTIONS: Section[] = [
  {
    key: "envelopes",
    href: "/",
    label: "Конверты",
    Icon: EnvelopeIcon,
    paths: ["/wallets", "/envelopes"],
  },
  {
    key: "daily",
    href: "/daily",
    label: "Траты",
    Icon: ArrowDownIcon,
    paths: ["/expenses"],
  },
  {
    key: "income",
    href: "/income",
    label: "Пришли деньги",
    Icon: ArrowUpIcon,
    paths: [],
  },
  {
    key: "settings",
    href: "/settings",
    label: "Настройки",
    Icon: SettingsIcon,
    paths: ["/install"],
  },
];

export function activeSection(pathname: string): SectionKey | null {
  if (pathname === "/") return "envelopes";
  const found = SECTIONS.find((s) =>
    [s.href, ...s.paths].some((p) => p !== "/" && pathname.startsWith(p)),
  );
  return found?.key ?? null;
}

/**
 * One section link. "tab": icon above a small label, for the bottom row;
 * "responsive": a tab in a narrow window, a side menu row from 800 px.
 */
export function NavItem({
  section,
  active,
  layout,
}: {
  section: Section;
  active: boolean;
  layout: "tab" | "responsive";
}) {
  return (
    <Link
      href={section.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-[14px] px-1 text-center text-[11px] leading-tight no-underline",
        layout === "responsive" &&
          "min-[800px]:min-h-[46px] min-[800px]:flex-row min-[800px]:justify-start min-[800px]:gap-3 min-[800px]:px-3.5 min-[800px]:text-left min-[800px]:text-[15px]",
        active
          ? "bg-accent-soft font-semibold text-accent-strong"
          : "font-medium text-ink-muted",
      )}
    >
      <section.Icon />
      {section.label}
    </Link>
  );
}
