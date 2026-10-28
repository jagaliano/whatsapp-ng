import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ci = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
const release = readFileSync(new URL('../../.github/workflows/publish.yml', import.meta.url), 'utf8');
const [prepare, publish] = release.split('\n  publish:\n');

// Contract checks complement actionlint; these assertions are not a YAML parser or live GitHub proof.
describe('default-off GitHub release workflow contract', () => {
    it('validates PRs/main without OIDC or publication permissions', () => {
        expect(ci).toContain('pull_request:'); expect(ci).toContain('branches: [main]'); expect(ci).toContain('workflow_dispatch:');
        expect(ci).toContain('contents: read'); expect(ci).not.toContain('id-token:'); expect(ci).not.toContain('contents: write');
        expect(ci).toContain('npm run release:prepare'); expect(ci).not.toContain('release:publish-ci'); expect(ci).not.toContain('pull_request_target');
    });
    it('requires an explicit release tag and serializes publication without cancelling it', () => {
        expect(release).toContain("tags: ['v*']"); expect(release).not.toContain('workflow_dispatch:'); expect(release).not.toContain('pull_request:');
        expect(release).toContain('group: npm-release'); expect(release).toContain('cancel-in-progress: false');
        expect(prepare).toContain('npm run release:check-tag'); expect(prepare).toContain('fetch-depth: 0');
    });
    it('grants OIDC only after the explicit default-off and environment gates', () => {
        expect(prepare).not.toContain('id-token:'); expect(publish).toContain('id-token: write'); expect(publish).toContain('contents: read');
        expect(publish).toContain("vars.NPM_PUBLISH_ENABLED == 'true'"); expect(publish).toContain('github.run_attempt == 1');
        expect(publish).toContain("github.repository == 'jagaliano/whatsapp-ng'"); expect(publish).toContain('environment: npm-publish');
        expect(release).not.toContain('contents: write'); expect(release).not.toContain('secrets.'); expect(release).not.toContain('NODE_AUTH_TOKEN:'); expect(release).not.toContain('NPM_TOKEN:');
    });
    it('transfers only the candidate/receipt by exact artifact ID and never repacks in the privileged job', () => {
        expect(prepare).toContain('.pi/cache/releases/prepared.json'); expect(prepare).toContain('.pi/cache/releases/*/*.tgz');
        expect(prepare).toContain('include-hidden-files: true'); expect(prepare).toContain('if-no-files-found: error');
        expect(publish).toContain('artifact-ids: ${{ needs.prepare.outputs.artifact-id }}'); expect(publish).toContain('merge-multiple: true');
        expect(publish).toContain('ref: ${{ github.sha }}'); expect(publish).toContain('npm run release:publish-ci');
        expect(publish).not.toContain('npm ci '); expect(publish).not.toContain('npm pack'); expect(publish).not.toContain('release:prepare');
        expect(publish.match(/run: npm run release:publish-ci/g)).toHaveLength(1);
        expect(publish).toContain('if: always()'); expect(publish).toContain('.pi/cache/releases/publish-*.attempt.json');
    });
    it('uses immutable official action revisions, pinned runtime and script-disabled installs', () => {
        for (const workflow of [ci, release]) {
            const uses = [...workflow.matchAll(/\buses:\s*(\S+)/g)].map(match => match[1]); expect(uses.length).toBeGreaterThan(0);
            for (const use of uses) expect(use).toMatch(/^actions\/[a-z-]+@[a-f0-9]{40}$/);
            expect(workflow).toContain("node-version: '26.12.1'"); expect(workflow).toContain('npm@11.20.0');
            expect(workflow).toContain('package-manager-cache: false'); expect(workflow).toContain('persist-credentials: false');
            expect(workflow).not.toContain('registry-url:');
        }
        expect(ci).toContain('npm ci --ignore-scripts --legacy-peer-deps --no-audit --no-fund');
        expect(prepare).toContain('npm ci --ignore-scripts --legacy-peer-deps --no-audit --no-fund');
    });
});
