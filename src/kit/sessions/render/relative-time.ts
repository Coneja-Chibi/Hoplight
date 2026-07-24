/**
 * A pure relative-time label for session rows ("2h ago", "Jul 21"). now is injected so the label is
 * deterministic and testable; the shell passes Date.now(). Calendar dates use UTC so a test never
 * depends on the runner's timezone. Future/skewed timestamps collapse to "just now", never negative.
 */

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

export const relativeTime = (then: number, now: number): string => {
  const delta = now - then;
  if (delta < MIN) return "just now";
  if (delta < HOUR) return `${Math.floor(delta / MIN)}m ago`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h ago`;
  if (delta < WEEK) return `${Math.floor(delta / DAY)}d ago`;
  const date = new Date(then);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
};
