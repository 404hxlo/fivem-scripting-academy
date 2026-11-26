import { describe, it, expect } from 'vitest';
import { lessons } from '../src/content';
import { evaluateWithRunner } from '../src/lib/evaluation';
import { executeLua } from '../src/lib/lua-core';

function task(id: string) {
  const lesson = lessons.find(candidate => candidate.id === id);
  if (!lesson) throw new Error(`Missing lesson: ${id}`);
  return lesson.exercise;
}
async function grade(id: string, code: string) {
  const exercise = task(id);
  return evaluateWithRunner(exercise, code, exercise.files, executeLua);
}

describe('course handler assessments', () => {
  it('rejects a cooldown timestamp without an actual cooldown gate', async () => {
    const code = task('events-security-project').solution.replace('  if now < (nextAllowed[src] or 0) then return end\n', '');
    expect((await grade('events-security-project', code)).passed).toBe(false);
  });
  it('rejects a permission check performed after a protected response', async () => {
    const exercise = task('events-security-project');
    const line = '  if not IsPlayerAceAllowed(src, "academy.status") then return end';
    const code = exercise.solution.replace(line, '').replace('  TriggerClientEvent("academy:status", src, "Permission verified by the server")', '  TriggerClientEvent("academy:status", src, "Permission verified by the server")\n' + line);
    expect((await grade('events-security-project', code)).passed).toBe(false);
  });
  it('rejects duty changes before the configured job gate', async () => {
    const exercise = task('framework-job-project');
    const gate = '  if not job or job.name ~= Config.job then return end';
    const code = exercise.solution.replace(gate, '').replace('  player.Functions.SetJobDuty(duty)', '  player.Functions.SetJobDuty(duty)\n' + gate);
    expect((await grade('framework-job-project', code)).passed).toBe(false);
  });
  it('rejects NUI callback code that never registers', async () => {
    const code = 'if false then\n' + task('nui-callbacks-focus').solution + '\nend';
    expect((await grade('nui-callbacks-focus', code)).passed).toBe(false);
  });
  it('rejects an acknowledgement outside the callback body', async () => {
    const code = 'local function cb(_) end\nRegisterNuiCallback("close", function(data, reply)\n SetNuiFocus(false, false)\n SendNUIMessage({ action = "setVisible", visible = false })\nend)\ncb({ ok = true })';
    expect((await grade('nui-callbacks-focus', code)).passed).toBe(false);
  });
  it('accepts the same NUI behavior with a differently named response parameter', async () => {
    const code = task('nui-callbacks-focus').solution.replace('function(data, cb)', 'function(payload, respond)').replace('cb({ ok = true })', 'respond({ ok = true })');
    expect((await grade('nui-callbacks-focus', code)).passed).toBe(true);
  });
  it.each(['nui-callbacks-focus', 'nui-menu-project'])('accepts the supported legacy RegisterNUICallback spelling in %s', async id => {
    const code = task(id).solution.replaceAll('RegisterNuiCallback', 'RegisterNUICallback');
    expect((await grade(id, code)).passed).toBe(true);
  });
  it('rejects stopping an unrelated resource that steals menu focus', async () => {
    const code = task('nui-menu-project').solution.replace('  if name ~= GetCurrentResourceName() then return end\n', '  local ownName = GetCurrentResourceName()\n');
    expect((await grade('nui-menu-project', code)).passed).toBe(false);
  });
  it('accepts a QBCore adapter with equivalent local names', async () => {
    const code = "local Core = exports['qb-core']:GetCoreObject()\nlocal function jobName(id)\n local found = Core.Functions.GetPlayer(id)\n if found == nil then return nil end\n return found.PlayerData.job.name\nend";
    expect((await grade('framework-qbcore', code)).passed).toBe(true);
  });
  it('rejects a cooldown shared globally across all players', async () => {
    const code = task('events-security-project').solution.replaceAll('nextAllowed[src]', 'nextAllowed[1]').replace('nextAllowed[source]', 'nextAllowed[1]');
    expect((await grade('events-security-project', code)).passed).toBe(false);
  });
});
