import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { createProject, snapshot, templates } from '../src/lib/templates';
import { executeLua } from '../src/lib/lua-core';
import { buildResourceZip, inspectResource, reviewResource, validResourceName, validResourcePath } from '../src/lib/resource';

describe('resource validation and packaging', () => {
  it('rejects reserved folder names and unknown templates during creation', () => {
    for (const name of ['con', 'lpt1', 'nul']) expect(() => createProject(name, 'blank')).toThrow();
    expect(() => createProject('academy_test', 'constructor')).toThrow('Choose a resource template');
  });
  it('requires ui_page to identify one actual document even when files uses a glob', () => {
    const project = createProject('academy_test', 'nui');
    project.files['fxmanifest.lua'] = "fx_version 'cerulean'\ngame 'gta5'\nui_page 'html/*.html'\nfiles {'html/*'}";
    expect(inspectResource(project).valid).toBe(false);
    expect(() => buildResourceZip(project)).toThrow('html/*.html');
    project.files['fxmanifest.lua'] = project.files['fxmanifest.lua'].replace('html/*.html', 'html/index.html');
    expect(inspectResource(project).valid).toBe(true);
  });
  it.each(Object.keys(templates))('compiles and validates the %s project template', async template => {
    const project = createProject('academy_test', template);
    const review = await reviewResource(project, executeLua);
    expect(review.checks.filter(check => check.status === 'fail')).toEqual([]);
    expect(review.valid).toBe(true);
    expect(review.checks.some(check => check.name === 'Live FiveM test' && check.status === 'review')).toBe(true);
  });
  it('reports actual Lua syntax errors rather than successful string matches', async () => {
    const project = createProject('academy_test', 'command');
    project.files['client.lua'] = 'local name =\nprint(name)\nif true print(name) end';
    const review = await reviewResource(project, executeLua);
    expect(review.valid).toBe(false);
    expect(review.checks.find(check => check.name === 'Lua 5.4 syntax: client.lua')?.status).toBe('fail');
  });
  it('stops checking additional Lua files when the workspace changes', async () => {
    const project = createProject('academy_test', 'blank');
    const controller = new AbortController();
    let calls = 0;
    const check = reviewResource(project, async () => {
      calls++;
      controller.abort();
      return {ok:true,output:[],durationMs:0};
    }, controller.signal);
    await expect(check).rejects.toMatchObject({name:'AbortError'});
    expect(calls).toBe(1);
  });
  it('rejects a missing declared script while allowing a real glob', () => {
    const project = createProject('academy_test', 'command');
    delete project.files['client.lua'];
    expect(inspectResource(project).valid).toBe(false);
    project.files['fxmanifest.lua'] = "fx_version 'cerulean'\ngame 'gta5'\nclient_scripts { 'client/**/*.lua' }";
    project.files['client/main.lua'] = 'print("ready")';
    project.files['client/util/helpers.lua'] = 'local value = 1';
    expect(inspectResource(project).valid).toBe(true);
  });
  it('does not accept a commented-out manifest declaration or an unrelated string', () => {
    const project = createProject('academy_test', 'blank');
    project.files['fxmanifest.lua'] = "-- fx_version 'cerulean'\ndescription \"fx_version 'cerulean'\"\ngame 'gta5'\nclient_script 'client.lua'";
    expect(inspectResource(project).valid).toBe(false);
    project.files['fxmanifest.lua'] = "--[=[fx_version 'wrong']=]\nfx_version([[cerulean]])\ngame('gta5')\nclient_scripts({'client.lua'})";
    expect(inspectResource(project).valid).toBe(true);
  });
  it('requires resolvable literal manifest entries for export', () => {
    const project = createProject('academy_test', 'blank');
    project.files['fxmanifest.lua'] += "\nclient_script 'client' .. '.lua'";
    expect(inspectResource(project).checks.find(check => check.name === 'Explicit manifest entries')?.status).toBe('fail');
    project.files['fxmanifest.lua'] = "if false then fx_version 'cerulean' end\ngame 'gta5'\nclient_script 'client.lua'";
    expect(inspectResource(project).checks.find(check => check.name === 'Explicit manifest entries')?.status).toBe('fail');
    project.files['fxmanifest.lua'] = "fx_version { 'cerulean' }\ngame 'gta5'\nclient_script 'client.lua'";
    expect(inspectResource(project).checks.find(check => check.name === 'Explicit manifest entries')?.status).toBe('fail');
  });
  it('recognizes both current and legacy NUI callbacks as manual trust boundaries', () => {
    const project = createProject('academy_test','blank');
    for (const native of ['RegisterNuiCallback','RegisterNUICallback']) {
      project.files['client.lua'] = `${native}('close', function(data, cb) cb({ok=true}) end)`;
      expect(inspectResource(project).checks.find(check => check.name === 'Trust boundary review')?.status).toBe('review');
    }
  });
  it('detects NUI files omitted from the packfile', () => {
    const project = createProject('academy_test', 'nui');
    project.files['fxmanifest.lua'] = project.files['fxmanifest.lua'].replace(", 'html/app.js'", '');
    expect(inspectResource(project).checks.find(check => check.name === 'NUI asset: app.js')?.status).toBe('fail');
  });
  it('accepts an empty but correctly packaged NUI asset', () => {
    const project = createProject('academy_test', 'nui');
    project.files['html/style.css'] = '';
    expect(inspectResource(project).valid).toBe(true);
  });
  it('validates requested NUI assets using the document URL and ignores markup used as examples', () => {
    const project = createProject('academy_test', 'nui');
    project.files['html/index.html'] = `
      <!-- <script src="removed.js"></script> -->
      <script>const sample = '<img src="example.png">';</script>
      <p data-src="example.txt">Example</p>
      <link REL=stylesheet HREF="/html/style.css?v=2">
      <script SRC=app.js></script>
    `;
    const review = inspectResource(project);
    expect(review.checks.filter(check => check.status === 'fail')).toEqual([]);
    delete project.files['html/app.js'];
    expect(inspectResource(project).checks.find(check => check.name === 'NUI asset: app.js')?.status).toBe('fail');
  });
  it('honors a relative base URL and distinguishes remote URLs from packaged files', () => {
    const project = createProject('academy_test', 'nui');
    project.files['html/index.html'] = '<base href="../"><script src="./html/app.js"></script><script src="//cdn.example.invalid/remote.js"></script>';
    const review = inspectResource(project);
    expect(review.valid).toBe(true);
    expect(review.checks.some(check => check.status === 'review' && check.detail.includes('cdn.example.invalid'))).toBe(true);
  });
  it('checks Lua syntax when an editable file has an uppercase extension', async () => {
    const project = createProject('academy_test','command');
    project.files['client.lua'] = '';
    project.files['feature.LUA'] = 'local variable =';
    project.files['fxmanifest.lua'] += "\nclient_script 'feature.LUA'";
    const result = await reviewResource(project, executeLua);
    expect(result.checks.find(check => check.file === 'feature.LUA' && check.name.startsWith('Lua 5.4'))?.status).toBe('fail');
  });
  it('requires external script dependencies and explains they are not installed', () => {
    const project = createProject('academy_test', 'blank');
    project.files['fxmanifest.lua'] += "\nserver_script '@oxmysql/lib/MySQL.lua'";
    expect(inspectResource(project).valid).toBe(false);
    project.files['fxmanifest.lua'] += "\ndependency 'oxmysql'";
    const review = inspectResource(project);
    expect(review.valid).toBe(true); expect(review.dependencies).toContain('oxmysql');
  });
  it('exports exact editable files into one standard named resource directory', () => {
    const project = createProject('academy_export', 'nui');
    project.files['client.lua'] += '\n-- my independently written change';
    const archive = unzipSync(buildResourceZip(project));
    expect(Object.keys(archive)).toHaveLength(Object.keys(project.files).length);
    for (const [name,code] of Object.entries(project.files)) expect(strFromU8(archive[`academy_export/${name}`])).toBe(code);
    expect(archive['academy_export/fxmanifest.lua']).toBeDefined();
  });
  it('blocks traversal, case collisions and file/folder collisions before ZIP creation', () => {
    const longestPath = 'a'.repeat(156) + '.lua';
    expect(validResourcePath(longestPath)).toBe(true);
    expect(validResourcePath('a' + longestPath)).toBe(false);
    for (const name of ['../bad.lua','/bad.lua','C:/bad.lua','foo\\bad.lua','con.lua']) expect(validResourcePath(name)).toBe(false);
    for (const name of ['con','nul','../academy','MixedCase','a']) expect(validResourceName(name)).toBe(false);
    const project = createProject('academy_test', 'blank');
    project.files['Client.lua'] = '';
    expect(() => buildResourceZip(project)).toThrow('Unique file names');
    delete project.files['Client.lua']; project.files['client.lua/child.lua'] = '';
    expect(() => buildResourceZip(project)).toThrow('File and folder boundaries');
  });
  it('copies project snapshots and caps history without mutating source files', () => {
    let project = createProject('academy_test', 'blank');
    const original = project.files['client.lua'];
    project = snapshot(project); project.files['client.lua'] = 'print("changed")';
    expect(project.history[0].files['client.lua']).toBe(original);
    for (let index = 0; index < 30; index++) project = snapshot(project);
    expect(project.history).toHaveLength(20);
  });
});
