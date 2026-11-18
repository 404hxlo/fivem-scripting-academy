import { strToU8, zipSync } from 'fflate';
import type { Project, RunResult } from '../types';
import { safeFileName } from './state';

export interface ResourceCheck { name: string; status: 'pass' | 'fail' | 'review'; detail: string; file?: string; line?: number }
export interface ResourceReview { valid: boolean; checks: ResourceCheck[]; dependencies: string[] }
type Token = { kind: 'word' | 'string' | 'symbol'; value: string };
export type SyntaxRunner = (code: string, options: { syntaxOnly: true }) => Promise<RunResult>;

export function validResourceName(name: string): boolean {
  return /^[a-z][a-z0-9_-]{1,47}$/.test(name) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name);
}
export const validResourcePath = safeFileName;
// A small lexical reader for declarative manifests. It never executes a manifest.
// Real Lua syntax is checked separately by the bundled Lua 5.4 compiler.
function tokens(source: string): Token[] {
  const result: Token[] = [];
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
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '\\') { i++; const escaped = source[i++]; value += ({ n: '\n', r: '\r', t: '\t' } as Record<string,string>)[escaped] ?? escaped; }
        else value += source[i++];
      }
      i++; result.push({ kind: 'string', value }); continue;
    }
    const long = source.slice(i).match(/^\[(=*)\[/);
    if (long) { const start = i + long[0].length; const end = source.indexOf(`]${long[1]}]`, start); result.push({ kind: 'string', value: source.slice(start, end < 0 ? source.length : end) }); i = end < 0 ? source.length : end + long[1].length + 2; continue; }
    const word = source.slice(i).match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
    if (word) { result.push({ kind: 'word', value: word[0] }); i += word[0].length; continue; }
    result.push({ kind: 'symbol', value: source[i++] });
  }
  return result;
}
function directives(source: string) {
  const list = tokens(source);
  const known = new Set(['fx_version','game','games','client_script','client_scripts','server_script','server_scripts','shared_script','shared_scripts','file','files','ui_page','dependency','dependencies','lua54']);
  const values: Record<string,string[]> = {};
  const dynamic = new Set<string>();
  if (list.some(token => token.kind === 'word' && ['if','for','while','function','repeat','local'].includes(token.value))) dynamic.add('conditional or computed manifest');
  for (let i = 0; i < list.length; i++) {
    const current = list[i];
    if (current.kind !== 'word' || !known.has(current.value)) continue;
    let j = i + 1;
    if (list[j]?.value === '(') j++;
    const collected: string[] = [];
    if (list[j]?.kind === 'string') {
      collected.push(list[j].value);
      if (list[j+1]?.value === '.') dynamic.add(current.value);
    } else if (list[j]?.value === '{') {
      if (!current.value.endsWith('s')) dynamic.add(current.value);
      j++;
      while (j < list.length && list[j].value !== '}') {
        if (list[j].kind === 'string') collected.push(list[j].value);
        else if (list[j].value !== ',' && list[j].value !== ';') dynamic.add(current.value);
        j++;
      }
    } else dynamic.add(current.value);
    values[current.value] = [...(values[current.value] ?? []), ...collected];
  }
  return { values, dynamic };
}
function globMatches(pattern: string, file: string) {
  let expression = '^';
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '*' && pattern[i+1] === '*') {
      if (pattern[i+2] === '/') { expression += '(?:.*/)?'; i += 2; }
      else { expression += '.*'; i++; }
    } else if (pattern[i] === '*') expression += '[^/]*';
    else if (pattern[i] === '?') expression += '[^/]';
    else expression += pattern[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(expression + '$').test(file);
}
function hasFile(pattern: string, names: string[]) { return names.some(file => globMatches(pattern, file)); }

// Read references from opening tags without constructing a live document.
// Loading an editor project for review must never execute scripts or fetch assets.
function readNuiLinks(html: string): { base?: string; links: string[] } {
  const markup = /<!--[\s\S]*?(?:-->|$)|<([a-z][\w:-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;
  const links: string[] = [];
  let base: string | undefined;
  let match: RegExpExecArray | null;
  while ((match = markup.exec(html))) {
    if (!match[1]) continue;
    const tag = match[1].toLowerCase();
    const attributes = new Map<string, string>();
    for (const attribute of match[2].matchAll(/([^\s=/>]+)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
      const key = attribute[1].toLowerCase();
      if (!attributes.has(key)) {
        const value = attribute[2] ?? attribute[3] ?? attribute[4] ?? '';
        attributes.set(key, value.trim().replace(/&amp;/gi, '&'));
      }
    }
    if (tag === 'base') base ??= attributes.get('href');
    const path = ['link','a','area'].includes(tag) ? attributes.get('href') : attributes.get('src');
    if (path && !path.startsWith('#')) links.push(path);
    if (['script','style','textarea','title'].includes(tag)) {
      const closing = new RegExp('</' + tag + '\\s*>', 'ig');
      closing.lastIndex = markup.lastIndex;
      markup.lastIndex = closing.exec(html) ? closing.lastIndex : html.length;
    }
  }
  return { base, links };
}

function reviewNuiLinks(project: Project, page: string, packaged: string[]): ResourceCheck[] {
  const html = project.files[page];
  if (!html || !validResourcePath(page) || !validResourceName(project.name)) return [];
  const { base, links } = readNuiLinks(html);
  const documentUrl = new URL(page, 'https://cfx-nui-' + project.name + '/');
  let baseUrl = documentUrl;
  try { if (base) baseUrl = new URL(base, documentUrl); } catch { /* Browsers ignore invalid base URLs. */ }
  const checks: ResourceCheck[] = [];
  for (const link of links) {
    let url: URL;
    try { url = new URL(link, baseUrl); }
    catch {
      checks.push({ name: 'NUI asset: ' + link, status: 'fail', detail: 'This URL cannot be resolved from the NUI page.', file: page });
      continue;
    }
    if (url.protocol === 'data:' || url.protocol === 'blob:') continue;
    if (url.origin !== documentUrl.origin) {
      checks.push({ name: 'External NUI reference', status: 'review', detail: 'Check this external reference during local testing: ' + link, file: page });
      continue;
    }
    let target: string;
    try { target = decodeURIComponent(url.pathname.slice(1)); }
    catch {
      checks.push({ name: 'NUI asset: ' + link, status: 'fail', detail: 'The URL contains an invalid percent escape.', file: page });
      continue;
    }
    const exists = Object.hasOwn(project.files, target) && packaged.some(pattern => globMatches(pattern, target));
    checks.push({ name: 'NUI asset: ' + link, status: exists ? 'pass' : 'fail', detail: 'Bundle ' + target + ' in your project and list it in manifest files.', file: page });
  }
  return checks;
}

export function inspectResource(project: Project): ResourceReview {
  const checks: ResourceCheck[] = [];
  const add = (name: string, good: boolean, detail: string, file?: string) => checks.push({ name, status: good ? 'pass' : 'fail', detail, file });
  add('Resource name', validResourceName(project.name), 'Use 2–48 lowercase letters, numbers, underscores or hyphens, starting with a letter. Reserved Windows names are not allowed.');
  const names = Object.keys(project.files);
  add('Safe file paths', names.length > 0 && names.length <= 150 && names.every(validResourcePath), 'Files must have safe relative names, supported text extensions, and no parent-directory segments.');
  add('Unique file names', new Set(names.map(n => n.toLowerCase())).size === names.length, 'File names must be unique even when uppercase and lowercase are treated as equal.');
  add('File and folder boundaries', !names.some(name => names.some(other => other.toLowerCase().startsWith(name.toLowerCase() + '/'))), 'A file cannot also be the parent directory of another file.');
  const bytes = names.reduce((total,name) => total + new TextEncoder().encode(project.files[name]).length, 0);
  add('Project size', bytes <= 2 * 1024 * 1024 && names.every(name => new TextEncoder().encode(project.files[name]).length <= 256 * 1024), 'Each file may be at most 256 KB and the resource at most 2 MB. Lua compilation has a 64 KB per-file limit.');
  const manifest = project.files['fxmanifest.lua'];
  add('Resource manifest', typeof manifest === 'string' && manifest.trim().length > 0, 'An fxmanifest.lua file is required at the root of the resource.', 'fxmanifest.lua');
  if (!manifest) return { valid: false, checks, dependencies: [] };
  const { values, dynamic } = directives(manifest);
  add('Current manifest version', values.fx_version?.includes('cerulean') === true, "Declare fx_version 'cerulean'.", 'fxmanifest.lua');
  add('GTA V target', [...(values.game ?? []), ...(values.games ?? [])].includes('gta5'), "Declare game 'gta5'.", 'fxmanifest.lua');
  const relevant = [...dynamic].filter(value => value !== 'lua54');
  add('Explicit manifest entries', relevant.length === 0, relevant.length ? `Cannot resolve dynamic ${relevant.join(', ')} entries. Use explicit strings or lists so the Academy can verify every exported file.` : 'All recognized manifest entries use literal strings or lists.', 'fxmanifest.lua');
  if (values.lua54) checks.push({ name: 'Lua version', status: 'review', detail: 'FiveM uses Lua 5.4 by default. The lua54 manifest flag is deprecated and can be removed.', file: 'fxmanifest.lua' });
  const dependencies = [...new Set([...(values.dependency ?? []), ...(values.dependencies ?? [])])];
  const refs = ['client_script','client_scripts','server_script','server_scripts','shared_script','shared_scripts','file','files','ui_page'].flatMap(key => (values[key] ?? []).map(file => ({ key, file })));
  add('At least one resource entry', refs.length > 0, 'Declare a client, server, shared script or packaged file in your manifest.', 'fxmanifest.lua');
  for (const {key, file} of refs) {
    if (file.startsWith('@')) {
      const external = file.slice(1).split('/')[0];
      add(`External resource: ${external}`, dependencies.includes(external), `The ${file} import requires dependency '${external}' and the matching resource installed on your test server.`, 'fxmanifest.lua');
    } else if (/^https:\/\//.test(file) && key === 'ui_page') {
      checks.push({ name: 'Remote NUI page', status: 'review', detail: 'This UI needs a network connection. Prefer bundled HTML for a self-contained resource.', file: 'fxmanifest.lua' });
    } else {
      const safe = !file.includes('\\') && !file.startsWith('/') && !file.split('/').includes('..') && !file.includes(':');
      add(`Manifest file: ${file}`, safe && hasFile(file, names), `The ${key} entry must match at least one project file with the same case.`, 'fxmanifest.lua');
    }
  }
  for (const page of values.ui_page ?? []) {
    if (/^https:\/\//.test(page)) continue;
    const packaged = [...(values.file ?? []), ...(values.files ?? [])];
    add('Packaged NUI page', packaged.some(pattern => globMatches(pattern,page)), 'The local ui_page must also be included in the files list.', 'fxmanifest.lua');
    checks.push(...reviewNuiLinks(project, page, packaged));
  }
  const joined = names.filter(n => n !== 'fxmanifest.lua').map(n => project.files[n]).join('\n');
  if (/RegisterNetEvent|RegisterNuiCallback|RegisterNUICallback/.test(joined)) checks.push({ name: 'Trust boundary review', status: 'review', detail: 'Review each client request on the server: caller, permissions, types, allowed values, distance, ownership, replay limits, and failure handling. Static checks cannot prove authorization is correct.' });
  if (/SetNuiFocus\s*\(\s*true/.test(joined)) checks.push({ name: 'Focus lifecycle', status: 'review', detail: 'Test closing with the UI button and Escape, callback completion, and focus release when the resource stops.' });
  if (/CreateVehicle|CreateObject|CreatePed/.test(joined)) checks.push({ name: 'Entity lifecycle', status: 'review', detail: 'Test failed model loads, repeated requests, ownership, player disconnect, and resource-stop cleanup in a local server.' });
  checks.push({ name: 'Live FiveM test', status: 'review', detail: 'These are syntax and structural checks. Natives, multiplayer behavior, HTML/CSS/JavaScript behavior, and framework integrations require a real local FiveM test.' });
  return { valid: checks.every(check => check.status !== 'fail'), checks, dependencies };
}
export async function reviewResource(project: Project, runner: SyntaxRunner): Promise<ResourceReview> {
  const result = inspectResource(project);
  for (const [file, code] of Object.entries(project.files)) {
    if (!/\.lua$/i.test(file)) continue;
    const check = await runner(code, { syntaxOnly: true });
    result.checks.push({ name: `Lua 5.4 syntax: ${file}`, status: check.ok ? 'pass' : 'fail', detail: check.ok ? 'Compiled successfully. No game code was executed.' : check.error ?? 'Lua syntax check failed.', file, line: check.line });
  }
  result.valid = result.checks.every(check => check.status !== 'fail');
  return result;
}
export function buildResourceZip(project: Project): Uint8Array {
  const result = inspectResource(project);
  if (!result.valid) throw new Error(result.checks.filter(check => check.status === 'fail').map(check => check.name + ': ' + check.detail).join('\n'));
  return zipSync(Object.fromEntries(Object.entries(project.files).map(([name,code]) => [`${project.name}/${name}`,strToU8(code)])), {level:6});
}
