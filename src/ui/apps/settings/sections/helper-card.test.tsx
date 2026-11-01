/** Helper installation provenance and download actions match the host offer. */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { HelperInstalledLine, type HelperControls } from "./helper-card";
test("a locally installed helper has no unavailable download action", () => {
  const h: HelperControls = { status: { installed: true, offered: false, platform: "win32-x64" }, busy: false, error: "", download() {} };
  const html = renderToStaticMarkup(<HelperInstalledLine h={h} />);
  expect(html).toContain("installed locally");
  expect(html).not.toContain("Get it again");
  expect(html).not.toContain("downloaded");
});
