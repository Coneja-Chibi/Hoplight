/** Verifies the rendered recovery actions for a refused forwarded Studio address. */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { BootErrorScreen } from "./BootErrorScreen";
import { settingsBootProblem } from "./boot-error";

test("renders direct Studio and Remote Access setup actions", () => {
  const html = renderToStaticMarkup(
    <BootErrorScreen
      problem={settingsBootProblem(403, "forbidden", { port: "8321" })}
    />,
  );

  expect(html).toContain('href="http://localhost:8321"');
  expect(html).toContain(
    'href="http://localhost:8321/#settings/remote-access"',
  );
  expect(html).toContain("Open Studio");
  expect(html).toContain("Open Remote Access setup");
  expect(html).toContain("Copy SSH command");
  expect(html).toContain("ssh -L 8321:127.0.0.1:8321 user@server");
});
