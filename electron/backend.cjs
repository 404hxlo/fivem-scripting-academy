'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { zipSync, strToU8 } = require('fflate');

const {
  validateState, validateProject, safeFilePath, safeName, validateUrl,
  parseBackup, serializeBackup, SOURCE_HOSTS, EXTERNAL_HOSTS, MAX_STATE_BYTES, MAX_BACKUP_BYTES,
} = require('./academy-state.mjs');
const fail = message => { throw new Error(message); };
class AcademyStore {
  constructor(filename) {
    this.filename = filename;
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename, { enableForeignKeyConstraints: true, allowExtension: false });
    this.db.exec('PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS academy_state (id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL, payload TEXT NOT NULL, updated TEXT NOT NULL); CREATE TABLE IF NOT EXISTS recovery_snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT NOT NULL, created TEXT NOT NULL);');
  }
  load() {
    const row = this.db.prepare('SELECT payload FROM academy_state WHERE id=1').get();
    if (!row) return null;
    try { return validateState(JSON.parse(row.payload)); } catch (error) { fail(`Saved progress could not be read. Your database has been preserved at ${this.filename}. ${error.message}`); }
  }
  save(input) {
    const state = validateState(input);
    const payload = JSON.stringify(state);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const old = this.db.prepare('SELECT payload FROM academy_state WHERE id=1').get();
      if (old && old.payload !== payload) this.db.prepare('INSERT INTO recovery_snapshots (payload, created) VALUES (?,?)').run(old.payload, new Date().toISOString());
      this.db.prepare('INSERT INTO academy_state (id, version, payload, updated) VALUES (1,1,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, updated=excluded.updated').run(payload, new Date().toISOString());
      this.db.exec('DELETE FROM recovery_snapshots WHERE id NOT IN (SELECT id FROM recovery_snapshots ORDER BY id DESC LIMIT 5); COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return state;
  }
  import(input) {
    const state = validateState(input);
    const backupDir = path.join(path.dirname(this.filename), 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, `before-import-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID().slice(0,8)}.sqlite`);
    fs.copyFileSync(this.filename, backupPath, fs.constants.COPYFILE_EXCL);
    this.save(state);
    return { state, backupPath };
  }
  close() { this.db.close(); }
}

function validateResource(input) {
  const project = validateProject(input);
  const manifest = project.files['fxmanifest.lua'];
  if (!manifest) fail('The resource needs an fxmanifest.lua file.');
  const declarations = manifestHeaders(manifest);
  if (!declarations.fx_version.includes('cerulean') || ![...declarations.game, ...declarations.games].includes('gta5')) fail("Manifest must declare fx_version 'cerulean' and game 'gta5' (or games containing gta5).");
  return project;
}
// Read header literals without mistaking comments or description text for
// declarations. This mirrors the frontend's declarative-manifest reader.
function manifestHeaders(source) {
  const tokens = [];
  let i = 0;
  while (i < source.length) {
    if (/\s/.test(source[i])) { i++; continue; }
    if (source.startsWith('--', i)) {
      const long = source.slice(i + 2).match(/^\[(=*)\[/);
      if (long) { const end = source.indexOf(`]${long[1]}]`, i + 2 + long[0].length); i = end < 0 ? source.length : end + long[1].length + 2; }
      else { const end = source.indexOf('\n', i + 2); i = end < 0 ? source.length : end + 1; }
      continue;
    }
    if (source[i] === '"' || source[i] === "'") {
      const quote = source[i++]; let value = '';
      while (i < source.length && source[i] !== quote) { if (source[i] === '\\') { i++; const escaped = source[i++]; value += ({ n: '\n', r: '\r', t: '\t' })[escaped] ?? escaped; } else value += source[i++]; }
      i++; tokens.push({ kind: 'string', value }); continue;
    }
    const long = source.slice(i).match(/^\[(=*)\[/);
    if (long) { const start = i + long[0].length; const end = source.indexOf(`]${long[1]}]`, start); tokens.push({ kind: 'string', value: source.slice(start, end < 0 ? source.length : end) }); i = end < 0 ? source.length : end + long[1].length + 2; continue; }
    const word = source.slice(i).match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
    if (word) { tokens.push({ kind: 'word', value: word[0] }); i += word[0].length; continue; }
    tokens.push({ kind: 'symbol', value: source[i++] });
  }
  const values = { fx_version: [], game: [], games: [] };
  if (tokens.some(token => token.kind === 'word' && ['if','for','while','function','repeat','local'].includes(token.value))) fail('Use a declarative manifest with literal entries; conditional or computed manifests require manual review.');
  for (let i = 0; i < tokens.length; i++) {
    const current = tokens[i];
    if (current.kind !== 'word' || !Object.hasOwn(values, current.value)) continue;
    let j = i + 1;
    if (tokens[j]?.value === '(') j++;
    if (tokens[j]?.kind === 'string') {
      if (tokens[j+1]?.value === '.') fail('Use literal manifest values rather than computed expressions.');
      values[current.value].push(tokens[j].value);
    } else if (current.value === 'games' && tokens[j]?.value === '{') {
      j++;
      while (j < tokens.length && tokens[j].value !== '}') { if (tokens[j].kind === 'string') values.games.push(tokens[j].value); else if (![',',';'].includes(tokens[j].value)) fail('Use literal game names in the manifest.'); j++; }
    }
  }
  return values;
}
function writeResourceFolder(parent, input) {
  const project = validateResource(input);
  const parentReal = fs.realpathSync(parent);
  if (!fs.statSync(parentReal).isDirectory()) fail('Choose an export directory.');
  const destination = path.join(parentReal, project.name);
  if (fs.existsSync(destination)) fail(`Export cancelled: ${destination} already exists. Choose another folder or resource name. Existing resources are never overwritten.`);
  fs.mkdirSync(destination);
  try {
    for (const [file, content] of Object.entries(project.files)) {
      const target = path.resolve(destination, ...file.split('/'));
      if (!target.startsWith(destination + path.sep)) fail('Export path escaped the resource directory.');
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content, { encoding: 'utf8', flag: 'wx' });
    }
  } catch (error) {
    // Preserve partial output for diagnosis. Never delete a user-selected directory.
    fail(`Export did not finish. Partial files remain in ${destination}. ${error.message}`);
  }
  return destination;
}
function resourceZip(input) {
  const project = validateResource(input);
  const entries = {};
  for (const [file, content] of Object.entries(project.files)) entries[`${project.name}/${file}`] = strToU8(content);
  return zipSync(entries, { level: 6 });
}
module.exports = { AcademyStore, validateState, validateProject, validateResource, safeFilePath, safeName, validateUrl, writeResourceFolder, resourceZip, parseBackup, serializeBackup, SOURCE_HOSTS, EXTERNAL_HOSTS, MAX_STATE_BYTES, MAX_BACKUP_BYTES };
