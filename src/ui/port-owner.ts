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
export async function claimPort<T extends { stop: () => void }>(
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
    if (await runningHoplightAt(port)) return { server: attempt, port };
    attempt.stop();
    if (last) throw new Error(`ports ${from}-${port} are held by something that is not Hoplight`);
  }
  throw new Error(`no free port between ${from} and ${from + tries - 1}`);
}

/** The studio's URL if a Hoplight is answering here, else null. Never throws. */
export async function runningHoplightAt(port: number): Promise<string | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/version`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return null;
    const body = (await res.json()) as { version?: unknown };
    return typeof body.version === "string" ? `http://127.0.0.1:${port}` : null;
  } catch {
    return null;
  }
}
