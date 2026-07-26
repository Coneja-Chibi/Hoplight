/** OpenTUI test harness with React updates scoped to the interaction that caused them. */
import {
  createTestRenderer,
  type TestRendererOptions,
  type TestRendererSetup,
} from "@opentui/core/testing";
import { createRoot } from "@opentui/react";
import { act, type ReactNode } from "react";

type MockInput = TestRendererSetup["mockInput"];
type AsyncRenderer = Omit<TestRendererSetup["renderer"], "destroy"> & {
  destroy(): Promise<void>;
};
type RenderSetup = Omit<TestRendererSetup, "renderer"> & { renderer: AsyncRenderer };

const setActEnvironment = (enabled: boolean): void => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = enabled;
};

const actSync = (callback: () => void): void => {
  setActEnvironment(true);
  try {
    void act(callback);
  } finally {
    setActEnvironment(false);
  }
};

const actAsync = async (callback: () => Promise<void>): Promise<void> => {
  setActEnvironment(true);
  try {
    await act(callback);
  } finally {
    setActEnvironment(false);
  }
};

const wrapInput = (input: MockInput): MockInput => ({
  ...input,
  pressKeys: (keys, delayMs) => actAsync(() => input.pressKeys(keys, delayMs)),
  pressKey: (key, modifiers) => actSync(() => input.pressKey(key, modifiers)),
  typeText: (text, delayMs) => actAsync(() => input.typeText(text, delayMs)),
  pressEnter: (modifiers) => actSync(() => input.pressEnter(modifiers)),
  pressEscape: (modifiers) => actSync(() => input.pressEscape(modifiers)),
  pressTab: (modifiers) => actSync(() => input.pressTab(modifiers)),
  pressBackspace: (modifiers) => actSync(() => input.pressBackspace(modifiers)),
  pressArrow: (direction, modifiers) => actSync(() => input.pressArrow(direction, modifiers)),
  pressCtrlC: () => actSync(() => input.pressCtrlC()),
  pasteBracketedText: (text) => actAsync(() => input.pasteBracketedText(text)),
});

export const runRenderUpdate = (callback: () => void): void => actSync(callback);

export const settleRender = (ms = 60): Promise<void> =>
  actAsync(() => new Promise((resolve) => setTimeout(resolve, ms)));

export const testRender = async (
  node: ReactNode,
  options: TestRendererOptions,
): Promise<RenderSetup> => {
  let root: ReturnType<typeof createRoot> | null = null;
  try {
    setActEnvironment(true);
    const setup = await createTestRenderer(options);
    root = createRoot(setup.renderer);
    await act(async () => root?.render(node));
    const destroy = setup.renderer.destroy.bind(setup.renderer);
    setup.renderer.destroy = async () => {
      await actAsync(async () => {
        root?.unmount();
        root = null;
      });
      destroy();
    };
    setup.mockInput = wrapInput(setup.mockInput);
    const resize = setup.resize;
    setup.resize = (width, height) => actSync(() => resize(width, height));
    return setup as unknown as RenderSetup;
  } finally {
    setActEnvironment(false);
  }
};
