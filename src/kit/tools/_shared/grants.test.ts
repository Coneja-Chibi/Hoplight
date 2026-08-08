/**
 * Path containment.
 *
 * This is the whole boundary between "Kit read a folder I pointed it at" and "Kit read my home
 * directory", so the tests are adversarial rather than illustrative. Every case here is a way the
 * check is commonly written wrong, and each one grants access to something the user never named.
 */
import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { checkGrant, checkGrantReal, contains, grantFolder } from "./grants";

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

describe("checkGrantReal: a link cannot carry a path out", () => {
  const scratchDir = async (): Promise<string> => mkdtemp(join(tmpdir(), "hoplight-link-"));

  test("a symlink pointing outside the granted root is refused, and says where it goes", async () => {
    // Proven on a stock Windows profile before this existed: C:\Users\chiev\Videos is a junction to
    // D:\Videos, so sharing the home folder read 93 files off another drive while reporting a
    // contained root. The walk skipped symlinked ENTRIES, which made the boundary look closed.
    const root = await scratchDir();
    const inside = join(root, "shared");
    const outside = join(root, "secret");
    await mkdir(inside);
    await mkdir(outside);
    await writeFile(join(outside, "leak.txt"), "SECRET");

    const link = join(inside, "doorway");
    try {
      await symlink(outside, link, "junction");
    } catch {
      return; // an environment without link privileges cannot exercise this
    }

    const grants = [grantFolder(inside, "shared")];
    // The lexical check still says yes, which is exactly why the real one has to exist.
    expect(checkGrant(grants, link).ok).toBe(true);

    const real = await checkGrantReal(grants, link);
    expect(real.ok).toBe(false);
    if (real.ok) return;
    expect(real.reason).toBe("outside-grants");
    expect(real.detail).toContain("link to");
  });

  test("a granted root that is ITSELF a link still reaches its real contents", async () => {
    // Sharing a junction means sharing its target; refusing its own children would be over-strict.
    const root = await scratchDir();
    const real = join(root, "real");
    await mkdir(real);
    await writeFile(join(real, "kept.txt"), "fine");
    const link = join(root, "link");
    try {
      await symlink(real, link, "junction");
    } catch {
      return;
    }

    const check = await checkGrantReal([grantFolder(link, "shared")], join(link, "kept.txt"));
    expect(check.ok).toBe(true);
  });

  test("an ordinary contained path is unaffected, and comes back real", async () => {
    const root = await scratchDir();
    await writeFile(join(root, "a.json"), "{}");
    const check = await checkGrantReal([grantFolder(root)], join(root, "a.json"));
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    expect(check.path.endsWith("a.json")).toBe(true);
  });

  test("a path that does not exist keeps the lexical answer, since nothing can leak", async () => {
    const root = await scratchDir();
    const check = await checkGrantReal([grantFolder(root)], join(root, "never-made.json"));
    expect(check.ok).toBe(true);
  });

  test("a path outside the grants is still refused before any filesystem work", async () => {
    const root = await scratchDir();
    const check = await checkGrantReal([grantFolder(join(root, "a"))], join(root, "b", "x.json"));
    expect(check.ok).toBe(false);
  });
});

// -----------------------------------------------------------------------------------------------
// A file grant is ONE file. This is the narrow authority a pasted path mints: somebody handing Kit a
// path has consented to that file exactly as picking it in a dialog would - and to nothing beside it.
// Every test here is a NEGATIVE, because the failure mode is a widened grant, which looks like
// success from the outside.
// -----------------------------------------------------------------------------------------------
describe("a file grant", () => {
  // String.raw, because a lone backslash in a normal string literal silently becomes nothing:
  // "C:\cards" is the string "C:cards", and every assertion below would test a path that cannot exist.
  const FOLDER = process.platform === "win32" ? String.raw`C:\cards` : "/cards";
  const FILE = process.platform === "win32" ? String.raw`C:\cards\dite.png` : "/cards/dite.png";
  const SIBLING = process.platform === "win32" ? String.raw`C:\cards\other.png` : "/cards/other.png";
  const grants = [{ root: FILE, file: true }];

  test("opens the file it names", () => {
    const check = checkGrant(grants, FILE);
    expect(check.ok).toBe(true);
  });

  test("does NOT open a sibling in the same folder", () => {
    // The whole point. Granting the parent folder would have been the easy implementation and would
    // have turned "look at this card" into handing over a directory.
    const check = checkGrant(grants, SIBLING);
    expect(check.ok).toBe(false);
  });

  test("does NOT open the folder that contains it", () => {
    expect(checkGrant(grants, FOLDER).ok).toBe(false);
  });

  test("a FOLDER grant still reaches its descendants, so the narrowing is opt-in", () => {
    expect(checkGrant([{ root: FOLDER }], SIBLING).ok).toBe(true);
  });
});
