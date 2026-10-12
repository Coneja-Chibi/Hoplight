/**
 * Mount the Workbench's shared greeting control and click its real Add/Remove buttons.
 * Blank rows are editable drafts, not deletions. Both registered greeting paths must retain them.
 * Edit callbacks are checked directly: the shared Bun process may cache react-dom before a DOM exists,
 * so these checks do not claim browser text-input delivery or shim React's input behavior.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act, Children, isValidElement, useState, type JSX, type ReactElement, type ReactNode } from "react";
import type { Root } from "react-dom/client";
import { FIELD_MODULES, type FieldModule } from "../fields";
import { readPath, writePath } from "../editor-core";

const styles = { greetRow: "greeting-row", add: "greeting-add", rm: "greeting-remove" };
const globalKeys = [
  "window", "document", "navigator", "Element", "HTMLElement", "HTMLInputElement",
  "HTMLTextAreaElement", "Node", "Event", "DOMParser", "IS_REACT_ACT_ENVIRONMENT",
] as const;
// DOMPurify retains its first window even after globals are restored. Keep it alive for cached
// modules, as render-markup.test.ts does; only mounted roots and hosts belong to an individual test.
const dom = new JSDOM("<!doctype html><html><body></body></html>");
let host: HTMLElement;
let root: Root | undefined;
let globals: Map<string, PropertyDescriptor | undefined>;
let initial: Record<string, unknown>;
let draft: Record<string, unknown>;
let field: FieldModule;
let control: JSX.Element;
let makeControlFor: typeof import("./field-control")["makeControlFor"];

beforeEach(async () => {
  globals = new Map(globalKeys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.assign(globalThis, Object.fromEntries(globalKeys.map((key) => [
    key, key === "IS_REACT_ACT_ENVIRONMENT" ? true : dom.window[key as keyof typeof dom.window],
  ])));
  ({ makeControlFor } = await import("./field-control"));
  host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
});

afterEach(async () => {
  try {
    if (root) await act(async () => root!.unmount());
  } finally {
    root = undefined;
    host?.remove();
    for (const [key, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

function Harness(): JSX.Element {
  const [body, setBody] = useState(initial);
  draft = body;
  control = makeControlFor({
    draft: body,
    setField: (path, value) => setBody((current) => writePath(current, path, value)),
    styles,
    gradientBody: <></>,
    paletteBody: <></>,
    leftCard: null,
  }).controlFor(field);
  return control;
}

async function mount(module: FieldModule, body: Record<string, unknown>): Promise<void> {
  field = module;
  initial = body;
  const { createRoot } = await import("react-dom/client");
  root = createRoot(host);
  await act(async () => root!.render(<Harness />));
}

async function click(selector: string): Promise<void> {
  const button = host.querySelector<HTMLButtonElement>(selector);
  expect(button).not.toBeNull();
  await act(async () => button!.click());
}

type EditKind = "text" | "title";
type ControlProps = {
  children?: ReactNode;
  placeholder?: string;
  // Only the argument these edit callbacks read, not a fabricated browser or SyntheticEvent.
  onChange?: (input: { target: { value: string } }) => void;
};

/** Walk the factory's real JSX without rendering components or accessing React's private fibers. */
function elementsIn(node: ReactNode): ReactElement<ControlProps>[] {
  return Children.toArray(node).flatMap((child) => {
    if (!isValidElement<ControlProps>(child)) return [];
    return [child, ...elementsIn(child.props.children)];
  });
}

/** Invoke the current factory callback and let the mounted harness commit its real draft update. */
async function edit(kind: EditKind, value: string): Promise<void> {
  const { ExpandTextarea } = await import("../../../components/expand");
  const element = elementsIn(control).find((entry) => kind === "title"
    ? entry.type === "input" && entry.props.placeholder === "optional title"
    : entry.type === ExpandTextarea);
  expect(element?.props.onChange).toBeTypeOf("function");
  await act(async () => element!.props.onChange!({ target: { value } }));
}

const greetingFields = FIELD_MODULES.filter((entry) => entry.kind === "greetings");

test("the shared control covers alternate and group-only greetings", () => {
  expect(greetingFields.map((entry) => entry.path)).toEqual([
    "greetings.alternateGreetings", "greetings.groupOnlyGreetings",
  ]);
});

for (const module of greetingFields) {
  describe(module.path, () => {
    test("Add creates a blank editable row when the list is absent", async () => {
      await mount(module, { greetings: { firstMessage: "Original opening" } });
      await click(".greeting-add");

      expect(readPath(draft, module.path)).toEqual([{ text: "" }]);
      expect(host.querySelectorAll(".greeting-row textarea")).toHaveLength(1);
      expect(host.querySelector<HTMLInputElement>('input[placeholder="optional title"]')?.value).toBe("");
      expect(readPath(draft, "greetings.firstMessage")).toBe("Original opening");
    });

    test("repeated Add retains every blank row", async () => {
      await mount(module, writePath({ greetings: {} }, module.path, []));
      await click(".greeting-add");
      await click(".greeting-add");

      expect(readPath(draft, module.path)).toEqual([{ text: "" }, { text: "" }]);
      expect(host.querySelectorAll(".greeting-row textarea")).toHaveLength(2);
    });

    test("Add preserves existing content and sibling fields", async () => {
      const existing = { text: "Existing greeting", title: "Existing title", id: "original-id" };
      const siblingPath = greetingFields.find((entry) => entry.path !== module.path)!.path;
      const body = writePath(writePath({
        identity: { name: "Original name" },
        greetings: { firstMessage: "Original opening" },
        examples: { exampleMessages: "Original examples" },
      }, siblingPath, [{ text: "Sibling greeting", id: "sibling-id" }]), module.path, [existing]);
      const original = structuredClone(body);
      await mount(module, body);
      expect(host.querySelector(".greeting-row p")?.textContent).toBe(existing.text);
      await click(".greeting-add");

      expect(host.querySelector(".greeting-row p")?.textContent).toBe(existing.text);
      expect(readPath(draft, module.path)).toEqual([existing, { text: "" }]);
      expect(readPath(draft, siblingPath)).toEqual(readPath(original, siblingPath));
      expect(readPath(draft, "greetings.firstMessage")).toBe("Original opening");
      expect(draft.identity).toEqual(original.identity);
      expect(draft.examples).toEqual(original.examples);
      expect(body).toEqual(original);
    });

    for (const first of ["text", "title"] as const) {
      const second = first === "text" ? "title" : "text";
      test(`edit handlers retain the row when clearing ${first} then ${second}`, async () => {
        // No id: an id-bearing row would survive the old blank-row filter and hide the regression.
        const body = writePath({ greetings: { firstMessage: "Original opening" } }, module.path, [{ text: "" }]);
        const original = structuredClone(body);
        await mount(module, body);

        await edit("text", "Edited greeting");
        expect(readPath(draft, module.path)).toEqual([{ text: "Edited greeting" }]);
        expect(host.querySelector(".greeting-row p")?.textContent).toBe("Edited greeting");
        await edit("title", "Edited title");
        expect(readPath(draft, module.path)).toEqual([{ text: "Edited greeting", title: "Edited title" }]);
        expect(host.querySelector<HTMLInputElement>('input[placeholder="optional title"]')?.value).toBe("Edited title");

        await edit(first, "");
        expect(readPath(draft, module.path)).toEqual([{
          text: first === "text" ? "" : "Edited greeting",
          title: first === "title" ? undefined : "Edited title",
        }]);
        await edit(second, "");
        expect(readPath(draft, module.path)).toEqual([{ text: "" }]);
        expect(host.querySelectorAll(".greeting-row textarea")).toHaveLength(1);
        expect(host.querySelector<HTMLTextAreaElement>(".greeting-row textarea")?.value).toBe("");
        expect(host.querySelector<HTMLInputElement>('input[placeholder="optional title"]')?.value).toBe("");
        expect(readPath(draft, "greetings.firstMessage")).toBe("Original opening");
        expect(body).toEqual(original);

        await edit("text", "Rewritten greeting");
        expect(readPath(draft, module.path)).toEqual([{ text: "Rewritten greeting" }]);
        expect(host.querySelector(".greeting-row p")?.textContent).toBe("Rewritten greeting");
      });
    }

    test("Remove leaves other blank rows editable", async () => {
      await mount(module, writePath({ greetings: {} }, module.path, [
        { text: "Existing greeting", id: "original-id" }, { text: "" }, { text: "" },
      ]));
      await click(".greeting-remove");

      expect(readPath(draft, module.path)).toEqual([{ text: "" }, { text: "" }]);
      expect(host.querySelectorAll(".greeting-row textarea")).toHaveLength(2);
    });

    test("Remove deletes the final blank row", async () => {
      await mount(module, writePath({ greetings: { firstMessage: "Original opening" } }, module.path, [{ text: "" }]));
      await click(".greeting-remove");

      expect(readPath(draft, module.path)).toBeUndefined();
      expect(host.querySelectorAll(".greeting-row")).toHaveLength(0);
      expect(readPath(draft, "greetings.firstMessage")).toBe("Original opening");
    });
  });
}
