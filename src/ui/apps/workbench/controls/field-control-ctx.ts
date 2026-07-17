/**
 * Shared FieldCtx / FieldControlApi types for the field-control family.
 * Kept separate so composite body modules can import types without cycles.
 */
import type { JSX, ReactNode } from "react";
import type { FieldModule } from "../fields";

export interface FieldCtx {
  draft: unknown;
  setField(path: string, value: unknown): void;
  styles: Readonly<Record<string, string>>;
  /** the gradient/palette composites are built in the shell (canonical routing) and injected */
  gradientBody: JSX.Element;
  paletteBody: JSX.Element;
  /** the portrait card (the `portrait` kind returns it) */
  leftCard: ReactNode;
  /** when a variant is active: remove override at path ("Use base") */
  inheritField?: (path: string) => void;
  /** when a variant is active: true if the path is currently overridden */
  hasOverride?: (path: string) => boolean;
  /** true while a variant (not Base) is selected */
  variantActive?: boolean;
}

export interface FieldControlApi {
  controlFor(m: FieldModule): JSX.Element;
  /** exposed for the quiz presenter's answerFor */
  proseBody(id: string, path: string): JSX.Element;
}
