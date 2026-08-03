/**
 * Path containment.
 *
 * This is the whole boundary between "Kit read a folder I pointed it at" and "Kit read my home
 * directory", so the tests are adversarial rather than illustrative. Every case here is a way the
 * check is commonly written wrong, and each one grants access to something the user never named.
 */
import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { checkGrant, contains, grantFolder } from "./grants";

const ROOT = resolve("/studio");
const grants = [grantFolder("/studio", "studio")];

describe("contains", () => {
  test("a file inside is inside", () => {
    expect(contains(ROOT, resolve("/studio/presets/a.json"))).toBe(true);
    expect(contains(ROOT, resolve("/studio/deep/er/still.json"))).toBe(true);
  });

  test("the root itself counts as inside", () => {
    expect(contains(ROOT, ROOT)).toBe(true);
  });

  test("A SIBLING SHARING A PREFIX IS NOT INSIDE", () => {
    // The classic way this check is written wrong. A prefix match says /studio-backup is under
    // /studio, and the failure hands over a directory nobody granted.
    expect(contains(ROOT, resolve("/studio-backup/secrets.json"))).toBe(false);
    expect(contains(ROOT, resolve("/studiox"))).toBe(false);
  });

  test("dot-dot cannot climb out", () => {
    expect(contains(ROOT, resolve("/studio/../etc/passwd"))).toBe(false);
    expect(contains(ROOT, resolve("/studio/sub/../../elsewhere"))).toBe(false);
  });

  test("dot-dot that stays inside is still inside", () => {
    // Refusing this would be too strict, and too strict gets worked around rather than fixed.
    expect(contains(ROOT, resolve("/studio/a/../b/file.json"))).toBe(true);
  });

  test("a parent is not inside its own child", () => {
    expect(contains(resolve("/studio/presets"), ROOT)).toBe(false);
  });
});

describe("checkGrant", () => {
  test("returns the RESOLVED path, not the string it was handed", () => {
    // So a caller cannot check one path and then use another. That gap is where traversal lives.
    const out = checkGrant(grants, resolve("/studio/a/../b.json"));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.path).toBe(resolve("/studio/b.json"));
    expect(out.path).not.toContain("..");
  });

  test("no grants is its own refusal, not a generic denial", () => {
    const out = checkGrant([], "/anywhere/file.json");
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("no-grants");
    expect(out.detail).toContain("only read");
  });

  test("outside every grant is refused, and the refusal names what IS shared", () => {
    const out = checkGrant(grants, resolve("/elsewhere/file.json"));
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("outside-grants");
    expect(out.detail).toContain("studio");
  });

  test("several grants are each checked", () => {
    const many = [grantFolder("/one"), grantFolder("/two")];
    expect(checkGrant(many, resolve("/two/file.json")).ok).toBe(true);
    expect(checkGrant(many, resolve("/three/file.json")).ok).toBe(false);
  });

  test("an empty path is refused rather than resolving to the working directory", () => {
    // resolve("") is cwd, so without this guard a blank argument silently means "wherever Kit runs".
    expect(checkGrant(grants, "   ").ok).toBe(false);
  });

  test("a grant is stored absolute, so a later cwd change cannot move it", () => {
    expect(grantFolder("relative/path").root).toBe(resolve("relative/path"));
  });
});

describe("platform comparison", () => {
  test("Windows matches case-insensitively, other platforms do not", () => {
    // Following the platform rather than picking one. Too strict refuses a folder the user granted;
    // too loose accepts one they did not, and the right answer differs by OS.
    const upper = resolve("/STUDIO/file.json");
    expect(contains(ROOT, upper)).toBe(process.platform === "win32");
  });
});
