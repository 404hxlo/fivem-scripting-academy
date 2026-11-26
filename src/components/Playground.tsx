import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, Code2, Download, ExternalLink, FileArchive, FolderOpen, History, Plus, RotateCcw, Save, ShieldCheck, Target, X, XCircle } from 'lucide-react';
import type { AcademyState, Project, ProjectBrief } from '../types';
import type { UpdateState } from '../App';
import { createProject, snapshot, templates } from '../lib/templates';
import { download } from '../lib/state';
import { MAX_PROJECTS } from '../../electron/academy-state.mjs';
import { runLua } from '../lib/runtime';
import { buildResourceZip, reviewResource, validResourceName, type ResourceReview } from '../lib/resource';
import { CodeEditor } from './CodeEditor';
import './playground.css';

interface Props { state: AcademyState; update: UpdateState; notify: (message: string) => void; briefs: ProjectBrief[]; challengeMode: boolean; initialProject?: string; onSelectProject: (id: string) => void }
type Wizard = { brief?: ProjectBrief; independent: boolean };
export function Playground({ state, update, notify, briefs, challengeMode, initialProject, onSelectProject }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (challengeMode) return null;
    return state.projects.find(p => p.id === initialProject)?.id ?? state.projects.at(-1)?.id ?? null;
  });
  const [wizard, setWizard] = useState<Wizard | null>(null);
  const [review, setReview] = useState<ResourceReview | null>(null);
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showReview, setShowReview] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [newName, setNewName] = useState('');
  const [restoreEntry, setRestoreEntry] = useState<Project['history'][number] | null>(null);
  const [filter, setFilter] = useState('');
  const validation = useRef<AbortController | null>(null);
  const project = state.projects.find(p => p.id === selectedId);
  const brief = project?.briefId ? briefs.find(b => b.id === project.briefId) : undefined;
  useLayoutEffect(() => {
    setReview(null); setNewName(project?.name ?? ''); setShowHistory(false); setRestoreEntry(null); setShowGuide(false); setBusy(false);
    return () => { validation.current?.abort(); validation.current = null; };
  }, [project?.id]);
  function select(id: string) { setSelectedId(id); onSelectProject(id); }
  function hasProjectSlot() {
    if (state.projects.length < MAX_PROJECTS) return true;
    notify(`The workspace holds up to ${MAX_PROJECTS} projects. Open an existing resource to continue working.`);
    return false;
  }
  function openWizard(next: Wizard) { if (hasProjectSlot()) setWizard(next); }
  function changeProject(fn: (p: Project) => Project) {
    if (!project) return;
    validation.current?.abort();
    setReview(null);
    update(s => ({ ...s, projects: s.projects.map(p => p.id === project.id ? fn(p) : p) }));
  }
  function changeFiles(files: Record<string,string>) {
    changeProject(p => {
      const previous = p.history[0];
      const saved = !previous || Date.now() - Date.parse(previous.date) > 120000 ? snapshot(p) : p;
      return { ...saved, files, updated: new Date().toISOString() };
    });
  }
  function create(name: string, template: string) {
    if (!hasProjectSlot()) return;
    try {
      if (state.projects.some(p => p.name.toLowerCase() === name.toLowerCase())) throw new Error('A project already uses that name. Choose a different name.');
      const created = createProject(name, template, wizard?.brief?.id);
      update(s => ({ ...s, projects: [...s.projects, created] }));
      select(created.id); setWizard(null); notify('Resource workspace created. Your changes save automatically.');
    } catch (error) { notify(String(error)); }
  }
  async function validate(): Promise<ResourceReview | null> {
    if (!project || busy) return null;
    setBusy(true); setShowReview(true);
    const controller = new AbortController();
    validation.current = controller;
    try {
      const result = await reviewResource(project, runLua, controller.signal);
      setReview(result); return result;
    } catch (error) {
      if (validation.current === controller) notify(controller.signal.aborted ? 'Files changed during validation. Run the checks again before exporting.' : 'Validation could not finish: ' + String(error));
      return null;
    } finally { if (validation.current === controller) setBusy(false); }
  }
  async function exportProject(format: 'folder' | 'zip' | 'vscode') {
    if (!project || busy) return;
    const checked = await validate();
    if (!checked?.valid) { if (checked) notify('Fix the failed checks before exporting. The review panel explains each issue.'); return; }
    const controller = validation.current;
    if (!controller || controller.signal.aborted) return;
    setBusy(true);
    try {
      if (format === 'vscode') {
        if (!window.academy) throw new Error('Opening VS Code requires the desktop app. Export a ZIP from this browser preview instead.');
        const target = await window.academy.openVSCode(project); notify(`Exported snapshot opened in VS Code: ${target}. External edits do not sync back automatically.`);
      } else if (window.academy) {
        const target = await window.academy.exportResource(project, format);
        if (target) { notify(`Resource exported to ${target}`); if (validation.current === controller && !controller.signal.aborted) setShowGuide(true); }
      } else if (format === 'zip') {
        download(project.name + '.zip', buildResourceZip(project), 'application/zip'); notify('Resource ZIP downloaded. Extract it before installing on your local test server.'); setShowGuide(true);
      } else throw new Error('Folder exports require the desktop app. ZIP exports are available in this browser preview.');
    } catch (error) { notify(String(error)); }
    finally { if (validation.current === controller) setBusy(false); }
  }
  function rename() {
    if (!project) return;
    if (!validResourceName(newName) || state.projects.some(p => p.id !== project.id && p.name.toLowerCase() === newName.toLowerCase())) { notify('Use a unique resource name with 2–48 lowercase letters, numbers, underscores or hyphens, starting with a letter.'); return; }
    changeProject(p => ({ ...p, name: newName, updated: new Date().toISOString() })); notify('Resource renamed.');
  }
  function saveSnapshot() {
    if (!project) return;
    update(s => ({...s, projects:s.projects.map(p => p.id === project.id ? snapshot(p) : p)}));
    notify('Project snapshot saved.');
  }
  function restore(entry: Project['history'][number]) {
    if (!project?.history.includes(entry)) return;
    const previous = { ...entry.files };
    changeProject(p => ({ ...snapshot(p), files: previous, updated: new Date().toISOString() }));
    setRestoreEntry(null); notify('Snapshot restored. Your previous files were backed up first.');
  }
  const checklists = brief ? [
    { title: 'Requirements', items: brief.requirements },
    { title: 'Development milestones', items: brief.milestones },
    { title: 'In-game checkpoints', items: brief.checkpoints },
    { title: 'Your code review', items: brief.review },
  ] : [];
  const allItems = checklists.flatMap(group => group.items);
  const checkedCount = project?.checkpoints?.filter(index => index >= 0 && index < allItems.length).length ?? 0;
  return <>
    <div className="page-heading"><div><div className="eyebrow purple">{challengeMode ? 'PUT YOUR UNDERSTANDING TO WORK' : 'YOUR IDEAS, YOUR CODE'}</div><h1>{project ? project.name : challengeMode ? 'Build something of your own' : 'Your resource playground'}</h1><p>{project ? 'Edit your files, check your work, and export a standard FiveM resource.' : challengeMode ? 'Eleven projects to connect your skills. Each includes milestones and an honest review process.' : 'A local workbench for experimenting beyond the lessons.'}</p></div><button className="primary" onClick={() => openWizard({ independent: false })}><Plus size={16}/> New resource</button></div>
    {project ? <>
      <div className="playground-nav"><button className="text-button" onClick={() => setSelectedId(null)}><ArrowLeft size={15}/>{challengeMode ? 'All challenges' : 'All resources'}</button><label><span className="muted">Workspace</span><select aria-label="Selected resource" value={project.id} onChange={e => select(e.target.value)}>{state.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><span className="tag">{Object.keys(project.files).length} files</span>{brief && <span className="tag">{brief.level} project</span>}</div>
      <div className="playground-toolbar surface"><div className="button-row"><button className="primary" disabled={busy} onClick={() => void validate()}><ShieldCheck size={15}/>{busy ? 'Checking / exporting…' : 'Check resource'}</button><button className="secondary" disabled={busy} onClick={() => void exportProject('folder')} title={!window.academy ? 'Desktop app required' : 'Create a new resource folder'}><FolderOpen size={15}/> Export folder</button><button className="secondary" disabled={busy} onClick={() => void exportProject('zip')}><FileArchive size={15}/> Export ZIP</button><button className="secondary" disabled={busy} onClick={() => void exportProject('vscode')}><ExternalLink size={14}/> VS Code</button></div><div className="button-row"><button className="text-button" onClick={saveSnapshot}><Save size={14}/> Snapshot</button><button className="text-button" onClick={() => setShowHistory(!showHistory)}><History size={15}/> History ({project.history.length})</button></div></div>
      <div className="playground-editor"><CodeEditor identity={`project-${project.id}`} files={project.files} onChange={changeFiles} mainFile={project.files['client.lua'] !== undefined ? 'client.lua' : project.files['server.lua'] !== undefined ? 'server.lua' : 'fxmanifest.lua'} addFiles onError={notify}/></div>
      {showHistory && <section className="surface project-history"><div className="section-heading compact"><h3>Snapshots and recovery</h3><button aria-label="Close history" onClick={() => setShowHistory(false)}><X size={16}/></button></div><p className="muted">A snapshot is taken before the first edit and after two minutes between changes. Up to 20 snapshots are kept. Restoring first backs up the current files.</p>{project.history.length ? project.history.map((entry,index) => <div className="history-row" key={entry.date + index}><div><strong>{new Date(entry.date).toLocaleString()}</strong><small>{Object.keys(entry.files).length} files</small></div>{restoreEntry === entry ? <div className="button-row"><span>Restore these files?</span><button className="secondary" onClick={() => restore(entry)}>Restore with backup</button><button className="text-button" onClick={() => setRestoreEntry(null)}>Cancel</button></div> : <button className="text-button" onClick={() => setRestoreEntry(entry)}><RotateCcw size={14}/> Restore</button>}</div>) : <p>No snapshots yet. Save one or begin editing.</p>}</section>}
      <div className="project-details-grid"><section className="surface project-validation"><div className="section-heading compact"><h3>Resource review</h3><button className="text-button" onClick={() => setShowReview(!showReview)}><ChevronDown size={16}/>{showReview ? 'Collapse' : 'Expand'}</button></div><p className="muted">Real Lua 5.4 syntax checks and manifest checks run locally. Review items require your judgment or a local FiveM test.</p>{showReview && (review ? <><div className={`review-summary ${review.valid ? 'passed' : 'failed'}`}>{review.valid ? <CheckCircle2 size={19}/> : <XCircle size={19}/>}<span>{review.valid ? 'Automated checks passed — ready to export for local testing.' : 'Some automated checks failed. Fix them before exporting.'}</span></div><div className="review-checks">{review.checks.map((check,index) => <div className={`resource-check ${check.status}`} key={index}>{check.status === 'pass' ? <Check size={15}/> : check.status === 'fail' ? <XCircle size={15}/> : <Target size={15}/>}<div><strong>{check.name}<span>{check.status === 'review' ? 'Manual review' : check.status === 'pass' ? 'Passed' : 'Failed'}</span></strong><p>{check.detail}</p>{check.file && <code>{check.file}{check.line ? `:${check.line}` : ''}</code>}</div></div>)}</div>{review.dependencies.length > 0 && <div className="dependency-note"><strong>Resource dependencies</strong><p>{review.dependencies.join(', ')}</p><p className="muted">Install matching versions on your local test server and ensure they start first. A declaration does not install a dependency.</p></div>}</> : <div className="review-empty"><ShieldCheck size={26}/><p>Run a check to see syntax errors, missing files, dependencies, and review prompts.</p><button className="secondary" disabled={busy} onClick={() => void validate()}>Check my resource</button></div>)}</section>
        <section className="surface project-settings"><h3>Workspace details</h3><label className="field-label">Resource folder name<input aria-label="Resource folder name" value={newName} onChange={e => setNewName(e.target.value)}/></label><button className="secondary" onClick={rename} disabled={newName === project.name}>Rename resource</button><p className="muted">Last edited {new Date(project.updated).toLocaleString()}. Templates are learning examples; a passed check does not certify live gameplay.</p><hr/><h3>Test it in FiveM</h3><p className="muted">Exports are written only to a location you choose. The Academy does not execute server commands or install into your server.</p><button className="text-button" onClick={() => setShowGuide(!showGuide)}>{showGuide ? 'Hide' : 'Open'} local testing guide <ArrowRight size={14}/></button>{state.serverPath && <p className="server-path"><strong>Your configured local folder</strong><code>{state.serverPath}</code><small>Reference only. No files or commands are sent here.</small></p>}</section></div>
      {showGuide && <TestingGuide name={project.name} dependencies={review?.dependencies ?? []}/>}
      {brief && <section className="surface project-brief"><div className="section-heading"><div><div className="eyebrow purple">PROJECT BRIEF</div><h2>{brief.title}</h2><p>{brief.description}</p></div><span className="tag">{checkedCount}/{allItems.length} self-reviewed</span></div><p className="manual-note">Mark an item only after you have evidence it works. These checkboxes record your review; they are not automated test results.</p><div className="brief-columns">{checklists.map((group,groupIndex) => { const offset = checklists.slice(0,groupIndex).reduce((n,g) => n + g.items.length,0); return <div key={group.title}><h3>{group.title}</h3>{group.items.map((item,index) => { const n = offset + index; return <label className="project-checklist" key={n}><input type="checkbox" checked={project.checkpoints?.includes(n) ?? false} onChange={e => { const checked = e.target.checked; update(s => ({...s, projects:s.projects.map(p => p.id === project.id ? {...p,checkpoints:checked ? [...new Set([...(p.checkpoints ?? []),n])] : (p.checkpoints ?? []).filter(k => k !== n)} : p)})); }}/><span>{item}</span></label>; })}</div>; })}</div>{checkedCount === allItems.length && allItems.length > 0 && <div className="review-summary passed"><CheckCircle2 size={18}/>{review?.valid ? 'Automated checks passed and your manual review is recorded.' : 'Your manual review is recorded. Run the automated resource checks as well.'}</div>}</section>}
    </> : challengeMode ? <>
      <div className="project-intro surface"><Target size={25}/><div><h3>Choose how much guidance you want</h3><p>Guided projects can start from a template. Independent projects start with an empty resource so you plan and write the implementation yourself. Both include requirements, milestones, and review checkpoints.</p></div></div>
      <div className="project-brief-grid">{briefs.map(b => { const existing = state.projects.filter(p => p.briefId === b.id); return <article className="surface challenge-card" key={b.id}><div className="row"><span className="icon-tile"><Code2 size={20}/></span><span className="tag">{b.level}</span></div><h2>{b.title}</h2><p>{b.description}</p><div className="challenge-counts"><span>{b.requirements.length} requirements</span><span>{b.milestones.length} milestones</span></div><div className="button-row"><button className="secondary" onClick={() => openWizard({brief:b,independent:false})}>Guided start</button><button className="text-button" onClick={() => openWizard({brief:b,independent:true})}>Independent <ArrowRight size={14}/></button></div>{existing.map(p => <button className="existing-project" key={p.id} onClick={() => select(p.id)}><FolderOpen size={14}/>{p.name}<ArrowRight size={14}/></button>)}</article>; })}</div>
    </> : <>
      <div className="section-heading"><h2>Your resources <span className="count-badge">{state.projects.length}</span></h2><input className="search-input" value={filter} onChange={e => setFilter(e.target.value)} aria-label="Find a resource" placeholder="Find a resource…"/></div>
      {state.projects.length ? <div className="resource-grid">{state.projects.filter(p => p.name.toLowerCase().includes(filter.toLowerCase())).map(p => <button className="surface resource-card" key={p.id} onClick={() => select(p.id)}><div className="row"><span className="icon-tile"><FolderOpen size={22}/></span><ArrowRight size={17}/></div><h3>{p.name}</h3><p>{templates[p.template]?.title ?? 'Custom resource'}</p><small>{Object.keys(p.files).length} files · {new Date(p.updated).toLocaleDateString()}</small>{p.briefId && <span className="tag">Project challenge</span>}</button>)}</div> : <section className="surface playground-empty"><Code2 size={44}/><h2>Your first idea starts here</h2><p>Create a resource, edit real files, and export it when your checks pass.</p><button className="primary" onClick={() => openWizard({independent:false})}><Plus size={16}/> Create a resource</button></section>}
      <section className="surface playground-boundary"><ShieldCheck size={21}/><div><strong>A safe place to practice</strong><p>Lua syntax checks run in an isolated local runtime. Gameplay natives require FiveM. No project code runs with access to your computer, and no live server is modified.</p></div></section>
    </>}
    {wizard && <ResourceWizard wizard={wizard} close={() => setWizard(null)} create={create}/>}
  </>;
}

function ResourceWizard({wizard,close,create}:{wizard:Wizard;close:()=>void;create:(name:string,template:string)=>void}) {
  const [name,setName] = useState(wizard.brief ? 'my_' + wizard.brief.id.replace(/[^a-z0-9_]/g,'_').slice(0,35) : 'my_first_resource');
  const [template,setTemplate] = useState(wizard.independent ? 'blank' : wizard.brief?.template && templates[wizard.brief.template] ? wizard.brief.template : 'command');
  return <div className="modal-scrim"><form className="modal resource-wizard" onSubmit={e => {e.preventDefault();create(name,template)}} aria-label="Create a resource"><div className="section-heading compact"><div className="eyebrow purple">NEW RESOURCE WORKSPACE</div><button type="button" aria-label="Close resource wizard" onClick={close}><X size={18}/></button></div><h2>{wizard.brief?.title ?? 'Bring your next idea to life'}</h2><p>{wizard.independent ? 'Start with a manifest and blank client script. Write the implementation yourself using the project checkpoints.' : 'Choose a starting point. Every file is editable and saved locally.'}</p><label className="field-label">Resource name<input autoFocus aria-label="New resource name" value={name} onChange={e=>setName(e.target.value)} maxLength={48} minLength={2} required/></label><small className="muted">2–48 lowercase letters, numbers, underscores or hyphens. Start with a letter.</small><label className="field-label">Starting template<select aria-label="Resource template" value={template} onChange={e=>setTemplate(e.target.value)} disabled={wizard.independent}>{Object.entries(templates).map(([id,t])=><option value={id} key={id}>{t.title}</option>)}</select></label><p className="template-description">{templates[template].description}</p><div className="wizard-files"><span className="eyebrow">FILES TO CREATE</span>{Object.keys(templates[template].files).map(file=><code key={file}>{file}</code>)}</div><div className="button-row"><button className="primary" type="submit"><Plus size={16}/> Create workspace</button><button className="secondary" type="button" onClick={close}>Cancel</button></div></form></div>;
}
function TestingGuide({name,dependencies}:{name:string;dependencies:string[]}) { return <section className="surface testing-guide"><div className="eyebrow purple">LOCAL TESTING · YOU STAY IN CONTROL</div><h2>From your editor to your development server</h2><ol><li>Export a folder or extract your ZIP. Confirm <code>{name}/fxmanifest.lua</code> is directly inside the resource folder.</li><li>Use an isolated local FXServer with FiveM installed. Keep your production resources and player database separate.</li><li>Manually copy <code>{name}</code> into your development server’s <code>resources/[local]</code> folder. If that name already exists, back it up and choose a new test name.</li><li>Install declared dependencies first{dependencies.length ? `: ${dependencies.join(', ')}` : ', if your manifest requires any'}. Check the exact framework version before using framework exports.</li><li>In your local server console, run <code>refresh</code>, then <code>ensure {name}</code>. For a later test, use <code>restart {name}</code>. To load it at startup, add <code>ensure {name}</code> to the development <code>server.cfg</code>.</li><li>Join the local server, trigger your feature, and inspect both the server console and the client F8 console. Try incorrect inputs, repeat actions, close UI, and restart the resource.</li><li>Record your results in the project checkpoints. Check resource cleanup and multiple-player behavior before considering a production release.</li></ol><p className="muted">These are instructions for you to run manually. Selecting a development-server path does not authorize the Academy to change or start it.</p></section>; }
