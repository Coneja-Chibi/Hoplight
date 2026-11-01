/** Failed native creation cannot report a normal close or discard the serving Studio. */
import { expect, test } from "bun:test";
import { runWindowSession } from "./desktop-window-session";
test("null native handle reports failure without running or reporting closed", () => {
  let ran = 0, closed = 0;
  expect(() => runWindowSession({ unsafeHandle: null, title: "", navigate() {} },
    { url: "http://127.0.0.1:45102", title: "fixture" }, () => { ran++; }, () => { closed++; })).toThrow("could not be created");
  expect(ran).toBe(0); expect(closed).toBe(0);
});
test("only a successful run loop reports a normal close", () => {
  let closed = 0, navigated = "";
  const window = { unsafeHandle: 1, title: "", navigate(url: string) { navigated = url; } };
  const target = { url: "http://127.0.0.1:45102", title: "fixture" };
  expect(() => runWindowSession(window, target, () => { throw new Error("fixture run failure"); }, () => { closed++; })).toThrow("fixture run failure");
  expect(closed).toBe(0);
  runWindowSession(window, target, () => {}, () => { closed++; });
  expect(closed).toBe(1); expect(navigated).toBe(target.url); expect(window.title).toBe(target.title);
});
