import {ArrowRight, ArrowUpRight, BookOpen, Boxes, Check, Clock3, Code2, Flag, Flame, FolderCode, Gamepad2, GraduationCap, RotateCcw, Trophy} from 'lucide-react';
import {lessons,modules,projects as briefs} from '../content';
import {nextLesson,streak} from '../lib/state';
import {missions} from '../lib/dispatch';
import type {AcademyState,Lesson} from '../types';
import type {Page} from '../App';

export function CityArtwork() {
  return <div className="learn-city"><img src="./learning-city.webp" alt="An isometric city block with a garage, a red coupe, palm trees and downtown towers"/></div>;
}

interface Props {
  state:AcademyState;
  openLesson:(lesson:Lesson)=>void;
  go:(page:Page)=>void;
  openProject:(id:string)=>void;
  play:()=>void;
}

export function LearnHome({state,openLesson,go,openProject,play}:Props) {
  const next = nextLesson(state,lessons);
  const completed = lessons.filter(l=>state.progress[l.id]?.completed).length;
  const activeModule = modules.find(m=>m.id===next.module)!;
  const progress = Object.values(state.progress);
  const quizzes = progress.filter(p=>p.quizCorrect!==undefined);
  const studyStreak = streak(state.studyDays);
  const accuracy = quizzes.length ? Math.round(quizzes.filter(p=>p.quizCorrect).length/quizzes.length*100)+'%' : '—';
  const review = lessons.filter(l=>state.progress[l.id]?.quizCorrect===false||(state.progress[l.id]?.attempts>0&&!state.progress[l.id]?.exercisePassed));
  const recent = [...state.projects].sort((a,b)=>Date.parse(b.updated)-Date.parse(a.updated)).slice(0,3);
  const completedModules = modules.filter(m=>lessons.filter(l=>l.module===m.id).every(l=>state.progress[l.id]?.completed)).length;
  const best = state.arcade?.bestScore;
  const cleared = state.dispatch?.completed.length ?? 0;
  const activities = [
    {title:'Output Arcade',description:'Read a Lua snippet and call the output before the reveal.',meta:best===undefined?'3 rounds per run':`Personal best · ${best}/3`,icon:Gamepad2,action:play,tone:'sky'},
    {title:'Project challenges',description:'Pick a brief and turn an idea into a working FiveM resource.',meta:`${briefs.length} project briefs`,icon:Flag,action:()=>go('challenges'),tone:'ember'},
    {title:'Resource playground',description:'Build and test your own scripts in a free-form workspace.',meta:state.projects.length?`${state.projects.length} saved resource${state.projects.length===1?'':'s'}`:'Lua workspace',icon:FolderCode,action:()=>go('playground'),tone:'mint'},
  ];
  return <div className="learn-home">
    <section className="learn-hero" aria-labelledby="home-title">
      <div className="learn-hero-copy">
        <p className="learn-kicker">Your workspace</p>
        <h1 id="home-title">Learn to script.<br/>Build your city<span>.</span></h1>
        <div className="learn-lesson-cue"><span>Up next</span><strong>{next.title}</strong><small>{activeModule.title} · {next.minutes} min</small></div>
        <div className="learn-actions"><button className="learn-primary" onClick={()=>openLesson(next)}>{completed===lessons.length?'Revisit lesson':'Continue learning'} <ArrowRight size={17}/></button><button className="learn-link" onClick={()=>go('curriculum')}>View learning path <ArrowUpRight size={15}/></button></div>
      </div>
      <button className="learn-dispatch-feature" onClick={()=>go('dispatch')} aria-label="Play City Dispatch">
        <img src="./city-dispatch.webp" alt="" width="1040" height="510"/>
        <span className="learn-dispatch-caption">
          <span><strong>City Dispatch</strong><small>{cleared ? `${cleared}/${missions.length} route stamps earned` : 'Drive a city bus with Lua'}</small></span>
          <span className="learn-dispatch-play"><span>{cleared===missions.length?'Replay routes':'Play routes'}</span><ArrowRight size={16}/></span>
        </span>
      </button>
    </section>
    <section aria-labelledby="practice-heading">
      <div className="learn-section-title"><h2 id="practice-heading">Practice studio</h2><span className="learn-rule"/></div>
      <div className="learn-activity-grid">{activities.map(({title,description,meta,icon:Icon,action,tone})=>
        <button key={title} className={'learn-activity '+tone} onClick={action} aria-label={'Open '+title}>
          <span className="learn-activity-top"><span className="learn-activity-icon"><Icon size={26} strokeWidth={1.65}/></span><ArrowUpRight size={17}/></span>
          <strong>{title}</strong><span className="learn-activity-desc">{description}</span><small>{meta}</small>
        </button>)}</div>
    </section>
    <section aria-labelledby="progress-heading">
      <div className="learn-section-title"><h2 id="progress-heading">Your progress</h2><span className="learn-rule"/><span className="learn-track">{state.track} track</span></div>
      <div className="learn-metrics">{[
        {icon:BookOpen,value:`${completed}/${lessons.length}`,label:'Lessons complete'},
        {icon:Code2,value:String(progress.filter(p=>p.exercisePassed).length),label:'Exercises passed'},
        {icon:GraduationCap,value:accuracy,label:'Quiz accuracy'},
        {icon:Flame,value:`${studyStreak} day${studyStreak===1?'':'s'}`,label:'Study streak'},
        {icon:Clock3,value:`${Math.floor(state.studySeconds/60)} min`,label:'Time invested'},
      ].map(({icon:Icon,label,value})=><div key={label}><Icon size={18}/><strong>{value}</strong><span>{label}</span></div>)}</div>
    </section>
    <div className="learn-home-bottom">
      <section><div className="learn-section-title"><h2>{review.length?'Practice again':'Recent resources'}</h2><span className="learn-rule"/></div>
        {review.length?review.slice(0,3).map(l=><button key={l.id} className="learn-list-row" onClick={()=>openLesson(l)}><RotateCcw size={18}/><span>{l.title}</span><ArrowRight size={16}/></button>)
        : recent.length?recent.map(p=><button className="learn-list-row" key={p.id} onClick={()=>openProject(p.id)}><FolderCode size={19}/><span>{p.name}<small>{Object.keys(p.files).length} files</small></span><ArrowRight size={16}/></button>)
        : <button className="learn-list-row" onClick={()=>go('playground')}><Boxes size={19}/><span>Create your first resource<small>Open the resource playground</small></span><ArrowRight size={16}/></button>}
      </section>
      <section><div className="learn-section-title"><h2>Milestones</h2><span className="learn-rule"/></div>
        {[{label:'Finish your first lesson',done:completed>0},{label:'Create a resource project',done:state.projects.length>0},{label:'Complete a course module',done:completedModules>0}].map(m=><div className={'learn-milestone '+(m.done?'earned':'')} key={m.label}>{m.done?<Check size={16}/>:<Trophy size={16}/>}<span>{m.label}</span>{m.done&&<small>Earned</small>}</div>)}
      </section>
    </div>
  </div>;
}
