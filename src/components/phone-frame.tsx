"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PlusIcon } from "./icons";
import {
  NavItem,
  phoneMenuSection,
  SECTIONS,
  type SectionKey,
} from "./nav-sections";

/**
 * Phone layout: the screen column and, on the four section screens, the
 * bottom menu. Screens never draw the menu themselves, so it is always one.
 */
export function PhoneFrame({ children }: { children: React.ReactNode }) {
  const active = phoneMenuSection(usePathname());
  return (
    <div
      className={cn(
        active &&
          // The screen column fills the height above the menu; its bottom
          // padding moves below the menu.
          "flex min-h-dvh flex-col pb-[max(20px,env(safe-area-inset-bottom))] [&>main]:min-h-0 [&>main]:grow [&>main]:pb-0",
      )}
    >
      {children}
      {active && <BottomNav active={active} />}
    </div>
  );
}

/**
 * Bottom row of the four sections; on «Конверты» and «Траты» the round «+»
 * for a new expense hangs above it on the right. 22 px above it: the 14 px
 * gap between blocks plus 8 px.
 */
function BottomNav({ active }: { active: SectionKey }) {
  const withPlus = active === "envelopes" || active === "daily";
  const from = active === "daily" ? "/daily" : "/";
  return (
    <div className="pointer-events-none sticky bottom-[max(12px,env(safe-area-inset-bottom))] mx-auto mt-[22px] flex w-full max-w-[430px] flex-col items-end gap-2.5 px-5">
      {withPlus && (
        <Link
          href={`/expenses/new?from=${encodeURIComponent(from)}`}
          aria-label="Внести трату"
          className="pointer-events-auto flex size-[60px] shrink-0 items-center justify-center rounded-[20px] bg-accent text-white shadow-[0_2px_12px_rgba(20,33,27,0.12)]"
        >
          <PlusIcon />
        </Link>
      )}
      <nav
        aria-label="Разделы"
        className="pointer-events-auto grid w-full grid-cols-4 gap-1 rounded-[20px] bg-surface p-1.5 shadow-[0_2px_12px_rgba(20,33,27,0.06)]"
      >
        {SECTIONS.map((section) => (
          <NavItem
            key={section.key}
            section={section}
            active={active === section.key}
            layout="tab"
          />
        ))}
      </nav>
    </div>
  );
}
