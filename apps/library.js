{const s=document.createElement("style");s.dataset.vaudeModuleCss="1";s.textContent="/* src/ui/components/ink-dialog/styles.module.css */\n.overlay_wz5sqg {\n  position: fixed;\n  z-index: 150;\n  background: var(--shadow-ink);\n  display: flex;\n  justify-content: center;\n  align-items:  center;\n  padding: 1rem;\n  inset: 0;\n}\n\n.sheet_wz5sqg {\n  background: var(--face);\n  color: var(--text);\n  border: 3px solid var(--edge);\n  box-shadow: 6px 6px 0 0 var(--edge);\n  width: 100%;\n  max-width: 24rem;\n  padding: 1.1rem 1.3rem;\n}\n\n/* src/ui/components/transfer-bench/styles.module.css */\n.wrap_V8iS1A {\n  display: flex;\n  flex-direction: column;\n  gap: .75rem;\n  min-width: min(40rem, 92vw);\n  max-width: 52rem;\n  padding: .25rem .15rem .4rem;\n}\n\n.nameRow_V8iS1A {\n  display: flex;\n  font-family: var(--font-mono);\n  letter-spacing: .1em;\n  text-transform: uppercase;\n  color: var(--stage-kicker);\n  flex-direction: column;\n  gap: .25rem;\n  font-size: .625rem;\n}\n\n.nameRow_V8iS1A input {\n  border: 2px solid var(--stage-seam);\n  background: var(--stage-sunken);\n  color: var(--stage-card);\n  font-family: var(--font-body);\n  padding: .4rem .55rem;\n  font-size: .95rem;\n  font-weight: 600;\n}\n\n.note_V8iS1A {\n  font-family: var(--font-body);\n  color: var(--stage-mute);\n  margin: 0;\n  font-size: .85rem;\n  font-style: italic;\n  font-weight: 600;\n}\n\n.bench_V8iS1A {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);\n  align-items: stretch;\n  gap: .55rem;\n  min-height: 14rem;\n}\n\n.col_V8iS1A {\n  border: 2px solid var(--stage-black);\n  background: var(--stage-panel);\n  display: flex;\n  flex-direction: column;\n  min-width: 0;\n}\n\n.colHead_V8iS1A {\n  display: flex;\n  border-bottom: 2px solid var(--stage-seam);\n  align-items:  center;\n  gap: .4rem;\n  padding: .4rem .5rem;\n}\n\n.colHead_V8iS1A b {\n  font-family: var(--font-big);\n  letter-spacing: .08em;\n  text-transform: uppercase;\n  color: var(--stage-card);\n  font-size: .625rem;\n  font-weight: 800;\n}\n\n.small_V8iS1A {\n  border: 1px solid var(--stage-seam);\n  background: var(--stage-row);\n  color: var(--stage-mute);\n  font-family: var(--font-mono);\n  letter-spacing: .06em;\n  text-transform: uppercase;\n  cursor: pointer;\n  margin-left: auto;\n  padding: .12rem .35rem;\n  font-size: .625rem;\n}\n\n.list_V8iS1A {\n  list-style: none;\n  overflow-y: auto;\n  flex: 1;\n  max-height: 16rem;\n  margin: 0;\n  padding: .3rem;\n}\n\n.empty_V8iS1A {\n  font-family: var(--font-body);\n  color: var(--stage-kicker);\n  padding: .5rem;\n  font-size: .85rem;\n  font-style: italic;\n}\n\n.row_V8iS1A {\n  display: flex;\n  color: var(--stage-soft);\n  text-align: left;\n  cursor: pointer;\n  font-family: var(--font-body);\n  background: none;\n  border: 0;\n  align-items:  center;\n  gap: .4rem;\n  width: 100%;\n  padding: .28rem .3rem;\n  font-size: .85rem;\n  font-weight: 600;\n}\n\n.rowOn_V8iS1A {\n  background: color-mix(in srgb, var(--a, var(--stage-macro)) 14%, transparent);\n  color: var(--stage-card);\n}\n\n.cb_V8iS1A {\n  border: 2px solid var(--stage-seam);\n  background: var(--stage-sunken);\n  flex: none;\n  width: .75rem;\n  height: .75rem;\n}\n\n.cbOn_V8iS1A {\n  background: var(--a, var(--stage-macro));\n  border-color: var(--stage-black);\n}\n\n.lbl_V8iS1A {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  flex: 1;\n  min-width: 0;\n}\n\n.meta_V8iS1A {\n  font-family: var(--font-mono);\n  color: var(--stage-kicker);\n  flex: none;\n  font-size: .625rem;\n}\n\n.mid_V8iS1A {\n  display: flex;\n  flex-direction: column;\n  justify-content: center;\n  gap: .35rem;\n}\n\n.arrow_V8iS1A {\n  border: 2px solid var(--stage-black);\n  background: var(--stage-row);\n  color: var(--stage-soft);\n  box-shadow: 2px 2px 0 0 var(--stage-black);\n  cursor: pointer;\n  font-family: var(--font-mono);\n  width: 2rem;\n  height: 2rem;\n  font-weight: 700;\n}\n\n.arrow_V8iS1A:disabled {\n  opacity: .4;\n  cursor: not-allowed;\n}\n\n.foot_V8iS1A {\n  display: flex;\n  justify-content: flex-end;\n  gap: .5rem;\n}\n\n.cancel_V8iS1A {\n  border: 2px solid var(--stage-seam);\n  background: var(--stage-row);\n  color: var(--stage-mute);\n  font-family: var(--font-mono);\n  letter-spacing: .06em;\n  text-transform: uppercase;\n  cursor: pointer;\n  padding: .4rem .7rem;\n  font-size: .625rem;\n  font-weight: 700;\n}\n\n.apply_V8iS1A {\n  border: 2px solid var(--stage-black);\n  background: var(--a, var(--stage-macro));\n  color: var(--stage-ink);\n  font-family: var(--font-big);\n  letter-spacing: .06em;\n  text-transform: uppercase;\n  box-shadow: 3px 3px 0 0 var(--stage-black);\n  cursor: pointer;\n  padding: .4rem .85rem;\n  font-size: .68rem;\n  font-weight: 800;\n}\n\n.apply_V8iS1A:disabled {\n  opacity: .45;\n  cursor: not-allowed;\n  box-shadow: none;\n}\n";document.head.append(s);}
// src/ui/apps/library/index.tsx
import { useCallback as useCallback6, useEffect as useEffect13, useMemo as useMemo4, useRef as useRef8, useState as useState14 } from "react";

// src/ui/_shared/decks.ts
var DECKS = [
  { kind: "character", plural: "Characters", short: "char", accent: "var(--deck-character)" },
  { kind: "lorebook", plural: "Lorebooks", short: "lore", accent: "var(--deck-lorebook)" },
  { kind: "persona", plural: "Personas", short: "pers", accent: "var(--deck-persona)" },
  { kind: "pack", plural: "Sprite packs", short: "pack", accent: "var(--deck-pack)" },
  { kind: "preset", plural: "Presets", short: "set", accent: "var(--deck-preset)" },
  { kind: "regex", plural: "Regex sets", short: "rgx", accent: "var(--deck-regex)" },
  { kind: "quickreply", plural: "Quick replies", short: "qr", accent: "var(--deck-preset)" }
];
var BY_KIND = new Map(DECKS.map((d) => [d.kind, d]));
var knownDecks = () => [...DECKS];
function deckMeta(kind) {
  return BY_KIND.get(kind) ?? {
    kind,
    plural: kind.charAt(0).toUpperCase() + kind.slice(1) + "s",
    short: kind.slice(0, 4),
    accent: "var(--deck-fog)"
  };
}

// src/ui/_shared/knowledge-refs.ts
function rewriteKnowledgeRefsFor(entity, idMap) {
  const e = entity;
  const refs = e?.body?.knowledgeRefs;
  if (!Array.isArray(refs) || refs.length === 0)
    return entity;
  const rewritten = refs.filter((r) => typeof r === "string").map((r) => idMap.get(r)).filter((r) => r !== undefined);
  const nextBody = { ...e.body };
  if (rewritten.length > 0)
    nextBody.knowledgeRefs = rewritten;
  else
    delete nextBody.knowledgeRefs;
  return { ...entity, body: nextBody };
}

// src/ui/apps/library/deck-core.ts
function deckCounts(entities, kindOrder) {
  const counts = new Map;
  for (const kind of kindOrder)
    counts.set(kind, 0);
  for (const e of entities)
    counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
  return [...counts.entries()].map(([kind, count]) => ({ kind, count }));
}
function bundlePayloadFromInspect(result) {
  if (!result.ok || result.entity === undefined || result.entity === null)
    return null;
  const lorebooks = result.related?.lorebooks;
  const regexSets = result.related?.regexSets;
  const related = {};
  if (lorebooks && lorebooks.length > 0)
    related.lorebooks = lorebooks;
  if (regexSets && regexSets.length > 0)
    related.regexSets = regexSets;
  if (Object.keys(related).length > 0)
    return { entity: result.entity, related };
  return { entity: result.entity };
}
function orderForCommit(picked) {
  const standalone = [];
  const byArchive = new Map;
  for (const r of picked) {
    if (!r.archiveKey) {
      standalone.push(r);
      continue;
    }
    const bucket = byArchive.get(r.archiveKey) ?? [];
    bucket.push(r);
    byArchive.set(r.archiveKey, bucket);
  }
  const isBook = (r) => r.result.ok && r.result.kind === "lorebook";
  const ordered = [...standalone];
  for (const bucket of byArchive.values()) {
    ordered.push(...bucket.filter(isBook), ...bucket.filter((r) => !isBook(r)));
  }
  return ordered;
}
async function commitOrderedRows(picked, savers, onProgress) {
  const errors = [];
  let shelved = 0;
  let idMap = new Map;
  let currentArchive;
  for (let i = 0;i < picked.length; i++) {
    const r = picked[i];
    onProgress?.(i, picked.length);
    if (r.archiveKey !== currentArchive) {
      idMap = new Map;
      currentArchive = r.archiveKey;
    }
    try {
      const stagedRef = r.result.ok ? r.result.staged : undefined;
      let result;
      let mintedId;
      if (stagedRef) {
        mintedId = r.result.entityId;
        const own = new Set(r.result.ok ? r.result.knowledgeRefs ?? [] : []);
        result = await savers.staged({
          token: stagedRef.token,
          key: stagedRef.key,
          refIds: Object.fromEntries([...idMap].filter(([minted]) => own.has(minted)))
        });
      } else {
        const entity = r.archiveKey ? rewriteKnowledgeRefsFor(r.result.entity, idMap) : r.result.entity;
        const payload = bundlePayloadFromInspect({ ...r.result, entity });
        if (!payload)
          continue;
        mintedId = r.result.entity?.id ?? undefined;
        result = await savers.bundle(payload);
      }
      if (!result.ok) {
        errors.push(`${r.filename}: ${result.error ?? "could not save"}`);
        continue;
      }
      shelved++;
      if (r.archiveKey && r.result.kind === "lorebook" && result.primary) {
        if (typeof mintedId === "string")
          idMap.set(mintedId, result.primary.id);
      }
    } catch (e) {
      errors.push(`${r.filename}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { shelved, errors };
}

// src/ui/apps/library/import-triage.ts
var CANDIDATE_EXTENSIONS = new Set(["json", "png", "charx", "risum"]);
var TRIAGE_MAX_BYTES = 64 * 1024 * 1024;
var extOf = (name) => {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
};
function triageFiles(files) {
  const candidates = [];
  const archives = [];
  const skipped = [];
  for (const f of files) {
    const ext = extOf(f.name);
    if (ext === "lvbak") {
      archives.push(f);
      continue;
    }
    if (!CANDIDATE_EXTENSIONS.has(ext)) {
      const reason = ext === "jsonl" ? "a chat log, and Hoplight does not eat chats" : `not a file type Hoplight reads${ext ? ` (.${ext})` : ""}`;
      skipped.push({ filename: f.name, result: { ok: false, error: reason } });
      continue;
    }
    if (f.size > TRIAGE_MAX_BYTES) {
      skipped.push({ filename: f.name, result: { ok: false, error: "over the 64MB size ceiling" } });
      continue;
    }
    candidates.push(f);
  }
  return { candidates, archives, skipped };
}
function contentKey(result) {
  if (!result.ok)
    return null;
  if (result.entity)
    return JSON.stringify({ e: result.entity, r: result.related ?? null });
  return result.contentHash ?? null;
}
var shelfKey = (kind, name) => `${kind}::${name.trim().toLowerCase()}`;
function markDupes(read, shelf, seen) {
  if (!read.result.ok)
    return read;
  const key = contentKey(read.result);
  if (key) {
    const first = seen.get(key);
    if (first !== undefined) {
      read.batchDupe = first;
      return read;
    }
    seen.set(key, read.filename);
  }
  const kind = read.result.kind ?? read.result.entity?.kind ?? "";
  const name = read.result.receipt?.name ?? "";
  if (kind && name) {
    const onShelf = shelf.get(shelfKey(kind, name));
    if (onShelf !== undefined)
      read.shelfDupe = onShelf;
  }
  return read;
}
function defaultCheckedIndexes(reads) {
  return reads.map((r, i) => r.result.ok && !r.batchDupe && !r.shelfDupe ? i : -1).filter((i) => i >= 0);
}
function groupByError(items) {
  const groups = new Map;
  for (const item of items) {
    const bucket = groups.get(item.error) ?? [];
    bucket.push(item);
    groups.set(item.error, bucket);
  }
  return [...groups.values()];
}
function groupBadRows(reads) {
  const items = reads.map((r, index) => ({ r, index })).filter(({ r }) => !r.result.ok).map(({ r, index }) => ({ error: r.result.error ?? "We could not read this one.", filename: r.filename, index }));
  return groupByError(items).map((group) => ({
    error: group[0].error,
    filenames: group.map((g) => g.filename),
    indexes: group.map((g) => g.index)
  }));
}
var KIND_WORD = {
  character: "character card",
  lorebook: "lorebook",
  persona: "persona",
  preset: "preset",
  regex: "regex set"
};
var plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
function summarizeImportedTotals(imported) {
  const parts = Object.keys(imported).filter((kind) => imported[kind].length > 0).map((kind) => plural(imported[kind].length, KIND_WORD[kind]));
  return parts.length > 0 ? `${parts.join(", ")} imported.` : "";
}
var TABLE_WORD = {
  chats: "chat",
  messages: "message",
  settings: "setting",
  connections: "connection",
  extensions: "extension",
  packs: "pack",
  lumia_items: "Lumia item",
  loom_items: "loom item",
  loom_tools: "loom tool"
};
function summarizeSkippedTables(skipped) {
  if (skipped.length === 0)
    return "";
  const parts = skipped.map(({ table, rows }) => {
    const known = TABLE_WORD[table];
    const count = rows === null ? "some" : rows;
    if (known)
      return rows === null ? `some ${known}s` : plural(rows, known);
    return `${count} ${table.replace(/_/g, " ")}`;
  });
  return `${parts.join(", ")} did not come along.`;
}
function groupReportFailures(failures) {
  const items = failures.map((f) => ({ error: f.reason, filename: f.name || f.rowId || f.table }));
  return groupByError(items).map((group) => ({
    error: group[0].error,
    filenames: group.map((g) => g.filename)
  }));
}
var isRec = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function annotateRead(filename, result) {
  if (result.ok && !result.entity)
    return { filename, result, entryCount: result.entryCount };
  if (!result.ok || !result.entity)
    return { filename, result };
  const entity = result.entity;
  const countOf = (v) => isRec(v) && Array.isArray(v.entries) ? v.entries.length : undefined;
  if (entity.kind !== "lorebook") {
    const related = result.related?.lorebooks;
    if (Array.isArray(related) && related.length > 0) {
      const entries = related.reduce((n, lb) => n + (countOf(isRec(lb) ? lb.body : undefined) ?? 0), 0);
      return { filename, result, entryCount: entries || undefined };
    }
    return { filename, result };
  }
  return { filename, result, entryCount: countOf(entity.body) };
}
function rowKnowledgeRefs(result) {
  if (!result.ok)
    return [];
  if (result.knowledgeRefs)
    return result.knowledgeRefs;
  const body = result.entity?.body;
  const refs = Array.isArray(body?.knowledgeRefs) ? body.knowledgeRefs : [];
  return refs.filter((r) => typeof r === "string");
}
function unresolvedArchiveRefs(reads, checked, archiveKey) {
  const resolvable = new Set;
  const referenced = new Set;
  reads.forEach((r, i) => {
    if (r.archiveKey !== archiveKey || !r.result.ok)
      return;
    const entity = r.result.entity;
    const rowId = r.result.entityId ?? (typeof entity?.id === "string" ? entity.id : undefined);
    if (r.result.kind === "lorebook" && typeof rowId === "string" && checked.has(i)) {
      resolvable.add(rowId);
    }
    if ((r.result.kind === "character" || r.result.kind === "persona") && checked.has(i)) {
      for (const ref of rowKnowledgeRefs(r.result))
        referenced.add(ref);
    }
  });
  const unresolved = new Set;
  for (const ref of referenced)
    if (!resolvable.has(ref))
      unresolved.add(ref);
  return unresolved;
}
function withArchiveLinkCaveat(result, unresolvedRefs) {
  if (!result.ok || !result.receipt)
    return result;
  if (result.kind !== "character" && result.kind !== "persona")
    return result;
  const hasUnresolved = rowKnowledgeRefs(result).some((r) => unresolvedRefs.has(r));
  if (!hasUnresolved)
    return result;
  return {
    ...result,
    receipt: {
      ...result.receipt,
      extras: [
        ...result.receipt.extras,
        "Links to a lorebook from the same backup, but that book is not checked (or did not import) - check it too, or this link will not carry over."
      ]
    }
  };
}

// src/ui/apps/library/import-sheet.tsx
import { useEffect as useEffect2, useState } from "react";

// src/ui/components/ink-dialog/index.tsx
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

// src/ui/components/ink-dialog/styles.module.css
var styles_module_default = {
  overlay: "overlay_wz5sqg",
  sheet: "sheet_wz5sqg"
};

// src/ui/components/ink-dialog/index.tsx
import { jsxDEV } from "react/jsx-dev-runtime";
function InkDialog({ children, onDismiss, ariaLabel, sheetClassName }) {
  const sheetRef = useRef(null);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape")
        return;
      const inner = e.target instanceof Element ? e.target.closest('[role="dialog"][aria-modal="true"]') : null;
      if (inner && inner !== sheetRef.current)
        return;
      onDismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDismiss]);
  const onOverlayClick = (e) => {
    if (e.target === e.currentTarget)
      onDismiss();
  };
  return createPortal(/* @__PURE__ */ jsxDEV("div", {
    className: styles_module_default.overlay,
    onClick: onOverlayClick,
    children: /* @__PURE__ */ jsxDEV("div", {
      ref: sheetRef,
      className: sheetClassName ? `${styles_module_default.sheet} ${sheetClassName}` : styles_module_default.sheet,
      role: "dialog",
      "aria-modal": "true",
      "aria-label": ariaLabel,
      children
    }, undefined, false, undefined, this)
  }, undefined, false, undefined, this), document.body);
}

// src/ui/apps/library/import-sheet.tsx
import { jsxDEV as jsxDEV2 } from "react/jsx-dev-runtime";
function ReceiptCard({
  r,
  checked,
  onToggle
}) {
  if (r.result.ok && r.result.receipt) {
    if (r.batchDupe) {
      return /* @__PURE__ */ jsxDEV2("div", {
        className: "improw dupe",
        children: /* @__PURE__ */ jsxDEV2("div", {
          className: "impbody",
          children: [
            /* @__PURE__ */ jsxDEV2("b", {
              className: "impname",
              children: r.result.receipt.name
            }, undefined, false, undefined, this),
            /* @__PURE__ */ jsxDEV2("p", {
              className: "impmeta",
              children: [
                "Identical to ",
                r.batchDupe,
                " in this drop. We keep one."
              ]
            }, undefined, true, undefined, this)
          ]
        }, undefined, true, undefined, this)
      }, undefined, false, undefined, this);
    }
    return /* @__PURE__ */ jsxDEV2("label", {
      className: `improw${checked ? " on" : ""}`,
      children: [
        /* @__PURE__ */ jsxDEV2("input", {
          type: "checkbox",
          checked,
          onChange: onToggle
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV2("span", {
          className: "impcheck",
          "aria-hidden": "true"
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV2("div", {
          className: "impbody",
          children: [
            /* @__PURE__ */ jsxDEV2("b", {
              className: "impname",
              children: r.result.receipt.name
            }, undefined, false, undefined, this),
            /* @__PURE__ */ jsxDEV2("p", {
              className: "impkind",
              children: r.result.receipt.kindLine
            }, undefined, false, undefined, this),
            r.shelfDupe && /* @__PURE__ */ jsxDEV2("p", {
              className: "impmeta",
              children: [
                "Already on your shelf as ",
                r.shelfDupe,
                ". Importing keeps both."
              ]
            }, undefined, true, undefined, this),
            typeof r.entryCount === "number" && /* @__PURE__ */ jsxDEV2("p", {
              className: "impmeta",
              children: [
                r.entryCount,
                " entr",
                r.entryCount === 1 ? "y" : "ies"
              ]
            }, undefined, true, undefined, this),
            r.healNotes && r.healNotes.length > 0 && /* @__PURE__ */ jsxDEV2("p", {
              className: "impmeta",
              children: [
                "Healed: ",
                r.healNotes.slice(0, 3).join(" · "),
                r.healNotes.length > 3 ? ` · +${r.healNotes.length - 3} more` : ""
              ]
            }, undefined, true, undefined, this),
            r.result.receipt.extras.map((line, i) => /* @__PURE__ */ jsxDEV2("p", {
              className: "impkind",
              children: line
            }, i, false, undefined, this))
          ]
        }, undefined, true, undefined, this)
      ]
    }, undefined, true, undefined, this);
  }
  return /* @__PURE__ */ jsxDEV2("div", {
    className: "improw bad",
    children: /* @__PURE__ */ jsxDEV2("div", {
      className: "impbody",
      children: [
        /* @__PURE__ */ jsxDEV2("span", {
          className: "impflag",
          children: "Could not read"
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV2("b", {
          className: "impname",
          children: r.filename
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV2("p", {
          className: "imperr",
          children: r.result.error ?? "We could not read this one."
        }, undefined, false, undefined, this)
      ]
    }, undefined, true, undefined, this)
  }, undefined, false, undefined, this);
}
function BadGroupCard({ group }) {
  const sample = group.filenames.slice(0, 3).join(" · ");
  return /* @__PURE__ */ jsxDEV2("div", {
    className: "improw bad",
    children: /* @__PURE__ */ jsxDEV2("div", {
      className: "impbody",
      children: [
        /* @__PURE__ */ jsxDEV2("span", {
          className: "impflag",
          children: "Skipped"
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV2("b", {
          className: "impname",
          children: [
            group.filenames.length,
            " file",
            group.filenames.length === 1 ? "" : "s"
          ]
        }, undefined, true, undefined, this),
        /* @__PURE__ */ jsxDEV2("p", {
          className: "imperr",
          children: group.error
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV2("p", {
          className: "impmeta",
          children: [
            sample,
            group.filenames.length > 3 ? ` · +${group.filenames.length - 3} more` : ""
          ]
        }, undefined, true, undefined, this)
      ]
    }, undefined, true, undefined, this)
  }, undefined, false, undefined, this);
}
function ArchiveReportCard({ entry }) {
  const { filename, report } = entry;
  const totals = summarizeImportedTotals(report.imported) || "Nothing importable was found in this backup.";
  const skipped = summarizeSkippedTables(report.skippedTables);
  const failGroups = groupReportFailures(report.failed);
  return /* @__PURE__ */ jsxDEV2("div", {
    className: "impreport",
    children: [
      /* @__PURE__ */ jsxDEV2("b", {
        className: "impname",
        children: [
          "Backup report: ",
          filename
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV2("p", {
        className: "impkind",
        children: totals
      }, undefined, false, undefined, this),
      skipped && /* @__PURE__ */ jsxDEV2("p", {
        className: "impmeta",
        children: skipped
      }, undefined, false, undefined, this),
      report.missingBinaries.length > 0 && /* @__PURE__ */ jsxDEV2("p", {
        className: "impmeta",
        children: [
          report.missingBinaries.length,
          " referenced file",
          report.missingBinaries.length === 1 ? "" : "s",
          " (avatars, images) could not be found."
        ]
      }, undefined, true, undefined, this),
      report.unresolvedLinks.length > 0 && /* @__PURE__ */ jsxDEV2("p", {
        className: "impmeta",
        children: [
          report.unresolvedLinks.length,
          " cross-reference",
          report.unresolvedLinks.length === 1 ? "" : "s",
          " pointed at something that was never imported."
        ]
      }, undefined, true, undefined, this),
      report.warnings.map((w, i) => /* @__PURE__ */ jsxDEV2("p", {
        className: "impmeta",
        children: w
      }, i, false, undefined, this)),
      failGroups.length > 0 && /* @__PURE__ */ jsxDEV2("ul", {
        children: failGroups.map((g, i) => /* @__PURE__ */ jsxDEV2("li", {
          children: g.filenames.length >= 4 ? `${g.filenames.length} rows: ${g.error} (${g.filenames.slice(0, 3).join(" · ")} · +${g.filenames.length - 3} more)` : `${g.filenames.join(", ")}: ${g.error}`
        }, i, false, undefined, this))
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
function ImportOverlay({
  state,
  onCommit,
  onCancel,
  onAddMore
}) {
  const doneReads = state.phase === "done" ? state.reads : null;
  const checkable = defaultCheckedIndexes(doneReads ?? []);
  const [checked, setChecked] = useState(() => new Set(checkable));
  useEffect2(() => {
    if (doneReads)
      setChecked(new Set(defaultCheckedIndexes(doneReads)));
  }, [doneReads]);
  if (state.phase === "reading" || state.phase === "saving") {
    const bad = state.phase === "reading" ? state.reads.filter((r) => !r.result.ok).length : 0;
    const pct = state.total === 0 ? 0 : Math.round(state.done / state.total * 100);
    const line = state.phase === "saving" ? `Shelving ${Math.min(state.done + 1, state.total)} of ${state.total}…` : state.total === 0 ? "Sorting the drop…" : `Read ${state.done} of ${state.total}${bad > 0 ? ` · ${bad} could not be read` : ""}`;
    return /* @__PURE__ */ jsxDEV2(InkDialog, {
      onDismiss: state.phase === "saving" ? () => {} : onCancel,
      ariaLabel: state.phase === "saving" ? "Shelving your pieces" : "Reading your files",
      sheetClassName: "impsheet",
      children: [
        /* @__PURE__ */ jsxDEV2("p", {
          className: "impkick",
          children: "The Library · Import"
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV2("b", {
          className: "imptitle",
          children: state.phase === "saving" ? "Shelving…" : "Reading your files…"
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV2("span", {
          className: "impbar",
          role: "progressbar",
          "aria-valuemin": 0,
          "aria-valuemax": state.total,
          "aria-valuenow": state.done,
          children: /* @__PURE__ */ jsxDEV2("i", {
            style: { width: `${pct}%` }
          }, undefined, false, undefined, this)
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV2("p", {
          className: "impprog",
          role: "status",
          children: line
        }, undefined, false, undefined, this),
        state.phase === "reading" && /* @__PURE__ */ jsxDEV2("div", {
          className: "impacts",
          children: /* @__PURE__ */ jsxDEV2("button", {
            type: "button",
            className: "impbtn stamp",
            onClick: onCancel,
            children: "Cancel"
          }, undefined, false, undefined, this)
        }, undefined, false, undefined, this)
      ]
    }, undefined, true, undefined, this);
  }
  const okRows = state.reads.map((r, i) => ({ r, i })).filter(({ r }) => r.result.ok && !r.batchDupe);
  const dupeRows = state.reads.map((r, i) => ({ r, i })).filter(({ r }) => r.result.ok && !!r.batchDupe);
  const badGroups = groupBadRows(state.reads);
  const archiveKeys = [...new Set(state.reads.map((r) => r.archiveKey).filter((k) => !!k))];
  const unresolvedByArchive = new Map(archiveKeys.map((k) => [k, unresolvedArchiveRefs(state.reads, checked, k)]));
  const decorated = (r) => r.archiveKey ? { ...r, result: withArchiveLinkCaveat(r.result, unresolvedByArchive.get(r.archiveKey) ?? new Set) } : r;
  const badCount = badGroups.reduce((n, g) => n + g.filenames.length, 0);
  const selectedGood = checkable.filter((i) => checked.has(i));
  const shelfDupes = okRows.filter(({ r }) => r.shelfDupe).length;
  const summary = [
    `${okRows.length} readable`,
    ...shelfDupes > 0 ? [`${shelfDupes} already on your shelf`] : [],
    ...dupeRows.length > 0 ? [`${dupeRows.length} identical cop${dupeRows.length === 1 ? "y" : "ies"}`] : [],
    ...badCount > 0 ? [`${badCount} skipped`] : []
  ].join(" · ");
  const toggle = (i) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i))
        next.delete(i);
      else
        next.add(i);
      return next;
    });
  };
  return /* @__PURE__ */ jsxDEV2(InkDialog, {
    onDismiss: onCancel,
    ariaLabel: "Pick what to import",
    sheetClassName: "impsheet",
    children: [
      /* @__PURE__ */ jsxDEV2("p", {
        className: "impkick",
        children: "The Library · Import"
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV2("b", {
        className: "imptitle",
        children: badCount === 0 && dupeRows.length === 0 ? "Pick what to keep." : "Here is what we read."
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV2("p", {
        className: "impsub",
        children: [
          summary,
          ". Uncheck anything you do not want. Import only writes the checked ones."
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV2("div", {
        className: "improws",
        children: [
          state.archiveReports.map((entry, i) => /* @__PURE__ */ jsxDEV2(ArchiveReportCard, {
            entry
          }, `report${i}`, false, undefined, this)),
          okRows.map(({ r, i }) => /* @__PURE__ */ jsxDEV2(ReceiptCard, {
            r: decorated(r),
            checked: checked.has(i),
            onToggle: () => {
              if (!r.result.ok || r.batchDupe)
                return;
              toggle(i);
            }
          }, i, false, undefined, this)),
          dupeRows.map(({ r, i }) => /* @__PURE__ */ jsxDEV2(ReceiptCard, {
            r: decorated(r),
            checked: false,
            onToggle: () => {}
          }, i, false, undefined, this)),
          badGroups.map((g, gi) => g.filenames.length >= 4 ? /* @__PURE__ */ jsxDEV2(BadGroupCard, {
            group: g
          }, `g${gi}`, false, undefined, this) : g.indexes.map((i) => /* @__PURE__ */ jsxDEV2(ReceiptCard, {
            r: decorated(state.reads[i]),
            checked: false,
            onToggle: () => {}
          }, i, false, undefined, this)))
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV2("div", {
        className: "impacts",
        children: [
          /* @__PURE__ */ jsxDEV2("button", {
            type: "button",
            className: "impbtn stamp",
            onClick: () => setChecked(new Set(checkable)),
            children: "Select all"
          }, undefined, false, undefined, this),
          onAddMore && /* @__PURE__ */ jsxDEV2("button", {
            type: "button",
            className: "impbtn stamp",
            onClick: onAddMore,
            children: "Add more files"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV2("button", {
            type: "button",
            className: "impbtn primary stamp",
            disabled: selectedGood.length === 0,
            onClick: () => onCommit(selectedGood),
            children: `Import ${selectedGood.length}`
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV2("button", {
            type: "button",
            className: "impbtn stamp",
            onClick: onCancel,
            children: "Not now"
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this)
    ]
  }, undefined, true, undefined, this);
}

// src/ui/apps/library/import-flow.tsx
var activeAbort = null;
var INSPECT_POOL = 3;
var ARCHIVE_POOL = 1;
function makeImportRunners(args) {
  const { ctx, importState, setImportState, reload } = args;
  const cancelImport = () => {
    activeAbort?.abort();
    activeAbort = null;
    setImportState(null);
  };
  const runImport = (files, append = false) => {
    activeAbort?.abort();
    const abort = new AbortController;
    activeAbort = abort;
    (async () => {
      const priorReads = append && importState?.phase === "done" ? importState.reads : [];
      const priorReports = append && importState?.phase === "done" ? importState.archiveReports : [];
      const { candidates, archives, skipped } = triageFiles(files);
      const read = [...priorReads, ...skipped];
      const archiveReports = [...priorReports];
      const total = candidates.length + archives.length;
      setImportState({ phase: "reading", reads: read, done: 0, total, archiveReports });
      let shelf = new Map;
      try {
        const pieces = await ctx.api.listEntities();
        shelf = new Map(pieces.map((p) => [shelfKey(p.kind, p.name), p.name]));
      } catch {}
      const seen = new Map;
      for (const r of priorReads) {
        const key = r.result.ok ? contentKey(r.result) : null;
        if (key && !seen.has(key))
          seen.set(key, r.filename);
      }
      let done = 0;
      const tick = () => setImportState({ phase: "reading", reads: read, done, total, archiveReports });
      let nextFile = 0;
      const fileWorker = async () => {
        while (!abort.signal.aborted) {
          const mine = nextFile++;
          const file = candidates[mine];
          if (!file)
            return;
          try {
            const result = await ctx.api.inspectFile(file, abort.signal);
            read.push(markDupes(annotateRead(file.name, result), shelf, seen));
          } catch (e) {
            if (abort.signal.aborted)
              return;
            const error = e instanceof Error ? e.message : String(e);
            read.push(annotateRead(file.name, { ok: false, error }));
          }
          done++;
          tick();
        }
      };
      let nextArchive = 0;
      const archiveWorker = async () => {
        while (!abort.signal.aborted) {
          const mine = nextArchive++;
          const file = archives[mine];
          if (!file)
            return;
          try {
            const result = await ctx.api.inspectArchive(file, abort.signal);
            if (result.ok) {
              if (result.report)
                archiveReports.push({ filename: file.name, report: result.report });
              for (const row of result.rows ?? []) {
                const label = row.receipt?.name ?? row.kind ?? "entity";
                const annotated = markDupes(annotateRead(`${file.name}: ${label}`, row), shelf, seen);
                annotated.archiveKey = file.name;
                read.push(annotated);
              }
            } else {
              read.push(annotateRead(file.name, { ok: false, error: result.error ?? "We could not read this one." }));
            }
          } catch (e) {
            if (abort.signal.aborted)
              return;
            const error = e instanceof Error ? e.message : String(e);
            read.push(annotateRead(file.name, { ok: false, error }));
          }
          done++;
          tick();
        }
      };
      await Promise.all([
        ...Array.from({ length: INSPECT_POOL }, fileWorker),
        ...Array.from({ length: ARCHIVE_POOL }, archiveWorker)
      ]);
      if (abort.signal.aborted)
        return;
      activeAbort = null;
      setImportState({ phase: "done", reads: read, archiveReports });
    })();
  };
  const commitImport = (checkedIndexes) => {
    if (importState?.phase !== "done")
      return;
    (async () => {
      const picked = orderForCommit(checkedIndexes.map((i) => importState.reads[i]).filter((r) => !!r && r.result.ok));
      const { shelved, errors } = await commitOrderedRows(picked, { bundle: ctx.api.saveBundle, staged: ctx.api.saveStaged }, (done, total) => setImportState({ phase: "saving", done, total }));
      reload();
      if (errors.length > 0) {
        setImportState({
          phase: "done",
          reads: errors.map((msg) => {
            const at = msg.indexOf(": ");
            return {
              filename: at > 0 ? msg.slice(0, at) : msg,
              result: { ok: false, error: at > 0 ? msg.slice(at + 2) : "could not save" }
            };
          }),
          archiveReports: importState.archiveReports
        });
        ctx.setStatus(`shelved ${shelved} · ${errors.length} of ${picked.length} failed to save`);
      } else {
        setImportState(null);
        ctx.setStatus(`imported ${shelved} file${shelved === 1 ? "" : "s"} · counts updated on the deck chips`);
      }
    })();
  };
  return { runImport, commitImport, cancelImport };
}
function pickFiles(onFiles) {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.addEventListener("change", () => onFiles([...input.files ?? []]));
  input.click();
}

// src/ui/_shared/web-storage.ts
var volatile = new Map;
function webStorage(area) {
  const transient = volatile.get(area);
  if (transient)
    return transient;
  if (typeof globalThis === "undefined")
    return null;
  try {
    return area === "local" ? globalThis.localStorage : globalThis.sessionStorage;
  } catch {
    return null;
  }
}

// src/ui/agent/html-handoff.ts
var KEY = "hoplight.html-view.doc";
var OPEN_HTML_EVENT = "hoplight:open-html";
var HTML_VIEW_APP = "html-view";
function put(handoff) {
  try {
    webStorage("session")?.setItem(KEY, JSON.stringify(handoff));
  } catch {
    return;
  }
  window.dispatchEvent(new CustomEvent(OPEN_HTML_EVENT));
}
function handOffPiece(id) {
  put({ at: "piece", id });
}

// src/ui/apps/library/send-pieces.ts
var DRAWN_ELSEWHERE = new Set;
function routeSend(batch) {
  const drawings = batch.filter((piece) => DRAWN_ELSEWHERE.has(piece.kind));
  return {
    toWorkbench: batch.filter((piece) => !DRAWN_ELSEWHERE.has(piece.kind)),
    toViewer: drawings[0] ?? null,
    deferred: Math.max(0, drawings.length - 1)
  };
}
function sendStatus(routing) {
  if (!routing.toViewer)
    return null;
  return routing.deferred > 0 ? `opened ${routing.toViewer.name} · ${routing.deferred} more drawing(s) open one at a time` : `opened ${routing.toViewer.name}`;
}

// src/ui/apps/library/icon.tsx
import { useEffect as useEffect3, useRef as useRef2 } from "react";
import { jsxDEV as jsxDEV3 } from "react/jsx-dev-runtime";
function Icon({ svg }) {
  const ref = useRef2(null);
  useEffect3(() => {
    const box = ref.current;
    if (!box)
      return;
    box.replaceChildren();
    box.append(document.importNode(new DOMParser().parseFromString(svg, "image/svg+xml").documentElement, true));
  }, [svg]);
  return /* @__PURE__ */ jsxDEV3("span", {
    ref,
    className: "ico"
  }, undefined, false, undefined, this);
}

// src/ui/apps/library/lore-workshop-dialog.tsx
import { useCallback, useEffect as useEffect4, useMemo, useState as useState3 } from "react";

// src/core/canonical.ts
var CANONICAL_SCHEMA_VERSION = "1";
// src/core/lore/summary.ts
function estimateEntryTokens(e) {
  return Math.ceil((e.title.length + e.content.length) / 4);
}
// src/entities/lorebook/schema.ts
var DEFAULT_SCAN_DEPTH = 4;

// src/core/lore/empty-book.ts
function emptyLoreEntry(id) {
  return {
    id,
    title: "",
    content: "",
    enabled: true,
    constant: false,
    triggerMode: "simple",
    triggers: [],
    secondaryTriggers: [],
    selectiveLogic: "and_any",
    caseSensitive: null,
    matchWholeWords: null,
    scanDepth: null,
    position: "world",
    depth: 4,
    role: "system",
    sortOrder: 100,
    priority: 100,
    sticky: 0,
    cooldown: 0,
    delay: 0,
    groupName: null,
    categoryId: null,
    groupWeight: 100,
    probability: 100,
    useMemo: false,
    excludeRecursion: false,
    preventRecursion: false,
    delayUntilRecursion: 0,
    characterFilter: null,
    scanCharacterDescription: false,
    scanCharacterPersonality: false,
    scanUserPersona: false,
    scanScenario: false,
    ignoreBudget: false,
    sideEffects: null
  };
}
function emptyLorebookBody(name = "Untitled lorebook") {
  return {
    name,
    tags: [],
    enabled: true,
    globalCaseSensitive: false,
    globalMatchWholeWords: false,
    globalScanDepth: DEFAULT_SCAN_DEPTH,
    globalRecursion: false,
    tokenBudget: 0,
    budgetMode: "token",
    entryBudget: 0,
    entries: [emptyLoreEntry("entry-1")]
  };
}
// src/core/regex/ast/dialect.ts
var JS_FLAG_CHARS = new Set(["d", "g", "i", "m", "s", "u", "v", "y"]);
var HOISTABLE_INLINE_FLAGS = new Set(["i", "m", "s", "u"]);
var APPROXIMATE_POSIX = new Set(["graph", "print", "cntrl"]);
function jsFlagsForRule(rule) {
  return rule.useFlags ? parseFlagTokens(rule.flags || "g").jsFlags || "g" : "g";
}
function parseFlagTokens(flags) {
  const engineDirectives = [];
  const stripped = flags.replace(/<([^>]*)>/g, (_whole, inner) => {
    const token = inner.trim();
    if (token.length > 0)
      engineDirectives.push(token);
    return "";
  });
  const seen = new Set;
  for (const c of stripped) {
    if (JS_FLAG_CHARS.has(c))
      seen.add(c);
  }
  return { jsFlags: [...seen].join(""), engineDirectives };
}

// src/core/regex/ast/tokens.ts
var HEX = /[0-9a-fA-F]/;
function readEscapeCodePoint(src, at) {
  const kind = src[at + 1];
  if (kind === "c") {
    const letter = src[at + 2];
    if (letter === undefined || !/[a-zA-Z]/.test(letter))
      return { ok: false, error: "invalid control escape \\c", at };
    return { ok: true, codePoint: letter.charCodeAt(0) & 31, end: at + 3 };
  }
  if (kind === "x") {
    const h1 = src[at + 2];
    const h2 = src[at + 3];
    if (h1 === undefined || h2 === undefined || !HEX.test(h1) || !HEX.test(h2)) {
      return { ok: false, error: "\\x needs two hex digits", at };
    }
    return { ok: true, codePoint: parseInt(h1 + h2, 16), end: at + 4 };
  }
  if (src[at + 2] === "{") {
    let i = at + 3;
    let hex2 = "";
    while (i < src.length && HEX.test(src[i]))
      hex2 += src[i++];
    if (hex2.length === 0 || src[i] !== "}")
      return { ok: false, error: "malformed \\u{...} escape", at };
    const codePoint = parseInt(hex2, 16);
    if (codePoint > 1114111)
      return { ok: false, error: "code point out of range in \\u{...}", at };
    return { ok: true, codePoint, end: i + 1 };
  }
  let hex = "";
  for (let i = at + 2;i < at + 6; i++) {
    const h = src[i];
    if (h === undefined || !HEX.test(h))
      return { ok: false, error: "\\u needs four hex digits", at };
    hex += h;
  }
  return { ok: true, codePoint: parseInt(hex, 16), end: at + 6 };
}
function readUnicodeProperty(src, at) {
  if (src[at + 2] !== "{")
    return { ok: false, error: "\\p must be followed by {...} in unicode mode", at };
  let i = at + 3;
  let inner = "";
  while (i < src.length && src[i] !== "}")
    inner += src[i++];
  if (src[i] !== "}")
    return { ok: false, error: "unterminated \\p{...}", at };
  if (inner.length === 0)
    return { ok: false, error: "empty \\p{...}", at };
  const eq = inner.indexOf("=");
  const name = eq === -1 ? inner : inner.slice(0, eq);
  const value = eq === -1 ? undefined : inner.slice(eq + 1);
  return { ok: true, name, value, end: i + 1 };
}

// src/core/regex/ast/assert-never.ts
function assertNever(scope, value) {
  throw new Error(`${scope}: unhandled variant ${JSON.stringify(value)}`);
}

// src/core/regex/ast/parser.ts
var V_MODE_ENABLED = false;

class ParseError extends Error {
  at;
  constructor(message, at) {
    super(message);
    this.at = at;
  }
}
var SYNTAX_CHARS = new Set(["^", "$", "\\", ".", "*", "+", "?", "(", ")", "[", "]", "{", "}", "|"]);
var CLASS_ESCAPE_LETTERS = new Set(["d", "D", "w", "W", "s", "S"]);
var CONTROL_ESCAPES = { f: 12, n: 10, r: 13, t: 9, v: 11 };
var QUANTIFIER_STARTS = new Set(["*", "+", "?", "{"]);
var SIMPLE_QUANTIFIERS = { "*": [0, null], "+": [1, null], "?": [0, 1] };
var ID_START = /\p{ID_Start}/u;
var ID_CONTINUE = /\p{ID_Continue}/u;
var DIGIT = /[0-9]/;
var ZWNJ = "‌";
var ZWJ = "‍";

class RegexParser {
  src;
  pos = 0;
  groupCount = 0;
  disjCounter = 0;
  pathStack = [];
  namedGroups = [];
  numericRefs = [];
  namedRefs = [];
  constructor(src) {
    this.src = src;
  }
  peek(offset = 0) {
    return this.src[this.pos + offset];
  }
  fail(message, at = this.pos) {
    throw new ParseError(`regex/parse: ${message}`, at);
  }
  parse() {
    const ast = this.parseDisjunction();
    if (this.pos < this.src.length)
      this.fail(this.peek() === ")" ? "unmatched )" : "unexpected trailing input");
    this.validateReferences();
    return ast;
  }
  parseDisjunction() {
    const start = this.pos;
    const frame = { disj: this.disjCounter++, alt: 0 };
    this.pathStack.push(frame);
    const alternatives = [this.parseAlternative()];
    while (this.peek() === "|") {
      this.pos++;
      frame.alt++;
      alternatives.push(this.parseAlternative());
    }
    this.pathStack.pop();
    return { type: "alternation", alternatives, start, end: this.pos };
  }
  parseAlternative() {
    const start = this.pos;
    const elements = [];
    while (this.pos < this.src.length && this.peek() !== "|" && this.peek() !== ")") {
      const before = this.pos;
      elements.push(this.parseTerm());
      if (this.pos === before)
        this.fail("parser made no progress");
    }
    return { type: "sequence", elements, start, end: this.pos };
  }
  parseTerm() {
    const assertion = this.tryParseAssertion();
    if (assertion) {
      if (QUANTIFIER_STARTS.has(this.peek() ?? ""))
        this.fail("nothing to repeat");
      return assertion;
    }
    const atom = this.parseAtom();
    const quantified = this.tryParseQuantifier(atom);
    if (quantified && QUANTIFIER_STARTS.has(this.peek() ?? ""))
      this.fail("nothing to repeat");
    return quantified ?? atom;
  }
  tryParseAssertion() {
    const start = this.pos;
    const c = this.peek();
    if (c === "^" || c === "$") {
      this.pos++;
      return { type: "anchor", kind: c === "^" ? "line-start" : "line-end", start, end: this.pos };
    }
    if (c === "\\" && (this.peek(1) === "b" || this.peek(1) === "B")) {
      const kind = this.peek(1) === "b" ? "word-boundary" : "non-word-boundary";
      this.pos += 2;
      return { type: "anchor", kind, start, end: this.pos };
    }
    if (c === "(" && this.peek(1) === "?") {
      const c2 = this.peek(2);
      if (c2 === "=" || c2 === "!")
        return this.parseLookaround(start, true, c2 === "!");
      if (c2 === "<" && (this.peek(3) === "=" || this.peek(3) === "!")) {
        return this.parseLookaround(start, false, this.peek(3) === "!");
      }
    }
    return null;
  }
  parseLookaround(start, ahead, negative) {
    this.pos += ahead ? 3 : 4;
    const body = this.parseDisjunction();
    if (this.peek() !== ")")
      this.fail("unterminated lookaround");
    this.pos++;
    return { type: "lookaround", ahead, negative, body, start, end: this.pos };
  }
  parseAtom() {
    const start = this.pos;
    const c = this.peek();
    if (c === undefined)
      this.fail("unexpected end of pattern");
    if (c === "(")
      return this.parseGroup();
    if (c === "[")
      return this.parseClass();
    if (c === ".") {
      this.pos++;
      return { type: "dot", start, end: this.pos };
    }
    if (c === "\\")
      return this.parseEscape(false);
    if (c === "*" || c === "+" || c === "?")
      this.fail("nothing to repeat");
    if (c === "{")
      this.fail("lone quantifier brace");
    if (c === "}" || c === "]")
      this.fail(`lone ${c}`);
    return this.readLiteral();
  }
  readLiteral() {
    const start = this.pos;
    const cp = this.src.codePointAt(this.pos);
    if (cp === undefined)
      this.fail("unexpected end of pattern");
    this.pos += cp > 65535 ? 2 : 1;
    return this.charLiteral(start, cp);
  }
  charLiteral(start, codePoint) {
    const raw = this.src.slice(start, this.pos);
    return { type: "literal", value: String.fromCodePoint(codePoint), raw, codePoint, start, end: this.pos };
  }
  oneCharEscape(start, codePoint) {
    this.pos++;
    return this.charLiteral(start, codePoint);
  }
  parseGroup() {
    const start = this.pos;
    this.pos++;
    let capturing = true;
    let name = null;
    let index = null;
    let modifiers = null;
    if (this.peek() === "?") {
      const c2 = this.peek(1);
      if (c2 === ":") {
        capturing = false;
        this.pos += 2;
      } else if (c2 === "<") {
        this.pos += 2;
        name = this.parseGroupName();
        index = ++this.groupCount;
        this.namedGroups.push({ name, path: this.pathStack.map((f) => ({ ...f })), at: start });
      } else if (c2 === "P") {
        this.fail("python-style group (?P<...>) is not valid ECMAScript", this.pos);
      } else {
        this.pos++;
        modifiers = this.parseModifiers();
        capturing = false;
      }
    } else {
      index = ++this.groupCount;
    }
    const body = this.parseDisjunction();
    if (this.peek() !== ")")
      this.fail("unterminated group");
    this.pos++;
    return { type: "group", capturing, name, index, modifiers, body, start, end: this.pos };
  }
  parseGroupName() {
    const start = this.pos;
    let name = "";
    while (this.pos < this.src.length && this.peek() !== ">")
      name += this.readLiteral().value;
    if (this.peek() !== ">")
      this.fail("unterminated group name", start);
    this.pos++;
    if (name.length === 0)
      this.fail("empty group name", start);
    const first = String.fromCodePoint(name.codePointAt(0) ?? 0);
    if (!ID_START.test(first) && first !== "$" && first !== "_")
      this.fail("invalid group name", start);
    for (const ch of name) {
      if (!ID_CONTINUE.test(ch) && ch !== "$" && ch !== "_" && ch !== ZWNJ && ch !== ZWJ) {
        this.fail("invalid group name", start);
      }
    }
    return name;
  }
  parseModifiers() {
    const start = this.pos;
    const readFlags = () => {
      let out = "";
      while ("ims".includes(this.peek() ?? "")) {
        const f = this.peek();
        if (out.includes(f))
          this.fail("duplicate modifier flag", this.pos);
        out += f;
        this.pos++;
      }
      return out;
    };
    const add = readFlags();
    let remove = "";
    if (this.peek() === "-") {
      this.pos++;
      remove = readFlags();
      if (remove.length === 0)
        this.fail("modifier group has empty removal set", start);
    }
    if (this.peek() !== ":")
      this.fail("invalid modifier group", start);
    if (add.length === 0 && remove.length === 0)
      this.fail("empty modifier group", start);
    this.pos++;
    return { add, remove };
  }
  tryParseQuantifier(body) {
    const c = this.peek();
    if (c !== "*" && c !== "+" && c !== "?" && c !== "{")
      return null;
    let min;
    let max;
    if (c === "{") {
      ({ min, max } = this.parseBraceQuantifier());
    } else {
      [min, max] = SIMPLE_QUANTIFIERS[c];
      this.pos++;
    }
    let lazy = false;
    if (this.peek() === "?") {
      lazy = true;
      this.pos++;
    }
    return { type: "quantifier", min, max, lazy, body, start: body.start, end: this.pos };
  }
  parseBraceQuantifier() {
    const start = this.pos;
    this.pos++;
    const minDigits = this.readDigits();
    if (minDigits === "")
      this.fail("quantifier is missing a lower bound", start);
    const min = Number(minDigits);
    let max = min;
    if (this.peek() === ",") {
      this.pos++;
      const maxDigits = this.readDigits();
      max = maxDigits === "" ? null : Number(maxDigits);
    }
    if (this.peek() !== "}")
      this.fail("unterminated quantifier", start);
    this.pos++;
    if (max !== null && min > max)
      this.fail("quantifier lower bound exceeds upper bound", start);
    return { min, max };
  }
  readDigits() {
    let out = "";
    while (this.peek() !== undefined && DIGIT.test(this.peek()))
      out += this.src[this.pos++];
    return out;
  }
  parseClass() {
    const start = this.pos;
    this.pos++;
    let negated = false;
    if (this.peek() === "^") {
      negated = true;
      this.pos++;
    }
    const items = [];
    while (this.peek() !== "]") {
      if (this.pos >= this.src.length)
        this.fail("unterminated character class", start);
      const before = this.pos;
      const atom = this.parseClassAtom();
      if (atom.type === "literal" && this.peek() === "-" && this.peek(1) !== "]" && this.peek(1) !== undefined) {
        const dashAt = this.pos;
        this.pos++;
        const hi = this.parseClassAtom();
        if (hi.type !== "literal")
          this.fail("invalid character-class range bound", dashAt);
        if (atom.codePoint > hi.codePoint)
          this.fail("character-class range is out of order", dashAt);
        items.push({ type: "class-range", from: atom, to: hi, start: atom.start, end: hi.end });
      } else {
        items.push(atom);
      }
      if (this.pos === before)
        this.fail("parser made no progress in class");
    }
    this.pos++;
    return { type: "char-class", negated, items, setOp: null, start, end: this.pos };
  }
  parseClassAtom() {
    if (this.peek() !== "\\")
      return this.readLiteral();
    const esc = this.parseEscape(true);
    if (esc.type === "literal" || esc.type === "class-escape" || esc.type === "unicode-property")
      return esc;
    this.fail("invalid escape in character class");
  }
  parseEscape(inClass) {
    const start = this.pos;
    this.pos++;
    const c = this.peek();
    if (c === undefined)
      this.fail("trailing backslash");
    if (CLASS_ESCAPE_LETTERS.has(c)) {
      this.pos++;
      return { type: "class-escape", letter: c, start, end: this.pos };
    }
    if (c === "p" || c === "P") {
      const r = readUnicodeProperty(this.src, start);
      if (!r.ok)
        this.fail(r.error, r.at);
      this.pos = r.end;
      return { type: "unicode-property", negated: c === "P", name: r.name, value: r.value, start, end: this.pos };
    }
    if (c === "b" && inClass)
      return this.oneCharEscape(start, 8);
    if (c === "B" && inClass)
      this.fail("invalid \\B in character class", start);
    if (c in CONTROL_ESCAPES)
      return this.oneCharEscape(start, CONTROL_ESCAPES[c]);
    if (c === "0") {
      if (this.peek(1) !== undefined && DIGIT.test(this.peek(1))) {
        this.fail("octal escapes are not valid in unicode mode", start);
      }
      return this.oneCharEscape(start, 0);
    }
    if (DIGIT.test(c)) {
      if (inClass)
        this.fail("backreference is not valid in a character class", start);
      return this.parseNumericBackref(start);
    }
    if (c === "k") {
      if (inClass)
        this.fail("named backreference is not valid in a character class", start);
      return this.parseNamedBackref(start);
    }
    if (c === "c" || c === "x" || c === "u") {
      const r = readEscapeCodePoint(this.src, start);
      if (!r.ok)
        this.fail(r.error, r.at);
      this.pos = r.end;
      return this.charLiteral(start, r.codePoint);
    }
    if (inClass && c === "-")
      return this.oneCharEscape(start, 45);
    if (SYNTAX_CHARS.has(c) || c === "/")
      return this.oneCharEscape(start, c.codePointAt(0));
    this.fail(`invalid escape \\${c}`, start);
  }
  parseNumericBackref(start) {
    const value = Number(this.readDigits());
    this.numericRefs.push({ value, at: start });
    return { type: "backreference", ref: value, raw: this.src.slice(start, this.pos), start, end: this.pos };
  }
  parseNamedBackref(start) {
    this.pos++;
    if (this.peek() !== "<")
      this.fail("expected < after \\k", start);
    this.pos++;
    let name = "";
    while (this.pos < this.src.length && this.peek() !== ">")
      name += this.readLiteral().value;
    if (this.peek() !== ">")
      this.fail("unterminated named backreference", start);
    this.pos++;
    if (name.length === 0)
      this.fail("empty named backreference", start);
    this.namedRefs.push({ name, at: start });
    return { type: "backreference", ref: name, raw: this.src.slice(start, this.pos), start, end: this.pos };
  }
  validateReferences() {
    for (const ref of this.numericRefs) {
      if (ref.value === 0 || ref.value > this.groupCount) {
        this.fail(`backreference \\${ref.value} has no matching group`, ref.at);
      }
    }
    const names = new Set(this.namedGroups.map((g) => g.name));
    for (const ref of this.namedRefs) {
      if (!names.has(ref.name))
        this.fail(`named backreference \\k<${ref.name}> has no group`, ref.at);
    }
    this.validateDuplicateNames();
  }
  validateDuplicateNames() {
    for (let i = 0;i < this.namedGroups.length; i++) {
      for (let j = i + 1;j < this.namedGroups.length; j++) {
        const a = this.namedGroups[i];
        const b = this.namedGroups[j];
        if (a.name === b.name && !separated(a.path, b.path))
          this.fail(`duplicate group name "${b.name}"`, b.at);
      }
    }
  }
}
function separated(p, q) {
  const n = Math.min(p.length, q.length);
  for (let i = 0;i < n; i++) {
    const pf = p[i];
    const qf = q[i];
    if (pf.disj !== qf.disj)
      return false;
    if (pf.alt !== qf.alt)
      return true;
  }
  return false;
}
function parseRegex(pattern, flags = "") {
  if (flags.includes("v") && !V_MODE_ENABLED) {
    return { error: "regex/parse: the v-flag set-notation grammar is not enabled yet", at: 0 };
  }
  try {
    return { ast: new RegexParser(pattern).parse() };
  } catch (err) {
    if (err instanceof ParseError)
      return { error: err.message, at: err.at };
    throw err;
  }
}

// src/core/regex/ast/redos.ts
function analyzeRedos(ast) {
  const raw = [];
  eachNode(ast, (node) => {
    if (node.type !== "quantifier" || node.max !== null)
      return;
    collectForQuantifier(node, raw);
  });
  const findings = dedupeBySpan(raw);
  return { severity: worstSeverity(findings), findings };
}
function collectForQuantifier(q, out) {
  if (hasAmbiguousInnerLoop(q)) {
    out.push({
      kind: "nested-quantifier",
      severity: "dangerous",
      culpritSpan: span(q),
      message: "Nested unbounded repetition can backtrack catastrophically on non-matching input."
    });
  }
  const alt = alternationBody(q);
  if (alt) {
    const overlap = alternationOverlap(alt);
    if (overlap) {
      out.push({
        kind: "overlapping-alternation",
        severity: overlap,
        culpritSpan: span(q),
        message: overlap === "dangerous" ? "Repeated group has alternatives that can match the same text, risking catastrophic backtracking." : "Repeated group has overlapping alternatives that may backtrack on some input."
      });
    }
  }
  if (containsBackreference(q.body)) {
    out.push({
      kind: "quantified-backreference",
      severity: "dangerous",
      culpritSpan: span(q),
      message: "A backreference inside unbounded repetition can backtrack catastrophically."
    });
  }
}
function hasAmbiguousInnerLoop(q) {
  const found = [];
  scanInner(q.body, firstSet(q.body), found);
  return found.length > 0;
}
function scanInner(node, after, out) {
  switch (node.type) {
    case "sequence": {
      let cur = after;
      for (let i = node.elements.length - 1;i >= 0; i--) {
        const el = node.elements[i];
        scanInner(el, cur, out);
        cur = nullable(el) ? [...firstSet(el), ...cur] : firstSet(el);
      }
      return;
    }
    case "alternation":
      for (const branch of node.alternatives)
        scanInner(branch, after, out);
      return;
    case "group":
      scanInner(node.body, after, out);
      return;
    case "quantifier": {
      const loops = node.max === null;
      if (loops && overlaps(firstSet(node.body), after))
        out.push(node);
      scanInner(node.body, loops ? [...firstSet(node.body), ...after] : after, out);
      return;
    }
    case "lookaround":
      scanInner(node.body, [], out);
      return;
    default:
      return;
  }
}
function alternationOverlap(alt) {
  const branches = alt.alternatives;
  if (branches.length < 2)
    return null;
  let suspicious = false;
  for (let i = 0;i < branches.length; i++) {
    for (let j = i + 1;j < branches.length; j++) {
      const a = branches[i];
      const b = branches[j];
      const sa = literalString(a);
      const sb = literalString(b);
      if (sa !== null && sb !== null) {
        if (sa.startsWith(sb) || sb.startsWith(sa))
          return "dangerous";
        continue;
      }
      if (overlaps(firstSet(a), firstSet(b)))
        suspicious = true;
    }
  }
  return suspicious ? "suspicious" : null;
}
function literalString(seq) {
  let out = "";
  for (const el of seq.elements) {
    if (el.type !== "literal")
      return null;
    out += el.value;
  }
  return out;
}
function alternationBody(q) {
  const body = q.body;
  if (body.type === "group")
    return body.body;
  if (body.type === "alternation")
    return body;
  return null;
}
function containsBackreference(node) {
  let found = false;
  eachNode(node, (n) => {
    if (n.type === "backreference")
      found = true;
  });
  return found;
}
var DOT_ATOM = { wide: true, witnesses: [], test: () => true };
var WIDE_ATOM = { wide: true, witnesses: [], test: () => true };
function nullable(node) {
  switch (node.type) {
    case "anchor":
    case "lookaround":
    case "backreference":
      return true;
    case "quantifier":
      return node.min === 0 || nullable(node.body);
    case "group":
      return nullable(node.body);
    case "alternation":
      return node.alternatives.some(nullable);
    case "sequence":
      return node.elements.every(nullable);
    default:
      return false;
  }
}
function firstSet(node) {
  switch (node.type) {
    case "literal":
      return [cpAtom(node.codePoint)];
    case "dot":
      return [DOT_ATOM];
    case "class-escape":
      return [classLetterAtom(node.letter)];
    case "unicode-property":
      return [WIDE_ATOM];
    case "char-class":
      return [charClassAtom(node)];
    case "backreference":
      return [WIDE_ATOM];
    case "anchor":
    case "lookaround":
      return [];
    case "quantifier":
    case "group":
      return firstSet(node.body);
    case "alternation":
      return node.alternatives.flatMap(firstSet);
    case "sequence": {
      const out = [];
      for (const el of node.elements) {
        out.push(...firstSet(el));
        if (!nullable(el))
          break;
      }
      return out;
    }
    default:
      return [];
  }
}
var SAMPLE = [
  48,
  57,
  65,
  90,
  97,
  122,
  95,
  32,
  9,
  10,
  33,
  46,
  64,
  160
];
function overlaps(xs, ys) {
  for (const x of xs) {
    for (const y of ys) {
      if (atomsOverlap(x, y))
        return true;
    }
  }
  return false;
}
function atomsOverlap(a, b) {
  if (a.wide || b.wide)
    return true;
  for (const cp of [...SAMPLE, ...a.witnesses, ...b.witnesses]) {
    if (a.test(cp) && b.test(cp))
      return true;
  }
  return false;
}
var cpAtom = (cp) => ({ wide: false, witnesses: [cp], test: (x) => x === cp });
var isDigit = (cp) => cp >= 48 && cp <= 57;
var isWord = (cp) => isDigit(cp) || cp >= 65 && cp <= 90 || cp >= 97 && cp <= 122 || cp === 95;
var SPACE_CPS = new Set([
  9,
  10,
  11,
  12,
  13,
  32,
  160,
  5760,
  8232,
  8233,
  8239,
  8287,
  12288,
  65279
]);
var isSpace = (cp) => SPACE_CPS.has(cp) || cp >= 8192 && cp <= 8202;
function letterTest(letter) {
  switch (letter) {
    case "d":
      return isDigit;
    case "D":
      return (cp) => !isDigit(cp);
    case "w":
      return isWord;
    case "W":
      return (cp) => !isWord(cp);
    case "s":
      return isSpace;
    case "S":
      return (cp) => !isSpace(cp);
    default:
      return assertNever("regex/redos", letter);
  }
}
function classLetterAtom(letter) {
  const test = letterTest(letter);
  return { wide: false, witnesses: SAMPLE.filter(test), test };
}
function charClassAtom(node) {
  const hasProperty = node.items.some((item) => item.type === "unicode-property");
  if (hasProperty)
    return WIDE_ATOM;
  const positive = (cp) => node.items.some((item) => classItemMatches(item, cp));
  const test = node.negated ? (cp) => !positive(cp) : positive;
  const witnesses = classWitnesses(node.items).filter(test);
  return { wide: false, witnesses, test };
}
function classItemMatches(item, cp) {
  switch (item.type) {
    case "literal":
      return cp === item.codePoint;
    case "class-range":
      return cp >= item.from.codePoint && cp <= item.to.codePoint;
    case "class-escape":
      return letterTest(item.letter)(cp);
    case "unicode-property":
      return false;
    default:
      return assertNever("regex/redos", item);
  }
}
function classWitnesses(items) {
  const out = [...SAMPLE];
  for (const item of items) {
    if (item.type === "literal")
      out.push(item.codePoint);
    else if (item.type === "class-range")
      out.push(item.from.codePoint, item.to.codePoint);
  }
  return out;
}
function eachNode(node, visit) {
  visit(node);
  switch (node.type) {
    case "alternation":
      node.alternatives.forEach((n) => eachNode(n, visit));
      return;
    case "sequence":
      node.elements.forEach((n) => eachNode(n, visit));
      return;
    case "quantifier":
    case "group":
    case "lookaround":
      eachNode(node.body, visit);
      return;
    default:
      return;
  }
}
var span = (node) => ({ start: node.start, end: node.end });
var SEVERITY_RANK = { suspicious: 1, dangerous: 2 };
function dedupeBySpan(findings) {
  const best = new Map;
  for (const f of findings) {
    const key = `${f.culpritSpan.start}:${f.culpritSpan.end}`;
    const prior = best.get(key);
    if (!prior || SEVERITY_RANK[f.severity] > SEVERITY_RANK[prior.severity])
      best.set(key, f);
  }
  return [...best.values()].sort((a, b) => a.culpritSpan.start - b.culpritSpan.start);
}
function worstSeverity(findings) {
  let worst = "safe";
  for (const f of findings) {
    if (f.severity === "dangerous")
      return "dangerous";
    worst = "suspicious";
  }
  return worst;
}

// src/core/regex/validate.ts
var MAX_PATTERN_LENGTH = 1e4;
var MAX_REPLACEMENT_LENGTH = 1e4;
var COMPLEXITY_HARD_CAP = 50;
var NESTED_QUANTIFIER = /\([^()]*[+*][^()]*\)[+*]/;
function estimateComplexity(pattern) {
  let score = 0;
  if (NESTED_QUANTIFIER.test(pattern))
    score += 50;
  const backrefs = (pattern.match(/\\[0-9]/g) ?? []).length;
  score += backrefs * 10;
  const alternations = (pattern.match(/\|/g) ?? []).length;
  score += alternations * 2;
  const quantifiers = (pattern.match(/[+*?]|\{[0-9,]+\}/g) ?? []).length;
  score += quantifiers * 3;
  const lookarounds = (pattern.match(/\(\?[=!<]/g) ?? []).length;
  score += lookarounds * 5;
  score += Math.floor(pattern.length / 50);
  return score;
}
function validateRule(rule) {
  const pattern = rule.find;
  if (pattern.length > MAX_PATTERN_LENGTH) {
    return {
      ok: false,
      error: `regex/validate: pattern exceeds ${MAX_PATTERN_LENGTH} characters`,
      complexity: 0
    };
  }
  if (!pattern.trim()) {
    return { ok: false, error: "regex/validate: pattern is empty", complexity: 0 };
  }
  if ((rule.replace ?? "").length > MAX_REPLACEMENT_LENGTH) {
    return {
      ok: false,
      error: `regex/validate: replacement exceeds ${MAX_REPLACEMENT_LENGTH} characters`,
      complexity: 0
    };
  }
  try {
    new RegExp(pattern, jsFlagsForRule(rule));
  } catch (err) {
    return {
      ok: false,
      error: `regex/validate: invalid pattern - ${err instanceof Error ? err.message : String(err)}`,
      complexity: estimateComplexity(pattern)
    };
  }
  const parsed = parseRegex(pattern);
  if ("ast" in parsed) {
    const report = analyzeRedos(parsed.ast);
    const worst = report.findings[0];
    if (report.severity === "dangerous") {
      return {
        ok: false,
        error: "regex/validate: pattern has nested quantifiers that risk catastrophic backtracking",
        complexity: COMPLEXITY_HARD_CAP,
        ...worst ? { culprit: worst.culpritSpan } : {}
      };
    }
    const complexity2 = report.severity === "suspicious" ? Math.max(estimateComplexity(pattern), COMPLEXITY_HARD_CAP - 10) : estimateComplexity(pattern);
    return {
      ok: true,
      complexity: complexity2,
      ...worst ? { culprit: worst.culpritSpan } : {}
    };
  }
  const complexity = estimateComplexity(pattern);
  if (complexity >= COMPLEXITY_HARD_CAP) {
    return {
      ok: false,
      error: "regex/validate: pattern has nested quantifiers that risk catastrophic backtracking",
      complexity
    };
  }
  return { ok: true, complexity };
}

// src/core/lore/match-keys.ts
var vettedKeyCache = new Map;
// src/core/lore/diff.ts
var CONTENT_FIELDS = new Set(["content", "title", "comment"]);
// src/core/lore/book-ops.ts
var renumber = (entries) => [...entries].sort((a, b) => a.sortOrder - b.sortOrder).map((e, i) => ({ ...e, sortOrder: i * 10 }));
var freshIds = (entries, prefix) => entries.map((e, i) => ({
  ...structuredClone(e),
  id: `${prefix}${i + 1}`
}));
function splitBook(book, movedIds, newName) {
  if (movedIds.length === 0) {
    throw new Error("book-ops: split needs at least one entry to move");
  }
  const name = newName.trim() || "Split lorebook";
  const want = new Set(movedIds);
  const moved = book.entries.filter((e) => want.has(e.id));
  const kept = book.entries.filter((e) => !want.has(e.id));
  if (moved.length === 0) {
    throw new Error("book-ops: none of the moved ids exist in the book");
  }
  const remainder = {
    ...book,
    entries: renumber(kept.length > 0 ? kept : [])
  };
  const split = {
    ...structuredClone(book),
    name,
    entries: renumber(moved)
  };
  return { remainder, split };
}
function mergeBooks(a, b, newName) {
  const name = newName?.trim() || [a.name, b.name].map((n) => n.trim()).filter(Boolean).join(" + ") || "Merged lorebook";
  const remintCats = (cats2, prefix) => {
    const map = new Map;
    const out = (cats2 ?? []).map((c, i) => {
      const id = `${prefix}${i + 1}`;
      map.set(c.id, id);
      return { ...structuredClone(c), id };
    });
    return { cats: out, map };
  };
  const catsA = remintCats(a.categories, "m_a_c");
  const catsB = remintCats(b.categories, "m_b_c");
  const followCats = (entries, map) => entries.map((e) => e.categoryId != null && map.has(e.categoryId) ? { ...e, categoryId: map.get(e.categoryId) } : e);
  const combined = [
    ...followCats(freshIds(a.entries, "m_a_"), catsA.map),
    ...followCats(freshIds(b.entries, "m_b_"), catsB.map)
  ];
  const merged = {
    ...structuredClone(a),
    name,
    description: a.description ?? b.description ?? null,
    tags: [...new Set([...a.tags, ...b.tags])],
    globalRecursion: a.globalRecursion || b.globalRecursion,
    tokenBudget: Math.max(a.tokenBudget, b.tokenBudget),
    entryBudget: Math.max(a.entryBudget, b.entryBudget),
    entries: renumber(combined)
  };
  const cats = [...catsA.cats, ...catsB.cats];
  if (cats.length > 0)
    merged.categories = cats;
  else
    delete merged.categories;
  return merged;
}
function duplicateBook(book, name) {
  const n = name.trim() || `${book.name.trim() || "Lorebook"} (copy)`;
  return {
    ...structuredClone(book),
    name: n,
    entries: renumber(freshIds(book.entries, "dup_"))
  };
}
// src/ui/components/transfer-bench/index.tsx
import { useState as useState2 } from "react";

// src/ui/components/transfer-bench/styles.module.css
var styles_module_default2 = {
  wrap: "wrap_V8iS1A",
  nameRow: "nameRow_V8iS1A",
  note: "note_V8iS1A",
  bench: "bench_V8iS1A",
  col: "col_V8iS1A",
  colHead: "colHead_V8iS1A",
  small: "small_V8iS1A",
  list: "list_V8iS1A",
  empty: "empty_V8iS1A",
  row: "row_V8iS1A",
  rowOn: "rowOn_V8iS1A",
  cb: "cb_V8iS1A",
  cbOn: "cbOn_V8iS1A",
  lbl: "lbl_V8iS1A",
  meta: "meta_V8iS1A",
  mid: "mid_V8iS1A",
  arrow: "arrow_V8iS1A",
  foot: "foot_V8iS1A",
  cancel: "cancel_V8iS1A",
  apply: "apply_V8iS1A"
};

// src/ui/components/transfer-bench/index.tsx
import { jsxDEV as jsxDEV4, Fragment } from "react/jsx-dev-runtime";
function List({
  title,
  items,
  selected,
  onToggle,
  onSelectAll
}) {
  return /* @__PURE__ */ jsxDEV4("div", {
    className: styles_module_default2.col,
    children: [
      /* @__PURE__ */ jsxDEV4("div", {
        className: styles_module_default2.colHead,
        children: [
          /* @__PURE__ */ jsxDEV4("b", {
            children: title
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV4("button", {
            type: "button",
            className: styles_module_default2.small,
            onClick: onSelectAll,
            children: "All"
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV4("ul", {
        className: styles_module_default2.list,
        children: [
          items.length === 0 && /* @__PURE__ */ jsxDEV4("li", {
            className: styles_module_default2.empty,
            children: "Empty"
          }, undefined, false, undefined, this),
          items.map((it) => {
            const on = selected.has(it.id);
            return /* @__PURE__ */ jsxDEV4("li", {
              children: /* @__PURE__ */ jsxDEV4("button", {
                type: "button",
                className: on ? `${styles_module_default2.row} ${styles_module_default2.rowOn}` : styles_module_default2.row,
                onClick: (ev) => onToggle(it.id, ev.ctrlKey || ev.metaKey),
                children: [
                  /* @__PURE__ */ jsxDEV4("span", {
                    className: on ? `${styles_module_default2.cb} ${styles_module_default2.cbOn}` : styles_module_default2.cb
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV4("span", {
                    className: styles_module_default2.lbl,
                    children: it.label
                  }, undefined, false, undefined, this),
                  it.meta && /* @__PURE__ */ jsxDEV4("span", {
                    className: styles_module_default2.meta,
                    children: it.meta
                  }, undefined, false, undefined, this)
                ]
              }, undefined, true, undefined, this)
            }, it.id, false, undefined, this);
          })
        ]
      }, undefined, true, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
function TransferBench({
  leftTitle,
  rightTitle,
  left,
  right,
  name,
  namePlaceholder = "Name for the new book",
  applyLabel = "Apply",
  requireMoved = true,
  onName,
  onMoveToRight,
  onMoveToLeft,
  onReorderRight,
  onApply,
  onCancel,
  busy = false,
  note
}) {
  const [selLeft, setSelLeft] = useState2(() => new Set);
  const [selRight, setSelRight] = useState2(() => new Set);
  const toggle = (set, id, multi) => {
    set((prev) => {
      const next = multi ? new Set(prev) : new Set;
      if (prev.has(id) && multi)
        next.delete(id);
      else
        next.add(id);
      return next;
    });
  };
  const canApply = !busy && name.trim().length > 0 && (!requireMoved || right.length > 0);
  return /* @__PURE__ */ jsxDEV4("div", {
    className: styles_module_default2.wrap,
    children: [
      /* @__PURE__ */ jsxDEV4("label", {
        className: styles_module_default2.nameRow,
        children: [
          /* @__PURE__ */ jsxDEV4("span", {
            children: "Name"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV4("input", {
            value: name,
            placeholder: namePlaceholder,
            "aria-label": "Book name",
            onChange: (ev) => onName(ev.target.value)
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      note && /* @__PURE__ */ jsxDEV4("p", {
        className: styles_module_default2.note,
        children: note
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV4("div", {
        className: styles_module_default2.bench,
        children: [
          /* @__PURE__ */ jsxDEV4(List, {
            title: leftTitle,
            items: left,
            selected: selLeft,
            onToggle: (id, multi) => toggle(setSelLeft, id, multi),
            onSelectAll: () => setSelLeft(new Set(left.map((i) => i.id)))
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV4("div", {
            className: styles_module_default2.mid,
            children: [
              /* @__PURE__ */ jsxDEV4("button", {
                type: "button",
                className: styles_module_default2.arrow,
                disabled: selLeft.size === 0,
                "aria-label": "Move selected to right",
                onClick: () => {
                  onMoveToRight([...selLeft]);
                  setSelLeft(new Set);
                },
                children: "→"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV4("button", {
                type: "button",
                className: styles_module_default2.arrow,
                disabled: selRight.size === 0,
                "aria-label": "Move selected to left",
                onClick: () => {
                  onMoveToLeft([...selRight]);
                  setSelRight(new Set);
                },
                children: "←"
              }, undefined, false, undefined, this),
              onReorderRight && /* @__PURE__ */ jsxDEV4(Fragment, {
                children: [
                  /* @__PURE__ */ jsxDEV4("button", {
                    type: "button",
                    className: styles_module_default2.arrow,
                    disabled: selRight.size !== 1,
                    "aria-label": "Move selected up",
                    onClick: () => {
                      const id = [...selRight][0];
                      if (id)
                        onReorderRight(id, -1);
                    },
                    children: "↑"
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV4("button", {
                    type: "button",
                    className: styles_module_default2.arrow,
                    disabled: selRight.size !== 1,
                    "aria-label": "Move selected down",
                    onClick: () => {
                      const id = [...selRight][0];
                      if (id)
                        onReorderRight(id, 1);
                    },
                    children: "↓"
                  }, undefined, false, undefined, this)
                ]
              }, undefined, true, undefined, this)
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV4(List, {
            title: rightTitle,
            items: right,
            selected: selRight,
            onToggle: (id, multi) => toggle(setSelRight, id, multi),
            onSelectAll: () => setSelRight(new Set(right.map((i) => i.id)))
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV4("div", {
        className: styles_module_default2.foot,
        children: [
          /* @__PURE__ */ jsxDEV4("button", {
            type: "button",
            className: styles_module_default2.cancel,
            onClick: onCancel,
            disabled: busy,
            children: "Cancel"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV4("button", {
            type: "button",
            className: styles_module_default2.apply,
            disabled: !canApply,
            onClick: onApply,
            children: busy ? "Working…" : applyLabel
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this)
    ]
  }, undefined, true, undefined, this);
}

// src/ui/apps/library/lore-workshop-dialog.tsx
import { jsxDEV as jsxDEV5 } from "react/jsx-dev-runtime";
var isRec2 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
async function loadBody(ctx, s) {
  const raw = await ctx.api.getEntity(`kind=${encodeURIComponent(s.kind)}&id=${encodeURIComponent(s.id)}`);
  const e = isRec2(raw) ? raw : {};
  const b = isRec2(e.body) ? e.body : null;
  if (!b || !Array.isArray(b.entries)) {
    throw new Error("workshop: could not load lorebook body");
  }
  return structuredClone(b);
}
function itemsFrom(body, ids) {
  const want = new Set(ids);
  return body.entries.filter((e) => want.has(e.id)).map((e) => ({
    id: e.id,
    label: e.title || "(untitled)",
    meta: `~${estimateEntryTokens(e)}t`
  }));
}
function allItems(body) {
  return body.entries.map((e) => ({
    id: e.id,
    label: e.title || "(untitled)",
    meta: `~${estimateEntryTokens(e)}t`
  }));
}
function LoreWorkshopDialog({
  ctx,
  state,
  onDone,
  onDismiss
}) {
  const [busy, setBusy] = useState3(false);
  const [error, setError] = useState3(null);
  const [sourceBody, setSourceBody] = useState3(null);
  const [otherBody, setOtherBody] = useState3(null);
  const [leftIds, setLeftIds] = useState3([]);
  const [rightIds, setRightIds] = useState3([]);
  const [name, setName] = useState3("");
  useEffect4(() => {
    let cancelled = false;
    (async () => {
      try {
        const src = await loadBody(ctx, state.source);
        if (cancelled)
          return;
        setSourceBody(src);
        if (state.mode === "split") {
          const seed = new Set(state.seedMovedIds ?? []);
          const moved = src.entries.filter((e) => seed.has(e.id)).map((e) => e.id);
          const kept = src.entries.filter((e) => !seed.has(e.id)).map((e) => e.id);
          setLeftIds(moved.length > 0 ? kept : src.entries.map((e) => e.id));
          setRightIds(moved);
          setName(moved.length > 0 ? `${src.name.trim() || "Book"} (split)` : `${src.name.trim() || "Book"} (split)`);
        } else {
          const other = state.other ? await loadBody(ctx, state.other) : null;
          if (cancelled)
            return;
          setOtherBody(other);
          setLeftIds(src.entries.map((e) => e.id));
          setRightIds(other ? other.entries.map((e) => e.id) : []);
          setName([src.name, other?.name].map((n) => (n ?? "").trim()).filter(Boolean).join(" + ") || "Merged lorebook");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "failed to load books");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ctx, state]);
  const leftItems = useMemo(() => {
    if (!sourceBody)
      return [];
    if (state.mode === "merge" && otherBody) {
      return allItems(sourceBody);
    }
    return itemsFrom(sourceBody, leftIds);
  }, [sourceBody, otherBody, leftIds, state.mode]);
  const rightItems = useMemo(() => {
    if (state.mode === "merge" && otherBody)
      return allItems(otherBody);
    if (!sourceBody)
      return [];
    return itemsFrom(sourceBody, rightIds);
  }, [sourceBody, otherBody, rightIds, state.mode]);
  const moveToRight = useCallback((ids) => {
    if (state.mode === "merge")
      return;
    setLeftIds((L) => L.filter((id) => !ids.includes(id)));
    setRightIds((R) => [...R, ...ids.filter((id) => !R.includes(id))]);
  }, [state.mode]);
  const moveToLeft = useCallback((ids) => {
    if (state.mode === "merge")
      return;
    setRightIds((R) => R.filter((id) => !ids.includes(id)));
    setLeftIds((L) => [...L, ...ids.filter((id) => !L.includes(id))]);
  }, [state.mode]);
  const reorderRight = useCallback((id, dir) => {
    setRightIds((R) => {
      const at = R.indexOf(id);
      if (at < 0)
        return R;
      const to = at + dir;
      if (to < 0 || to >= R.length)
        return R;
      const next = [...R];
      const [row] = next.splice(at, 1);
      next.splice(to, 0, row);
      return next;
    });
  }, []);
  const apply = useCallback(async () => {
    if (!sourceBody || busy)
      return;
    const nm = name.trim();
    if (!nm)
      return;
    setBusy(true);
    setError(null);
    try {
      if (state.mode === "split") {
        if (rightIds.length === 0) {
          setError("Move at least one entry into the new book.");
          setBusy(false);
          return;
        }
        const { remainder, split } = splitBook(sourceBody, rightIds, nm);
        await ctx.api.saveEntity({
          schemaVersion: CANONICAL_SCHEMA_VERSION,
          kind: "lorebook",
          id: "lorebook",
          body: split
        });
        try {
          const raw = await ctx.api.getEntity(`kind=lorebook&id=${encodeURIComponent(state.source.id)}`);
          const original = isRec2(raw) && isRec2(raw.original) ? raw.original : {};
          await ctx.api.saveEntity({
            schemaVersion: CANONICAL_SCHEMA_VERSION,
            kind: "lorebook",
            id: state.source.id,
            body: remainder,
            original
          }, { overwrite: true });
        } catch (e) {
          setError(`New book was created, but updating the original failed: ${e instanceof Error ? e.message : String(e)}. Nothing was deleted.`);
          setBusy(false);
          return;
        }
        ctx.setStatus(`split into "${nm}"`);
      } else {
        if (!otherBody || !state.other) {
          setError("Pick a second book to merge.");
          setBusy(false);
          return;
        }
        const merged = mergeBooks(sourceBody, otherBody, nm);
        await ctx.api.saveEntity({
          schemaVersion: CANONICAL_SCHEMA_VERSION,
          kind: "lorebook",
          id: "lorebook",
          body: merged
        });
        ctx.setStatus(`merged into "${nm}" (originals kept)`);
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "apply failed");
    } finally {
      setBusy(false);
    }
  }, [
    sourceBody,
    otherBody,
    busy,
    name,
    state,
    rightIds,
    ctx,
    onDone
  ]);
  const note = state.mode === "split" ? "Create the new book first, then update this one. If the second save fails, the new book stays and nothing is deleted." : "Creates a third book with both entry sets. The two originals stay on the shelf.";
  return /* @__PURE__ */ jsxDEV5(InkDialog, {
    onDismiss,
    ariaLabel: state.mode === "split" ? "Split lorebook" : "Merge lorebooks",
    children: error && !sourceBody ? /* @__PURE__ */ jsxDEV5("div", {
      style: { padding: "1rem" },
      children: [
        /* @__PURE__ */ jsxDEV5("p", {
          children: error
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV5("button", {
          type: "button",
          onClick: onDismiss,
          children: "Close"
        }, undefined, false, undefined, this)
      ]
    }, undefined, true, undefined, this) : /* @__PURE__ */ jsxDEV5(TransferBench, {
      leftTitle: state.mode === "split" ? "Stays here" : state.source.name,
      rightTitle: state.mode === "split" ? "New book" : state.other?.name ?? "Other book",
      left: leftItems,
      right: rightItems,
      name,
      namePlaceholder: state.mode === "split" ? "Name for the new book" : "Name for the merged book",
      applyLabel: state.mode === "split" ? `Apply split (${rightIds.length})` : "Create merged book",
      requireMoved: state.mode === "split",
      onName: setName,
      onMoveToRight: moveToRight,
      onMoveToLeft: moveToLeft,
      onReorderRight: state.mode === "split" ? reorderRight : undefined,
      onApply: () => void apply(),
      onCancel: onDismiss,
      busy,
      note: error ? `${note} ${error}` : note
    }, undefined, false, undefined, this)
  }, undefined, false, undefined, this);
}

// src/ui/apps/library/lore-shelf-ops.ts
var isRec3 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
async function loadLoreMeta(ctx, list) {
  const books = list.filter((e) => e.kind === "lorebook");
  const next = {};
  for (const b of books) {
    try {
      const raw = await ctx.api.getEntity(`kind=lorebook&id=${encodeURIComponent(b.id)}`);
      const body = isRec3(raw) && isRec3(raw.body) ? raw.body : null;
      if (!body)
        continue;
      const searchKeys = (body.entries ?? []).flatMap((e) => e.triggers.map((t) => t.keyword).filter(Boolean));
      next[b.id] = {
        enabled: body.enabled !== false,
        entryCount: Array.isArray(body.entries) ? body.entries.length : 0,
        searchKeys
      };
    } catch {}
  }
  return next;
}
function attachSearchKeys(entities, loreMeta) {
  return entities.map((e) => {
    if (e.kind !== "lorebook")
      return e;
    const keys = loreMeta[e.id]?.searchKeys;
    return keys ? { ...e, searchKeys: keys } : e;
  });
}
function makeLoreShelf(args) {
  const { ctx, loreMeta, setLoreMeta, setWorkshop, reload } = args;
  return {
    enabledOf: (e) => loreMeta[e.id]?.enabled !== false,
    entryCountOf: (e) => loreMeta[e.id]?.entryCount,
    onToggleEnabled: (e, on) => {
      (async () => {
        try {
          const raw = await ctx.api.getEntity(`kind=lorebook&id=${encodeURIComponent(e.id)}`);
          if (!isRec3(raw) || !isRec3(raw.body))
            return;
          const body = {
            ...raw.body,
            enabled: on
          };
          await ctx.api.saveEntity({
            schemaVersion: CANONICAL_SCHEMA_VERSION,
            kind: "lorebook",
            id: e.id,
            body,
            original: isRec3(raw.original) ? raw.original : {}
          }, { overwrite: true });
          setLoreMeta((m) => ({
            ...m,
            [e.id]: {
              enabled: on,
              entryCount: m[e.id]?.entryCount ?? body.entries?.length ?? 0,
              searchKeys: m[e.id]?.searchKeys ?? []
            }
          }));
          ctx.setStatus(on ? `${e.name} is on` : `${e.name} is off (skipped on export)`);
        } catch (err) {
          ctx.setStatus(err instanceof Error ? err.message : "toggle failed");
        }
      })();
    },
    onSplit: (e) => setWorkshop({ mode: "split", source: e }),
    onMerge: (into, from) => setWorkshop({ mode: "merge", source: into, other: from }),
    onDuplicate: (e) => {
      (async () => {
        try {
          const raw = await ctx.api.getEntity(`kind=lorebook&id=${encodeURIComponent(e.id)}`);
          if (!isRec3(raw) || !isRec3(raw.body))
            return;
          const body = duplicateBook(raw.body, `${e.name} (copy)`);
          const saved = await ctx.api.saveEntity({
            schemaVersion: CANONICAL_SCHEMA_VERSION,
            kind: "lorebook",
            id: "lorebook",
            body
          });
          reload();
          ctx.setStatus(`duplicated · ${saved.name || body.name}`);
        } catch (err) {
          ctx.setStatus(err instanceof Error ? err.message : "duplicate failed");
        }
      })();
    }
  };
}
// src/core/regex/ast/explain.ts
function explainAst(ast, flags = "") {
  const jsFlags = flags.replace(/<[^>]*>/g, "");
  const ctx = { multiline: jsFlags.includes("m"), dotAll: jsFlags.includes("s") };
  const body = describeAlternation(ast, ctx);
  const text = body === EMPTY ? "This pattern is empty: it matches an empty spot." : `${capitalize(body)}.`;
  return { text, flagNotes: flagNotes(jsFlags) };
}
var EMPTY = "nothing";
function flagNotes(jsFlags) {
  const notes = [];
  if (jsFlags.includes("i"))
    notes.push("Matching ignores whether letters are capital or lowercase.");
  if (jsFlags.includes("g"))
    notes.push("Finds every match in the text, not just the first.");
  return notes;
}
function describeNode(node, ctx) {
  switch (node.type) {
    case "alternation":
      return describeAlternation(node, ctx);
    case "sequence":
      return describeSequence(node, ctx);
    case "literal":
      return describeLiteral(node);
    case "dot":
      return ctx.dotAll ? "any character, including line breaks" : "any character except a line break";
    case "anchor":
      return describeAnchor(node, ctx);
    case "class-escape":
      return CLASS_ESCAPE_TOP[node.letter];
    case "unicode-property":
      return describeProperty(node, false);
    case "char-class":
      return describeClass(node);
    case "quantifier":
      return describeQuantifier(node, ctx);
    case "group":
      return describeGroup(node, ctx);
    case "lookaround":
      return describeLookaround(node, ctx);
    case "backreference":
      return describeBackreference(node);
    default:
      return assertNever("regex/explain", node);
  }
}
function describeAlternation(node, ctx) {
  const alts = node.alternatives.map((alt) => describeSequence(alt, ctx));
  if (alts.length === 1)
    return alts[0];
  return `either ${joinList(alts, "or")}`;
}
function describeSequence(node, ctx) {
  const pieces = [];
  let run = "";
  const flush = () => {
    if (run.length === 0)
      return;
    pieces.push(run.length === 1 ? `the character "${run}"` : `the text "${run}"`);
    run = "";
  };
  for (const el of node.elements) {
    if (el.type === "literal" && controlName(el.codePoint) === null) {
      run += el.value;
      continue;
    }
    flush();
    pieces.push(describeNode(el, ctx));
  }
  flush();
  if (pieces.length === 0)
    return EMPTY;
  if (pieces.length === 1)
    return pieces[0];
  return pieces.join(", then ");
}
function describeLiteral(node) {
  const control = controlName(node.codePoint);
  if (control !== null)
    return control;
  return `the character "${node.value}"`;
}
function describeAnchor(node, ctx) {
  switch (node.kind) {
    case "line-start":
      return ctx.multiline ? "the start of a line" : "the start of the text";
    case "line-end":
      return ctx.multiline ? "the end of a line" : "the end of the text";
    case "word-boundary":
      return "the edge of a word";
    case "non-word-boundary":
      return "a spot that is not the edge of a word";
    default:
      return assertNever("regex/explain", node.kind);
  }
}
var CLASS_ESCAPE_TOP = {
  d: "any digit",
  D: "any character that is not a digit",
  w: "any English letter, digit, or underscore",
  W: "any character that is not an English letter, digit, or underscore",
  s: "any space, tab, or line break",
  S: "any character that is not a space, tab, or line break"
};
var CLASS_ESCAPE_ITEM = {
  d: "a digit",
  D: "a character that is not a digit",
  w: "an English letter, digit, or underscore",
  W: "a character that is not an English letter, digit, or underscore",
  s: "a space, tab, or line break",
  S: "a character that is not a space, tab, or line break"
};
function describeProperty(node, inClass) {
  const lead = inClass ? "a character" : "any character";
  if (node.value !== undefined) {
    const not = node.negated ? " not" : "";
    return `${lead} whose Unicode "${node.name}" is${not} "${node.value}"`;
  }
  const relation = node.negated ? "not in" : "in";
  return `${lead} ${relation} the Unicode group "${node.name}"`;
}
function describeClass(node) {
  if (isAnyCharClass(node))
    return "any character, including line breaks";
  const items = node.items.map(describeClassItem);
  const list = joinList(items, "or");
  return node.negated ? `any character except ${list}` : `any of: ${list}`;
}
function describeClassItem(item) {
  switch (item.type) {
    case "literal":
      return charLabel(item);
    case "class-range":
      return `${charLabel(item.from)} through ${charLabel(item.to)}`;
    case "class-escape":
      return CLASS_ESCAPE_ITEM[item.letter];
    case "unicode-property":
      return describeProperty(item, true);
    default:
      return assertNever("regex/explain", item);
  }
}
function describeQuantifier(node, ctx) {
  return `${describeNode(node.body, ctx)} ${countPhrase(node)}`;
}
function countPhrase(node) {
  const { min, max, lazy } = node;
  const lazyTail = lazy ? ", as few as possible" : "";
  let core;
  if (min === 0 && max === null)
    core = "zero or more times";
  else if (min === 1 && max === null)
    core = "one or more times";
  else if (min === 0 && max === 1)
    core = "optional";
  else if (max === null)
    core = `${min} or more times`;
  else if (max === min)
    core = max === 1 ? "exactly once" : `exactly ${max} times`;
  else
    core = `between ${min} and ${max} times`;
  return `(${core}${lazyTail})`;
}
function describeGroup(node, ctx) {
  const childCtx = node.modifiers ? applyModifiers(ctx, node.modifiers) : ctx;
  const inner = describeAlternation(node.body, childCtx);
  if (node.modifiers) {
    const changes = modifierChanges(node.modifiers);
    return changes === null ? `a group of: ${inner}` : `a group where ${changes}, containing: ${inner}`;
  }
  if (node.name !== null)
    return `a remembered piece named "${node.name}", containing: ${inner}`;
  if (node.capturing)
    return `a remembered piece (group ${node.index}), containing: ${inner}`;
  return `a group of: ${inner}`;
}
function describeLookaround(node, ctx) {
  const inner = describeAlternation(node.body, ctx);
  const direction = node.ahead ? "followed by" : "preceded by";
  const relation = node.negative ? `must not be ${direction}` : `must be ${direction}`;
  return `a spot that ${relation}: ${inner}`;
}
function describeBackreference(node) {
  return typeof node.ref === "number" ? `the same text that remembered piece (group ${node.ref}) matched` : `the same text that the piece named "${node.ref}" matched`;
}
function isAnyCharClass(node) {
  if (node.negated || node.items.length !== 2)
    return false;
  const [a, b] = node.items;
  if (a?.type !== "class-escape" || b?.type !== "class-escape")
    return false;
  return a.letter.toLowerCase() === b.letter.toLowerCase() && a.letter !== b.letter;
}
function applyModifiers(ctx, mods) {
  if (mods === null)
    return ctx;
  let multiline = ctx.multiline;
  let dotAll = ctx.dotAll;
  if (mods.add.includes("m"))
    multiline = true;
  if (mods.remove.includes("m"))
    multiline = false;
  if (mods.add.includes("s"))
    dotAll = true;
  if (mods.remove.includes("s"))
    dotAll = false;
  return { multiline, dotAll };
}
var MODIFIER_LABEL = {
  i: "capital and lowercase letters are treated the same",
  m: "the start and end marks apply to each line",
  s: "the any-character mark also matches line breaks"
};
function modifierChanges(mods) {
  if (mods === null)
    return null;
  const parts = [];
  for (const f of mods.add) {
    const label = MODIFIER_LABEL[f];
    if (label !== undefined)
      parts.push(label);
  }
  for (const f of mods.remove) {
    const label = MODIFIER_LABEL[f];
    if (label !== undefined)
      parts.push(`${label} is turned off`);
  }
  return parts.length === 0 ? null : joinList(parts, "and");
}
function charLabel(node) {
  return controlName(node.codePoint) ?? `"${node.value}"`;
}
function controlName(codePoint) {
  switch (codePoint) {
    case 10:
      return "a line break";
    case 13:
      return "a carriage return";
    case 9:
      return "a tab";
    case 12:
      return "a form feed";
    case 11:
      return "a vertical tab";
    case 0:
      return "a null character";
    default:
      if (codePoint < 32 || codePoint === 127)
        return `a control character (code ${codePoint})`;
      return null;
  }
}
function joinList(items, conjunction) {
  if (items.length === 0)
    return "";
  if (items.length === 1)
    return items[0];
  if (items.length === 2)
    return `${items[0]} ${conjunction} ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, ${conjunction} ${items[items.length - 1]}`;
}
function capitalize(text) {
  return text.length === 0 ? text : text[0]?.toUpperCase() + text.slice(1);
}

// src/core/regex/word-boundary.ts
var WB_LOOKBEHIND = "(?<![\\p{L}\\p{N}_])";
var WB_LOOKAHEAD = "(?![\\p{L}\\p{N}_])";
function unwrapWordBoundary(pattern) {
  if (pattern.startsWith("\\b") && pattern.endsWith("\\b") && pattern.length > 4) {
    return { core: pattern.slice(2, -2), wholeWord: true };
  }
  const min = WB_LOOKBEHIND.length + WB_LOOKAHEAD.length;
  if (pattern.startsWith(WB_LOOKBEHIND) && pattern.endsWith(WB_LOOKAHEAD) && pattern.length > min) {
    return { core: pattern.slice(WB_LOOKBEHIND.length, -WB_LOOKAHEAD.length), wholeWord: true };
  }
  return { core: pattern, wholeWord: false };
}

// src/core/regex/builder.ts
var REGEX_SPECIALS = new Set([
  ".",
  "*",
  "+",
  "?",
  "^",
  "$",
  "{",
  "}",
  "(",
  ")",
  "|",
  "[",
  "]",
  "\\"
]);
var escapeWord = (word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
var ADVANCED_NOTE = "plus advanced parts outside the words vocabulary";
function unescapeWord(member) {
  let out = "";
  for (let i = 0;i < member.length; i++) {
    const c = member[i];
    if (c === undefined)
      break;
    if (c === "\\") {
      const next = member[i + 1];
      if (next === undefined || !REGEX_SPECIALS.has(next))
        return null;
      out += next;
      i++;
      continue;
    }
    if (REGEX_SPECIALS.has(c))
      return null;
    out += c;
  }
  return escapeWord(out) === member ? out : null;
}
function splitAlternation(inner) {
  const parts = [];
  let cur = "";
  for (let i = 0;i < inner.length; i++) {
    const c = inner[i];
    if (c === "\\") {
      cur += c + (inner[i + 1] ?? "");
      i++;
      continue;
    }
    if (c === "(" || c === ")")
      return null;
    if (c === "|") {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  parts.push(cur);
  return parts;
}
function decompileWords(pattern, flags) {
  const known = new Set(["i", "u"]);
  if ([...flags].some((f) => !known.has(f)))
    return null;
  const unwrapped = unwrapWordBoundary(pattern);
  if (!unwrapped.wholeWord)
    return null;
  const core = unwrapped.core;
  let members;
  if (core.startsWith("(") && core.endsWith(")")) {
    let depth = 0;
    for (let i = 0;i < core.length; i++) {
      const c = core[i];
      if (c === "\\") {
        i++;
        continue;
      }
      if (c === "(")
        depth++;
      else if (c === ")") {
        depth--;
        if (depth === 0 && i !== core.length - 1)
          return null;
      }
    }
    if (depth !== 0)
      return null;
    const split = splitAlternation(core.slice(1, -1));
    if (!split)
      return null;
    members = split;
  } else {
    const split = splitAlternation(core);
    if (!split || split.length !== 1)
      return null;
    members = split;
  }
  if (members.some((m) => m.length === 0))
    return null;
  const words = [];
  for (const m of members) {
    const word = unescapeWord(m);
    if (word === null)
      return null;
    words.push(word);
  }
  return words;
}
function extractKnownWords(pattern) {
  const found = [];
  const push = (w) => {
    if (w.length >= 2 && !found.includes(w))
      found.push(w);
  };
  for (const altGroup of pattern.match(/\(([^()]+\|[^()]+)\)/g) ?? []) {
    const inner = altGroup.slice(1, -1);
    const parts = splitAlternation(inner) ?? [];
    for (const part of parts) {
      const word = unescapeWord(part);
      if (word !== null)
        push(word);
    }
  }
  const boundaryPattern = /\\b([a-zA-Z']+)\\b/g;
  for (const m of pattern.matchAll(boundaryPattern)) {
    if (m[1] !== undefined)
      push(m[1]);
  }
  if (found.length === 0) {
    for (const lit of pattern.match(/[a-zA-Z]{3,}/g) ?? [])
      push(lit);
  }
  return found.slice(0, 12);
}
function explainPattern(find, flags) {
  if (!find)
    return { phrases: [], complete: true };
  const parsed = parseRegex(find);
  const reading = "ast" in parsed ? explainAst(parsed.ast, flags).text : undefined;
  const exact = decompileWords(find, flags);
  if (exact !== null) {
    return { phrases: exact, complete: true, ...reading !== undefined ? { reading } : {} };
  }
  const known = extractKnownWords(find);
  return {
    phrases: known,
    complete: false,
    note: ADVANCED_NOTE,
    ...reading !== undefined ? { reading } : {}
  };
}
// src/core/regex/word-builder.ts
var REGEX_SPECIALS2 = new Set([".", "*", "+", "?", "^", "$", "{", "}", "(", ")", "|", "[", "]", "\\"]);
// src/core/regex/ast/examples.ts
var LOWER = "abcdefghijklmnopqrstuvwxyz";
var UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
var DIGITS = "0123456789";
var WORD = LOWER + UPPER + DIGITS + "_";
var NON_SPACE = LOWER + UPPER + DIGITS + "._-";
var NON_DIGIT = LOWER + UPPER + " ._-";
var DOT_ALPHABET = LOWER + UPPER + DIGITS + " ._-";
var FUZZ_ALPHABET = LOWER + UPPER + DIGITS + " \t._-!@#$?αΩБ你";
// src/core/regex/inspect.ts
var SLOW_COMPLEXITY = 20;
function slowRuleCount(body) {
  let count = 0;
  for (const rule of body.rules) {
    if (!rule.enabled)
      continue;
    const v = validateRule(rule);
    if (v.ok && v.complexity >= SLOW_COMPLEXITY)
      count += 1;
  }
  return count;
}
// src/entities/regex/schema.ts
var emptyRegexSetBody = (name) => ({
  name,
  rules: []
});
// src/ui/apps/library/new-regex-set.ts
async function createAndOpenRegexSet(ctx) {
  const body = emptyRegexSetBody("Untitled regex set");
  const saved = await ctx.api.saveEntity({
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "regex",
    id: "regex",
    body
  });
  return {
    id: saved.id,
    kind: "regex",
    name: saved.name || body.name,
    accent: saved.accent
  };
}

// src/ui/apps/library/regex-shelf-ops.ts
var isRec4 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var renumber2 = (rules) => [...rules].sort((a, b) => a.sortOrder - b.sortOrder).map((r, i) => ({ ...r, sortOrder: i * 10 }));
var freshRuleIds = (rules, prefix) => {
  const idMap = new Map;
  rules.forEach((r, i) => idMap.set(r.id, `${prefix}${i + 1}`));
  return rules.map((r, i) => {
    const clone = structuredClone(r);
    clone.id = `${prefix}${i + 1}`;
    if (clone.condition) {
      const mapped = idMap.get(clone.condition.ruleId);
      if (mapped)
        clone.condition = { ...clone.condition, ruleId: mapped };
    }
    return clone;
  });
};
function duplicateSet(body, name) {
  const n = name.trim() || `${body.name.trim() || "Regex set"} (copy)`;
  return {
    ...structuredClone(body),
    name: n,
    rules: renumber2(freshRuleIds(body.rules ?? [], "dup_"))
  };
}
function mergeSets(a, b, newName) {
  const name = newName?.trim() || [a.name, b.name].map((s) => s.trim()).filter(Boolean).join(" + ") || "Merged regex set";
  const combined = [...freshRuleIds(a.rules ?? [], "m_a_"), ...freshRuleIds(b.rules ?? [], "m_b_")];
  return {
    name,
    ...a.description ?? b.description ? { description: a.description ?? b.description } : {},
    rules: renumber2(combined)
  };
}
function splitSet(body, movedIds, newName) {
  if (movedIds.length === 0) {
    throw new Error("regex-shelf: split needs at least one rule to move");
  }
  const name = newName.trim() || "Split regex set";
  const want = new Set(movedIds);
  const rules = body.rules ?? [];
  const moved = rules.filter((r) => want.has(r.id));
  const kept = rules.filter((r) => !want.has(r.id));
  if (moved.length === 0) {
    throw new Error("regex-shelf: none of the moved ids exist in the set");
  }
  const remainder = { ...structuredClone(body), rules: renumber2(kept) };
  const split = {
    name,
    ...body.description ? { description: body.description } : {},
    rules: renumber2(structuredClone(moved))
  };
  return { remainder, split };
}
var ruleLabel = (r) => {
  const label = r.label?.trim();
  if (label)
    return label;
  const ex = explainPattern(r.find, r.flags);
  if (ex.phrases.length > 0)
    return `match ${ex.phrases.slice(0, 3).join("/")}`;
  return "";
};
function doesWhatForSet(body) {
  const desc = body.description?.trim();
  if (desc)
    return desc;
  const rules = body.rules ?? [];
  if (rules.length === 0)
    return "No rules yet.";
  const labels = rules.map(ruleLabel).filter((l) => l.length > 0);
  if (labels.length === 0) {
    return `${rules.length} ${rules.length === 1 ? "rule" : "rules"}, unnamed.`;
  }
  const shown = labels.slice(0, 3);
  const extra = labels.length - shown.length;
  return extra > 0 ? `${shown.join(", ")} +${extra} more` : shown.join(", ");
}
async function loadRegexMeta(ctx, list) {
  const sets = list.filter((e) => e.kind === "regex");
  const next = {};
  for (const s of sets) {
    try {
      const raw = await ctx.api.getEntity(`kind=regex&id=${encodeURIComponent(s.id)}`);
      const body = isRec4(raw) && isRec4(raw.body) ? raw.body : null;
      if (!body)
        continue;
      const rules = Array.isArray(body.rules) ? body.rules : [];
      next[s.id] = {
        enabled: body.enabled !== false,
        ruleCount: rules.length,
        enabledRuleCount: rules.filter((r) => r.enabled !== false).length,
        doesWhat: doesWhatForSet(body),
        slowCount: slowRuleCount(body)
      };
    } catch {}
  }
  return next;
}
function makeRegexShelf(args) {
  const { ctx, regexMeta, setRegexMeta, setWorkshop, reload } = args;
  return {
    enabledOf: (e) => regexMeta[e.id]?.enabled !== false,
    ruleCountOf: (e) => regexMeta[e.id]?.ruleCount,
    enabledRuleCountOf: (e) => regexMeta[e.id]?.enabledRuleCount,
    doesWhatOf: (e) => regexMeta[e.id]?.doesWhat,
    slowCountOf: (e) => regexMeta[e.id]?.slowCount,
    onToggleEnabled: (e, on) => {
      (async () => {
        try {
          const raw = await ctx.api.getEntity(`kind=regex&id=${encodeURIComponent(e.id)}`);
          if (!isRec4(raw) || !isRec4(raw.body))
            return;
          const body = { ...raw.body, enabled: on };
          await ctx.api.saveEntity({
            schemaVersion: CANONICAL_SCHEMA_VERSION,
            kind: "regex",
            id: e.id,
            body,
            original: isRec4(raw.original) ? raw.original : {}
          }, { overwrite: true });
          setRegexMeta((m) => ({
            ...m,
            [e.id]: {
              enabled: on,
              ruleCount: m[e.id]?.ruleCount ?? body.rules?.length ?? 0,
              enabledRuleCount: m[e.id]?.enabledRuleCount ?? 0,
              slowCount: m[e.id]?.slowCount ?? slowRuleCount(body),
              doesWhat: m[e.id]?.doesWhat ?? doesWhatForSet(body)
            }
          }));
          ctx.setStatus(on ? `${e.name} is on` : `${e.name} is off (skipped on export)`);
        } catch (err) {
          ctx.setStatus(err instanceof Error ? err.message : "toggle failed");
        }
      })();
    },
    onSplit: (e) => setWorkshop({ mode: "split", source: e }),
    onMerge: (into, from) => setWorkshop({ mode: "merge", source: into, other: from }),
    onDuplicate: (e) => {
      (async () => {
        try {
          const raw = await ctx.api.getEntity(`kind=regex&id=${encodeURIComponent(e.id)}`);
          if (!isRec4(raw) || !isRec4(raw.body))
            return;
          const body = duplicateSet(raw.body, `${e.name} (copy)`);
          const saved = await ctx.api.saveEntity({
            schemaVersion: CANONICAL_SCHEMA_VERSION,
            kind: "regex",
            id: "regex",
            body
          });
          reload();
          ctx.setStatus(`duplicated · ${saved.name || body.name}`);
        } catch (err) {
          ctx.setStatus(err instanceof Error ? err.message : "duplicate failed");
        }
      })();
    },
    onNew: () => {
      (async () => {
        try {
          const summary = await createAndOpenRegexSet(ctx);
          reload();
          ctx.workbench.open(summary);
          ctx.setStatus(`opened regex set · ${summary.name}`);
        } catch (err) {
          ctx.setStatus(err instanceof Error ? err.message : "could not create set");
        }
      })();
    }
  };
}

// src/ui/apps/library/regex-workshop-dialog.tsx
import { useCallback as useCallback2, useEffect as useEffect5, useMemo as useMemo2, useState as useState4 } from "react";
import { jsxDEV as jsxDEV6 } from "react/jsx-dev-runtime";
var isRec5 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
async function loadBody2(ctx, s) {
  const raw = await ctx.api.getEntity(`kind=regex&id=${encodeURIComponent(s.id)}`);
  const e = isRec5(raw) ? raw : {};
  const b = isRec5(e.body) ? e.body : null;
  if (!b || !Array.isArray(b.rules)) {
    throw new Error("workshop: could not load regex set");
  }
  return structuredClone(b);
}
var itemOf = (r) => ({
  id: r.id,
  label: r.label?.trim() || "(unnamed rule)",
  meta: r.enabled !== false ? "on" : "off"
});
function itemsFrom2(body, ids) {
  const want = new Set(ids);
  return body.rules.filter((r) => want.has(r.id)).map(itemOf);
}
var allItems2 = (body) => body.rules.map(itemOf);
function RegexWorkshopDialog({
  ctx,
  state,
  onDone,
  onDismiss
}) {
  const [busy, setBusy] = useState4(false);
  const [error, setError] = useState4(null);
  const [sourceBody, setSourceBody] = useState4(null);
  const [otherBody, setOtherBody] = useState4(null);
  const [leftIds, setLeftIds] = useState4([]);
  const [rightIds, setRightIds] = useState4([]);
  const [name, setName] = useState4("");
  useEffect5(() => {
    let cancelled = false;
    (async () => {
      try {
        const src = await loadBody2(ctx, state.source);
        if (cancelled)
          return;
        setSourceBody(src);
        if (state.mode === "split") {
          setLeftIds(src.rules.map((r) => r.id));
          setRightIds([]);
          setName(`${src.name.trim() || "Set"} (split)`);
        } else {
          const other = state.other ? await loadBody2(ctx, state.other) : null;
          if (cancelled)
            return;
          setOtherBody(other);
          setLeftIds(src.rules.map((r) => r.id));
          setRightIds(other ? other.rules.map((r) => r.id) : []);
          setName([src.name, other?.name].map((n) => (n ?? "").trim()).filter(Boolean).join(" + ") || "Merged regex set");
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "failed to load sets");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ctx, state]);
  const leftItems = useMemo2(() => {
    if (!sourceBody)
      return [];
    if (state.mode === "merge")
      return allItems2(sourceBody);
    return itemsFrom2(sourceBody, leftIds);
  }, [sourceBody, leftIds, state.mode]);
  const rightItems = useMemo2(() => {
    if (state.mode === "merge" && otherBody)
      return allItems2(otherBody);
    if (!sourceBody)
      return [];
    return itemsFrom2(sourceBody, rightIds);
  }, [sourceBody, otherBody, rightIds, state.mode]);
  const moveToRight = useCallback2((ids) => {
    if (state.mode === "merge")
      return;
    setLeftIds((L) => L.filter((id) => !ids.includes(id)));
    setRightIds((R) => [...R, ...ids.filter((id) => !R.includes(id))]);
  }, [state.mode]);
  const moveToLeft = useCallback2((ids) => {
    if (state.mode === "merge")
      return;
    setRightIds((R) => R.filter((id) => !ids.includes(id)));
    setLeftIds((L) => [...L, ...ids.filter((id) => !L.includes(id))]);
  }, [state.mode]);
  const reorderRight = useCallback2((id, dir) => {
    setRightIds((R) => {
      const at = R.indexOf(id);
      if (at < 0)
        return R;
      const to = at + dir;
      if (to < 0 || to >= R.length)
        return R;
      const next = [...R];
      const [row] = next.splice(at, 1);
      next.splice(to, 0, row);
      return next;
    });
  }, []);
  const apply = useCallback2(async () => {
    if (!sourceBody || busy)
      return;
    const nm = name.trim();
    if (!nm)
      return;
    setBusy(true);
    setError(null);
    try {
      if (state.mode === "split") {
        if (rightIds.length === 0) {
          setError("Move at least one rule into the new set.");
          setBusy(false);
          return;
        }
        const { remainder, split } = splitSet(sourceBody, rightIds, nm);
        await ctx.api.saveEntity({
          schemaVersion: CANONICAL_SCHEMA_VERSION,
          kind: "regex",
          id: "regex",
          body: split
        });
        try {
          const raw = await ctx.api.getEntity(`kind=regex&id=${encodeURIComponent(state.source.id)}`);
          const original = isRec5(raw) && isRec5(raw.original) ? raw.original : {};
          await ctx.api.saveEntity({
            schemaVersion: CANONICAL_SCHEMA_VERSION,
            kind: "regex",
            id: state.source.id,
            body: remainder,
            original
          }, { overwrite: true });
        } catch (e) {
          setError(`New set was created, but updating the original failed: ${e instanceof Error ? e.message : String(e)}. Nothing was deleted.`);
          setBusy(false);
          return;
        }
        ctx.setStatus(`split into "${nm}"`);
      } else {
        if (!otherBody || !state.other) {
          setError("Pick a second set to merge.");
          setBusy(false);
          return;
        }
        const merged = mergeSets(sourceBody, otherBody, nm);
        await ctx.api.saveEntity({
          schemaVersion: CANONICAL_SCHEMA_VERSION,
          kind: "regex",
          id: "regex",
          body: merged
        });
        ctx.setStatus(`merged into "${nm}" (originals kept)`);
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "apply failed");
    } finally {
      setBusy(false);
    }
  }, [sourceBody, otherBody, busy, name, state, rightIds, ctx, onDone]);
  const note = state.mode === "split" ? "Create the new set first, then update this one. If the second save fails, the new set stays and nothing is deleted." : "Creates a third set with both rule lists. The two originals stay on the shelf.";
  return /* @__PURE__ */ jsxDEV6(InkDialog, {
    onDismiss,
    ariaLabel: state.mode === "split" ? "Split regex set" : "Merge regex sets",
    children: error && !sourceBody ? /* @__PURE__ */ jsxDEV6("div", {
      style: { padding: "1rem" },
      children: [
        /* @__PURE__ */ jsxDEV6("p", {
          children: error
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV6("button", {
          type: "button",
          onClick: onDismiss,
          children: "Close"
        }, undefined, false, undefined, this)
      ]
    }, undefined, true, undefined, this) : /* @__PURE__ */ jsxDEV6(TransferBench, {
      leftTitle: state.mode === "split" ? "Stays here" : state.source.name,
      rightTitle: state.mode === "split" ? "New set" : state.other?.name ?? "Other set",
      left: leftItems,
      right: rightItems,
      name,
      namePlaceholder: state.mode === "split" ? "Name for the new set" : "Name for the merged set",
      applyLabel: state.mode === "split" ? `Apply split (${rightIds.length})` : "Create merged set",
      requireMoved: state.mode === "split",
      onName: setName,
      onMoveToRight: moveToRight,
      onMoveToLeft: moveToLeft,
      onReorderRight: state.mode === "split" ? reorderRight : undefined,
      onApply: () => void apply(),
      onCancel: onDismiss,
      busy,
      note: error ? `${note} ${error}` : note
    }, undefined, false, undefined, this)
  }, undefined, false, undefined, this);
}

// src/ui/_shared/new-character.ts
async function createAndOpenCharacter(ctx) {
  const name = "Untitled character";
  const saved = await ctx.api.saveEntity({
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "character",
    id: "character",
    body: {
      identity: { name },
      persona: {},
      prompts: {},
      greetings: {},
      examples: {},
      media: {},
      attribution: {},
      discovery: {}
    }
  });
  return { id: saved.id, kind: "character", name: saved.name || name, accent: saved.accent };
}

// src/ui/apps/library/new-lorebook.ts
async function createAndOpenLorebook(ctx) {
  const body = emptyLorebookBody("Untitled lorebook");
  const saved = await ctx.api.saveEntity({
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "lorebook",
    id: "lorebook",
    body
  });
  return {
    id: saved.id,
    kind: "lorebook",
    name: saved.name || body.name,
    accent: saved.accent
  };
}

// src/entities/persona/schema.ts
function emptyPersonaBody(name) {
  return { name, content: "" };
}
// src/ui/apps/library/new-persona.ts
async function createAndOpenPersona(ctx) {
  const body = emptyPersonaBody("Untitled persona");
  const saved = await ctx.api.saveEntity({
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "persona",
    id: "persona",
    body
  });
  return {
    id: saved.id,
    kind: "persona",
    name: saved.name || body.name,
    accent: saved.accent
  };
}

// src/entities/preset/schema.ts
var emptyPresetBody = (name) => ({
  name,
  prompts: []
});
// src/ui/apps/library/new-preset.ts
async function createAndOpenPreset(ctx) {
  const body = emptyPresetBody("Untitled preset");
  const saved = await ctx.api.saveEntity({
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "preset",
    id: "preset",
    body
  });
  return {
    id: saved.id,
    kind: "preset",
    name: saved.name || body.name,
    accent: saved.accent
  };
}

// src/entities/quickreply/schema.ts
var emptyQuickReplyBody = (name) => ({ name, replies: [] });

// src/ui/apps/library/new-quickreply.ts
async function createAndOpenQuickReplies(ctx) {
  const body = emptyQuickReplyBody("Untitled quick replies");
  const saved = await ctx.api.saveEntity({
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "quickreply",
    id: "quick-replies",
    body
  });
  return { id: saved.id, kind: "quickreply", name: saved.name || body.name, accent: saved.accent };
}

// src/ui/apps/library/new-in-deck-button.tsx
import { jsxDEV as jsxDEV7 } from "react/jsx-dev-runtime";
var NEW_BY_KIND = {
  character: { label: "New character", word: "character", create: createAndOpenCharacter },
  lorebook: { label: "New lorebook", word: "lorebook", create: createAndOpenLorebook },
  regex: { label: "New regex set", word: "regex set", create: createAndOpenRegexSet },
  persona: { label: "New persona", word: "persona", create: createAndOpenPersona },
  preset: { label: "New preset", word: "preset", create: createAndOpenPreset },
  quickreply: { label: "New quick replies", word: "quick-reply set", create: createAndOpenQuickReplies }
};
function NewInDeckButton({ kind, ctx, onCreated, compact = false }) {
  const spec = NEW_BY_KIND[kind];
  if (!spec)
    return null;
  const create = () => {
    (async () => {
      try {
        const summary = await spec.create(ctx);
        onCreated(summary);
        ctx.workbench.open(summary);
        ctx.setStatus(`opened ${spec.word} · ${summary.name}`);
      } catch (err) {
        ctx.setStatus(err instanceof Error ? err.message : `could not create the ${spec.word}`);
      }
    })();
  };
  if (compact) {
    return /* @__PURE__ */ jsxDEV7("button", {
      type: "button",
      className: "crumbsel",
      onClick: create,
      children: [
        "+ ",
        spec.label
      ]
    }, undefined, true, undefined, this);
  }
  return /* @__PURE__ */ jsxDEV7("div", {
    style: { marginTop: "0.75rem" },
    children: /* @__PURE__ */ jsxDEV7("button", {
      type: "button",
      className: "send",
      onClick: create,
      children: spec.label
    }, undefined, false, undefined, this)
  }, undefined, false, undefined, this);
}

// src/ui/apps/library/delete-flow.tsx
import { useEffect as useEffect6, useRef as useRef3, useState as useState5 } from "react";
import { jsxDEV as jsxDEV8, Fragment as Fragment2 } from "react/jsx-dev-runtime";
var isRec6 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function withName(entity, name) {
  const body = isRec6(entity.body) ? { ...entity.body } : {};
  if (entity.kind === "character") {
    body.identity = { ...isRec6(body.identity) ? body.identity : {}, name };
  } else {
    body.name = name;
  }
  return { ...entity, body };
}
function useEntityDelete(ctx, onDeleted) {
  const [pending, setPending] = useState5(null);
  const [renaming, setRenaming] = useState5(null);
  const [renameText, setRenameText] = useState5("");
  const renameRef = useRef3(null);
  const duplicate = async (e) => {
    try {
      const entity = await ctx.api.getEntity(`kind=${encodeURIComponent(e.kind)}&id=${encodeURIComponent(e.id)}`);
      await ctx.api.saveEntity(entity);
      onDeleted();
      ctx.setStatus(`duplicated ${e.name}`);
    } catch (err) {
      ctx.setStatus(err instanceof Error ? err.message : "could not duplicate");
    }
  };
  const doRename = async () => {
    const e = renaming;
    const name = renameText.trim();
    setRenaming(null);
    if (!e || !name || name === e.name)
      return;
    try {
      const entity = await ctx.api.getEntity(`kind=${encodeURIComponent(e.kind)}&id=${encodeURIComponent(e.id)}`);
      await ctx.api.saveEntity(withName(entity, name), { overwrite: true });
      onDeleted();
      ctx.setStatus(`renamed to ${name}`);
    } catch (err) {
      ctx.setStatus(err instanceof Error ? err.message : "could not rename");
    }
  };
  useEffect6(() => {
    return ctx.menus.register("entity", (t) => {
      const e = t.data;
      const open = ctx.workbench.pieces().some((p) => p.id === e.id && p.kind === e.kind);
      if (open) {
        return [
          { label: "Duplicate", onPick: () => void duplicate(e) },
          { label: "Close it on the Workbench to rename or delete", disabled: true, onPick: () => {
            return;
          } }
        ];
      }
      return [
        {
          label: "Rename",
          onPick: () => {
            setRenameText(e.name);
            setRenaming(e);
          }
        },
        { label: "Duplicate", onPick: () => void duplicate(e) },
        { label: "Delete from the studio", danger: true, onPick: () => setPending([e]) }
      ];
    });
  }, [ctx]);
  useEffect6(() => {
    if (renaming)
      renameRef.current?.select();
  }, [renaming]);
  const doDelete = async () => {
    const batch = pending ?? [];
    setPending(null);
    let removed = 0;
    let failed = 0;
    for (const e of batch) {
      try {
        await ctx.api.deleteEntity(e.kind, e.id);
        removed++;
      } catch {
        failed++;
      }
    }
    onDeleted();
    ctx.setStatus(failed === 0 ? `deleted ${removed} ${removed === 1 ? "piece" : "pieces"}` : `deleted ${removed}, could not delete ${failed}`);
  };
  const confirm = pending ? /* @__PURE__ */ jsxDEV8(InkDialog, {
    onDismiss: () => setPending(null),
    ariaLabel: "Delete pieces",
    children: /* @__PURE__ */ jsxDEV8("div", {
      className: "delsheet",
      children: [
        /* @__PURE__ */ jsxDEV8("b", {
          className: "deltitle",
          children: pending.length === 1 ? `Delete "${pending[0].name}" from the studio?` : `Delete ${pending.length} pieces from the studio?`
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV8("p", {
          className: "delbody",
          children: [
            pending.length === 1 ? "Its file is removed" : "Their files are removed",
            " from your studio folder. There is no undo."
          ]
        }, undefined, true, undefined, this),
        /* @__PURE__ */ jsxDEV8("div", {
          className: "delacts",
          children: [
            /* @__PURE__ */ jsxDEV8("button", {
              className: "delgo",
              onClick: () => void doDelete(),
              children: "Delete"
            }, undefined, false, undefined, this),
            /* @__PURE__ */ jsxDEV8("button", {
              className: "delno",
              onClick: () => setPending(null),
              children: "Keep"
            }, undefined, false, undefined, this)
          ]
        }, undefined, true, undefined, this)
      ]
    }, undefined, true, undefined, this)
  }, undefined, false, undefined, this) : null;
  const renameSheet = renaming ? /* @__PURE__ */ jsxDEV8(InkDialog, {
    onDismiss: () => setRenaming(null),
    ariaLabel: "Rename piece",
    children: /* @__PURE__ */ jsxDEV8("form", {
      className: "delsheet",
      onSubmit: (ev) => {
        ev.preventDefault();
        doRename();
      },
      children: [
        /* @__PURE__ */ jsxDEV8("b", {
          className: "deltitle",
          children: [
            'Rename "',
            renaming.name,
            '"'
          ]
        }, undefined, true, undefined, this),
        /* @__PURE__ */ jsxDEV8("p", {
          className: "delbody",
          children: "The piece keeps everything else; only its name changes."
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV8("input", {
          ref: renameRef,
          className: "renamein",
          value: renameText,
          "aria-label": "New name",
          onChange: (ev) => setRenameText(ev.target.value)
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV8("div", {
          className: "delacts",
          children: [
            /* @__PURE__ */ jsxDEV8("button", {
              className: "delgo",
              type: "submit",
              children: "Rename"
            }, undefined, false, undefined, this),
            /* @__PURE__ */ jsxDEV8("button", {
              className: "delno",
              type: "button",
              onClick: () => setRenaming(null),
              children: "Cancel"
            }, undefined, false, undefined, this)
          ]
        }, undefined, true, undefined, this)
      ]
    }, undefined, true, undefined, this)
  }, undefined, false, undefined, this) : null;
  const requestDelete = (batch) => {
    if (batch.length > 0)
      setPending(batch);
  };
  return {
    requestDelete,
    confirm: /* @__PURE__ */ jsxDEV8(Fragment2, {
      children: [
        confirm,
        renameSheet
      ]
    }, undefined, true, undefined, this)
  };
}

// src/ui/_shared/import-signal.ts
var EVENT = "hoplight:import-request";
var SLOT = "__hoplightImportRequest";
var readSlot = () => window[SLOT] ?? null;
var writeSlot = (v) => {
  window[SLOT] = v;
};
function consumeImportRequests(cb) {
  const handler = () => {
    const pending = readSlot();
    if (!pending)
      return;
    writeSlot(null);
    cb(pending.files);
  };
  window.addEventListener(EVENT, handler);
  handler();
  return () => window.removeEventListener(EVENT, handler);
}

// src/ui/apps/library/piece-peek.ts
var isBag = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function roughTokens(v, depth = 0) {
  if (depth > 6)
    return 0;
  if (typeof v === "string")
    return v.length;
  if (Array.isArray(v))
    return v.reduce((n, x) => n + roughTokens(x, depth + 1), 0);
  if (isBag(v))
    return Object.values(v).reduce((n, x) => n + roughTokens(x, depth + 1), 0);
  return 0;
}
function filledCardFields(body) {
  const identity = isBag(body.identity) ? body.identity : {};
  const persona = isBag(body.persona) ? body.persona : {};
  const prompts = isBag(body.prompts) ? body.prompts : {};
  const greetings = isBag(body.greetings) ? body.greetings : {};
  const examples = isBag(body.examples) ? body.examples : {};
  const has = (v) => typeof v === "string" ? v.trim().length > 0 : Array.isArray(v) ? v.length > 0 : false;
  const nine = [
    identity.name,
    persona.description,
    persona.personality,
    persona.scenario,
    greetings.firstMessage,
    greetings.alternateGreetings,
    examples.exampleMessages,
    prompts.systemPrompt,
    prompts.postHistoryInstructions
  ];
  return `${nine.filter(has).length}/9`;
}
async function peekPiece(ctx, e) {
  try {
    const entity = await ctx.api.getEntity(`kind=${encodeURIComponent(e.kind)}&id=${encodeURIComponent(e.id)}`);
    const body = isBag(entity.body) ? entity.body : {};
    const identity = isBag(body.identity) ? body.identity : {};
    const persona = isBag(body.persona) ? body.persona : {};
    const discovery = isBag(body.discovery) ? body.discovery : {};
    const rawTags = e.kind === "character" ? discovery.tags : body.tags;
    const tags = Array.isArray(rawTags) ? rawTags.filter((t) => typeof t === "string" && t.length > 0) : [];
    return {
      tagline: typeof identity.tagline === "string" ? identity.tagline : undefined,
      description: typeof persona.description === "string" ? persona.description : undefined,
      tokens: Math.round(roughTokens(body) / 4),
      tags: tags.length > 0 ? tags : undefined,
      filled: e.kind === "character" ? filledCardFields(body) : undefined
    };
  } catch {
    return null;
  }
}
function sourceLabelFor(formatLabels, e) {
  if (!e.sourceFormat)
    return null;
  const base = formatLabels.get(e.sourceFormat) ?? e.sourceFormat;
  const variant = e.sourceVariant?.toUpperCase();
  if (base === "Default")
    return variant ? `CC ${variant}` : "CC";
  return variant ? `${base} · ${variant}` : base;
}

// src/ui/apps/library/persona-shelf-ops.ts
var isRec7 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
async function loadPersonaMeta(ctx, list) {
  const personas = list.filter((e) => e.kind === "persona");
  const next = {};
  for (const p of personas) {
    try {
      const raw = await ctx.api.getEntity(`kind=persona&id=${encodeURIComponent(p.id)}`);
      const body = isRec7(raw) && isRec7(raw.body) ? raw.body : null;
      if (!body)
        continue;
      const pronouns = body.identity?.pronouns ?? (body.identity?.pronounSet ? `${body.identity.pronounSet.subjective}/${body.identity.pronounSet.objective}` : undefined);
      next[p.id] = {
        brief: body.brief?.trim() || undefined,
        pronouns,
        sectionCount: Object.values(body.sections ?? {}).filter((s) => typeof s === "string" && s.trim() !== "").length,
        hasLorebook: (body.knowledgeRefs ?? []).length > 0
      };
    } catch {}
  }
  return next;
}
function makePersonaShelf(args) {
  const { ctx, personaMeta, setEntities } = args;
  return {
    briefOf: (e) => personaMeta[e.id]?.brief,
    pronounsOf: (e) => personaMeta[e.id]?.pronouns,
    sectionCountOf: (e) => personaMeta[e.id]?.sectionCount,
    hasLorebookOf: (e) => personaMeta[e.id]?.hasLorebook ?? false,
    defaultId: String(ctx.prefs.get("persona.default") ?? ""),
    onNew: () => {
      (async () => {
        try {
          const summary = await createAndOpenPersona(ctx);
          setEntities((prev) => prev.some((e) => e.kind === "persona" && e.id === summary.id) ? prev : [...prev, summary]);
          ctx.workbench.open(summary);
          ctx.setStatus(`opened persona · ${summary.name}`);
        } catch (err) {
          ctx.setStatus(err instanceof Error ? err.message : "could not create the persona");
        }
      })();
    }
  };
}

// src/ui/apps/library/styles.ts
var MARK_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 20h16"/><rect x="5" y="8" width="3" height="12"/><rect x="9.5" y="5" width="3" height="15"/><path d="M15 20V9l3-1 1.6 10.8-3.4.6z"/></svg>';
var PREF_VIEW = "library.view";
var PREF_SIZE = "library.size";
var PREF_FIRST_DECK = "firstDeck";
var LIBRARY_STYLE = `
.lib{display:flex;flex-direction:column;gap:.7rem;padding:clamp(.7rem,1.8vw,1.1rem);min-height:100%}
.lib .stagezone{flex:1;display:flex;flex-wrap:wrap;gap:var(--gap-l);align-items:center;justify-content:center;padding:var(--gap-l)}
.doorcard{aspect-ratio:2/3;width:clamp(11rem,22vw,16rem);display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:var(--gap-m);background:var(--panel);color:var(--ink);cursor:pointer;padding:var(--gap-m);text-align:center;
  font-family:var(--font-big);font-weight:900;font-size:clamp(1rem,1.6vw,1.3rem);line-height:1.15}
.doorcard.primary{background:var(--rose);color:var(--stage-white)}
.voice{font-style:italic;font-weight:600;color:var(--muted);text-align:center;font-size:1.05rem}
.damage-note{position:relative;border:3px solid var(--rose);box-shadow:4px 4px 0 0 var(--edge);
  background:var(--panel);color:var(--text);padding:.65rem .8rem}
.damage-note strong{display:block;font-family:var(--font-big);font-weight:900;padding-right:5rem}
/* sits in the notice's own corner, clear of the heading it belongs to */
.dnx{position:absolute;top:.55rem;right:.6rem;font-family:var(--font-mono);font-weight:700;
  font-size:.5625rem;letter-spacing:.1em;text-transform:uppercase;background:transparent;
  color:var(--text-dim);border:2px solid var(--text-faint);cursor:pointer;padding:.2rem .45rem}
.dnx:hover{color:var(--text);border-color:var(--rose)}
.damage-note p{margin:.35rem 0 0;color:var(--text-dim);font-size:.85rem}
.damage-note details{margin-top:.45rem}
.damage-note summary{cursor:pointer;font-family:var(--font-mono);font-weight:700;font-size:.7rem;
  letter-spacing:.04em;text-transform:uppercase}
.damage-note ul{margin:.55rem 0 0;padding-left:1.35rem}
.damage-note li{margin:.25rem 0;font-size:.8rem}
.damage-note code{overflow-wrap:anywhere}
/* the import sheet (InkDialog owns overlay/sheet chrome; the delsheet/export-dialog grammar) */
.impsheet{padding:1.1rem 1.3rem;width:min(94vw,44rem)}
.impkick{font-family:var(--font-mono);font-weight:700;font-size:.66rem;letter-spacing:.12em;
  text-transform:uppercase;color:var(--text-dim);margin:0 0 .3rem}
.imptitle{display:block;font-family:var(--font-big);font-weight:900;font-size:1.15rem;color:var(--text);
  margin:0 0 .3rem}
.impsub{font-family:var(--font-mono);font-size:.66rem;letter-spacing:.04em;color:var(--text-soft);margin:0 0 .9rem}
.improws{display:flex;flex-direction:column;gap:.55rem;max-height:50dvh;overflow:auto;margin:0 0 1rem}
.improw{position:relative;display:flex;gap:.7rem;align-items:flex-start;background:var(--face);
  border:2px solid var(--edge);padding:.65rem .8rem;cursor:pointer}
.improw.on{border-color:var(--accent);box-shadow:2px 2px 0 0 var(--edge)}
.improw.bad{border-style:dashed;cursor:default}
.improw input{position:absolute;opacity:0;width:1px;height:1px}
.impcheck{flex:none;width:1.1rem;height:1.1rem;border:2px solid var(--edge);background:var(--face);
  position:relative;margin-top:.15rem}
.improw input:checked + .impcheck{background:var(--accent-deep);border-color:var(--accent)}
.improw input:checked + .impcheck::after{content:"";position:absolute;left:.28rem;top:.08rem;
  width:.3rem;height:.55rem;border:solid var(--stage-white);border-width:0 2px 2px 0;transform:rotate(45deg)}
.improw input:focus-visible + .impcheck{outline:2px solid var(--accent);outline-offset:2px}
.impbody{min-width:0}
.impname{display:block;font-family:var(--font-big);font-weight:800;font-size:1rem;color:var(--text);
  overflow-wrap:anywhere}
.impkind{font-family:var(--font-body);font-size:.9rem;color:var(--text);margin:.15rem 0 0}
.impmeta{font-family:var(--font-mono);font-size:.66rem;letter-spacing:.04em;color:var(--text-soft);margin:.25rem 0 0}
.impflag{display:inline-block;font-family:var(--font-mono);font-weight:700;font-size:.625rem;letter-spacing:.08em;
  text-transform:uppercase;background:var(--rose-deep);color:var(--stage-white);padding:.12rem .4rem;margin:0 0 .25rem}
.imperr{font-family:var(--font-body);font-size:.85rem;color:var(--text-soft);margin:.1rem 0 0;overflow-wrap:anywhere}
/* progress marker (house bar grammar: bordered track, accent fill; the fill is a mark, no text) */
.impbar{display:block;height:.6rem;border:2px solid var(--edge);background:var(--face);
  position:relative;margin:0 0 .5rem}
.impbar i{position:absolute;left:0;top:0;bottom:0;background:var(--accent);transition:width .15s ease}
.impprog{font-family:var(--font-mono);font-size:.66rem;letter-spacing:.04em;color:var(--text-soft);margin:0 0 .9rem}
.improw.dupe{border-style:dotted;cursor:default;opacity:.85}
/* archive report card: informational, never checkable, so it reads on --panel (damage-note's own
   convention for "read this", not --face's "check this") rather than borrowing improw's own look. */
.impreport{background:var(--panel);border:2px solid var(--edge);padding:.65rem .8rem}
.impreport .impname{margin:0 0 .3rem}
.impreport ul{margin:.35rem 0 0;padding-left:1.15rem}
.impreport li{font-family:var(--font-body);font-size:.82rem;color:var(--text-soft);margin:.15rem 0;
  overflow-wrap:anywhere}
.impacts{display:flex;gap:.5rem;flex-wrap:wrap}
.impbtn{font-family:var(--font-big);font-weight:900;font-size:.7rem;letter-spacing:.07em;
  text-transform:uppercase;background:var(--panel);color:var(--text);cursor:pointer;padding:.45rem .8rem}
/* deep fill carries the label (AA law); the BRIGHT picked accent rides the border so the button
   visibly belongs to the user's accent choice instead of reading as an unrelated dark color */
.impbtn.primary{background:var(--accent-deep);color:var(--stage-white);border-color:var(--accent)}
.impbtn:disabled{opacity:.45;cursor:default}
.wbbar{display:flex;align-items:center;gap:.6rem;flex:none;flex-wrap:wrap}
/* the staging action bar: appears only when pieces are picked (the distributed tray's commit) */
.sendbar{display:flex;align-items:center;gap:.6rem;flex:none;flex-wrap:wrap;background:var(--stamp-bg);
  border:3px solid var(--edge);box-shadow:4px 4px 0 0 var(--accent);padding:.4rem .55rem .4rem .7rem}
.sendbar .cnt{font-family:var(--font-big);font-weight:900;font-size:.75rem;letter-spacing:.04em;color:var(--stamp-fg)}
.sendbar .send{font-family:var(--font-big);font-weight:900;font-size:.8125rem;letter-spacing:.08em;
  text-transform:uppercase;background:var(--accent-deep);color:var(--stage-white);border:3px solid var(--edge);cursor:pointer;
  padding:.4rem .8rem;box-shadow:3px 3px 0 0 var(--edge);transition:transform .1s ease-out,box-shadow .1s ease-out}
.sendbar .send:hover{transform:translate(-1px,-1px);box-shadow:4px 4px 0 0 var(--edge)}
.sendbar .clear{font-family:var(--font-mono);font-weight:700;font-size:.66rem;letter-spacing:.08em;
  text-transform:uppercase;background:transparent;color:var(--stamp-fg);
  border:2px solid color-mix(in srgb,var(--stamp-fg) 45%,transparent);
  cursor:pointer;padding:.35rem .6rem}
.sendbar .clear:hover{border-color:var(--stamp-fg)}
.sendbar .del{font-family:var(--font-big);font-weight:900;font-size:.8125rem;letter-spacing:.08em;
  text-transform:uppercase;background:var(--rose-deep);color:var(--stage-white);border:3px solid var(--rose);
  cursor:pointer;padding:.4rem .8rem;transition:transform .1s ease-out,box-shadow .1s ease-out}
.sendbar .del:hover{transform:translate(-1px,-1px);box-shadow:2px 2px 0 0 var(--edge)}
.stage-crumb .crumbsel{font-family:var(--font-mono);font-weight:700;font-size:.625rem;
  letter-spacing:.1em;text-transform:uppercase;background:transparent;color:var(--text-dim);
  border:2px solid var(--text-faint);cursor:pointer;padding:.25rem .5rem}
.stage-crumb .crumbsel:hover{color:var(--text);border-color:var(--edge)}
.delsheet{padding:1rem 1.1rem;max-width:24rem}
.delsheet .deltitle{display:block;font-family:var(--font-big);font-weight:900;font-size:.95rem;
  color:var(--text);margin:0 0 .45rem}
.delsheet .delbody{font-family:var(--font-body);font-size:.8rem;color:var(--text-dim);margin:0 0 .8rem;
  line-height:1.5}
.delsheet .delacts{display:flex;gap:.5rem}
.delsheet .delgo{font-family:var(--font-big);font-weight:900;font-size:.6875rem;letter-spacing:.08em;
  text-transform:uppercase;background:var(--rose-deep);color:var(--stage-white);border:3px solid var(--edge);
  cursor:pointer;padding:.45rem .9rem;box-shadow:3px 3px 0 0 var(--edge)}
.delsheet .delno{font-family:var(--font-mono);font-weight:700;font-size:.625rem;letter-spacing:.08em;
  text-transform:uppercase;background:transparent;color:var(--text-dim);border:2px solid var(--text-faint);
  cursor:pointer;padding:.45rem .8rem}
.delsheet .delno:hover{color:var(--text);border-color:var(--edge)}
.delsheet .renamein{width:100%;font-family:var(--font-body);font-size:.95rem;color:var(--text);
  background:var(--face);border:2px solid var(--edge);padding:.45rem .55rem;margin:0 0 .8rem}
.deckchips{display:flex;gap:.4rem;flex:1;min-width:0;overflow-x:auto;padding-bottom:2px}
.dchip{display:flex;align-items:center;gap:.45rem;flex:none;cursor:pointer;font-family:var(--font-big);
  font-weight:800;font-size:.625rem;letter-spacing:.08em;text-transform:uppercase;color:var(--text-dim);
  background:var(--face);border:3px solid var(--edge);box-shadow:3px 3px 0 0 var(--edge);padding:.35rem .55rem;
  transition:transform .1s ease-out,box-shadow .1s ease-out}
.dchip .pip{width:10px;height:10px;flex:none;border:2px solid var(--edge);background:var(--a)}
.dchip .dc{font-family:var(--font-mono);font-weight:600;font-size:.5625rem;color:var(--text-dim)}
.dchip:hover{transform:translate(-1px,-1px);box-shadow:4px 4px 0 0 var(--edge)}
.dchip.on{background:var(--stamp-bg);color:var(--stamp-fg);box-shadow:3px 3px 0 0 var(--a)}
.dchip.on .dc{color:var(--stamp-fg);opacity:.7}
.viewseg{display:flex;flex:none;border:3px solid var(--edge);box-shadow:3px 3px 0 0 var(--edge)}
.viewseg button{border:none;border-left:3px solid var(--edge);background:var(--face);color:var(--text-dim);
  font-family:var(--font-big);font-weight:800;font-size:.5625rem;letter-spacing:.1em;text-transform:uppercase;
  padding:.4rem .6rem;cursor:pointer;display:flex;align-items:center;gap:.35rem}
.viewseg button:first-child{border-left:none}
.viewseg button.on{background:var(--stamp-bg);color:var(--stamp-fg)}
.viewseg svg{display:block}
.sizedial{display:flex;align-items:center;gap:.45rem;flex:none;border:3px solid var(--edge);
  box-shadow:3px 3px 0 0 var(--edge);background:var(--face);padding:.3rem .6rem}
.sizedial .sk{font-family:var(--font-mono);font-size:.5625rem;letter-spacing:.12em;text-transform:uppercase;color:var(--text-dim)}
.sizedial input{appearance:none;-webkit-appearance:none;width:clamp(5rem,9vw,8rem);height:3px;background:var(--text-faint);
  outline:none;cursor:pointer}
.sizedial input::-webkit-slider-thumb{appearance:none;-webkit-appearance:none;width:12px;height:12px;
  background:var(--text);border:2px solid var(--edge)}
.sizedial input::-moz-range-thumb{width:12px;height:12px;background:var(--text);border:2px solid var(--edge);border-radius:0}
/* the search box wears the size dial's chrome (bordered, stamped, mono kicker) so the deck bar
   still reads as one object rather than a toolbar with a web form bolted on */
/* NEVER GROWS. The deck chips are this room's navigation and they own the leftover width; a
   search box with flex-grow took it and pushed three of the six decks behind a scroll nobody
   could see. It still shrinks, so a narrow window squeezes the box rather than hiding a deck. */
.findwrap{position:relative;display:flex;flex-direction:column;flex:0 1 18rem;min-width:0}
.findbox{display:flex;align-items:center;gap:.45rem;border:3px solid var(--edge);
  box-shadow:3px 3px 0 0 var(--edge);background:var(--face);padding:.3rem .5rem}
/* a live search stamps in the house accent: the one glance that says the shelf is filtered */
.findwrap.on .findbox{box-shadow:3px 3px 0 0 var(--accent)}
.findbox:focus-within{outline:2px solid var(--accent);outline-offset:2px}
.findbox .sk{flex:none;font-family:var(--font-mono);font-size:.5625rem;letter-spacing:.12em;
  text-transform:uppercase;color:var(--text-dim)}
.findbox input{flex:1;min-width:0;border:none;outline:none;background:transparent;color:var(--text);
  font-family:var(--font-mono);font-size:.7rem;padding:.15rem 0}
.findbox input::placeholder{color:var(--text-faint)}
.findx{flex:none;font-family:var(--font-mono);font-weight:700;font-size:.5625rem;letter-spacing:.1em;
  text-transform:uppercase;background:transparent;color:var(--text-dim);border:2px solid var(--text-faint);
  cursor:pointer;padding:.15rem .35rem}
.findx:hover{color:var(--text);border-color:var(--edge)}
/* HANGS OFF THE FIELD rather than sitting in the toolbar's flow. In flow it grew the bar by three
   lines the moment a typo appeared, shoving every deck chip down mid-keystroke. */
.findnote{position:absolute;top:calc(100% + .25rem);left:0;right:0;z-index:2;background:var(--panel);
  border:2px solid var(--edge);box-shadow:3px 3px 0 0 var(--edge);padding:.35rem .45rem;margin:0;
  font-family:var(--font-mono);font-size:.6rem;line-height:1.5;color:var(--text-soft);
  overflow-wrap:anywhere}
/* a deck holding no matches RECEDES rather than vanishing: the chip still says what it holds */
.dchip.nil{opacity:.45}
/* the filtered-to-nothing shelf, deliberately NOT the ghost card. The ghost invites a first
   import, which is the wrong answer (and a small lie) when the pieces are already here and merely
   hidden by what somebody typed. */
.nomatch{margin:auto;max-width:32rem;display:flex;flex-direction:column;align-items:flex-start;
  gap:.55rem;border:2px dashed var(--stage-line);padding:1rem 1.1rem}
.nomatch .nmhead{font-family:var(--font-big);font-weight:900;font-size:.9rem;letter-spacing:.04em;
  text-transform:uppercase;color:var(--stage-card)}
.nomatch .nmbody{font-family:var(--font-body);font-size:.95rem;line-height:1.5;color:var(--stage-soft);margin:0}
.nomatch .nmq{font-family:var(--font-mono);font-size:.8rem;color:var(--stage-paper);
  background:var(--stage-sunken);border:2px solid var(--stage-seam);padding:.05rem .3rem;overflow-wrap:anywhere}
.nomatch .nmjumps{display:flex;align-items:center;gap:.4rem;flex-wrap:wrap}
.nomatch .nmk{font-family:var(--font-mono);font-size:.5625rem;letter-spacing:.12em;text-transform:uppercase;
  color:var(--stage-kicker)}
.nomatch .nmjump{font-family:var(--font-big);font-weight:800;font-size:.625rem;letter-spacing:.08em;
  text-transform:uppercase;background:var(--stage-panel);color:var(--stage-soft);
  border:2px solid var(--stage-seam);cursor:pointer;padding:.3rem .5rem}
.nomatch .nmjump:hover{color:var(--stage-card);border-color:var(--stage-line)}
.nomatch .nmclear{font-family:var(--font-mono);font-weight:700;font-size:.625rem;letter-spacing:.1em;
  text-transform:uppercase;background:transparent;color:var(--stage-mute);border:2px solid var(--stage-faint);
  cursor:pointer;padding:.3rem .55rem}
.nomatch .nmclear:hover{color:var(--stage-paper);border-color:var(--stage-line)}
/* THE PERSON'S OWN GROUPINGS. Quieter than the deck chips on purpose: decks are the studio's own
   shape and are always true, while a group is a private note about some of it. Same chip grammar so
   the row still reads as one toolbar, one weight down. */
.colbar{display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;flex:none;min-width:0}
.colbar>.sk{flex:none;font-family:var(--font-mono);font-size:.5625rem;letter-spacing:.12em;
  text-transform:uppercase;color:var(--text-dim)}
.colchip{display:flex;align-items:stretch;flex:none;border:2px solid var(--edge);background:var(--face)}
.colchip.on{box-shadow:2px 2px 0 0 var(--accent)}
.colchip button{border:none;background:transparent;cursor:pointer;font-family:var(--font-big);
  font-weight:800;font-size:.5625rem;letter-spacing:.08em;text-transform:uppercase;color:var(--text-dim);
  padding:.3rem .45rem}
.colname{display:flex;align-items:center;gap:.35rem}
.colchip.on .colname{background:var(--stamp-bg);color:var(--stamp-fg)}
.colcount{font-family:var(--font-mono);font-weight:600;font-size:.5rem;opacity:.75}
/* the two verbs only ever act on the chip they sit in, so they stay inside its border */
.coladd,.coldel{border-left:2px solid var(--edge)!important;color:var(--text-faint)}
.coladd:hover{color:var(--accent)}
.coldel:hover{color:var(--text)}
.colmake{flex:none;font-family:var(--font-big);font-weight:800;font-size:.5625rem;letter-spacing:.08em;
  text-transform:uppercase;background:transparent;color:var(--text-dim);border:2px dashed var(--text-faint);
  cursor:pointer;padding:.3rem .5rem}
.colmake:hover{color:var(--text);border-color:var(--edge);border-style:solid}
.colnew{flex:none;width:9rem;border:2px solid var(--accent);background:var(--face);color:var(--text);
  font-family:var(--font-mono);font-size:.7rem;padding:.25rem .4rem;outline:none}
/* the bar says what happened, because the mono status bar cannot: see collections-ops.ts on say */
.colnote{display:flex;align-items:center;gap:.4rem;flex:none;font-family:var(--font-mono);
  font-size:.625rem;color:var(--text-soft);border:2px solid var(--text-faint);padding:.25rem .45rem}
.colnote button{border:none;background:transparent;cursor:pointer;font-family:var(--font-mono);
  font-weight:700;font-size:.5625rem;letter-spacing:.1em;text-transform:uppercase;color:var(--text-dim)}
.colnote button:hover{color:var(--text)}
.prosc{position:relative;flex:1;min-height:0;background:var(--shell-panel-2);border:3px solid var(--edge);
  box-shadow:6px 6px 0 0 var(--edge);padding:.55rem;display:flex}
.libstage{position:relative;flex:1;min-height:0;background:var(--stage-well);border:3px solid var(--stage-black);overflow:hidden;
  box-shadow:inset 8px 8px 0 0 var(--shadow-ink-deep);display:flex;flex-direction:column}
.stage-crumb{display:flex;align-items:center;gap:.5rem;border-bottom:3px solid var(--stage-black);background:var(--stage-sunken);padding:.5rem .75rem;flex:none}
.stage-crumb .pip{width:11px;height:11px;border:2px solid var(--stage-black);background:var(--a)}
.stage-crumb .cn{font-family:var(--font-big);font-weight:900;font-size:.6875rem;letter-spacing:.06em;text-transform:uppercase;color:var(--stage-paper)}
.stage-crumb .cc{font-family:var(--font-mono);font-size:.5625rem;letter-spacing:.1em;text-transform:uppercase;color:var(--stage-mute);margin-left:auto}
.ghost-shelf{margin:auto;width:clamp(9rem,30vw,14rem);aspect-ratio:2/3;border:2px dashed var(--stage-faint);
  display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:.8rem;
  font-family:var(--font-mono);font-size:.7rem;font-weight:600;letter-spacing:.06em;line-height:1.6;
  text-transform:uppercase;color:var(--stage-soft)}
/* the ghost shelf's create button: the send stamp, which only .sendbar styled before (it rendered
   as a naked browser button out here) */
.ghost-shelf .send{font-family:var(--font-big);font-weight:900;font-size:.6875rem;letter-spacing:.08em;
  text-transform:uppercase;background:var(--rose);color:var(--stage-white);border:3px solid var(--stage-black);
  cursor:pointer;padding:.45rem .85rem;box-shadow:3px 3px 0 0 var(--stage-black);
  transition:transform .1s ease-out,box-shadow .1s ease-out}
.ghost-shelf .send:hover{transform:translate(-1px,-1px);box-shadow:4px 4px 0 0 var(--stage-black)}
/* scrollbars wear the house ink, never the OS chrome */
.lib *{scrollbar-width:thin;scrollbar-color:var(--stage-seam) transparent}
.lib *::-webkit-scrollbar{width:8px;height:8px}
.lib *::-webkit-scrollbar-thumb{background:var(--stage-seam)}
.lib *::-webkit-scrollbar-track{background:transparent}
.deckchips{scrollbar-width:none}
.deckchips::-webkit-scrollbar{display:none}
/* phones: chips WRAP (everything visible, nothing hidden behind an invisible scroll), the view
   seg gets its row, the dial gets a full row so the thumb never clips (fluid law) */
@media(max-width:40rem){
  .lib{padding:.5rem;gap:.5rem}
  .wbbar{gap:.4rem}
  .findwrap{order:0;flex:1 1 100%}
  .deckchips{flex:1 1 100%;order:1;flex-wrap:wrap;overflow:visible;padding-bottom:0}
  .viewseg{order:2}
  .sizedial{order:3;flex:1 1 100%;min-width:0}
  .sizedial input{flex:1;width:auto;min-width:0}
  .prosc{padding:.3rem;box-shadow:4px 4px 0 0 var(--edge)}
  .lib .stagezone{gap:var(--gap-m);padding:var(--gap-m)}
  .doorcard{width:clamp(9rem,42vw,12rem)}
}
`;

// src/ui/apps/library/view-contract.ts
var SIZE_RANGE = { min: 4, max: 36, fallback: 8.5 };
function clampSize(value) {
  const n = typeof value === "number" && Number.isFinite(value) ? value : SIZE_RANGE.fallback;
  return Math.min(SIZE_RANGE.max, Math.max(SIZE_RANGE.min, n));
}
var pieceKey = (e) => `${e.kind}:${e.id}`;

// src/ui/apps/library/select-core.ts
function rangeBetween(order, from, to) {
  const a = order.indexOf(from);
  const b = order.indexOf(to);
  if (a === -1 || b === -1)
    return [to];
  return a <= b ? order.slice(a, b + 1) : order.slice(b, a + 1);
}
function applyPick(current, input) {
  const { key, order, shift, meta, open } = input;
  if (shift && current.anchor) {
    const next2 = new Set(current.selected);
    for (const inRange of rangeBetween(order, current.anchor, key)) {
      if (!open.has(inRange))
        next2.add(inRange);
    }
    return { selected: next2, anchor: current.anchor };
  }
  const next = new Set(current.selected);
  if (next.has(key))
    next.delete(key);
  else if (!open.has(key))
    next.add(key);
  else
    return { selected: current.selected, anchor: key };
  return { selected: next, anchor: key };
}
function boxOf(start, end) {
  return {
    left: Math.min(start.x, end.x),
    right: Math.max(start.x, end.x),
    top: Math.min(start.y, end.y),
    bottom: Math.max(start.y, end.y)
  };
}
var isDrag = (box) => box.right - box.left > 4 || box.bottom - box.top > 4;
var overlaps2 = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
function marqueeHits(cards, box, open) {
  return cards.filter((card) => !open.has(card.key) && overlaps2(card.box, box)).map((card) => card.key);
}
function applyMarquee(current, hits, additive) {
  const next = additive ? new Set(current.selected) : new Set;
  for (const key of hits)
    next.add(key);
  return { selected: next, anchor: hits.at(-1) ?? current.anchor };
}
var selectedText = (selection) => selection !== null && !selection.isCollapsed && selection.toString().trim().length > 0;

// src/ui/apps/library/use-marquee.ts
import { useCallback as useCallback3, useEffect as useEffect7, useRef as useRef4, useState as useState6 } from "react";
var cardsIn = (root) => [...root.querySelectorAll("[data-pick]")].map((node) => {
  const r = node.getBoundingClientRect();
  return {
    key: node.dataset["pick"] ?? "",
    box: { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
  };
});
function useMarquee(onSweep) {
  const [box, setBox] = useState6(null);
  const rootRef = useRef4(null);
  const startRef = useRef4(null);
  const additiveRef = useRef4(false);
  const sweepRef = useRef4(onSweep);
  sweepRef.current = onSweep;
  const onPointerDown = useCallback3((event) => {
    if (event.button !== 0 || event.target !== event.currentTarget)
      return;
    rootRef.current = event.currentTarget;
    startRef.current = { x: event.clientX, y: event.clientY };
    additiveRef.current = event.shiftKey || event.ctrlKey || event.metaKey;
  }, []);
  useEffect7(() => {
    const move = (event) => {
      const start = startRef.current;
      if (!start)
        return;
      const next = boxOf(start, { x: event.clientX, y: event.clientY });
      setBox(isDrag(next) ? next : null);
    };
    const up = (event) => {
      const start = startRef.current;
      const root = rootRef.current;
      startRef.current = null;
      rootRef.current = null;
      setBox(null);
      if (!start || !root)
        return;
      const finished = boxOf(start, { x: event.clientX, y: event.clientY });
      if (!isDrag(finished))
        return;
      sweepRef.current(cardsIn(root), finished, additiveRef.current);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);
  return { onPointerDown, box };
}

// src/ui/apps/library/views/grid.tsx
import { jsxDEV as jsxDEV9 } from "react/jsx-dev-runtime";
var CSS = `
.dv-gridscroll{flex:1;min-height:0;overflow-y:auto;padding:clamp(.5rem,1.8vw,1.1rem)}
/* the dragged box: fixed, because it is measured in viewport coordinates like the cards it tests */
.dv-lasso{position:fixed;z-index:3;pointer-events:none;border:2px dashed var(--a,var(--stage-line));
  background:var(--stage-sunken);opacity:.35}
/* names are TEXT: an imported preset's id is often the only place its real name is written down */
.dv-gcard .nm{user-select:text;cursor:text}
/* the 42vw guard keeps at least two columns on a phone even when the desktop size dial is huge */
.dv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(var(--card-w),42vw,100%),1fr));gap:clamp(.5rem,1.4vw,1rem)}
/* overflow:hidden is the backstop: whatever a name does, it stays inside its own card */
.dv-gcard{display:flex;flex-direction:column;text-align:left;font:inherit;padding:0;cursor:pointer;position:relative;overflow:hidden;min-width:0;
  background:var(--stage-panel);border:3px solid var(--stage-black);box-shadow:5px 5px 0 0 var(--a);transition:transform .12s ease-out,box-shadow .12s ease-out}
.dv-gcard:hover{transform:translate(-3px,-3px);box-shadow:9px 9px 0 0 var(--a)}
.dv-gcard .cov{aspect-ratio:2/3;background:var(--a);border-bottom:3px solid var(--stage-black);position:relative;
  display:flex;align-items:flex-end;padding:.4rem;background-size:cover;background-position:center top}
.dv-gcard .cov b{font-family:var(--font-big);font-weight:900;font-size:clamp(1.6rem,26cqi,2.6rem);line-height:.72;color:var(--stage-ink);opacity:.82}
.dv-gcard .kd{position:absolute;top:0;left:0;background:var(--stage-ink);color:var(--a);font-family:var(--font-mono);
  font-size:.5625rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:2px 5px;border-right:3px solid var(--stage-black);border-bottom:3px solid var(--stage-black)}
/* min-width:0 lets the name shrink inside the grid track; without it a long word sets the width */
.dv-gcard .bd{padding:.4rem .5rem .5rem;min-width:0}
/* name + meta tag scale with the size dial (--card-w); name stays the larger of the two at every size */
.dv-gcard .nm{font-family:var(--font-big);font-weight:800;font-size:clamp(.72rem,calc(var(--card-w) * .094),1.6rem);color:var(--stage-card);line-height:1.1;
  /*
   * A NAME IS SOMEBODY ELSE'S STRING. Presets arrive called "3035a5467e03eaa245de3ac318018404" and
   * "HawThorne(2)" - one unbroken word far wider than any card. With nothing here it drew straight
   * out of the card and over the neighbours, so a shelf of imports was a wall of overlapping text.
   * Breaking anywhere is right for an id; three lines then hand the rest to the tooltip, which
   * already carries the whole name, so cards in a row stay the same height.
   */
  overflow-wrap:anywhere;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden}
.dv-gcard .fmt{display:inline-block;font-family:var(--font-mono);font-size:clamp(.56rem,calc(var(--card-w) * .05),.72rem);letter-spacing:.06em;
  text-transform:uppercase;color:var(--stage-soft);border:2px solid var(--stage-line);font-weight:700;padding:.24em .5em;margin-top:.4em}
.dv-gcard.cast{border-color:var(--a);box-shadow:inset 5px 5px 0 0 var(--shadow-ink);transform:translate(2px,2px);opacity:.72}
.dv-gcard.cast:hover{transform:translate(2px,2px);box-shadow:inset 5px 5px 0 0 var(--shadow-ink)}
.dv-gcard .tick{position:absolute;top:0;right:0;z-index:1;background:var(--a);color:var(--stage-ink);font-family:var(--font-mono);
  font-size:.5625rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:2px 6px;border-left:3px solid var(--stage-black);border-bottom:3px solid var(--stage-black)}
/* STAGED: outlined in accent, a filled corner check - distinct from the pressed-open "cast" state */
.dv-gcard.pick{outline:3px solid var(--a);outline-offset:-3px;box-shadow:9px 9px 0 0 var(--a);transform:translate(-3px,-3px)}
.dv-gcard .check{position:absolute;top:0;right:0;z-index:2;width:1.15rem;height:1.15rem;background:var(--a);
  border-left:3px solid var(--stage-black);border-bottom:3px solid var(--stage-black);display:flex;align-items:center;justify-content:center}
.dv-gcard .check::after{content:"";width:.42rem;height:.72rem;border:solid var(--stage-ink);border-width:0 3px 3px 0;
  transform:translateY(-2px) rotate(45deg)}
`;
function GridCard({ ctx, e }) {
  const key = pieceKey(e);
  const isOpen = ctx.open.has(key);
  const staged = ctx.selected.has(key);
  const menuRef = ctx.menus.useContextMenu(() => ({ type: "entity", label: e.name, data: e }));
  const art = ctx.portraitUrl(e);
  const fmt = ctx.sourceLabel(e);
  const title = isOpen ? `${e.name} is open on the Workbench` : staged ? `${e.name} is staged - tap to unstage` : `Stage ${e.name} for the Workbench`;
  return /* @__PURE__ */ jsxDEV9("button", {
    ref: menuRef,
    className: `dv-gcard${isOpen ? " cast" : ""}${staged ? " pick" : ""}`,
    style: { "--a": e.accent ?? deckMeta(e.kind).accent },
    title,
    "data-pick": key,
    onClick: (ev) => {
      if (selectedText(window.getSelection()))
        return;
      ctx.onPiece(e, { shift: ev.shiftKey, meta: ev.ctrlKey || ev.metaKey });
    },
    children: [
      /* @__PURE__ */ jsxDEV9("div", {
        className: "cov",
        style: art ? { backgroundImage: `url("${art}")` } : undefined,
        children: [
          !art && /* @__PURE__ */ jsxDEV9("b", {
            children: e.name.charAt(0).toUpperCase()
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV9("span", {
            className: "kd",
            children: e.kind
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV9("div", {
        className: "bd",
        children: [
          /* @__PURE__ */ jsxDEV9("div", {
            className: "nm",
            children: e.name
          }, undefined, false, undefined, this),
          fmt && /* @__PURE__ */ jsxDEV9("span", {
            className: "fmt",
            children: fmt
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      isOpen && /* @__PURE__ */ jsxDEV9("span", {
        className: "tick",
        children: "on the workbench"
      }, undefined, false, undefined, this),
      staged && /* @__PURE__ */ jsxDEV9("span", {
        className: "check"
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
function Grid({ ctx }) {
  const marquee = useMarquee((cards, box, additive) => {
    ctx.onSweep?.(cards, box, additive);
  });
  return /* @__PURE__ */ jsxDEV9("div", {
    className: "dv-gridscroll",
    onPointerDown: marquee.onPointerDown,
    children: [
      /* @__PURE__ */ jsxDEV9("div", {
        className: "dv-grid",
        children: ctx.entities.map((e) => /* @__PURE__ */ jsxDEV9(GridCard, {
          ctx,
          e
        }, pieceKey(e), false, undefined, this))
      }, undefined, false, undefined, this),
      marquee.box && /* @__PURE__ */ jsxDEV9("div", {
        className: "dv-lasso",
        style: {
          left: marquee.box.left,
          top: marquee.box.top,
          width: marquee.box.right - marquee.box.left,
          height: marquee.box.bottom - marquee.box.top
        }
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
var view = {
  id: "grid",
  label: "Grid",
  iconSvg: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/></svg>',
  order: 10,
  css: CSS,
  Component({ ctx }) {
    return /* @__PURE__ */ jsxDEV9(Grid, {
      ctx
    }, undefined, false, undefined, this);
  }
};
var grid_default = view;

// src/ui/apps/library/views/showcase.tsx
import { useEffect as useEffect8, useReducer, useState as useState7 } from "react";
import { jsxDEV as jsxDEV10 } from "react/jsx-dev-runtime";
var CSS2 = `
.dv-show{flex:1;min-height:0;display:flex;flex-direction:column}
.dv-show .sc-empty{margin:auto;font-family:var(--font-body);font-style:italic;color:var(--stage-kicker)}
.dv-show .main{flex:1;min-height:0;display:flex;align-items:center;gap:clamp(.7rem,2vw,1.4rem);
  padding:clamp(.8rem,2vw,1.4rem)}
.dv-show .nav{flex:none;width:2.4rem;height:2.4rem;display:flex;align-items:center;justify-content:center;
  background:var(--stage-panel);color:var(--stage-paper);border:3px solid var(--stage-black);box-shadow:3px 3px 0 0 var(--stage-black);cursor:pointer;
  font-family:var(--font-big);font-weight:900;font-size:1rem;transition:transform .1s ease-out,box-shadow .1s ease-out}
.dv-show .nav:hover{transform:translate(-2px,-2px);box-shadow:5px 5px 0 0 var(--stage-black)}
.dv-show .nav:active{transform:translate(3px,3px);box-shadow:0 0 0 0 var(--stage-black)}
.dv-show .hero{flex:none;width:clamp(8rem,calc(var(--card-w) * 1.6),24rem);background:var(--stage-panel);border:3px solid var(--stage-black);
  box-shadow:0 24px 38px -14px var(--shadow-ink-deep)}
.dv-show .hero .cov{aspect-ratio:2/3;background:var(--a);border-bottom:3px solid var(--stage-black);position:relative;
  display:flex;align-items:flex-end;padding:.5rem;background-size:cover;background-position:center top}
.dv-show .hero .cov b{font-family:var(--font-big);font-weight:900;font-size:3rem;line-height:.72;color:var(--stage-ink);opacity:.82}
.dv-show .hero .kd{position:absolute;top:0;left:0;background:var(--stage-ink);color:var(--a);font-family:var(--font-mono);
  font-size:.5625rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:2px 5px;border-right:3px solid var(--stage-black);border-bottom:3px solid var(--stage-black)}
.dv-show .plate{flex:1;min-width:0;min-height:0;max-height:100%;overflow-y:auto;background:var(--stage-row);border:3px solid var(--stage-black);
  box-shadow:5px 6px 0 0 var(--shadow-ink);padding:clamp(.8rem,1.8vw,1.3rem);display:flex;flex-direction:column;gap:.6rem}
.dv-show .plate .nm{font-family:var(--font-big);font-weight:900;font-size:clamp(1.2rem,2.4vw,1.9rem);
  letter-spacing:-.01em;color:var(--stage-card);line-height:1;overflow-wrap:anywhere}
.dv-show .plate .tag{font-style:italic;font-weight:600;font-size:1rem;color:var(--stage-soft)}
.dv-show .plate .desc{font-size:.95rem;line-height:1.5;color:var(--stage-mute);white-space:pre-line}
.dv-show .plate .meta{font-family:var(--font-mono);font-size:.72rem;font-weight:600;letter-spacing:.08em;
  text-transform:uppercase;color:var(--stage-soft)}
.dv-show .plate .stage-btn{align-self:flex-start;font-family:var(--font-big);font-weight:900;font-size:.625rem;
  letter-spacing:.1em;text-transform:uppercase;padding:.55rem .9rem;border:3px solid var(--stage-black);cursor:pointer;
  background:var(--a);color:var(--stage-ink);box-shadow:4px 4px 0 0 var(--stage-black);
  transition:transform .1s ease-out,box-shadow .1s ease-out}
.dv-show .plate .stage-btn:hover{transform:translate(-2px,-2px);box-shadow:6px 6px 0 0 var(--stage-black)}
.dv-show .plate .stage-btn:active{transform:translate(3px,3px);box-shadow:0 0 0 0 var(--stage-black)}
.dv-show .plate .stage-btn.off{background:var(--stage-panel);color:var(--stage-soft);border-color:var(--a)}
.dv-show .plate .stage-btn.open{background:transparent;color:var(--a);border-color:var(--a);cursor:default;box-shadow:none}
.dv-show .plate .stage-btn.open:hover{transform:none;box-shadow:none}
.dv-show .rail{flex:none;display:flex;gap:.4rem;padding:.5rem .8rem .8rem;overflow-x:auto}
.dv-show .mini{flex:none;width:2.2rem;aspect-ratio:2/3;border:2px solid var(--stage-black);background:var(--a);cursor:pointer;
  background-size:cover;background-position:center top;opacity:.55;transition:opacity .1s ease-out,transform .1s ease-out}
.dv-show .mini:hover{opacity:1;transform:translateY(-2px)}
.dv-show .mini.now{opacity:1;border-color:var(--a);outline:2px solid var(--a)}
/* phones: hero row on top (nav flanking), the words plate drops below full-width (fluid law) */
@media(max-width:40rem){
  .dv-show .main{flex-wrap:wrap;overflow-y:auto;align-content:flex-start;gap:.6rem;padding:.6rem}
  .dv-show .hero{width:clamp(8rem,52vw,14rem)}
  .dv-show .plate{flex:1 1 100%;order:4;max-height:15rem}
}
`;
var focusByKind = new Map;
function clampIndex(raw, len) {
  return Math.max(0, Math.min(raw, len - 1));
}
function Showcase({ ctx }) {
  if (ctx.entities.length === 0) {
    return /* @__PURE__ */ jsxDEV10("div", {
      className: "dv-show",
      children: /* @__PURE__ */ jsxDEV10("p", {
        className: "sc-empty",
        children: [
          "Nothing in the ",
          ctx.deck.plural.toLowerCase(),
          " deck yet."
        ]
      }, undefined, true, undefined, this)
    }, undefined, false, undefined, this);
  }
  return /* @__PURE__ */ jsxDEV10(ShowcaseFocus, {
    ctx
  }, undefined, false, undefined, this);
}
function ShowcaseFocus({ ctx }) {
  const [, bump] = useReducer((x) => x + 1, 0);
  const idx = clampIndex(focusByKind.get(ctx.deck.kind) ?? 0, ctx.entities.length);
  const e = ctx.entities[idx];
  const accent = e.accent ?? deckMeta(e.kind).accent;
  const isOpen = ctx.open.has(pieceKey(e));
  const staged = ctx.selected.has(pieceKey(e));
  const menuRef = ctx.menus.useContextMenu(() => ({ type: "entity", label: e.name, data: e }));
  const [peek, setPeek] = useState7(null);
  useEffect8(() => {
    let cancelled = false;
    setPeek(null);
    ctx.peek(e).then((p) => {
      if (!cancelled)
        setPeek(p);
    });
    return () => {
      cancelled = true;
    };
  }, [ctx, e]);
  const step = (delta) => {
    const n = ctx.entities.length;
    focusByKind.set(ctx.deck.kind, (idx + delta + n) % n);
    bump();
  };
  const art = ctx.portraitUrl(e);
  const fmt = ctx.sourceLabel(e);
  const stageLabel = isOpen ? "On the Workbench" : staged ? "Staged - tap to unstage" : "Stage for the Workbench";
  return /* @__PURE__ */ jsxDEV10("div", {
    className: "dv-show",
    style: { "--a": accent },
    children: [
      /* @__PURE__ */ jsxDEV10("div", {
        className: "main",
        children: [
          /* @__PURE__ */ jsxDEV10("button", {
            className: "nav",
            title: "Previous",
            onClick: () => step(-1),
            children: "‹"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV10("div", {
            className: "hero",
            ref: menuRef,
            children: /* @__PURE__ */ jsxDEV10("div", {
              className: "cov",
              style: art ? { backgroundImage: `url("${art}")` } : undefined,
              children: [
                !art && /* @__PURE__ */ jsxDEV10("b", {
                  children: e.name.charAt(0).toUpperCase()
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV10("span", {
                  className: "kd",
                  children: e.kind
                }, undefined, false, undefined, this)
              ]
            }, undefined, true, undefined, this)
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV10("div", {
            className: "plate",
            children: [
              /* @__PURE__ */ jsxDEV10("div", {
                className: "nm",
                children: e.name
              }, undefined, false, undefined, this),
              fmt && /* @__PURE__ */ jsxDEV10("div", {
                className: "meta",
                children: fmt
              }, undefined, false, undefined, this),
              e.provenance && /* @__PURE__ */ jsxDEV10("div", {
                className: "meta",
                children: e.provenance
              }, undefined, false, undefined, this),
              peek?.tagline && /* @__PURE__ */ jsxDEV10("div", {
                className: "tag",
                children: peek.tagline
              }, undefined, false, undefined, this),
              peek?.description && /* @__PURE__ */ jsxDEV10("div", {
                className: "desc",
                children: peek.description
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV10("div", {
                className: "meta",
                children: [
                  idx + 1,
                  " / ",
                  ctx.entities.length
                ]
              }, undefined, true, undefined, this),
              /* @__PURE__ */ jsxDEV10("button", {
                className: `stage-btn${isOpen ? " open" : staged ? " off" : ""}`,
                onClick: () => ctx.onPiece(e),
                children: stageLabel
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV10("button", {
            className: "nav",
            title: "Next",
            onClick: () => step(1),
            children: "›"
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV10("div", {
        className: "rail",
        children: ctx.entities.map((m, i) => {
          const mart = ctx.portraitUrl(m);
          return /* @__PURE__ */ jsxDEV10("button", {
            className: `mini${i === idx ? " now" : ""}`,
            style: {
              "--a": m.accent ?? deckMeta(m.kind).accent,
              ...mart ? { backgroundImage: `url("${mart}")` } : {}
            },
            title: m.name,
            onClick: () => {
              focusByKind.set(ctx.deck.kind, i);
              bump();
            }
          }, pieceKey(m), false, undefined, this);
        })
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
var view2 = {
  id: "showcase",
  label: "Show",
  iconSvg: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" xmlns="http://www.w3.org/2000/svg"><rect x="7" y="3" width="10" height="15"/><path d="M3 8v8M21 8v8M9 21h6"/></svg>',
  order: 20,
  css: CSS2,
  Component: Showcase
};
var showcase_default = view2;

// src/ui/apps/library/views/list.tsx
import { jsxDEV as jsxDEV11 } from "react/jsx-dev-runtime";
var CSS3 = `
.dv-listscroll{flex:1;min-height:0;overflow-y:auto;padding:clamp(.6rem,1.4vw,.9rem)}
.dv-list{display:flex;flex-direction:column;gap:.35rem}
.dv-row{display:flex;align-items:center;gap:.7rem;width:100%;text-align:left;font:inherit;cursor:pointer;
  background:var(--stage-row);border:3px solid var(--stage-black);padding:.35rem .55rem;transition:transform .1s ease-out}
.dv-row:hover{transform:translate(-1px,-1px);border-color:var(--a)}
.dv-row .thumb{width:calc(var(--card-w) * .28);aspect-ratio:2/3;flex:none;background:var(--a);border:2px solid var(--stage-black);
  background-size:cover;background-position:center top;display:flex;align-items:center;justify-content:center;
  font-family:var(--font-big);font-weight:900;color:var(--stage-ink)}
/* an imported preset may be named as one 32-character word; it wraps rather than pushing the row */
.dv-row .nm{font-family:var(--font-big);font-weight:800;font-size:.8rem;color:var(--stage-card);
  overflow-wrap:anywhere;min-width:0}
.dv-row .kd{font-family:var(--font-mono);font-size:.625rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--stage-text-dim)}
.dv-row .bench{margin-left:auto;font-family:var(--font-mono);font-size:.5625rem;letter-spacing:.08em;
  text-transform:uppercase;color:var(--a);border:2px solid var(--a);padding:2px 6px}
.dv-row.cast{border-color:var(--a);background:var(--stage-sunken);opacity:.72}
.dv-row.pick{border-color:var(--a);background:var(--stage-sunken);box-shadow:inset 4px 0 0 0 var(--a)}
.dv-row .stag{margin-left:auto;font-family:var(--font-mono);font-size:.5625rem;letter-spacing:.08em;
  text-transform:uppercase;color:var(--stage-ink);background:var(--a);padding:2px 7px;font-weight:700}
`;
function ListRow({ ctx, e }) {
  const key = pieceKey(e);
  const isOpen = ctx.open.has(key);
  const staged = ctx.selected.has(key);
  const menuRef = ctx.menus.useContextMenu(() => ({ type: "entity", label: e.name, data: e }));
  const art = ctx.portraitUrl(e);
  const fmt = ctx.sourceLabel(e);
  const title = isOpen ? `${e.name} is open on the Workbench` : staged ? `${e.name} is staged - tap to unstage` : `Stage ${e.name} for the Workbench`;
  return /* @__PURE__ */ jsxDEV11("button", {
    ref: menuRef,
    className: `dv-row${isOpen ? " cast" : ""}${staged ? " pick" : ""}`,
    style: { "--a": e.accent ?? deckMeta(e.kind).accent },
    title,
    onClick: () => ctx.onPiece(e),
    children: [
      /* @__PURE__ */ jsxDEV11("span", {
        className: "thumb",
        style: art ? { backgroundImage: `url("${art}")` } : undefined,
        children: !art && e.name.charAt(0).toUpperCase()
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV11("span", {
        className: "nm",
        children: e.name
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV11("span", {
        className: "kd",
        children: e.kind
      }, undefined, false, undefined, this),
      fmt && /* @__PURE__ */ jsxDEV11("span", {
        className: "kd",
        children: fmt
      }, undefined, false, undefined, this),
      isOpen && /* @__PURE__ */ jsxDEV11("span", {
        className: "bench",
        children: "on the workbench"
      }, undefined, false, undefined, this),
      !isOpen && staged && /* @__PURE__ */ jsxDEV11("span", {
        className: "stag",
        children: "staged"
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
var view3 = {
  id: "list",
  label: "List",
  iconSvg: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" xmlns="http://www.w3.org/2000/svg"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  order: 30,
  css: CSS3,
  Component({ ctx }) {
    return /* @__PURE__ */ jsxDEV11("div", {
      className: "dv-listscroll",
      children: /* @__PURE__ */ jsxDEV11("div", {
        className: "dv-list",
        children: ctx.entities.map((e) => /* @__PURE__ */ jsxDEV11(ListRow, {
          ctx,
          e
        }, pieceKey(e), false, undefined, this))
      }, undefined, false, undefined, this)
    }, undefined, false, undefined, this);
  }
};
var list_default = view3;

// src/ui/apps/library/views/shelf.tsx
import { useEffect as useEffect9, useState as useState8 } from "react";
import { jsxDEV as jsxDEV12 } from "react/jsx-dev-runtime";
var CSS4 = `
.dv-shelfscroll{flex:1;min-height:0;overflow-y:auto;padding:clamp(.5rem,1.8vw,1.1rem)}
.dv-shelf{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(12rem,100%),1fr));gap:.85rem;position:relative}
.dv-book{display:flex;flex-direction:column;text-align:left;font:inherit;padding:0;cursor:pointer;position:relative;
  background:var(--stage-panel);border:3px solid var(--stage-black);box-shadow:5px 5px 0 0 var(--a);transition:transform .12s ease-out,box-shadow .12s ease-out;
  --spine:var(--a)}
.dv-book:hover{transform:translate(-2px,-2px);box-shadow:8px 8px 0 0 var(--a)}
.dv-book .spine{position:absolute;left:0;top:0;bottom:0;width:.45rem;background:var(--spine);border-right:2px solid var(--stage-black)}
.dv-book .body{padding:.7rem .7rem .55rem 1.05rem;display:flex;flex-direction:column;gap:.3rem;min-height:6.2rem}
.dv-book .nm{font-family:var(--font-big);font-weight:800;font-size:.95rem;color:var(--stage-card);line-height:1.1;
  overflow-wrap:anywhere}
.dv-book .meta{font-family:var(--font-mono);font-size:.68rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--stage-soft)}
.dv-book .facts{display:flex;flex-wrap:wrap;gap:.28rem;margin-top:.1rem}
.dv-book .fact{font-family:var(--font-mono);font-size:.62rem;font-weight:600;letter-spacing:.04em;
  text-transform:uppercase;color:var(--stage-soft);border:1px solid var(--stage-line);padding:.1rem .32rem}
.dv-book .fact.tagc{text-transform:none;color:var(--stage-card);border-color:var(--stage-seam);background:var(--stage-row)}
.dv-book .foot{display:flex;align-items:center;gap:.4rem;padding:0 .55rem .55rem 1.05rem}
.dv-book .sw{width:1.7rem;height:.9rem;border:2px solid var(--stage-black);background:var(--stage-ok);position:relative;flex:none;cursor:pointer;padding:0}
.dv-book .sw::after{content:"";position:absolute;right:2px;top:1px;width:.45rem;height:.45rem;background:var(--stage-ink)}
.dv-book .sw.off{background:var(--stage-faint)}
.dv-book .sw.off::after{left:2px;right:auto}
.dv-book.cast{border-color:var(--a);box-shadow:inset 4px 4px 0 0 var(--shadow-ink);transform:translate(2px,2px);opacity:.78}
.dv-book.pick{outline:3px solid var(--a);outline-offset:-3px}
.dv-book.off .nm{text-decoration:line-through;color:var(--stage-mute)}
.dv-book.off{opacity:.55}
.dv-book.drop{outline:3px dashed var(--a);outline-offset:2px}
.dv-book .tick{position:absolute;top:0;right:0;background:var(--a);color:var(--stage-ink);font-family:var(--font-mono);
  font-size:.5rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:2px 5px;border-left:2px solid var(--stage-black);border-bottom:2px solid var(--stage-black)}
.dv-book .dropTag{position:absolute;left:.5rem;right:.5rem;bottom:.4rem;font-family:var(--font-mono);font-size:.48rem;letter-spacing:.05em;text-transform:uppercase;color:var(--stage-ink);background:var(--a);border:2px solid var(--stage-black);padding:.2rem .3rem;text-align:center}
.dv-trash{position:sticky;bottom:.5rem;margin:0 auto;max-width:14rem;border:2px dashed var(--stage-danger-edge);color:var(--stage-danger-text);font-family:var(--font-mono);font-size:.55rem;letter-spacing:.08em;text-transform:uppercase;padding:.55rem;text-align:center;background:var(--stage-danger-bg);opacity:0;pointer-events:none}
.dv-trash.show{opacity:1;pointer-events:auto}
`;
var DRAG_MIME = "application/x-vaude-lore-id";
function ShelfFacts({
  ctx,
  e,
  peek
}) {
  const fmt = ctx.sourceLabel(e);
  const tags = peek?.tags?.slice(0, 3) ?? [];
  const extra = (peek?.tags?.length ?? 0) - tags.length;
  if (!fmt && !peek)
    return null;
  return /* @__PURE__ */ jsxDEV12("div", {
    className: "facts",
    children: [
      fmt && /* @__PURE__ */ jsxDEV12("span", {
        className: "fact",
        children: fmt
      }, undefined, false, undefined, this),
      typeof peek?.tokens === "number" && peek.tokens > 0 && /* @__PURE__ */ jsxDEV12("span", {
        className: "fact",
        children: [
          "~",
          peek.tokens,
          " tok"
        ]
      }, undefined, true, undefined, this),
      peek?.filled && /* @__PURE__ */ jsxDEV12("span", {
        className: "fact",
        children: [
          peek.filled,
          " fields"
        ]
      }, undefined, true, undefined, this),
      tags.map((t) => /* @__PURE__ */ jsxDEV12("span", {
        className: "fact tagc",
        children: t
      }, t, false, undefined, this)),
      extra > 0 && /* @__PURE__ */ jsxDEV12("span", {
        className: "fact tagc",
        children: [
          "+",
          extra
        ]
      }, undefined, true, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
function BookCard({
  ctx,
  e,
  peek,
  draggingId,
  setDraggingId
}) {
  const key = pieceKey(e);
  const isOpen = ctx.open.has(key);
  const staged = ctx.selected.has(key);
  const lore = ctx.loreShelf;
  const enabled = lore ? lore.enabledOf(e) : true;
  const count = lore?.entryCountOf(e);
  const [over, setOver] = useState8(false);
  const menuRef = ctx.menus.useContextMenu(() => ({
    type: "entity",
    label: e.name,
    data: e
  }));
  const accent = e.accent ?? deckMeta(e.kind).accent;
  const onDragStart = (ev) => {
    if (e.kind !== "lorebook")
      return;
    ev.dataTransfer.setData(DRAG_MIME, e.id);
    ev.dataTransfer.effectAllowed = "copyMove";
    setDraggingId(e.id);
  };
  const onDragOver = (ev) => {
    if (e.kind !== "lorebook" || !draggingId || draggingId === e.id)
      return;
    ev.preventDefault();
    setOver(true);
  };
  const onDrop = (ev) => {
    ev.preventDefault();
    setOver(false);
    const fromId = ev.dataTransfer.getData(DRAG_MIME);
    if (!fromId || fromId === e.id || !lore)
      return;
    const from = ctx.entities.find((x) => x.id === fromId && x.kind === "lorebook");
    if (from)
      lore.onMerge(e, from);
    setDraggingId(null);
  };
  return /* @__PURE__ */ jsxDEV12("div", {
    ref: menuRef,
    role: "button",
    tabIndex: 0,
    draggable: e.kind === "lorebook",
    className: `dv-book${isOpen ? " cast" : ""}${staged ? " pick" : ""}${enabled ? "" : " off"}${over ? " drop" : ""}`,
    style: { "--a": accent, "--spine": accent },
    title: isOpen ? `${e.name} is open on the Workbench` : `Stage ${e.name}`,
    onClick: () => ctx.onPiece(e),
    onKeyDown: (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        ctx.onPiece(e);
      }
    },
    onDragStart,
    onDragEnd: () => setDraggingId(null),
    onDragOver,
    onDragLeave: () => setOver(false),
    onDrop,
    children: [
      /* @__PURE__ */ jsxDEV12("span", {
        className: "spine",
        "aria-hidden": "true"
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV12("div", {
        className: "body",
        children: [
          /* @__PURE__ */ jsxDEV12("div", {
            className: "nm",
            children: e.name || "(unnamed)"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV12("div", {
            className: "meta",
            children: typeof count === "number" ? `${count} ${count === 1 ? "entry" : "entries"}` : e.kind
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV12(ShelfFacts, {
            ctx,
            e,
            peek
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      lore && e.kind === "lorebook" && /* @__PURE__ */ jsxDEV12("div", {
        className: "foot",
        onClick: (ev) => ev.stopPropagation(),
        children: [
          /* @__PURE__ */ jsxDEV12("button", {
            type: "button",
            className: enabled ? "sw" : "sw off",
            role: "switch",
            "aria-checked": enabled,
            "aria-label": enabled ? "Book is on" : "Book is off",
            title: "Off books skip export and Rehearsal listing",
            onClick: () => lore.onToggleEnabled(e, !enabled)
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV12("span", {
            className: "meta",
            children: enabled ? "On" : "Off"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV12("button", {
            type: "button",
            className: "meta",
            style: {
              marginLeft: "auto",
              border: "1px solid var(--stage-seam)",
              background: "var(--stage-row)",
              padding: "0.12rem 0.3rem",
              cursor: "pointer",
              color: "var(--stage-soft)"
            },
            onClick: () => lore.onSplit(e),
            children: "Split"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV12("button", {
            type: "button",
            className: "meta",
            style: {
              border: "1px solid var(--stage-seam)",
              background: "var(--stage-row)",
              padding: "0.12rem 0.3rem",
              cursor: "pointer",
              color: "var(--stage-soft)"
            },
            onClick: () => lore.onDuplicate(e),
            children: "Copy"
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      isOpen && /* @__PURE__ */ jsxDEV12("span", {
        className: "tick",
        children: "open"
      }, undefined, false, undefined, this),
      over && /* @__PURE__ */ jsxDEV12("span", {
        className: "dropTag",
        children: [
          "Drop to merge into ",
          e.name
        ]
      }, undefined, true, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
var view4 = {
  id: "shelf",
  label: "Shelf",
  iconSvg: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" xmlns="http://www.w3.org/2000/svg"><path d="M4 19h16"/><path d="M6 19V7l4 2 4-2 4 2v10"/><path d="M10 9v10"/><path d="M14 9v10"/></svg>',
  order: 15,
  css: CSS4,
  Component({ ctx }) {
    const [draggingId, setDraggingId] = useState8(null);
    const [query, setQuery] = useState8("");
    const [peeks, setPeeks] = useState8({});
    useEffect9(() => {
      let cancelled = false;
      for (const e of ctx.entities) {
        const key = pieceKey(e);
        if (key in peeks)
          continue;
        ctx.peek(e).then((p) => {
          if (!cancelled)
            setPeeks((prev) => (key in prev) ? prev : { ...prev, [key]: p });
        });
      }
      return () => {
        cancelled = true;
      };
    }, [ctx.entities]);
    const q = query.trim().toLowerCase();
    const filtered = !q ? ctx.entities : ctx.entities.filter((e) => {
      if (e.name.toLowerCase().includes(q))
        return true;
      const keys = e.searchKeys;
      if (keys?.some((k) => k.toLowerCase().includes(q)))
        return true;
      const tags = peeks[pieceKey(e)]?.tags;
      if (tags?.some((t) => t.toLowerCase().includes(q)))
        return true;
      return false;
    });
    return /* @__PURE__ */ jsxDEV12("div", {
      className: "dv-shelfscroll",
      children: [
        /* @__PURE__ */ jsxDEV12("label", {
          style: {
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
            border: "2px solid var(--stage-seam)",
            background: "var(--stage-sunken)",
            padding: "0.35rem 0.5rem",
            marginBottom: "0.75rem"
          },
          children: [
            /* @__PURE__ */ jsxDEV12("span", {
              style: {
                fontFamily: "var(--font-mono)",
                fontSize: "0.68rem",
                color: "var(--stage-soft)",
                letterSpacing: "0.08em",
                textTransform: "uppercase"
              },
              children: "Find"
            }, undefined, false, undefined, this),
            /* @__PURE__ */ jsxDEV12("input", {
              value: query,
              onChange: (ev) => setQuery(ev.target.value),
              placeholder: "Name, key, or tag…",
              "aria-label": "Search by name, key, or tag",
              style: {
                flex: 1,
                border: 0,
                background: "none",
                color: "var(--stage-soft)",
                fontFamily: "var(--font-body)",
                fontSize: "0.9rem"
              }
            }, undefined, false, undefined, this)
          ]
        }, undefined, true, undefined, this),
        /* @__PURE__ */ jsxDEV12("div", {
          className: "dv-shelf",
          children: filtered.map((e) => /* @__PURE__ */ jsxDEV12(BookCard, {
            ctx,
            e,
            peek: peeks[pieceKey(e)] ?? null,
            draggingId,
            setDraggingId
          }, pieceKey(e), false, undefined, this))
        }, undefined, false, undefined, this),
        filtered.length === 0 && /* @__PURE__ */ jsxDEV12("p", {
          style: {
            fontFamily: "var(--font-body)",
            fontStyle: "italic",
            color: "var(--stage-kicker)"
          },
          children: "Nothing matches that search."
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV12("div", {
          className: `dv-trash${draggingId ? " show" : ""}`,
          children: "Drag onto another book to merge"
        }, undefined, false, undefined, this)
      ]
    }, undefined, true, undefined, this);
  }
};
var shelf_default = view4;

// src/ui/apps/library/views/regex-shelf.tsx
import { useState as useState9 } from "react";
import { jsxDEV as jsxDEV13, Fragment as Fragment3 } from "react/jsx-dev-runtime";
var CSS5 = `
.rgx-scroll{flex:1;min-height:0;overflow-y:auto;padding:clamp(.5rem,1.8vw,1.1rem)}
.rgx-shelf{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(16rem,100%),1fr));gap:1.15rem;position:relative}
.rgx-set{--spine:var(--a);position:relative;display:flex;flex-direction:column;min-height:11rem;padding:0 0 0 .75rem;text-align:left;font:inherit;color:inherit;cursor:pointer;
  background:var(--stage-panel);border:3px solid var(--stage-black);box-shadow:5px 5px 0 0 var(--stage-black);transition:transform .12s ease-out,box-shadow .12s ease-out}
.rgx-set::before{content:"";position:absolute;left:0;top:0;bottom:0;width:.75rem;background:var(--spine);border-right:3px solid var(--stage-black)}
.rgx-set:hover{transform:translate(-2px,-2px);box-shadow:8px 8px 0 0 var(--stage-black)}
.rgx-set.cast{border-color:var(--a);box-shadow:inset 4px 4px 0 0 var(--shadow-ink);transform:translate(2px,2px);opacity:.8}
.rgx-set.pick{outline:3px solid var(--a);outline-offset:-3px}
.rgx-set.off{opacity:.55}
.rgx-set.off .rgx-nm{text-decoration:line-through;color:var(--stage-mute)}
.rgx-set.drop{outline:3px dashed var(--a);outline-offset:2px}
.rgx-head{display:flex;align-items:flex-start;gap:.6rem;padding:.75rem .7rem .45rem}
.rgx-mark{width:2.3rem;height:2.3rem;flex:none;display:grid;place-items:center;font:900 .95rem var(--font-mono);
  background:var(--spine);color:var(--stage-ink);border:3px solid var(--stage-black);box-shadow:2px 2px 0 0 var(--stage-black)}
.rgx-name{min-width:0}
.rgx-nm{display:block;font:900 1rem/1.1 var(--font-big);letter-spacing:.02em;text-transform:uppercase;color:var(--stage-card);overflow-wrap:anywhere}
.rgx-sub{font:500 .625rem var(--font-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--stage-text-dim)}
.rgx-does{flex:1;padding:0 .7rem;font:italic 600 .82rem/1.4 var(--font-body);color:var(--stage-mute);overflow-wrap:anywhere}
.rgx-foot{display:flex;align-items:flex-end;gap:.5rem;padding:.5rem .7rem .7rem;border-top:2px solid var(--stage-seam)}
.rgx-count b{display:block;font:900 1.5rem/1 var(--font-big);color:var(--stage-card)}
.rgx-count span{font:500 .625rem var(--font-mono);letter-spacing:.09em;text-transform:uppercase;color:var(--stage-text-dim)}
.rgx-slow{align-self:center;font:700 .625rem var(--font-mono);letter-spacing:.05em;text-transform:uppercase;border:1px solid var(--stage-warn);color:var(--stage-warn);padding:.1rem .3rem}
.rgx-sw{width:2rem;height:1.05rem;flex:none;margin-left:auto;align-self:center;padding:0;cursor:pointer;position:relative;background:var(--stage-ok);border:2px solid var(--stage-black)}
.rgx-sw::after{content:"";position:absolute;right:2px;top:1px;width:.58rem;height:.58rem;background:var(--stage-ink)}
.rgx-sw.off{background:var(--stage-faint)}
.rgx-sw.off::after{left:2px;right:auto}
.rgx-act{align-self:center;cursor:pointer;font:700 .625rem var(--font-mono);letter-spacing:.05em;text-transform:uppercase;padding:.22rem .4rem;
  color:var(--stage-soft);background:var(--stage-row);border:1px solid var(--stage-seam)}
.rgx-new{display:grid;place-items:center;min-height:11rem;cursor:pointer;font:700 .625rem var(--font-mono);letter-spacing:.09em;text-transform:uppercase;
  color:var(--stage-mute);background:none;border:2px dashed var(--stage-seam)}
.rgx-empty{font-family:var(--font-body);font-style:italic;color:var(--stage-kicker)}
.rgx-trash{position:sticky;bottom:.5rem;margin:.6rem auto 0;max-width:16rem;text-align:center;opacity:0;pointer-events:none;
  font:500 .625rem var(--font-mono);letter-spacing:.08em;text-transform:uppercase;padding:.55rem;
  color:var(--stage-danger-text);background:var(--stage-danger-bg);border:2px dashed var(--stage-danger-edge)}
.rgx-trash.show{opacity:1;pointer-events:auto}
`;
var DRAG_MIME2 = "application/x-vaude-regex-id";
var markOf = (name) => (name.match(/\b\w/g) ?? []).slice(0, 2).join("").toUpperCase() || ".*";
function SetCard({
  ctx,
  e,
  draggingId,
  setDraggingId
}) {
  const rgx = ctx.regexShelf;
  const key = pieceKey(e);
  const isOpen = ctx.open.has(key);
  const staged = ctx.selected.has(key);
  const enabled = rgx ? rgx.enabledOf(e) : true;
  const count = rgx?.ruleCountOf(e);
  const onCount = rgx?.enabledRuleCountOf(e);
  const does = rgx?.doesWhatOf(e);
  const slow = rgx?.slowCountOf(e) ?? 0;
  const [over, setOver] = useState9(false);
  const menuRef = ctx.menus.useContextMenu(() => ({ type: "entity", label: e.name, data: e }));
  const accent = e.accent ?? deckMeta(e.kind).accent;
  const onDragStart = (ev) => {
    ev.dataTransfer.setData(DRAG_MIME2, e.id);
    ev.dataTransfer.effectAllowed = "copyMove";
    setDraggingId(e.id);
  };
  const onDragOver = (ev) => {
    if (!draggingId || draggingId === e.id)
      return;
    ev.preventDefault();
    setOver(true);
  };
  const onDrop = (ev) => {
    ev.preventDefault();
    setOver(false);
    const fromId = ev.dataTransfer.getData(DRAG_MIME2);
    if (!fromId || fromId === e.id || !rgx)
      return;
    const from = ctx.entities.find((x) => x.id === fromId && x.kind === "regex");
    if (from)
      rgx.onMerge(e, from);
    setDraggingId(null);
  };
  return /* @__PURE__ */ jsxDEV13("div", {
    ref: menuRef,
    role: "button",
    tabIndex: 0,
    draggable: true,
    className: `rgx-set${isOpen ? " cast" : ""}${staged ? " pick" : ""}${enabled ? "" : " off"}${over ? " drop" : ""}`,
    style: { "--a": accent, "--spine": accent },
    title: isOpen ? `${e.name} is open on the Workbench` : `Stage ${e.name}`,
    onClick: () => ctx.onPiece(e),
    onKeyDown: (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        ctx.onPiece(e);
      }
    },
    onDragStart,
    onDragEnd: () => setDraggingId(null),
    onDragOver,
    onDragLeave: () => setOver(false),
    onDrop,
    children: [
      /* @__PURE__ */ jsxDEV13("div", {
        className: "rgx-head",
        children: [
          /* @__PURE__ */ jsxDEV13("span", {
            className: "rgx-mark",
            "aria-hidden": "true",
            children: markOf(e.name || "?")
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV13("div", {
            className: "rgx-name",
            children: [
              /* @__PURE__ */ jsxDEV13("span", {
                className: "rgx-nm",
                children: e.name || "(unnamed)"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV13("span", {
                className: "rgx-sub",
                children: ctx.sourceLabel(e) ?? "regex set"
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV13("p", {
        className: "rgx-does",
        children: does ?? "…"
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV13("div", {
        className: "rgx-foot",
        onClick: (ev) => ev.stopPropagation(),
        children: [
          /* @__PURE__ */ jsxDEV13("div", {
            className: "rgx-count",
            children: [
              /* @__PURE__ */ jsxDEV13("b", {
                children: typeof count === "number" ? count : "·"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV13("span", {
                children: [
                  count === 1 ? "rule" : "rules",
                  typeof onCount === "number" && typeof count === "number" && count > 0 ? ` · ${onCount} on` : ""
                ]
              }, undefined, true, undefined, this)
            ]
          }, undefined, true, undefined, this),
          slow > 0 && /* @__PURE__ */ jsxDEV13("span", {
            className: "rgx-slow",
            children: `${slow} slow`
          }, undefined, false, undefined, this),
          rgx && /* @__PURE__ */ jsxDEV13(Fragment3, {
            children: [
              /* @__PURE__ */ jsxDEV13("button", {
                type: "button",
                className: enabled ? "rgx-sw" : "rgx-sw off",
                role: "switch",
                "aria-checked": enabled,
                "aria-label": enabled ? "Set is on" : "Set is off",
                title: "Off sets skip export",
                onClick: () => rgx.onToggleEnabled(e, !enabled)
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV13("button", {
                type: "button",
                className: "rgx-act",
                onClick: () => rgx.onSplit(e),
                children: "Split"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV13("button", {
                type: "button",
                className: "rgx-act",
                onClick: () => rgx.onDuplicate(e),
                children: "Copy"
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
var view5 = {
  id: "regex-shelf",
  label: "Sets",
  iconSvg: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" xmlns="http://www.w3.org/2000/svg"><path d="M4 19h16"/><path d="M6 19V7l4 2 4-2 4 2v10"/><path d="M10 9v10"/><path d="M14 9v10"/></svg>',
  order: 16,
  kinds: ["regex"],
  css: CSS5,
  Component({ ctx }) {
    const [draggingId, setDraggingId] = useState9(null);
    const rgx = ctx.regexShelf;
    return /* @__PURE__ */ jsxDEV13("div", {
      className: "rgx-scroll",
      children: [
        /* @__PURE__ */ jsxDEV13("div", {
          className: "rgx-shelf",
          children: [
            ctx.entities.map((e) => /* @__PURE__ */ jsxDEV13(SetCard, {
              ctx,
              e,
              draggingId,
              setDraggingId
            }, pieceKey(e), false, undefined, this)),
            rgx && /* @__PURE__ */ jsxDEV13("button", {
              type: "button",
              className: "rgx-new",
              onClick: () => rgx.onNew(),
              children: "+ New set · or drop a file"
            }, undefined, false, undefined, this)
          ]
        }, undefined, true, undefined, this),
        ctx.entities.length === 0 && /* @__PURE__ */ jsxDEV13("p", {
          className: "rgx-empty",
          children: "No regex sets yet."
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV13("div", {
          className: `rgx-trash${draggingId ? " show" : ""}`,
          children: "Drag onto another set to merge"
        }, undefined, false, undefined, this)
      ]
    }, undefined, true, undefined, this);
  }
};
var regex_shelf_default = view5;

// src/ui/apps/library/views/persona-shelf.tsx
import { jsxDEV as jsxDEV14 } from "react/jsx-dev-runtime";
var CSS6 = `
.psh-scroll{flex:1;min-height:0;overflow-y:auto;padding:clamp(.5rem,1.8vw,1.1rem)}
.psh-shelf{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(15rem,100%),1fr));gap:1.1rem}
.psh-card{position:relative;display:flex;flex-direction:column;text-align:left;font:inherit;color:inherit;cursor:pointer;padding:0;
  background:var(--stage-panel);border:2px solid var(--stage-black);box-shadow:5px 5px 0 0 var(--stage-black);transition:transform .12s ease-out,box-shadow .12s ease-out}
.psh-card:hover{transform:translate(-2px,-2px);box-shadow:8px 8px 0 0 var(--stage-black)}
.psh-card.cast{border-color:var(--a);box-shadow:inset 4px 4px 0 0 var(--shadow-ink);transform:translate(2px,2px);opacity:.85}
.psh-card.pick{outline:3px solid var(--a);outline-offset:-3px}
.psh-cov{height:7.5rem;background:var(--stage-sunken);background-size:cover;background-position:center;display:grid;place-items:center;
  color:var(--stage-kicker);font:900 1.6rem var(--font-big);border-bottom:2px solid var(--stage-black);position:relative}
.psh-def{position:absolute;top:.4rem;right:.4rem;font:700 .625rem var(--font-mono);letter-spacing:.06em;text-transform:uppercase;
  background:var(--stage-warn-ink);color:var(--stage-warn);border:1px solid var(--stage-black);padding:.08rem .3rem}
.psh-body{padding:.5rem .6rem}
.psh-nm{display:block;font:800 .8rem var(--font-big);letter-spacing:.03em;text-transform:uppercase;color:var(--stage-card);overflow-wrap:anywhere}
.psh-brief{font-style:italic;font-family:var(--font-body);color:var(--stage-mute);font-size:.78rem;overflow-wrap:anywhere}
.psh-line{font:500 .625rem var(--font-mono);letter-spacing:.05em;text-transform:uppercase;color:var(--stage-text-dim);margin-top:.3rem}
.psh-new{display:grid;place-items:center;min-height:12rem;cursor:pointer;font:700 .625rem var(--font-mono);letter-spacing:.09em;text-transform:uppercase;
  color:var(--stage-mute);background:none;border:2px dashed var(--stage-seam)}
`;
var ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>';
function PersonaCard({ ctx, e }) {
  const menuRef = ctx.menus.useContextMenu(() => ({ type: "entity", label: e.name, data: e }));
  const ps = ctx.personaShelf;
  const key = pieceKey(e);
  const isOpen = ctx.open.has(key);
  const staged = ctx.selected.has(key);
  const url = ctx.portraitUrl(e);
  const sectionCount = ps?.sectionCountOf(e);
  const facts = [
    ps?.pronounsOf(e),
    sectionCount ? `${sectionCount} section${sectionCount === 1 ? "" : "s"}` : undefined,
    ps?.hasLorebookOf(e) ? "lorebook linked" : undefined
  ].filter(Boolean);
  return /* @__PURE__ */ jsxDEV14("div", {
    ref: menuRef,
    role: "button",
    tabIndex: 0,
    className: `psh-card${isOpen ? " cast" : ""}${staged ? " pick" : ""}`,
    style: { "--a": e.accent ?? deckMeta(e.kind).accent },
    title: isOpen ? `${e.name} is open on the Workbench` : `Stage ${e.name}`,
    onClick: () => ctx.onPiece(e),
    onKeyDown: (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        ctx.onPiece(e);
      }
    },
    children: [
      /* @__PURE__ */ jsxDEV14("div", {
        className: "psh-cov",
        style: url ? { backgroundImage: `url("${url}")` } : undefined,
        children: [
          !url && /* @__PURE__ */ jsxDEV14("span", {
            children: e.name.charAt(0).toUpperCase()
          }, undefined, false, undefined, this),
          ps?.defaultId === e.id && /* @__PURE__ */ jsxDEV14("span", {
            className: "psh-def",
            children: "Default"
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV14("div", {
        className: "psh-body",
        children: [
          /* @__PURE__ */ jsxDEV14("b", {
            className: "psh-nm",
            children: e.name
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV14("i", {
            className: "psh-brief",
            children: ps?.briefOf(e) ?? "No blurb yet."
          }, undefined, false, undefined, this),
          facts.length > 0 && /* @__PURE__ */ jsxDEV14("div", {
            className: "psh-line",
            children: facts.join(" · ")
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
function PersonaShelfView(ctx) {
  const personas = ctx.entities.filter((e) => e.kind === "persona");
  return /* @__PURE__ */ jsxDEV14("div", {
    className: "psh-scroll",
    children: /* @__PURE__ */ jsxDEV14("div", {
      className: "psh-shelf",
      children: [
        personas.map((e) => /* @__PURE__ */ jsxDEV14(PersonaCard, {
          ctx,
          e
        }, e.id, false, undefined, this)),
        ctx.personaShelf && /* @__PURE__ */ jsxDEV14("button", {
          type: "button",
          className: "psh-new",
          onClick: () => ctx.personaShelf.onNew(),
          children: "+ New persona"
        }, undefined, false, undefined, this)
      ]
    }, undefined, true, undefined, this)
  }, undefined, false, undefined, this);
}
var view6 = {
  id: "persona-shelf",
  label: "Shelf",
  iconSvg: ICON,
  order: 15,
  css: CSS6,
  kinds: ["persona"],
  Component({ ctx }) {
    return /* @__PURE__ */ jsxDEV14(PersonaShelfView, {
      ...ctx
    }, undefined, false, undefined, this);
  }
};
var persona_shelf_default = view6;

// src/ui/apps/library/views/registry.ts
var VIEWS = [grid_default, showcase_default, list_default, shelf_default, regex_shelf_default, persona_shelf_default];
var applies = (v, kind) => !v.kinds || kind === undefined || v.kinds.includes(kind);
var deckViews = (kind) => VIEWS.filter((v) => applies(v, kind)).sort((a, b) => a.order - b.order);
var deckView = (id, kind) => {
  const found = VIEWS.find((v) => v.id === id);
  if (found && applies(found, kind))
    return found;
  return deckViews(kind)[0];
};

// src/ui/apps/library/damage-dismiss.ts
var PREF_DAMAGE_SEEN = "library.damageSeen";
var keyOf = (entry) => `${entry.kind}/${entry.id}:${entry.reason}`;
function damageSeenList(entries) {
  return [...new Set(entries.map(keyOf))].sort();
}
var seenSet = (stored) => new Set(Array.isArray(stored) ? stored.filter((v) => typeof v === "string") : []);
function damageHidden(entries, stored) {
  if (entries.length === 0)
    return true;
  const seen = seenSet(stored);
  return entries.every((entry) => seen.has(keyOf(entry)));
}

// src/ui/apps/library/damage-notice.tsx
import { jsxDEV as jsxDEV15 } from "react/jsx-dev-runtime";
var reasonText = (reason) => {
  switch (reason) {
    case "unreadable-json":
      return "is not readable JSON";
    case "schema-mismatch":
      return "is not in a format Hoplight recognises";
    case "kind-mismatch":
      return "holds a different kind of piece than this folder is for";
    case "id-mismatch":
      return "holds a different piece id than its filename";
    case "unusable-filename":
      return "has characters its name cannot keep - rename it without spaces or punctuation";
  }
};
function DamageNotice(props) {
  if (props.entries.length === 0)
    return null;
  const prefs = props.prefs;
  if (prefs && damageHidden(props.entries, prefs.get(PREF_DAMAGE_SEEN)))
    return null;
  const count = props.entries.length;
  return /* @__PURE__ */ jsxDEV15("section", {
    className: "damage-note",
    role: "region",
    "aria-labelledby": "damage-note-title",
    children: [
      /* @__PURE__ */ jsxDEV15("strong", {
        id: "damage-note-title",
        children: `${count} ${count === 1 ? "file" : "files"} in your studio folder could not be read`
      }, undefined, false, undefined, this),
      prefs && /* @__PURE__ */ jsxDEV15("button", {
        type: "button",
        className: "dnx",
        title: "Put this away. It comes back if another file stops loading.",
        "aria-label": "Dismiss this notice",
        onClick: () => prefs.set(PREF_DAMAGE_SEEN, damageSeenList(props.entries)),
        children: "dismiss"
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV15("p", {
        children: "The files are still on disk and Hoplight did not change them."
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV15("details", {
        children: [
          /* @__PURE__ */ jsxDEV15("summary", {
            children: "Show files and recovery details"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV15("ul", {
            children: props.entries.map((entry) => /* @__PURE__ */ jsxDEV15("li", {
              children: [
                /* @__PURE__ */ jsxDEV15("code", {
                  children: `${entry.kind}/${entry.id}.json`
                }, undefined, false, undefined, this),
                ` ${reasonText(entry.reason)}.`
              ]
            }, `${entry.kind}:${entry.id}`, true, undefined, this))
          }, undefined, false, undefined, this),
          props.studioDir && /* @__PURE__ */ jsxDEV15("p", {
            children: /* @__PURE__ */ jsxDEV15("code", {
              children: props.studioDir
            }, undefined, false, undefined, this)
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV15("p", {
            children: "Restore a file from backup, or remove it yourself to clear this notice."
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this)
    ]
  }, undefined, true, undefined, this);
}

// src/ui/apps/library/first-landing.tsx
import { jsxDEV as jsxDEV16 } from "react/jsx-dev-runtime";
function StudioUnreachable({
  css,
  damaged,
  studioDir,
  onRetry
}) {
  return /* @__PURE__ */ jsxDEV16("div", {
    className: "lib",
    children: [
      /* @__PURE__ */ jsxDEV16("style", {
        children: css
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV16(DamageNotice, {
        entries: damaged,
        studioDir
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV16("div", {
        className: "stagezone seam",
        children: [
          /* @__PURE__ */ jsxDEV16("p", {
            className: "voice",
            children: "Could not reach the studio. Your pieces are still on disk."
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV16("button", {
            className: "doorcard stamp",
            onClick: onRetry,
            children: "Try again"
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
function FirstLanding({
  css,
  damaged,
  studioDir,
  onDrop,
  onPickImport,
  onStartFresh,
  overlay
}) {
  return /* @__PURE__ */ jsxDEV16("div", {
    className: "lib",
    onDragOver: (e) => e.preventDefault(),
    onDrop,
    children: [
      /* @__PURE__ */ jsxDEV16("style", {
        children: css
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV16(DamageNotice, {
        entries: damaged,
        studioDir
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV16("div", {
        className: "stagezone seam",
        children: [
          /* @__PURE__ */ jsxDEV16("button", {
            className: "doorcard primary stamp",
            onClick: onPickImport,
            children: "Drag and drop to import asset"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV16("button", {
            className: "doorcard stamp",
            onClick: onStartFresh,
            children: "Click here to start fresh"
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV16("p", {
        className: "voice",
        children: "Every pack starts with a first card."
      }, undefined, false, undefined, this),
      overlay
    ]
  }, undefined, true, undefined, this);
}

// src/ui/apps/library/agent-surface.ts
import { useEffect as useEffect11, useRef as useRef6 } from "react";

// src/ui/agent/use-studio-changes.ts
import { useEffect as useEffect10, useRef as useRef5, useState as useState10 } from "react";

// src/browser-mode.ts
function isBrowserStudio(doc = typeof document === "undefined" ? undefined : document) {
  return doc?.querySelector('meta[name="hoplight-runtime"]')?.getAttribute("content") === "browser";
}
var BROWSER_STUDIO_CHANGE_EVENT = "hoplight:studio-change";
// src/ui/_shared/asset-url.ts
function portraitUrl(kind, id) {
  const pocket = globalThis.__HOPLIGHT_POCKET_PORTRAIT__?.(kind, id);
  return pocket ?? `/api/studio/portrait?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`;
}

// src/ui/agent/use-studio-changes.ts
function useStudioChanges(connect = (url) => new EventSource(url)) {
  const [version, setVersion] = useState10(0);
  const [kinds, setKinds] = useState10([]);
  const [watching, setWatching] = useState10(false);
  const connectRef = useRef5(connect);
  connectRef.current = connect;
  useEffect10(() => {
    if (isBrowserStudio()) {
      const changed = (event) => {
        const detail = event.detail;
        setKinds(Array.isArray(detail?.kinds) ? detail.kinds.filter((kind) => typeof kind === "string") : []);
        setVersion((current) => current + 1);
      };
      window.addEventListener(BROWSER_STUDIO_CHANGE_EVENT, changed);
      return () => window.removeEventListener(BROWSER_STUDIO_CHANGE_EVENT, changed);
    }
    let source = null;
    let retry = null;
    let live = true;
    let failures = 0;
    let everReady = false;
    const scheduleRetry = () => {
      if (!live || retry)
        return;
      failures++;
      if (!everReady && failures >= 3)
        return;
      if (failures > 8)
        return;
      const wait = Math.min(3000 * 2 ** (failures - 1), 60000);
      retry = setTimeout(() => {
        retry = null;
        open();
      }, wait);
    };
    const open = () => {
      if (!live)
        return;
      try {
        source = connectRef.current("/api/agent/events");
      } catch {
        setWatching(false);
        scheduleRetry();
        return;
      }
      source.addEventListener("ready", () => {
        setWatching(true);
        failures = 0;
        if (everReady)
          setVersion((n) => n + 1);
        everReady = true;
      });
      source.addEventListener("degraded", () => {
        setWatching(false);
      });
      source.addEventListener("changed", (event) => {
        try {
          const data = JSON.parse(event.data);
          setKinds(Array.isArray(data.kinds) ? data.kinds.filter((k) => typeof k === "string") : []);
        } catch {
          setKinds([]);
        }
        setVersion((n) => n + 1);
      });
      source.addEventListener("error", () => {
        setWatching(false);
        source?.close();
        source = null;
        scheduleRetry();
      });
    };
    open();
    return () => {
      live = false;
      if (retry)
        clearTimeout(retry);
      source?.close();
    };
  }, []);
  return { version, kinds, watching };
}

// src/ui/apps/library/agent-surface.ts
var LIBRARY_AGENT_SURFACE = {
  describe: "Every piece in the studio, sorted into decks, plus anything on disk that would not open.",
  actions: [
    {
      id: "open-piece",
      label: "Open a piece",
      describe: "Put a piece on the Workbench so it can be read or edited."
    },
    {
      id: "explain-unreadable",
      label: "Explain an unreadable file",
      describe: "Say why a file in the studio folder did not open and what would actually fix it."
    }
  ]
};
function libraryAgentState(input) {
  const notes = [];
  if (input.loadFailed) {
    notes.push("The studio could not be reached, so this listing may be empty or out of date.");
  }
  notes.push(`The studio holds ${String(input.total)} pieces in total.`);
  if (input.filter) {
    notes.push(`A search for "${input.filter}" is filtering this shelf. Pieces that do not match are ` + "hidden, not missing, so this listing is not the whole deck.");
  }
  if (input.damaged.length > 0) {
    notes.push(`${String(input.damaged.length)} file(s) in the studio folder did not open: ` + input.damaged.map((d) => `${d.kind}/${d.id}.json (${d.reason})`).join(", "));
  }
  return {
    headline: `The ${input.deck} shelf, showing ${String(input.inDeck.length)} of ` + `${String(input.total)} pieces in the studio.`,
    items: input.inDeck.map((e) => ({
      kind: e.kind,
      id: e.id,
      name: e.name,
      ...input.staged.has(`${e.kind}:${e.id}`) ? { focused: true } : {}
    })),
    notes
  };
}
function usePublishLibrarySurface(ctx, input) {
  const { deck, inDeck, total, damaged, staged, loadFailed, filter } = input;
  const shelfKey2 = inDeck.map((e) => `${e.kind}:${e.id}`).join(",");
  const damagedKey = damaged.map((d) => `${d.kind}:${d.id}:${d.reason}`).join(",");
  const stagedKey = [...staged].sort().join(",");
  const ctxRef = useRef6(ctx);
  ctxRef.current = ctx;
  useEffect11(() => {
    ctxRef.current.agent.publish(libraryAgentState({ deck, inDeck, total, damaged, staged, loadFailed, filter }));
  }, [deck, shelfKey2, damagedKey, stagedKey, total, loadFailed, filter]);
}
function useReloadOnStudioChange(reload) {
  const { version } = useStudioChanges();
  const reloadRef = useRef6(reload);
  reloadRef.current = reload;
  useEffect11(() => {
    if (version > 0)
      reloadRef.current();
  }, [version]);
}

// src/ui/apps/library/search-core.ts
var FIELDS = {
  name: "name",
  id: "id",
  kind: "kind",
  deck: "kind",
  from: "from",
  has: "has",
  collection: "collection",
  in: "collection"
};
var FACETS = {
  art: "art",
  portrait: "art",
  image: "art",
  picture: "art",
  source: "source",
  import: "source",
  imported: "source",
  keys: "keys",
  keyword: "keys",
  keywords: "keys",
  trigger: "keys",
  triggers: "keys"
};
var TIER = {
  nameExact: 1000,
  namePrefix: 700,
  nameWord: 500,
  nameContains: 300,
  idExact: 260,
  idPrefix: 200,
  keyExact: 180,
  idContains: 120,
  keyContains: 90,
  source: 60,
  provenance: 40,
  extraTerm: 10
};
function tokenize(raw) {
  const out = [];
  let current = "";
  let quoted = false;
  for (const ch of raw) {
    if (ch === '"') {
      quoted = !quoted;
      continue;
    }
    if (!quoted && /\s/.test(ch)) {
      if (current)
        out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current)
    out.push(current);
  return out;
}
function parseQuery(raw) {
  const terms = [];
  const unknown = [];
  for (const token of tokenize(raw)) {
    const negated = token.startsWith("-") && token.length > 1;
    const body = negated ? token.slice(1) : token;
    const colon = body.indexOf(":");
    const head = colon > 0 ? body.slice(0, colon).toLowerCase() : "";
    const field = head ? FIELDS[head] : undefined;
    if (!field) {
      const value2 = body.slice(colon + 1).toLowerCase();
      if (/^[a-z]{2,}$/.test(head) && value2.length > 0)
        unknown.push(`${head}:`);
      terms.push({ field: "text", value: body.toLowerCase(), negated });
      continue;
    }
    const value = body.slice(colon + 1).toLowerCase();
    if (!value)
      continue;
    if (field === "has" && !FACETS[value])
      unknown.push(`has:${value}`);
    terms.push({ field, value, negated });
  }
  return { terms, active: terms.length > 0, unknown };
}
function nameScore(name, value) {
  const n = name.toLowerCase();
  if (n === value)
    return TIER.nameExact;
  if (n.startsWith(value))
    return TIER.namePrefix;
  const at = n.indexOf(value);
  if (at < 0)
    return 0;
  const before = n.charAt(at - 1);
  return /[a-z0-9]/.test(before) ? TIER.nameContains : TIER.nameWord;
}
function idScore(id, value) {
  const i = id.toLowerCase();
  if (i === value)
    return TIER.idExact;
  if (i.startsWith(value))
    return TIER.idPrefix;
  return i.includes(value) ? TIER.idContains : 0;
}
function keyScore(keys, value) {
  if (!keys || keys.length === 0)
    return 0;
  let best = 0;
  for (const key of keys) {
    const k = key.toLowerCase();
    if (k === value)
      return TIER.keyExact;
    if (k.includes(value))
      best = TIER.keyContains;
  }
  return best;
}
var sourceWords = (piece) => `${piece.sourceLabel ?? ""} ${piece.sourceFormat ?? ""} ${piece.sourceVariant ?? ""}`.toLowerCase();
function textScore(piece, value) {
  return Math.max(nameScore(piece.name, value), idScore(piece.id, value), keyScore(piece.searchKeys, value), sourceWords(piece).includes(value) ? TIER.source : 0, (piece.provenance ?? "").toLowerCase().includes(value) ? TIER.provenance : 0);
}
function matchesKind(kind, value) {
  if (kind.startsWith(value))
    return true;
  const meta = deckMeta(kind);
  return [meta.short, ...meta.plural.toLowerCase().split(/\s+/)].some((word) => word.startsWith(value));
}
function matchesFacet(piece, value) {
  const facet = FACETS[value];
  if (!facet)
    return false;
  if (facet === "art")
    return piece.hasPortrait === true;
  if (facet === "source")
    return typeof piece.sourceFormat === "string" && piece.sourceFormat.length > 0;
  return (piece.searchKeys?.length ?? 0) > 0;
}
function termScore(piece, term) {
  switch (term.field) {
    case "text": {
      const score = textScore(piece, term.value);
      return score > 0 ? score : null;
    }
    case "name": {
      const score = nameScore(piece.name, term.value);
      return score > 0 ? score : null;
    }
    case "id": {
      const score = idScore(piece.id, term.value);
      return score > 0 ? score : null;
    }
    case "kind":
      return matchesKind(piece.kind, term.value) ? 0 : null;
    case "from":
      return sourceWords(piece).includes(term.value) ? 0 : null;
    case "has":
      return matchesFacet(piece, term.value) ? 0 : null;
    case "collection":
      return piece.collections?.includes(term.value) === true ? 0 : null;
  }
}
function pieceScore(piece, terms) {
  let best = 0;
  let positives = 0;
  for (const term of terms) {
    const score = termScore(piece, term);
    if (term.negated) {
      if (score !== null)
        return null;
      continue;
    }
    if (score === null)
      return null;
    if (score > 0) {
      positives++;
      if (score > best)
        best = score;
    }
  }
  return best + (positives > 1 ? (positives - 1) * TIER.extraTerm : 0);
}
function searchPieces(pieces, query) {
  const hits = [];
  for (const piece of pieces) {
    const score = pieceScore(piece, query.terms);
    if (score !== null)
      hits.push({ piece, score });
  }
  if (!hits.some((hit) => hit.score > 0))
    return hits;
  return hits.sort((a, b) => b.score - a.score || a.piece.name.length - b.piece.name.length || a.piece.name.localeCompare(b.piece.name) || a.piece.kind.localeCompare(b.piece.kind) || a.piece.id.localeCompare(b.piece.id));
}
function matchesByKind(hits) {
  const counts = new Map;
  for (const hit of hits)
    counts.set(hit.piece.kind, (counts.get(hit.piece.kind) ?? 0) + 1);
  return [...counts.entries()].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind));
}
var SEARCH_FIELD_HELP = "name: id: kind: from: has:art has:source has:keys collection:";
function unknownHint(unknown) {
  if (unknown.length === 0)
    return "";
  const facets = unknown.filter((u) => u.startsWith("has:"));
  const fields = unknown.filter((u) => !u.startsWith("has:"));
  const parts = [];
  if (fields.length > 0) {
    parts.push(fields.length === 1 ? `${fields[0] ?? ""} is not a field, so it was searched as plain text` : `${fields.join(" ")} are not fields, so they were searched as plain text`);
  }
  if (facets.length > 0) {
    parts.push(facets.length === 1 ? `${facets[0] ?? ""} is not something a piece can have, so nothing matches it` : `${facets.join(" ")} are not things a piece can have, so nothing matches them`);
  }
  return `${parts.join(" · ")}. Try ${SEARCH_FIELD_HELP}`;
}
function resultLine(input) {
  const plural2 = input.deckPlural.toLowerCase();
  const elsewhere = input.elsewhere > 0 ? ` · ${String(input.elsewhere)} elsewhere` : "";
  if (!input.active)
    return "";
  if (input.shown > 0)
    return `${String(input.shown)} of ${String(input.deckTotal)} ${plural2} match`;
  if (input.deckTotal === 0)
    return `no ${plural2} yet${elsewhere}`;
  if (input.elsewhere > 0)
    return `no ${plural2} match${elsewhere}`;
  return "nothing in the studio matches";
}
var isFilteredEmpty = (query, deckTotal) => query.active && deckTotal > 0;

// src/ui/apps/library/search-bar.tsx
import { jsxDEV as jsxDEV17 } from "react/jsx-dev-runtime";
function SearchBox({ value, onChange, hint }) {
  return /* @__PURE__ */ jsxDEV17("div", {
    className: `findwrap${value ? " on" : ""}`,
    children: [
      /* @__PURE__ */ jsxDEV17("label", {
        className: "findbox",
        children: [
          /* @__PURE__ */ jsxDEV17("span", {
            className: "sk",
            children: "find"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV17("input", {
            type: "text",
            value,
            spellCheck: false,
            autoComplete: "off",
            placeholder: "name, kind:preset, from:sillytavern, has:art",
            "aria-label": "Search the library",
            title: 'Search names, ids and lorebook keywords. Fields: name: id: kind: from: has:. Quote "a phrase", prefix - to exclude.',
            onChange: (ev) => onChange(ev.target.value),
            onKeyDown: (ev) => {
              if (ev.key === "Escape" && value) {
                ev.stopPropagation();
                onChange("");
              }
            }
          }, undefined, false, undefined, this),
          value && /* @__PURE__ */ jsxDEV17("button", {
            type: "button",
            className: "findx",
            title: "Clear search",
            "aria-label": "Clear search",
            onClick: () => onChange(""),
            children: "clear"
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      hint && /* @__PURE__ */ jsxDEV17("p", {
        className: "findnote",
        children: hint
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
function NoMatchNotice({
  query,
  deckPlural,
  deckTotal,
  elsewhere,
  onJump,
  onClear
}) {
  const plural2 = deckPlural.toLowerCase();
  return /* @__PURE__ */ jsxDEV17("div", {
    className: "nomatch",
    children: [
      /* @__PURE__ */ jsxDEV17("strong", {
        className: "nmhead",
        children: `No ${plural2} match`
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV17("p", {
        className: "nmbody",
        children: [
          "Nothing on this shelf matches ",
          /* @__PURE__ */ jsxDEV17("code", {
            className: "nmq",
            children: query
          }, undefined, false, undefined, this),
          `. All ${String(deckTotal)} ${plural2} are still in the studio; this shelf is filtered, not bare.`
        ]
      }, undefined, true, undefined, this),
      elsewhere.length > 0 && /* @__PURE__ */ jsxDEV17("div", {
        className: "nmjumps",
        children: [
          /* @__PURE__ */ jsxDEV17("span", {
            className: "nmk",
            children: "also matching"
          }, undefined, false, undefined, this),
          elsewhere.map(({ kind, count }) => /* @__PURE__ */ jsxDEV17("button", {
            type: "button",
            className: "nmjump",
            onClick: () => onJump(kind),
            children: `${deckMeta(kind).plural} ${String(count)}`
          }, kind, false, undefined, this))
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV17("button", {
        type: "button",
        className: "nmclear",
        onClick: onClear,
        children: "Clear search"
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}

// src/ui/apps/library/send-bar.tsx
import { jsxDEV as jsxDEV18 } from "react/jsx-dev-runtime";
function SendBar({
  staged,
  entities,
  onSend,
  onDelete,
  onSelectAll,
  onClear
}) {
  if (staged.size === 0)
    return null;
  const batch = () => {
    const byKey = new Map(entities.map((e) => [pieceKey(e), e]));
    return [...staged].map((k) => byKey.get(k)).filter((e) => !!e);
  };
  const many = staged.size === 1 ? "it" : `all ${String(staged.size)}`;
  return /* @__PURE__ */ jsxDEV18("div", {
    className: "sendbar",
    children: [
      /* @__PURE__ */ jsxDEV18("span", {
        className: "cnt",
        children: `${String(staged.size)} ${staged.size === 1 ? "piece" : "pieces"} staged`
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV18("button", {
        className: "send",
        onClick: () => onSend(batch()),
        children: `Send ${many} to the Workbench`
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV18("button", {
        className: "del",
        onClick: () => onDelete(batch()),
        children: `Delete ${many}`
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV18("button", {
        className: "clear",
        onClick: onSelectAll,
        children: "Select all"
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV18("button", {
        className: "clear",
        onClick: onClear,
        children: "Clear"
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}

// src/ui/apps/library/collections-ops.ts
import { useCallback as useCallback4, useEffect as useEffect12, useMemo as useMemo3, useState as useState11 } from "react";

// src/studio/collections-shape.ts
var EMPTY_COLLECTIONS = { collections: [] };

// src/ui/apps/library/collections-ops.ts
var sameRef = (a, b) => a.kind === b.kind && a.id === b.id;
function membershipIndex(file) {
  const index = new Map;
  for (const collection of file.collections) {
    for (const ref of collection.members) {
      const key = `${ref.kind}:${ref.id}`;
      const held = index.get(key);
      if (held)
        held.push(collection.id);
      else
        index.set(key, [collection.id]);
    }
  }
  return index;
}
function attachCollections(pieces, index) {
  return pieces.map((piece) => {
    const held = index.get(`${piece.kind}:${piece.id}`);
    return held ? { ...piece, collections: held } : piece;
  });
}
var collectionQuery = (id) => `collection:${id}`;
function collectionsBarProps(input) {
  const { room, query, setQuery, staged, say } = input;
  const count = (n, word = "piece") => `${String(n)} ${word}${n === 1 ? "" : "s"}`;
  const addAll = async (id, refs) => {
    for (const ref of refs)
      await room.edit({ action: "add", id, ref });
  };
  return {
    all: room.all,
    query,
    onQuery: setQuery,
    staged,
    onCreate: (name) => {
      (async () => {
        try {
          const made = await room.edit({ action: "create", name });
          if (!made)
            return;
          await addAll(made.id, staged);
          if (staged.length)
            setQuery(collectionQuery(made.id));
          say(staged.length ? `made ${made.name} · ${count(staged.length)}` : `made ${made.name} · empty for now`);
        } catch {
          say("could not make that collection");
        }
      })();
    },
    onAddStaged: (id) => {
      (async () => {
        const before = room.all.find((c) => c.id === id);
        try {
          await addAll(id, staged);
          const held = new Set((before?.members ?? []).map((m) => `${m.kind}:${m.id}`));
          const added = staged.filter((ref) => !held.has(`${ref.kind}:${ref.id}`)).length;
          say(added === 0 ? `${before?.name ?? "that group"} already had ${staged.length === 1 ? "it" : "them"}` : `${before?.name ?? "group"} · added ${count(added)}`);
        } catch {
          say("could not add to that collection");
        }
      })();
    },
    onDelete: (collection) => {
      room.edit({ action: "delete", id: collection.id }).then(() => {
        if (query.trim() === collectionQuery(collection.id))
          setQuery("");
        say(`removed the group ${collection.name} · its ${count(collection.members.length)} stayed`);
      }, () => say("could not remove that collection"));
    }
  };
}
function useCollections(ctx) {
  const [file, setFile] = useState11(EMPTY_COLLECTIONS);
  useEffect12(() => {
    let alive = true;
    ctx.api.collections().then((got) => {
      if (alive)
        setFile(got);
    }).catch(() => {});
    return () => {
      alive = false;
    };
  }, [ctx]);
  const edit = useCallback4(async (change) => {
    const got = await ctx.api.collectionEdit(change);
    setFile(got);
    if (change.action === "create") {
      return got.collections.at(-1) ?? null;
    }
    if (change.action === "delete")
      return null;
    return got.collections.find((c) => c.id === change.id) ?? null;
  }, [ctx]);
  const holding = useCallback4((ref) => file.collections.filter((c) => c.members.some((m) => sameRef(m, ref))), [file]);
  const index = useMemo3(() => membershipIndex(file), [file]);
  return useMemo3(() => ({ all: file.collections, index, edit, holding }), [file, index, edit, holding]);
}

// src/ui/apps/library/use-picking.ts
import { useCallback as useCallback5, useRef as useRef7, useState as useState12 } from "react";
function usePicking() {
  const [selected, setSelected] = useState12(() => new Set);
  const anchor = useRef7("");
  const commit = useCallback5((next) => {
    anchor.current = next.anchor;
    setSelected(next.selected);
  }, []);
  const press = useCallback5((key, mods, order, open) => {
    setSelected((current) => {
      const next = applyPick({ selected: current, anchor: anchor.current }, { key, order, open, ...mods });
      anchor.current = next.anchor;
      return next.selected;
    });
  }, []);
  const sweep = useCallback5((cards, box, additive, open) => {
    const hits = marqueeHits(cards, box, open);
    setSelected((current) => {
      const next = applyMarquee({ selected: current, anchor: anchor.current }, hits, additive);
      anchor.current = next.anchor;
      return next.selected;
    });
  }, []);
  const replace = useCallback5((keys) => {
    commit({ selected: new Set(keys), anchor: keys.at(-1) ?? "" });
  }, [commit]);
  return { selected, press, sweep, replace };
}

// src/ui/apps/library/collections-bar.tsx
import { useState as useState13 } from "react";
import { jsxDEV as jsxDEV19 } from "react/jsx-dev-runtime";
function CollectionsBar(input) {
  const [naming, setNaming] = useState13(false);
  const [draft, setDraft] = useState13("");
  const [notice, setNotice] = useState13("");
  const { all, query, onQuery, staged, onCreate, onAddStaged, onDelete } = collectionsBarProps({ ...input, say: setNotice });
  if (all.length === 0 && staged.length === 0)
    return null;
  const commit = () => {
    const name = draft.trim();
    if (name)
      onCreate(name);
    setDraft("");
    setNaming(false);
  };
  return /* @__PURE__ */ jsxDEV19("div", {
    className: "colbar",
    children: [
      /* @__PURE__ */ jsxDEV19("span", {
        className: "sk",
        children: "groups"
      }, undefined, false, undefined, this),
      all.map((collection) => {
        const on = query.trim() === collectionQuery(collection.id);
        return /* @__PURE__ */ jsxDEV19("span", {
          className: `colchip${on ? " on" : ""}`,
          children: [
            /* @__PURE__ */ jsxDEV19("button", {
              type: "button",
              className: "colname",
              title: on ? "Showing this collection - click to stop filtering" : `Show only what is in ${collection.name}`,
              onClick: () => onQuery(on ? "" : collectionQuery(collection.id)),
              children: [
                collection.name,
                /* @__PURE__ */ jsxDEV19("span", {
                  className: "colcount",
                  children: collection.members.length
                }, undefined, false, undefined, this)
              ]
            }, undefined, true, undefined, this),
            staged.length > 0 && /* @__PURE__ */ jsxDEV19("button", {
              type: "button",
              className: "coladd",
              title: `Add ${String(staged.length)} staged ${staged.length === 1 ? "piece" : "pieces"} to ${collection.name}`,
              onClick: () => onAddStaged(collection.id),
              children: "add"
            }, undefined, false, undefined, this),
            /* @__PURE__ */ jsxDEV19("button", {
              type: "button",
              className: "coldel",
              title: `Delete the collection ${collection.name}. The pieces stay in the studio.`,
              onClick: () => onDelete(collection),
              children: "remove"
            }, undefined, false, undefined, this)
          ]
        }, collection.id, true, undefined, this);
      }),
      naming ? /* @__PURE__ */ jsxDEV19("input", {
        className: "colnew",
        autoFocus: true,
        value: draft,
        maxLength: 120,
        placeholder: "name this group",
        "aria-label": "Name the new collection",
        onChange: (ev) => setDraft(ev.target.value),
        onBlur: commit,
        onKeyDown: (ev) => {
          if (ev.key === "Enter")
            commit();
          if (ev.key === "Escape") {
            ev.stopPropagation();
            setDraft("");
            setNaming(false);
          }
        }
      }, undefined, false, undefined, this) : /* @__PURE__ */ jsxDEV19("button", {
        type: "button",
        className: "colmake",
        title: staged.length > 0 ? `Make a collection from the ${String(staged.length)} staged ${staged.length === 1 ? "piece" : "pieces"}` : "Make a collection",
        onClick: () => setNaming(true),
        children: "new group"
      }, undefined, false, undefined, this),
      notice && /* @__PURE__ */ jsxDEV19("span", {
        className: "colnote",
        role: "status",
        children: [
          notice,
          /* @__PURE__ */ jsxDEV19("button", {
            type: "button",
            title: "Dismiss",
            "aria-label": "Dismiss",
            onClick: () => setNotice(""),
            children: "ok"
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this)
    ]
  }, undefined, true, undefined, this);
}

// src/ui/apps/library/index.tsx
import { jsxDEV as jsxDEV20 } from "react/jsx-dev-runtime";
var portraitUrl2 = (e) => e.hasPortrait ? portraitUrl(e.kind, e.id) : null;
function Library({ ctx }) {
  const firstDeck = ctx.prefs.get(PREF_FIRST_DECK);
  const [entities, setEntities] = useState14([]);
  const [damaged, setDamaged] = useState14([]);
  const [studioDir, setStudioDir] = useState14();
  const [loadFailed, setLoadFailed] = useState14(false);
  const [activeKind, setActiveKind] = useState14(typeof firstDeck === "string" && firstDeck ? firstDeck : "character");
  const [formatLabels, setFormatLabels] = useState14(new Map);
  const picking = usePicking();
  const selected = picking.selected;
  const [importState, setImportState] = useState14(null);
  const [query, setQuery] = useState14("");
  const [workshop, setWorkshop] = useState14(null);
  const [regexWorkshop, setRegexWorkshop] = useState14(null);
  const [loreMeta, setLoreMeta] = useState14({});
  const [regexMeta, setRegexMeta] = useState14({});
  const [personaMeta, setPersonaMeta] = useState14({});
  const [, setWorkbenchTick] = useState14(0);
  const rootRef = useRef8(null);
  const [sizeRem, setSizeRem] = useState14(() => clampSize(ctx.prefs.get(PREF_SIZE)));
  const collections = useCollections(ctx);
  const reload = useCallback6(() => {
    (async () => {
      try {
        const [inventory, version] = await Promise.all([
          ctx.api.studioInventory(),
          ctx.api.version().catch(() => ({ version: "", studioDir: undefined }))
        ]);
        const list = inventory.entities;
        setEntities(list);
        setDamaged(inventory.damaged);
        setStudioDir(version.studioDir);
        setLoadFailed(false);
        setLoreMeta(await loadLoreMeta(ctx, list));
        setRegexMeta(await loadRegexMeta(ctx, list));
        setPersonaMeta(await loadPersonaMeta(ctx, list));
      } catch {
        setLoadFailed(true);
      }
    })();
  }, [ctx]);
  useEffect13(() => {
    const unsub = ctx.workbench.onChange(() => setWorkbenchTick((t) => t + 1));
    ctx.api.formats().then((formats) => {
      setFormatLabels(new Map(formats.map((f) => [f.id, f.generic ? "Default" : f.friendly])));
    }).catch(() => {});
    reload();
    return unsub;
  }, [ctx, reload]);
  const del = useEntityDelete(ctx, () => {
    picking.replace([]);
    reload();
  });
  const allCss = useMemo4(() => LIBRARY_STYLE + deckViews().map((v) => v.css).join(`
`), []);
  const openKeys = new Set(ctx.workbench.pieces().map(pieceKey));
  const selectedValid = new Set([...selected].filter((k) => !openKeys.has(k) && entities.some((e) => pieceKey(e) === k)));
  const decks = deckCounts(entities, knownDecks().map((d) => d.kind));
  const deck = deckMeta(activeKind);
  const parsed = useMemo4(() => parseQuery(query), [query]);
  const records = useMemo4(() => attachCollections(attachSearchKeys(entities, loreMeta).map((e) => ({ ...e, sourceLabel: sourceLabelFor(formatLabels, e) })), collections.index), [entities, loreMeta, formatLabels, collections.index]);
  const hits = useMemo4(() => searchPieces(records, parsed), [records, parsed]);
  const perDeck = matchesByKind(hits);
  const matched = new Map(perDeck.map((m) => [m.kind, m.count]));
  const inDeck = hits.filter((h) => h.piece.kind === activeKind).map((h) => h.piece);
  const deckTotal = decks.find((d) => d.kind === activeKind)?.count ?? 0;
  const elsewhere = hits.length - inDeck.length;
  const searchLine = resultLine({
    active: parsed.active,
    deckPlural: deck.plural,
    shown: inDeck.length,
    deckTotal,
    elsewhere
  });
  const selectAll = () => picking.replace(inDeck.filter((e) => !openKeys.has(pieceKey(e))).map(pieceKey));
  const stagedRefs = entities.filter((e) => selectedValid.has(pieceKey(e)));
  useReloadOnStudioChange(reload);
  usePublishLibrarySurface(ctx, {
    deck: deck.plural,
    inDeck,
    total: entities.length,
    damaged,
    staged: selectedValid,
    loadFailed,
    filter: parsed.active ? query : undefined
  });
  useEffect13(() => {
    ctx.setStatus(loadFailed ? "could not reach the studio · your pieces are still on disk" : entities.length === 0 ? damaged.length > 0 ? `no readable pieces · ${damaged.length} unreadable ${damaged.length === 1 ? "file" : "files"}` : "empty studio" : searchLine || `${deck.plural.toLowerCase()} · ${inDeck.length} of ${entities.length} pieces`);
  }, [ctx, damaged.length, entities.length, deck, inDeck.length, loadFailed, searchLine]);
  const { runImport, commitImport, cancelImport } = makeImportRunners({ ctx, importState, setImportState, reload });
  const runImportRef = useRef8(runImport);
  runImportRef.current = runImport;
  useEffect13(() => consumeImportRequests((files) => {
    if (files)
      runImportRef.current(files);
    else
      pickFiles((picked) => runImportRef.current(picked));
  }), []);
  const onDrop = (evt) => {
    evt.preventDefault();
    const files = [...evt.dataTransfer?.files ?? []];
    if (files.length)
      runImport(files);
  };
  const addEntity = (summary) => setEntities((prev) => prev.some((e) => e.kind === summary.kind && e.id === summary.id) ? prev : [...prev, summary]);
  const overlay = importState ? /* @__PURE__ */ jsxDEV20(ImportOverlay, {
    state: importState,
    onCommit: commitImport,
    onCancel: cancelImport,
    onAddMore: () => pickFiles((f) => runImport(f, true))
  }, undefined, false, undefined, this) : null;
  const doors = { css: allCss, damaged, studioDir };
  if (loadFailed)
    return /* @__PURE__ */ jsxDEV20(StudioUnreachable, {
      ...doors,
      onRetry: reload
    }, undefined, false, undefined, this);
  if (entities.length === 0) {
    return /* @__PURE__ */ jsxDEV20(FirstLanding, {
      ...doors,
      onDrop,
      onPickImport: () => pickFiles(runImport),
      onStartFresh: () => {
        createAndOpenCharacter(ctx).then((summary) => {
          addEntity(summary);
          ctx.workbench.open(summary);
          ctx.setStatus(`opened character · ${summary.name}`);
        }, (err) => ctx.setStatus(err instanceof Error ? err.message : "could not create a character"));
      },
      overlay
    }, undefined, false, undefined, this);
  }
  const view7 = deckView(ctx.prefs.get(PREF_VIEW), activeKind);
  const vctx = {
    entities: inDeck,
    deck,
    open: openKeys,
    selected: selectedValid,
    menus: ctx.menus,
    portraitUrl: portraitUrl2,
    sourceLabel: (e) => sourceLabelFor(formatLabels, e),
    peek: (e) => peekPiece(ctx, e),
    onPiece: (e, mods) => {
      const key = pieceKey(e);
      if (openKeys.has(key) && !mods?.shift) {
        ctx.setStatus(`${e.name} is already on the Workbench`);
        return;
      }
      picking.press(key, mods ?? { shift: false, meta: false }, inDeck.map(pieceKey), openKeys);
    },
    onSweep: (cards, box, additive) => {
      picking.sweep(cards, box, additive, openKeys);
    },
    loreShelf: activeKind === "lorebook" ? makeLoreShelf({
      ctx,
      loreMeta,
      setLoreMeta,
      setWorkshop,
      reload
    }) : undefined,
    regexShelf: activeKind === "regex" ? makeRegexShelf({
      ctx,
      regexMeta,
      setRegexMeta,
      setWorkshop: setRegexWorkshop,
      reload
    }) : undefined,
    personaShelf: activeKind === "persona" ? makePersonaShelf({ ctx, personaMeta, setEntities }) : undefined
  };
  return /* @__PURE__ */ jsxDEV20("div", {
    className: "lib",
    ref: rootRef,
    style: { "--card-w": `${sizeRem}rem` },
    onDragOver: (e) => e.preventDefault(),
    onDrop,
    children: [
      /* @__PURE__ */ jsxDEV20("style", {
        children: allCss
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV20(DamageNotice, {
        entries: damaged,
        studioDir,
        prefs: ctx.prefs
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV20("div", {
        className: "wbbar",
        children: [
          /* @__PURE__ */ jsxDEV20("div", {
            className: "deckchips",
            "data-tour": "decks",
            children: decks.map(({ kind, count }) => {
              const meta = deckMeta(kind);
              const shown = matched.get(kind) ?? 0;
              return /* @__PURE__ */ jsxDEV20("button", {
                className: `dchip${kind === activeKind ? " on" : ""}${parsed.active && shown === 0 ? " nil" : ""}`,
                style: { "--a": meta.accent },
                title: parsed.active ? `${String(shown)} of ${String(count)} match` : `${String(count)} in the studio`,
                onClick: () => setActiveKind(kind),
                children: [
                  /* @__PURE__ */ jsxDEV20("span", {
                    className: "pip"
                  }, undefined, false, undefined, this),
                  meta.plural,
                  /* @__PURE__ */ jsxDEV20("span", {
                    className: "dc",
                    children: parsed.active ? shown : count
                  }, undefined, false, undefined, this)
                ]
              }, kind, true, undefined, this);
            })
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV20(SearchBox, {
            value: query,
            onChange: setQuery,
            hint: unknownHint(parsed.unknown)
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV20("div", {
            className: "viewseg",
            "data-tour": "views",
            children: deckViews(activeKind).map((v) => /* @__PURE__ */ jsxDEV20("button", {
              className: v.id === view7.id ? "on" : undefined,
              title: `${v.label} view`,
              onClick: () => ctx.prefs.set(PREF_VIEW, v.id),
              children: [
                /* @__PURE__ */ jsxDEV20(Icon, {
                  svg: v.iconSvg
                }, undefined, false, undefined, this),
                v.label
              ]
            }, v.id, true, undefined, this))
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV20("label", {
            className: "sizedial",
            "data-tour": "size",
            children: [
              /* @__PURE__ */ jsxDEV20("span", {
                className: "sk",
                children: "art"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV20("input", {
                type: "range",
                min: SIZE_RANGE.min,
                max: SIZE_RANGE.max,
                step: 0.5,
                defaultValue: sizeRem,
                title: "Art size",
                onInput: (ev) => {
                  const val = clampSize(Number(ev.target.value));
                  rootRef.current?.style.setProperty("--card-w", `${val}rem`);
                },
                onChange: (ev) => {
                  const val = clampSize(Number(ev.target.value));
                  setSizeRem(val);
                  ctx.prefs.set(PREF_SIZE, val);
                }
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV20(CollectionsBar, {
        room: collections,
        query,
        setQuery,
        staged: stagedRefs
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV20(SendBar, {
        staged: selectedValid,
        entities,
        onSend: (batch) => {
          picking.replace([]);
          const routing = routeSend(batch);
          if (routing.toWorkbench.length > 0)
            ctx.workbench.sendMany(routing.toWorkbench);
          if (routing.toViewer) {
            handOffPiece(routing.toViewer.id);
            ctx.openApp(HTML_VIEW_APP);
          }
          const said = sendStatus(routing);
          if (said)
            ctx.setStatus(said);
        },
        onDelete: (batch) => del.requestDelete(batch),
        onSelectAll: selectAll,
        onClear: () => picking.replace([])
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV20("div", {
        className: "prosc",
        children: /* @__PURE__ */ jsxDEV20("div", {
          className: "libstage",
          style: { "--a": deck.accent },
          children: [
            /* @__PURE__ */ jsxDEV20("div", {
              className: "stage-crumb",
              children: [
                /* @__PURE__ */ jsxDEV20("span", {
                  className: "pip"
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV20("span", {
                  className: "cn",
                  children: deck.plural
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV20("span", {
                  className: "cc",
                  children: inDeck.length ? `${view7.label.toLowerCase()} · ${inDeck.length}${parsed.active ? ` of ${deckTotal}` : ""}` : isFilteredEmpty(parsed, deckTotal) ? "no match" : "deck empty"
                }, undefined, false, undefined, this),
                inDeck.length > 0 && /* @__PURE__ */ jsxDEV20("span", {
                  style: { marginLeft: "auto", display: "flex", gap: "0.35rem" },
                  children: [
                    /* @__PURE__ */ jsxDEV20(NewInDeckButton, {
                      compact: true,
                      kind: activeKind,
                      ctx,
                      onCreated: addEntity
                    }, undefined, false, undefined, this),
                    selectedValid.size === 0 && /* @__PURE__ */ jsxDEV20("button", {
                      className: "crumbsel",
                      onClick: selectAll,
                      children: "Select all"
                    }, undefined, false, undefined, this)
                  ]
                }, undefined, true, undefined, this)
              ]
            }, undefined, true, undefined, this),
            inDeck.length === 0 ? isFilteredEmpty(parsed, deckTotal) ? /* @__PURE__ */ jsxDEV20(NoMatchNotice, {
              query,
              deckPlural: deck.plural,
              deckTotal,
              elsewhere: perDeck.filter((m) => m.kind !== activeKind),
              onJump: setActiveKind,
              onClear: () => setQuery("")
            }, undefined, false, undefined, this) : /* @__PURE__ */ jsxDEV20("div", {
              className: "ghost-shelf",
              children: [
                `your first ${activeKind} lands here · import or start fresh`,
                /* @__PURE__ */ jsxDEV20(NewInDeckButton, {
                  kind: activeKind,
                  ctx,
                  onCreated: addEntity
                }, undefined, false, undefined, this)
              ]
            }, undefined, true, undefined, this) : /* @__PURE__ */ jsxDEV20(view7.Component, {
              ctx: vctx
            }, undefined, false, undefined, this)
          ]
        }, undefined, true, undefined, this)
      }, undefined, false, undefined, this),
      overlay,
      workshop && /* @__PURE__ */ jsxDEV20(LoreWorkshopDialog, {
        ctx,
        state: workshop,
        onDismiss: () => setWorkshop(null),
        onDone: () => {
          setWorkshop(null);
          reload();
        }
      }, undefined, false, undefined, this),
      regexWorkshop && /* @__PURE__ */ jsxDEV20(RegexWorkshopDialog, {
        ctx,
        state: regexWorkshop,
        onDismiss: () => setRegexWorkshop(null),
        onDone: () => {
          setRegexWorkshop(null);
          reload();
        }
      }, undefined, false, undefined, this),
      del.confirm
    ]
  }, undefined, true, undefined, this);
}
var app = {
  manifest: {
    id: "library",
    title: "The Library",
    markSvg: MARK_SVG,
    accent: "#3b82f6",
    order: 20,
    subtitle: "app",
    firstRunLanding: true,
    agentSurface: LIBRARY_AGENT_SURFACE
  },
  Component: Library
};
var library_default = app;
export {
  library_default as default
};
