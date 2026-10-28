/** Lexical transport policy only; callers still reject URL credentials/query/fragment. */
export function isLoopbackEndpoint(url: URL): boolean {
    return /^(127\.\d{1,3}\.\d{1,3}\.\d{1,3}|\[::1\]|localhost)$/i.test(url.hostname);
}

/** Non-loopback cleartext transport requires an explicit process-level opt-in. */
export function allowsPlainHttp(url: URL): boolean {
    return url.protocol === 'https:' || (url.protocol === 'http:'
        && (isLoopbackEndpoint(url) || process.env.WHATSAPP_NG_ALLOW_PLAIN_HTTP === '1'));
}
