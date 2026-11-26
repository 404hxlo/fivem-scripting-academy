import {useState} from 'react';
import {ArrowRight, BusFront, Check, ChevronDown} from 'lucide-react';
import type {Track} from '../types';
import {CityArtwork} from './LearnHome';

const tracks: {name:Track; detail:string}[] = [
  {name:'Beginner',detail:'Start with your first line of Lua.'},
  {name:'Intermediate',detail:'Build your first FiveM resource.'},
  {name:'Advanced',detail:'Design and test complete systems.'},
];
const questions = [
  {q:'What does local score = 10 do?',a:['Creates a variable holding a number','Runs a game command','Opens a file'],correct:0},
  {q:'Who should decide whether a player can receive money?',a:['The requesting client','The server after validation','The NUI browser'],correct:1},
  {q:'Why does a continuous FiveM thread need Wait?',a:['To save a file','To load a manifest','To yield so other work can run'],correct:2},
];
export function LearnWelcome({onFinish}:{onFinish:(track:Track,destination:'lesson'|'dispatch')=>void}) {
  const [track,setTrack] = useState<Track>('Beginner');
  const [answers,setAnswers] = useState<number[]>([-1,-1,-1]);
  return <div className="welcome learn-welcome">
    <div className="learn-welcome-intro"><div><p className="learn-kicker">Welcome to Brick by Script Learn</p>
      <h1>Build your first<br/>FiveM script<span>.</span></h1>
      <p>Write real Lua, play code challenges, and build resources for your city. Pick a starting point below.</p>
    </div><CityArtwork/></div>
    <fieldset className="learn-tracks"><legend>Choose your track</legend><div>{tracks.map(t=>
      <label key={t.name} className={track===t.name?'selected':''}><input type="radio" name="learning-track" value={t.name} checked={track===t.name} onChange={()=>setTrack(t.name)}/>
        <span><strong>{t.name}</strong><span className="learn-track-indicator">{track===t.name&&<Check size={13}/>}</span></span><small>{t.detail}</small>
      </label>)}</div></fieldset>
    <div className="learn-welcome-actions"><button className="learn-primary" onClick={()=>onFinish(track,'lesson')}>Start learning <ArrowRight size={17}/></button><button className="learn-link" onClick={()=>onFinish(track,'dispatch')}><BusFront size={16}/> Try City Dispatch</button><span>You can switch tracks anytime.</span></div>
    <details className="learn-assessment"><summary>Help me choose a track <ChevronDown size={15}/></summary>
      <div className="assessment">{questions.map((q,i)=><label key={q.q}>{q.q}<select value={answers[i]} onChange={e=>{const choice=Number(e.target.value);setAnswers(a=>a.map((old,j)=>i===j?choice:old))}}>
        <option value={-1}>Choose an answer</option>{q.a.map((a,j)=><option key={a} value={j}>{a}</option>)}</select></label>)}
        {answers.every(a=>a>=0)&&<p>Recommended track: <strong>{answers.every((a,i)=>a===questions[i].correct)?'Intermediate':'Beginner'}</strong>. Choose your track above to start.</p>}
      </div>
    </details>
  </div>;
}
