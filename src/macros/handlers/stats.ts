// ============================================================================
// STATS & META MACROS
// Token counts, budgets, and API cost information
// ============================================================================

import { MacroDefinition, MacroResult, MacroContext } from '../types';
import { registerMacros } from '../registry';

/**
 * Extended context for stats macros
 */
export interface StatsMacroContext extends MacroContext {
  tokenCount?: number;
  tokenBudget?: number;
  responseTokens?: number;
  sessionTokens?: number;
  costPerInputToken?: number;
  costPerOutputToken?: number;
}

/**
 * {{tokenCount}} - Current prompt token estimate
 */
const tokenCountMacro: MacroDefinition = {
  name: 'tokencount',
  aliases: ['tokens', 'prompttokens'],
  description: 'Current prompt token count (estimated)',
  category: 'chat',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const ctx = context as StatsMacroContext;
    const count = ctx.tokenCount ?? 0;
    return { value: count.toLocaleString(), success: true };
  },
};

/**
 * {{tokenBudget}} - Maximum context size
 */
const tokenBudgetMacro: MacroDefinition = {
  name: 'tokenbudget',
  aliases: ['maxcontext', 'contextsize'],
  description: 'Maximum context size in tokens',
  category: 'chat',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const ctx = context as StatsMacroContext;
    const budget = ctx.tokenBudget ?? 0;
    return { value: budget.toLocaleString(), success: true };
  },
};

/**
 * {{tokenRemaining}} - Available tokens remaining
 */
const tokenRemainingMacro: MacroDefinition = {
  name: 'tokenremaining',
  aliases: ['tokensremaining', 'remainingtokens'],
  description: 'Tokens remaining in context budget',
  category: 'chat',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const ctx = context as StatsMacroContext;
    const remaining = (ctx.tokenBudget ?? 0) - (ctx.tokenCount ?? 0);
    return { value: Math.max(0, remaining).toLocaleString(), success: true };
  },
};

/**
 * {{responseTokens}} - Maximum response tokens allowed
 */
const responseTokensMacro: MacroDefinition = {
  name: 'responsetokens',
  aliases: ['maxtokens', 'maxresponse'],
  description: 'Maximum response tokens setting',
  category: 'chat',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const ctx = context as StatsMacroContext;
    const tokens = ctx.responseTokens ?? 0;
    return { value: tokens.toLocaleString(), success: true };
  },
};

/**
 * {{sessionTokens}} - Total tokens used this session
 */
const sessionTokensMacro: MacroDefinition = {
  name: 'sessiontokens',
  aliases: ['totaltokens'],
  description: 'Total tokens used this session (input + output)',
  category: 'chat',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const ctx = context as StatsMacroContext;
    const tokens = ctx.sessionTokens ?? 0;
    return { value: tokens.toLocaleString(), success: true };
  },
};

/**
 * {{costEstimate}} - Estimated API cost for the session
 * Based on input/output token rates if available
 */
const costEstimateMacro: MacroDefinition = {
  name: 'costestimate',
  aliases: ['cost', 'apicost'],
  description: 'Estimated API cost for this session',
  category: 'chat',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const ctx = context as StatsMacroContext;

    // If we don't have cost info, return unknown
    if (!ctx.costPerInputToken || !ctx.costPerOutputToken) {
      return { value: 'N/A', success: true };
    }

    // Very rough estimate - assume 60% input, 40% output for session tokens
    const sessionTokens = ctx.sessionTokens ?? 0;
    const inputTokens = Math.floor(sessionTokens * 0.6);
    const outputTokens = Math.floor(sessionTokens * 0.4);

    const cost = (inputTokens * ctx.costPerInputToken) + (outputTokens * ctx.costPerOutputToken);

    // Format as currency
    if (cost < 0.01) {
      return { value: '<$0.01', success: true };
    }
    return { value: `$${cost.toFixed(2)}`, success: true };
  },
};

/**
 * {{contextUsage}} - Context usage as percentage
 */
const contextUsageMacro: MacroDefinition = {
  name: 'contextusage',
  aliases: ['usage'],
  description: 'Context usage as percentage',
  category: 'chat',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const ctx = context as StatsMacroContext;
    const budget = ctx.tokenBudget ?? 0;
    const count = ctx.tokenCount ?? 0;

    if (budget <= 0) {
      return { value: '0%', success: true };
    }

    const percentage = Math.round((count / budget) * 100);
    return { value: `${percentage}%`, success: true };
  },
};

/**
 * Register all stats macros
 */
export function registerStatsMacros(): void {
  registerMacros([
    tokenCountMacro,
    tokenBudgetMacro,
    tokenRemainingMacro,
    responseTokensMacro,
    sessionTokensMacro,
    costEstimateMacro,
    contextUsageMacro,
  ]);
}
