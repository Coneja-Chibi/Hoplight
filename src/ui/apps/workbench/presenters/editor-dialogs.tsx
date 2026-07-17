/**
 * Editor modal dialogs: export, sprite pack, named assets.
 * Extracted from Editor.tsx so the shell stays under the line cap.
 */
import type { JSX } from "react";
import type { AppContext, StudioEntitySummary } from "../../../app-contract";
import { ExportDialog } from "../../../components/export-dialog";
import { SpritePackDialog } from "../../../components/sprite-pack/dialog";
import { NamedAssetsDialog } from "../../../components/named-assets/dialog";
import {
  type NamedAssetsValue,
  type SpritePackValue,
  normalizePack,
} from "../../../../core/media";
import { emptyPackBody } from "../../../../entities/pack/schema";
import { CANONICAL_SCHEMA_VERSION } from "../../../../core/canonical";
import { rec } from "../editor-derive";
import { groupsFromLumiOriginal, packFromBodyDraft } from "../media/session";
import { readWorkshopModule } from "../workshop/module";

export function EditorDialogs({
  exportOpen,
  setExportOpen,
  spritesOpen,
  setSpritesOpen,
  setSpritesFocusLabel,
  spritesFocusLabel,
  namedOpen,
  setNamedOpen,
  ctx,
  piece,
  initEnt,
  baseDraft,
  originalDraft,
  name,
  mediaSprites,
  mediaSpriteGroups,
  mediaNamedAssets,
  spritePack,
  namedBag,
  targets,
  packCatalog,
  applyFaceOnly,
  applySpritePack,
  applyNamed,
}: {
  exportOpen: boolean;
  setExportOpen(v: boolean): void;
  spritesOpen: boolean;
  setSpritesOpen(v: boolean): void;
  setSpritesFocusLabel(v: string | null): void;
  spritesFocusLabel: string | null;
  namedOpen: boolean;
  setNamedOpen(v: boolean): void;
  ctx: AppContext;
  piece: StudioEntitySummary;
  initEnt: Record<string, unknown>;
  baseDraft: Record<string, unknown>;
  originalDraft: Record<string, unknown>;
  name: string;
  mediaSprites: boolean;
  mediaSpriteGroups: boolean;
  mediaNamedAssets: boolean;
  spritePack: SpritePackValue;
  namedBag: NamedAssetsValue;
  targets: string[];
  packCatalog: readonly { id: string; name: string }[];
  applyFaceOnly(pack: SpritePackValue, wantLabel?: string | null): void;
  applySpritePack(pack: SpritePackValue, groups?: Record<string, SpritePackValue>): void;
  applyNamed(value: NamedAssetsValue): void;
}): JSX.Element {
  return (
    <>
      {exportOpen && (
        <ExportDialog
          ctx={ctx}
          name={name}
          hasPackage={!!readWorkshopModule(originalDraft)}
          entity={{
            ...initEnt,
            body: baseDraft,
            original: originalDraft,
            kind: piece.kind,
            id: piece.id,
          }}
          onClose={() => setExportOpen(false)}
        />
      )}

      {spritesOpen && mediaSprites && (
        <SpritePackDialog
          characterName={name}
          pack={spritePack}
          groups={groupsFromLumiOriginal(originalDraft)}
          targets={targets}
          showEnabled={mediaSpriteGroups}
          showDefault
          showGroups={mediaSpriteGroups}
          focusLabel={spritesFocusLabel}
          packCatalog={packCatalog}
          onFetchPack={async (key) => {
            try {
              const colon = key.indexOf(":");
              const kind = colon > 0 ? key.slice(0, colon) : "character";
              const id = colon > 0 ? key.slice(colon + 1) : key;
              const ent = await ctx.api.getEntity(
                `kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`,
              );
              if (!ent || typeof ent !== "object") return null;
              const recEnt = ent as Record<string, unknown>;
              const body = rec(recEnt.body);
              if (kind === "pack") {
                const p = normalizePack(body.pack);
                return p.items.length > 0 ? p : null;
              }
              const original = rec(recEnt.original);
              const remote = packFromBodyDraft(body, original);
              return remote.items.length > 0 ? remote : null;
            } catch {
              return null;
            }
          }}
          onSaveAsLibraryPack={async (pack, groups) => {
            const packName = (name || "Character") + " pack";
            const body = emptyPackBody(packName);
            body.pack = normalizePack(pack);
            if (groups && Object.keys(groups).length > 0) body.groups = groups;
            const saved = await ctx.api.saveEntity({
              schemaVersion: CANONICAL_SCHEMA_VERSION,
              kind: "pack",
              id: packName.toLowerCase().replace(/\s+/g, "-").slice(0, 48) || "pack",
              body,
            });
            ctx.setStatus(`saved library pack · ${saved.name ?? packName}`);
          }}
          onFaceOnly={applyFaceOnly}
          onApply={applySpritePack}
          onClose={() => {
            setSpritesOpen(false);
            setSpritesFocusLabel(null);
          }}
        />
      )}

      {namedOpen && mediaNamedAssets && (
        <NamedAssetsDialog
          characterName={name}
          value={namedBag}
          onApply={applyNamed}
          onClose={() => setNamedOpen(false)}
        />
      )}
    </>
  );
}
