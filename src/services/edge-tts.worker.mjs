import { parentPort, workerData } from 'node:worker_threads';
import { createWriteStream } from 'node:fs';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

// A worker is used so cancellation can terminate the actual client/socket, not
// merely abandon a Promise. No environment credentials or stdout/stderr escape.
const client = new MsEdgeTTS({ enableLogger: false, connectionTimeoutMs: 60_000, synthesisTimeoutMs: 60_000 });
const escape = text => text.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);
try {
    await client.setMetadata(workerData.voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, {
        voiceLocale: workerData.locale, sentenceBoundaryEnabled: false, wordBoundaryEnabled: false
    });
    const rate = `${workerData.speed >= 1 ? '+' : ''}${Math.round((workerData.speed - 1) * 100)}%`;
    const { audioStream } = client.toStream(escape(workerData.text), { rate });
    let bytes = 0;
    const limit = new Transform({ transform(chunk, _encoding, callback) {
        bytes += chunk.length;
        if (bytes > workerData.maxBytes) callback(new Error('Audio limit exceeded'));
        else callback(null, chunk);
    } });
    // msedge-tts@2.1.1 ends this stream only after turn.end and errors on a
    // premature close. Iterator exhaustion from an unverified client is not used.
    await pipeline(audioStream, limit, createWriteStream(workerData.output, { flags: 'wx', mode: 0o600 }));
    if (!bytes) throw new Error('Empty audio');
    parentPort.postMessage({ ok: true });
} catch {
    parentPort.postMessage({ ok: false });
} finally {
    // The parent also terminates and awaits this worker on every outcome.
    try { client.close(); } catch { /* never forward provider diagnostics */ }
}
