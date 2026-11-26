import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {preview} from 'vite';

// Run against the production build and real browser storage, under the same
// origin in both tabs. Each run uses its own temporary Edge profile.
const server = await preview({preview:{host:'127.0.0.1',port:0}});
let browser;
try {
  browser = await chromium.launch({channel:'msedge',headless:true});
  const context = await browser.newContext();
  const url = server.resolvedUrls.local[0];
  const first = await context.newPage();
  await first.goto(url);
  await first.getByRole('button',{name:'Start learning',exact:true}).click();
  const second = await context.newPage();
  await second.goto(url);
  await second.getByRole('heading',{name:'Brick by Script Learn is open in another tab'}).waitFor();
  await first.getByRole('button',{name:'Settings & backups'}).click();
  await first.getByLabel('Explanation depth').selectOption('Simple');
  await first.waitForFunction(()=>JSON.parse(localStorage.getItem('academy-state')).depth==='Simple');
  await first.close();
  await second.getByRole('button',{name:'Settings & backups'}).click();
  assert.equal(await second.getByLabel('Explanation depth').inputValue(),'Simple');
  console.log('PASS The waiting tab opens the latest saved profile after the first tab closes.');

  const state = await second.evaluate(()=>JSON.parse(localStorage.getItem('academy-state')));
  const fileText = 'x'.repeat(225000);
  const replacement = {...state, depth:'Technical', projects:Array.from({length:4},(_,i)=>({
    id:'large-'+i, name:'large_'+i, template:'blank', updated:new Date().toISOString(), history:[],
    files:Object.fromEntries(Array.from({length:7},(_,j)=>['file'+j+'.txt',fileText])),
  }))};
  await second.locator('input[type=file]').setInputFiles({
    name:'large-profile.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(replacement)),
  });
  await second.locator('.modal').getByRole('button',{name:'Import backup',exact:true}).click();
  await second.getByText(/Could not import this backup/).waitFor();
  assert.equal(await second.getByLabel('Explanation depth').inputValue(),'Simple');
  await second.reload();
  await second.getByRole('button',{name:'Settings & backups'}).click();
  assert.equal(await second.getByLabel('Explanation depth').inputValue(),'Simple');
  assert.equal(await second.evaluate(()=>JSON.parse(localStorage.getItem('academy-state')).projects.length),0);
  console.log('PASS A valid backup exceeding the browser quota preserves the visible and stored profile.');
  const broken = JSON.stringify({...state,projects:Array.from({length:101},(_,i)=>({
    id:'project-'+i, name:'project_'+i, template:'blank', updated:new Date().toISOString(), history:[], files:{'client.lua':''},
  }))});
  await second.evaluate(text=>localStorage.setItem('academy-state',text),broken);
  await second.reload();
  await second.getByRole('heading',{name:'Your browser profile could not be opened'}).waitFor();
  const originalDownload = second.waitForEvent('download');
  await second.getByRole('button',{name:'Download original data'}).click();
  const output = await (await originalDownload).createReadStream();
  const chunks = [];
  for await (const chunk of output) chunks.push(chunk);
  assert.equal(Buffer.concat(chunks).toString('utf8'),broken);
  second.once('dialog',dialog=>dialog.accept());
  await second.getByLabel('Restore from backup').setInputFiles({
    name:'working-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(state)),
  });
  await second.getByRole('button',{name:'Settings & backups'}).click();
  assert.equal(await second.getByLabel('Explanation depth').inputValue(),'Simple');
  console.log('PASS A previously unreadable profile can be downloaded byte-for-byte and replaced with a working backup.');

  // A rejected edit must never get copied into history and poison later saves.
  const lastLine = 'Last accepted note.';
  const nearLimit = 256 * 1024 - 4;
  const line = 'x'.repeat(255) + '\n';
  const fullLines = line.repeat(Math.ceil(nearLimit / line.length));
  const priorText = fullLines.slice(0, nearLimit - lastLine.length - 1) + '\n' + lastLine;
  const project = {id:'snapshot-test',name:'snapshot_test',template:'blank',updated:new Date().toISOString(),
    files:{'fxmanifest.lua':"fx_version 'cerulean'\ngame 'gta5'",'notes.txt':priorText}, history:[]};
  await second.locator('input[type=file]').setInputFiles({
    name:'snapshot-test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...state,projects:[project]})),
  });
  await second.locator('.modal').getByRole('button',{name:'Import backup',exact:true}).click();
  await second.getByRole('button',{name:'Playground',exact:true}).click();
  await second.locator('.file-tabs').getByRole('button',{name:/notes\.txt/}).click();
  const editor = second.locator('.monaco-editor textarea.inputarea').first();
  await editor.focus();
  await second.keyboard.press('Control+End');
  await second.keyboard.insertText(' extra words');
  await second.getByText(/Edit rejected/).waitFor();
  await second.keyboard.press('Control+End');
  await second.locator('.view-lines').getByText(lastLine,{exact:true}).waitFor();
  await second.getByRole('button',{name:'Dismiss message'}).click();
  await editor.focus();
  await second.keyboard.press('Control+A');
  await editor.evaluate(input=>{
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', ('x'.repeat(255)+'\n').repeat(1025));
    input.dispatchEvent(new ClipboardEvent('paste',{clipboardData,bubbles:true,cancelable:true}));
  });
  await second.getByText(/Edit rejected/).waitFor();
  await second.keyboard.press('Control+End');
  await second.locator('.view-lines').getByText(lastLine,{exact:true}).waitFor();
  await second.getByRole('button',{name:'Snapshot',exact:true}).click();
  await second.waitForFunction(()=>JSON.parse(localStorage.getItem('academy-state')).projects[0].history.length===1);
  await editor.focus();
  await second.keyboard.press('Control+A');
  await second.keyboard.insertText('Corrected note.');
  await second.getByRole('button',{name:'Settings & backups'}).click();
  await second.getByLabel('Explanation depth').selectOption('Technical');
  await second.waitForFunction(()=>JSON.parse(localStorage.getItem('academy-state')).depth==='Technical');
  await second.reload();
  const finalState = await second.evaluate(()=>JSON.parse(localStorage.getItem('academy-state')));
  assert.equal(finalState.depth,'Technical');
  assert.equal(finalState.projects[0].files['notes.txt'],'Corrected note.');
  assert.equal(finalState.projects[0].history[0].files['notes.txt'],priorText);
  console.log('PASS An oversized edit is rolled back before snapshotting and later file and preference edits survive reopening.');
} finally {
  await browser?.close();
  await new Promise(resolve=>server.httpServer.close(resolve));
}
