import { ConversationRouter } from './conversation-router.service.js';
import { SessionManager } from './session.manager.js';
import { t } from '../i18n.js';

export class OwnerAuthorizationError extends Error {}

/** Control-plane authorization, not a sandbox for the agent's other coding tools. */
export class OwnerAuthorization {
    constructor(private readonly router: ConversationRouter, private readonly session: SessionManager,
        private readonly canonical: (jid: string) => string | undefined,
        private readonly allowed: (jid: string) => boolean = () => true) {}

    capture(signal?: AbortSignal): { isCurrent: () => boolean } {
        const snapshot = this.router.snapshot();
        const ownerRevision = this.session.getOperatorRevision();
        const check = () => {
            try {
                if (signal?.aborted || !this.router.isActive() || !snapshot || !this.router.isCurrent(snapshot) || ownerRevision !== this.session.getOperatorRevision()) return false;
                const origin = this.router.getControlOrigin(snapshot);
                if (origin === 'terminal') return true;
                if (origin !== 'whatsapp' || !snapshot.target || !this.allowed(snapshot.target)) return false;
                return this.matchesVerifiedActor(this.router.getRequestMetadata(snapshot).actorJid);
            } catch { return false; }
        };
        if (!snapshot || this.router.getControlOrigin(snapshot) === 'unknown') throw new OwnerAuthorizationError(t('voice.authUnknown'));
        if (this.router.getControlOrigin(snapshot) === 'whatsapp' && !this.session.getOperatorJid()) throw new OwnerAuthorizationError(t('voice.authNoOwner'));
        if (!check()) throw new OwnerAuthorizationError(t('voice.authDenied'));
        return Object.freeze({ isCurrent: check });
    }

    /** Reusable by exact phone commands; caller supplies a transport-verified actor, never parsed text. */
    matchesVerifiedActor(actor: string | undefined): boolean {
        try {
            const configured = this.session.getOperatorJid();
            const owner = configured ? this.canonical(configured) : undefined;
            const canonicalActor = actor ? this.canonical(actor) : undefined;
            return !!owner && /^\d+@(s\.whatsapp\.net|lid)$/.test(owner) && owner === canonicalActor;
        } catch { return false; }
    }
}
