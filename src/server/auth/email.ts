const MAX_EMAIL_LENGTH = 254;

/** Same mailbox, same string: no spaces at the edges, lowercase. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Shape check for a sign-in address (expects an already normalized string):
 * at most 254 characters, no spaces, exactly one «@», a non-empty part before it,
 * and a domain with a dot and no empty parts.
 */
export function isValidEmail(email: string): boolean {
  if (email.length === 0 || email.length > MAX_EMAIL_LENGTH) return false;
  if (/\s/.test(email)) return false;
  const parts = email.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (local.length === 0) return false;
  const labels = domain.split(".");
  if (labels.length < 2) return false;
  return labels.every((label) => label.length > 0);
}
