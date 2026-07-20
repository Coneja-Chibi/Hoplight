/**
 * Runtime smoke entry for the public core graph. The harness bundles this for Node, then executes
 * it with Node so a Bun-only import in core fails at the compatibility gate.
 */
import assert from "node:assert/strict";
import * as core from "../src/core";

assert.equal(core.CANONICAL_SCHEMA_VERSION, "1");
assert.equal(typeof core.loadFormats, "function");
assert.equal(typeof core.registry.detect, "function");
