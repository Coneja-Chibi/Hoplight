/**
 * Native-field rendering, shared by BOTH editor layouts. It turns the selected platforms' native fields
 * into renderable items (via the leaf native-card controls) and offers each layout the wrapping it
 * wants: bento gets per-field cards bin-packed across the three columns with the big ones full-span at
 * the bottom; playbill gets a native section per platform. One definition, both layouts - so a native
 * field can never again show in one layout and vanish in the other. The editor owns the single stub
 * modal state and passes read/write/openStub; this module is otherwise a pure view.
 */
import type { JSX } from "react";
import { nativeFieldItems, type NativeFieldItem } from "../../components/native-card";
import { BentoCard } from "../../components/bento-card";
import { MonoTag } from "../../components/mono-tag";
import { nativeSchemaFor } from "./platforms";
import type { Stub } from "../../components/native-card";
import styles from "./native-render.module.css";

/** Gather the native items for the selected/present platform keys, deduped, order = key order. */
export function nativeItemsFor(
  keys: readonly string[],
  read: (p: string) => unknown,
  write: (p: string, v: unknown) => void,
  openStub: (s: Stub) => void,
): NativeFieldItem[] {
  const seen = new Set<string>();
  const out: NativeFieldItem[] = [];
  for (const key of keys) {
    if (seen.has(key)) continue;
    seen.add(key);
    const schema = nativeSchemaFor(key);
    if (!schema) continue;
    out.push(...nativeFieldItems(schema, read, write, openStub));
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
  /** cards to append to each of the three bento columns */
  columns: [JSX.Element[], JSX.Element[], JSX.Element[]];
  /** the full-span row of big cards, placed under the grid; null when there are none */
  spanRow: JSX.Element | null;
}

/**
 * Bin-pack the small native cards across the three bento columns (seeded so the short left column fills
 * first, then it balances by size); the big cards (weight >= 4: trackers, recommendations, assets) go
 * full-span in a row beneath the grid where they have room to breathe.
 */
export function nativeBentoParts(items: NativeFieldItem[]): NativeBentoParts {
  const cols = [
    { weight: 10, nodes: [] as JSX.Element[] },
    { weight: 12, nodes: [] as JSX.Element[] },
    { weight: 12, nodes: [] as JSX.Element[] },
  ];
  for (const item of items.filter((i) => !i.big)) {
    const shortest = cols.reduce((a, b) => (b.weight < a.weight ? b : a));
    shortest.nodes.push(card(item));
    shortest.weight += item.weight;
  }
  const big = items.filter((i) => i.big);
  const spanRow = big.length === 0 ? null : <div className={styles.span}>{big.map(card)}</div>;
  return { columns: [cols[0]!.nodes, cols[1]!.nodes, cols[2]!.nodes], spanRow };
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
 * The playbill native section: one act per platform, its fields rendered as BARE labeled fields (label
 * + control), matching the acts form - NOT bento cards (that is the grid layout's shape). Big fields
 * span the two-column grid. The act break header already names the platform, so fields drop the pill.
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
              <span className={styles.no}>Native</span>
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

/** Bill-nav entries for the playbill native sections (one per platform). */
export function nativePlaybillNav(items: NativeFieldItem[]): JSX.Element[] {
  return byPlatform(items).map(([platform, group]) => (
    <li key={platform}>
      <a href={`#${anchor(platform)}`}>
        <span className={styles.tno}>Native</span>
        <span className={styles.tnm}>{platform}</span>
        <span className={styles.tct}>{group.length}</span>
      </a>
    </li>
  ));
}
