import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Braces,Check,ChevronRight,GraduationCap,ShieldCheck,X} from 'lucide-react';
import {lessons,modules,projects as briefs} from './content';
import type {AcademyState,Lesson} from './types';
import {download,localDay,newState,nextLesson,readBrowserProfile,saveBrowserProfile} from './lib/state';
import {MAX_PROJECTS} from '../electron/academy-state.mjs';
import {LessonView} from './components/LessonView';
import {BrowserRecovery} from './components/BrowserProfile';
import {Playground} from './components/Playground';
import {Reference,SettingsView,TutorView} from './components/LibraryViews';
import {LearnHeader} from './components/LearnHeader';
import {LearnHome} from './components/LearnHome';
import {LearnWelcome} from './components/LearnWelcome';
import {OutputArcade} from './components/OutputArcade';
import {CityDispatch} from './components/CityDispatch';
export type Page='dashboard'|'curriculum'|'lesson'|'dispatch'|'challenges'|'playground'|'reference'|'tutor'|'settings';
export type UpdateState=(fn:(state:AcademyState)=>AcademyState)=>void;
export default function App(){
 const [state,setState]=useState<AcademyState|null>(null);const [page,setPage]=useState<Page>('dashboard');const [toast,setToast]=useState('');const [loadError,setLoadError]=useState('');const [saveError,setSaveError]=useState('');const [saved,setSaved]=useState(true);const [arcadeOpen,setArcadeOpen]=useState(false);const [selectedProject,setSelectedProject]=useState<string|undefined>();const saveQueue=useRef(Promise.resolve());
 const importing=useRef(false);
 useLayoutEffect(()=>{window.scrollTo(0,0)},[page,page==='lesson'?state?.currentLesson:null]);
 const latest = useRef<AcademyState|null>(null);
 const written = useRef<AcademyState|null>(null);
 const notify=(message:string)=>setToast(message);
 useEffect(() => {
  let active = true;
  async function load() {
   try {
    const profile = window.academy ? {state: await window.academy.load(), renamed: []} : readBrowserProfile(localStorage.getItem('academy-state'));
    if (!active) return;
    if (profile.renamed.length) setToast('Recovered Windows resource names: ' + profile.renamed.join(', '));
    written.current = profile.renamed.length ? null : profile.state;
    setState(profile.state ?? newState());
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
    else saveBrowserProfile(state);
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
    } else saveBrowserProfile(snapshot);
   } catch { event.preventDefault(); event.returnValue = true; }
  }
  window.addEventListener('beforeunload', flushBeforeClose);
  return () => window.removeEventListener('beforeunload', flushBeforeClose);
 }, []);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),6500);return()=>clearTimeout(t)},[toast]);
 useEffect(()=>{let activeAt=Date.now();const activity=()=>{activeAt=Date.now()};window.addEventListener('pointerdown',activity);window.addEventListener('keydown',activity);const timer=setInterval(()=>{if(document.hasFocus()&&document.visibilityState==='visible'&&Date.now()-activeAt<120000)setState(s=>s?.onboarded?{...s,studySeconds:s.studySeconds+15,studyDays:[...new Set([...s.studyDays,localDay()])]}:s)},15000);return()=>{clearInterval(timer);window.removeEventListener('pointerdown',activity);window.removeEventListener('keydown',activity)}},[]);
 const update:UpdateState=fn=>setState(s=>s?fn(s):s);
 function openLesson(lesson:Lesson){update(s=>({...s,currentLesson:lesson.id}));setPage('lesson')}
 function importBrowserProfile(replacement: AcademyState) {
  if (!state) return;
  try {
   // Request a recovery download even if the previous unsaved edits are over
   // a persistence limit. Replace the visible profile only after storage accepts it.
   download('academy-before-import.json', JSON.stringify(state, null, 2));
   saveBrowserProfile(replacement);
   written.current = replacement;
   setState(replacement);
   setSaved(true);
   setSaveError('');
   notify('Backup imported.');
  } catch (error) {
   notify('Could not import this backup. Your current profile is still open. ' + String(error));
  }
 }
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
 function saveLessonProject(files:Record<string,string>,title:string){if(!state)return;if(state.projects.length>=MAX_PROJECTS){notify(`Your profile already contains the maximum of ${MAX_PROJECTS} projects.`);return}const stem=('academy_'+title.toLowerCase().replace(/[^a-z0-9]+/g,'_')).slice(0,40).replace(/_$/,'');let name=stem;let suffix=2;while(state.projects.some(p=>p.name===name))name=stem+'_'+suffix++;const id=crypto.randomUUID();update(s=>({...s,projects:[...s.projects,{id,name,template:'lesson',files:{...files},updated:new Date().toISOString(),history:[]}]}));setSelectedProject(id);setPage('playground');notify('Your lesson files are now a separate resource project. Check them before exporting.')}
 if(loadError&&!window.academy)return <BrowserRecovery error={loadError}/>;
 if(loadError)return <div className="fatal"><ShieldCheck size={38}/><h1>Your saved data could not be opened</h1><p>{loadError}</p><p>No data has been replaced. Check free disk space and the troubleshooting guide, then restart the app.</p><button onClick={()=>location.reload()}>Retry loading</button></div>;
 if(!state)return <div className="loading-screen"><GraduationCap size={40}/><p>Opening Brick by Script Learn…</p></div>;
 const activeLesson=lessons.find(l=>l.id===state.currentLesson)??nextLesson(state,lessons);
 if (!state.onboarded) return <div className="app-shell learn-shell">
   <LearnHeader page={page} go={setPage} onboarding/>
   <main className="learn-welcome-main"><LearnWelcome onFinish={(track,destination)=>{
     update(s=>({...s,onboarded:true,track,currentLesson:lessons.find(l=>l.module===(track==='Beginner'?1:track==='Intermediate'?2:8))?.id??lessons[0].id}));
     setPage(destination);
   }}/></main>
 </div>;
 return <div className="app-shell learn-shell">
  <LearnHeader page={page} go={setPage} play={()=>setArcadeOpen(true)}/>
  <div className="learn-body">
   {saveError&&<div className="error-banner" role="alert">{saveError} <button onClick={()=>download('academy-recovery.json',JSON.stringify(state,null,2))}>Download recovery backup</button></div>}
   <main key={page==='lesson'?activeLesson.id:page} className={page==='lesson'?'main-content lesson-main':page==='dashboard'?'learn-home-main':'main-content'}>
    {page==='dashboard'&&<LearnHome play={()=>setArcadeOpen(true)} state={state} openLesson={openLesson} go={setPage} openProject={id=>{setSelectedProject(id);setPage('playground')}}/>}
    {page==='dispatch'&&<CityDispatch state={state} update={update} goHome={()=>setPage('dashboard')}/>}
    {page==='curriculum'&&<Curriculum state={state} openLesson={openLesson}/>}
    {page==='lesson'&&<LessonView key={activeLesson.id} lesson={activeLesson} state={state} update={update} notify={notify} saveProject={saveLessonProject} next={()=>{const index=lessons.findIndex(l=>l.id===activeLesson.id);if(index<lessons.length-1)openLesson(lessons[index+1]);else setPage('dashboard')}}/>}
    {(page==='challenges'||page==='playground')&&<Playground key={page} onSelectProject={setSelectedProject} state={state} update={update} notify={notify} briefs={briefs} challengeMode={page==='challenges'} initialProject={selectedProject}/>}
    {page==='reference'&&<Reference state={state} update={update} notify={notify} openLesson={openLesson}/>}
    {page==='tutor'&&<TutorView notify={notify} lesson={activeLesson} state={state} openLesson={openLesson}/>}
    {page==='settings'&&<SettingsView state={state} update={update} notify={notify} importFromDisk={importFromDisk} importBrowserProfile={importBrowserProfile}/>}
   </main><footer className="app-footer"><span><span className="status-dot"/>{saveError?'Save needs attention':saved?'All changes saved locally':'Saving…'}</span><span>Brick by Script Learn <span className="footer-sep">·</span> Lua 5.4</span></footer>
  </div>{toast&&<div className="toast" role="status"><Check size={17}/>{toast}<button aria-label="Dismiss message" onClick={()=>setToast('')}><X size={16}/></button></div>}
  {arcadeOpen&&<OutputArcade state={state} update={update} onClose={()=>setArcadeOpen(false)}/>}
 </div>
}
function Curriculum({state,openLesson}:{state:AcademyState;openLesson:(l:Lesson)=>void}){const [query,setQuery]=useState('');return <><div className="page-heading"><div><div className="eyebrow purple">A PATH TO INDEPENDENCE</div><h1>Your development curriculum</h1><p>{lessons.length} lessons. Nine modules. Learn at your pace and revisit anything.</p></div><input className="search-input" placeholder="Find a lesson or concept…" value={query} onChange={e=>setQuery(e.target.value)} aria-label="Find a lesson"/></div>{modules.map(m=>{const items=lessons.filter(l=>l.module===m.id&&`${l.title} ${l.concept}`.toLowerCase().includes(query.toLowerCase()));if(!items.length)return null;return <section className="curriculum-module surface" key={m.id}><div className="module-heading"><span className="module-number">{String(m.id).padStart(2,'0')}</span><div><h2>{m.title}</h2><p>{m.subtitle}</p></div><span className="tag">{items.filter(l=>state.progress[l.id]?.completed).length}/{items.length} completed</span></div><div className="lesson-list">{items.map((l,i)=><button onClick={()=>openLesson(l)} key={l.id}><span className={`lesson-check ${state.progress[l.id]?.completed?'done':''}`}>{state.progress[l.id]?.completed?<Check size={15}/>:String(i+1).padStart(2,'0')}</span><div><strong>{l.title}</strong><small>{l.level} · {l.exercise.mode==='lua'?'Executable Lua':'FiveM / structural checks'}</small></div><span>{l.minutes} min</span><ChevronRight size={16}/></button>)}</div><div className="module-project"><Braces size={17}/><span>Practical project: {m.project}</span></div></section>})}</>}
