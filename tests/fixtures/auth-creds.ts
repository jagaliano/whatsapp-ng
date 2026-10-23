import { BufferJSON } from 'baileys';

// Deliberately non-cryptographic fixture bytes. Never connect these credentials.
export function syntheticCredentials(label = 'fixture') {
    const keyPair = () => ({ public: Buffer.alloc(32, 1), private: Buffer.alloc(32, 2) });
    return {
        synthetic: label,
        noiseKey: keyPair(), pairingEphemeralKeyPair: keyPair(), signedIdentityKey: keyPair(),
        signedPreKey: { keyPair: keyPair(), signature: Buffer.alloc(64, 3), keyId: 1 },
        registrationId: 1, advSecretKey: Buffer.alloc(32, 4).toString('base64'),
        processedHistoryMessages: [], nextPreKeyId: 1, firstUnuploadedPreKeyId: 1,
        accountSyncCounter: 0, accountSettings: { unarchiveChats: false }, registered: false
    };
}

export function serializedCredentials(label = 'fixture'): string {
    return JSON.stringify(syntheticCredentials(label), BufferJSON.replacer);
}
