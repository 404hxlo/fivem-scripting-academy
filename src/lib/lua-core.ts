import { LuaFactory } from 'wasmoon';
import type { RunResult } from '../types';

export const LUA_LIMITS = { codeBytes: 65536, memoryBytes: 8 * 1024 * 1024, timeoutMs: 1500, outputLines: 100, outputBytes: 16384 } as const;
export interface LuaOptions { syntaxOnly?: boolean; mock?: string; tests?: string }

// This wrapper runs in the host Lua global state. Student chunks receive only
// `env`: no JS bridge, loader, module system, host globals, I/O, or OS library.
const wrapper = `
local env = {
  assert=assert, error=error, ipairs=ipairs, pairs=pairs, next=next,
  pcall=pcall, xpcall=xpcall, select=select, tonumber=tonumber,
  tostring=tostring, type=type, rawequal=rawequal, rawget=rawget, rawset=rawset,
  _VERSION=_VERSION
}
local function copyLibrary(original)
  local result = {}
  for key, value in pairs(original) do
    if key ~= 'dump' then result[key] = value end
  end
  return result
end
env.math=copyLibrary(math)
env.string=copyLibrary(string)
env.table=copyLibrary(table)
env.utf8=copyLibrary(utf8)
env._G=env
env._OUTPUT={}
local output, bytes, truncated = {}, 0, false
env.print=function(...)
  local pieces={}
  for i=1,select('#', ...) do
    pieces[i]=string.sub(tostring(select(i,...)),1,4096)
  end
  local line=table.concat(pieces,'\t')
  if #output >= 100 or bytes + #line > 16384 then
    if not truncated then
      output[#output+1]='[Output limit reached]'
      truncated=true
    end
    return
  end
  output[#output+1]=line
  env._OUTPUT[#env._OUTPUT+1]=line
  bytes=bytes+#line
end
local chunk, problem=load(__academy_source,'@student.lua','t',env)
if not chunk then return false, tostring(problem) end
if __academy_syntax_only then return true, '' end
if #__academy_mock > 0 then
  local setup, setupError=load(__academy_mock,'@educational-mock.lua','t',env)
  if not setup then return false, 'Mock configuration: '..tostring(setupError) end
  local setupOk, setupResult=pcall(setup)
  if not setupOk then return false, 'Mock configuration: '..tostring(setupResult) end
end
local ok, result=pcall(chunk)
if ok and __academy_has_tests and result ~= '__academy_checks_reached__' then
  ok=false
  result='The program returned before the checks could run. Keep the exercise definitions at the top level.'
end
return ok, ok and '' or tostring(result), table.unpack(output)
`;

export async function executeLua(code: string, options: LuaOptions = {}, wasmUri?: string): Promise<RunResult> {
  const start = performance.now();
  if (new TextEncoder().encode(code).length > LUA_LIMITS.codeBytes) {
    return { ok: false, output: [], error: 'Code exceeds the 64 KB exercise limit.', durationMs: 0 };
  }
  let engine: Awaited<ReturnType<LuaFactory['createEngine']>> | undefined;
  try {
    engine = await new LuaFactory(wasmUri).createEngine({ openStandardLibs: true, injectObjects: false, enableProxy: false, traceAllocations: true });
    engine.global.setMemoryMax(LUA_LIMITS.memoryBytes);
    const hasTests = !!options.tests && !options.syntaxOnly;
    engine.global.set('__academy_source', hasTests ? `${code}\n${options.tests}\nreturn '__academy_checks_reached__'` : code);
    engine.global.set('__academy_mock', options.mock ?? '');
    engine.global.set('__academy_syntax_only', !!options.syntaxOnly);
    engine.global.set('__academy_has_tests', hasTests);
    const thread = engine.global.newThread();
    thread.loadString(wrapper, '@academy-sandbox.lua');
    const values = await thread.run(0, { timeout: 1000 });
    const error = values[0] ? undefined : String(values[1] ?? 'Lua execution failed.');
    return {
      ok: !!values[0],
      output: Array.from(values).slice(2).map(value => String(value).slice(0,4096)).slice(0,101),
      error,
      line: parseLuaLine(error),
      durationMs: Math.round(performance.now() - start),
    };
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : String(cause);
    return { ok: false, output: [], error: /memory/i.test(error) ? 'Lua stopped at the 8 MB memory limit.' : error, line: parseLuaLine(error), durationMs: Math.round(performance.now()-start) };
  } finally {
    engine?.global.close();
  }
}

export function parseLuaLine(error?: string): number | undefined {
  const match = error?.match(/(?:student\.lua|\[string [^\]]*\]):(\d+):/);
  return match ? Number(match[1]) : undefined;
}
