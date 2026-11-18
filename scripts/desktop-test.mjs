import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync, strFromU8 } from 'fflate';

const root = fileURLToPath(new URL('../', import.meta.url));
const executablePath = process.env.ACADEMY_TEST_EXECUTABLE;
const label = (process.env.ACADEMY_TEST_LABEL ?? (executablePath ? 'installed' : 'desktop')).replace(/[^a-zA-Z0-9_-]/g, '_');
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const dataDirectory = path.join(root, '.test-data', `${label}-${runId}`);
const artifactsDirectory = path.join(root, 'artifacts');
const exportsDirectory = path.join(dataDirectory, 'exports');
const reportPath = path.join(artifactsDirectory, label === 'desktop' ? 'desktop-test-report.json' : `desktop-test-${label}-report.json`);
if (executablePath) await fs.access(executablePath);
else await fs.access(path.join(root, 'dist', 'index.html')).catch(() => { throw new Error('Build the production app with npm run build before running desktop tests.'); });
await fs.mkdir(exportsDirectory, { recursive: true });
await fs.mkdir(artifactsDirectory, { recursive: true });
const environment = { ...process.env, ACADEMY_DATA_DIR: dataDirectory };
delete environment.ELECTRON_RUN_AS_NODE;
delete environment.ACADEMY_DEV_URL;
const report = { started: new Date().toISOString(), label, executablePath: executablePath ?? 'development Electron shell with production dist', dataDirectory, checks: [], consoleErrors: [], expectedEditorCancellations: [], externalRendererRequests: [], screenshots: [], limitations: [executablePath ? 'This test exercises the supplied application executable; installer invocation is recorded separately.' : 'Installer installation is a separate acceptance step.', 'Resource exports are validated locally; actual gameplay requires a local FiveM server.'] };
const consoleTasks = [];
let application;
let page;

function passed(description) { report.checks.push(description); console.log(`PASS ${description}`); }
async function launch() {
  // Use a relative app argument: Playwright's Windows shell launcher quotes
  // arguments without escaping a trailing directory backslash.
  application = await electron.launch({ ...(executablePath ? { executablePath, args: [] } : { args: ['.'] }), cwd: root, env: environment, timeout: 30000 });
  application.context().on('request', request => {
    if (/^https?:\/\//i.test(request.url())) report.externalRendererRequests.push({ url: request.url(), method: request.method() });
  });
  page = await application.firstWindow();
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => {
    if (error.name === 'Canceled' && error.message === 'Canceled') report.expectedEditorCancellations.push({ message: error.message, stack: error.stack });
    else report.consoleErrors.push(error.stack ?? error.message);
  });
  page.on('console', message => {
    if (message.type() !== 'error') return;
    consoleTasks.push((async () => {
      const details = await Promise.all(message.args().map(argument => argument.evaluate(value => ({ name: value?.name, message: value?.message, stack: value?.stack })).catch(() => ({}))));
      // Monaco's documented CancellationError has both name and message
      // 'Canceled'; disposing a model can cancel pending language work.
      // Record only that exact expected condition separately. Other errors fail.
      if (details.some(detail => detail.name === 'Canceled' && detail.message === 'Canceled')) report.expectedEditorCancellations.push({ message: message.text(), location: message.location(), details });
      else report.consoleErrors.push(message.text());
    })());
  });
  await page.waitForSelector('.app-shell');
  assert.equal(page.url(), 'app://academy/index.html');
}
async function saved(predicate, argument) {
  await page.waitForFunction(async ({ predicateText, argument }) => {
    const state = await window.academy.load();
    // The comparison itself is passed as data below, not executed with eval:
    if (predicateText === 'code') return state?.progress[argument.id]?.code === argument.code;
    if (predicateText === 'completed') return state?.progress['lua-first-program']?.completed === true;
    if (predicateText === 'project') return state?.projects.some(project => project.name === argument);
    return false;
  }, { predicateText: predicate, argument });
}
async function setEditor(code, lessonId = 'lua-first-program') {
  const input = page.locator('.monaco-editor textarea.inputarea').first();
  await input.waitFor({ state: 'attached' });
  await input.focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(code);
  await saved('code', { id: lessonId, code });
}
async function screenshot(name) {
  const target = path.join(artifactsDirectory, label === 'desktop' ? name : name.replace('academy-', `academy-${label}-`));
  await page.screenshot({ path: target, fullPage: true });
  report.screenshots.push(target);
}
try {
  await launch();
  await page.getByRole('button', { name: 'Start learning', exact: true }).click();
  await page.getByRole('heading', { name: 'Your first instruction', exact: true }).waitFor();
  passed('Fresh desktop launch opens Lesson 1 without an account or API key.');
  await page.getByRole('button', { name: 'Open exercise', exact: true }).click();
  // Use an error Monaco cannot repair through bracket auto-closing.
  await setEditor('local = 1');
  await page.getByRole('button', { name: 'Run checks', exact: true }).click();
  await page.getByText('A useful clue for your next change.', { exact: true }).waitFor();
  assert.match(await page.locator('.check-results').innerText(), /REVIEW/);
  passed('Monaco accepts typed Lua and the real worker reports invalid Lua syntax.');

  await setEditor('print("Still learning")');
  await page.getByRole('button', { name: 'Run checks', exact: true }).click();
  await page.getByText('A useful clue for your next change.', { exact: true }).waitFor();
  await page.locator('.console-output').filter({ hasText: 'Still learning' }).waitFor();
  assert.match(await page.locator('.check-results').innerText(), /Print Hello, FiveM!/);
  passed('Valid syntax with incorrect behavior fails the greeting assertion and shows actual output.');

  await setEditor('print("Hello, FiveM!")');
  await page.getByRole('button', { name: 'Run checks', exact: true }).click();
  await page.getByText('Your code passed these checks.', { exact: true }).waitFor();
  assert.match(await page.locator('.console-output').innerText(), /Hello, FiveM!/);
  passed('Correct typed Lua passes behavioral checks in the bundled offline Lua 5.4 runtime.');
  await screenshot('academy-lesson.png');

  await page.getByRole('button', { name: 'Check understanding', exact: true }).click();
  await page.getByRole('radio', { name: 'B Writes Ready to the output', exact: true }).click();
  await page.getByRole('button', { name: 'Check answer', exact: true }).click();
  await page.getByText('You’ve got the idea.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Review lesson', exact: true }).click();
  await page.getByRole('button', { name: 'Finish lesson & continue', exact: true }).click();
  await saved('completed');
  const beforeClose = await page.evaluate(() => window.academy.load());
  assert.equal(beforeClose.progress['lua-first-program'].code, 'print("Hello, FiveM!")');
  assert.equal(beforeClose.progress['lua-first-program'].quizCorrect, true);
  passed('Lesson completion requires code and quiz success and persists to SQLite.');

  await application.close();
  application = undefined;
  await launch();
  assert.equal(await page.locator('.welcome').count(), 0);
  const reopened = await page.evaluate(() => window.academy.load());
  assert.equal(reopened.progress['lua-first-program'].completed, true);
  assert.equal(reopened.progress['lua-first-program'].code, 'print("Hello, FiveM!")');
  assert.equal(reopened.progress['lua-first-program'].quizCorrect, true);
  await screenshot('academy-dashboard.png');
  passed('Closing and reopening the desktop app preserves code, quiz results, and completed progress.');

  await page.getByRole('button', { name: 'Playground', exact: true }).click();
  await page.getByRole('button', { name: 'New resource', exact: true }).click();
  await page.getByRole('textbox', { name: 'New resource name', exact: true }).fill('acceptance_command');
  await page.getByRole('combobox', { name: 'Resource template', exact: true }).selectOption('command');
  await page.getByRole('button', { name: 'Create workspace', exact: true }).click();
  await saved('project', 'acceptance_command');
  await page.getByRole('button', { name: 'Check resource', exact: true }).click();
  await page.getByText('Automated checks passed — ready to export for local testing.', { exact: true }).waitFor();
  passed('A real multi-file chat-command project is created, saved, and checked.');

  // Only replace the native folder picker. Export buttons still exercise real
  // renderer validation, preload IPC, backend validation and filesystem writes.
  await application.evaluate(({ dialog }, directory) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [directory] });
  }, exportsDirectory);
  await page.getByRole('button', { name: 'Export folder', exact: true }).click();
  await page.getByRole('heading', { name: 'From your editor to your development server', exact: true }).waitFor();
  const folder = path.join(exportsDirectory, 'acceptance_command');
  const manifest = await fs.readFile(path.join(folder, 'fxmanifest.lua'), 'utf8');
  const client = await fs.readFile(path.join(folder, 'client.lua'), 'utf8');
  assert.match(manifest, /fx_version ['"]cerulean['"]/);
  assert.match(manifest, /client_script ['"]client\.lua['"]/);
  assert.match(client, /RegisterCommand\('hello'/);
  passed('Export folder writes a standard resource with fxmanifest.lua and its declared script.');

  await page.getByRole('button', { name: 'Export ZIP', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.toast')?.textContent?.includes('.zip'));
  const zipName = (await fs.readdir(exportsDirectory)).find(name => name.endsWith('.zip'));
  assert.ok(zipName, 'The ZIP export was not written.');
  const zip = unzipSync(await fs.readFile(path.join(exportsDirectory, zipName)));
  assert.equal(strFromU8(zip['acceptance_command/fxmanifest.lua']), manifest);
  assert.equal(strFromU8(zip['acceptance_command/client.lua']), client);
  assert.match(await page.locator('.testing-guide').innerText(), /ensure acceptance_command/);
  passed('ZIP export contains matching resource files and the app provides local FiveM testing instructions.');
  await screenshot('academy-playground.png');

  await page.getByRole('button', { name: 'Settings & backups', exact: true }).click();
  await page.getByLabel('Learning track').selectOption('Intermediate');
  await page.waitForFunction(async () => (await window.academy.load())?.currentLesson === 'resource-anatomy');
  await page.getByLabel('Explanation depth').selectOption('Technical');
  await page.waitForFunction(async () => { const state = await window.academy.load(); return state?.track === 'Intermediate' && state?.depth === 'Technical'; });
  const backupPath = path.join(exportsDirectory, 'acceptance-progress.json');
  await application.evaluate(({ dialog }, target) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: target }); }, backupPath);
  await page.getByRole('button', { name: 'Export backup', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.toast')?.textContent?.includes('Progress backup saved:'));
  const backup = JSON.parse(await fs.readFile(backupPath, 'utf8'));
  assert.equal(backup.track, 'Intermediate');
  assert.equal(backup.progress['lua-first-program'].completed, true);
  assert.ok(backup.projects.some(project => project.name === 'acceptance_command'));
  await page.getByLabel('Learning track').selectOption('Advanced');
  await page.waitForFunction(async () => (await window.academy.load())?.track === 'Advanced');
  await application.evaluate(({ dialog }, target) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [target] });
    dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
  }, backupPath);
  await page.getByRole('button', { name: 'Import backup', exact: true }).click();
  await page.waitForFunction(async () => (await window.academy.load())?.track === 'Intermediate');
  assert.equal(await page.getByLabel('Learning track').inputValue(), 'Intermediate');
  assert.equal(await page.getByLabel('Explanation depth').inputValue(), 'Technical');
  assert.ok((await fs.readdir(path.join(dataDirectory, 'backups'))).some(name => name.endsWith('.sqlite')));
  passed('Settings persist; real backup export/import restores code, projects and preferences after creating a SQLite recovery copy.');

  await page.getByRole('button', { name: 'Reference library', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search reference library', exact: true }).fill('RegisterNetEvent');
  assert.ok(await page.locator('.reference-card').count() > 0);
  await page.getByRole('button', { name: 'Common errors', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search reference library', exact: true }).fill('nil value');
  await page.getByRole('heading', { name: 'attempt to index a nil value', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Source registry', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search reference library', exact: true }).fill('Lua 5.4');
  assert.ok(await page.locator('.source-card').count() > 0);
  assert.match(await page.locator('.source-card').first().innerText(), /Retrieved/);
  passed('Offline reference search finds function names, error explanations and dated official sources.');

  await page.getByRole('button', { name: /Learning path/ }).click();
  await page.locator('.lesson-list button').filter({ hasText: 'Set up a private development workspace' }).click();
  await page.getByRole('heading', { name: 'Set up a private development workspace', exact: true }).waitFor();
  await setEditor('ensure chat\nensure academy_greeting', 'resource-workspace');
  await page.getByRole('button', { name: 'Run checks', exact: true }).click();
  await page.getByText('Your code passed these checks.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByRole('button', { name: 'Reset exercise', exact: true }).click();
  await saved('code', { id: 'resource-workspace', code: '# Private development startup fragment\n' });
  const resetState = await page.evaluate(() => window.academy.load());
  assert.equal(resetState.progress['resource-workspace'].exercisePassed, false);
  assert.equal(resetState.progress['lua-first-program'].completed, true);
  assert.equal(await page.locator('.error-banner').count(), 0);
  passed('A server.cfg exercise saves, evaluates as configuration, and resets safely without losing another lesson.');

  await page.getByRole('button', { name: /Learning path/ }).click();
  await page.locator('.lesson-list button').filter({ hasText: 'Project: a working chat command' }).click();
  const lessonTabs = page.locator('.file-tabs');
  await lessonTabs.getByRole('button', {name:/fxmanifest\.lua/}).click();
  const manifestInput = page.locator('.monaco-editor textarea.inputarea').first();
  await manifestInput.focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText('local = 1');
  await page.locator('.monaco-editor .squiggly-error').first().waitFor({state:'visible'});
  await lessonTabs.getByRole('button', {name:/client\.lua/}).click();
  await page.waitForFunction(() => !document.querySelector('.monaco-editor .squiggly-error'));
  await lessonTabs.getByRole('button', {name:/fxmanifest\.lua/}).click();
  const customManifest = [
    "fx_version 'cerulean'", "game 'gta5'", "client_script 'client.lua'",
    "dependency 'chat'", '-- My custom resource settings',
  ].join('\n');
  await manifestInput.focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(customManifest);
  await page.waitForFunction(async manifest =>
    (await window.academy.load()).progress['resource-first-command']?.files['fxmanifest.lua'] === manifest,
    customManifest);
  await page.waitForFunction(() => !document.querySelector('.monaco-editor .squiggly-error'));
  await lessonTabs.getByRole('button', {name:/client\.lua/}).click();
  const learnedCommand = 'RegisterCommand("academyhello", function(source, args)\n  local name = args[1] or "learner"\n  TriggerEvent("chat:addMessage", { args = { "Academy", "Hello, " .. name } })\nend, false)';
  await setEditor(learnedCommand, 'resource-first-command');
  await page.getByRole('button', { name: 'Run checks', exact: true }).click();
  await page.getByText('Your code passed these checks.', { exact: true }).waitFor();
  const evaluatedCommand = await page.evaluate(async () => (await window.academy.load()).progress['resource-first-command'].code);
  await page.getByRole('button',{name:'Reveal solution',exact:true}).click();
  await page.locator('.monaco-diff-editor').waitFor({state:'visible'});
  assert.equal(await page.getByRole('button',{name:'Format file',exact:true}).count(), 0);
  await page.getByRole('button',{name:'Back to exercise',exact:true}).click();
  const compared = await page.evaluate(async () => (await window.academy.load()).progress['resource-first-command']);
  assert.equal(compared.files['fxmanifest.lua'], customManifest);
  assert.equal(compared.code, evaluatedCommand);
  assert.equal(compared.exercisePassed, true);
  passed('Syntax markers follow the active file, and comparing a solution preserves edited companion files and the passing grade.');
  assert.equal(evaluatedCommand.replace(/\s+/g, ' '), learnedCommand.replace(/\s+/g, ' '), 'Typing changed more than editor indentation.');
  await page.getByRole('button', { name: 'Open resource in playground', exact: true }).click();
  await page.locator('.playground-toolbar').waitFor();
  await page.waitForFunction(async code => (await window.academy.load())?.projects.some(project => project.files['client.lua'] === code), evaluatedCommand);
  const learnerProject = await page.evaluate(async code => (await window.academy.load())?.projects.find(project => project.files['client.lua'] === code), evaluatedCommand);
  assert.ok(learnerProject, 'The learner’s edited lesson files were not copied to the playground.');
  await application.evaluate(({ dialog }, directory) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [directory] }); }, exportsDirectory);
  await page.getByRole('button', { name: 'Export folder', exact: true }).click();
  await page.getByRole('heading', { name: 'From your editor to your development server', exact: true }).waitFor();
  assert.equal(await fs.readFile(path.join(exportsDirectory, learnerProject.name, 'client.lua'), 'utf8'), evaluatedCommand);
  assert.equal(await fs.readFile(path.join(exportsDirectory, learnerProject.name, 'fxmanifest.lua'), 'utf8'), customManifest);
  passed('The learner’s own chat-command solution passes mock behavior checks, transfers to the playground, and exports unchanged.');
  // Hold an autosave acknowledgement open so the final edit is still dirty
  // when the native window receives Close. Reopening reads the real SQLite DB.
  await page.getByRole('button', {name: 'Settings & backups', exact: true}).click();
  await application.evaluate(({ipcMain}) => {
    ipcMain.removeHandler('academy:save');
    ipcMain.handle('academy:save', () => new Promise(() => {}));
  });
  await page.getByLabel('Explanation depth').selectOption('Simple');
  await page.locator('.app-footer').getByText('Saving…').waitFor();
  const closed = application.waitForEvent('close');
  await application.evaluate(({BrowserWindow}) => { setImmediate(() => BrowserWindow.getAllWindows()[0].close()); });
  await closed;
  application = undefined;
  await launch();
  assert.equal(await page.evaluate(async () => (await window.academy.load()).depth), 'Simple');
  passed('Closing a dirty window commits the final edit even with an outstanding autosave.');
  await Promise.all(consoleTasks);
  assert.deepEqual(report.consoleErrors, [], 'Unexpected renderer errors occurred; inspect the report.');
  assert.deepEqual(report.externalRendererRequests, [], 'Core learning made an HTTP/HTTPS renderer request; bundled assets should work offline.');
  passed('Core learning, editing, execution, reference search and exports use bundled assets with no HTTP/HTTPS renderer request.');
  report.finished = new Date().toISOString();
  report.status = 'passed';
  console.log(`Desktop acceptance passed. Evidence: ${reportPath}`);
} catch (error) {
  report.status = 'failed';
  report.error = error.stack ?? String(error);
  if (page && !page.isClosed()) await screenshot('academy-test-failure.png').catch(() => {});
  console.error(report.error);
  process.exitCode = 1;
} finally {
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  if (application) await application.close().catch(() => {});
}
