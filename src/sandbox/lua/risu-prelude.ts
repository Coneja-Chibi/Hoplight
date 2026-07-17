/**
 * Minimal Lua prelude for module scripts in the Test Bench sealed room.
 * Public API surface names (listenEdit, getState, setState, async) match what Risu cards expect;
 * implementations are ours: sync-friendly, no network, state via getChatVar/setChatVar + json.
 */

/**
 * Prepended before module source. Relies on host-injected getChatVar/setChatVar/json (and optionally
 * async as a no-op wrap if the host already provided one - this redefines async in Lua for simplicity).
 */
export const RISU_TESTBENCH_PRELUDE = `
local editRequestFuncs = {}
local editDisplayFuncs = {}
local editInputFuncs = {}
local editOutputFuncs = {}

function listenEdit(type, func)
  if type == "editRequest" then
    editRequestFuncs[#editRequestFuncs + 1] = func
    return
  end
  if type == "editDisplay" then
    editDisplayFuncs[#editDisplayFuncs + 1] = func
    return
  end
  if type == "editInput" then
    editInputFuncs[#editInputFuncs + 1] = func
    return
  end
  if type == "editOutput" then
    editOutputFuncs[#editOutputFuncs + 1] = func
    return
  end
  error("listenEdit: invalid type")
end

function getState(id, name)
  local escapedName = "__" .. name
  local raw = getChatVar(id, escapedName)
  if raw == nil or raw == "" then
    return nil
  end
  local ok, decoded = pcall(function()
    return json.decode(raw)
  end)
  if ok then
    return decoded
  end
  return nil
end

function setState(id, name, value)
  local escapedName = "__" .. name
  local ok, encoded = pcall(function()
    return json.encode(value)
  end)
  if ok then
    setChatVar(id, escapedName, encoded)
  end
end

-- Sync stand-in: Risu wraps with coroutines/Promise; Test Bench returns the function as-is.
function async(callback)
  return callback
end

function throw(msg)
  error(msg)
end
`;
