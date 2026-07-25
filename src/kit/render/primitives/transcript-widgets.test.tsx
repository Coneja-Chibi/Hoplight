/** @jsxImportSource @opentui/react */
/** Rendered-frame proofs for the transcript's foldable and live status widgets. */
import { describe, expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { BackstageRow } from "./backstage-row";
import { SayLine } from "./say-line";
import { StatusRow } from "./status-row";
import { ThoughtRow } from "./thought-row";

const tick = (ms = 60): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe("transcript widgets", () => {
  test("SayLine renders the reply text", async () => {
    const rendered = await testRender(<SayLine text="You have 13 characters in your studio." />, {
      width: 60,
      height: 8,
    });
    try {
      await tick();
      const frame = await rendered.waitForFrame((value) => value.includes("13 characters"), {
        maxPasses: 300,
      });
      expect(frame).toContain("13 characters");
    } finally {
      await rendered.renderer.destroy();
    }
  });

  test("SayLine folds a settled long reply but never a live stream", async () => {
    const text = "a detailed answer ".repeat(100);
    const folded = await testRender(<SayLine text={text} open={false} onToggle={() => {}} />, {
      width: 72,
      height: 5,
    });
    try {
      await tick();
      const frame = folded.captureCharFrame();
      expect(frame).toContain("said");
      expect(frame).toContain("ctrl+o");
      expect(frame).not.toContain("a detailed answer");
    } finally {
      await folded.renderer.destroy();
    }

    const live = await testRender(<SayLine text={text} streaming open={false} />, {
      width: 72,
      height: 5,
    });
    try {
      await tick();
      expect(live.captureCharFrame()).toContain("a detailed answer");
    } finally {
      await live.renderer.destroy();
    }
  });

  test("ThoughtRow collapsed shows the invitation, open shows the thought", async () => {
    const rendered = await testRender(
      <ThoughtRow text="walk the sheets and compare" seconds={8} open={false} onToggle={() => {}} />,
      { width: 70, height: 4 },
    );
    try {
      await tick();
      const frame = await rendered.waitForFrame((value) => value.includes("rehearsed"), {
        maxPasses: 300,
      });
      expect(frame).toContain("rehearsed for 8s");
      expect(frame).toContain("ctrl+o");
      expect(frame).not.toContain("walk the sheets");
    } finally {
      await rendered.renderer.destroy();
    }
  });

  test("BackstageRow collapsed shows the fold invitation, not the moves", async () => {
    const rendered = await testRender(
      <BackstageRow
        moves={["list character: 13", "read character: Basil"]}
        seconds={6}
        phase="completed"
        open={false}
        onToggle={() => {}}
      />,
      { width: 72, height: 4 },
    );
    try {
      await tick();
      const frame = await rendered.waitForFrame((value) => value.includes("Backstage"), {
        maxPasses: 300,
      });
      expect(frame).toContain("Backstage · 2 moves · verified · 6s");
      expect(frame).toContain("ctrl+o");
      expect(frame).toContain("verified");
      expect(frame).not.toContain("read character");
    } finally {
      await rendered.renderer.destroy();
    }
  });

  test("StatusRow has a stage verb and clock, not a provider name", async () => {
    const rendered = await testRender(<StatusRow startedAt={Date.now() - 65000} />, {
      width: 60,
      height: 4,
    });
    try {
      await tick();
      const frame = await rendered.waitForFrame((value) => value.includes("1:0"), {
        maxPasses: 300,
      });
      const verbs = ["cueing", "rifling", "staging", "rehearsing", "consulting"];
      expect(verbs.some((verb) => frame.includes(verb))).toBe(true);
      expect(frame).toContain("1:0");
      expect(frame).not.toContain("NanoGPT");
    } finally {
      await rendered.renderer.destroy();
    }
  });
});
