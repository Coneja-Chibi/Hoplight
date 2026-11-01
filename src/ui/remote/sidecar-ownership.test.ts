/** Owned helper lifecycle never touches another product's process. */
import { expect, test } from "bun:test";
import { createSidecarManager } from "./sidecar-manager";
  test("enable launches only its helper; disable kills only the owned child and ignores stale output", async () => {
    const calls: string[][] = [];
    const exited = Promise.withResolvers<number>();
    let output!: ReadableStreamDefaultController<Uint8Array>;
    let kills = 0;
    const child = { stdout: new ReadableStream<Uint8Array>({ start(c) { output = c; } }), exited: exited.promise, kill: () => { kills++; exited.resolve(0); } };
    const spawn = ((argv: string[]) => {
      calls.push(argv);
      return argv[0] === "owned-helper" ? child : { exited: Promise.resolve(0) };
    }) as unknown as typeof Bun.spawn;
    const originalSpawn = Bun.spawn;
    Bun.spawn = spawn;
    const manager = createSidecarManager({ resolveBin: () => "owned-helper", spawn, untrustedUpstream: "127.0.0.1:8788", sharedSecret: "test", openUrl: () => undefined });
    try {
    manager.enable();
    await Promise.resolve();
    manager.enable();
    expect(calls.map((c) => c[0])).toEqual(["owned-helper"]);
    await manager.disable();
    output.enqueue(new TextEncoder().encode('{"event":"status","state":"running","dnsName":"test.ts.net"}\n'));
    output.close();
    await Promise.resolve();
    expect(kills).toBe(1);
    expect(manager.getState().phase).toBe("off");
    } finally { Bun.spawn = originalSpawn; }
  });
