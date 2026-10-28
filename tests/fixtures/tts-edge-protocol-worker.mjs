import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import { parentPort, workerData } from 'node:worker_threads';

// Exercise the actual pinned client and actual production worker without a
// Microsoft connection. No installed source is changed and no URL is logged.
const require = createRequire(workerData.packageJson);
const clientRequire = createRequire(require.resolve('msedge-tts'));
class FakeSocket extends EventEmitter {
    static OPEN = 1;
    static CLOSED = 3;
    CONNECTING = 0;
    OPEN = 1;
    CLOSED = 3;
    readyState = 0;
    metadataDisabled = false;
    constructor(url, options) {
        super();
        const destination = new URL(url);
        this.signingV2 = /^[0-9A-F]{16}-[0-9A-F]{64}$/.test(destination.searchParams.get('Sec-MS-GEC') ?? '')
            && destination.searchParams.get('Sec-MS-GEC-Version') === '2-143.0.3650.96';
        this.compatibilityHeaders = options?.headers?.Origin === 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold'
            && options?.headers?.['User-Agent']?.includes('Edg/143.0.0.0') === true;
        this.destinationMatches = `${destination.protocol}//${destination.host}${destination.pathname}` === workerData.expectedEndpoint;
        queueMicrotask(() => { this.readyState = 1; this.onopen?.(); });
    }
    send(message, callback) {
        callback?.();
        if (message.includes('Path:speech.config')) {
            this.metadataDisabled = /"wordBoundaryEnabled"\s*:\s*"false"/.test(message) && /"sentenceBoundaryEnabled"\s*:\s*"false"/.test(message);
        }
        if (!message.includes('Path:ssml')) return;
        const requestId = /X-RequestId:([^\r\n]+)/.exec(message)?.[1];
        parentPort.postMessage({ inspection: true,
            escaped: message.includes('&lt;test&gt; &amp; &quot;quote&quot; &apos;sample&apos;'),
            noMetadata: this.metadataDisabled,
            environmentEmpty: Object.keys(process.env).length === 0,
            destinationMatches: this.destinationMatches, signingV2: this.signingV2, compatibilityHeaders: this.compatibilityHeaders });
        queueMicrotask(() => {
            if (workerData.scenario !== 'empty') {
                const audio = workerData.scenario === 'oversize' ? Buffer.alloc(workerData.maxBytes + 1) : Buffer.from('ID3-fixture-audio');
                const packet = Buffer.concat([Buffer.from(`X-RequestId:${requestId}\r\nContent-Type:audio/mpeg\r\nPath:audio\r\n`), audio]);
                this.onmessage?.({ data: packet.buffer.slice(packet.byteOffset, packet.byteOffset + packet.byteLength) });
            }
            if (workerData.scenario === 'close') this.close();
            else if (workerData.scenario === 'error') this.onerror?.({ error: new Error('fixture-sensitive-provider-error') });
            else if (workerData.scenario !== 'stall') this.onmessage?.({ data: `X-RequestId:${requestId}\r\nPath:turn.end\r\n\r\n` });
        });
    }
    close() { this.readyState = 3; queueMicrotask(() => this.onclose?.()); }
    terminate() { this.close(); }
}
const websocketPath = clientRequire.resolve('isomorphic-ws');
require.cache[websocketPath] = { id: websocketPath, filename: websocketPath, loaded: true, exports: FakeSocket };
await import(workerData.productionWorker);
