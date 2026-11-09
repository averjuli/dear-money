"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PlusIcon } from "./icons";
import {
  NavItem,
  menuSection,
  SECTIONS,
  type SectionKey,
} from "./nav-sections";

/**
 * The screen column and, on the four section screens, the bottom menu, on
 * every device and window width. Screens never draw the menu themselves, so
 * it is always one.
 */
export function AppFrame({ children }: { children: React.ReactNode }) {
  const active = menuSection(usePathname());
  return (
    <div
      className={cn(
        active &&
          // The screen column fills the height above the menu; its bottom
          // padding moves below the menu: 12 px, the same as the sticky
          // menu of a scrolling screen, so it never jumps between screens.
          "flex min-h-dvh flex-col pb-[max(12px,env(safe-area-inset-bottom))] [&>main]:min-h-0 [&>main]:grow [&>main]:pb-0",
      )}
    >
      {children}
      {active && <BottomNav active={active} />}
    </div>
  );
}

/**
 * Bottom row of the four sections, as wide as the screen column, with the
 * «+» for a new expense on every one of them: from 600 px to the right of the menu, the same height; in a narrower window above it on the right
 * (22 px above the menu: the 14 px gap between blocks plus 8 px).
 */
function BottomNav({ active }: { active: SectionKey }) {
  // The expense form closes back to the section it was opened from.
  const from = SECTIONS.find((s) => s.key === active)!.href;
  return (
    <div className="content-column pointer-events-none sticky bottom-[max(12px,env(safe-area-inset-bottom))] mt-[22px] flex flex-col items-end gap-2.5 wide:flex-row-reverse wide:items-stretch">
      <Link
        href={`/expenses/new?from=${encodeURIComponent(from)}`}
        aria-label="Внести трату"
        className="pointer-events-auto flex size-[60px] shrink-0 items-center justify-center rounded-[20px] bg-accent text-white shadow-[0_2px_12px_rgba(20,33,27,0.12)] wide:h-auto wide:w-16"
      >
        <PlusIcon />
      </Link>
      <nav
        aria-label="Разделы"
        className="pointer-events-auto grid w-full grid-cols-4 gap-1 rounded-[20px] bg-surface p-1.5 shadow-[0_2px_12px_rgba(20,33,27,0.06)] wide:min-w-0 wide:flex-1"
      >
        {SECTIONS.map((section) => (
          <NavItem
            key={section.key}
            section={section}
            active={active === section.key}
          />
        ))}
      </nav>
    </div>
  );
}
