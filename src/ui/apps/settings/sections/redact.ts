/**
 * Screenshot-redaction helper for the Remote access tab's "hide details" (eye) toggle. Masks the
 * identifying characters of a value, the Tailscale/LAN URL, the connect code, the certificate
 * fingerprint, a device label, while keeping its separators so it still reads as a link or code in a
 * screenshot but leaks none of the real characters. Pure; call only when the toggle is on.
 */

/** Replace every letter/digit with a block, leaving separators (: / . - and spaces) so the shape reads. */
export const mask = (s: string): string => s.replace(/[A-Za-z0-9]/g, "•");
