export function getFfmpegCommands(): string[] {
    return [process.env.FFMPEG_PATH?.trim() || (process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')];
}
