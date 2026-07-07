/**
 * AssetManager - a type-aware media manager for CCv3 `assets[]` (icons, backgrounds, an emotion
 * sprite pack, user icons, audio). Not a text field: each asset shows a real preview, an editable
 * name, and its source; a dropper embeds a file (as a data URL - a valid CCv3 uri), and external
 * URLs stay editable. Reusable value+onChange primitive: give it the array, it hands back the next
 * array. Approved wireframe: design/vs-native-sillytavern.html.
 */
import { useRef } from "react";
import type { JSX } from "react";
import styles from "./styles.module.css";

export interface Asset {
  type?: string;
  uri?: string;
  name?: string;
  ext?: string;
}

export interface AssetManagerProps {
  assets: Asset[];
  onChange(next: Asset[]): void;
}

const AUDIO_EXT = new Set(["mp3", "mp4", "wav", "ogg", "webm", "m4a"]);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

interface Group {
  id: string;
  label: string;
  type: string;
  audio?: boolean;
}
const GROUPS: Group[] = [
  { id: "icon", label: "Portraits", type: "icon" },
  { id: "background", label: "Backgrounds", type: "background" },
  { id: "emotion", label: "Expression pack", type: "emotion" },
  { id: "user_icon", label: "User icons", type: "user_icon" },
  { id: "audio", label: "Audio & other", type: "other", audio: true },
];

const groupOf = (a: Asset): string => {
  if (AUDIO_EXT.has(str(a.ext).toLowerCase())) return "audio";
  const t = str(a.type);
  return GROUPS.some((g) => g.id === t) ? t : "other";
};

const isImage = (a: Asset): boolean => {
  const u = str(a.uri);
  return (u.startsWith("http") || u.startsWith("data:image")) && !AUDIO_EXT.has(str(a.ext).toLowerCase());
};

const sourceLabel = (uri: string): string => {
  if (uri.startsWith("data:")) return "embedded file";
  if (uri.startsWith("http")) return "external URL";
  if (uri === "ccdefault:") return "card default";
  if (uri.startsWith("embeded:") || uri.startsWith("embedded:")) return "in-card";
  return uri ? "custom" : "none";
};

function AssetTile({ asset, onEdit, onRemove }: { asset: Asset; onEdit(next: Asset): void; onRemove(): void }): JSX.Element {
  const uri = str(asset.uri);
  const external = uri.startsWith("http");
  return (
    <div className={styles.tile}>
      <div className={styles.preview}>
        {isImage(asset) ? <img src={uri} alt={str(asset.name)} className={styles.img} /> : <span className={styles.ph}>{str(asset.ext).toUpperCase() || "?"}</span>}
      </div>
      <input
        className={styles.name}
        value={str(asset.name)}
        placeholder="name"
        onChange={(e) => onEdit({ ...asset, name: e.target.value })}
      />
      <div className={styles.src}>{sourceLabel(uri)}</div>
      {external ? (
        <input className={styles.url} value={uri} onChange={(e) => onEdit({ ...asset, uri: e.target.value })} />
      ) : null}
      <button type="button" className={styles.rm} onClick={onRemove}>
        remove
      </button>
    </div>
  );
}

export function AssetManager({ assets, onChange }: AssetManagerProps): JSX.Element {
  const list = Array.isArray(assets) ? assets : [];
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const addFile = (group: Group, file: File): void => {
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    const reader = new FileReader();
    reader.onload = () => {
      const uri = typeof reader.result === "string" ? reader.result : "";
      onChange([...list, { type: group.type, uri, name: file.name.replace(/\.[^.]+$/, ""), ext }]);
    };
    reader.readAsDataURL(file); // embed as a data URL - a valid CCv3 uri, round-trips as-is
  };

  const editAt = (i: number, next: Asset): void => onChange(list.map((a, ix) => (ix === i ? next : a)));
  const removeAt = (i: number): void => onChange(list.filter((_, ix) => ix !== i));

  return (
    <div className={styles.wrap}>
      {GROUPS.map((g) => {
        const inGroup = list.map((a, i) => ({ a, i })).filter(({ a }) => groupOf(a) === g.id);
        return (
          <div className={styles.group} key={g.id}>
            <div className={styles.ghead}>{g.label}</div>
            <div className={styles.tiles}>
              {inGroup.map(({ a, i }) => (
                <AssetTile key={i} asset={a} onEdit={(next) => editAt(i, next)} onRemove={() => removeAt(i)} />
              ))}
              <button type="button" className={styles.drop} onClick={() => fileInputs.current[g.id]?.click()}>
                + drop / add
              </button>
              <input
                ref={(el) => {
                  fileInputs.current[g.id] = el;
                }}
                type="file"
                className={styles.hidden}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) addFile(g, f);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
