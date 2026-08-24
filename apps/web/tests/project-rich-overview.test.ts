import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

async function source(path: string): Promise<string> {
  return readFile(join(root, path), 'utf8');
}

describe('rich project overview vertical-slice contract', () => {
  it('shares the bounded rich-text schema with issues', async () => {
    const contracts = await source('packages/contracts/src/index.ts');
    expect(contracts).toContain('export const RichTextNodeSchema = Type.Recursive');
    expect(contracts).toContain('overviewDocument: RichTextDocumentSchema');
    expect(contracts).toContain('export const IssueRichTextDocumentSchema = RichTextDocumentSchema;');
    expect(contracts).not.toContain("content: Type.Array(Type.Object({\n    type: Type.Literal('paragraph'),\n    text:");
  });

  it('normalizes project overview content and records revisioned activity', async () => {
    const repository = await source('packages/db/src/sqlite/project-repository.ts');
    expect(repository).toContain("normalizeIssueDocument(input.overviewDocument ?? emptyDocument, 'overviewDocument')");
    expect(repository).toContain("normalizeIssueDocument(input.overviewDocument, 'overviewDocument')");
    expect(repository).toContain("changed('overviewDocument', current.overviewDocument, next.overviewDocument)");
    expect(repository).toContain("action: 'project.updated'");
  });

  it('imports canonical rich documents without mutating project identity fields', async () => {
    const transfer = await source('packages/db/src/sqlite/transfer.ts');
    expect(transfer).toContain('project.id, project.name, project.summary, project.status, project.priority');
    expect(transfer).toContain('project.position, JSON.stringify(project.overviewDocument), project.revision');
    expect(transfer).toContain('project.createdAt, project.updatedAt');
  });

  it('uses the shared editor and semantic renderer in project create, edit, and detail', async () => {
    const [issues, projects, styles, fixture] = await Promise.all([
      source('apps/web/src/issues.tsx'),
      source('apps/web/src/projects.tsx'),
      source('apps/web/src/styles.css'),
      source('scripts/serve-visual-fixture.mjs'),
    ]);
    expect(issues).toContain('export function RichTextEditor');
    expect(issues).toContain("attributes: { role: 'textbox', 'aria-label': label, 'aria-multiline': 'true'");
    expect(issues).toContain('export function RichTextView');
    expect(projects).toContain('RichTextEditor initial={overviewDocument}');
    expect(projects).toContain('<RichTextView document={current.overviewDocument} empty="No overview yet" />');
    expect(projects).not.toContain('name="overview"');
    expect(styles).toContain('.project-form .rich-editor-content { min-height: 160px; }');
    expect(fixture).toContain("text: 'Release discipline'");
    expect(fixture).toContain("marks: [{ type: 'bold' }]");
  });
});
