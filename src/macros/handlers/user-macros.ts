// ============================================================================
// USER-DEFINED MACROS
// Define reusable macro "functions" with positional arguments
//
// Define:  {{macro::name::body with {{$1}} placeholders}}
// Call:    {{macro::name::arg1::arg2}}
//
// Ephemeral — definitions live only during a single prompt assembly pass.
// ============================================================================

import { MacroDefinition, MacroResult, MacroContext } from '../types';
import { registerMacros } from '../registry';

/**
 * {{macro::name::body}} - Define a user macro
 * {{macro::name::arg1::arg2}} - Call a previously defined macro
 *
 * Disambiguation: if `name` already exists in userMacros → call.
 * If not and 2+ args → define (args[1] is the body).
 * If not and 1 arg → error (undefined macro).
 *
 * Positional placeholders {{$1}}, {{$2}}, etc. are string-replaced at call time.
 * Unreplaced placeholders are stripped to empty string.
 */
const userMacro: MacroDefinition = {
  name: 'macro',
  description: 'Define or call a user-defined macro function',
  category: 'variables',
  args: [
    { name: 'name', description: 'Macro name', required: true },
    { name: 'body/args', description: 'Body (when defining) or positional arguments (when calling)', required: false },
  ],
  handler: (args: string[], context: MacroContext): MacroResult => {
    if (args.length === 0) {
      return { value: '', success: false, error: 'Macro name required' };
    }

    const name = args[0].toLowerCase().trim();

    // If already defined → CALL with positional args
    if (context.userMacros.has(name)) {
      let body = context.userMacros.get(name)!;

      // Substitute positional placeholders
      for (let i = 1; i < args.length; i++) {
        body = body.replaceAll(`{{$${i}}}`, args[i]);
      }

      // Clean up any unreplaced positional placeholders
      body = body.replace(/\{\{\$\d+\}\}/g, '');

      return { value: body, success: true };
    }

    // Not defined yet → DEFINE (need name + body)
    if (args.length < 2) {
      return { value: '', success: false, error: `Undefined macro: ${name}` };
    }

    context.userMacros.set(name, args[1]);
    return { value: '', success: true };
  },
};

/**
 * Register all user-defined macro handlers
 */
export function registerUserMacros(): void {
  registerMacros([userMacro]);
}
