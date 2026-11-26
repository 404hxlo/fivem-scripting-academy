import {useEffect, useRef, useState} from 'react';
import {Gamepad2, Menu, SlidersHorizontal, X} from 'lucide-react';
import type {Page} from '../App';

const links: {page:Page; label:string; name?:string}[] = [
  {page:'dashboard', label:'Home', name:'Overview'},
  {page:'curriculum', label:'Learning path'},
  {page:'dispatch', label:'City Dispatch'},
  {page:'challenges', label:'Challenges', name:'Project challenges'},
  {page:'playground', label:'Playground'},
  {page:'reference', label:'Library', name:'Reference library'},
  {page:'tutor', label:'Study companion'},
];

export function Wordmark() {
  return <span className="learn-wordmark"><img src="./brick-by-script-logo.png" alt="Brick by Script"/><span>Learn</span></span>;
}

export function LearnHeader({page, go, play, onboarding=false}:{page:Page; go:(page:Page)=>void; play?:()=>void; onboarding?:boolean}) {
  const [expanded, setExpanded] = useState(false);
  const menu = useRef<HTMLButtonElement>(null);
  function navigate(target:Page) { setExpanded(false); go(target); }
  useEffect(() => {
    if (!expanded) return;
    function dismiss(event:KeyboardEvent) {
      if (event.key === 'Escape') { setExpanded(false); menu.current?.focus(); }
    }
    window.addEventListener('keydown',dismiss);
    return () => window.removeEventListener('keydown',dismiss);
  },[expanded]);
  return <header className="learn-header">
    {onboarding ? <Wordmark/> : <button className="learn-brand-home" aria-label="Brick by Script Learn home" onClick={()=>navigate('dashboard')}><Wordmark/></button>}
    {!onboarding && <>
      <button ref={menu} className="learn-menu-toggle" aria-label={expanded?'Close navigation':'Open navigation'} aria-expanded={expanded} aria-controls="learn-navigation" onClick={()=>setExpanded(!expanded)}>{expanded?<X size={21}/>:<Menu size={21}/>}</button>
      <nav id="learn-navigation" aria-label="Main navigation" className={expanded?'is-open':''}>
        {links.map(link=><button key={link.page} aria-label={link.name} aria-current={(page===link.page || (page==='lesson' && link.page==='curriculum'))?'page':undefined} onClick={()=>navigate(link.page)}>{link.label}</button>)}
      </nav>
    </>}
    <div className="learn-header-end"><span className="learn-connection"><i/>{window.academy?'Local workspace':'Browser preview'}</span>
      {play&&<button className="learn-arcade-shortcut" aria-label="Play Output Arcade" title="Play Output Arcade" onClick={()=>{setExpanded(false);play();}}><Gamepad2 size={21}/><span>Arcade</span></button>}
      {!onboarding&&<button className="learn-settings" aria-label="Settings & backups" title="Settings & backups" aria-current={page==='settings'?'page':undefined} onClick={()=>navigate('settings')}><SlidersHorizontal size={18}/></button>}
    </div>
  </header>;
}
