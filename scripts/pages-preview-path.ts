/** Resolve one preview request inside dist/pages on both Windows and POSIX hosts. */
import { isAbsolute, relative, resolve, sep } from "node:path";

export function resolvePagesPreviewPath(root: string, pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("\\") || decoded.includes("\0")) return null;
  let requested = decoded.replace(/^\/Hoplight\/?/, "");
  if (!requested || requested.endsWith("/")) requested += "index.html";
  const parts = requested.split("/");
  if (parts.some((part) => part === "" || part === "..")) return null;
  const candidate = resolve(root, ...parts);
  const inside = relative(root, candidate);
  if (inside === ".." || inside.startsWith(`..${sep}`) || isAbsolute(inside)) return null;
  return candidate;
}
