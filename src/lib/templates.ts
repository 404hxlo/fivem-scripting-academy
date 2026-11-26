import type {Project} from '../types';
import {safeName} from '../../electron/academy-state.mjs';
const manifest=(extra:string)=>`fx_version 'cerulean'\ngame 'gta5'\nauthor 'Academy learner'\ndescription 'A learning resource'\nversion '1.0.0'\n${extra}\n`;
export const templates:Record<string,{title:string;description:string;files:Record<string,string>}>={
 blank:{title:'Empty resource',description:'A manifest and a blank client script. Start with your own idea.',files:{'fxmanifest.lua':manifest("client_script 'client.lua'"),'client.lua':'-- Write your client script here.\n'}},
 command:{title:'First chat command',description:'A standalone /hello command using the chat resource.',files:{'fxmanifest.lua':manifest("client_script 'client.lua'\ndependency 'chat'"),'client.lua':`RegisterCommand('hello', function(source, args)
    local name = args[1] or 'developer'
    TriggerEvent('chat:addMessage', {
        color = {167, 139, 250},
        args = {'Academy', 'Hello, ' .. name .. '!'}
    })
end, false)
`}},
 vehicle:{title:'Vehicle workshop',description:'Validated model, bounded loading, and resource cleanup.',files:{'fxmanifest.lua':manifest("client_script 'client.lua'"),'client.lua':`local spawned = {}
local loading = false
RegisterCommand('academycar', function(_, args)
    if loading then return end
    loading = true
    CreateThread(function()
        local hash = GetHashKey(args[1] or 'blista')
        if not IsModelInCdimage(hash) or not IsModelAVehicle(hash) then
            print('Choose a valid vehicle model.')
            loading = false
            return
        end
        RequestModel(hash)
        local deadline = GetGameTimer() + 5000
        while not HasModelLoaded(hash) do
            if GetGameTimer() > deadline then
                SetModelAsNoLongerNeeded(hash)
                loading = false
                print('Model loading timed out.')
                return
            end
            Wait(0)
        end
        local ped = PlayerPedId()
        local pos = GetEntityCoords(ped)
        -- Local practice entity; persistent multiplayer vehicles need server authority.
        local vehicle = CreateVehicle(hash, pos.x + 3.0, pos.y, pos.z, GetEntityHeading(ped), false, false)
        if vehicle ~= 0 then table.insert(spawned, vehicle) end
        SetModelAsNoLongerNeeded(hash)
        loading = false
    end)
end, false)
AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    for _, vehicle in ipairs(spawned) do
        if DoesEntityExist(vehicle) then DeleteEntity(vehicle) end
    end
end)
`}},
 nui:{title:'NUI menu',description:'Lua messages, browser callbacks, and reliable focus release.',files:{'fxmanifest.lua':manifest("client_script 'client.lua'\nui_page 'html/index.html'\nfiles { 'html/index.html', 'html/style.css', 'html/app.js' }"),'client.lua':`local function closeMenu()
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'close' })
end
RegisterCommand('academymenu', function()
    SetNuiFocus(true, true)
    SendNUIMessage({ action = 'open' })
end, false)
RegisterNuiCallback('close', function(data, cb)
    closeMenu()
    cb({ ok = true })
end)
AddEventHandler('onResourceStop', function(resource)
    if resource == GetCurrentResourceName() then SetNuiFocus(false, false) end
end)
`,'html/index.html':'<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="style.css"><title>Academy menu</title></head><body><main hidden><h1>Your first NUI</h1><p>This interface talks to Lua.</p><button id="close">Close menu</button></main><script src="app.js"></script></body></html>','html/style.css':'body { margin: 0; font-family: sans-serif; color: #eee; }\nmain { width: min(80vw, 380px); margin: 20vh auto; padding: 32px; background: #17171f; border: 1px solid #9073e8; border-radius: 12px; }\nbutton { padding: 12px 24px; cursor: pointer; }\n[hidden] { display: none; }','html/app.js':`const menu = document.querySelector('main');
window.addEventListener('message', (event) => {
    if (event.data.action === 'open') menu.hidden = false;
    if (event.data.action === 'close') menu.hidden = true;
});
async function closeMenu() {
    try {
        const response = await fetch('https://' + GetParentResourceName() + '/close', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
        });
        if (response.ok) menu.hidden = true;
    } catch (error) { console.error('Close callback failed', error); }
}
document.querySelector('#close').addEventListener('click', closeMenu);
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeMenu(); });
`}},
 qbjob:{title:'QBCore job check',description:'A server-owned job check. Requires your matching qb-core installation.',files:{'fxmanifest.lua':manifest("server_script 'server.lua'\ndependencies { 'qb-core', 'chat' }"),'server.lua':`local QBCore = exports['qb-core']:GetCoreObject()
RegisterCommand('academyjob', function(source)
    if source == 0 then print('Use this command in game.') return end
    local Player = QBCore.Functions.GetPlayer(source)
    if not Player then return end
    local job = Player.PlayerData.job
    if not job then return end
    -- Job identity comes from the server framework, never from client arguments.
    TriggerClientEvent('chat:addMessage', source, {
        args = {'Academy', 'Your job: ' .. tostring(job.name)}
    })
end, false)
`}}
};
export function validResourceName(name: string): boolean {
  if (!/^[a-z][a-z0-9_-]{1,47}$/.test(name)) return false;
  try { safeName(name); return true; }
  catch { return false; }
}
export function createProject(name: string, template: string, briefId?: string): Project {
  if (!validResourceName(name)) throw new Error('Choose a resource name using 2–48 lowercase letters, numbers, underscores or hyphens. Start with a letter and avoid Windows reserved names.');
  if (!Object.hasOwn(templates, template)) throw new Error('Choose a resource template.');
  return {id:crypto.randomUUID(),name,template,files:{...templates[template].files},updated:new Date().toISOString(),history:[],briefId,checkpoints:[]};
}
export function snapshot(project:Project):Project {return {...project,history:[{date:new Date().toISOString(),files:{...project.files}},...project.history].slice(0,20)}}
