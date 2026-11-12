// Node's public module-mock API reaches both native imports and Pi's jiti loader.
import { mock } from 'node:test';
import { makeWASocket } from './phone-control-baileys.mjs';
if (!process.env.WA_PHONE_RPC_METRICS || process.env.PI_OFFLINE !== '1') throw new Error('Isolated fixture environment required');
const url = new URL('../../node_modules/baileys/lib/index.js', import.meta.url).href;
const real = await import(url);
const { default: _default, ...named } = real;
mock.module(url, { cache: true, defaultExport: makeWASocket, namedExports: { ...named, makeWASocket } });

// Explicit synthetic poll gate for the reload Off/Connect race (WA_PHONE_RPC_RELOAD_RACE=off only).
// While held, exactly-100 ms timers (the reconnect poll interval) are deferred, not dropped.
if (process.env.WA_PHONE_RPC_RELOAD_RACE === 'off') {
    const realSetTimeout = globalThis.setTimeout; const deferred = [];
    globalThis.__waPollGate = { held: false, hold() { this.held = true; }, release() { this.held = false; for (const run of deferred.splice(0)) realSetTimeout(run, 0); } };
    globalThis.setTimeout = function (callback, delay, ...args) {
        if (delay === 100 && globalThis.__waPollGate.held && typeof callback === 'function') { deferred.push(() => callback(...args)); return realSetTimeout(() => {}, 0); }
        return realSetTimeout(callback, delay, ...args);
    };
}
