/**
 * Native-field rendering for twin (original-bound) fields. Bento and playbill share the same item list
 * (nativeItemsFor); each layout wraps differently. Bento bin-packs into the *content* columns only
 * (middle + right) so the sticky portrait column stays face + sealed cargo. Playbill placement of
 * platform-hosted *body* modules lives in PlaybillView, not here.
 */
import type { JSX } from "react";
import {
  nativeFieldItems,
  type NativeFieldContext,
  type NativeFieldItem,
  type Stub,
} from "../../components/native-card";
import { BentoCard } from "../../components/bento-card";
import { MonoTag } from "../../components/mono-tag";
import { nativeSchemaFor } from "./platforms";
import styles from "./native-render.module.css";

/** Gather the native items for the selected/present platform keys, deduped, order = key order. */
export function nativeItemsFor(
  keys: readonly string[],
  read: (p: string) => unknown,
  write: (p: string, v: unknown) => void,
  openStub: (s: Stub) => void,
  ctx?: NativeFieldContext,
): NativeFieldItem[] {
  const seen = new Set<string>();
  const out: NativeFieldItem[] = [];
  for (const key of keys) {
    if (seen.has(key)) continue;
    seen.add(key);
    const schema = nativeSchemaFor(key);
    if (!schema) continue;
    out.push(...nativeFieldItems(schema, read, write, openStub, ctx));
  }
  return out;
}

/** one native field as a bento card, tagged with its platform pill */
const card = (item: NativeFieldItem): JSX.Element => (
  <BentoCard key={item.key} title={item.label} aff={<MonoTag dim>{item.platform}</MonoTag>}>
    {item.body}
  </BentoCard>
);

export interface NativeBentoParts {
  /**
   * Cards to append to each bento column.
   * Index 0 (portrait / sticky left) is always empty - twin fields never sit under the image.
   * Indices 1 and 2 are middle and right content columns.
   */
  columns: [JSX.Element[], JSX.Element[], JSX.Element[]];
  /** reserved; twin fields no longer full-span under the portrait grid */
  spanRow: JSX.Element | null;
}

/**
 * Bin-pack native twin cards into middle + right only. Left column stays free for the sticky face.
 * Big cards (trackers, assets, …) pack the same way as small ones - never a page-wide span under col 0.
 */
export function nativeBentoParts(items: NativeFieldItem[]): NativeBentoParts {
  // only content columns participate; balance by running weight
  const content = [
    { weight: 0, nodes: [] as JSX.Element[] },
    { weight: 0, nodes: [] as JSX.Element[] },
  ];
  for (const item of items) {
    const shortest = content[0]!.weight <= content[1]!.weight ? content[0]! : content[1]!;
    shortest.nodes.push(card(item));
    shortest.weight += item.weight;
  }
  return {
    columns: [[], content[0]!.nodes, content[1]!.nodes],
    spanRow: null,
  };
}

/** items grouped by platform, in first-seen order */
const byPlatform = (items: NativeFieldItem[]): [string, NativeFieldItem[]][] => {
  const map = new Map<string, NativeFieldItem[]>();
  for (const item of items) {
    const group = map.get(item.platform) ?? [];
    group.push(item);
    map.set(item.platform, group);
  }
  return [...map.entries()];
};

/** slug for a platform's playbill anchor, so the Bill nav can jump to it */
const anchor = (platform: string): string => `act-native-${platform.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

/**
 * Playbill platform leftovers: one section per platform (RC/ST pattern). Shared character fields are
 * never listed here - only native schema items. Big fields span the two-column grid.
 */
export function nativePlaybillSection(items: NativeFieldItem[]): JSX.Element | null {
  if (items.length === 0) return null;
  return (
    <>
      {byPlatform(items).map(([platform, group]) => (
        <section key={platform} id={anchor(platform)} className={styles.section}>
          <div className={styles.break}>
            <span className={styles.bar} />
            <span className={styles.mid}>
              <span className={styles.no}>Platform</span>
              <span className={styles.nm}>{platform}</span>
            </span>
            <span className={styles.bar} />
          </div>
          <div className={styles.fields}>
            {group.map((item) => (
              <div key={item.key} className={`${styles.field}${item.big ? ` ${styles.span2}` : ""}`}>
                <span className={styles.flabel}>{item.label}</span>
                {item.body}
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

/** Bill-nav entries for playbill platform leftover sections (one per platform). */
export function nativePlaybillNav(items: NativeFieldItem[]): JSX.Element[] {
  return byPlatform(items).map(([platform, group]) => (
    <li key={platform}>
      <a href={`#${anchor(platform)}`}>
        <span className={styles.tno}>Platform</span>
        <span className={styles.tnm}>{platform}</span>
        <span className={styles.tct}>{group.length}</span>
      </a>
    </li>
  ));
}
