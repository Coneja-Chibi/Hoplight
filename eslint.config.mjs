/**
 * Lint law, scoped tight ON PURPOSE: only the React failure classes that types and tests cannot
 * catch (rules-of-hooks violations, effect-dependency echo loops - the "Maximum update depth"
 * family). This is a GATE, not a style tool: style stays the house doctrine, enforced by review
 * and the scripts/hooks detectors. Runs on src/ui .tsx via pre-commit.
 */
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    files: ["src/ui/**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      // conditional/looped hooks corrupt React's dispatcher state: always an error
      "react-hooks/rules-of-hooks": "error",
      // missing/lying deps are the echo-loop breeding ground; warn (the ctx pattern has one
      // documented mount-once exception, disabled inline with its reason)
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
