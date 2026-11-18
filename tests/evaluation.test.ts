import { describe,it,expect } from 'vitest';
import { evaluateWithRunner } from '../src/lib/evaluation';
import { executeLua } from '../src/lib/lua-core';
import type { Exercise } from '../src/types';
import { lessons } from '../src/content';
const exercise:Exercise={instructions:'Write a double function.',starter:'',solution:'local function double(n) return n*2 end',mode:'lua',tests:[{name:'Handles positive numbers',code:'assert(double(4)==8, "Expected 8")'},{name:'Handles negative numbers',code:'assert(double(-3)==-6, "Expected -6")'}],hints:['a','b','c']};

describe('behavioral exercise evaluation',()=>{
  it('grades player height from actual mock calls regardless of intermediate variable names', async () => {
    const task = lessons.find(lesson => lesson.id === 'native-reading')!.exercise;
    const alternate = 'local character = PlayerPedId()\nlocal height = GetEntityCoords(character).z';
    expect((await evaluateWithRunner(task, alternate, undefined, executeLua)).passed).toBe(true);
    expect((await evaluateWithRunner(task, 'local height = 32.5', undefined, executeLua)).passed).toBe(false);
  });
  it('accepts equivalent solutions and rejects hardcoded output',async()=>{
    const good=await evaluateWithRunner(exercise,'local function double(n) return n+n end',undefined,executeLua);
    expect(good.passed).toBe(true);
    const bad=await evaluateWithRunner(exercise,'local function double(n) return 8 end',undefined,executeLua);
    expect(bad.passed).toBe(false);expect(bad.results.find(row=>row.name==='Handles negative numbers')?.passed).toBe(false);
  });
  it('never marks syntax-only or empty checks as mastery',async()=>{
    const result=await evaluateWithRunner({...exercise,tests:[]},'print(1)',undefined,executeLua);expect(result.passed).toBe(false);
  });
  it('runs educational command mocks and labels them',async()=>{
    const mock:Exercise={...exercise,mode:'fivem',mock:'_COMMANDS={}\nfunction RegisterCommand(name,callback) _COMMANDS[name]=callback end',tests:[{name:'Command behavior',code:'assert(_COMMANDS.hello)\n_COMMANDS.hello()\nassert(_OUTPUT[1]=="Hello")'}]};
    const result=await evaluateWithRunner(mock,'RegisterCommand("hello",function() print("Hello") end)',undefined,executeLua);expect(result.passed).toBe(true);expect(result.mode).toContain('not live');
  });
  it('checks every Lua file and does not count comments as structure',async()=>{
    const staticExercise:Exercise={...exercise,mode:'static',filename:'client.lua',tests:[],rules:[{name:'Register a command',pattern:'RegisterCommand\\s*\\(',explanation:'Call RegisterCommand.'}],files:{'fxmanifest.lua':"fx_version 'cerulean'\ngame 'gta5'"}};
    const comments=await evaluateWithRunner(staticExercise,'-- RegisterCommand("hello", fn)',undefined,executeLua);expect(comments.passed).toBe(false);
    const syntax=await evaluateWithRunner(staticExercise,'RegisterCommand("hello",function() end)',{'fxmanifest.lua':'local = invalid'},executeLua);expect(syntax.passed).toBe(false);expect(syntax.results[0].name).toContain('fxmanifest.lua');
    const uppercase = await evaluateWithRunner(staticExercise, 'RegisterCommand("hello",function() end)', {'Config.LUA':'local = invalid'}, executeLua);
    expect(uppercase.results.find(check => check.name.includes('Config.LUA'))?.passed).toBe(false);
    const good=await evaluateWithRunner(staticExercise,'RegisterCommand("hello",function() end)',undefined,executeLua);expect(good.passed).toBe(true);expect(good.mode).toContain('Static');
  });
  it('reports missing files for file-scoped rules',async()=>{
    const result=await evaluateWithRunner({...exercise,mode:'static',tests:[],rules:[{name:'NUI page',pattern:'html',file:'html/index.html',explanation:'Create an HTML file.'}]},'',undefined,executeLua);expect(result.passed).toBe(false);expect(result.results.at(-1)?.detail).toContain('Missing');
  });
  it('does not count commented server.cfg commands as completed work',async()=>{
    const config:Exercise={...exercise,mode:'static',filename:'server.cfg',tests:[],rules:[{name:'Startup',pattern:'ensure\\s+chat[\\s\\S]*ensure\\s+academy_greeting',explanation:'Ensure both resources.'}]};
    expect((await evaluateWithRunner(config,'# ensure chat\n# ensure academy_greeting',undefined,executeLua)).passed).toBe(false);
    expect((await evaluateWithRunner(config,'ensure chat\nensure academy_greeting',undefined,executeLua)).passed).toBe(true);
  });
});
