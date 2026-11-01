/**
 * Who is actually answering on a port.
 *
 * BINDING IS NOT OWNING. A process already bound to `0.0.0.0:8321` does not stop a second bind on
 * `127.0.0.1:8321` from succeeding on Windows - the call returns a server object, and the original
 * wildcard socket goes on answering every request. Nothing throws, so nothing downstream can tell.
 *
 * That is not hypothetical: a stray `npx http-server -p 8321` sat on the studio's default port, the
 * studio reported itself up on 8321, and the browser was served a directory listing. Every layer
 * behaved: the bind succeeded, the fetch succeeded, the page rendered. It was simply not our server.
 *
 * So the question "is this port mine" is only answerable by asking the port. `/api/version` is the
 * cheapest thing the studio serves that nothing else would answer in our shape.
 */

import { APP_PRODUCT } from "../version";

/**
 * Start the studio on the first port it can actually have.
 *
 * TWO DIFFERENT FAILURES, and only one of them throws. A port already held usually refuses the bind,
 * which is the easy case: step to the next one. The other is a bind that succeeds while something
 * else is the one answering - unfalsifiable from inside the process, so each candidate is asked who
 * it is and released if the answer is not ours.
 *
 * Exhausting the range is a real failure and rethrows, because silently serving nothing is worse
 * than saying the range is full.
 */
export async function claimPort<T extends { instanceId: string; stop: () => void; close?: () => Promise<void> }>(
  from: number,
  tries: number,
  start: (port: number) => T,
): Promise<{ server: T; port: number }> {
  for (let port = from; port < from + tries; port += 1) {
    const last = port === from + tries - 1;
    let attempt: T;
    try {
      attempt = start(port);
    } catch (error) {
      if (last) throw error;
      continue;
    }
    if (attempt.instanceId && await runningHoplightAt(port, undefined, attempt.instanceId)) return { server: attempt, port };
    attempt.stop();
    await attempt.close?.();
    if (last) throw new Error(`ports ${from}-${port} are held by something that is not Hoplight`);
  }
  throw new Error(`no free port between ${from} and ${from + tries - 1}`);
}

/** The studio's URL if a Hoplight is answering here, else null. Never throws. */
export async function runningHoplightAt(port: number, signal?: AbortSignal, instanceId?: string): Promise<string | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/version`, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(1500)]) : AbortSignal.timeout(1500), redirect: "error" });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    return body !== null && typeof body === "object" && "product" in body &&
      body.product === APP_PRODUCT && "version" in body && typeof body.version === "string" &&
      (instanceId === undefined || ("instanceId" in body && body.instanceId === instanceId))
      ? `http://127.0.0.1:${port}` : null;
  } catch {
    return null;
  }
}

/** Reuse only this product, otherwise start and verify the next bounded candidate. */
export async function claimStudio(
  from: number,
  tries: number,
  start: (port: number) => { instanceId: string; stop: () => void },
  reuse = true,
): Promise<{ url: string; stop: () => void }> {
  for (let port = from; port < from + tries; port++) {
    const existing = await runningHoplightAt(port);
    if (existing) {
      if (!reuse) throw new Error(`Hoplight is already running on requested port ${port}`);
      return { url: existing, stop: () => {} };
    }
    let attempt: { instanceId: string; stop: () => void };
    try { attempt = start(port); } catch { continue; }
    const url = attempt.instanceId ? await runningHoplightAt(port, undefined, attempt.instanceId) : null;
    if (url) return { url, stop: () => attempt.stop() };
    attempt.stop();
    if (reuse) {
      const existing = await runningHoplightAt(port);
      if (existing) return { url: existing, stop: () => {} };
    }
  }
  throw new Error(`no Hoplight port available between ${from} and ${from + tries - 1}`);
}

/** An explicit desktop port is isolated; absence retains the default bounded search. */
export function desktopPortOverride(value: string | undefined): number | null {
  if (value === undefined) return null;
  if (!/^[0-9]{1,5}$/.test(value) || Number(value) < 1024 || Number(value) > 65535) {
    throw new Error("HOPLIGHT_PORT must be a decimal port from 1024 to 65535");
  }
  return Number(value);
}

/** Return the actual identified address, never merely a busy candidate. */
export async function findRunningStudio(from: number, tries: number, signal?: AbortSignal): Promise<string | null> {
  for (let port = from; port < from + tries; port++) {
    signal?.throwIfAborted();
    const url = await runningHoplightAt(port, signal);
    if (url) return url;
  }
  return null;
}
