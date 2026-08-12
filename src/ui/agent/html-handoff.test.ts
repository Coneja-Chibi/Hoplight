/**
 * The handoff between the transcript and the viewer.
 *
 * Two shapes with different lifetimes, and the difference is the point: a document written into a
 * reply exists nowhere else and must be carried whole, while a saved drawing needs only its id so
 * the viewer can re-read it and a reload costs nothing. Getting that backwards would either bloat
 * session storage with copies or lose an unsaved page.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { HANDOFF_CAP, handOffHtml, handOffPiece, onHtmlHandoff, takeHandedHtml } from "./html-handoff";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8321/" });

/**
 * INSTALLED PER TEST AND PUT BACK, never at module scope.
 * 
 * The suite shares one process and several files install their own JSDOM. Assigning these where the
 * module loads pollutes every component test that runs after this file - 24 of them failed on
 * exactly that before this was moved, in DocsRoom and the Macro Lab, none of which touch a handoff.
 * The same import-order trap this repo has now met three times.
 */
const KEYS = ["window", "sessionStorage", "CustomEvent"] as const;
const prior: Record<string, unknown> = {};
const g = globalThis as unknown as Record<string, unknown>;

beforeAll(() => { for (const k of KEYS) prior[k] = g[k]; });
afterAll(() => { for (const k of KEYS) { if (prior[k] === undefined) delete g[k]; else g[k] = prior[k]; } });

beforeEach(() => {
  g["window"] = dom.window;
  g["sessionStorage"] = dom.window.sessionStorage;
  g["CustomEvent"] = dom.window.CustomEvent;
  dom.window.sessionStorage.clear();
});

describe("html handoff", () => {
  test("carries an unsaved reply whole, because it exists nowhere else", () => {
    handOffHtml("<h1>hi</h1>");
    expect(takeHandedHtml()).toEqual({ at: "inline", html: "<h1>hi</h1>" });
  });

  test("carries a saved drawing by id, not by copy", () => {
    handOffPiece("login-wireframe");
    expect(takeHandedHtml()).toEqual({ at: "piece", id: "login-wireframe" });
  });

  test("truncates an oversized document rather than failing to hand it over", () => {
    // Matches the ceiling the sealed preview would truncate at anyway; carrying more would only
    // move bytes nobody can see through storage the whole origin shares.
    handOffHtml("x".repeat(HANDOFF_CAP + 500));
    const out = takeHandedHtml();
    expect(out?.at === "inline" && out.html.length).toBe(HANDOFF_CAP);
  });

  test("reading does not consume, so switching away and back still draws", () => {
    handOffPiece("kept");
    expect(takeHandedHtml()).not.toBeNull();
    expect(takeHandedHtml()).toEqual({ at: "piece", id: "kept" });
  });

  test("a later handoff replaces the earlier one", () => {
    handOffHtml("<p>first</p>");
    handOffPiece("second");
    expect(takeHandedHtml()).toEqual({ at: "piece", id: "second" });
  });

  /**
   * The shape has already changed once and the key is session-scoped, so a value written by an
   * older tab is a real thing to meet. Answering "nothing is waiting" is right; throwing would take
   * the whole viewer down over a preview.
   */
  test("says nothing is waiting rather than throwing on a value it cannot read", () => {
    dom.window.sessionStorage.setItem("hoplight.html-view.doc", "<h1>a raw string, the old shape</h1>");
    expect(takeHandedHtml()).toBeNull();
    dom.window.sessionStorage.setItem("hoplight.html-view.doc", '{"at":"piece"}');
    expect(takeHandedHtml()).toBeNull();
    dom.window.sessionStorage.setItem("hoplight.html-view.doc", "{not json");
    expect(takeHandedHtml()).toBeNull();
  });

  test("announces, so the shell can open the tab", () => {
    let heard = 0;
    const off = onHtmlHandoff(() => { heard += 1; });
    handOffHtml("<p>x</p>");
    handOffPiece("y");
    off();
    handOffPiece("after detach");
    expect(heard).toBe(2);
  });
});
