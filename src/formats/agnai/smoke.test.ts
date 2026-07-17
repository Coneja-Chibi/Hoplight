/**
 * Agnai jewel smoke: open sample → edit → export → re-open (no UI).
 * Proves the convert loop the desktop would use after import/save.
 */
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { characterAdapter as adapter } from "./index";

const samplePath = join(import.meta.dir, "../../../samples/agnai/robot.native.json");

test("smoke: robot sample open → edit name + culture → export → re-open", () => {
  const raw = readFileSync(samplePath, "utf8");
  const original = JSON.parse(raw) as Record<string, unknown>;

  const ent = adapter.toCanonical({ text: raw });
  expect(ent.body.identity.name).toBe("Robot");
  expect(ent.kind).toBe("character");

  ent.body.identity.name = "Robot Prime";
  ent.body.identity.culture = "japanese";
  ent.body.media.portrait = {
    role: "portrait",
    ref: "data:image/png;base64,SMOKE",
    mime: "image/png",
    primary: true,
  };

  const out = adapter.fromCanonical(ent);
  expect(out.suggestedExtension).toBe("json");
  expect(out.text).toBeTruthy();

  const wire = JSON.parse(out.text!) as Record<string, unknown>;
  expect(wire.name).toBe("Robot Prime");
  expect(wire.culture).toBe("japanese");
  expect(wire.avatar).toBe("data:image/png;base64,SMOKE");
  // persona / greeting from sample survive
  expect(wire.kind).toBe("character");
  expect(wire.greeting).toBe(original.greeting);

  const again = adapter.toCanonical({ text: out.text! });
  expect(again.body.identity.name).toBe("Robot Prime");
  expect(again.body.identity.culture).toBe("japanese");
  expect(again.body.media.portrait?.ref).toBe("data:image/png;base64,SMOKE");
  expect(again.body.persona.structured?.kind).toBe("attributes");
});

test("smoke: unedited robot sample deep-equals through open/export", () => {
  const raw = readFileSync(samplePath, "utf8");
  const original = JSON.parse(raw);
  const ent = adapter.toCanonical({ text: raw });
  const out = JSON.parse(adapter.fromCanonical(ent).text!);
  expect(out).toEqual(original);
});
