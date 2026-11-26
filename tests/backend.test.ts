import { describe, it, expect, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import type { AcademyState, Project } from '../src/types';
import { lessons, sources } from '../src/content';
import { freshProgress, newState } from '../src/lib/state';
const require = createRequire(import.meta.url);
const { AcademyStore, validateState, validateProject, safeFilePath, safeName, validateUrl, writeResourceFolder, resourceZip, parseBackup, serializeBackup, MAX_STATE_BYTES } = require('../electron/backend.cjs');
const temporary: string[] = [];
function temp() { const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-test-')); temporary.push(directory); return directory; }
afterEach(() => { for (const directory of temporary.splice(0)) fs.rmSync(directory, { recursive: true, force: true }); });
const project = (): Project => ({ id: 'project-1', name: 'academy_greeting', template: 'standalone', files: { 'fxmanifest.lua': "fx_version 'cerulean'\ngame 'gta5'\nclient_script 'client.lua'", 'client.lua': "RegisterCommand('hello', function() print('hello') end, false)", 'html/index.html': '<!doctype html><p>Hello</p>' }, updated: '2026-11-18T12:00:00.000Z', history: [] });
const state = (): AcademyState => ({ version: 1, onboarded: true, track: 'Beginner', depth: 'Detailed', currentLesson: 'lua-first', progress: { 'lua-first': { code: 'print("hello")', exercisePassed: true, quizAnswer: 1, quizCorrect: true, completed: true, hints: 1, attempts: 2, updated: '2026-11-18T12:00:00.000Z' } }, projects: [project()], studySeconds: 65, studyDays: ['2026-11-18'], sourceOverrides: {}, serverPath: '' });

describe('SQLite progress persistence', () => {
  it('adds City Dispatch to an existing saved profile and restores the stamps and drafts from JSON', () => {
    const file = path.join(temp(), 'academy.sqlite');
    let store = new AcademyStore(file);
    const original = state();
    store.save(original);
    const next = {...store.load(), dispatch:{completed:['first-stop'], drafts:{'first-stop':"drive('east')", 'market-loop':'for i = 1, 2 do\nend'}}};
    store.save(next);
    store.close();
    store = new AcademyStore(file);
    try {
      expect(store.load()).toEqual(next);
      const backup = serializeBackup(store.load());
      store.save(original);
      store.import(parseBackup(backup));
      expect(store.load()).toEqual(next);
    } finally { store.close(); }
  });
  it('accepts the initial onboarding state before a lesson is chosen', () => {
    expect(validateState({ ...state(), currentLesson: '', onboarded: false }).currentLesson).toBe('');
  });
  it('persists every bundled lesson filename, independent scratch file, and source link', () => {
    const input = newState();
    for (const lesson of lessons) {
      const main = lesson.exercise.filename ?? 'exercise.lua';
      const scratch = main === '.gitignore' ? 'independent-challenge.txt' : `independent-challenge.${main.split('.').pop() ?? 'lua'}`;
      input.progress[lesson.id] = { ...freshProgress(lesson), files: { ...lesson.exercise.files, [main]:lesson.exercise.starter, [scratch]:'Independent practice' } };
    }
    for (const source of sources) input.sourceOverrides[source.id] = {url:source.url,checked:'2026-11-18T12:00:00.000Z',status:'Available (HTTP 200)'};
    const filename = path.join(temp(), 'academy.sqlite');
    let store = new AcademyStore(filename);
    store.save(input); store.close();
    store = new AcademyStore(filename);
    expect(store.load()).toEqual(input);
    store.close();
  });
  it('accepts reset lesson files as empty without permitting empty resource projects', () => {
    const input = state(); input.progress['lua-first'].files = {};
    expect(validateState(input).progress['lua-first'].files).toEqual({});
    expect(() => validateProject({...project(),files:{}})).toThrow('between 1');
  });
  it('persists the supported text and scratch-file formats', () => {
    const input = state();
    input.progress['lua-first'].files = Object.fromEntries(['lua','md','txt','html','css','js','json','sql','cfg','yml','yaml'].map(extension=>[`independent-challenge.${extension}`, 'Practice content']));
    expect(validateState(input).progress['lua-first'].files).toEqual(input.progress['lua-first'].files);
  });
  it('persists lesson results, code, projects and settings across closing and reopening', () => {
    const filename = path.join(temp(), 'academy.sqlite');
    let store = new AcademyStore(filename);
    expect(store.load()).toBeNull();
    store.save(state()); store.close();
    store = new AcademyStore(filename);
    expect(store.load()).toEqual(state());
    store.close();
  });
  it('backs up the previous database before import and preserves it after replacement', () => {
    const filename = path.join(temp(), 'academy.sqlite');
    const store = new AcademyStore(filename);
    store.save(state());
    const next = state(); next.track = 'Advanced'; next.progress = {};
    const imported = store.import(next);
    expect(store.load()).toEqual(next);
    const recovery = new AcademyStore(imported.backupPath);
    expect(recovery.load()).toEqual(state());
    recovery.close(); store.close();
  });
  it('rejects malformed imports without changing saved data', () => {
    const store = new AcademyStore(path.join(temp(), 'academy.sqlite'));
    store.save(state());
    expect(() => store.import({ ...state(), studySeconds: -1 })).toThrow();
    expect(store.load()).toEqual(state());
    expect(() => parseBackup('{bad json')).toThrow('valid JSON');
    expect(() => validateState({ ...state(), version: 42 })).toThrow('version');
    expect(() => validateState({ ...state(), progress: { broken: { code: 'x' } } })).toThrow();
    store.close();
  });
  it('can restore near-limit exports, including pretty-printed files created by older releases', () => {
    const input = state();
    const content = 'x'.repeat(256 * 1024);
    input.projects = Array.from({ length: 12 }, (_, index) => ({
      ...project(),
      id: `project-${index}`,
      name: `workspace_${index}`,
      files: Object.fromEntries(Array.from({ length: 8 }, (_, file) => [`notes${file}.txt`, content])),
    }));
    const last = input.projects[input.projects.length - 1];
    const excess = Buffer.byteLength(JSON.stringify(input)) - MAX_STATE_BYTES + 16;
    last.files['notes7.txt'] = content.slice(excess);
    const legacy = JSON.stringify(input, null, 2);
    expect(Buffer.byteLength(legacy)).toBeGreaterThan(MAX_STATE_BYTES);
    const restored = parseBackup(legacy);
    const portable = serializeBackup(restored);
    expect(Buffer.byteLength(portable)).toBeLessThanOrEqual(MAX_STATE_BYTES);
    expect(parseBackup(portable).projects.at(-1).files['notes7.txt']).toBe(last.files['notes7.txt']);
  });
});

describe('safe standard resource exports', () => {
  it('exports exact content with fxmanifest.lua and nested files', () => {
    const destination = writeResourceFolder(temp(), project());
    expect(path.basename(destination)).toBe('academy_greeting');
    for (const [file, content] of Object.entries(project().files)) expect(fs.readFileSync(path.join(destination, file), 'utf8')).toBe(content);
  });
  it('exports a ZIP whose entries match the resource folder', () => {
    const archive = unzipSync(resourceZip(project()));
    for (const [file, content] of Object.entries(project().files)) expect(strFromU8(archive[`academy_greeting/${file}`])).toBe(content);
    expect(Object.keys(archive)).toHaveLength(3);
  });
  it('never overwrites an existing resource', () => {
    const directory = temp();
    const destination = writeResourceFolder(directory, project());
    expect(() => writeResourceFolder(directory, project())).toThrow('already exists');
    expect(fs.readFileSync(path.join(destination, 'client.lua'), 'utf8')).toBe(project().files['client.lua']);
  });
  it.each(['../outside.lua', '/absolute.lua', 'C:/outside.lua', 'a\\outside.lua', 'con.lua', 'foo/../bar.lua', 'foo//bar.lua', 'run.exe', 'foo./bar.lua'])('rejects unsafe path %s', filename => {
    expect(() => safeFilePath(filename)).toThrow();
  });
  it.each(['../city', 'C:city', 'nul', 'com1', 'two names', 'a/b'])('rejects unsafe resource name %s', name => { expect(() => safeName(name)).toThrow(); });
  it('rejects case-colliding files and missing manifests', () => {
    expect(() => validateProject({ ...project(), files: { 'client.lua': '', 'Client.lua': '' } })).toThrow('unique');
    expect(() => resourceZip({ ...project(), files: { 'client.lua': '' } })).toThrow('fxmanifest');
  });
  it('accepts legal literal header forms and rejects misleading comments or conditionals', () => {
    const p = project();
    p.files['fxmanifest.lua'] = "--[=[game 'wrong']=]\nfx_version([[cerulean]])\ngames { 'gta5' }\nclient_script 'client.lua'";
    expect(resourceZip(p).length).toBeGreaterThan(0);
    p.files['fxmanifest.lua'] = "description [[fx_version 'cerulean']]\ngame 'gta5'\nclient_script 'client.lua'";
    expect(() => resourceZip(p)).toThrow('Manifest must declare');
    p.files['fxmanifest.lua'] = "if false then fx_version 'cerulean' end\ngame 'gta5'\nclient_script 'client.lua'";
    expect(() => resourceZip(p)).toThrow('declarative');
  });
});

describe('documentation link boundaries', () => {
  it('permits official HTTPS docs only for metadata fetches', () => {
    expect(validateUrl('https://docs.fivem.net/docs/scripting-manual/')).toContain('docs.fivem.net');
    for (const url of ['http://docs.fivem.net/', 'https://localhost/', 'https://docs.fivem.net.evil.test/', 'https://user:secret@docs.fivem.net/', 'file:///C:/secret', 'javascript:alert(1)', 'https://docs.fivem.net:8443/']) expect(() => validateUrl(url)).toThrow();
  });
});
