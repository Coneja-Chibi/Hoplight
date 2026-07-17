/**
 * Probe where decoded triggerlua first fails wasmoon (syntax). Not shipped.
 * Run: bun scripts/rpack-lua-probe.ts [path.charx]
 */
import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { decodeRisum, listScriptEffects } from "../src/formats/risu/rpack";
import { runLua } from "../src/sandbox/lua/run";

const path = process.argv[2] ?? "C:/Users/chiev/Downloads/한국여자대학교 V1.0.charx";
const m = unzipSync(new Uint8Array(readFileSync(path)))["module.risum"]!;
const d = decodeRisum(m);
const code = listScriptEffects(d.module).find((s) => s.kind === "triggerlua")?.code ?? "";
const lines = code.split("\n");
console.log("chars", code.length, "lines", lines.length, "name", d.module.name);

const ok = async (n: number) => {
  const head = `${lines.slice(0, n).join("\n")}\nreturn 1\n`;
  return runLua(head, { deadlineMs: 4000 });
};

let lastOk = 0;
let firstBad = -1;
let lastMsg = "";
const probes = [5, 10, 20, 40, 60, 80, 100, 150, 200, 300, 500, 800, 1000, lines.length];
for (const n of probes) {
  if (n > lines.length) continue;
  const r = await ok(n);
  if (r.ok) {
    lastOk = n;
    console.log("ok", n);
  } else {
    firstBad = n;
    lastMsg = r.message;
    console.log("fail", n, r.message.slice(0, 140));
    break;
  }
}

if (firstBad > 0 && lastOk < firstBad) {
  let a = lastOk;
  let b = firstBad;
  while (b - a > 1) {
    const mid = (a + b) >> 1;
    const r = await ok(mid);
    if (r.ok) a = mid;
    else {
      b = mid;
      lastMsg = r.message;
    }
  }
  console.log("\nfirst failing line count:", b, "last ok:", a);
  console.log("msg:", lastMsg);
  console.log("--- context ---");
  for (let i = Math.max(0, a - 2); i < Math.min(lines.length, b + 8); i++) {
    const L = lines[i]!;
    const flag = /[^\x09\x0a\x0d\x20-\x7e]/.test(L) ? "!" : " ";
    console.log(String(i + 1).padStart(5), flag, JSON.stringify(L).slice(0, 140));
  }
} else if (firstBad < 0) {
  console.log("FULL FILE LOADS (return 1 appended)");
}
