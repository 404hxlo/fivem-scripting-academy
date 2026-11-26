import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import Editor,{loader} from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import {FileCode2,FolderOpen,Search,WrapText,AlignLeft,Undo2,Redo2,Plus,Save} from 'lucide-react';
import {formatLua,runLua} from '../lib/runtime';
import {validateProjectFiles} from '../../electron/academy-state.mjs';
self.MonacoEnvironment={getWorker(_id,label){if(label==='json')return new JsonWorker();if(['css','scss','less'].includes(label))return new CssWorker();if(['html','handlebars','razor'].includes(label))return new HtmlWorker();if(['typescript','javascript'].includes(label))return new TsWorker();return new EditorWorker()}};
loader.config({monaco});
monaco.editor.defineTheme('academy', {
 base: 'vs-dark',
 inherit: true,
 rules: [
  {token: 'comment', foreground: '90AAB9'},
  {token: 'keyword', foreground: '6AC2ED'},
  {token: 'string', foreground: '9FDBB0'},
  {token: 'number', foreground: 'FFC196'},
  {token: 'delimiter', foreground: 'DCE8EF'},
  {token: 'tag', foreground: '6AC2ED'},
  {token: 'attribute.name', foreground: '96DDFA'},
 ],
 colors: {
  'editor.background': '#0E1E2B',
  'editor.foreground': '#DCE8EF',
  'editorLineNumber.foreground': '#89A6B8',
  'editorLineNumber.activeForeground': '#FFF1D7',
  'editor.lineHighlightBackground': '#192C3A',
  'editor.selectionBackground': '#275570',
  'editor.inactiveSelectionBackground': '#1E3E51',
  'editorCursor.foreground': '#96DDFA',
  'editorIndentGuide.background1': '#294451',
  'editorIndentGuide.activeBackground1': '#56809A',
  'editorWidget.background': '#132735',
  'editorWidget.border': '#56809A',
  'editorSuggestWidget.selectedBackground': '#173E52',
  'editorError.foreground': '#FFA99E',
  'editorWarning.foreground': '#FFD199',
  'focusBorder': '#6AC2ED',
 }
});
monaco.languages.registerCompletionItemProvider('lua',{provideCompletionItems(model,position){const word=model.getWordUntilPosition(position);const range={startLineNumber:position.lineNumber,endLineNumber:position.lineNumber,startColumn:word.startColumn,endColumn:word.endColumn};return {suggestions:[['RegisterCommand',"RegisterCommand('${1:name}', function(source, args)\n    ${2:-- code}\nend, false)"],['CreateThread','CreateThread(function()\n    ${1:-- code}\nend)'],['RegisterNetEvent',"RegisterNetEvent('${1:resource:event}', function(${2:args})\n    ${3:-- validate inputs on the server}\nend)"],['print','print(${1:value})'],['local','local ${1:name} = ${2:value}'],['Wait','Wait(${1:1000})']].map(([label,insertText])=>({label,insertText,range,kind:monaco.languages.CompletionItemKind.Function,insertTextRules:monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet}))}}});
const languages: Record<string, string> = {
 lua: 'lua', html: 'html', css: 'css', js: 'javascript',
 json: 'json', md: 'markdown', sql: 'sql',
};
function lang(name: string) {
 const extension = name.split('.').at(-1)?.toLowerCase();
 return extension ? languages[extension] ?? 'plaintext' : 'plaintext';
}
function SolutionComparison({original, modified, language}: {original: string; modified: string; language: string}) {
 const container = useRef<HTMLElement>(null);
 useLayoutEffect(() => {
  if (!container.current) return;
  const editor = monaco.editor.createDiffEditor(container.current, {
   theme: 'academy', readOnly: true, originalEditable: false, minimap: {enabled: false},
   fontSize: 13, renderSideBySide: true, automaticLayout: true,
  });
  const learnerModel = monaco.editor.createModel(original, language);
  const solutionModel = monaco.editor.createModel(modified, language);
  editor.setModel({original: learnerModel, modified: solutionModel});
  return () => {
   editor.setModel(null);
   editor.dispose();
   learnerModel.dispose();
   solutionModel.dispose();
  };
 }, [original, modified, language]);
 return <section ref={container} aria-label="Solution comparison" />;
}
export function CodeEditor({files,onChange,mainFile,identity,addFiles=false,solution,onError}:{files:Record<string,string>;onChange:(files:Record<string,string>)=>void;mainFile?:string;identity:string;addFiles?:boolean;solution?:string;onError?:(message:string)=>void}){
 const [active,setActive]=useState(mainFile??Object.keys(files)[0]);const [wrap,setWrap]=useState(false);const [newFile,setNewFile]=useState('');const editorRef=useRef<monaco.editor.IStandaloneCodeEditor|null>(null);
 const file=files[active]!==undefined?active:Object.keys(files)[0];
 const modelPath = `${identity}/${file}`;
 const source = files[file];
 useLayoutEffect(() => {
  if (solution !== undefined) return;
  // A snapshot can replace a hidden tab. Monaco reuses its old model when the
  // tab opens, even when the previous tab and restored file have identical text.
  const model = monaco.editor.getModel(monaco.Uri.parse(modelPath));
  if (model && !model.isAttachedToEditor() && model.getValue() !== source) model.setValue(source);
 }, [modelPath, source, solution]);
 useEffect(()=>{setActive(mainFile??Object.keys(files)[0])},[identity,mainFile]);
 useEffect(()=>{if(lang(file) !== 'lua'||solution!==undefined)return;let disposed=false;const timer=setTimeout(async()=>{const result=await runLua(files[file],{syntaxOnly:true});if(disposed)return;const model=editorRef.current?.getModel();if(model)monaco.editor.setModelMarkers(model,'lua',[...(!result.ok?[{startLineNumber:result.line??1,endLineNumber:result.line??1,startColumn:1,endColumn:1000,message:result.error??'Lua syntax error',severity:monaco.MarkerSeverity.Error}]:[])]);},650);return()=>{disposed=true;clearTimeout(timer)}},[files[file],file,solution]);
 function add() {
  if (Object.keys(files).some(name => name.toLowerCase() === newFile.toLowerCase())) {
   onError?.('That file already exists. Windows filenames ignore letter case.');
   return;
  }
  const nextFiles = {...files, [newFile]: ''};
  try {
   validateProjectFiles(nextFiles);
  } catch (error) {
   onError?.(error instanceof Error ? error.message : String(error));
   return;
  }
  onChange(nextFiles);
  setActive(newFile);
  setNewFile('');
 }
 function changeContent(value: string | undefined, event: monaco.editor.IModelContentChangedEvent) {
  if (value === undefined || value === source) return;
  const nextFiles = {...files, [file]: value};
  if (addFiles) {
   try {
    validateProjectFiles(nextFiles);
   } catch (error) {
    // Monaco has already applied the edit. Restore the last accepted text so
    // the visible editor, snapshots and autosave all refer to the same files.
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (model && model.getValue() === value) {
     model.setValue(source);
     const range = event.changes[0]?.range;
     if (range) editor?.setPosition({lineNumber: range.startLineNumber, column: range.startColumn});
    }
    onError?.('Edit rejected. ' + (error instanceof Error ? error.message : String(error)));
    return;
   }
  }
  onChange(nextFiles);
 }
 async function formatActiveFile() {
  const editor = editorRef.current;
  const model = editor?.getModel();
  if (solution !== undefined || !editor || !model) return;
  if (lang(file) !== 'lua') {
   await editor.getAction('editor.action.formatDocument')?.run();
   return;
  }
  const original = model.getValue();
  const formatted = formatLua(original, model.getOptions().tabSize);
  if (original === formatted) return;
  editor.pushUndoStop();
  editor.executeEdits('format-lua', [{range: model.getFullModelRange(), text: formatted}]);
  editor.pushUndoStop();
 }
 return <div className="code-workspace">
  <div className="editor-tools"><span><span className="status-dot"/> {solution!==undefined?'Solution comparison':'RESOURCE EDITOR'}</span>{solution === undefined && <div className="toolbar-actions">
   <button title="Undo" aria-label="Undo" onClick={()=>editorRef.current?.trigger('toolbar','undo',null)}><Undo2 size={14}/></button>
   <button title="Redo" aria-label="Redo" onClick={()=>editorRef.current?.trigger('toolbar','redo',null)}><Redo2 size={14}/></button>
   <button title="Find / replace (Ctrl+H)" aria-label="Find and replace" onClick={()=>editorRef.current?.trigger('toolbar','editor.action.startFindReplaceAction',null)}><Search size={14}/></button>
   <button title="Format file" aria-label="Format file" onClick={formatActiveFile}><AlignLeft size={15}/></button>
   <button title="Toggle word wrap" aria-label="Toggle word wrap" onClick={()=>setWrap(!wrap)}><WrapText size={15}/></button>
  </div>}</div>
  <div className="editor-body">{(addFiles||Object.keys(files).length>1)&&<aside className="file-explorer"><span className="eyebrow"><FolderOpen size={13}/> FILES</span>{Object.keys(files).map(name=><button className={name===file?'active':''} key={name} onClick={()=>setActive(name)}><FileCode2 size={13}/><span>{name}</span></button>)}{addFiles&&<div className="new-file"><input aria-label="New file name" placeholder="new-file.lua" value={newFile} onChange={e=>setNewFile(e.target.value)} onKeyDown={e=>e.key==='Enter'&&add()}/><button title="Add file" onClick={add}><Plus size={14}/></button></div>}</aside>}
   <div className="editor-main"><div className="file-tabs">{Object.keys(files).map(name=><button key={name} className={name===file?'active':''} onClick={()=>setActive(name)}><span className="lua-dot">{lang(name)==='lua'?'L':'#'}</span>{name}</button>)}</div>{solution!==undefined?<SolutionComparison language={lang(file)} original={files[file]} modified={solution}/>:<Editor path={modelPath} value={files[file]??''} language={lang(file)} theme="academy" height="100%" onChange={changeContent} onMount={editor=>{editorRef.current=editor}} options={{fontSize:13,fontFamily:'Cascadia Code, Consolas, monospace',minimap:{enabled:false},scrollBeyondLastLine:false,padding:{top:20},tabSize:4,insertSpaces:true,wordWrap:wrap?'on':'off',automaticLayout:true,lineNumbersMinChars:3,bracketPairColorization:{enabled:true},quickSuggestions:true}}/>}</div>
  </div><div className="editor-status"><span><Save size={12}/> Local workspace</span><span>{lang(file).toUpperCase()} · UTF-8 · Spaces: 4</span></div>
 </div>
}
