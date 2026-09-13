/**
 * A minimal MCP server for tests - real stdio, real JSON-RPC, no dependencies.
 *
 * Speaks exactly enough protocol to prove the CLIENT side against a live process: initialize,
 * tools/list (two tools, one deliberately malformed so dropped-counting is exercised), and
 * tools/call for `echo` (mirrors its argument) and `grumble` (returns isError: true). Anything else
 * gets a method-not-found, and notifications are correctly never answered.
 *
 * Run: bun src/kit/mcp/fake-server.fixture.mjs
 */
import { createInterface } from "node:readline";

const reply = (obj) => process.stdout.write(`${JSON.stringify(obj)}\n`);

const TOOLS = [
  {
    name: "echo",
    description: "Echo the text back.",
    inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  },
  {
    name: "grumble",
    description: "Always fails, so the error path is a real path.",
    inputSchema: { type: "object", properties: {} },
  },
  // Malformed on purpose: no name. A client must drop and COUNT this, never crash on it.
  { description: "nameless" },
];

const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  if (msg.id === undefined) return; // notification: silence is the correct answer

  if (msg.method === "initialize") {
    reply({
      jsonrpc: "2.0",
      id: msg.id,
      result: {
        protocolVersion: msg.params?.protocolVersion ?? "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "fake", version: "0.0.1" },
      },
    });
    return;
  }
  if (msg.method === "tools/list") {
    reply({ jsonrpc: "2.0", id: msg.id, result: { tools: TOOLS } });
    return;
  }
  if (msg.method === "tools/call") {
    const name = msg.params?.name;
    if (name === "echo") {
      const text = msg.params?.arguments?.text ?? "";
      reply({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: `echo: ${text}` }], isError: false } });
      return;
    }
    if (name === "grumble") {
      reply({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: "grumble: no." }], isError: true } });
      return;
    }
    reply({ jsonrpc: "2.0", id: msg.id, error: { code: -32602, message: `no tool ${String(name)}` } });
    return;
  }
  reply({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: `no method ${String(msg.method)}` } });
});

process.stdin.on("close", () => process.exit(0));
