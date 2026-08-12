/**
 * The four things an engine row can be, and why they are four rather than two.
 *
 * "Found" and "not found" would collapse the two cases somebody actually needs to tell apart: a
 * variable that is set and names nothing (so the saved folder is NOT what this run is using), and a
 * saved folder whose checkout has moved (so the path on screen is the fault). Both look like "no
 * engine" from the outside and take opposite fixes.
 */
import { describe, expect, test } from "bun:test";
import { engineState, type EngineRow } from "./engines-core";

const row = (over: Partial<EngineRow> = {}): EngineRow => ({
  id: "sillytavern",
  label: "SillyTavern",
  install: "a SillyTavern checkout",
  rootVar: "HOPLIGHT_ST_ROOT",
  saved: "",
  env: "",
  root: "",
  from: null,
  ...over,
});

describe("engineState", () => {
  test("never set is not an error, it is an invitation", () => {
    expect(engineState(row())).toEqual({ note: "not set", ok: false, locked: false });
  });

  test("a saved folder that answers is in use, and stays editable", () => {
    expect(engineState(row({ saved: "C:\\ST", root: "C:\\ST", from: "saved" })))
      .toEqual({ note: "in use", ok: true, locked: false });
  });

  test("a saved folder whose checkout moved says so, rather than reading as unset", () => {
    const state = engineState(row({ saved: "C:\\ST" }));
    expect(state.ok).toBe(false);
    expect(state.note).toContain("nothing is there now");
    // Still editable: fixing the path is the whole remedy.
    expect(state.locked).toBe(false);
  });

  test("a variable in force names itself and locks the field", () => {
    const state = engineState(row({ saved: "C:\\Saved", env: "C:\\Var", root: "C:\\Var", from: "env" }));
    expect(state).toEqual({ note: "in use, from HOPLIGHT_ST_ROOT", ok: true, locked: true });
  });

  test("a variable that is set and names nothing blames the variable, not the saved folder", () => {
    // The trap this exists for: reporting "not found" here sends somebody to re-check a folder
    // that is not the one being used, and no edit to it can help until the variable is unset.
    const state = engineState(row({ saved: "C:\\Saved", env: "C:\\Wrong" }));
    expect(state.ok).toBe(false);
    expect(state.note).toContain("HOPLIGHT_ST_ROOT is set");
    expect(state.locked).toBe(true);
  });
});
