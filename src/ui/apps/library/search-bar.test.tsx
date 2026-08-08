/**
 * The search chrome's one load-bearing claim: a shelf filtered to nothing must not render as a
 * shelf nobody has put anything in.
 *
 * The ranking lives in search-core and is tested there. What is checked here is the SENTENCE, since
 * the whole reason this notice exists instead of the ghost card is the words on it.
 */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { NoMatchNotice, SearchBox } from "./search-bar";

const notice = (over: Partial<Parameters<typeof NoMatchNotice>[0]> = {}): string =>
  renderToStaticMarkup(
    <NoMatchNotice
      query="kind:preset war"
      deckPlural="Presets"
      deckTotal={142}
      elsewhere={[{ kind: "lorebook", count: 3 }]}
      onJump={() => {}}
      onClear={() => {}}
      {...over}
    />,
  );

test("the no-match notice says the pieces are STILL THERE, with the count", () => {
  // The ghost card says "your first preset lands here", which over a full deck is a small lie and
  // an invitation to import something somebody already owns.
  const html = notice();
  expect(html).toContain("No presets match");
  expect(html).toContain("All 142 presets are still in the studio");
  expect(html).toContain("filtered, not bare");
  expect(html).not.toContain("lands here");
});

test("it echoes back exactly what was searched, so there is no doubt what was asked", () => {
  expect(notice({ query: '"blue eyes" -has:art' })).toContain("&quot;blue eyes&quot; -has:art");
});

test("it points at the deck that DOES match, by name and count", () => {
  // The whole reason search runs over the studio and not just the open shelf: "I cannot remember
  // which deck I put it on" is the question, and an empty shelf is not an answer to it.
  const html = notice();
  expect(html).toContain("Lorebooks 3");
  expect(html).toContain("also matching");
});

test("with nothing matching anywhere, no jumps are offered rather than an empty row", () => {
  const html = notice({ elsewhere: [] });
  expect(html).not.toContain("also matching");
  expect(html).toContain("Clear search");
});

test("the box shows a clear control only once there is something to clear", () => {
  expect(renderToStaticMarkup(<SearchBox value="" onChange={() => {}} hint="" />)).not.toContain("findx");
  expect(renderToStaticMarkup(<SearchBox value="war" onChange={() => {}} hint="" />)).toContain("findx");
});

test("the parser's complaint is shown, never swallowed", () => {
  // A box that silently reinterprets what somebody typed teaches them to stop trusting it.
  const html = renderToStaticMarkup(<SearchBox value="colour:blue" onChange={() => {}} hint="colour: is not a field" />);
  expect(html).toContain("colour: is not a field");
});
