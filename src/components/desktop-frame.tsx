"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeSection, NavItem, SECTIONS } from "./nav-sections";

// The login screen keeps the plain phone column.
const WITHOUT_MENU = ["/login"];

/**
 * Desktop layout: side menu on the left, content on the right.
 * In a narrow window the menu becomes one row at the bottom of the screen.
 */
export function DesktopFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (WITHOUT_MENU.some((p) => pathname.startsWith(p))) return children;
  const active = activeSection(pathname);
  const [settings] = SECTIONS.filter((s) => s.key === "settings");

  return (
    <div className="flex min-h-dvh flex-wrap items-stretch pb-[calc(76px+env(safe-area-inset-bottom))] min-[800px]:pb-0">
      <nav
        aria-label="Разделы"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 gap-1 bg-surface px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-2px_12px_rgba(20,33,27,0.06)] min-[800px]:sticky min-[800px]:top-0 min-[800px]:bottom-auto min-[800px]:flex min-[800px]:h-dvh min-[800px]:max-w-[260px] min-[800px]:flex-[1_1_220px] min-[800px]:flex-col min-[800px]:gap-1.5 min-[800px]:self-start min-[800px]:overflow-y-auto min-[800px]:px-5 min-[800px]:py-7 min-[800px]:shadow-none"
      >
        <Link
          href="/"
          className="hidden whitespace-nowrap px-3.5 pb-6 font-display text-[22px] font-semibold text-accent no-underline min-[800px]:block"
        >
          dear money
        </Link>
        {SECTIONS.filter((s) => s.key !== "settings").map((section) => (
          <NavItem
            key={section.key}
            section={section}
            active={active === section.key}
            layout="responsive"
          />
        ))}
        <div className="grid min-[800px]:mt-auto min-[800px]:pt-6">
          <NavItem
            section={settings}
            active={active === "settings"}
            layout="responsive"
          />
        </div>
      </nav>
      <div className="min-w-0 flex-[999_1_560px]">{children}</div>
    </div>
  );
}
