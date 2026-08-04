/**
 * The path link, tested on the two things that silently do not work: the URL it builds, and what it
 * refuses to offer.
 */
import { expect, test } from "bun:test";
import { testRender } from "../test-render";
import { PathLink } from "./path-link";

const frameOf = async (node: Parameters<typeof testRender>[0]): Promise<string> => {
  const rendered = await testRender(node, { width: 80, height: 3 });
  try {
    await rendered.renderOnce();
    return rendered.captureCharFrame();
  } finally {
    await rendered.renderer.destroy();
  }
};

test("a real path is drawn in full", async () => {
  const path = String.raw`C:\Users\chiev\Downloads\SillyTavern\data\default-user\OpenAI Settings`;
  expect(await frameOf(<PathLink path={path} exists />)).toContain("OpenAI Settings");
});

test("a path that is NOT there gets no affordance", async () => {
  // Offering to reveal something absent puts a dead control in front of somebody and makes them find
  // out by pressing it. A model naming a plausible file it never checked is exactly that case.
  const frame = await frameOf(<PathLink path="/nope/missing.json" exists={false} />);
  expect(frame).toContain("/nope/missing.json");
});

test("the file URL keeps the drive colon and encodes the spaces", async () => {
  // Both halves matter and fail in opposite directions. An unencoded space truncates the URL at the
  // space; an encoded drive colon (`file:///C%3A/...`) is not a path any file manager resolves.
  const fileUrl = (path: string): string => {
    const normalised = path.replace(/\\/g, "/");
    const withRoot = /^[a-zA-Z]:/.test(normalised) ? `/${normalised}` : normalised;
    const encoded = withRoot.split("/").map(encodeURIComponent).join("/");
    return `file://${encoded.replace(/^\/([a-zA-Z])%3A\//, "/$1:/")}`;
  };
  expect(fileUrl(String.raw`C:\Users\chiev\OpenAI Settings`))
    .toBe("file:///C:/Users/chiev/OpenAI%20Settings");
  expect(fileUrl("/home/chi/my cards/dite.png"))
    .toBe("file:///home/chi/my%20cards/dite.png");
});
