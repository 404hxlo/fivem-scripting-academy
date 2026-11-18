const MAX_STATE_BYTES = 24 * 1024 * 1024;
const MAX_BACKUP_BYTES = 2 * MAX_STATE_BYTES;
const encoder = new TextEncoder();
const byteLength = value => encoder.encode(value).byteLength;
const MAX_FILE_BYTES = 256 * 1024;
const SOURCE_HOSTS = new Set(['docs.fivem.net', 'www.lua.org', 'lua.org', 'docs.qbcore.org', 'qbcore.org', 'docs.esx-framework.org', 'overextended.dev', 'coxdocs.dev', 'developer.mozilla.org', 'git-scm.com', 'code.visualstudio.com', 'github.com']);
const EXTERNAL_HOSTS = new Set([...SOURCE_HOSTS, 'github.com', 'www.electronjs.org', 'nodejs.org']);
const fail = message => { throw new Error(message); };
function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${name} must be an object.`);
  return value;
}
function string(value, name, max = 2000) {
  if (typeof value !== 'string' || value.length > max || value.includes('\0')) fail(`${name} must be text of at most ${max} characters.`);
  return value;
}
function boolean(value, name) { if (typeof value !== 'boolean') fail(`${name} must be true or false.`); return value; }
function integer(value, name, max = 1e9) { if (!Number.isSafeInteger(value) || value < 0 || value > max) fail(`${name} is outside its allowed range.`); return value; }
function array(value, name, max) { if (!Array.isArray(value) || value.length > max) fail(`${name} must be a list of at most ${max} entries.`); return value; }
function oneOf(value, values, name) { if (!values.includes(value)) fail(`${name} is not supported.`); return value; }
function date(value, name) { string(value, name, 60); if (!Number.isFinite(Date.parse(value))) fail(`${name} is not a valid date.`); return value; }
function id(value, name) { string(value, name, 120); if (!/^[a-zA-Z0-9_.:-]{1,120}$/.test(value) || ['__proto__', 'constructor', 'prototype'].includes(value)) fail(`${name} is invalid.`); return value; }
function safeName(value) {
  string(value, 'Resource name', 64);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(value) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(value)) fail('Use a resource name with letters, numbers, underscores or hyphens; Windows reserved names are not allowed.');
  return value;
}
function safeFilePath(value) {
  string(value, 'File path', 160);
  if (!value || value.includes('\\') || value.startsWith('/') || !/^[a-zA-Z0-9_./-]+$/.test(value)) fail('File paths must be relative and use forward slashes.');
  const parts = value.split('/');
  if (parts.some(part => !part || part === '.' || part === '..' || part.endsWith('.') || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) fail('File path contains an unsafe or reserved name.');
  if (!/\.(lua|html|css|js|json|md|txt|sql|cfg|yml|yaml)$/i.test(value) && value !== '.gitignore') fail('Unsupported project file extension.');
  return value;
}
function files(value, allowEmpty = false) {
  object(value, 'Project files');
  const entries = Object.entries(value);
  if ((!entries.length && !allowEmpty) || entries.length > 150) fail('Projects need between 1 and 150 files.');
  let total = 0;
  const result = {};
  const seen = new Set();
  for (const [file, content] of entries) {
    safeFilePath(file);
    const lower = file.toLowerCase();
    if (seen.has(lower)) fail('File names must be unique on Windows, ignoring case.');
    seen.add(lower);
    string(content, `Content of ${file}`, MAX_FILE_BYTES);
    total += byteLength(content);
    if (byteLength(content) > MAX_FILE_BYTES || total > 2 * 1024 * 1024) fail('Project files exceed the size limit.');
    result[file] = content;
  }
  for (const file of seen) if ([...seen].some(other => other !== file && other.startsWith(`${file}/`))) fail('A file cannot also be used as a directory.');
  return result;
}
function validateProject(input) {
  const p = object(input, 'Project');
  const result = { id: id(p.id, 'Project ID'), name: safeName(p.name), template: string(p.template, 'Template', 120), files: files(p.files), updated: date(p.updated, 'Project date'), history: array(p.history, 'Project history', 30).map(entry => ({ date: date(object(entry, 'History').date, 'History date'), files: files(entry.files) })) };
  if (p.briefId !== undefined) result.briefId = id(p.briefId, 'Project brief');
  if (p.checkpoints !== undefined) result.checkpoints = array(p.checkpoints, 'Checkpoints', 100).map(n => integer(n, 'Checkpoint', 100));
  return result;
}
function validateUrl(input, hosts = SOURCE_HOSTS) {
  string(input, 'Source URL', 2000);
  let url;
  try { url = new URL(input); } catch { fail('Enter a complete HTTPS documentation URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !hosts.has(url.hostname)) fail('Only HTTPS links on the supported documentation sites are permitted.');
  return url.href;
}
function validateState(input) {
  const s = object(input, 'Progress backup');
  if (s.version !== 1) fail('This backup version is not supported.');
  if (byteLength(JSON.stringify(input)) > MAX_STATE_BYTES) fail('Progress backup exceeds the 24 MB limit.');
  const progress = {};
  const entries = Object.entries(object(s.progress, 'Lesson progress'));
  if (entries.length > 2000) fail('Too many lesson progress records.');
  for (const [key, entry] of entries) {
    id(key, 'Lesson ID');
    const p = object(entry, 'Lesson progress');
    const copy = { code: string(p.code, 'Exercise code', MAX_FILE_BYTES), exercisePassed: boolean(p.exercisePassed, 'Exercise result'), completed: boolean(p.completed, 'Completion'), hints: integer(p.hints, 'Hints', 3), attempts: integer(p.attempts, 'Attempts'), updated: date(p.updated, 'Progress date') };
    if (p.files !== undefined) copy.files = files(p.files, true);
    if (p.quizAnswer !== undefined) copy.quizAnswer = integer(p.quizAnswer, 'Quiz answer', 20);
    if (p.quizCorrect !== undefined) copy.quizCorrect = boolean(p.quizCorrect, 'Quiz result');
    progress[key] = copy;
  }
  const overrides = {};
  const sourceEntries = Object.entries(object(s.sourceOverrides, 'Source overrides'));
  if (sourceEntries.length > 500) fail('Too many source overrides.');
  for (const [key, value] of sourceEntries) {
    id(key, 'Source ID'); object(value, 'Source override');
    overrides[key] = { url: validateUrl(value.url) };
    if (value.checked !== undefined) overrides[key].checked = date(value.checked, 'Source check date');
    if (value.status !== undefined) overrides[key].status = string(value.status, 'Source status', 500);
  }
  const projects = array(s.projects, 'Projects', 100).map(validateProject);
  if (new Set(projects.map(p => p.id)).size !== projects.length) fail('Project IDs must be unique.');
  const studyDays = array(s.studyDays, 'Study days', 15000).map(day => {
    if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day))) fail('Invalid study day.');
    return day;
  });
  return { version: 1, onboarded: boolean(s.onboarded, 'Welcome setting'), track: oneOf(s.track, ['Beginner','Intermediate','Advanced'], 'Track'), depth: oneOf(s.depth, ['Simple','Detailed','Technical'], 'Explanation depth'), currentLesson: s.currentLesson === '' ? '' : id(s.currentLesson, 'Current lesson'), progress, projects, studySeconds: integer(s.studySeconds, 'Study time'), studyDays: [...new Set(studyDays)], sourceOverrides: overrides, serverPath: string(s.serverPath, 'Server path', 1024) };
}

function parseBackup(text) {
  if (typeof text !== 'string' || byteLength(text) > MAX_BACKUP_BYTES) fail('The backup file exceeds the 48 MB input limit.');
  let value;
  // Windows editors can write a UTF-8 BOM before an otherwise valid JSON file.
  const json = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  try { value = JSON.parse(json); } catch { fail('This is not a valid JSON progress backup.'); }
  return validateState(value);
}

/** Keep exports readable, while ensuring valid near-limit saves fit the portable file limit. */
function serializeBackup(input) {
  const state = validateState(input);
  const pretty = JSON.stringify(state, null, 2);
  return byteLength(pretty) <= MAX_STATE_BYTES ? pretty : JSON.stringify(state);
}

export {
  MAX_STATE_BYTES, MAX_BACKUP_BYTES, SOURCE_HOSTS, EXTERNAL_HOSTS,
  validateState, validateProject, safeFilePath, safeName, validateUrl,
  parseBackup, serializeBackup,
};
