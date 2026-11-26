import { assessed } from './assessments';
import type { Lesson } from '../types';
import { lesson, structural, rule, quiz, manifest } from './helpers';

const htmlPage = `<!doctype html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Academy menu</title><link rel="stylesheet" href="style.css"></head>
<body><main id="menu" hidden><h1>Academy workshop</h1><p id="status">Ready to practice</p><button id="close" type="button">Close</button></main><script src="app.js"></script></body>
</html>`;
const cssPage = `* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; background: transparent; color: #eee; }
#menu { position: absolute; right: 5vw; top: 15vh; width: min(420px, 90vw); padding: 24px; background: #17171c; border: 1px solid #565062; border-radius: 12px; }
[hidden] { display: none !important; }
button { padding: 12px 18px; background: #9274d8; color: #101015; border: 0; border-radius: 6px; cursor: pointer; }
button:focus-visible { outline: 3px solid white; outline-offset: 3px; }`;
const jsPage = `const menu = document.getElementById('menu');
const status = document.getElementById('status');
window.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.action !== 'setVisible' || typeof data.visible !== 'boolean') return;
  menu.hidden = !data.visible;
  if (data.visible) document.getElementById('close').focus();
});
let closing = false;
async function closeMenu() {
  if (closing) return;
  closing = true;
  try {
    const response = await fetch('https://' + GetParentResourceName() + '/close', {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body: JSON.stringify({})
    });
    if (!response.ok) throw new Error('Close request failed');
    await response.json();
  } catch (error) { status.textContent = 'Could not close. Try again or use /academymenu.'; }
  finally { closing = false; }
}
document.getElementById('close').addEventListener('click', closeMenu);
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !menu.hidden) closeMenu(); });`;
const menuClient = `local visible = false
local function setVisible(value)
  visible = value == true
  SetNuiFocus(visible, visible)
  SendNUIMessage({ action = "setVisible", visible = visible })
end
RegisterCommand("academymenu", function() setVisible(not visible) end, false)
RegisterKeyMapping("academymenu", "Academy menu", "keyboard", "F7")
RegisterNuiCallback("close", function(_, cb)
  setVisible(false)
  cb({ ok = true })
end)
AddEventHandler("onResourceStop", function(name)
  if name ~= GetCurrentResourceName() then return end
  SetNuiFocus(false, false)
end)`;
const nuiManifest = manifest+"ui_page 'html/index.html'\nfiles { 'html/index.html', 'html/style.css', 'html/app.js' }\n";

export const nuiLessons: Lesson[] = [
lesson({id:'nui-html',module:6,title:'HTML gives the interface structure',minutes:18,level:'Intermediate',
concept:'NUI is a browser interface layered over the game. HTML describes structure: headings, paragraphs, buttons and forms. An element has a tag and may have attributes such as id. Use real buttons for actions so keyboard behavior comes naturally. A page needs a document structure and a script or stylesheet reference when using separate files.',
why:'A menu built only from decorative boxes is harder to operate and maintain. Meaningful HTML makes the UI understandable before styling or scripting is added.',
example:'<!doctype html>\n<html lang="en">\n<head><meta charset="UTF-8"><title>Garage</title></head>\n<body><main><h1>Garage</h1><button type="button" id="close">Close</button></main></body>\n</html>',
explanation:['doctype selects standards mode; html contains the page.','head stores metadata and asset links, while body contains visible content.','h1 is the main heading. button is an action control.','id provides a stable name JavaScript can use; visible button text explains the action.'],
exercise:structural('Create an HTML page with lang=en, a main heading Workshop, and a button with id=close, type=button, and text Close.','<!doctype html>\n<html><head><title>Workshop</title></head><body>\n<!-- Add the visible interface. -->\n</body></html>','<!doctype html>\n<html lang="en"><head><meta charset="UTF-8"><title>Workshop</title></head><body>\n<main><h1>Workshop</h1><button id="close" type="button">Close</button></main>\n</body></html>',[rule('Language declaration','<html[^>]*lang=["\']en["\']','Declare the page language.'),rule('Heading','<h1>\\s*Workshop\\s*</h1>','Use a heading for the page title.'),rule('Real button','<button(?=[^>]*id=["\']close["\'])(?=[^>]*type=["\']button["\'])[^>]*>\\s*Close\\s*</button>','Use a named semantic button, not a clickable div.')],['HTML names the content’s role.','Attributes go inside the opening tag.','A button looks like <button id="close" type="button">Close</button>.'],'html/index.html'),
challenge:'Add a labeled text input for a filter and a list of three vehicles. Navigate the controls using only the keyboard. Explain which elements are content and which are actions.',
quiz:quiz('Which element naturally represents an action?',['button','An unlabelled div','head'],0,'A button provides an action role and standard keyboard behavior.'),review:['HTML describes structure.','Use semantic controls.','Separate metadata from visible content.'],sources:['html','nui']}),
lesson({id:'nui-css',module:6,title:'CSS, layout, and responsive readability',minutes:20,level:'Intermediate',
concept:'CSS attaches visual rules to selected elements. A declaration pairs a property with a value. The box model includes content, padding, border and margin. box-sizing: border-box includes padding and borders in the declared width. Responsive sizing prevents a menu from falling off smaller displays.',
why:'Players use different resolutions and UI scales. A menu needs readable contrast, reachable controls, a visible focus indicator and a width that adapts.',
example:cssPage,
explanation:['The universal box-sizing rule makes widths easier to reason about.','A transparent body leaves the game visible outside the menu.','min(420px, 90vw) caps the panel while leaving room on narrow viewports.','The hidden rule preserves the closed state; focus-visible makes keyboard navigation visible.'],
exercise:structural('Style #menu with width: min(420px, 90vw), padding: 24px, and background: #17171c. Add [hidden] { display: none !important; } and a visible button:focus-visible outline.','* { box-sizing: border-box; }\n/* Add panel, hidden, and focus styles. */','#menu { width: min(420px, 90vw); padding: 24px; background: #17171c; }\n[hidden] { display: none !important; }\nbutton:focus-visible { outline: 3px solid white; }',[rule('Responsive width','width\\s*:\\s*min\\(420px\\s*,\\s*90vw\\)','Cap width while respecting viewport size.'),rule('Readable panel','padding\\s*:\\s*24px[\\s\\S]*background\\s*:\\s*#17171c','Give content space and a stable dark background.'),rule('Closed state','\\[hidden\\]\\s*\\{\\s*display\\s*:\\s*none\\s*!important','Ensure hidden content stays hidden.'),rule('Keyboard focus','button:focus-visible\\s*\\{[^}]*outline\\s*:','Provide a visible focus indicator.')],['Each selector targets a different interface responsibility.','A viewport-relative cap helps narrow screens.','Panel width/padding/background; hidden display:none; focused button outline.'],'html/style.css'),
challenge:'Test your panel at 1280×720 and a narrow browser width. Increase text size and verify no important button becomes unreachable. Keep the game background visible outside the panel.',
quiz:quiz('What does 90vw mean?',['90 pixels','90 percent of the viewport width','90 characters'],1,'vw is a viewport-relative unit, useful for width constraints.'),review:['Use predictable box sizing.','Constrain width for smaller screens.','Keep keyboard focus visible.'],sources:['css','nui']}),
lesson({id:'nui-javascript',module:6,title:'JavaScript and browser events',minutes:22,level:'Intermediate',
concept:'JavaScript runs inside the NUI browser page. const declares a binding, an arrow function defines behavior, and addEventListener subscribes to browser events. The DOM is the browser’s object representation of HTML. textContent changes visible text safely without interpreting the value as HTML.',
why:'Lua controls gameplay; JavaScript controls browser interaction. You must understand which environment owns a variable before trying to call a function across the boundary.',
example:'const button = document.getElementById("close");\nbutton.addEventListener("click", () => {\n  document.getElementById("status").textContent = "Closing...";\n});',
explanation:['getElementById finds an element after it exists in the document. Load scripts with defer or after the HTML.','addEventListener stores a callback, similar in concept to a Lua event handler.','The arrow function executes on a click.','textContent writes text rather than parsing markup; use it for values coming from messages.'],
exercise:structural('Attach a click listener to the button with id=close. Its callback must set the element with id=status textContent to Close requested.','const button = document.getElementById("close");\n// Add the click behavior.','const button = document.getElementById("close");\nbutton.addEventListener("click", () => {\n  document.getElementById("status").textContent = "Close requested";\n});',[rule('Click listener','addEventListener\\s*\\(["\']click["\']','Subscribe to the button click.'),rule('Safe text update','getElementById\\s*\\(["\']status["\']\\)\\.textContent\\s*=\\s*["\']Close requested["\']','Update the status text without treating it as HTML.')],['Find the control, then register behavior for its event.','The update belongs inside the callback.','button.addEventListener("click", () => { statusElement.textContent = message; });'],'html/app.js',{'html/index.html':htmlPage}),
challenge:'Add a counter that increments on clicks and display it as text. Explain the difference between calling a function immediately and passing it as a callback.',
quiz:quiz('Why prefer textContent for a player-provided label?',['It avoids interpreting the label as HTML','It automatically authorizes the player','It sends the text to the server'],0,'Text insertion avoids unintended markup interpretation; it does not provide server authorization.'),review:['Browser events use callbacks.','DOM elements must exist before access.','Use textContent for untrusted display text.'],sources:['javascript','html','nui']}),
lesson({id:'nui-manifest-messages',module:6,title:'Bundle the page and send messages',minutes:22,level:'Intermediate',
concept:'A NUI resource declares one ui_page and includes its HTML, CSS and JavaScript in files. SendNUIMessage sends a Lua table as JSON to that page. The browser receives a message event and inspects event.data. Define a small message contract with an action field and validate its expected types.',
why:'A page that loads in your editor may fail in FiveM if its assets were never included in the resource. A clear message contract keeps Lua and JavaScript in agreement.',
example:'-- client.lua\nSendNUIMessage({ action = "setVisible", visible = true })\n\n-- fxmanifest.lua\nui_page "html/index.html"\nfiles { "html/index.html", "html/style.css", "html/app.js" }',
explanation:['ui_page selects the entry page.','files packages browser assets so the client can load them.','SendNUIMessage is the Lua convenience wrapper for JSON encoding.','The browser listener checks data.action before changing UI state; unrelated messages should be ignored.'],
exercise:structural('Complete the manifest: point ui_page at html/index.html and include index.html, style.css and app.js under html/.',manifest+'-- Add the NUI entry and assets.\n',nuiManifest,[rule('UI entry',"ui_page\\s*['\"]html/index\\.html['\"]",'Declare the root browser page.'),rule('HTML asset',"files\\s*\\{[^}]*['\"]html/index\\.html['\"]",'Include the HTML entry in the packfile.'),rule('CSS asset',"files\\s*\\{[^}]*['\"]html/style\\.css['\"]",'Include the stylesheet.'),rule('JS asset',"files\\s*\\{[^}]*['\"]html/app\\.js['\"]",'Include the browser script.')],['Declaring ui_page does not automatically include every dependency.','All three browser assets belong in files.','ui_page names one entry; files lists every local asset.'],'fxmanifest.lua',{'client.lua':'RegisterCommand("academyshow", function() SendNUIMessage({ action="setVisible", visible=true }) end, false)','html/index.html':htmlPage,'html/style.css':cssPage,'html/app.js':jsPage}),
challenge:'Write a browser message listener that ignores unknown actions and rejects non-boolean visible values. Test loading the exported page offline, then test the Lua bridge inside FiveM.',
quiz:quiz('Where does SendNUIMessage deliver its data?',['The resource’s NUI browser page','Every server database','The Windows command shell'],0,'It bridges the client Lua resource to its browser UI.'),review:['Package every local browser asset.','Keep messages small and documented.','Validate the message shape before using it.'],sources:['manifest','nui']}),
lesson({id:'nui-callbacks-focus',module:6,title:'Callbacks that always finish',minutes:24,level:'Intermediate',
concept:'Browser code calls a NUI callback by posting JSON to https:// plus GetParentResourceName() plus the callback name. The Lua callback receives data and cb. Invoke cb on every path so the browser request completes. SetNuiFocus controls keyboard and mouse focus; release both when closing.',
why:'A menu that closes visually but keeps focus can trap the player’s controls. A callback that never responds can leave the browser waiting indefinitely.',
example:'RegisterNuiCallback("close", function(data, cb)\n  SetNuiFocus(false, false)\n  SendNUIMessage({ action = "setVisible", visible = false })\n  cb({ ok = true })\nend)',
explanation:['Current official guidance uses RegisterNuiCallback. CfxLua also retains RegisterNUICallback for compatibility; both spellings are accepted here. Their internal dispatch differs, so do not register the same endpoint through both APIs.','SetNuiFocus(false, false) returns keyboard and mouse control.','The message synchronizes visible UI state.','cb sends a JSON-encodable response, including for rejected requests. NUI callbacks run on the client and do not authorize server actions.'],
exercise:assessed("nui-callbacks-focus",'Implement the close callback with RegisterNuiCallback (or the supported legacy RegisterNUICallback). Release both focus flags, send setVisible=false, and acknowledge with cb({ ok = true }).','-- Close the browser menu and finish its request.\n','RegisterNuiCallback("close", function(data, cb)\n  SetNuiFocus(false, false)\n  SendNUIMessage({ action = "setVisible", visible = false })\n  cb({ ok = true })\nend)',['Closing has three responsibilities: controls, visuals, response.','The browser promise needs a callback response even for a simple close.','Release focus; send hidden state; call cb with an ok result.']),
challenge:'Add an invalid-input path to another callback and confirm it still calls cb with an error. Test Escape, close button, repeated clicks and resource stop. Verify game controls return each time.',
quiz:quiz('Does a successful NUI callback make a server purchase authorized?',['Yes','No; NUI is client-side','Only when using HTTPS'],1,'HTTPS is the callback transport requirement; the server still independently validates protected actions.'),review:['Always finish callback requests.','Release focus on every close path.','NUI is presentation, not authority.'],sources:['nui-callbacks','nui-legacy','nui-runtime','nui','security']}),
lesson({id:'nui-menu-project',module:6,title:'Project: a complete in-game menu',minutes:35,level:'Intermediate',
concept:'A complete menu has a state owner, a message contract, a way to open, a way to close, and failure handling. Here Lua owns visible state, JavaScript handles clicks and Escape, and the callback joins them. The UI begins hidden and never assumes that loading the page means the player wants it open.',
why:'Separating state from rendering prevents the browser and Lua from disagreeing about whether the menu is active. A minimal full resource is a useful foundation for larger interfaces.',
example:menuClient,
explanation:['setVisible normalizes state and updates both focus and browser visibility.','A command and key mapping share the same open/close behavior.','The close callback delegates to that function and responds.','The resource-stop handler releases focus even if the UI is open.','The bundled browser code validates message shape, prevents simultaneous close requests, handles errors and supports Escape.'],
exercise:assessed("nui-menu-project",'Complete client.lua for the bundled HTML/CSS/JS menu. Add setVisible, the academymenu command, F7 mapping, close callback and stop-time focus release. The supporting browser files are editable.','local visible = false\n-- Implement the complete menu lifecycle.\n',menuClient,['Use one function for opening and closing.','Command toggles state; callback forces false.','Normalize visible → focus → message; wire command/callback; add stop cleanup.'],'client.lua',{'fxmanifest.lua':nuiManifest,'html/index.html':htmlPage,'html/style.css':cssPage,'html/app.js':jsPage}),
challenge:'Export and test in a private server: initial hidden state, open, button close, Escape close, repeated opening, resource stop, and different resolutions. Extend the menu with a server-validated request only after the lifecycle tests pass.',
quiz:quiz('Why keep both open and close logic in setVisible?',['To hide errors','To keep focus and rendering consistent on every path','To avoid registering callbacks'],1,'One transition function reduces disagreement between state, focus and the page.'),review:['Choose one owner for UI state.','Test every close path.','Add protected gameplay through validated server requests.'],sources:['nui','nui-callbacks','manifest','security']})
];
