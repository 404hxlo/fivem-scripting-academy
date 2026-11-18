import type { Evaluation, Exercise, RunResult } from '../types';
import type { LuaOptions } from './lua-core';
import { stripComments } from './lua-text';
export type LuaRunner = (code:string,options?:LuaOptions)=>Promise<RunResult>;

export async function evaluateWithRunner(exercise:Exercise,code:string,files:Record<string,string>|undefined,run:LuaRunner):Promise<Evaluation>{
  const filename=exercise.filename??'exercise.lua';
  const allFiles={...exercise.files,...files,[filename]:code};
  const results:Evaluation['results']=[];
  let output:string[]=[];
  for(const [name,source] of Object.entries(allFiles)){
    if(!name.toLowerCase().endsWith('.lua'))continue;
    const result=await run(source,{syntaxOnly:true});
    const cfxHint=!result.ok&&stripComments(source).includes('`')?' This checker supports standard Lua 5.4, not CfxLua backtick hash literals. Use GetHashKey("model") for a portable example, or validate that extension in FiveM.':'';
    results.push({name:`Lua 5.4 syntax · ${name}`,passed:result.ok,detail:result.ok?'Compiles successfully.':(result.error??'Invalid Lua syntax.')+cfxHint});
  }
  const syntaxPassed=results.every(result=>result.passed);
  if(syntaxPassed&&exercise.mode!=='static'){
    const executed=await run(code,{mock:exercise.mock});
    output=executed.output;
    results.push({name:exercise.mode==='fivem'?'Educational mock execution':'Lua execution',passed:executed.ok,detail:executed.ok?(exercise.mode==='fivem'?'Ran only the bundled educational mock. This is not a FiveM session.':'Executed in isolated Lua 5.4.'):executed.error??'Execution failed.'});
    if(executed.ok){
      for(const test of exercise.tests){
        const checked=await run(code,{mock:exercise.mock,tests:test.code});
        results.push({name:test.name,passed:checked.ok,detail:checked.ok?'Behavior check passed.':checked.error??'Expected behavior was not observed.'});
      }
    }
  }
  for(const rule of exercise.rules??[]){
    const target=rule.file??filename;
    const text=allFiles[target];
    if(text===undefined){results.push({name:rule.name,passed:false,detail:`Missing ${target}. ${rule.explanation}`});continue;}
    try{
      const clean=stripComments(text,target.toLowerCase().endsWith('.lua')?'lua':target.toLowerCase().endsWith('.cfg')?'config':'web');
      const matches=new RegExp(rule.pattern,(rule.flags??'m').replace(/[gy]/g,'')).test(clean);
      const passed=rule.absent?!matches:matches;
      results.push({name:rule.name,passed,detail:passed?'Structural check passed; verify behavior in a local FiveM test server.':rule.explanation});
    }catch{results.push({name:rule.name,passed:false,detail:'This bundled check is invalid. Report the lesson and check name.'});}
  }
  const hasAssessment=exercise.tests.length>0||(exercise.rules?.length??0)>0;
  if(!hasAssessment)results.push({name:'Assessment coverage',passed:false,detail:'This exercise has no assessment checks; syntax alone cannot demonstrate mastery.'});
  return {passed:results.length>0&&results.every(result=>result.passed),results,output,mode:exercise.mode==='lua'?'Isolated Lua 5.4':exercise.mode==='fivem'?'Educational FiveM mock · not live gameplay':'Static review · not live FiveM execution'};
}
