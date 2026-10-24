import { afterEach, describe, expect, it, vi } from 'vitest';
import { getFfmpegCommands } from '../../src/services/ffmpeg-path.ts';

afterEach(() => { vi.unstubAllEnvs(); });

describe('user-installed FFmpeg', () => {
    it('uses only the system command when no override is set', () => {
        vi.stubEnv('FFMPEG_PATH', undefined);
        expect(getFfmpegCommands()).toEqual([process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg']);
    });
    it('uses an explicit executable without a bundled fallback', () => {
        vi.stubEnv('FFMPEG_PATH', '/user tools/ffmpeg');
        expect(getFfmpegCommands()).toEqual(['/user tools/ffmpeg']);
    });
    it('treats an empty or whitespace-only override as unset', () => {
        for (const value of ['', '   ']) {
            vi.stubEnv('FFMPEG_PATH', value);
            expect(getFfmpegCommands()).toEqual([process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg']);
        }
    });
});
