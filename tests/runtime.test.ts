import { describe,it,expect } from 'vitest';
import { Worker } from 'node:worker_threads';
import { executeLua, LUA_LIMITS } from '../src/lib/lua-core';
import { formatLua, stripComments } from '../src/lib/lua-text';
import type { RunResult } from '../src/types';

describe('bundled Lua 5.4 sandbox',()=>{
  it('executes real Lua 5.4 including integer division and prints',async()=>{
    const result=await executeLua('print(_VERSION)\nlocal total=0\nfor i=1,5 do total=total+i end\nprint(total // 2)');
    expect(result.ok).toBe(true);expect(result.output).toEqual(['Lua 5.4','7']);
  });
  it('reports syntax errors at the student line',async()=>{
    const result=await executeLua('local n=3\nif n > 1 print(n) end',{syntaxOnly:true});
    expect(result.ok).toBe(false);expect(result.line).toBe(2);expect(result.error).toContain('then');
  });
  it('compiles natives without falsely running FiveM',async()=>{
    expect((await executeLua('local ped=PlayerPedId()',{syntaxOnly:true})).ok).toBe(true);
    const result=await executeLua('local ped=PlayerPedId()');expect(result.ok).toBe(false);expect(result.error).toContain('PlayerPedId');
  });
  it('has no filesystem, process, network, module, debug or JS access',async()=>{
    const result=await executeLua(`for _,name in ipairs({'os','io','debug','package','require','load','loadfile','dofile','js','global','process','fetch','__academy_source'}) do assert(_G[name]==nil, name..' was exposed') end\nassert(string.dump==nil)\nassert(_G._G==_G)`);
    expect(result.ok).toBe(true);
  });
  it('allows basic error handling without exposing host functions',async()=>{
    const result=await executeLua(`local ok, problem=pcall(function() error('practice failure') end)\nassert(not ok)\nassert(string.find(problem,'practice failure'))`);expect(result.ok).toBe(true);
  });
  it('rejects oversized input and bounded-memory allocation',async()=>{
    expect((await executeLua(' '.repeat(LUA_LIMITS.codeBytes+1))).error).toContain('64 KB');
    const result=await executeLua(`local huge=string.rep('x',20*1024*1024)`);expect(result.ok).toBe(false);expect(result.error).toMatch(/memory|not enough/i);
  });
  it('bounds console output',async()=>{
    const result=await executeLua('for i=1,500 do print(i) end');expect(result.ok).toBe(true);expect(result.output.length).toBe(101);expect(result.output[100]).toContain('limit');
  });
  it('tests locals and rejects an early return that skips assessment',async()=>{
    expect((await executeLua('local function double(n) return n*2 end',{tests:'assert(double(7)==14)'})).ok).toBe(true);
    const result=await executeLua('if true then return end',{tests:'assert(false)'});expect(result.ok).toBe(false);expect(result.error).toContain('before the checks');
  });
  it('kills a disposable worker even if code catches timeout errors',async()=>{
    const result=await new Promise<RunResult>(resolve=>{
      const worker=new Worker(new URL('./helpers/lua-node-worker.mjs',import.meta.url),{workerData:{code:'while true do pcall(function() while true do end end) end'}});
      const timer=setTimeout(()=>{void worker.terminate();resolve({ok:false,error:'hard timeout',output:[],durationMs:1500});},1500);
      worker.on('message',value=>{clearTimeout(timer);void worker.terminate();resolve(value)});
      worker.on('error',error=>{clearTimeout(timer);resolve({ok:false,error:error.message,output:[],durationMs:0})});
    });
    expect(result.ok).toBe(false);expect(result.error).toMatch(/timeout|1.5/i);
  },6000);
});

describe('Lua editor helpers',()=>{
  it('strips only comments and preserves strings and source lines',()=>{
    const source=`local text='-- not a comment' -- removed\n--[=[ hidden\ncomment ]=]\nprint([=[-- retained]=])`;
    const clean=stripComments(source);expect(clean).toContain("'-- not a comment'");expect(clean).not.toContain('hidden');expect(clean).toContain('[=[-- retained]=]');expect(clean.split('\n')).toHaveLength(4);
  });
  it('indents Lua control flow without changing code strings',()=>{
    expect(formatLua('if true then\nprint("end")\nelse\nprint("do")\nend')).toBe('if true then\n  print("end")\nelse\n  print("do")\nend');
  });
  it('preserves multiline string content and ignores its keywords',()=>{
    expect(formatLua('local text=[=[then\n  end\n]=]\nprint(text)')).toBe('local text=[=[then\n  end\n]=]\nprint(text)');
  });
  it('preserves output and line endings when formatting multiline Lua literals', async () => {
    const source = [
      'if true then',
      'local verbatim = [=[first line   ',
      '  end',
      ']=]',
      'local continued = "a' + '\\',
      '  b"',
      'print(verbatim, continued)',
      'end',
    ].join('\r\n');
    const original = await executeLua(source);
    expect(original.ok).toBe(true);
    const formatted = formatLua(source);
    const result = await executeLua(formatted);
    expect(result.ok).toBe(true);
    expect(result.output).toEqual(original.output);
    expect(formatted.split('\r\n')).toHaveLength(8);
  });
  it('formats the remaining block after a comment containing a bracket opener', () => {
    expect(formatLua('if ok then\n-- example: [[\nprint(ok)\nend'))
      .toBe('if ok then\n  -- example: [[\n  print(ok)\nend');
  });
});
