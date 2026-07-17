/**
 * NamedAssets - multipurpose named file bag (Risu additional assets).
 * value+onChange; sealed previews via resolveAssetRef when map provided.
 */
import { useRef, type JSX } from "react";
import {
  extFromNameOrRef,
  kindFromExt,
  kindFromMime,
  newNamedId,
  normalizeNamed,
  resolveAssetRef,
  type AssetFileMap,
  type NamedAsset,
  type NamedAssetsValue,
} from "../../../core/media";
import { SealedMedia } from "../sealed-media";
import styles from "./styles.module.css";

export interface NamedAssetsProps {
  value: NamedAssetsValue;
  onChange(next: NamedAssetsValue): void;
  assetFiles?: AssetFileMap;
  macroHint?: boolean;
}

const ACCEPT =
  "image/*,audio/*,video/*,.mp3,.mp4,.webm,.wav,.ogg,.ttf,.otf,.woff,.woff2,.css,.svg,.avif";

const readDataUri = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("named-assets: data URL expected"));
    };
    reader.onerror = () => reject(new Error("named-assets: read failed"));
    reader.readAsDataURL(file);
  });

export function NamedAssets({
  value,
  onChange,
  assetFiles,
  macroHint = true,
}: NamedAssetsProps): JSX.Element {
  const bag = normalizeNamed(value);
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceId = useRef<string | null>(null);

  const commit = (items: NamedAsset[]): void => onChange(normalizeNamed({ items }));

  const addFiles = async (files: FileList | null): Promise<void> => {
    if (!files?.length) return;
    const rid = replaceId.current;
    replaceId.current = null;
    if (rid) {
      const file = files[0]!;
      try {
        const ref = await readDataUri(file);
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
        const kind = kindFromMime(file.type) ?? kindFromExt(ext);
        commit(
          bag.items.map((it) =>
            it.id === rid
              ? { ...it, ref, kind, ext, mime: file.type || undefined }
              : it,
          ),
        );
      } catch {
        /* fail closed */
      }
      return;
    }
    const added: NamedAsset[] = [];
    for (const file of [...files]) {
      try {
        const ref = await readDataUri(file);
        const name = file.name.replace(/\.[^.]+$/, "") || "asset";
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
        const kind = kindFromMime(file.type) ?? kindFromExt(ext);
        added.push({
          id: newNamedId(),
          name,
          ref,
          kind,
          ...(ext ? { ext } : {}),
          ...(file.type ? { mime: file.type } : {}),
        });
      } catch {
        /* skip */
      }
    }
    if (added.length) commit([...bag.items, ...added]);
  };

  return (
    <div>
      {bag.items.length === 0 ? (
        <div className={styles.empty}>
          No named assets. On Risu these feed backdrop macros (image / audio / video / raw).
        </div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Kind</th>
              <th>Preview</th>
              <th>Name</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {bag.items.map((it) => {
              const src = resolveAssetRef(it.ref, assetFiles);
              return (
                <tr key={it.id}>
                  <td>
                    <span className={styles.kind}>{it.kind}</span>
                  </td>
                  <td>
                    <SealedMedia kind={it.kind} src={src} name={it.name} />
                  </td>
                  <td>
                    <input
                      className={styles.name}
                      value={it.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        commit(
                          bag.items.map((row) =>
                            row.id === it.id
                              ? {
                                  ...row,
                                  name,
                                  ext: extFromNameOrRef(name, row.ref) || row.ext,
                                }
                              : row,
                          ),
                        );
                      }}
                    />
                  </td>
                  <td>
                    <div className={styles.ops}>
                      <button
                        type="button"
                        onClick={() => {
                          replaceId.current = it.id;
                          fileRef.current?.click();
                        }}
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={() => commit(bag.items.filter((row) => row.id !== it.id))}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <div className={styles.addRow}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPri}`}
          onClick={() => {
            replaceId.current = null;
            fileRef.current?.click();
          }}
        >
          + Add files
        </button>
        <span className={styles.hint}>mp3 mp4 png webp ttf css …</span>
      </div>
      {macroHint ? (
        <div className={styles.macro}>
          Risu macros (read-only)
          <br />
          <code>{"{{image::name}}"}</code>
          <code>{"{{audio::name}}"}</code>
          <code>{"{{video::name}}"}</code>
          <code>{"{{raw::name}}"}</code>
        </div>
      ) : null}
      <input
        ref={fileRef}
        type="file"
        className={styles.hidden}
        accept={ACCEPT}
        multiple
        onChange={(e) => {
          void addFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
