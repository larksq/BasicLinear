import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { fitTextareaHeight, type TextareaHeightTarget } from '../src/textarea-autosize.js';

const source = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

describe('issue title autosize', () => {
  it('measures from auto height and expands to the complete content height', () => {
    const target = {
      style: { height: '74px' },
      get scrollHeight() {
        expect(this.style.height).toBe('auto');
        return 163.2;
      },
    } satisfies TextareaHeightTarget;

    expect(fitTextareaHeight(target)).toBe(164);
    expect(target.style.height).toBe('164px');
  });

  it('remeasures from auto height so shorter content can shrink', () => {
    let scrollHeight = 196;
    const target = {
      style: { height: '74px' },
      get scrollHeight() {
        return scrollHeight;
      },
    } satisfies TextareaHeightTarget;

    expect(fitTextareaHeight(target)).toBe(196);
    scrollHeight = 74;
    expect(fitTextareaHeight(target)).toBe(74);
    expect(target.style.height).toBe('74px');
  });

  it('binds content and width changes without altering title or focus contracts', async () => {
    const [issues, styles] = await Promise.all([
      source('../src/issues.tsx'),
      source('../src/styles.css'),
    ]);
    const form = issues.slice(
      issues.indexOf('function IssueContentForm('),
      issues.indexOf('interface IssuePropertyNotice'),
    );

    expect(issues).toContain("import { fitTextareaHeight } from './textarea-autosize.js';");
    expect(form).toContain('const titleEditorRef = useRef<HTMLTextAreaElement>(null);');
    expect(form).toContain('if (titleEditorRef.current) fitTextareaHeight(titleEditorRef.current);');
    expect(form).toContain('}, [title]);');
    expect(form).toContain("if (!editor || typeof ResizeObserver === 'undefined') return;");
    expect(form).toContain('const observer = new ResizeObserver(() => fitTextareaHeight(editor));');
    expect(form).toContain('return () => observer.disconnect();');
    expect(form).toContain('ref={titleEditorRef}');
    expect(form).toContain('value={editing ? editableDraft.title : issue.title}');
    expect(form).toContain('rows={2} maxLength={240} required');
    expect(styles).toContain('.issue-title-editor textarea { width: 100%; min-height: 74px;');
    expect(styles).toContain('resize: none; overflow: hidden;');
    expect(styles).toContain('font-size: 24px; line-height: 1.35;');
    expect(styles).toContain('.issue-detail-panel-content .issue-title-editor textarea { min-height: 58px; font-size: 20px; }');
    expect(styles).toContain('.issue-title-editor textarea:focus-visible { box-shadow: inset 0 -2px var(--ol-focus); }');
  });
});
