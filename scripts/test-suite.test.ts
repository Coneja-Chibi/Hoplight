/** Contract tests for the repository-wide test and React lint commands. */
import { expect, test } from "bun:test";

const packageJson = await Bun.file(new URL("../package.json", import.meta.url)).json() as {
  scripts?: Record<string, string>;
};

test("the supported test command discovers both authored test trees", () => {
  const command = packageJson.scripts?.test ?? "";
  expect(command).toMatch(/^bun test\s+\.\/src\s+\.\/scripts(?:\s|$)/);
});

test("the React lint command covers Studio and Kit", () => {
  const command = packageJson.scripts?.["lint:ui"] ?? "";
  expect(command).toContain("src/ui/**/*.{ts,tsx}");
  expect(command).toContain("src/kit/**/*.{ts,tsx}");
});
