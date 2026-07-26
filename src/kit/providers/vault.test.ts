/** Provider-vault round trips and environment fallback against isolated storage. */
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { vaultPath } from "./config";
import {
  activeProvider,
  readVault,
  removeProvider,
  resolveProviderConfig,
  saveProvider,
} from "./vault";

const HOME = join(tmpdir(), `kit-vault-test-${randomUUID()}`);
const UNLOCK = { passphrase: "kit-vault-test-passphrase" };

// DPAPI seals spawn PowerShell (~1s cold); give the write-heavy cases room.
setDefaultTimeout(30000);

beforeAll(() => {
  process.env.HOPLIGHT_HOME = HOME;
});

afterAll(async () => {
  delete process.env.HOPLIGHT_HOME;
  await rm(HOME, { recursive: true, force: true });
});

describe("vault", () => {
  test("no vault yet reads empty", async () => {
    expect(await readVault(UNLOCK)).toEqual({ providers: [], activeId: null });
  });

  test("save then read returns the provider, and the key is not on disk in the clear", async () => {
    const saved = await saveProvider(
      { kind: "anthropic", model: "claude-opus-4-8", apiKey: "sk-secret-xyz" },
      UNLOCK,
    );
    expect(saved.id).toBeTruthy();

    const active = await activeProvider(UNLOCK);
    expect(active?.kind).toBe("anthropic");
    expect(active?.apiKey).toBe("sk-secret-xyz");

    const raw = await Bun.file(vaultPath()).text();
    expect(raw).not.toContain("sk-secret-xyz");
    expect(raw).not.toContain("anthropic");
  });

  test("a second provider replaces active; remove reassigns it", async () => {
    const first = (await activeProvider(UNLOCK))!;
    const second = await saveProvider(
      { kind: "openai", model: "gpt-4o", apiKey: "sk-two" },
      UNLOCK,
    );
    expect((await activeProvider(UNLOCK))?.id).toBe(second.id);

    await removeProvider(second.id!, UNLOCK);
    expect((await activeProvider(UNLOCK))?.id).toBe(first.id);
  });

  test("with no active provider, resolve falls back to an env var", async () => {
    const prev = process.env.HOPLIGHT_HOME;
    process.env.HOPLIGHT_HOME = join(tmpdir(), `kit-vault-env-${randomUUID()}`);
    process.env.ANTHROPIC_API_KEY = "env-key-123";
    try {
      const cfg = await resolveProviderConfig();
      expect(cfg?.apiKey).toBe("env-key-123");
      expect(cfg?.kind).toBe("anthropic");
    } finally {
      delete process.env.ANTHROPIC_API_KEY;
      process.env.HOPLIGHT_HOME = prev;
    }
  });
});
