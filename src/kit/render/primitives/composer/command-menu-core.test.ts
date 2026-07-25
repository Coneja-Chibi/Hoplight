/** Verifies the slash palette is registry-driven, filterable, and deterministic. */
import { expect, test } from "bun:test";
import type { KitCommand } from "../../../commands/command";
import { matchingCommands } from "./command-menu-core";

const command = (name: string, summary: string, aliases?: string[]): KitCommand => ({
  name,
  summary,
  aliases,
  run: () => {},
});

test("a bare slash lists every command alphabetically", () => {
  const commands = [
    command("/test", "check provider"),
    command("/model", "connect provider", ["/providers"]),
  ];
  expect(matchingCommands(commands, "/").map((item) => item.name)).toEqual(["/model", "/test"]);
});

test("typing filters names, aliases, and summaries; arguments close the palette", () => {
  const commands = [
    command("/model", "connect provider", ["/providers"]),
    command("/privacy", "show machine egress"),
  ];
  expect(matchingCommands(commands, "/mod").map((item) => item.name)).toEqual(["/model"]);
  expect(matchingCommands(commands, "/prov").map((item) => item.name)).toEqual(["/model"]);
  expect(matchingCommands(commands, "/machine").map((item) => item.name)).toEqual(["/privacy"]);
  expect(matchingCommands(commands, "/model local")).toEqual([]);
});
