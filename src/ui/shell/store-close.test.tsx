/** Shell close-flow regression: dirty editor tabs require an explicit discard decision. */
import { beforeEach, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ClosePiecePrompt } from "./ClosePieceDialog";
import { useShellStore } from "./store";

const piece = { id: "aria", kind: "character", name: "Aria" };

beforeEach(() => {
  useShellStore.setState({
    openPieces: [piece],
    activeKey: "character:aria",
    splitKey: "",
    dirtyPieces: { "character:aria": true },
    pendingClose: null,
  });
});

test("requesting a dirty close keeps the tab open until discard is confirmed", () => {
  useShellStore.getState().requestPieceClose(piece.id, piece.kind);

  expect(useShellStore.getState().openPieces).toEqual([piece]);
  expect(useShellStore.getState().pendingClose).toEqual(piece);

  useShellStore.getState().answerPieceClose(false);
  expect(useShellStore.getState().openPieces).toEqual([piece]);
  expect(useShellStore.getState().pendingClose).toBeNull();

  useShellStore.getState().requestPieceClose(piece.id, piece.kind);
  useShellStore.getState().answerPieceClose(true);
  expect(useShellStore.getState().openPieces).toEqual([]);
  expect(useShellStore.getState().dirtyPieces).toEqual({});
});

test("requesting a clean close removes the tab without opening the dialog", () => {
  useShellStore.setState({ dirtyPieces: {} });
  useShellStore.getState().requestPieceClose(piece.id, piece.kind);
  expect(useShellStore.getState().openPieces).toEqual([]);
  expect(useShellStore.getState().pendingClose).toBeNull();
});

test("dirty close renders explicit keep and discard controls", () => {
  const markup = renderToStaticMarkup(
    <ClosePiecePrompt name="Aria" onDiscard={() => undefined} onKeep={() => undefined} />,
  );
  expect(markup).toContain("Discard changes");
  expect(markup).toContain("Keep editing");
  expect(markup).toContain("Aria has unsaved changes");
});
