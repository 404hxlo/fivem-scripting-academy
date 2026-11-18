import type { Evaluation, Exercise, RunResult } from '../types';
import type { LuaOptions } from './lua-core';
import { evaluateWithRunner } from './evaluation';
export { formatLua, stripComments } from './lua-text';
export type { LuaOptions } from './lua-core';

export function runLua(code: string, options: LuaOptions = {}): Promise<RunResult> {
  const start = performance.now();
  if (new TextEncoder().encode(code).length > 65536) return Promise.resolve({ok:false,output:[],error:'Code exceeds the 64 KB exercise limit.',durationMs:0});
  return new Promise(resolve => {
    let worker: Worker;
    try { worker = new Worker(new URL('./lua.worker.ts', import.meta.url), { type: 'module' }); }
    catch (cause) { resolve({ok:false,output:[],error:`Lua worker could not start: ${String(cause)}`,durationMs:0}); return; }
    let done = false;
    const finish = (result: RunResult) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      worker.terminate();
      resolve(result);
    };
    const timer = setTimeout(() => finish({ok:false,output:[],error:'Execution stopped after 1.5 seconds. Check for a loop that never ends or an operation that is too expensive.',durationMs:Math.round(performance.now()-start)}), 1500);
    worker.onmessage = event => finish(event.data as RunResult);
    worker.onerror = event => finish({ok:false,output:[],error:`Lua worker failed: ${event.message || 'Check that the bundled runtime was loaded.'}`,durationMs:Math.round(performance.now()-start)});
    worker.postMessage({code,options});
  });
}

export function evaluateExercise(exercise: Exercise, code: string, files?: Record<string,string>): Promise<Evaluation> {
  return evaluateWithRunner(exercise, code, files, runLua);
}
