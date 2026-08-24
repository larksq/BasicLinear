import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

async function source(path: string): Promise<string> {
  return readFile(join(root, path), 'utf8');
}

describe('issue resource vertical-slice contract', () => {
  it('keeps issue resources in the typed create, update, and response boundary', async () => {
    const contracts = await source('packages/contracts/src/index.ts');
    expect(contracts).toContain('export const IssueResourceInputSchema = ProjectResourceInputSchema;');
    expect(contracts).toContain('resources: Type.Array(IssueResourceSchema)');
    expect(contracts).toContain('resources: Type.Optional(Type.Array(IssueResourceInputSchema, { maxItems: 50 }))');
    expect(contracts).toContain('resources: Type.Array(IssueResourceInputSchema, { maxItems: 50 })');
  });

  it('persists ordered resources with foreign keys and transactional activity', async () => {
    const [schema, repository, helpers] = await Promise.all([
      source('packages/db/src/sqlite/client.ts'),
      source('packages/db/src/sqlite/issue-repository.ts'),
      source('packages/db/src/sqlite/helpers.ts'),
    ]);
    expect(schema).toContain('CREATE TABLE issue_resources');
    expect(schema).toContain('issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE');
    expect(schema).toContain('CREATE INDEX issue_resources_issue_idx ON issue_resources(issue_id)');
    expect(repository).toContain('normalizedIssueResources(input.resources ?? [])');
    expect(repository).toContain("replaceResources(db, 'issue_resources', 'issue_id', issueId, resources, timestamp)");
    expect(repository).toContain("changed('resources', currentResources, resources)");
    expect(helpers).toContain('normalizeHttpUrl(resource.url, `${prefix}.${index}.url`)');
  });

  it('carries resources through canonical import and export', async () => {
    const [transfer, canonical] = await Promise.all([
      source('packages/db/src/sqlite/transfer.ts'),
      source('packages/db/src/canonical.ts'),
    ]);
    expect(transfer).toContain('const issueResourceInsert = db.sqlite.prepare');
    expect(transfer).toContain('for (const resource of c.issueResources)');
    expect(transfer).toContain('resource.id, resource.issueId, resource.label, resource.url');
    expect(canonical).toContain("'issueResources'");
    expect(canonical).toContain("requireReference(issueIds, resource.issueId, 'issueResource.issueId')");
  });

  it('places resources after relations and before comments with revision-bound save behavior', async () => {
    const [issues, styles, fixture] = await Promise.all([
      source('apps/web/src/issues.tsx'),
      source('apps/web/src/styles.css'),
      source('scripts/serve-visual-fixture.mjs'),
    ]);
    const hierarchy = issues.indexOf('<IssueRelationSection hierarchy');
    const peers = issues.indexOf('<IssueRelationSection loading');
    const resources = issues.indexOf('aria-labelledby="issue-resources-title"');
    const comments = issues.indexOf('aria-labelledby="comments-title"');
    expect(hierarchy).toBeGreaterThan(-1);
    expect(peers).toBeGreaterThan(hierarchy);
    expect(resources).toBeGreaterThan(peers);
    expect(comments).toBeGreaterThan(resources);
    expect(issues).toContain('form={`issue-edit-form-${current.id}`}');
    expect(issues).toContain('disabled={!resourcesDirty || issueRevisionMutationPending}');
    expect(issues).toContain('Save resources</button>');
    expect(issues).toContain("current.archivedAt === null ? <button type=\"button\" className=\"icon-button\"");
    expect(styles).toContain('.issue-resource-list');
    expect(styles).toContain('.issue-resource-actions');
    expect(fixture).toContain("label: 'Interaction review notes'");
    expect(fixture).toContain("url: 'https://example.test/interaction-review'");
  });

  it('splits the rich-text editor without suppressing the build size budget', async () => {
    const vite = await source('apps/web/vite.config.ts');
    expect(vite).toContain("name: 'editor'");
    expect(vite).toContain('prosemirror-');
    expect(vite).not.toContain('chunkSizeWarningLimit');
  });
});
