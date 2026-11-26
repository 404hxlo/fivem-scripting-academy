# Research and curriculum decisions

Retrieved 2026-11-18. Brick by Script Learn uses original lessons grounded in the Cfx.re scripting manual and references. Lua.org defines standard Lua, and framework maintainers document their APIs. The app is an independent learning tool.

## Learning sequence

1. **Programming fundamentals:** instruction order, syntax, comments, values, variables, expressions, branches, loops, functions, scope, tables, and error diagnosis. Write and run small Lua 5.4 programs before introducing the game.
2. **FiveM development:** files and resource folders, manifests, execution sides, configuration, commands, local server workflow, console errors, and the first chat resource.
3. **Natives and gameplay:** read API sets and signatures; distinguish players, peds, handles and hashes; work with coordinates, loading, vehicles, markers, blips, bindings, animations, cleanup.
4. **Events:** same-side events, network events, arguments, responses, exports, server authority, validation and rate limits.
5. **Intermediate systems:** cooperative scheduling, efficient loops, persistent data, modular configuration, errors, entity networking, state bags, dependencies and measurement.
6. **NUI:** HTML, CSS and JavaScript before UI messages, callbacks, focus and complete menus.
7. **Frameworks:** standalone boundaries first, then separately labeled QBCore, ESX and oxmysql adapters; jobs, permissions, inventory and transactions.
8. **Professional development:** architecture, tests, profiling, Git, documentation, releases and maintenance.
9. **Projects:** requirements, milestones, checkpoints, independent implementation and review for vehicle locks, garage, NPC, notifications, banking UI, jobs, inventory, administration, HUD, businesses and NUI.

## Verified implementation guidance

- CfxLua uses Lua 5.4 by default. The `lua54` manifest switch is deprecated; do not require it in new manifests. CfxLua extensions (vectors and compile-time hashes) are distinct from standard Lua. [Lua runtime](https://docs.fivem.net/docs/scripting-manual/runtimes/lua/) · [Manifest](https://docs.fivem.net/docs/scripting-reference/resource-manifest/)
- A resource contains a manifest and its declared files. Use `fxmanifest.lua`, `fx_version 'cerulean'` and `game 'gta5'`. Shared files execute separately on both sides; they do not create shared memory. [Resources](https://docs.fivem.net/docs/scripting-manual/introduction/introduction-to-resources/)
- Use `RegisterCommand` for commands. `refresh` discovers newly added resources, `ensure` starts or restarts, and `restart` restarts an already running resource. [Commands](https://docs.fivem.net/docs/scripting-manual/migrating-from-deprecated/creating-commands/) · [Server commands](https://docs.fivem.net/docs/server-manual/server-commands/)
- A native's API set determines where it can run. Entity handles are local; network IDs identify replicated entities across machines. Do not treat either as persistent database identifiers. [Natives](https://docs.fivem.net/docs/scripting-manual/introduction/about-native-functions/) · [Identifiers](https://docs.fivem.net/docs/scripting-manual/networking/ids/)
- Network events need server-side decisions. Validate player identity, permissions, current state, ranges and server-owned values. Event names are not secrets. Capture `source` locally before asynchronous work. [Security](https://docs.fivem.net/docs/developers/server-security/) · [Listening](https://docs.fivem.net/docs/scripting-manual/working-with-events/listening-for-events/)
- `Wait` yields a coroutine. Continuous game loops need a yield on every path. Use frame-by-frame polling only where required, and profile before optimizing. [Wait](https://docs.fivem.net/docs/scripting-reference/runtimes/lua/functions/Citizen.Wait) · [Profiler](https://docs.fivem.net/docs/scripting-manual/debugging/using-profiler/)
- State bag updates are shallow. Reassign a key instead of mutating a nested table. Replication and authorization are separate concerns. [State bags](https://docs.fivem.net/docs/scripting-manual/networking/state-bags/)
- NUI requires a declared `ui_page` and bundled files. Lua sends JSON-friendly messages; browser code posts callbacks using HTTPS and the resource name. Respond to every callback and release focus when closing. [Fullscreen NUI](https://docs.fivem.net/docs/scripting-manual/nui-development/full-screen-nui/) · [Callbacks](https://docs.fivem.net/docs/scripting-manual/nui-development/nui-callbacks/)
- QBCore's core export and player object are framework APIs, not FiveM natives. ESX has its own player accessors. oxmysql transactions commit together on SQL success, but application rules still need explicit checks: an update affecting zero rows is not necessarily a failed query. [QBCore](https://qbcore.org/docs/qb-core/core-object) · [ESX](https://docs.esx-framework.org/en/esx_core/es_extended/server/functions) · [oxmysql](https://overextended.dev/docs/oxmysql/Functions/transaction)

## Prerequisites and gaps

The scripting manual is a technical reference, not a complete zero-experience programming course. It assumes familiarity with file extensions, directories, text editors, function calls and debugging. The academy must teach these directly. Learners need neither an account nor a running server for bundled lessons. Real gameplay tests require a compatible GTA installation, FiveM, a privately configured local FXServer and a registration key entered outside the academy. Framework projects additionally need the named framework and database resources. HTML/CSS/JavaScript and SQL are separate prerequisite topics before NUI and database integration.

## Source limitations and corrections

- The first-script article's server section is unfinished and an older paragraph claims server scripts have no game functionality. Current server native and OneSync references supersede that statement; it is not taught here.
- During research, the browsing tool normalized several native query URLs with a trailing `=` and returned unrelated entries. Relevant signatures were checked against the official repository instead: [PlayerPedId](https://github.com/citizenfx/natives/blob/master/PLAYER/PlayerPedId.md), [RequestModel](https://github.com/citizenfx/natives/blob/master/STREAMING/RequestModel.md), [CreateVehicle](https://github.com/citizenfx/natives/blob/master/VEHICLE/CreateVehicle.md), [RegisterKeyMapping](https://github.com/citizenfx/fivem/blob/master/ext/native-decls/RegisterKeyMapping.md). Native results are never inferred from a mismatched page.
- The old QBCore documentation URL redirected to `qbcore.org`. The `coxdocs.dev` oxmysql transaction URL redirected to the Overextended homepage, so the current transaction documentation was located at the URL above.
- The current [RegisterNUICallback reference](https://docs.fivem.net/docs/scripting-reference/runtimes/lua/functions/RegisterNUICallback/) labels that older function a legacy API. New lesson code uses `RegisterNuiCallback`, as shown by the current NUI callback guide and [official native declaration](https://github.com/citizenfx/fivem/blob/master/ext/native-decls/RegisterNuiCallback.md).
- Individual guessed KVP native declaration paths returned 404. KVP registration was instead checked in the [official server implementation](https://github.com/citizenfx/fivem/blob/master/code/components/citizen-server-impl/src/ServerKVScriptFunctions.cpp). The Git book subpage also returned 404; the [canonical Git reference](https://git-scm.com/docs) was accessible and used for the workflow links.
- Bundled lessons work offline. External source pages and metadata refresh require connectivity. Retrieval dates describe verification, not a guarantee that every future framework release behaves identically.

## Evaluation boundaries

Standard Lua exercises can be evaluated in an isolated Lua 5.4 environment. Game functions require FiveM: static checks or educational mocks must be explicitly labeled and must never count as an in-game test. Automated checks establish only their stated requirements. Advanced project review includes manual evidence from a private local server, particularly networking, focus cleanup, persistence and hostile input handling.

## Implemented content inventory

The bundled course contains 58 original lessons: 16 programming fundamentals, 7 resource-development lessons, 7 gameplay lessons, 5 event/security lessons, 6 intermediate-system lessons, 6 NUI lessons, 6 framework lessons, 4 professional-development lessons and 1 project-studio lesson. Eleven separate project briefs contain requirements, milestones, evidence checkpoints and code-review criteria.

Each lesson includes a concept, application, example, annotated explanation, editable exercise, three progressive hints, explicit solution, independent challenge, quiz, review and source references. `src/content/sources.ts` maintains retrieval metadata; `src/content/index.ts` derives each source's lesson mapping without storing user progress in course content.

Automated curriculum verification executes every supplied solution and starter through the actual assessment engine. On 2026-11-18 all 118 curriculum checks passed: solutions satisfy their assessments, starters require learner work, identifiers and source links resolve within the registry, all modules have lessons and all eleven briefs contain their required sections. These checks do not assert that a GTA/FiveM runtime was tested.
