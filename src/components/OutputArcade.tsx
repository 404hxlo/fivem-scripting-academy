import {useLayoutEffect, useRef, useState} from 'react';
import {ArrowRight, Check, Circle, Gamepad2, RotateCcw, Terminal, Trophy, X} from 'lucide-react';
import {dealArcade} from '../lib/arcade';
import type {AcademyState} from '../types';
import './arcade.css';

interface Props {
  state: AcademyState;
  update: (change: (profile: AcademyState) => AcademyState) => void;
  onClose: () => void;
}

function CodeSample({source}: {source: string}) {
  const parts = source.split(/('[^']*'|\b(?:local|function|return|for|do|end|if|then|else|while)\b|\b\d+\b)/g);
  return <pre className="oa-code"><code>{parts.map((part, index) => {
    if (index % 2 === 0) return part;
    const kind = part.startsWith("'") ? 'string' : /^\d/.test(part) ? 'number' : 'keyword';
    return <span key={index} className={'oa-token-' + kind}>{part}</span>;
  })}</code></pre>;
}

export function OutputArcade({state, update, onClose}: Props) {
  const [deck, setDeck] = useState(() => dealArcade());
  const [index, setIndex] = useState(0);
  const [selection, setSelection] = useState<string | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const panel = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const round = deck[index];
  const answered = answers.length > index;
  const score = answers.filter((answer, i) => answer === deck[i].output).length;
  const total = deck.length;
  const best = state.arcade?.bestScore;

  useLayoutEffect(() => {
    const opener = document.activeElement;
    const dialog = panel.current!;
    dialog.showModal();
    return () => {
      dialog.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  useLayoutEffect(() => {
    if (answered && !finished) nextButton.current?.focus({preventScroll:true});
    else heading.current?.focus({preventScroll:true});
  }, [deck, index, answered, finished]);

  function check(event: React.FormEvent) {
    event.preventDefault();
    if (selection === null || answered) return;
    setAnswers([...answers, selection]);
    if (index === total - 1) {
      const result = score + Number(selection === round.output);
      update(profile => profile.arcade && profile.arcade.bestScore >= result
        ? profile : {...profile, arcade: {bestScore: result}});
    }
  }
  function advance() {
    if (index === total - 1) setFinished(true);
    else { setIndex(index + 1); setSelection(null); }
  }
  function replay() {
    setDeck(dealArcade(deck));
    setIndex(0);
    setSelection(null);
    setAnswers([]);
    setFinished(false);
  }

  return <dialog ref={panel} className="output-arcade" aria-labelledby="oa-title"
    onCancel={event => {event.preventDefault(); onClose();}}>
    <div className="oa-topline">
      <span><Gamepad2 size={20} aria-hidden="true" /> Output Arcade</span>
      <button type="button" className="oa-close" aria-label="Close Output Arcade" onClick={onClose}><X size={19}/></button>
    </div>
    <div className="oa-body">
      {finished ? <>
        <div className="oa-summary-mark"><Trophy size={30} aria-hidden="true"/></div>
        <h2 id="oa-title" ref={heading} tabIndex={-1}>Set complete<span>.</span></h2>
        <p className="oa-total"><strong>{score}<small> / {total}</small></strong> correct predictions</p>
        <ul className="oa-review" aria-label="Round results">
          {deck.map((item, i) => <li key={item.id}>
            {answers[i] === item.output ? <Check className="oa-hit" size={18} aria-label="Correct"/> : <RotateCcw size={16} aria-label="Reviewed"/>}
            <span>{item.title}</span><code>{item.output}</code>
          </li>)}
        </ul>
        <div className="oa-actions">
          <span className="oa-best"><Trophy size={15} aria-hidden="true"/> Personal best {best ?? score}/{total}</span>
          <button type="button" className="oa-action" onClick={replay}><RotateCcw size={15}/> Play another set</button>
        </div>
      </> : <>
        <div className="oa-round">
          <span>Round {index + 1} of {total}</span>
          <div className="oa-rounds" aria-hidden="true">{deck.map((item, i) => <span key={item.id} className={i===index?'current':''}>
            {answers[i] !== undefined ? (answers[i]===item.output?<Check size={13}/>:<X size={12}/>) : <Circle size={8}/>}
          </span>)}</div>
        </div>
        <h2 id="oa-title" ref={heading} tabIndex={-1}>{round.title}<span>.</span></h2>
        <div className="oa-terminal">
          <div><Terminal size={14} aria-hidden="true"/> Lua 5.4</div>
          <CodeSample source={round.code}/>
        </div>
        <form onSubmit={check}>
          <fieldset disabled={answered} className="oa-options">
            <legend>What will this print?</legend>
            <div>{round.choices.map(choice => <label key={choice}
              className={answered && choice===round.output ? 'oa-correct' : choice===selection ? (answered?'oa-missed':'oa-selected') : ''}>
              <input type="radio" name="arcade-output" value={choice} checked={choice===selection} onChange={()=>setSelection(choice)}/>
              <code>{choice}</code>
              {answered && choice===round.output && <Check size={15} aria-label="Correct output"/>}
            </label>)}</div>
          </fieldset>
          {answered && <div className={answers[index]===round.output?'oa-feedback oa-right':'oa-feedback'} role="status">
            <strong>{answers[index]===round.output ? 'You called it.' : <>Lua prints <code>{round.output}</code>.</>}</strong>
            <p>{round.explanation}</p>
          </div>}
          <div className="oa-actions">
            <span className="oa-best"><Trophy size={15} aria-hidden="true"/>{best===undefined?'First set':`Personal best ${best}/${total}`}</span>
            {answered ? <button ref={nextButton} type="button" className="oa-action" onClick={advance}>
              {index===total-1?'See results':'Next round'}<ArrowRight size={16}/>
            </button> : <button type="submit" className="oa-action" disabled={selection===null}>Check prediction<ArrowRight size={16}/></button>}
          </div>
        </form>
      </>}
    </div>
  </dialog>;
}
