// Node's public module-mock API reaches both native imports and Pi's jiti loader.
import { mock } from 'node:test';
import { makeWASocket } from './phone-control-baileys.mjs';
if (!process.env.WA_PHONE_RPC_METRICS || process.env.PI_OFFLINE !== '1') throw new Error('Isolated fixture environment required');
const url = new URL('../../node_modules/baileys/lib/index.js', import.meta.url).href;
const real = await import(url);
const { default: _default, ...named } = real;
mock.module(url, { cache: true, defaultExport: makeWASocket, namedExports: { ...named, makeWASocket } });
