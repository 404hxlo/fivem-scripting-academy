import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {ArrowRight,BookOpen,Braces,Check,ChevronRight,Code2,Flame,GraduationCap,LayoutDashboard,Library,PanelLeftClose,Settings,ShieldCheck,Sparkles,Target,Terminal,Trophy,X,FolderOpen} from 'lucide-react';
import {lessons,modules,projects as briefs} from './content';
import type {AcademyState,Lesson,Track} from './types';
import {download,localDay,newState,nextLesson,parseBackup,streak} from './lib/state';
import {LessonView} from './components/LessonView';
import {Playground} from './components/Playground';
import {Reference,SettingsView,TutorView} from './components/LibraryViews';
export type Page='dashboard'|'curriculum'|'lesson'|'challenges'|'playground'|'reference'|'tutor'|'settings';
export type UpdateState=(fn:(state:AcademyState)=>AcademyState)=>void;
const nav:[Page,string,typeof LayoutDashboard][]=[['dashboard','Overview',LayoutDashboard],['curriculum','Learning path',BookOpen],['challenges','Project challenges',Target],['playground','Playground',Code2],['reference','Reference library',Library],['tutor','Study companion',Sparkles]];
export default function App(){
 const [state,setState]=useState<AcademyState|null>(null);const [page,setPage]=useState<Page>('dashboard');const [toast,setToast]=useState('');const [loadError,setLoadError]=useState('');const [saveError,setSaveError]=useState('');const [saved,setSaved]=useState(true);const [collapsed,setCollapsed]=useState(false);const [selectedProject,setSelectedProject]=useState<string|undefined>();const saveQueue=useRef(Promise.resolve());
 const importing=useRef(false);
 const latest = useRef<AcademyState|null>(null);
 const written = useRef<AcademyState|null>(null);
 const notify=(message:string)=>setToast(message);
 useEffect(() => {
  let active = true;
  async function load() {
   try {
    const value = window.academy ? await window.academy.load() : localStorage.getItem('academy-state');
    if (!active) return;
    const initial = typeof value === 'string' ? parseBackup(value) : value;
    written.current = initial;
    setState(initial ?? newState());
   } catch (error) { if (active) setLoadError(String(error)); }
  }
  void load();
  return () => { active = false; };
 }, []);
 useLayoutEffect(() => {
  latest.current = state;
  if (!state || importing.current || written.current === state) return;
  setSaved(false);
  saveQueue.current = saveQueue.current.then(async () => {
   // A later edit can replace an older snapshot that has not started writing.
   if (state !== latest.current) return;
   try {
    if (window.academy) await window.academy.save(state);
    else localStorage.setItem('academy-state', JSON.stringify(state));
    written.current = state;
    if (state === latest.current) { setSaved(true); setSaveError(''); }
   } catch (error) {
    if (state === latest.current) setSaveError('Progress could not be saved: ' + String(error));
   }
  });
 }, [state]);
 useEffect(() => {
  function flushBeforeClose(event: BeforeUnloadEvent) {
   const snapshot = latest.current;
   if (!snapshot || snapshot === written.current || importing.current) return;
   try {
    if (window.academy) {
     if (!window.academy.saveBeforeClose(snapshot)) { event.preventDefault(); event.returnValue = true; }
    } else localStorage.setItem('academy-state', JSON.stringify(snapshot));
   } catch { event.preventDefault(); event.returnValue = true; }
  }
  window.addEventListener('beforeunload', flushBeforeClose);
  return () => window.removeEventListener('beforeunload', flushBeforeClose);
 }, []);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),6500);return()=>clearTimeout(t)},[toast]);
 useEffect(()=>{let activeAt=Date.now();const activity=()=>{activeAt=Date.now()};window.addEventListener('pointerdown',activity);window.addEventListener('keydown',activity);const timer=setInterval(()=>{if(document.hasFocus()&&document.visibilityState==='visible'&&Date.now()-activeAt<120000)setState(s=>s?.onboarded?{...s,studySeconds:s.studySeconds+15,studyDays:[...new Set([...s.studyDays,localDay()])]}:s)},15000);return()=>{clearInterval(timer);window.removeEventListener('pointerdown',activity);window.removeEventListener('keydown',activity)}},[]);
 const update:UpdateState=fn=>setState(s=>s?fn(s):s);
 function openLesson(lesson:Lesson){update(s=>({...s,currentLesson:lesson.id}));setPage('lesson')}
 async function importFromDisk() {
  if (!window.academy || importing.current) return;
  importing.current = true;
  try {
   await saveQueue.current;
   const snapshot = latest.current;
   if (snapshot && snapshot !== written.current) await window.academy.save(snapshot);
   const imported = await window.academy.importBackup();
   if (imported) {
    setState(imported);
    notify('Backup imported. Previous data has a recovery snapshot.');
   }
  } catch (error) { notify(String(error)); }
  finally {
   importing.current = false;
   setState(s => s ? {...s} : s);
  }
 }
 function saveLessonProject(files:Record<string,string>,title:string){if(!state)return;const stem=('academy_'+title.toLowerCase().replace(/[^a-z0-9]+/g,'_')).slice(0,40).replace(/_$/,'');let name=stem;let suffix=2;while(state.projects.some(p=>p.name===name))name=stem+'_'+suffix++;const id=crypto.randomUUID();update(s=>({...s,projects:[...s.projects,{id,name,template:'lesson',files:{...files},updated:new Date().toISOString(),history:[]}]}));setSelectedProject(id);setPage('playground');notify('Your lesson files are now a separate resource project. Check them before exporting.')}
 if(loadError)return <div className="fatal"><ShieldCheck size={38}/><h1>Your saved data could not be opened</h1><p>{loadError}</p><p>No data has been replaced. Check free disk space and the troubleshooting guide, then restart the app.</p><button onClick={()=>location.reload()}>Retry loading</button></div>;
 if(!state)return <div className="loading-screen"><GraduationCap size={40}/><p>Opening your academy…</p></div>;
 const completed=lessons.filter(l=>state.progress[l.id]?.completed).length;const percent=Math.round(completed/lessons.length*100);const activeLesson=lessons.find(l=>l.id===state.currentLesson)??nextLesson(state,lessons);const pageTitle=page==='lesson'?'Learning workspace':page==='settings'?'Settings':nav.find(n=>n[0]===page)?.[1];
 return <div className={`app-shell ${collapsed?'sidebar-collapsed':''}`}>
  <aside className="sidebar"><a className="brand" href="#" onClick={e=>{e.preventDefault();setPage('dashboard')}}><div className="brand-icon"><Terminal size={23}/></div><div>FiveM<span>SCRIPTING ACADEMY</span></div></a><div className="workspace-label">YOUR WORKSPACE</div><nav>{nav.map(([id,label,Icon])=><button key={id} className={(page===id||(id==='curriculum'&&page==='lesson'))?'active':''} onClick={()=>setPage(id)}><Icon size={18}/><span>{label}</span>{id==='curriculum'&&<small>{modules.length}</small>}</button>)}</nav><div className="sidebar-course"><div className="row"><span>Your learning journey</span><strong>{percent}%</strong></div><div className="progress-track"><i style={{width:`${percent}%`}}/></div><p>{completed} of {lessons.length} lessons completed</p><button onClick={()=>openLesson(nextLesson(state,lessons))}>Keep learning <ArrowRight size={14}/></button></div><div className="sidebar-bottom"><button className={page==='settings'?'active':''} onClick={()=>setPage('settings')}><Settings size={17}/><span>Settings & backups</span></button><div className="profile"><span className="avatar">D</span><div>Developer in the making<small>{state.track} track</small></div><span className="online-dot"/></div></div></aside>
  <div className="main-shell"><header className="topbar"><div className="breadcrumb"><button aria-label="Toggle sidebar" onClick={()=>setCollapsed(!collapsed)}><PanelLeftClose size={17}/></button><span>Workspace</span><ChevronRight size={13}/><strong>{pageTitle}</strong></div><div className="topbar-status"><span className="offline-badge"><span className="status-dot"/>{window.academy?'Offline ready':'Browser preview'}</span><span className="divider"/><span><Flame size={15}/>{streak(state.studyDays)} day streak</span><span className="avatar small">D</span></div></header>
   {saveError&&<div className="error-banner" role="alert">{saveError} <button onClick={()=>download('academy-recovery.json',JSON.stringify(state,null,2))}>Download recovery backup</button></div>}
   <main className={page==='lesson'?'main-content lesson-main':'main-content'}>
    {page==='dashboard'&&<Dashboard state={state} openLesson={openLesson} go={setPage} openProject={id=>{setSelectedProject(id);setPage('playground')}}/>}
    {page==='curriculum'&&<Curriculum state={state} openLesson={openLesson}/>}
    {page==='lesson'&&<LessonView key={activeLesson.id} lesson={activeLesson} state={state} update={update} notify={notify} saveProject={saveLessonProject} next={()=>{const index=lessons.findIndex(l=>l.id===activeLesson.id);if(index<lessons.length-1)openLesson(lessons[index+1]);else setPage('dashboard')}}/>}
    {(page==='challenges'||page==='playground')&&<Playground state={state} update={update} notify={notify} briefs={briefs} challengeMode={page==='challenges'} initialProject={selectedProject}/>}
    {page==='reference'&&<Reference state={state} update={update} notify={notify} openLesson={openLesson}/>}
    {page==='tutor'&&<TutorView notify={notify} lesson={activeLesson} state={state} openLesson={openLesson}/>}
    {page==='settings'&&<SettingsView state={state} update={update} notify={notify} importFromDisk={importFromDisk}/>}
   </main><footer className="app-footer"><span><span className="status-dot"/>{saveError?'Save needs attention':saved?'All changes saved locally':'Saving…'}</span><span>Lua 5.4 <span className="footer-sep">·</span> Learn. Build. Understand.</span></footer>
  </div>{toast&&<div className="toast" role="status"><Check size={17}/>{toast}<button aria-label="Dismiss message" onClick={()=>setToast('')}><X size={16}/></button></div>}
  {!state.onboarded&&<Welcome onFinish={(track)=>{update(s=>({...s,onboarded:true,track,currentLesson:lessons.find(l=>l.module===(track==='Beginner'?1:track==='Intermediate'?2:8))?.id??lessons[0].id}));setPage('lesson')}}/>}
 </div>
}
function Dashboard({state,openLesson,go,openProject}:{state:AcademyState;openLesson:(l:Lesson)=>void;go:(p:Page)=>void;openProject:(id:string)=>void}){
 const completed=lessons.filter(l=>state.progress[l.id]?.completed).length;const tested=Object.values(state.progress).filter(p=>p.quizCorrect!==undefined);const accuracy=tested.length?Math.round(tested.filter(p=>p.quizCorrect).length/tested.length*100):0;const next=nextLesson(state,lessons);const exercises=Object.values(state.progress).filter(p=>p.exercisePassed).length;const mastered=modules.filter(m=>lessons.some(l=>l.module===m.id)&&lessons.filter(l=>l.module===m.id).every(l=>state.progress[l.id]?.completed));const review=lessons.filter(l=>state.progress[l.id]?.quizCorrect===false||(state.progress[l.id]?.attempts>0&&!state.progress[l.id]?.exercisePassed));
 return <><div className="page-heading"><div><div className="eyebrow purple">YOUR NEXT CHAPTER STARTS HERE</div><h1>Build skills. Create your own world.</h1><p>A little practice today. More independence with every script.</p></div><span className="track-pill"><GraduationCap size={16}/>{state.track} track</span></div>
 <div className="stats-grid"><Stat icon={BookOpen} label="Lessons completed" value={`${completed}`} suffix={`/ ${lessons.length}`} detail={`${lessons.length-completed} lessons to explore`}/><Stat icon={Braces} label="Challenges passed" value={`${exercises}`} detail="Code you wrote and checked"/><Stat icon={Target} label="Quiz accuracy" value={tested.length?`${accuracy}%`:'—'} detail={tested.length?`${tested.length} knowledge checks answered`:'Your first check is ahead'}/><Stat icon={Flame} label="Time invested" value={`${Math.floor(state.studySeconds/60)}`} suffix="min" detail={`${streak(state.studyDays)} day learning streak`}/></div>
 <div className="dashboard-columns"><section className="continue-card"><div className="continue-copy"><div className="eyebrow"><span className="live-dot"/> {completed?'PICK UP WHERE YOU LEFT OFF':'START WITH THE FOUNDATIONS'}</div><span className="module-label">MODULE {String(next.module).padStart(2,'0')} <span> / </span> {modules.find(m=>m.id===next.module)?.title}</span><h2>{next.title}</h2><p>{next.why}</p><div className="continue-meta"><span><BookOpen size={14}/> Interactive lesson</span><span>◷ {next.minutes} min</span><span>Lua 5.4</span></div><button className="primary" onClick={()=>openLesson(next)}>Continue learning <ArrowRight size={16}/></button></div><div className="code-preview"><div><span/><span/><span/><small>your_next_chapter.lua</small></div><pre><span className="code-comment">-- Great scripts start with understanding.</span>{'\n\n'}<span className="code-purple">local</span> developer = <span className="code-green">"you"</span>{'\n'}<span className="code-purple">local</span> progress = <span className="code-orange">0</span>{'\n\n'}<span className="code-purple">function</span> learn(concept){'\n'}    practice(concept){'\n'}    progress = progress + <span className="code-orange">1</span>{'\n'}<span className="code-purple">end</span>{'\n\n'}<span className="code-comment">-- One concept. One working script.</span></pre><div className="code-preview-footer"><span className="status-dot"/> Illustrative pseudocode</div></div></section>
 <section className="focus-card"><div className="icon-tile"><ShieldCheck size={24}/></div><span className="eyebrow">UNDERSTANDING FIRST</span><h3>You write the code.<br/>You build the confidence.</h3><p>Explore a concept, try it yourself, and get feedback that explains why.</p><div className="focus-point"><Check size={14}/> Real Lua 5.4 exercises</div><div className="focus-point"><Check size={14}/> Hints before solutions</div><div className="focus-point"><Check size={14}/> Progress stays on your device</div></section></div>
 <div className="section-heading"><div><h2>Your learning path <span className="count-badge">9 modules</span></h2><p>From your first line of Lua to complete FiveM systems.</p></div><button className="text-button" onClick={()=>go('curriculum')}>View full curriculum <ArrowRight size={15}/></button></div>
 <div className="module-grid">{modules.slice(0,6).map(m=>{const ls=lessons.filter(l=>l.module===m.id);const n=ls.filter(l=>state.progress[l.id]?.completed).length;return <button className={`module-card ${next.module===m.id?'current':''}`} key={m.id} onClick={()=>openLesson(ls.find(l=>!state.progress[l.id]?.completed)??ls[0])}><div className="row"><span className="module-number">{String(m.id).padStart(2,'0')}</span>{next.module===m.id?<span className="mini-tag">IN PROGRESS</span>:<ChevronRight size={17}/>}</div><h3>{m.title}</h3><p>{m.subtitle}</p><div className="module-card-foot"><span>{ls.length} lessons</span><span>{n}/{ls.length}</span></div><div className="progress-track"><i style={{width:`${(ls.length?n/ls.length*100:0)}%`}}/></div></button>})}</div>
 <div className="bottom-grid"><section className="surface"><div className="section-heading compact"><h3>Practice makes progress</h3><Trophy size={18}/></div><div className="achievement-row"><span className={`achievement-icon ${completed?'earned':''}`}><Terminal size={22}/></span><div><strong>First steps</strong><p>{completed?'Earned · You finished your first lesson.':'Finish your first lesson to earn this milestone.'}</p></div></div><div className="achievement-row"><span className={`achievement-icon ${state.projects.length?'earned':''}`}><FolderOpen size={22}/></span><div><strong>Resource creator</strong><p>{state.projects.length?'Earned · Your first resource workspace is ready.':'Create your first project in the playground.'}</p></div></div><div className="achievement-row"><span className={`achievement-icon ${mastered.length?'earned':''}`}><GraduationCap size={22}/></span><div><strong>Concepts connected</strong><p>{mastered.length?`${mastered.length} modules mastered.`:'Complete every lesson in a module.'}</p></div></div></section><section className="surface"><div className="section-heading compact"><h3>{review.length?'Worth another look':'Your workbench'}</h3><button className="text-button" onClick={()=>go(review.length?'curriculum':'playground')}>Open <ArrowRight size={14}/></button></div>{review.length?review.slice(0,3).map(l=><button key={l.id} className="recent-row" onClick={()=>openLesson(l)}><BookOpen size={18}/><div><strong>{l.title}</strong><small>Review the concept, then try again</small></div><ChevronRight size={16}/></button>):state.projects.length?[...state.projects].sort((a,b)=>Date.parse(b.updated)-Date.parse(a.updated)).slice(0,3).map(p=><button className="recent-row" key={p.id} onClick={()=>openProject(p.id)}><FolderOpen size={18}/><div><strong>{p.name}</strong><small>{Object.keys(p.files).length} files · {new Date(p.updated).toLocaleDateString()}</small></div><ChevronRight size={16}/></button>):<div className="empty-workbench"><Code2 size={30}/><p>Your next idea belongs here.</p><small>Create and export your own FiveM resources.</small><button className="secondary" onClick={()=>go('playground')}>Open playground <ArrowRight size={14}/></button></div>}</section></div>
 <div className="source-note"><ShieldCheck size={15}/><span>Built around official Cfx.re documentation. Original lessons, verified source links, and clear simulation boundaries.</span><button onClick={()=>go('reference')}>Explore sources <ArrowRight size={13}/></button></div></>
}
function Stat({icon:Icon,label,value,suffix,detail}:{icon:typeof BookOpen;label:string;value:string;suffix?:string;detail:string}){return <div className="stat"><div className="stat-label">{label}<Icon size={17}/></div><div className="stat-value">{value}<span>{suffix}</span></div><small>{detail}</small></div>}
function Curriculum({state,openLesson}:{state:AcademyState;openLesson:(l:Lesson)=>void}){const [query,setQuery]=useState('');return <><div className="page-heading"><div><div className="eyebrow purple">A PATH TO INDEPENDENCE</div><h1>Your development curriculum</h1><p>{lessons.length} lessons. Nine modules. Learn at your pace and revisit anything.</p></div><input className="search-input" placeholder="Find a lesson or concept…" value={query} onChange={e=>setQuery(e.target.value)} aria-label="Find a lesson"/></div>{modules.map(m=>{const items=lessons.filter(l=>l.module===m.id&&`${l.title} ${l.concept}`.toLowerCase().includes(query.toLowerCase()));if(!items.length)return null;return <section className="curriculum-module surface" key={m.id}><div className="module-heading"><span className="module-number">{String(m.id).padStart(2,'0')}</span><div><h2>{m.title}</h2><p>{m.subtitle}</p></div><span className="tag">{items.filter(l=>state.progress[l.id]?.completed).length}/{items.length} completed</span></div><div className="lesson-list">{items.map((l,i)=><button onClick={()=>openLesson(l)} key={l.id}><span className={`lesson-check ${state.progress[l.id]?.completed?'done':''}`}>{state.progress[l.id]?.completed?<Check size={15}/>:String(i+1).padStart(2,'0')}</span><div><strong>{l.title}</strong><small>{l.level} · {l.exercise.mode==='lua'?'Executable Lua':'FiveM / structural checks'}</small></div><span>{l.minutes} min</span><ChevronRight size={16}/></button>)}</div><div className="module-project"><Braces size={17}/><span>Practical project: {m.project}</span></div></section>})}</>}
function Welcome({onFinish}:{onFinish:(track:Track)=>void}){const [track,setTrack]=useState<Track>('Beginner');const [assessment,setAssessment]=useState(false);const [answers,setAnswers]=useState<number[]>([]);const qs=[{q:'What does local score = 10 do?',a:['Creates a variable holding a number','Runs a game command','Opens a file'],correct:0},{q:'Who should decide whether a player can receive money?',a:['The requesting client','The server after validation','The NUI browser'],correct:1},{q:'Why does a continuous FiveM thread need Wait?',a:['To save a file','To load a manifest','To yield so other work can run'],correct:2}];return <div className="modal-scrim"><section className="welcome modal" aria-label="Welcome to the academy"><div className="welcome-logo"><Terminal size={32}/></div><span className="eyebrow purple">WELCOME TO YOUR WORKSPACE</span><h1>Become the developer<br/>behind your ideas.</h1><p>Learn Lua. Understand FiveM. Build systems you can call your own.<br/>No account, API key, or server needed to begin.</p><div className="track-options">{(['Beginner','Intermediate','Advanced'] as Track[]).map(t=><button className={track===t?'selected':''} onClick={()=>setTrack(t)} key={t}><span>{t}<span className="radio-dot"/></span><small>{t==='Beginner'?'I’m starting from the beginning.':t==='Intermediate'?'I know Lua basics. Let’s learn FiveM.':'I want to build complete systems.'}</small></button>)}</div><button className="text-button" onClick={()=>setAssessment(!assessment)}>{assessment?'Hide assessment':'Not sure? Take a quick optional assessment'} <ChevronRight size={14}/></button>{assessment&&<div className="assessment">{qs.map((q,i)=><div key={q.q}><strong>{q.q}</strong><select aria-label={q.q} value={answers[i]??-1} onChange={e=>setAnswers(a=>{const n=[...a];n[i]=Number(e.target.value);return n})}><option value={-1}>Choose an answer</option>{q.a.map((a,j)=><option key={a} value={j}>{a}</option>)}</select></div>)}{answers.filter(a=>a>=0).length===3&&<p>Recommended: {answers.every((a,i)=>a===qs[i].correct)?'Intermediate':'Beginner'}. You can choose any track above.</p>}</div>}<button className="primary wide" onClick={()=>onFinish(track)}>Start learning <ArrowRight size={16}/></button><small className="muted">Change tracks anytime. Your progress always stays with you.</small></section></div>}
