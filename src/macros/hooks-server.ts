// ============================================================================
// POST-GENERATION HOOK RUNNER (server-side)
//
// Runs the pure hook/event engine (hooks.ts) against a completed assistant
// response, INSIDE the job worker, after post-gen actions and before the
// `done` event. This placement gives exactly-once semantics for free:
// hooks fire when text is GENERATED (a regen is a new generation and
// correctly re-fires), never when stored text is re-rendered. Clients
// persist the cleaned text from the done event, so stripped tags never
// reach the E2E-encrypted message store.
//
// Failure policy: never break a generation. Any error here logs and
// returns the original text untouched.
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  parseMacroEngineConfig,
  runMacroHooks,
  IN_REPLY_ASKS_KEY,
  type HookRunVars,
  type HookFiring,
} from './hooks';
import type { MacroSideEffect, MacroVariableValue } from './types';

export interface PostGenHookOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>;
  chatId?: string | null;
  userId: string;
  presetId?: string | null;
  characterId?: string | null;
  /** The completed assistant response */
  text: string;
}

export interface PostGenHookOutcome {
  /** Text with strip-enabled tags removed (identical when nothing fired) */
  text: string;
  firings: HookFiring[];
}

/**
 * Collapse an ordered mutation list to its final state per storage key,
 * split into upserts and deletes per table.
 */
function collapseMutations(mutations: MacroSideEffect[]): {
  localSets: Map<string, MacroVariableValue>;
  localDeletes: Set<string>;
  globalSets: Map<string, MacroVariableValue>;
  globalDeletes: Set<string>;
} {
  const localSets = new Map<string, MacroVariableValue>();
  const localDeletes = new Set<string>();
  const globalSets = new Map<string, MacroVariableValue>();
  const globalDeletes = new Set<string>();

  for (const fx of mutations) {
    switch (fx.type) {
      case 'setLocalVar':
        localSets.set(fx.key, fx.value as MacroVariableValue);
        localDeletes.delete(fx.key);
        break;
      case 'deleteLocalVar':
        localDeletes.add(fx.key);
        localSets.delete(fx.key);
        break;
      case 'setGlobalVar':
        globalSets.set(fx.key, fx.value as MacroVariableValue);
        globalDeletes.delete(fx.key);
        break;
      case 'deleteGlobalVar':
        globalDeletes.add(fx.key);
        globalSets.delete(fx.key);
        break;
    }
  }

  return { localSets, localDeletes, globalSets, globalDeletes };
}

/**
 * Run state hooks / event handlers / in-reply captures on a completed
 * response and persist the resulting variable mutations.
 */
export async function runPostGenMacroHooks(opts: PostGenHookOptions): Promise<PostGenHookOutcome> {
  const unchanged: PostGenHookOutcome = { text: opts.text, firings: [] };

  try {
    if (!opts.chatId || !opts.text) return unchanged;

    // Load chat-local variables (needed both as hook inputs — increment,
    // push — and to discover pending in-reply asks).
    const { data: localRows, error: localError } = await opts.supabase
      .from('chat_variables')
      .select('variable_name, variable_value')
      .eq('chat_id', opts.chatId);
    if (localError) throw localError;

    const local = new Map<string, MacroVariableValue>(
      (localRows ?? []).map(r => [r.variable_name as string, r.variable_value as MacroVariableValue])
    );

    // Fast path: nothing can fire without a preset config or pending asks
    const hasAsks = local.has(IN_REPLY_ASKS_KEY);
    let config = null;
    if (opts.presetId) {
      const { data: presetRow } = await opts.supabase
        .from('presets')
        .select('settings, raw_settings')
        .eq('id', opts.presetId)
        .single();
      // raw_settings is the preset editor's extensibility carrier (where
      // the Macro Engine panel saves); settings.* accepted as a fallback
      // for hand-written / imported configs.
      const raw = presetRow?.raw_settings as Record<string, unknown> | null | undefined;
      const settings = presetRow?.settings as Record<string, unknown> | null | undefined;
      config = parseMacroEngineConfig(
        raw?.macro_engine ?? raw?.macro_engine_yaml ?? settings?.macro_engine ?? settings?.macro_engine_yaml
      );
    }
    if (!config && !hasAsks) return unchanged;

    const { data: globalRows, error: globalError } = await opts.supabase
      .from('global_variables')
      .select('variable_name, variable_value')
      .eq('user_id', opts.userId);
    if (globalError) throw globalError;

    const vars: HookRunVars = {
      local,
      global: new Map<string, MacroVariableValue>(
        (globalRows ?? []).map(r => [r.variable_name as string, r.variable_value as MacroVariableValue])
      ),
      characterId: opts.characterId ?? undefined,
    };

    // Snapshot for event-log before-values
    const beforeLocal = new Map(vars.local);
    const beforeGlobal = new Map(vars.global);

    const result = runMacroHooks(opts.text, config, vars, { placement: 'ai_output' });
    if (result.mutations.length === 0) {
      return { text: result.text, firings: result.firings };
    }

    // Persist final state per key (awaited — the next turn's prompt
    // assembly must observe these writes).
    const { localSets, localDeletes, globalSets, globalDeletes } = collapseMutations(result.mutations);
    const now = new Date().toISOString();

    if (localSets.size > 0) {
      const { error } = await opts.supabase.from('chat_variables').upsert(
        [...localSets].map(([variable_name, variable_value]) => ({
          chat_id: opts.chatId,
          variable_name,
          variable_value,
          updated_at: now,
        })),
        { onConflict: 'chat_id,variable_name' }
      );
      if (error) console.error('[MacroHooks] chat_variables upsert failed:', error.message);
    }
    if (localDeletes.size > 0) {
      const { error } = await opts.supabase.from('chat_variables')
        .delete()
        .eq('chat_id', opts.chatId)
        .in('variable_name', [...localDeletes]);
      if (error) console.error('[MacroHooks] chat_variables delete failed:', error.message);
    }
    if (globalSets.size > 0) {
      const { error } = await opts.supabase.from('global_variables').upsert(
        [...globalSets].map(([variable_name, variable_value]) => ({
          user_id: opts.userId,
          variable_name,
          variable_value,
          updated_at: now,
        })),
        { onConflict: 'user_id,variable_name' }
      );
      if (error) console.error('[MacroHooks] global_variables upsert failed:', error.message);
    }
    if (globalDeletes.size > 0) {
      const { error } = await opts.supabase.from('global_variables')
        .delete()
        .eq('user_id', opts.userId)
        .in('variable_name', [...globalDeletes]);
      if (error) console.error('[MacroHooks] global_variables delete failed:', error.message);
    }

    // Macro event log (spec IV.5): one row per changed key, with the
    // hook/event/in-reply cause. Fire-and-forget; missing table tolerated.
    const causeByKey = new Map<string, string>();
    for (const fx of result.mutations) {
      const scope = fx.type === 'setGlobalVar' || fx.type === 'deleteGlobalVar' ? 'global' : 'local';
      if (fx.cause) causeByKey.set(`${scope}:${fx.key}`, fx.cause);
    }
    const eventRows = [
      ...[...localSets.keys(), ...localDeletes].map(key => ({ scope: 'local' as const, key })),
      ...[...globalSets.keys(), ...globalDeletes].map(key => ({ scope: 'global' as const, key })),
    ]
      .filter(({ key }) => !key.startsWith('__'))
      .map(({ scope, key }) => ({
        chat_id: opts.chatId,
        user_id: opts.userId,
        variable_name: key,
        scope,
        before_value: (scope === 'local' ? beforeLocal : beforeGlobal).get(key) ?? null,
        after_value: (scope === 'local' ? vars.local : vars.global).get(key) ?? null,
        cause: causeByKey.get(`${scope}:${key}`) ?? 'hooks',
        source: 'hooks',
      }));
    if (eventRows.length > 0) {
      opts.supabase.from('chat_macro_events').insert(eventRows).then(({ error }) => {
        if (error) console.warn('[MacroHooks] event log insert failed:', error.message);
      });
    }

    return { text: result.text, firings: result.firings };
  } catch (err) {
    console.error('[MacroHooks] post-gen hook run failed (non-fatal):', err);
    return unchanged;
  }
}
