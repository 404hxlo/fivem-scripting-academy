import type { Exercise } from '../types';
import { simulated } from './helpers';
import { serverMock, qbcoreMock, nuiMock } from './assessment-mocks';

// Each lesson explicitly selects its behavioral scenarios with assessed().
// Keep the scenarios together so denial cases can be reviewed alongside success.
const behavior: Record<string, { mock: string; tests: [string, string][] }> = {
  'events-security-project': {
    mock: serverMock,
    tests: [
      ['Network registration and targeted response', `
        assert(_NETWORK_EVENTS["academy:requestStatus"], "Register the request as a network event.")
        assert(#_REPLIES == 0, "Do not send a response before a request.")
        _PERMISSIONS[7] = true
        _CALL_EVENT("academy:requestStatus", 7)
        assert(#_REPLIES == 1 and _REPLIES[1].name == "academy:status" and _REPLIES[1].target == 7,
          "Reply once to the permitted requester, not to all players.")
      `],
      ['Authorization happens before any response', `
        _CALL_EVENT("academy:requestStatus", 9)
        assert(#_REPLIES == 0, "A player without academy.status permission must receive no protected response.")
        _PERMISSIONS[0] = true
        _CALL_EVENT("academy:requestStatus", 0)
        assert(#_REPLIES == 0, "Ignore source 0; this feature is for players.")
      `],
      ['Three-second cooldown and separate players', `
        _PERMISSIONS[7], _PERMISSIONS[8] = true, true
        _CALL_EVENT("academy:requestStatus", 7)
        _CALL_EVENT("academy:requestStatus", 7)
        assert(#_REPLIES == 1, "Writing a timestamp is not enough: reject an immediate repeated request.")
        _CALL_EVENT("academy:requestStatus", 8)
        assert(#_REPLIES == 2 and _REPLIES[2].target == 8, "One player's cooldown must not block another player.")
        _NOW = 102999
        _CALL_EVENT("academy:requestStatus", 7)
        assert(#_REPLIES == 2, "The cooldown is still active before three seconds.")
        _NOW = 103000
        _CALL_EVENT("academy:requestStatus", 7)
        assert(#_REPLIES == 3, "Allow another request once three seconds have elapsed.")
      `],
      ['Disconnect removes the old session cooldown', `
        _PERMISSIONS[7] = true
        _CALL_EVENT("academy:requestStatus", 7)
        _CALL_EVENT("playerDropped", 7)
        _CALL_EVENT("academy:requestStatus", 7)
        assert(#_REPLIES == 2, "Clear the departed player's cooldown before a source ID is reused.")
      `],
    ],
  },
  'framework-qbcore': {
    mock: qbcoreMock,
    tests: [
      ['Framework lookup uses the supplied player', `
        _ADD_PLAYER(7, "taxi", false)
        _ADD_PLAYER(8, "mechanic", true)
        assert(jobName(7) == "taxi" and jobName(8) == "mechanic", "Return each requested player's actual job name.")
      `],
      ['Missing player returns nil', `
        assert(jobName(99) == nil, "Guard a missing framework player before reading PlayerData.")
      `],
    ],
  },
  'framework-esx': {
    mock: `
      local players = {
        [7] = { getJob = function() return { name = "taxi" } end },
        [8] = { getJob = function() return { name = "mechanic" } end }
      }
      ESX = { GetPlayerFromId = function(id) return players[id] end }
    `,
    tests: [
      ['ESX player-specific job lookup', `assert(jobName(7) == "taxi" and jobName(8) == "mechanic", "Read the requested xPlayer's job rather than returning a fixed name.")`],
      ['Missing xPlayer returns nil', `assert(jobName(99) == nil, "A player can disconnect; guard the lookup before getJob.")`],
    ],
  },
  'framework-job-project': {
    mock: qbcoreMock,
    tests: [
      ['Permitted duty transition uses the framework setter', `
        local worker = _ADD_PLAYER(7, Config.job, false)
        _CALL_COMMAND("academyshift", 7)
        assert(worker.PlayerData.job.onduty == true and #_DUTY_CHANGES == 1 and _DUTY_CHANGES[1].player == 7,
          "Toggle the eligible worker through SetJobDuty, not by assigning PlayerData directly.")
        assert(#_REPLIES == 1 and _REPLIES[1].target == 7 and _REPLIES[1].name == "chat:addMessage",
          "Send one chat result to the player whose duty changed.")
        _NOW = 103000
        _CALL_COMMAND("academyshift", 7)
        assert(worker.PlayerData.job.onduty == false and #_DUTY_CHANGES == 2, "A later command must toggle duty off again.")
      `],
      ['Wrong job cannot mutate duty or receive success', `
        local outsider = _ADD_PLAYER(9, "unemployed", false)
        _CALL_COMMAND("academyshift", 9)
        assert(outsider.PlayerData.job.onduty == false and #_DUTY_CHANGES == 0 and #_REPLIES == 0,
          "Check the server-owned job before changing duty or sending success.")
      `],
      ['Missing player, missing job and console are handled', `
        _CALL_COMMAND("academyshift", 99)
        _ADD_PLAYER(10, Config.job, false).PlayerData.job = nil
        _CALL_COMMAND("academyshift", 10)
        _ADD_PLAYER(0, Config.job, false)
        _CALL_COMMAND("academyshift", 0)
        assert(#_DUTY_CHANGES == 0 and #_REPLIES == 0, "Ignore unavailable players/jobs and console requests without side effects.")
      `],
      ['Cooldown applies per player and expires', `
        _ADD_PLAYER(7, Config.job, false)
        _ADD_PLAYER(8, Config.job, false)
        _CALL_COMMAND("academyshift", 7)
        _CALL_COMMAND("academyshift", 7)
        assert(#_DUTY_CHANGES == 1, "Do not toggle duty twice during the cooldown.")
        _CALL_COMMAND("academyshift", 8)
        assert(#_DUTY_CHANGES == 2, "Keep separate cooldowns for different players.")
        _NOW = 102999
        _CALL_COMMAND("academyshift", 7)
        assert(#_DUTY_CHANGES == 2, "Wait the full three seconds.")
        _NOW = 103000
        _CALL_COMMAND("academyshift", 7)
        assert(#_DUTY_CHANGES == 3, "Allow the transition after the cooldown expires.")
      `],
      ['Disconnect cleanup and configurable job', `
        Config.job = "mechanic"
        _ADD_PLAYER(7, "mechanic", false)
        _CALL_COMMAND("academyshift", 7)
        _CALL_EVENT("playerDropped", 7)
        _ADD_PLAYER(7, "mechanic", false)
        _CALL_COMMAND("academyshift", 7)
        assert(#_DUTY_CHANGES == 2, "Use Config.job and clear the prior session cooldown when a player leaves.")
      `],
    ],
  },
  'nui-callbacks-focus': {
    mock: nuiMock,
    tests: [
      ['Registered close callback completes its request', `_CLOSE_MENU(); _EXPECT_VISIBLE(false)`],
      ['Repeated close is safe', `_CLOSE_MENU(); _CLOSE_MENU(); _EXPECT_VISIBLE(false)`],
    ],
  },
  'nui-menu-project': {
    mock: nuiMock,
    tests: [
      ['Menu starts closed and the command toggles it', `
        assert(not _FOCUS or (_FOCUS.keyboard == false and _FOCUS.mouse == false), "Do not capture focus during startup.")
        for _, message in ipairs(_MESSAGES) do assert(message.visible ~= true, "The menu should not open during startup.") end
        assert(type(_COMMANDS.academymenu) == "function", "Register academymenu.")
        _COMMANDS.academymenu(); _EXPECT_VISIBLE(true)
        _COMMANDS.academymenu(); _EXPECT_VISIBLE(false)
      `],
      ['Opening has a remappable F7 binding', `
        local mapping = _MAPPINGS.academymenu
        assert(mapping and mapping.mapper == "keyboard" and string.upper(mapping.key) == "F7"
          and type(mapping.description) == "string" and #mapping.description > 0, "Map academymenu to keyboard F7 with a readable description.")
      `],
      ['Close callback releases focus, hides and acknowledges', `
        assert(type(_COMMANDS.academymenu) == "function", "Register academymenu.")
        _COMMANDS.academymenu(); _EXPECT_VISIBLE(true)
        _CLOSE_MENU(); _EXPECT_VISIBLE(false)
        _COMMANDS.academymenu(); _EXPECT_VISIBLE(true)
      `],
      ['Only this resource stop releases its focus', `
        assert(type(_COMMANDS.academymenu) == "function", "Register academymenu.")
        assert(type(_HANDLERS.onResourceStop) == "function", "Register resource-stop cleanup.")
        _COMMANDS.academymenu(); _EXPECT_VISIBLE(true)
        _HANDLERS.onResourceStop("unrelated_resource")
        _EXPECT_VISIBLE(true)
        _HANDLERS.onResourceStop(GetCurrentResourceName())
        assert(_FOCUS and _FOCUS.keyboard == false and _FOCUS.mouse == false, "Release both focus flags when this resource stops.")
      `],
    ],
  },
};

export function assessed(id: string, instructions: string, starter: string, solution: string, hints: [string, string, string], filename = 'client.lua', files?: Record<string, string>): Exercise {
  const assessment = behavior[id];
  if (!assessment) throw new Error(`Missing behavioral assessment: ${id}`);
  return simulated({ instructions, starter, solution, hints, filename, files, mode: 'fivem', tests: [] }, assessment.mock, assessment.tests);
}
