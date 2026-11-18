# FiveM Scripting Academy

A Windows app for learning Lua 5.4 and developing FiveM resources. Lessons, runnable exercises, quizzes, project files, and references are bundled for offline use.

Version 1.0.1 passed **196 automated tests and 16 desktop checks** on Windows. The application archive in the installer matches the tested archive. [Validation results and limits](docs/VALIDATION.md)

## Launch

Download the Windows setup executable, run it for the current user, then launch **FiveM Scripting Academy** from the Start menu or desktop shortcut. [Latest Windows release](https://github.com/404hxlo/fivem-scripting-academy/releases/latest)

Local builds write the installer to `release/` and the unpacked app to `release/win-unpacked/`.

For a source checkout, install Node.js 24 or later and run:

```powershell
npm ci
npm run build
npm start
```

The first launch defaults to the Beginner track. Choose **Start learning**, read the first lesson, then write code in the editor and select **Run checks**. Pass the exercise and knowledge check to finish the lesson. Explanations, examples, progressive hints, and explicitly revealed solutions are available separately.

## What is included

- 58 lessons across nine modules: Lua fundamentals; resources; gameplay natives; events and networking; intermediate systems; NUI; framework integration; professional practices; advanced projects.
- Original explanations, line walkthroughs, editable exercises, independent challenges, quizzes, reviews, and official source links.
- Monaco editor with Lua highlighting, line numbers, indentation, completions, file explorer, tabs, find/replace, undo/redo, formatting, syntax markers, and explicit solution comparison.
- Real Lua 5.4 execution in disposable Web Workers with bundled Wasmoon WASM. No runtime CDN is needed.
- SQLite progress, code, settings, projects and history in the desktop app; JSON progress import/export with recovery snapshots.
- Dashboard completion, quiz accuracy, active study time, calendar streak, review recommendations and earned milestones.
- Resource creation templates, manifest validation, syntax checks, folder/ZIP export, project snapshots and opening exported snapshots in VS Code.
- Searchable lessons, error explanations and 48 source records with retrieval dates, lesson mappings, editable official links and optional availability checks.
- Eleven project briefs with requirements, milestones, checkpoints and review prompts.

The study companion uses bundled guidance and works offline without an account or API key.

## Why Electron

Electron provides the desktop window, local database access and native file dialogs. The React and TypeScript interface, Monaco editor and WebAssembly Lua runtime ship together in the Windows installer.

## Development and verification

```powershell
npm run dev                 # loopback browser preview
npm run build               # type check + bundled production assets
npm test                    # curriculum, runtime, state, export and database tests
npm run test:desktop        # actual Electron acceptance test (build first)
npm run pack                # unpacked Windows application
npm run dist                # per-user NSIS Windows installer
```

To run Electron against the Vite development server in a second PowerShell:

```powershell
$env:ACADEMY_DEV_URL = 'http://127.0.0.1:5173'
npm start
```

Remove that environment variable before testing production. `ACADEMY_DATA_DIR` selects an isolated data directory for desktop tests. Browser preview uses localStorage in that browser profile. Desktop tests exercise Lua, SQLite and file exports in an isolated profile. The harness automates native dialog choices and holds one autosave acknowledgement open to verify that closing the window commits the latest edit.

The Vite development server is a development convenience. The production desktop app serves its own local `app://academy` content and does not need a development server.

## Data and backups

The desktop database is normally `%APPDATA%\FiveM Scripting Academy\academy.sqlite`. SQLite uses a rollback journal and transactional saves. Import creates a recovery database snapshot before replacing current data. Use **Settings & backups → Export backup** for a portable JSON file containing progress and projects. Keep a copy outside the installation directory before moving computers.

Project **Save snapshot** stores independent versions inside the application, up to 20 retained snapshots per project. Restoring a snapshot also saves the current files first. Opening in VS Code creates a separate filesystem snapshot; changes made there are not silently synchronized back into the academy.

Changing learning tracks or source links does not reset progress. Editing an assessed lesson's guided code invalidates its previous passing status until checks run again.

## Exercise evaluation and limits

Standard Lua exercises execute real Lua 5.4 behavior. Tests call functions with different inputs, inspect values/output, and report individual failures. Runtime compilation provides actual syntax errors, not regex-only syntax detection.

- Each run uses a new disposable worker and Lua state.
- A host watchdog terminates a run after 1.5 seconds. Lua also has an instruction timeout.
- Lua-managed allocations are limited to 8 MB, input to 64 KB, and captured output to 100 lines / 16 KB.
- Student chunks receive an allowlisted environment. Filesystem, shell, network, package loading, debug, arbitrary loaders, and the Wasmoon JavaScript bridge are unavailable.
- No host directories are mounted into WASM. OS/IO functions are not provided to student code.
- Assertions are educational assessment, not a cheating-resistant remote examination system.

FiveM natives require the actual game runtime. Lessons clearly identify **educational mocks** or **static checks**. Neither proves live native behavior, networking, game performance or server security. Static checks recognize limited structures and required files; they are not a comprehensive semantic verifier. Standard Lua checking does not implement CfxLua extensions such as backtick hash literals. Use `GetHashKey('model')` in portable examples and perform final validation in FiveM.

The editor supports NUI HTML, CSS and JavaScript source files. Test NUI behavior on a private local FiveM server.

## Export and test a FiveM resource

1. Open **Playground → New resource** and choose a template. `First chat command` is a good initial project.
2. Read and edit its files. Use **Check resource** and resolve failed checks. Multi-file lessons also offer **Open resource in playground** to continue with your own lesson files.
3. Export to a **new resource folder** or ZIP. Exports contain a root `fxmanifest.lua` and referenced files. Existing resource folders are not overwritten.
4. Set up a separate development FXServer following the [official txAdmin setup](https://docs.fivem.net/docs/server-manual/setting-up-a-server-txadmin/). Configure registration keys privately, outside this application.
5. Place the exported folder under `resources/[local]/your_resource_name`. Install dependencies first; the chat template needs `chat`, and the QBCore template needs a compatible `qb-core` plus `chat` for its message.
6. In **your private test server console**, enter `refresh`, then `ensure your_resource_name`. To start it on subsequent test-server boots, add `ensure your_resource_name` to that server's `server.cfg`.
7. Join the test server and inspect client F8 and server consoles. For the chat template run `/hello Developer`; for vehicle practice `/academycar blista`; for NUI `/academymenu`; for QBCore `/academyjob`.
8. Test invalid input, multiple players where relevant, restarts, disconnects, UI closing and entity cleanup. Record findings at project checkpoints.

The academy never starts a server, executes server commands, installs into a live server, or overwrites an existing resource. The optional server-folder preference is a local workflow reference only. A server configuration, game license, Cfx registration, framework, and database are separate prerequisites for real gameplay tests.

## Research and source updates

See [research decisions](docs/research.md) and the in-app source registry. Source retrieval is dated 2026-11-18. Current Cfx guidance takes precedence over stale examples: Lua 5.4 is the default and `lua54` is deprecated. FiveM core APIs and framework APIs are explicitly distinguished.

Official documentation links can be updated in the Reference library. Availability refresh checks a URL using HTTPS on an allowlisted documentation host; it does not silently rewrite bundled teaching material or clear progress. Offline or inaccessible links show an explanatory status. Lessons remain available locally.

## Desktop security

The renderer has sandboxing, context isolation and no Node integration. A narrow preload API exposes validated operations. IPC checks the sending frame and origin. Production uses a restrictive Content Security Policy and local assets; navigation, new windows, webviews and permission requests are blocked. External links are validated against documentation hosts. Resource paths reject traversal, absolute paths, Windows device names, case collisions and unsupported file types. Export dialogs require choosing a destination; folder exports refuse existing targets. No arbitrary shell-command API exists.

## Troubleshooting

- **Blank window:** run `npm run build` before `npm start`. Verify `dist/index.html` exists. Remove an old `ACADEMY_DEV_URL` when using the production build.
- **Lua worker failed:** ensure the complete bundled `dist/assets` directory is present. Rebuild if testing source. Do not remove WASM or worker assets. Endless loops should report a timeout instead of freezing the UI.
- **Progress cannot be saved:** check disk space and permissions for the data directory. The app shows a save error and offers a recovery JSON download; it does not silently reset the database.
- **A backup is rejected:** use an Academy version 1 JSON export. Keep the original file unchanged; malformed data and unsafe project paths are rejected.
- **Folder already exists:** select a different export parent or change the resource name. Back up and merge existing resources manually.
- **VS Code does not open:** install VS Code with its URI protocol registration. Use the exported snapshot path in the result to open the folder manually.
- **A native fails in the academy:** natives are not available in standalone Lua. Use the lesson's mock/static mode, then test the resource in FiveM.
- **Framework API differs:** inspect the linked framework documentation and match the framework/inventory/database versions installed on your private server. Framework examples are not universal adapters.
- **Windows blocks an unsigned build:** the local installer is not publisher-signed. Organization Application Control can prohibit unsigned builds. Do not disable security policy; use an approved signing/deployment process or an allowed development launch.

## Repository map

`src/content/` contains lessons and sources. `src/components/` contains the learning UI. `src/lib/lua-core.ts` implements the Lua environment; `lua.worker.ts` isolates execution. `electron/` owns SQLite, IPC and exports. `tests/` contains logic tests. `scripts/desktop-test.mjs` validates actual desktop behavior. `docs/` records research and release validation.
