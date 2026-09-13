/**
 * The ST QuickReply-set codec: detection against the qrList marker, the four first-classed fields,
 * per-row and set-level escrow, and semantic JSON round trips.
 */
import { describe, expect, test } from "bun:test";
import codec from "./quickreply";
import type { CanonicalQuickReplySet } from "../../entities/quickreply/schema";

/** The shape ST's Quick Reply extension actually exports (v2), auto-execute switches included. */
const WIRE = {
  version: 2,
  name: "Astral Buttons",
  disableSend: false,
  placeBeforeInput: false,
  injectInput: false,
  color: "rgba(0, 0, 0, 0)",
  onlyBorderColor: false,
  qrList: [
    {
      id: 1,
      showLabel: true,
      label: "Reading",
      title: "",
      message: "/send take a reading | /trigger",
      contextList: [],
      preventAutoExecute: true,
      isHidden: false,
      executeOnStartup: false,
      executeOnUser: false,
      executeOnAi: false,
      executeOnChatChange: false,
      executeOnGroupMemberDraft: false,
      executeOnNewChat: false,
      automationId: "",
    },
    {
      id: 2,
      showLabel: false,
      label: "",
      title: "Roll the dice",
      message: "/roll 1d20",
      contextList: [],
      preventAutoExecute: true,
      isHidden: true,
      executeOnStartup: false,
      executeOnUser: false,
      executeOnAi: false,
      executeOnChatChange: false,
      executeOnGroupMemberDraft: false,
      executeOnNewChat: false,
      automationId: "",
    },
  ],
  idIndex: 2,
};

const asInput = (json: unknown) => ({ text: JSON.stringify(json), filename: "Astral Buttons.json" });

describe("detection", () => {
  test("claims a QuickReply set and nothing else", () => {
    expect(codec.detect(asInput(WIRE))).toBeGreaterThanOrEqual(0.9);
    // Things that live one field away must not be claimed.
    expect(codec.detect(asInput({ name: "x", entries: [] }))).toBe(0);
    expect(codec.detect(asInput({ qrList: [{ label: "a" }] }))).toBe(0); // no name
    expect(codec.detect(asInput([{ findRegex: "a" }]))).toBe(0); // a regex array
    expect(codec.detect({ text: "not json" })).toBe(0);
  });
});

describe("import", () => {
  test("first-classes label/message/title/hidden and escrows every other switch per row", () => {
    const entity = codec.toCanonical(asInput(WIRE));
    expect(entity.kind).toBe("quickreply");
    expect(entity.id).toBe("astral-buttons");
    expect(entity.body.replies).toHaveLength(2);

    const [reading, roll] = entity.body.replies;
    expect(reading).toMatchObject({ id: "1", label: "Reading", message: "/send take a reading | /trigger" });
    // Empty title is absence, not "" - a set with no hover text serializes without the key.
    expect("title" in reading!).toBe(false);
    expect(reading!.extras).toMatchObject({ preventAutoExecute: true, showLabel: true });

    // The icon-only hidden row keeps its emptiness and its hidden flag.
    expect(roll).toMatchObject({ id: "2", label: "", title: "Roll the dice", hidden: true });

    // Set-level switches ride body.extras; name and qrList do not.
    expect(entity.body.extras).toMatchObject({ version: 2, disableSend: false, idIndex: 2 });
    expect(entity.body.extras).not.toHaveProperty("qrList");
  });
});

describe("export", () => {
  test("an untouched import round-trips the complete JSON value", () => {
    const entity = codec.toCanonical(asInput(WIRE));
    const out = codec.fromCanonical(entity);
    expect(JSON.parse(out.text!)).toEqual(WIRE);
  });

  test("an edited label lands in the wire while every unmodelled switch survives", () => {
    const entity = codec.toCanonical(asInput(WIRE));
    const edited: CanonicalQuickReplySet = {
      ...entity,
      body: {
        ...entity.body,
        replies: entity.body.replies.map((r, i) => (i === 0 ? { ...r, label: "Take a reading" } : r)),
      },
    };
    const back = JSON.parse(codec.fromCanonical(edited).text!) as typeof WIRE;
    expect(back.qrList[0]!.label).toBe("Take a reading");
    expect(back.qrList[0]!.preventAutoExecute).toBe(true);
    expect(back.qrList[0]!.id).toBe(1); // numeric ids go back as numbers
    expect(back.qrList[1]).toEqual(WIRE.qrList[1]);
  });

  test("a set built in the studio (no escrow) still writes a legal v2 wire", () => {
    const fresh: CanonicalQuickReplySet = {
      schemaVersion: "1",
      kind: "quickreply",
      id: "house-set",
      body: { name: "House Set", replies: [{ id: "1", label: "Go", message: "/send go" }] },
    } as CanonicalQuickReplySet;
    const wire = JSON.parse(codec.fromCanonical(fresh).text!) as Record<string, unknown>;
    expect(wire).toMatchObject({ version: 2, name: "House Set", idIndex: 1 });
    expect(Array.isArray(wire["qrList"])).toBe(true);
    // And it re-imports as itself: the loop is closed, not assumed.
    const again = codec.toCanonical({ text: JSON.stringify(wire), filename: "house.json" });
    expect(again.body.replies[0]).toMatchObject({ label: "Go", message: "/send go" });
  });

  test("removing a reply rebuilds the wire rather than re-emitting the stale escrow", () => {
    const entity = codec.toCanonical(asInput(WIRE));
    const cut: CanonicalQuickReplySet = {
      ...entity,
      body: { ...entity.body, replies: entity.body.replies.slice(0, 1) },
    };
    const back = JSON.parse(codec.fromCanonical(cut).text!) as { qrList: unknown[] };
    expect(back.qrList).toHaveLength(1);
  });
});
