/**
 * The round-trip GATE for the behavior editor: it proves the overlay-edit discipline preserves every
 * unmodeled key through the REAL Risu adapter, using the real cherry card (8 regex scripts, 9 triggers,
 * including the two macro-built `type:"value"` conditions that a naive rebuild would mangle). If these
 * are red, no behavior UI is safe - a skipped/dropped key hides behind a green-looking edit.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dataToBody, type TavernData } from "../../../formats/_shared/tavern-fields";
import { applyRisuToBody, applyBodyToRisu } from "../../../formats/risu/risu-fields";
import {
  asRec,
  classifyCondition,
  classifyEffect,
  overlayField,
  setAt,
  triggerIsStructured,
} from "./behavior-edit";
import type { CharacterBody } from "../../../entities/character/schema";

const cherry = (): TavernData => {
  const raw = readFileSync(join(import.meta.dir, "../../../../samples/risu/characters/cherry.card.json"), "utf8");
  return (JSON.parse(raw) as { data: TavernData }).data;
};

const bodyOf = (data: TavernData): CharacterBody => {
  const body = dataToBody(data);
  applyRisuToBody(data, body);
  return body;
};

/** re-serialize a canonical body back onto a fresh clone of the wire, return the risuai block. */
const reemit = (data: TavernData, body: CharacterBody): Record<string, unknown> => {
  const twin = structuredClone(data);
  applyBodyToRisu(twin, body);
  const ext = asRec(twin.extensions);
  return asRec(ext.risuai);
};

describe("behavior round-trip through the real adapter", () => {
  test("zero-edit re-emit is byte-identical for triggerscript AND customScripts", () => {
    const data = cherry();
    const original = asRec(asRec(data.extensions).risuai);
    const out = reemit(data, bodyOf(data));
    expect(out.triggerscript).toEqual(original.triggerscript);
    expect(out.customScripts).toEqual(original.customScripts);
  });

  test("overlaying one condition field preserves every other key on that row", () => {
    const data = cherry();
    const body = bodyOf(data);
    const triggers = body.behavior?.triggerScripts ?? [];
    expect(triggers.length).toBe(9);

    // edit trigger #0's first condition value via the overlay helper (the ONLY sanctioned edit path)
    const t0 = triggers[0]!;
    const edited = overlayField(t0.conditions[0], "value", "Napping");
    body.behavior!.triggerScripts = setAt(triggers, 0, {
      ...t0,
      conditions: setAt(t0.conditions, 0, edited),
    });

    const out = reemit(data, body);
    const outTrigs = out.triggerscript as Record<string, unknown>[];
    const outCond0 = asRec(asRec(outTrigs[0]).conditions ? (outTrigs[0]!.conditions as unknown[])[0] : {});
    // the one field changed...
    expect(outCond0.value).toBe("Napping");
    // ...and the sibling keys (type/var/operator) survived verbatim
    expect(outCond0.type).toBe("var");
    expect(outCond0.var).toBe("status");
    expect(outCond0.operator).toBe("=");
    // every OTHER trigger is untouched
    expect(outTrigs.slice(1)).toEqual(
      (asRec(asRec(data.extensions).risuai).triggerscript as Record<string, unknown>[]).slice(1),
    );
  });

  test("the macro-built type:value conditions classify as ADVANCED, never coerced to inputs", () => {
    const data = cherry();
    const body = bodyOf(data);
    const triggers = body.behavior?.triggerScripts ?? [];
    // triggers #7 and #8 carry `^{{greater_equal::{{getvar::dep}}::10000}}` in `var`
    const advanced = triggers.filter((t) => !triggerIsStructured(t));
    expect(advanced.length).toBeGreaterThanOrEqual(2);
    const macroCond = triggers[7]!.conditions[0];
    expect(classifyCondition(macroCond).kind).toBe("advanced");
  });

  test("known conditions and effects classify structured", () => {
    const data = cherry();
    const body = bodyOf(data);
    const t0 = body.behavior!.triggerScripts![0]!;
    expect(classifyCondition(t0.conditions[0]).kind).toBe("known");
    // #0 effects are setvar rows
    expect(classifyEffect(t0.effects[0]).kind).toBe("setvar");
    // an impersonate effect exists on the later triggers
    const kinds = body.behavior!.triggerScripts!.flatMap((t) => t.effects.map((e) => classifyEffect(e).kind));
    expect(kinds).toContain("impersonate");
    expect(kinds).toContain("command");
  });

  test("regex scripts survive a label overlay with unknown keys intact", () => {
    const data = cherry();
    const body = bodyOf(data);
    const rx = body.behavior?.regexScripts ?? [];
    expect(rx.length).toBe(8);
    // relabel the first script; ableFlag/type/in/out must all survive
    body.behavior!.regexScripts = setAt(rx, 0, { ...rx[0]!, label: "renamed" });
    const out = reemit(data, body);
    const outRx = out.customScripts as Record<string, unknown>[];
    expect(outRx[0]!.comment).toBe("renamed");
    expect(outRx[0]!.in).toBe("선생님");
    expect(outRx[0]!.out).toBe("주인님");
    expect(outRx[0]!.type).toBe("edittrans");
    expect(outRx.slice(1)).toEqual(
      (asRec(asRec(data.extensions).risuai).customScripts as Record<string, unknown>[]).slice(1),
    );
  });
});
