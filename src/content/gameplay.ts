import type { Lesson } from '../types';
import { lesson, lua, structural, rule, quiz, manifest } from './helpers';

const spawnSolution = `local spawned = {}
RegisterCommand("academycar", function(_, args)
  CreateThread(function()
    local model = GetHashKey(args[1] or "blista")
    if not IsModelInCdimage(model) or not IsModelAVehicle(model) then
      print("Choose a valid vehicle model")
      return
    end
    RequestModel(model)
    local deadline = GetGameTimer() + 5000
    while not HasModelLoaded(model) do
      if GetGameTimer() > deadline then
        SetModelAsNoLongerNeeded(model)
        print("Model loading timed out")
        return
      end
      Wait(0)
    end
    local ped = PlayerPedId()
    local pos = GetOffsetFromEntityInWorldCoords(ped, 0.0, 4.0, 0.0)
    local vehicle = CreateVehicle(model, pos.x, pos.y, pos.z, GetEntityHeading(ped), true, false)
    SetModelAsNoLongerNeeded(model)
    if vehicle == 0 then print("Vehicle creation failed"); return end
    spawned[#spawned + 1] = vehicle
  end)
end, false)
AddEventHandler("onResourceStop", function(name)
  if name ~= GetCurrentResourceName() then return end
  for _, vehicle in ipairs(spawned) do
    if DoesEntityExist(vehicle) then DeleteEntity(vehicle) end
  end
end)`;

export const gameplayLessons: Lesson[] = [
lesson({id:'native-reading',module:3,title:'Read a native before calling it',minutes:15,level:'Intermediate',
concept:'A native is a function exposed by GTA or Cfx.re. Its reference lists the API set, parameters, return value and sometimes limitations. Client-only means it belongs in a client script. A Ped or Vehicle return type is an entity handle, not a player’s account or database ID. Read the signature and its notes before selecting arguments.',
why:'Guessing an argument’s meaning can create a resource that appears to work locally but fails under different conditions. Documentation is a tool for reasoning, not a list to memorize.',
example:'local ped = PlayerPedId()\nlocal position = GetEntityCoords(ped)\nprint(position.x, position.y, position.z)',
explanation:['PlayerPedId takes no arguments and returns the current local player’s ped handle.','GetEntityCoords accepts an entity and returns a position.','A vector has x, y, and z components. A handle is not the coordinate itself.','The educational mock below returns a table-shaped position; it does not implement CfxLua’s native vector type.'],
exercise:{...lua('Get the ped with PlayerPedId(), obtain its position with GetEntityCoords(ped), and assign the z coordinate to height. These APIs are educational mocks.','-- Read a ped, its position, and its height.\n','local ped = PlayerPedId()\nlocal position = GetEntityCoords(ped)\nlocal height = position.z',[['Correct entity','assert(_READ_PED and _READ_POSITION, "Pass the result of PlayerPedId() to GetEntityCoords().")'],['Returned coordinate','assert(height == 32.5, "Read z from the returned position.")']],['Follow each function’s return type.','GetEntityCoords needs the result of PlayerPedId.','Store the ped, then the position, then position.z.']),mode:'fivem',filename:'client.lua',mock:'function PlayerPedId() _READ_PED = true; return 91 end\nfunction GetEntityCoords(entity) assert(entity == 91, "Expected the ped handle"); _READ_POSITION = true; return { x = 10, y = 20, z = 32.5 } end'},
challenge:'Choose a native in the official reference. Write down its API set, every argument, return value, and a failure condition. Confirm it with a minimal private-server test.',
quiz:quiz('What should you check before placing a native in server.lua?',['Whether its name is long','Whether its API set supports the server','Whether its example uses spaces'],1,'A native can exist on one side only; its API set is part of the contract.'),review:['Read the API set and return type.','Handles identify runtime entities.','Mock results are not game execution.'],sources:['natives','native-index','ped-native','ids']}),
lesson({id:'native-coordinates',module:3,title:'Coordinates, vector3, and distance',minutes:17,level:'Intermediate',
concept:'A world position has three components: x and y locate a point on the map, while z represents height. CfxLua provides vector3 values and vector arithmetic. In standard Lua, a table can model the same three numbers for testing, but it does not automatically gain vector operators. Distance is the length of the difference between two positions.',
why:'Interaction range checks, markers and spawn locations all depend on positions. A vehicle spawned inside the player or below the ground is often a coordinate mistake, not a model problem.',
example:'-- CfxLua in a client script\nlocal target = vector3(100.0, 200.0, 30.0)\nlocal distance = #(GetEntityCoords(PlayerPedId()) - target)\nprint(distance)',
explanation:['vector3 creates a CfxLua vector, not a standard Lua table.','Subtracting positions produces an offset vector.','The # operator returns that vector’s length in CfxLua; for ordinary Lua tables it has different meaning.'],
exercise:lua('Write distance(a, b) for ordinary Lua position tables. Return the 3D Euclidean distance using math.sqrt.','local function distance(a, b)\n  -- Compute differences for x, y, and z.\nend','local function distance(a, b)\n  local dx, dy, dz = a.x - b.x, a.y - b.y, a.z - b.z\n  return math.sqrt(dx * dx + dy * dy + dz * dz)\nend',[['Horizontal distance','assert(distance({x=0,y=0,z=0},{x=3,y=4,z=0}) == 5, "Use all coordinate differences.")'],['Height and same point','assert(distance({x=1,y=2,z=3},{x=1,y=2,z=15}) == 12 and distance({x=1,y=1,z=1},{x=1,y=1,z=1}) == 0, "Include z and handle identical positions.")']],['Distance is not the sum of signed differences.','Square each difference, add the squares, and take the square root.','sqrt(dx*dx + dy*dy + dz*dz)']),
challenge:'Use this helper to allow an interaction within 3 units, including exactly 3. Then implement the corresponding CfxLua vector expression in your private server.',
quiz:quiz('Why can #(a - b) work for CfxLua vectors but not ordinary tables?',['Tables automatically convert to vectors','CfxLua supplies vector behavior beyond standard Lua','The # operator always measures physical distance'],1,'Vector operations are runtime extensions; ordinary tables do not implement them.'),review:['Keep coordinate components distinct.','Use a nearby offset for spawning.','Test mathematical decisions without a game when possible.'],sources:['lua-runtime','lua-manual','natives']}),
lesson({id:'native-models',module:3,title:'Hashes and bounded model loading',minutes:18,level:'Intermediate',
concept:'A model name identifies a game asset; a hash is a numeric representation used by many natives. Loading is asynchronous: RequestModel starts a request, and HasModelLoaded reports readiness. Yield while waiting and stop after a deadline. Invalid assets and unavailable content must produce a controlled failure.',
why:'A script that waits forever for an invalid model can leave a player stuck. Validation, a timeout and cleanup turn a fragile example into a dependable loading helper.',
example:'local hash = GetHashKey("blista")\nRequestModel(hash)\n-- Wait in a yieldable thread, with a deadline.\n-- Create the entity only after HasModelLoaded(hash).\n-- Release the model with SetModelAsNoLongerNeeded(hash).',
explanation:['GetHashKey computes the model hash from text. CfxLua also supports compile-time hash literals, which ordinary Lua 5.4 syntax checkers may not support.','RequestModel does not mean the asset is ready immediately.','Wait(0) yields until a later game tick. A deadline bounds the operation.','Release the model after creating your entity or abandoning the request.'],
exercise:structural('Complete a loadModel helper: reject a missing model, request it, wait with Wait(0), return false after 5000 ms and release on timeout; otherwise return true.',`local function loadModel(model)
  RequestModel(model)
  while not HasModelLoaded(model) do
    -- Add a deadline and a yield.
  end
  return true
end`,`local function loadModel(model)
  if not IsModelInCdimage(model) then return false end
  RequestModel(model)
  local deadline = GetGameTimer() + 5000
  while not HasModelLoaded(model) do
    if GetGameTimer() > deadline then
      SetModelAsNoLongerNeeded(model)
      return false
    end
    Wait(0)
  end
  return true
end`,[rule('Asset validation','IsModelInCdimage\\s*\\(','Check that the model exists before requesting.'),rule('Bounded waiting','GetGameTimer\\s*\\(\\s*\\)\\s*\\+\\s*5000','Create a 5000 ms deadline.'),rule('Yielding loop','while[\\s\\S]*Wait\\s*\\(\\s*0\\s*\\)','Yield inside the loading loop.'),rule('Timeout cleanup','SetModelAsNoLongerNeeded\\s*\\(model\\)[\\s\\S]*return\\s+false','Release the requested model on failure.')],['A loading loop needs both progress checks and a stopping rule.','Create the deadline before the loop, compare time inside it.','If time exceeds deadline: release, return false; otherwise Wait(0) and check again.']),
challenge:'Call your helper inside CreateThread with a real vehicle hash and an invalid hash. Record elapsed time and ensure failures do not create an entity.',
quiz:quiz('Does RequestModel guarantee the next line can create the asset?',['Yes','No; readiness must be checked','Only if its name is short'],1,'Requesting an asset starts loading; checking readiness is a separate operation.'),review:['Validate before loading.','Yield and enforce a deadline.','Release assets when finished.'],sources:['model-native','lua-runtime','wait']}),
lesson({id:'native-vehicle-project',module:3,title:'Project: a responsible vehicle spawner',minutes:30,level:'Intermediate',
concept:'A vehicle spawner is a sequence of responsibilities: validate input, load the model, choose a safe nearby position, create the vehicle, inspect the return value, release the asset, and clean up owned entities. A private development command is useful for testing; unrestricted public spawning requires additional server policy.',
why:'The visible vehicle is only one part of the feature. Failure handling and cleanup prevent resource restarts from leaving junk in the world.',
example:spawnSolution,
explanation:['The spawned table tracks only entities created by this resource.','The command starts a yieldable task, validates the hash, and waits with a deadline.','An offset is used instead of the player’s exact position; test collision clearance in-game.','CreateVehicle returns a handle or zero on failure. The model is released in either case.','The stop handler filters this resource’s name before deleting tracked entities. Network ownership may require additional handling in a multiplayer production design.'],
exercise:structural('Complete the academycar resource using the example’s responsibilities. Register academycar, validate vehicle models, load with a timeout and yield, create a vehicle, release the model, and clean up tracked vehicles on stop. Export only to a private test server.','local spawned = {}\n-- Register academycar and implement the loading/creation lifecycle.\n',spawnSolution,[rule('Command registration','RegisterCommand\\s*\\(["\']academycar','Register academycar.'),rule('Vehicle validation','IsModelAVehicle\\s*\\(','Reject non-vehicle models.'),rule('Loading and yielding','RequestModel[\\s\\S]*HasModelLoaded[\\s\\S]*Wait\\s*\\(','Request, check readiness, and yield.'),rule('Deadline','GetGameTimer\\s*\\(\\s*\\)\\s*\\+','Bound loading with a deadline.'),rule('Creation and release','CreateVehicle[\\s\\S]*SetModelAsNoLongerNeeded','Create after loading and release the asset.'),rule('Owned cleanup','onResourceStop[\\s\\S]*GetCurrentResourceName[\\s\\S]*DeleteEntity','Filter resource-stop events and delete tracked entities.')],['Think of loading and cleanup as part of spawning.','Start with command registration, then add one responsibility at a time.','Validate → request → bounded wait → create → release → track; stop → delete tracked entities.'],'client.lua',{'fxmanifest.lua':manifest}),
challenge:'Test default and named models, an invalid name, repeated calls, and resource stop. Add an allowlist and a one-vehicle-per-player policy before exposing any request to other players.',
quiz:quiz('Why check whether CreateVehicle returned 0?',['Zero means creation failed','Zero is always the player’s car','It selects the first paint color'],0,'An API return value can report failure even when the call itself did not raise an error.'),review:['Treat the feature as a lifecycle.','Track what your resource owns.','Test failures and repeated use.'],sources:['vehicle-native','model-native','first-script','security']}),
lesson({id:'native-markers-blips',module:3,title:'Markers, blips, and nearby interactions',minutes:22,level:'Intermediate',
concept:'A marker is drawn in the world and usually needs a draw call every frame while visible. A blip is a map element created once and later removed. Mixing these lifecycles creates flickering markers or thousands of duplicate blips. Distance-based waiting avoids doing unnecessary work while the player is far away.',
why:'A useful interaction needs clear guidance without wasting frame time. Design the lifetime of a visual before writing its loop.',
example:'local point = vector3(100.0, 200.0, 30.0)\nlocal blip = AddBlipForCoord(point.x, point.y, point.z)\nCreateThread(function()\n  while true do\n    local near = #(GetEntityCoords(PlayerPedId()) - point) < 30\n    local sleep = near and 0 or 750\n    if near then\n      DrawMarker(1, point.x, point.y, point.z, 0.0,0.0,0.0, 0.0,0.0,0.0, 1.0,1.0,1.0, 150,100,230,160, false,false,2,false,nil,nil,false)\n    end\n    Wait(sleep)\n  end\nend)',
explanation:['The blip is created outside the repeated block.','The loop checks distance and chooses a longer sleep when far away.','DrawMarker runs every frame only while near.','A production resource must remove its blip in its resource-stop cleanup handler.'],
exercise:lua('Write pollDelay(distance): return 0 below 30 units so a marker can draw each frame, otherwise return 750. This tests only the scheduling decision.','local function pollDelay(distance)\n  return 0\nend','local function pollDelay(distance)\n  if distance < 30 then return 0 end\n  return 750\nend',[['Near draws every frame','assert(pollDelay(0) == 0 and pollDelay(29.9) == 0, "Near markers need the per-frame branch.")'],['Far sleeps','assert(pollDelay(30) == 750 and pollDelay(300) == 750, "The far branch should avoid a per-frame loop.")']],['The boundary is strictly below 30.','Return the slow delay for every other distance.','If distance < 30 return 0; otherwise return 750.']),
challenge:'Build a client marker and one map blip in the playground. Add a RemoveBlip cleanup handler. Test near/far transitions and resource restarts while watching resmon.',
quiz:quiz('Which should usually be created once rather than every frame?',['A persistent map blip','A marker draw for the current frame','A per-frame input check'],0,'A blip has a persistent handle; repeatedly creating it leaks duplicate map elements.'),review:['Match each native to its lifecycle.','Use adaptive waits for distant interactions.','Clean up persistent handles.'],sources:['marker-native','blip-native','wait','profiler']}),
lesson({id:'native-key-mapping',module:3,title:'Commands that players can remap',minutes:18,level:'Intermediate',
concept:'A key mapping associates a command with a default input. Players can change the binding through FiveM settings. The command remains the feature’s entry point, so it can also be tested by name. For held actions, plus and minus command pairs represent press and release; a simple toggle needs only one command.',
why:'Hardcoded input polling can conflict with other resources and ignores player preferences. A named command also makes behavior easier to test.',
example:'RegisterCommand("academyhelp", function()\n  print("Open your help interface here")\nend, false)\nRegisterKeyMapping("academyhelp", "Academy help", "keyboard", "F6")',
explanation:['The command callback contains the behavior.','The mapping references the same command string.','The description is visible in settings. keyboard chooses the mapper; F6 is the default parameter.','Registration should happen once during resource startup, not inside an endless loop.'],
exercise:structural('Register academymenu with a callback that prints Menu requested. Map it to keyboard F7 with the description Academy menu.','-- Register the command and its remappable key.\n','RegisterCommand("academymenu", function()\n  print("Menu requested")\nend, false)\nRegisterKeyMapping("academymenu", "Academy menu", "keyboard", "F7")',[rule('Command','RegisterCommand\\s*\\(["\']academymenu["\']','Register the command referenced by the mapping.'),rule('Mapping contract','RegisterKeyMapping\\s*\\(["\']academymenu["\']\\s*,\\s*["\']Academy menu["\']\\s*,\\s*["\']keyboard["\']\\s*,\\s*["\']F7["\']','Provide command, readable description, mapper, and default key.'),rule('Observable action','print\\s*\\(["\']Menu requested["\']','Make the callback observable before adding UI.')],['One name connects the command and the key mapping.','RegisterKeyMapping takes four values in a fixed order.','Command name, description, keyboard, F7.']),
challenge:'Test the command directly, then rebind it in FiveM settings and verify the new key. For a held interaction, implement matching + and - commands and ensure release resets state.',
quiz:quiz('What does the fourth RegisterKeyMapping argument describe?',['The callback function','The default input parameter/key','A database password'],1,'The mapper and parameter together specify the default binding.'),review:['Keep behavior in a named command.','Expose remappable inputs.','Register mappings once.'],sources:['keymap-native','commands']}),
lesson({id:'native-animation-objects',module:3,title:'Animations, objects, and cleanup ownership',minutes:24,level:'Intermediate',
concept:'Animations use a dictionary and a clip name. Request the dictionary and wait for it before calling TaskPlayAnim. Props similarly require a loaded model before CreateObject. Store handles you create, check they still exist before using them, and remove only entities your resource owns. Stopping your own animation is better than clearing unrelated tasks indiscriminately.',
why:'An interaction that works once may leave props or animation state behind after cancellation. Cleanup must cover success, cancel, timeout, disconnect where relevant, and resource stop.',
example:'local props = {}\nlocal function cleanupProps()\n  for _, entity in ipairs(props) do\n    if DoesEntityExist(entity) then DeleteEntity(entity) end\n  end\n  props = {}\nend\nAddEventHandler("onResourceStop", function(name)\n  if name == GetCurrentResourceName() then cleanupProps() end\nend)',
explanation:['The table tracks only resource-owned handles.','DoesEntityExist guards against entities already removed elsewhere.','Resetting the list makes repeated cleanup harmless.','A complete interaction loads its dictionary with RequestAnimDict/HasAnimDictLoaded, calls TaskPlayAnim with verified arguments, and uses StopAnimTask for its own clip when finished.','CreateObject returns a handle or zero; release its model after creation and keep the handle for cleanup.'],
exercise:{...lua('Implement cleanup() to delete each existing tracked prop and replace props with an empty list. The mock contains handles 10 and 12, but 11 has already disappeared.','local props = {10, 11, 12}\nlocal function cleanup()\n  -- Delete existing tracked handles, then reset the list.\nend','local props = {10, 11, 12}\nlocal function cleanup()\n  for _, entity in ipairs(props) do\n    if DoesEntityExist(entity) then DeleteEntity(entity) end\n  end\n  props = {}\nend',[['Only existing entities deleted','cleanup(); assert(_DELETED[10] and _DELETED[12] and not _DELETED[11], "Check existence before deleting tracked entities.")'],['Repeat-safe cleanup','cleanup(); cleanup(); assert(#props == 0, "Clear the tracking list after cleanup.")']],['Cleanup should be safe if some entities are already gone.','Loop through props and guard each deletion with DoesEntityExist.','Delete existing handles; then assign an empty table to props.']),mode:'fivem',filename:'client.lua',mock:'_DELETED = {}\nfunction DoesEntityExist(id) return (id == 10 or id == 12) and not _DELETED[id] end\nfunction DeleteEntity(id) assert(DoesEntityExist(id), "Entity no longer exists"); _DELETED[id] = true end'},
challenge:'Create one local prop with bounded model loading and one short animation with bounded dictionary loading. Add cancel and stop paths. Verify no prop or animation remains after either path.',
quiz:quiz('Which entities should your cleanup routine delete?',['Every nearby object','Only handles your resource owns and tracks','All vehicles on the server'],1,'Ownership limits cleanup to your feature and avoids damaging unrelated gameplay.'),review:['Load assets before using them.','Track handles and guard missing entities.','Make cleanup safe to call repeatedly.'],sources:['animation-native','object-native','model-native','resources']})
];
