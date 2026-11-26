// These mock functions are pure Lua. They model the contracts used by lessons;
// they expose no operating-system, network, filesystem, or JavaScript access.
export const serverMock = `
_HANDLERS = {}
_NETWORK_EVENTS = {}
_COMMANDS = {}
_REPLIES = {}
_PERMISSIONS = {}
_NOW = 100000
source = 0
function GetGameTimer() return _NOW end
function AddEventHandler(name, callback) _HANDLERS[name] = callback end
function RegisterNetEvent(name, callback)
  _NETWORK_EVENTS[name] = true
  if callback then AddEventHandler(name, callback) end
end
function RegisterCommand(name, callback, restricted)
  _COMMANDS[name] = { callback = callback, restricted = restricted }
end
function IsPlayerAceAllowed(playerId, permission)
  return permission == "academy.status" and _PERMISSIONS[playerId] == true
end
function TriggerClientEvent(name, playerId, data)
  _REPLIES[#_REPLIES + 1] = { name = name, target = playerId, data = data }
end
function _CALL_EVENT(name, playerId, ...)
  assert(type(_HANDLERS[name]) == "function", "Register the " .. name .. " handler first.")
  source = playerId
  _HANDLERS[name](...)
  source = 0
end
function _CALL_COMMAND(name, playerId, ...)
  assert(_COMMANDS[name] and type(_COMMANDS[name].callback) == "function", "Register the " .. name .. " command first.")
  source = playerId
  _COMMANDS[name].callback(playerId, { ... }, name)
  source = 0
end
`;

export const qbcoreMock = serverMock + `
Config = { job = "taxi" }
_PLAYERS = {}
_DUTY_CHANGES = {}
function _ADD_PLAYER(id, jobName, onDuty)
  local player = { PlayerData = { job = { name = jobName, onduty = onDuty } }, Functions = {} }
  player.Functions.SetJobDuty = function(value)
    assert(type(value) == "boolean", "SetJobDuty expects a boolean.")
    player.PlayerData.job.onduty = value
    _DUTY_CHANGES[#_DUTY_CHANGES + 1] = { player = id, value = value }
  end
  _PLAYERS[id] = player
  return player
end
_CORE = { Functions = { GetPlayer = function(id) return _PLAYERS[id] end } }
exports = { ['qb-core'] = { GetCoreObject = function() return _CORE end } }
`;

export const nuiMock = `
_CALLBACKS = {}
_COMMANDS = {}
_HANDLERS = {}
_MAPPINGS = {}
_MESSAGES = {}
_FOCUS = nil
function RegisterNuiCallback(name, callback) _CALLBACKS[name] = callback end
-- Both supported APIs share this lesson's observable registration contract.
-- The real legacy API dispatches through __cfx_nui events instead.
RegisterNUICallback = RegisterNuiCallback
function RegisterCommand(name, callback) _COMMANDS[name] = callback end
function RegisterKeyMapping(command, description, mapper, key)
  _MAPPINGS[command] = { description = description, mapper = mapper, key = key }
end
function AddEventHandler(name, callback) _HANDLERS[name] = callback end
function GetCurrentResourceName() return "academy_test" end
function SetNuiFocus(keyboard, mouse)
  assert(type(keyboard) == "boolean" and type(mouse) == "boolean", "Both focus flags must be booleans.")
  _FOCUS = { keyboard = keyboard, mouse = mouse }
end
function SendNUIMessage(message)
  assert(type(message) == "table", "Send a message table.")
  local copy = {}
  for key, value in pairs(message) do copy[key] = value end
  _MESSAGES[#_MESSAGES + 1] = copy
end
function _CLOSE_MENU()
  assert(type(_CALLBACKS.close) == "function", "Register the close callback.")
  local count, result = 0, nil
  _CALLBACKS.close({}, function(value) count = count + 1; result = value end)
  assert(count == 1, "Finish each close request by calling cb exactly once.")
  assert(type(result) == "table" and result.ok == true, "Acknowledge close with { ok = true }.")
end
function _EXPECT_VISIBLE(value)
  assert(_FOCUS and _FOCUS.keyboard == value and _FOCUS.mouse == value, "Keyboard and mouse focus must match the visible state.")
  local message = _MESSAGES[#_MESSAGES]
  assert(message and message.action == "setVisible" and message.visible == value, "Send the matching setVisible message.")
end
`;
