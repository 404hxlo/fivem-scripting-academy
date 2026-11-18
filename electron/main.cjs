'use strict';
const { app, BrowserWindow, Menu, protocol, session, ipcMain, dialog, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { AcademyStore, validateState, validateResource, validateUrl, writeResourceFolder, resourceZip, parseBackup, serializeBackup, EXTERNAL_HOSTS, MAX_BACKUP_BYTES } = require('./backend.cjs');

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
app.setName('FiveM Scripting Academy');
if (process.env.ACADEMY_DATA_DIR) app.setPath('userData', path.resolve(process.env.ACADEMY_DATA_DIR));
// A second window must not race the first window's whole-state autosaves.
// Independent test profiles still use their own userData directory and lock.
const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();
let window;
let store;
let startUrl = 'app://academy/index.html';
if (!app.isPackaged && process.env.ACADEMY_DEV_URL) {
  const dev = new URL(process.env.ACADEMY_DEV_URL);
  if (dev.protocol !== 'http:' || !['127.0.0.1','localhost'].includes(dev.hostname) || dev.username || dev.password) throw new Error('ACADEMY_DEV_URL must be a loopback HTTP Vite URL.');
  startUrl = dev.href;
}
const trustedUrl = url => { try { const actual = new URL(url); const expected = new URL(startUrl); return actual.protocol === expected.protocol && actual.host === expected.host; } catch { return false; } };
function checkSender(event) {
  if (!window || event.sender.id !== window.webContents.id || !event.senderFrame || event.senderFrame.parent || !trustedUrl(event.senderFrame.url)) throw new Error('This request is not from the Academy window.');
}
function register(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    checkSender(event);
    return handler(...args);
  });
}
const fileTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
const csp = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-src 'none'; form-action 'none'";

async function refreshSource(input) {
  let url = validateUrl(input);
  const checked = new Date().toISOString();
  try {
    for (let redirect = 0; redirect < 5; redirect++) {
      const response = await fetch(url, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'FiveM-Scripting-Academy/1.0 Source-Link-Check' } });
      if ([301,302,303,307,308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) return { status: `HTTP ${response.status}: redirect has no destination`, checked };
        url = validateUrl(new URL(location, url).href);
        continue;
      }
      return { status: (response.ok ? `Available (HTTP ${response.status})${url !== input ? `; redirects to ${url}` : ''}` : `HTTP ${response.status}; bundled lesson remains available`).slice(0,500), checked };
    }
    return { status: 'Too many redirects; bundled lesson remains available', checked };
  } catch (error) { return { status: `Could not check link: ${String(error.message).slice(0,240)}`, checked }; }
}
function installIPC() {
  register('academy:load', () => store.load());
  register('academy:save', state => { store.save(state); });
  // The renderer cannot await an outstanding autosave once its window closes.
  // Use a synchronous commit only for a dirty snapshot during teardown.
  ipcMain.on('academy:save-before-close', (event, state) => {
    try { checkSender(event); } catch { event.returnValue = false; return; }
    try {
      store.save(state);
      event.returnValue = true;
    } catch (error) {
      const choice = dialog.showMessageBoxSync(window, {
        type: 'error', title: 'Unsaved Academy changes',
        message: 'The latest changes could not be saved.',
        detail: error.message, buttons: ['Keep editing', 'Close without saving'],
        defaultId: 0, cancelId: 0,
      });
      event.returnValue = choice === 1;
    }
  });
  register('academy:export-resource', async (input, format) => {
    const project = validateResource(input);
    if (!['folder','zip'].includes(format)) throw new Error('Choose folder or ZIP export.');
    const result = await dialog.showOpenDialog(window, { title: format === 'folder' ? 'Choose a parent folder for the new resource' : 'Choose a folder for the ZIP export', properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled || !result.filePaths[0]) return null;
    if (format === 'folder') return writeResourceFolder(result.filePaths[0], project);
    const target = path.join(result.filePaths[0], `${project.name}-${Date.now()}-${crypto.randomUUID().slice(0,6)}.zip`);
    fs.writeFileSync(target, resourceZip(project), { flag: 'wx' });
    return target;
  });
  register('academy:export-backup', async input => {
    const state = validateState(input);
    const result = await dialog.showSaveDialog(window, { title: 'Export your Academy progress', defaultPath: `academy-progress-${new Date().toISOString().slice(0,10)}.json`, filters: [{ name: 'Academy progress backup', extensions: ['json'] }], properties: ['showOverwriteConfirmation', 'createDirectory'] });
    if (result.canceled || !result.filePath) return null;
    fs.writeFileSync(result.filePath, serializeBackup(state), 'utf8');
    return result.filePath;
  });
  register('academy:import-backup', async () => {
    const result = await dialog.showOpenDialog(window, { title: 'Import Academy progress (current data will be backed up)', properties: ['openFile'], filters: [{ name: 'Academy progress backup', extensions: ['json'] }] });
    if (result.canceled || !result.filePaths[0]) return null;
    if (fs.statSync(result.filePaths[0]).size > MAX_BACKUP_BYTES) throw new Error('Backup file exceeds the 48 MB import limit.');
    const state = parseBackup(fs.readFileSync(result.filePaths[0], 'utf8'));
    const confirm = await dialog.showMessageBox(window, { type: 'question', title: 'Replace Academy progress?', message: 'Import this progress backup?', detail: 'Your current SQLite database will first be copied into the Academy data backups folder. Import replaces course progress, settings, and playground projects.', buttons: ['Cancel', 'Import backup'], defaultId: 0, cancelId: 0 });
    if (confirm.response !== 1) return null;
    return store.import(state).state;
  });
  register('academy:open-external', async input => { await shell.openExternal(validateUrl(input, EXTERNAL_HOSTS)); });
  register('academy:open-vscode', async input => {
    const project = validateResource(input);
    const snapshot = path.join(app.getPath('userData'), 'vscode-snapshots', `${Date.now()}-${crypto.randomUUID().slice(0,8)}`);
    fs.mkdirSync(snapshot, { recursive: true });
    const destination = writeResourceFolder(snapshot, project);
    const normalized = destination.replace(/\\/g, '/');
    await shell.openExternal(`vscode://file/${normalized.split('/').map(segment => encodeURIComponent(segment)).join('/')}`);
    return destination;
  });
  register('academy:refresh-source', refreshSource);
  register('academy:choose-server', async () => {
    const result = await dialog.showOpenDialog(window, { title: 'Select an optional local development-server folder (read-only setting)', properties: ['openDirectory'] });
    return result.canceled ? null : result.filePaths[0] || null;
  });
}

async function createWindow() {
  window = new BrowserWindow({ width: 1480, height: 980, minWidth: 1000, minHeight: 680, backgroundColor: '#0d0e13', title: 'FiveM Scripting Academy', icon: path.join(__dirname, '..', 'build', 'icon.png'), show: false, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, allowRunningInsecureContent: false, spellcheck: false } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (!trustedUrl(url)) event.preventDefault(); });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.once('ready-to-show', () => window.show());
  await window.loadURL(startUrl);
}
if (singleInstance) app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  const dist = path.resolve(__dirname, '..', 'dist');
  protocol.handle('app', async request => {
    try {
      const url = new URL(request.url);
      if (url.hostname !== 'academy' || request.method !== 'GET') return new Response('Forbidden', { status: 403 });
      const pathname = decodeURIComponent(url.pathname);
      const filename = path.resolve(dist, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!filename.startsWith(dist + path.sep) || pathname.includes('\\')) return new Response('Forbidden', { status: 403 });
      return new Response(fs.readFileSync(filename), { headers: { 'Content-Type': fileTypes[path.extname(filename)] || 'application/octet-stream', 'Content-Security-Policy': csp, 'X-Content-Type-Options': 'nosniff' } });
    } catch { return new Response('Bundled file not found', { status: 404 }); }
  });
  store = new AcademyStore(path.join(app.getPath('userData'), 'academy.sqlite'));
  installIPC();
  await createWindow();
}).catch(error => { dialog.showErrorBox('Academy could not start', error.message); app.quit(); });
app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } });
app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => { if (store) { store.close(); store = null; } });
