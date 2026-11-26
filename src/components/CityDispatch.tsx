import {useLayoutEffect, useRef, useState} from 'react';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronDown, ChevronsRight,
  CircleCheck, Code2, Flag, Lightbulb, Play, Radio, Route, Ticket, Users,
} from 'lucide-react';
import type {UpdateState} from '../App';
import type {AcademyState} from '../types';
import {initialFrame, missions, runDispatch, type Direction, type DispatchFrame, type DispatchMission} from '../lib/dispatch';
import {runLua} from '../lib/runtime';
import {MAX_DISPATCH_DRAFT_LENGTH} from '../../electron/academy-state.mjs';
import './dispatch.css';

type Props = {state: AcademyState; update: UpdateState; goHome: () => void};
type Journey = Awaited<ReturnType<typeof runDispatch>>;
type Phase = 'ready' | 'checking' | 'driving' | 'finished';

const bearings = [
  {name: 'north', dx: 0, dy: -1, Icon: ArrowUp},
  {name: 'east', dx: 1, dy: 0, Icon: ArrowRight},
  {name: 'south', dx: 0, dy: 1, Icon: ArrowDown},
  {name: 'west', dx: -1, dy: 0, Icon: ArrowLeft},
] as const;

function address(x: number, y: number) {
  return String.fromCharCode(65 + x) + (y + 1);
}

function StreetMap({mission, frame, visited}: {mission: DispatchMission; frame: DispatchFrame; visited: DispatchFrame[]}) {
  const driven = new Set(visited.filter(step => step.action === 'drive').map(step => address(step.x, step.y)));
  return <>
    <div className="cd-map-layout" aria-hidden="true">
      <div className="cd-map-columns">{[...'ABCDEFG'].map(col => <span key={col}>{col}</span>)}</div>
      <div className="cd-map-rows">{mission.streets.map((_, y) => <span key={y}>{y + 1}</span>)}</div>
      <div className="cd-board">
        {mission.streets.flatMap((row, y) => [...row].map((tile, x) => {
          const coord = address(x, y);
          if (tile === '#') return <div key={coord} className={'cd-block cd-block-' + ((x + y * 2) % 4)}><i/><b/></div>;
          const stop = mission.stops.findIndex(point => point.x === x && point.y === y);
          const terminal = mission.terminus.x === x && mission.terminus.y === y;
          return <div key={coord} className={'cd-road' + (driven.has(coord) ? ' cd-driven' : '')}>
            <span className="cd-road-core"/>
            {bearings.filter(dir => mission.streets[y + dir.dy]?.[x + dir.dx] === '.').map(dir =>
              <i key={dir.name} className={'cd-link cd-' + dir.name}/>)}
            <span className="cd-road-dot"/>
            {stop >= 0 && <span className={'cd-station' + (frame.collected.includes(stop) ? ' cd-boarded' : '')}>
              {frame.collected.includes(stop) ? <Check size={12}/> : stop + 1}
            </span>}
            {terminal && <span className="cd-terminal"><Flag size={14}/></span>}
          </div>;
        }))}
        <div className="cd-bus-position" style={{left: (frame.x + .5) / 7 * 100 + '%', top: (frame.y + .5) / 5 * 100 + '%'}}>
          <div className={'cd-bus cd-face-' + frame.facing}><i/><b/></div>
          {frame.action === 'pickup' && <span className="cd-pickup-flash"><Check size={13}/></span>}
        </div>
      </div>
    </div>
    <details className="cd-map-text"><summary>Read street map <ChevronDown size={13}/></summary>
      <p>North is up. Each move travels one square. Your bus is at {address(frame.x, frame.y)}, facing {frame.facing}.</p>
      <p>{mission.stops.map((stop, i) => 'Stop ' + (i + 1) + ' at ' + address(stop.x, stop.y) + ' (' + stop.name + ')').join('. ')}. Finish at {address(mission.terminus.x, mission.terminus.y)}.</p>
      <ul>{mission.streets.map((row, y) => <li key={y}>Row {y + 1} streets: {[...row].flatMap((tile, x) => tile === '.' ? [address(x, y)] : []).join(', ')}</li>)}</ul>
    </details>
  </>;
}

function RouteDesk({mission, state, update, next}: Omit<Props, 'goHome'> & {mission: DispatchMission; next: () => void}) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [journey, setJourney] = useState<Journey>();
  const [step, setStep] = useState(0);
  const [problem, setProblem] = useState('');
  const generation = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const editor = useRef<HTMLTextAreaElement>(null);
  const gutter = useRef<HTMLDivElement>(null);
  const code = state.dispatch?.drafts[mission.id] ?? mission.starter;
  const frame = journey?.frames[step] ?? initialFrame(mission);
  const finished = phase === 'finished';
  const success = finished && journey?.pass;
  const allStamped = missions.every(m => state.dispatch?.completed.includes(m.id));

  function cancelPlayback() {
    generation.current++;
    window.clearTimeout(timer.current);
  }
  useLayoutEffect(() => () => cancelPlayback(), []);

  function changeScript(input: string) {
    const value = input.replaceAll('\0', '');
    if (value === code || value.length > MAX_DISPATCH_DRAFT_LENGTH) return;
    cancelPlayback();
    setJourney(undefined); setStep(0); setPhase('ready'); setProblem('');
    update(current => ({
      ...current,
      dispatch: {completed: current.dispatch?.completed ?? [], drafts: {...current.dispatch?.drafts, [mission.id]: value}},
    }));
  }

  function finish(run: Journey) {
    window.clearTimeout(timer.current);
    setStep(run.frames.length - 1); setPhase('finished');
    if (run.pass) update(current => {
      const completed = current.dispatch?.completed ?? [];
      if (completed.includes(mission.id)) return current;
      return {...current, dispatch: {drafts: current.dispatch?.drafts ?? {}, completed: [...completed, mission.id]}};
    });
  }

  async function play() {
    if (phase === 'checking' || phase === 'driving' || !code.trim()) return;
    cancelPlayback();
    const runId = generation.current;
    setPhase('checking'); setStep(0); setJourney(undefined); setProblem('');
    try {
      const run = await runDispatch(mission, code, runLua);
      if (generation.current !== runId) return;
      setJourney(run);
      if (run.frames.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        finish(run); return;
      }
      setPhase('driving');
      let index = 0;
      const delay = Math.min(390, Math.max(100, 6500 / run.frames.length));
      function advance() {
        if (generation.current !== runId) return;
        index++;
        setStep(index);
        if (index === run.frames.length - 1) finish(run);
        else timer.current = window.setTimeout(advance, delay);
      }
      timer.current = window.setTimeout(advance, delay);
    } catch {
      if (generation.current !== runId) return;
      setProblem('The route could not start. Run your script again.');
      setPhase('finished');
    }
  }

  const commandText = (direction: Direction | 'pickup') =>
    (code && !code.endsWith('\n') ? '\n' : '') + (direction === 'pickup' ? 'pickup()' : "drive('" + direction + "')") + '\n';
  function append(direction: Direction | 'pickup') {
    changeScript(code + commandText(direction));
    const input = editor.current;
    if (input) {
      input.focus({preventScroll: true});
      requestAnimationFrame(() => {
        if (editor.current !== input) return;
        input.setSelectionRange(input.value.length, input.value.length);
        input.scrollTop = input.scrollHeight;
      });
    }
  }

  return <div className="cd-workspace">
    <section className="cd-map-panel" aria-label="City route map">
      <div className="cd-panel-title"><span className="cd-panel-icon"><Route size={17}/></span>
        <h2>{mission.district}</h2><span className="cd-north"><ArrowUp size={13}/> N</span>
      </div>
      <StreetMap mission={mission} frame={frame} visited={journey?.frames.slice(0, step + 1) ?? []}/>
      <div className="cd-map-key"><span><i className="cd-key-bus"/>Your bus</span><span><i className="cd-key-stop"/>Pickup stop</span><span><Flag size={13}/>Terminus</span></div>
      <div className="cd-itinerary" aria-label="Route stops">
        {mission.stops.map((stop, i) => <span key={i} className={frame.collected.includes(i) ? 'on-board' : ''}>
          {frame.collected.includes(i) ? <Check size={15} aria-label="Picked up"/> : <Users size={15}/>}
          {stop.name}<small>{address(stop.x, stop.y)}</small>
        </span>)}
        <span><Flag size={15}/>{mission.terminus.name}<small>{address(mission.terminus.x, mission.terminus.y)}</small></span>
      </div>
    </section>
    <section className="cd-desk" aria-label="Dispatcher workspace">
      <div className="cd-mission-heading"><span className="cd-category">{mission.concept}</span><h2>{mission.title}</h2><p>{mission.brief}</p></div>
      <div className="cd-script">
        <div className="cd-file-tab"><Code2 size={15}/><label htmlFor="cd-script">Route script</label><small>Lua 5.4</small></div>
        <div className="cd-editor">
          <div className="cd-line-numbers" ref={gutter} aria-hidden="true">{code.split('\n').map((_, i) => <span key={i}>{i + 1}</span>)}</div>
          <textarea ref={editor} id="cd-script" value={code} spellCheck={false} autoCapitalize="off" autoCorrect="off" wrap="off" maxLength={MAX_DISPATCH_DRAFT_LENGTH}
            onChange={event => changeScript(event.target.value)} onScroll={event => {if (gutter.current) gutter.current.scrollTop = event.currentTarget.scrollTop;}}
            onKeyDown={event => {if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {event.preventDefault(); void play();}}}/>
        </div>
        <div className="cd-commands" role="group" aria-label="Append a command">
          <span>Append</span>{bearings.map(({name, Icon}) => <button type="button" key={name} title={"Append drive('" + name + "')"} aria-label={'Append drive ' + name}
            disabled={code.length + commandText(name).length > MAX_DISPATCH_DRAFT_LENGTH} onClick={() => append(name)}><Icon size={13}/>{name[0].toUpperCase()}</button>)}
          <button type="button" title="Append pickup()" aria-label="Append pickup" disabled={code.length + commandText('pickup').length > MAX_DISPATCH_DRAFT_LENGTH} onClick={() => append('pickup')}><Users size={13}/>Pickup</button>
        </div>
      </div>
      <div className="cd-run-row">
        {phase === 'driving' && journey
          ? <button type="button" className="cd-play" onClick={() => finish(journey)}><ChevronsRight size={17}/>Skip animation</button>
          : <button type="button" className="cd-play" onClick={() => void play()} disabled={phase === 'checking' || !code.trim()}><Play size={16} fill="currentColor"/>{phase === 'checking' ? 'Checking Lua…' : 'Play route'}</button>}
        <details className="cd-hint"><summary><Lightbulb size={15}/>Route hint</summary><p>{mission.hint}</p></details>
      </div>
      <div className={'cd-radio' + (finished ? success ? ' cd-win' : ' cd-retry' : '')} role="status">
        {success ? <Ticket size={21}/> : <Radio size={20}/>}
        <div><strong>{finished ? success ? 'Route stamp earned!' : 'Route needs a fix' : phase === 'checking' ? 'Starting the bus' : phase === 'driving' ? 'On route' : 'Dispatch radio'}</strong>
          <p>{finished ? problem || journey?.feedback : phase === 'driving' ? frame.note : phase === 'checking' ? 'Running your Lua script…' : 'Edit the script, then play it to watch your bus move.'}</p>
          {success && (allStamped ? <small className="cd-all-stamped"><CircleCheck size={14}/>All three routes stamped</small> : <button type="button" className="cd-next" onClick={next}>Next mission <ArrowRight size={14}/></button>)}
        </div>
      </div>
    </section>
  </div>;
}

export function CityDispatch({state, update, goHome}: Props) {
  const completed = state.dispatch?.completed ?? [];
  const [selected, setSelected] = useState(() => (missions.find(m => !completed.includes(m.id)) ?? missions[0]).id);
  const mission = missions.find(m => m.id === selected) ?? missions[0];
  const stampCount = missions.filter(m => completed.includes(m.id)).length;
  function next() {
    const nextMission = missions.find(m => !completed.includes(m.id));
    if (nextMission) setSelected(nextMission.id);
  }
  return <div className="city-dispatch">
    <button className="cd-back" type="button" onClick={goHome}><ArrowLeft size={14}/>Home</button>
    <header className="cd-heading"><div><h1>City Dispatch<span>.</span></h1><p>Program a city bus in Lua and earn a route stamp for every shift.</p></div>
      <div className="cd-stamp-count"><Ticket size={20}/><strong>{stampCount}/{missions.length}</strong> route stamps</div>
    </header>
    <div className="cd-shifts" role="group" aria-label="Choose a dispatch mission">
      {missions.map((item, i) => <button type="button" key={item.id} className={'cd-shift' + (item.id === mission.id ? ' selected' : '')}
        aria-pressed={item.id === mission.id} onClick={() => setSelected(item.id)}>
        <span className="cd-route-no">{String(i + 1).padStart(2, '0')}</span><span>{item.title}</span>
        {completed.includes(item.id) && <CircleCheck className="cd-stamp-icon" size={16} aria-label="Stamp earned"/>}
      </button>)}
    </div>
    <RouteDesk key={mission.id} mission={mission} state={state} update={update} next={next}/>
  </div>;
}
