import {describe,it,expect} from 'vitest';
import {newState,parseBackup,streak,safeFileName,isComplete} from '../src/lib/state';
import {createProject,snapshot} from '../src/lib/templates';
import {createRequire} from 'node:module';
const desktop = createRequire(import.meta.url)('../electron/backend.cjs');
describe('learning progress',()=>{
 it('roundtrips an offline backup with code and project history',()=>{const s=newState();s.projects=[snapshot(createProject('my_resource','command'))];s.studySeconds=120;expect(parseBackup(JSON.stringify(s))).toEqual(s)});
 it('rejects corrupted progress and unsafe project files',()=>{expect(()=>parseBackup('{"version":9}')).toThrow();const s=newState();s.projects=[createProject('my_resource','command')];s.projects[0].files['../server.cfg']='danger';expect(()=>parseBackup(JSON.stringify(s))).toThrow()});
 it('tracks consecutive calendar days, including yesterday',()=>{expect(streak(['2026-11-16','2026-11-17'],new Date(2026,10,18))).toBe(2);expect(streak(['2026-11-15'],new Date(2026,10,18))).toBe(0)});
 it('requires both an exercise and quiz to complete',()=>{expect(isComplete({exercisePassed:true,quizCorrect:false} as any)).toBe(false);expect(isComplete({exercisePassed:true,quizCorrect:true} as any)).toBe(true)});
 it('rejects absolute, traversal and Windows device paths',()=>{for(const name of ['../a.lua','C:/a.lua','/a.lua','CON.lua','x/NUL.lua','x\\a.lua'])expect(safeFileName(name)).toBe(false);expect(safeFileName('html/app.js')).toBe(true)});
 it('keeps snapshots independent from subsequent edits',()=>{const p=snapshot(createProject('test','nui'));p.files['client.lua']='changed';expect(p.history[0].files['client.lua']).not.toBe('changed')});
 it('opens desktop-compatible project files containing multiple dots',()=>{
   const state = newState();
   const project = createProject('my_resource','command');
   project.files['html/app.min.js'] = 'const ready = true;';
   state.projects = [snapshot(project)];
   const saved = desktop.validateState(state);
   expect(parseBackup(JSON.stringify(saved))).toEqual(saved);
 });
 it('imports a UTF-8 backup saved by Windows tools with a byte order mark',()=>{
   const data = newState();
   const text = '\uFEFF' + JSON.stringify(data);
   expect(parseBackup(text)).toEqual(data);
   expect(desktop.parseBackup(text)).toEqual(data);
 });
 it('rejects damaged settings and snapshot data before a browser import can replace current work',()=>{
   const state = newState();
   const project = snapshot(createProject('my_resource','command'));
   const invalid = [
     {...state, sourceOverrides:null},
     {...state, projects:[{...project, history:[{date:project.updated, files:null}]}]},
   ];
   for (const data of invalid) {
     const json = JSON.stringify(data);
     expect(()=>desktop.parseBackup(json)).toThrow();
     expect(()=>parseBackup(json)).toThrow();
   }
 });
});
