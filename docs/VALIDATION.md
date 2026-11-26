# Release validation

## Brick by Script Learn 1.2.0

City Dispatch passed all three route playthroughs in the production browser build. Checks covered valid detours, an incomplete route, changing missions during playback, keyboard controls, reduced motion, and reopening all three saved scripts and stamps. The desktop and phone layouts fit 1280-pixel and 390-pixel viewports. The game requested no external assets during the playthrough.

The automated suite passed 244 tests. Four Edge profile checks passed, including a regression for an oversized project edit followed by a snapshot, a corrected file and an unrelated settings change. The 23 production desktop checks covered running a real Lua bus route and preserving the route in SQLite and a portable backup. The Windows upgrade from 1.1.0 to 1.2.0 preserved the existing learner database byte for byte.

## Brick by Script Learn 1.1.0

The installed 1.0.1 entry point and the packaged 1.0.2 entry point used the same profile directory. A change-of-name test saved a completed lesson, quiz answer, Lua code, multi-file project, preferences and study time with the old name. The renamed app reopened the same SQLite file and every field matched. This passed in both the development Electron shell and an isolated packaged shell. A separate packaged-shell first launch created a fresh profile successfully. The Windows installer keeps the original application ID.

The 1.1.0 release passed 226 automated tests, 22 checks against the installed Windows app and three browser profile checks. The bundled Lua 5.4 runtime confirmed the answers to all 12 Output Arcade puzzles. The installed app loaded the artwork offline, ran a three-round game and saved the personal best. The Windows upgrade preserved the existing learner database byte for byte.

## Version 1.0.2 bug review

The Windows build passed 212 automated tests, including all 58 lesson reference solutions. Six event, framework and NUI exercises now invoke learner-written handlers in the offline Lua runtime. Regression cases cover incorrect operation ordering, cooldowns, missing callback responses, and valid alternative solutions. The framework, browser and FiveM APIs in these exercises are simulated.

The packaged executable passed 21 desktop checks with an isolated SQLite profile, zero unexpected renderer errors and zero external renderer requests. These checks covered previously discarded quiz completion, stale Lua results, editing a restored file that was previously inactive, and a NUI callback written with the supported legacy API name. Live FiveM gameplay was outside this review.

Three production browser checks used a disposable Edge profile. One reproduced concurrent tabs overwriting preferences in 1.0.1, then verified that the waiting tab opened the latest saved data in 1.0.2. The other checks verified that an oversized import preserves the visible and saved profile, and that an unreadable profile can be downloaded intact before restoring a valid backup.

On Windows, run `npm run build`, `npm test`, `npm run test:browser` and `npm run test:desktop` to repeat the checks. The browser check requires Microsoft Edge.

## Version 1.0.1 bug checks

All 196 automated tests passed across six files. Regression coverage includes backup compatibility, Lua string formatting, alternate correct lesson answers, and resource validation.

The final packaged Windows executable passed all 16 desktop acceptance checks using an isolated profile. These covered edits made immediately before closing, multi-file solution comparisons, grading, SQLite persistence, backup restore, and exact resource exports. The run recorded zero unexpected renderer errors and zero external renderer requests. The SHA-256 of the application archive extracted from the installer matched the tested archive.

A copy of the 1.0.0 desktop acceptance database retained its complete saved state through a 1.0.1 load, save and reopen. The comparison covered three lesson records, two projects, four files and learning preferences.

In a fresh Edge profile with an empty Vite dependency cache, the first exercise ran on the first click and printed the expected Lua output. A separate Electron check verified that restoring a selected snapshot still restores that version if a new snapshot is added before confirmation.

### Reproduce the automated checks on Windows

From a source checkout with Node.js 24 installed, run these commands in PowerShell. The desktop test creates an isolated profile and writes its JSON report and screenshots under `artifacts/`.

```powershell
npm ci
npm test
npm run pack
$env:ACADEMY_TEST_EXECUTABLE = (Resolve-Path 'release/win-unpacked/Brick by Script Learn.exe').Path
npm run test:desktop
Remove-Item Env:ACADEMY_TEST_EXECUTABLE
```

## Version 1.0.0 release record

FiveM Scripting Academy 1.0.0 was built, installed for the current Windows user, and tested as an installed application.

### Delivered release

- Installer: `release/FiveM Scripting Academy Setup 1.0.0.exe`.
- The default per-user installation directory was `%LOCALAPPDATA%\Programs\FiveM Scripting Academy\`.
- Installer returned exit code **0**. Installed `resources/app.asar` exactly matched the packaged archive by SHA-256.
- `release/SHA256SUMS.txt` identifies the final installer. Third-party license notices are included in the installation.
- 58 lessons, nine modules, eleven project briefs, and 48 source registry entries are bundled.

### Automated verification

**186 tests in six files passed** under Vitest 4.1.12. Coverage includes curriculum source/ID integrity, reference solutions, incomplete starters, real Lua behavior and syntax, alternate solutions, runtime limits, unavailable host APIs, state/backup validation, SQLite close/reopen, safe exports, manifest/file relationships, and ZIP contents. All 58 reference solutions pass; all 58 starters require learner work.

The production TypeScript/Vite build passed. The NSIS installer build passed. React, Monaco, the Lua runtime, workers and lessons are bundled locally. Monaco's large editor/language chunks produce a build size advisory, not a failed build. Wasmoon has a browser-externalization build advisory; its actual packaged worker was exercised successfully.

### Installed application acceptance

The 1.0.0 installed executable passed **all 14 desktop acceptance checks**.

1. Fresh launch starts Lesson 1 without an account or key.
2. Monaco accepts typed code and reports a real Lua syntax failure.
3. Valid syntax with incorrect behavior fails with actual program output.
4. Correct Lua passes behavioral checks in the bundled Lua 5.4 runtime.
5. Quiz and exercise success allow completion and persist in SQLite.
6. Close/reopen preserves code, quiz results, and completion.
7. A multi-file command resource can be created, saved, and checked.
8. Folder export contains `fxmanifest.lua` and its declared script.
9. ZIP export matches the folder content and local testing instructions are visible.
10. Settings and backup export/import work, with a pre-import SQLite recovery copy.
11. Offline reference search finds function names, errors, and dated sources.
12. A `server.cfg` exercise saves, evaluates as configuration, and resets safely.
13. A learner-written chat command passes educational mock checks, moves into the playground, and exports its saved source unchanged.
14. The entire flow makes **zero HTTP/HTTPS renderer requests**; runtime/editor/course assets are local.

The test uses a separate `ACADEMY_DATA_DIR`; it does not pre-complete the user's own course. Native file-dialog selections and import confirmation are automated to select isolated test destinations. Lua, SQLite, IPC validation, folder creation, ZIP generation, and recovery backups are real. A known Monaco model-disposal `CancellationError` is recorded separately; **zero unexpected renderer errors** occurred.

### Milestone outcomes

| Milestone | Result |
| --- | --- |
| Foundation | Desktop shell, navigation, local design system, SQLite persistence implemented. |
| Lesson engine | Bundled schema, lessons, quizzes, progress and backup workflows implemented. |
| Coding environment | Local Monaco, files/tabs, Lua compilation, bounded execution and evaluation implemented. |
| Beginner course | 16 fundamentals lessons and seven resource lessons with working checks. |
| Complete curriculum | All nine modules represented; 58 tested lessons, eleven project briefs, source library. |
| Tutor and playground | Offline guidance, resource creation, project history, validation, exports and a test-server folder preference. |
| Production readiness | Automated suite, installed-app flow, actual Windows installation, installer and documentation completed. |

### Explicit limits

- **Actual FiveM gameplay was not run.** Native mocks and static checks are educational, and do not prove gameplay, networking, authorization, performance or framework compatibility. Exported resources need the documented private-server tests.
- The offline study companion uses bundled teaching guidance.
- The app records an optional test-server folder but does not execute server commands, install into a server, or alter live resources.
- Standard Lua syntax checking does not implement CfxLua-specific syntax extensions. HTML/CSS/JS have editor support and limited structural checks; NUI behavior requires a browser/FiveM test.
- Independent project review includes learner-owned checklists and manual evidence. It is not an automated certification of complete production systems.
- The installer is **unsigned**; it installed and ran on this machine, but organization signing policies can differ.
- The full development dependency audit retains one unresolved picomatch advisory propagated through eleven high-severity toolchain entries. No patched release was published at review time. Critical test-tool alerts were removed. See [dependency review](dependency-audit.md) for exact versions, scope and sources; the packaged runtime dependency audit reports zero alerts.
