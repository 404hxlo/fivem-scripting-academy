import { parentPort, workerData } from 'node:worker_threads';
import { executeLua } from '../../src/lib/lua-core.ts';
parentPort.postMessage(await executeLua(workerData.code, workerData.options));
