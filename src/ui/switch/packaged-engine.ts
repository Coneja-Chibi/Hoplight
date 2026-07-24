/**
 * Packaged-build switch engine. Fetches the target release, picks the asset that matches THIS binary,
 * downloads it (https + GitHub-host allowlist on the URL AND every redirect hop, size cap, deadline),
 * verifies it against the release's own SHA256SUMS, and stages it beside the running exe.
 *
 * It then opens the staged folder rather than swapping the RUNNING executable underneath itself. That
 * auto-swap is the one path that can brick an install and cannot be live-tested from here, so per the
 * safety review it is deferred to its own real-install-tested change; this safe path never risks the
 * user's install and still does the whole download+verify for them. Fails CLOSED at every uncertainty
 * (no asset for this platform, no checksum, unwritable folder, corrupt download).
 */
import { basename, dirname, join } from "node:path";
import { access, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { isAllowedDownloadHost, resolveAsset } from "../_shared/release-download";
import { openPath } from "../server-security";
import type { SwitchAction } from "./manager";

const RELEASE_TAG_API = (tag: string): string =>
  `https://api.github.com/repos/Coneja-Chibi/Hoplight/releases/tags/${tag}`;
const MAX_DOWNLOAD_BYTES = 250 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_REDIRECTS = 5;

export interface PackagedSwitchDeps {
  onProgress?: (message: string) => void;
}

interface Asset {
  name: string;
  url: string;
}

/** Fetch the target release and its assets from GitHub (fixed host, no caller input in host/path). */
async function fetchReleaseAssets(tag: string): Promise<Asset[]> {
  const res = await fetch(RELEASE_TAG_API(tag), {
    signal: AbortSignal.timeout(15000),
    headers: { accept: "application/vnd.github+json", "user-agent": "hoplight-update-check" },
  });
  if (res.status !== 200) throw new Error(`switch: could not read release ${tag} (${res.status}).`);
  const body = (await res.json().catch(() => null)) as { assets?: unknown } | null;
  const raw = Array.isArray(body?.assets) ? body!.assets : [];
  return raw
    .map((a): Asset | null => {
      if (typeof a !== "object" || a === null) return null;
      const rec = a as Record<string, unknown>;
      const name = typeof rec.name === "string" ? rec.name : "";
      const url = typeof rec.browser_download_url === "string" ? rec.browser_download_url : "";
      return name && url ? { name, url } : null;
    })
    .filter((a): a is Asset => a !== null);
}

/** Download a GitHub release URL, allowlisting the host at the URL and each redirect hop, capped + timed. */
async function downloadAllowed(url: string, onProgress?: (m: string) => void): Promise<Uint8Array> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isAllowedDownloadHost(current)) throw new Error("switch: refused a download from an unexpected host.");
    const res = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error("switch: a redirect had no destination.");
      current = new URL(loc, current).href;
      continue;
    }
    if (res.status !== 200 || !res.body) throw new Error(`switch: download failed (${res.status}).`);
    return readCapped(res.body, MAX_DOWNLOAD_BYTES, onProgress);
  }
  throw new Error("switch: too many redirects.");
}

/** Read a stream into memory with a hard byte cap (a runaway download never eats all memory/disk). */
async function readCapped(
  stream: ReadableStream<Uint8Array>,
  limit: number,
  onProgress?: (m: string) => void,
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > limit) throw new Error("switch: the download was larger than expected; stopped.");
    chunks.push(value);
    onProgress?.(`Downloading... ${(total / (1024 * 1024)).toFixed(0)} MB`);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

/** Pull the expected sha256 for `name` out of a SHA256SUMS file ("<hex>  <name>" per line). */
function expectedSum(sumsText: string, name: string): string | null {
  for (const line of sumsText.split(/\r?\n/)) {
    const m = /^([0-9a-f]{64})\s+\*?(.+)$/.exec(line.trim());
    if (m && m[2] === name) return m[1]!;
  }
  return null;
}

/**
 * Prepare a packaged switch to `tag`: resolve+download+verify+stage the build for this binary. Resolves
 * with a "manual" action (there is nothing to auto-restart, the user runs the downloaded build). Throws a
 * user-facing message on any refusal (no matching asset, no checksum, unwritable dir, corrupt download).
 */
export async function packagedSwitch(tag: string, deps: PackagedSwitchDeps): Promise<SwitchAction> {
  const onProgress = deps.onProgress ?? ((): void => {});
  const exeName = basename(process.execPath);
  const exeDir = dirname(process.execPath);

  onProgress("Finding the download for your system...");
  const assets = await fetchReleaseAssets(tag);
  const assetName = resolveAsset(
    assets.map((a) => a.name),
    exeName,
  );
  if (!assetName) {
    throw new Error(`switch: ${tag} has no build named ${exeName} for your system; open the release page to download it.`);
  }
  const asset = assets.find((a) => a.name === assetName)!;
  const sums = assets.find((a) => a.name === "SHA256SUMS");
  if (!sums) throw new Error(`switch: ${tag} has no checksum file; refusing to install an unverified build.`);

  const stageDir = join(exeDir, ".hoplight-update");
  try {
    await mkdir(stageDir, { recursive: true });
    await access(stageDir);
  } catch {
    throw new Error("switch: cannot write next to Hoplight (a protected folder); download the update manually.");
  }

  onProgress(`Downloading ${tag}...`);
  const bytes = await downloadAllowed(asset.url, onProgress);
  onProgress("Verifying the download...");
  const sumsText = new TextDecoder().decode(await downloadAllowed(sums.url));
  const expected = expectedSum(sumsText, assetName);
  const got = createHash("sha256").update(bytes).digest("hex");
  if (!expected || got !== expected) {
    throw new Error("switch: the download did not match its published checksum; it was discarded.");
  }

  const staged = join(stageDir, assetName);
  await writeFile(staged, bytes);
  openPath(stageDir);
  return {
    kind: "manual",
    message: `Downloaded and verified ${tag} into the opened folder. Close Hoplight and run the new ${assetName} to finish.`,
  };
}
