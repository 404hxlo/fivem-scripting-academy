import {useEffect,useRef,useState} from 'react';
import {ArrowRight,BookOpen,Check,CheckCircle2,ChevronRight,Clock3,Code2,ExternalLink,Eye,FileCheck2,FolderOpen,GripVertical,HelpCircle,Lightbulb,Play,RotateCcw,ShieldCheck,Target,Terminal,X,XCircle} from 'lucide-react';
import type {AcademyState,Evaluation,Lesson,LessonProgress} from '../types';
import type {UpdateState} from '../App';
import {modules,sources} from '../content';
import {freshProgress,localDay} from '../lib/state';
import {evaluateExercise,runLua} from '../lib/runtime';
import {CodeEditor} from './CodeEditor';
import './lesson.css';

type Stage='learn'|'practice'|'quiz'|'review';
const stages:{id:Stage;label:string;icon:typeof BookOpen}[]=[{id:'learn',label:'Learn',icon:BookOpen},{id:'practice',label:'Practice',icon:Code2},{id:'quiz',label:'Knowledge check',icon:HelpCircle},{id:'review',label:'Review',icon:FileCheck2}];

export function LessonView({lesson,state,update,notify,next,saveProject}:{lesson:Lesson;state:AcademyState;update:UpdateState;notify:(message:string)=>void;next:()=>void;saveProject?:(files:Record<string,string>,title:string)=>void}){
 const progress=state.progress[lesson.id]??freshProgress(lesson);
 const mainFile=lesson.exercise.filename??'exercise.lua';
 const scratchExtension=mainFile==='.gitignore'?'txt':mainFile.split('.').pop()??'lua';
 const scratchFile=`independent-challenge.${['lua','html','css','js','json','md','txt','sql','cfg','yml','yaml'].includes(scratchExtension)?scratchExtension:'txt'}`;
 const [stage,setStage]=useState<Stage>('learn');
 const [evaluation,setEvaluation]=useState<Evaluation|null>(null);
 const [busy,setBusy]=useState(false);
 const [revealed,setRevealed]=useState(false);
 const [compare,setCompare]=useState(false);
 const [independent,setIndependent]=useState(false);
 const [resetOpen,setResetOpen]=useState(false);
 const [leftWidth,setLeftWidth]=useState(43);
 const [scratchOutput,setScratchOutput]=useState<{ok:boolean;output:string[];error?:string}|null>(null);
 const revision=useRef(0),alive=useRef(true),splitRef=useRef<HTMLDivElement>(null),readerRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[]);
 useEffect(()=>{readerRef.current?.scrollTo({top:0})},[stage]);
 const files=Object.fromEntries(Object.entries({...lesson.exercise.files,...progress.files,[mainFile]:progress.code}).filter(([name])=>name!==scratchFile));
 const module=modules.find(m=>m.id===lesson.module);
 const canComplete=progress.exercisePassed&&progress.quizCorrect===true;

 function editProgress(fn:(p:LessonProgress)=>LessonProgress){update(s=>({...s,progress:{...s.progress,[lesson.id]:fn(s.progress[lesson.id]??freshProgress(lesson))}}))}
 function editFiles(changed:Record<string,string>){
  if (compare) return;
  revision.current++;setEvaluation(null);
  editProgress(p=>({...p,code:changed[mainFile]??p.code,files:{...p.files,...changed},exercisePassed:false,completed:false,updated:new Date().toISOString()}));
 }
 async function evaluate(){
  const currentRevision=revision.current;setBusy(true);setCompare(false);setIndependent(false);setStage('practice');
  editProgress(p=>({...p,attempts:p.attempts+1,updated:new Date().toISOString()}));
  try{
   const result=await evaluateExercise(lesson.exercise,progress.code,files);
   if(!alive.current)return;
   if(currentRevision!==revision.current){notify('Your code changed during the checks. Run them again for the latest version.');return;}
   setEvaluation(result);
   editProgress(p=>({...p,exercisePassed:result.passed,completed:p.completed&&result.passed,updated:new Date().toISOString()}));
  }catch(error){if(alive.current)notify('The checks could not finish: '+String(error));}
  finally{if(alive.current)setBusy(false);}
 }
 async function runScratch(){
  if(!scratchFile.endsWith('.lua'))return;
  setBusy(true);
  try{const result=await runLua(progress.files?.[scratchFile]??'',{syntaxOnly:lesson.exercise.mode!=='lua'});if(alive.current)setScratchOutput(result);}
  finally{if(alive.current)setBusy(false);}
 }
 function showHint(){editProgress(p=>({...p,hints:Math.min(3,p.hints+1),updated:new Date().toISOString()}))}
 function finish(){if(!canComplete)return;update(s=>({...s,studyDays:[...new Set([...s.studyDays,localDay()])],progress:{...s.progress,[lesson.id]:{...(s.progress[lesson.id]??freshProgress(lesson)),completed:true,updated:new Date().toISOString()}}}));notify('Lesson completed. Keep building on what you learned.');next()}
 function reset(){revision.current++;setEvaluation(null);setCompare(false);setRevealed(false);setResetOpen(false);editProgress(p=>({...p,code:lesson.exercise.starter,files:{...lesson.exercise.files,...(p.files?.[scratchFile]!==undefined?{[scratchFile]:p.files[scratchFile]}:{})},exercisePassed:false,completed:false,hints:0,updated:new Date().toISOString()}))}
 async function openSource(url:string){try{if(new URL(url).protocol!=='https:')throw new Error('Documentation links must use HTTPS.');if(window.academy)await window.academy.openExternal(url);else window.open(url,'_blank','noopener,noreferrer')}catch(error){notify(String(error))}}
 function resize(clientX:number){const rect=splitRef.current?.getBoundingClientRect();if(rect)setLeftWidth(Math.max(32,Math.min(60,(clientX-rect.left)/rect.width*100)))}
 const status=lesson.exercise.mode==='lua'?'ISOLATED LUA 5.4':lesson.exercise.mode==='fivem'?'EDUCATIONAL FIVEM MOCK':'STATIC RESOURCE CHECKS';

 return <div className="lesson-page">
  <div className="lesson-heading"><div><div className="eyebrow purple">MODULE {String(lesson.module).padStart(2,'0')} <ChevronRight size={12}/> {module?.title}</div><h1>{lesson.title}</h1><div className="lesson-meta"><span><Clock3 size={13}/>{lesson.minutes} min</span><span>{lesson.level}</span><span><ShieldCheck size={13}/>{lesson.exercise.mode==='lua'?'Real Lua 5.4':'FiveM learning exercise'}</span></div></div>{progress.completed?<span className="lesson-completed"><CheckCircle2 size={16}/> Completed</span>:<span className="tag">LEARN BY DOING</span>}</div>
  <div className="lesson-split" ref={splitRef} style={{gridTemplateColumns:`minmax(0,${leftWidth}fr) 10px minmax(0,${100-leftWidth}fr)`}}>
   <section className="lesson-reader">
    <nav className="lesson-stages" aria-label="Lesson stages">{stages.map(({id,label,icon:Icon},index)=><button key={id} className={stage===id?'active':''} onClick={()=>setStage(id)} aria-current={stage===id?'step':undefined}><span>{id==='practice'&&progress.exercisePassed||id==='quiz'&&progress.quizCorrect?<Check size={13}/>:<Icon size={13}/>}</span><strong>{label}</strong><small>{index+1}</small></button>)}</nav>
    <div className="lesson-reading-content" ref={readerRef}>
     {stage==='learn'&&<>
      <div className="reader-section-label">01 <span>UNDERSTAND THE IDEA</span></div><h2>One concept. A useful skill.</h2><p className="concept-copy">{lesson.concept}</p>
      <div className="why-card"><span className="why-icon"><Lightbulb size={19}/></span><div><h3>Why this matters in FiveM</h3><p>{lesson.why}</p></div></div>
      <h3 className="reader-subheading">A small example</h3><div className="lesson-example"><div><Code2 size={13}/><span>Read this first. Predict what happens.</span></div><pre><code>{lesson.example}</code></pre></div>
      {state.depth!=='Simple'&&<><h3 className="reader-subheading">Follow the code, line by line</h3><ol className="explanation-list">{lesson.explanation.map((line,index)=><li key={index}><span>{String(index+1).padStart(2,'0')}</span><p>{line}</p></li>)}</ol></>}
      {state.depth==='Simple'&&<details className="lesson-details"><summary>Show the line-by-line explanation</summary><ol>{lesson.explanation.map((line,index)=><li key={index}>{line}</li>)}</ol></details>}
      {state.depth==='Technical'&&lesson.technical&&<div className="technical-note"><span className="eyebrow">TECHNICAL CONTEXT</span><p>{lesson.technical}</p></div>}
      <div className="reader-stage-footer"><span>Ready to make it your own?</span><button className="primary" onClick={()=>setStage('practice')}>Open exercise <ArrowRight size={15}/></button></div>
     </>}
     {stage==='practice'&&<>
      <div className="reader-section-label">02 <span>WRITE IT YOURSELF</span></div><h2>Your next small challenge</h2><p className="exercise-instructions">{lesson.exercise.instructions}</p>
      <div className={`execution-note ${lesson.exercise.mode==='lua'?'':'simulated'}`}><ShieldCheck size={17}/><p>{lesson.exercise.mode==='lua'?'Your code runs in an isolated Lua 5.4 environment. The checks test what your code does.':lesson.exercise.mode==='fivem'?'This exercise uses a small educational mock. It cannot run the game or prove in-game behavior.':'These checks inspect Lua syntax and selected code patterns. They do not run FiveM, prove security, or replace testing on a local development server.'}</p></div>
      {saveProject&&files['fxmanifest.lua']!==undefined&&<div className="lesson-project-bridge"><p>Keep building with your edited lesson files. The playground can check and export them as a resource.</p><button className="secondary" onClick={()=>saveProject(files,lesson.title)}><FolderOpen size={14}/>Open resource in playground</button></div>}
      <div className="practice-checklist"><span className="eyebrow">A GOOD PRACTICE LOOP</span><p><span>1</span>Predict the result before you run.</p><p><span>2</span>Write or change the code in the editor.</p><p><span>3</span>Read the feedback. Explain your next change.</p></div>
      <div className="hint-header"><h3><Lightbulb size={17}/> Need a nudge?</h3><span>{progress.hints}/3 hints opened</span></div>
      {lesson.exercise.hints.slice(0,progress.hints).map((hint,index)=><div className="hint-card" key={index}><span>HINT {index+1}</span><p>{hint}</p></div>)}
      <div className="button-row lesson-help-buttons"><button className="secondary" disabled={progress.hints>=3} onClick={showHint}><Lightbulb size={14}/>{progress.hints===0?'Get a conceptual hint':progress.hints<3?'Show next hint':'All hints opened'}</button><button className="text-button" onClick={()=>{setRevealed(true);setCompare(true);setIndependent(false)}}><Eye size={14}/>{revealed?'Compare with solution':'Reveal solution'}</button></div>
      {revealed&&<p className="solution-note">The example solution is now available in Compare view. Explain each change before applying it to your own code.</p>}
      <div className="independent-card"><div className="eyebrow"><Target size={14}/> INDEPENDENT CHALLENGE</div><h3>Try it without the guide</h3><p>{lesson.challenge}</p><button className="text-button" onClick={()=>{setIndependent(true);setCompare(false)}}>Open independent workspace <ArrowRight size={14}/></button><small>This is self-reviewed practice. It does not automatically pass the guided exercise.</small></div>
      {progress.exercisePassed&&<div className="reader-stage-footer"><span className="success-copy"><CheckCircle2 size={16}/> Exercise checks passed</span><button className="primary" onClick={()=>setStage('quiz')}>Check understanding <ArrowRight size={15}/></button></div>}
     </>}
     {stage==='quiz'&&<>
      <div className="reader-section-label">03 <span>CHECK YOUR UNDERSTANDING</span></div><h2>Can you explain why?</h2><p className="quiz-question">{lesson.quiz.question}</p>
      <div className="quiz-options" role="radiogroup" aria-label={lesson.quiz.question}>{lesson.quiz.options.map((option,index)=><button role="radio" aria-checked={progress.quizAnswer===index} key={option} className={`${progress.quizAnswer===index?'selected':''} ${progress.quizCorrect!==undefined&&progress.quizAnswer===index?(progress.quizCorrect?'correct':'incorrect'):''}`} onClick={()=>editProgress(p=>({...p,quizAnswer:index,quizCorrect:undefined,completed:false,updated:new Date().toISOString()}))}><span className="quiz-letter">{String.fromCharCode(65+index)}</span><span>{option}</span>{progress.quizAnswer===index?<span className="quiz-selected-dot"/>:null}</button>)}</div>
      <button className="primary" disabled={progress.quizAnswer===undefined} onClick={()=>editProgress(p=>({...p,quizCorrect:p.quizAnswer===lesson.quiz.answer,completed:p.completed&&p.quizAnswer===lesson.quiz.answer,updated:new Date().toISOString()}))}>Check answer <ArrowRight size={15}/></button>
      {progress.quizCorrect!==undefined&&<div className={`quiz-feedback ${progress.quizCorrect?'correct':'incorrect'}`} role="status">{progress.quizCorrect?<CheckCircle2 size={20}/>:<HelpCircle size={20}/>}<div><strong>{progress.quizCorrect?'You’ve got the idea.':'Let’s think through that again.'}</strong><p>{lesson.quiz.explanation}</p>{!progress.quizCorrect&&<button className="text-button" onClick={()=>setStage('learn')}>Revisit the explanation <ArrowRight size={13}/></button>}</div></div>}
      {progress.quizCorrect&&<div className="reader-stage-footer"><span>Connect what you learned.</span><button className="secondary" onClick={()=>setStage('review')}>Review lesson <ArrowRight size={15}/></button></div>}
     </>}
     {stage==='review'&&<>
      <div className="reader-section-label">04 <span>MAKE IT STICK</span></div><h2>Take these ideas with you</h2><ul className="review-points">{lesson.review.map(point=><li key={point}><CheckCircle2 size={17}/><span>{point}</span></li>)}</ul>
      <div className="reflection-card"><Target size={20}/><h3>Explain it without the editor</h3><p>Describe what your code does, why each important line exists, and one change that would break it. If you get stuck, revisit the explanation.</p></div>
      <div className="completion-checks"><h3>Before moving on</h3><button onClick={()=>setStage('practice')}>{progress.exercisePassed?<CheckCircle2 size={18}/>:<span className="empty-check"/>}<span>Write code that passes the exercise checks</span><ChevronRight size={14}/></button><button onClick={()=>setStage('quiz')}>{progress.quizCorrect?<CheckCircle2 size={18}/>:<span className="empty-check"/>}<span>Answer the knowledge check correctly</span><ChevronRight size={14}/></button></div>
      <button className="primary finish-lesson" disabled={!canComplete} onClick={finish}>{progress.completed?'Continue to next lesson':'Finish lesson & continue'} <ArrowRight size={16}/></button>{!canComplete&&<p className="muted completion-help">Complete the two checks above to save this lesson as finished.</p>}
     </>}
     <div className="lesson-source-links"><div className="eyebrow"><BookOpen size={13}/> GO TO THE SOURCE</div>{lesson.sources.map(id=>{const source=sources.find(item=>item.id===id);return source?<button key={id} onClick={()=>openSource(state.sourceOverrides[id]?.url??source.url)}><span>{source.title}<small>{source.kind==='framework'?'Framework documentation':source.kind==='official'?'Official documentation':'Educational reference'}</small></span><ExternalLink size={13}/></button>:null})}</div>
    </div>
   </section>
   <div className="lesson-resize-handle" role="separator" aria-label="Resize lesson and editor panels" aria-orientation="vertical" aria-valuenow={Math.round(leftWidth)} aria-valuemin={32} aria-valuemax={60} tabIndex={0} onKeyDown={event=>{if(event.key==='ArrowLeft'){event.preventDefault();setLeftWidth(value=>Math.max(32,value-2))}if(event.key==='ArrowRight'){event.preventDefault();setLeftWidth(value=>Math.min(60,value+2))}}} onPointerDown={event=>{event.currentTarget.setPointerCapture(event.pointerId);resize(event.clientX)}} onPointerMove={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))resize(event.clientX)}} onPointerUp={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId)}}><GripVertical size={12}/></div>
   <section className="lesson-coding">
    <div className="workspace-topline"><div><span className="workspace-file-icon"><Terminal size={17}/></span><div><strong>{independent?'Independent practice':compare?'Learn from the differences':'Your coding workspace'}</strong><small>{independent?'Saved separately · self-reviewed':compare?'Your code on the left · example on the right':status}</small></div></div><div className="workspace-view-controls">{(compare||independent)&&<button className="text-button" onClick={()=>{setCompare(false);setIndependent(false)}}><X size={13}/> Back to exercise</button>}{!compare&&!independent&&revealed&&<button className="text-button" onClick={()=>setCompare(true)}><Eye size={13}/> Compare</button>}</div></div>
    <div className="lesson-editor-container"><CodeEditor identity={`${lesson.id}${independent?'/independent':compare?'/compare':''}`} files={independent?{[scratchFile]:progress.files?.[scratchFile]??(scratchFile.endsWith('.lua')?'-- Write your independent challenge here.\n':'')}:compare?{[mainFile]:progress.code}:files} mainFile={independent?scratchFile:mainFile} solution={compare?lesson.exercise.solution:undefined} onError={notify} onChange={changed=>{if(independent){setScratchOutput(null);editProgress(p=>({...p,files:{...p.files,[scratchFile]:changed[scratchFile]},updated:new Date().toISOString()}))}else editFiles(changed)}}/></div>
    <div className="run-toolbar"><div className="run-mode"><span className="status-dot"/><span>{independent?'Independent practice':lesson.exercise.mode==='lua'?'Lua 5.4 sandbox':lesson.exercise.mode==='fivem'?'Educational mock · not a live game':'Static checks · not a live game'}</span></div><div className="button-row">{!independent&&<button className="text-button" onClick={()=>setResetOpen(true)} disabled={busy}><RotateCcw size={13}/>Reset</button>}<button className="primary run-checks" disabled={busy||compare||(independent&&!scratchFile.endsWith('.lua'))} title={independent&&!scratchFile.endsWith('.lua')?'No runtime is attached to this file type. Review the requirements and test it in a compatible local environment.':undefined} onClick={independent?runScratch:evaluate}><Play size={14}/>{busy?'Checking…':independent?(!scratchFile.endsWith('.lua')?'Self-review practice':lesson.exercise.mode==='lua'?'Run practice':'Check Lua syntax'):'Run checks'}</button></div></div>
    <div className="exercise-results" aria-live="polite">
     <div className="results-heading"><span><Terminal size={14}/> {independent?'PRACTICE OUTPUT':'FEEDBACK & OUTPUT'}</span>{!independent&&evaluation&&<strong className={evaluation.passed?'passed':'needs-work'}>{evaluation.results.filter(result=>result.passed).length}/{evaluation.results.length} checks passed</strong>}{!independent&&!evaluation&&progress.exercisePassed&&<span className="passed"><Check size={12}/> Previously passed</span>}</div>
     {independent?scratchOutput?<><p className={scratchOutput.ok?'passed':'needs-work'}>{scratchOutput.ok?(lesson.exercise.mode==='lua'?'Practice ran successfully. Review the result against your own requirements.':'Standard Lua syntax is valid. Test game behavior in FiveM.'):scratchOutput.error}</p>{scratchOutput.output.length>0&&<pre className="console-output">{scratchOutput.output.join('\n')}</pre>}</>:<div className="feedback-empty"><Terminal size={21}/><p>Your independent practice results will appear here.</p><small>No automatic grade is assigned to this challenge.</small></div>:evaluation?<><div className={`evaluation-banner ${evaluation.passed?'passed':'needs-work'}`}>{evaluation.passed?<CheckCircle2 size={18}/>:<HelpCircle size={18}/>}<div><strong>{evaluation.passed?'Your code passed these checks.':'A useful clue for your next change.'}</strong><small>{evaluation.mode}</small></div>{evaluation.passed&&<button className="text-button" onClick={()=>setStage(progress.quizCorrect?'review':'quiz')}>Next step <ArrowRight size={13}/></button>}</div><div className="check-results">{evaluation.results.map((result,index)=><details key={index} open={!result.passed}><summary>{result.passed?<CheckCircle2 size={14}/>:<XCircle size={14}/>}<span>{result.name}</span><small>{result.passed?'PASS':'REVIEW'}</small></summary><p>{result.detail}</p></details>)}</div>{evaluation.output.length>0&&<div className="console-block"><span className="eyebrow">PROGRAM OUTPUT</span><pre className="console-output">{evaluation.output.join('\n')}</pre></div>}{!evaluation.passed&&<p className="feedback-advice">Start with the first failed check. Read its message, change one thing, and run again. The lesson’s source links and progressive hints can help.</p>}</>:<div className="feedback-empty"><Terminal size={23}/><p>{progress.exercisePassed?'Your exercise passed on the last saved attempt.':'Write a little. Run it. Learn from the result.'}</p><small>{progress.exercisePassed?'Editing the exercise will require checking it again.':'Run checks to see actual syntax and exercise feedback here.'}</small></div>}
    </div>
   </section>
  </div>
  {resetOpen&&<div className="modal-scrim"><section className="modal lesson-reset-modal" role="dialog" aria-modal="true" aria-labelledby="reset-title"><RotateCcw size={24}/><h2 id="reset-title">Reset this exercise?</h2><p>This replaces your guided exercise files with the starter code and clears its passing result and hints. Your independent practice and quiz answer stay saved.</p><div className="button-row"><button className="secondary" onClick={()=>setResetOpen(false)}>Keep my code</button><button className="primary" onClick={reset}>Reset exercise</button></div></section></div>}
 </div>
}
