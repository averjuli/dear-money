export const SIGN_IN_LINK_LIMIT = 3;
export const SIGN_IN_LINK_WINDOW_MS = 10 * 60 * 1000;

/**
 * At most 3 sign-in emails per address in any 10 minutes.
 * An email sent exactly 10 minutes ago no longer counts.
 */
export function canSendSignInLink(sentAt: readonly Date[], now: Date): boolean {
  const windowStart = now.getTime() - SIGN_IN_LINK_WINDOW_MS;
  const recent = sentAt.filter((at) => at.getTime() > windowStart);
  return recent.length < SIGN_IN_LINK_LIMIT;
}
