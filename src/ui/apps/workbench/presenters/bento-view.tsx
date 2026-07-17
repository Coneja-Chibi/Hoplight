/**
 * BentoView - the masonry presenter: three fixed columns (face + sealed rail | everything you write |
 * presentation + meta), one card per field-group. The LAYOUT is data here (each column's ordered cards,
 * named by their module ids through the injected `bcard`). Twin native cards append to middle/right
 * only (columns[0] stays empty so the sticky left face is never buried). All three columns sticky:
 * when one runs out of content the other keeps scrolling (no independent column scrollbars).
 * Same FIELD_MODULES as playbill; different arrangement only. Pure layout, no state.
 */
import type { JSX, ReactNode } from "react";

export interface BentoViewProps {
  /** builds one titled card from module ids (null when the lens hides every field in it) */
  bcard(title: string, ids: readonly string[]): JSX.Element | null;
  leftCard: ReactNode;
  sealedCard: ReactNode;
  macroCard: ReactNode;
  /** native cards bin-packed into the three columns */
  columns: [JSX.Element[], JSX.Element[], JSX.Element[]];
  /** the full-span row of big native cards under the grid */
  spanRow: JSX.Element | null;
  styles: Readonly<Record<string, string>>;
}

export function BentoView({ bcard, leftCard, sealedCard, macroCard, columns, spanRow, styles }: BentoViewProps): JSX.Element {
  return (
    <>
      <div className={styles.bento}>
        <div className={`${styles.bcol} ${styles.bcolLeft}`}>
          {leftCard}
          {sealedCard}
          {columns[0]}
        </div>
        <div className={styles.bcol}>
          {bcard("Identity", ["name", "tagline", "tags", "rating"])}
          {bcard("Casting Card", ["fullName", "title", "age", "pronouns", "nickname", "culture", "characterVersion"])}
          {bcard("Description", ["description"])}
          {bcard("Personality", ["personality"])}
          {bcard("Appearance", ["appearance"])}
          {bcard("Scenario", ["scenario"])}
          {bcard("Persona · Structured", ["structuredPersona"])}
          {bcard("System Prompt", ["systemPrompt"])}
          {bcard("Post-History", ["postHistoryInstructions"])}
          {bcard("Prefill", ["prefill"])}
          {bcard("Additional Text", ["additionalText"])}
          {bcard("Depth Injections", ["depthInjections"])}
          {bcard("First Message", ["firstMes"])}
          {bcard("Alt Greetings", ["alternateGreetings"])}
          {bcard("Group Greetings", ["groupOnlyGreetings"])}
          {bcard("Examples", ["mesExample"])}
          {columns[1]}
        </div>
        <div className={styles.bcol}>
          {bcard("Color Palette", ["gradient", "palette"])}
          {bcard("Default Background", ["background"])}
          {macroCard}
          {bcard("Spotlight Definitions", ["spotlight"])}
          {bcard("Discovery", ["genre", "fandom", "contentWarnings"])}
          {bcard("Voice", ["voice"])}
          {bcard("Image Prompt", ["imagePrompt"])}
          {bcard("Sprite", ["visualKind", "sprite"])}
          {bcard("Response Schema", ["responseSchema"])}
          {bcard("Media", ["mediaLinks"])}
          {bcard("Settings", ["talkativeness", "risuSettings"])}
          {bcard("Bias", ["bias"])}
          {bcard("Attribution", ["creator", "creatorNotes", "publicNote", "originalCreator", "source", "sourceUrl", "license", "creatorNotesMultilingual"])}
          {columns[2]}
        </div>
      </div>
      {spanRow}
    </>
  );
}
