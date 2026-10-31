import { headers } from "next/headers";
import { userAgentFromString } from "next/server";

/**
 * Phones get the phone screens; computers and tablets get the desktop layout.
 * A narrow desktop window keeps the desktop layout in one column.
 */
export async function isDesktop(): Promise<boolean> {
  const ua = (await headers()).get("user-agent") ?? undefined;
  return userAgentFromString(ua).device.type !== "mobile";
}
