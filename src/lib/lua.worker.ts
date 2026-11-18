import wasmUri from 'wasmoon/dist/glue.wasm?url';
import { executeLua, type LuaOptions } from './lua-core';

self.onmessage = async (event: MessageEvent<{code:string;options:LuaOptions}>) => {
  const result = await executeLua(event.data.code, event.data.options, wasmUri);
  self.postMessage(result);
};
