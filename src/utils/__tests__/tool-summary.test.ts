/**
 * Tests for tool summary generation utilities.
 */

import { describe, it, expect } from '@jest/globals';
import { generateToolSummary, extractLastLine, extractPreview } from '../tool-summary.js';

describe('extractLastLine', () => {
  it('extracts the last line from multi-line output', () => {
    const output = 'line 1\nline 2\nline 3';
    expect(extractLastLine(output)).toBe('line 3');
  });

  it('returns empty string for empty input', () => {
    expect(extractLastLine('')).toBe('');
  });

  it('handles single line input', () => {
    expect(extractLastLine('single line')).toBe('single line');
  });

  it('trims whitespace from last line', () => {
    expect(extractLastLine('line 1\n  line 2  ')).toBe('line 2');
  });

  it('truncates long lines', () => {
    const longLine = 'x'.repeat(100);
    const result = extractLastLine(longLine);
    expect(result.length).toBeLessThanOrEqual(40);
    expect(result.endsWith('...')).toBe(true);
  });
});

describe('extractPreview', () => {
  it('extracts first N lines for preview', () => {
    const output = 'line 1\nline 2\nline 3\nline 4\nline 5\nline 6';
    const preview = extractPreview(output, 3);
    expect(preview).toEqual(['line 1', 'line 2', 'line 3']);
  });

  it('returns all lines if fewer than N', () => {
    const output = 'line 1\nline 2';
    const preview = extractPreview(output, 5);
    expect(preview).toEqual(['line 1', 'line 2']);
  });

  it('uses default of 5 lines', () => {
    const output = 'a\nb\nc\nd\ne\nf\ng';
    const preview = extractPreview(output);
    expect(preview).toHaveLength(5);
  });
});

describe('generateToolSummary', () => {
  describe('bash tool', () => {
    it('generates summary for successful command', () => {
      const summary = generateToolSummary(
        'bash',
        { command: 'npm test' },
        { success: true, message: 'Tests passed\n10 passing' },
        { command: 'npm test', exitCode: 0, truncated: false, durationMs: 1000 }
      );
      expect(summary.primary).toBe('npm test');
      expect(summary.summary).toBe('10 passing');
    });

    it('generates summary for failed command', () => {
      const summary = generateToolSummary(
        'bash',
        { command: 'npm test' },
        { success: false, message: 'Error' },
        { command: 'npm test', exitCode: 1, truncated: false, durationMs: 100, error: true }
      );
      expect(summary.primary).toBe('npm test');
      expect(summary.summary).toBe('exit 1');
    });

    it('uses description if provided', () => {
      const summary = generateToolSummary(
        'bash',
        { command: 'git status', description: 'Check git status' },
        { success: true, message: '' },
        { command: 'git status', exitCode: 0, truncated: false, durationMs: 100 }
      );
      expect(summary.primary).toBe('Check git status');
    });

    it('shows killed for null exit code', () => {
      const summary = generateToolSummary(
        'bash',
        { command: 'sleep 1000' },
        { success: false, message: '' },
        { command: 'sleep 1000', exitCode: null, truncated: false, durationMs: 5000 }
      );
      expect(summary.summary).toBe('killed');
    });
  });

  describe('glob tool', () => {
    it('generates summary for matches found', () => {
      const summary = generateToolSummary(
        'glob',
        { pattern: '**/*.ts' },
        { success: true, message: '' },
        { pattern: '**/*.ts', fileCount: 42, truncated: false }
      );
      expect(summary.primary).toBe('**/*.ts');
      expect(summary.summary).toBe('42 files');
    });

    it('shows no matches', () => {
      const summary = generateToolSummary(
        'glob',
        { pattern: '**/*.xyz' },
        { success: true, message: '' },
        { pattern: '**/*.xyz', fileCount: 0, truncated: false }
      );
      expect(summary.summary).toBe('no matches');
    });

    it('shows truncated indicator', () => {
      const summary = generateToolSummary(
        'glob',
        { pattern: '**/*' },
        { success: true, message: '' },
        { pattern: '**/*', fileCount: 100, truncated: true }
      );
      expect(summary.summary).toBe('100+ files');
    });

    it('shows singular for 1 file', () => {
      const summary = generateToolSummary(
        'glob',
        { pattern: 'package.json' },
        { success: true, message: '' },
        { pattern: 'package.json', fileCount: 1, truncated: false }
      );
      expect(summary.summary).toBe('1 file');
    });
  });

  describe('read tool', () => {
    it('generates summary for full file read', () => {
      const summary = generateToolSummary(
        'read',
        { file_path: 'src/index.ts' },
        { success: true, message: '' },
        { path: 'src/index.ts', totalLines: 150, startLine: 1, endLine: 150, truncated: false }
      );
      expect(summary.primary).toBe('src/index.ts');
      expect(summary.summary).toBe('150 lines');
    });

    it('shows partial read for truncated files', () => {
      const summary = generateToolSummary(
        'read',
        { file_path: 'big-file.ts' },
        { success: true, message: '' },
        { path: 'big-file.ts', totalLines: 5000, startLine: 1, endLine: 200, truncated: true }
      );
      expect(summary.summary).toBe('200/5000 lines');
    });

    it('shows singular for 1 line', () => {
      const summary = generateToolSummary(
        'read',
        { file_path: 'VERSION' },
        { success: true, message: '' },
        { path: 'VERSION', totalLines: 1, startLine: 1, endLine: 1, truncated: false }
      );
      expect(summary.summary).toBe('1 line');
    });
  });

  describe('edit tool', () => {
    it('generates summary for edit with size change', () => {
      const summary = generateToolSummary(
        'edit',
        { file_path: 'config.ts' },
        { success: true, message: '' },
        { path: 'config.ts', replacements: 1, originalSize: 100, newSize: 150 }
      );
      expect(summary.primary).toBe('config.ts');
      expect(summary.summary).toBe('1 change (+50)');
    });

    it('shows negative size change', () => {
      const summary = generateToolSummary(
        'edit',
        { file_path: 'config.ts' },
        { success: true, message: '' },
        { path: 'config.ts', replacements: 2, originalSize: 200, newSize: 150 }
      );
      expect(summary.summary).toBe('2 changes (-50)');
    });

    it('shows zero size change', () => {
      const summary = generateToolSummary(
        'edit',
        { file_path: 'config.ts' },
        { success: true, message: '' },
        { path: 'config.ts', replacements: 1, originalSize: 100, newSize: 100 }
      );
      expect(summary.summary).toBe('1 change (0)');
    });
  });

  describe('grep tool', () => {
    it('generates summary for matches found', () => {
      const summary = generateToolSummary(
        'grep',
        { pattern: 'TODO' },
        { success: true, message: '' },
        { pattern: 'TODO', matchCount: 15, filesSearched: 100, truncated: false }
      );
      expect(summary.primary).toBe('"TODO"');
      expect(summary.summary).toBe('15 matches');
    });

    it('shows no matches', () => {
      const summary = generateToolSummary(
        'grep',
        { pattern: 'NONEXISTENT' },
        { success: true, message: '' },
        { pattern: 'NONEXISTENT', matchCount: 0, filesSearched: 50, truncated: false }
      );
      expect(summary.summary).toBe('no matches');
    });

    it('shows truncated indicator', () => {
      const summary = generateToolSummary(
        'grep',
        { pattern: 'import' },
        { success: true, message: '' },
        { pattern: 'import', matchCount: 100, filesSearched: 200, truncated: true }
      );
      expect(summary.summary).toBe('100+ matches');
    });
  });

  describe('list tool', () => {
    it('generates summary for directory listing', () => {
      const summary = generateToolSummary(
        'list',
        { path: 'src' },
        { success: true, message: '' },
        { path: 'src', entryCount: 25, truncated: false }
      );
      expect(summary.primary).toBe('src');
      expect(summary.summary).toBe('25 entries');
    });

    it('uses default path', () => {
      const summary = generateToolSummary(
        'list',
        {},
        { success: true, message: '' },
        { path: '', entryCount: 10, truncated: false }
      );
      expect(summary.primary).toBe('.');
    });

    it('shows singular for 1 entry', () => {
      const summary = generateToolSummary(
        'list',
        { path: 'single' },
        { success: true, message: '' },
        { path: 'single', entryCount: 1, truncated: false }
      );
      expect(summary.summary).toBe('1 entry');
    });
  });

  describe('write tool', () => {
    it('generates summary for new file', () => {
      const summary = generateToolSummary(
        'write',
        { file_path: 'new.ts' },
        { success: true, message: '' },
        { path: 'new.ts', bytesWritten: 1500, existedBefore: false }
      );
      expect(summary.primary).toBe('new.ts');
      expect(summary.summary).toBe('created (1.5KB)');
    });

    it('shows updated for existing file', () => {
      const summary = generateToolSummary(
        'write',
        { file_path: 'existing.ts' },
        { success: true, message: '' },
        { path: 'existing.ts', bytesWritten: 500, existedBefore: true }
      );
      expect(summary.summary).toBe('updated (500B)');
    });
  });

  describe('webfetch tool', () => {
    it('extracts hostname from URL', () => {
      const summary = generateToolSummary(
        'webfetch',
        { url: 'https://api.example.com/data' },
        { success: true, message: '' },
        { url: 'https://api.example.com/data', statusCode: 200, contentType: 'application/json' }
      );
      expect(summary.primary).toBe('api.example.com');
      expect(summary.summary).toBe('200 application/json');
    });

    it('handles missing status code', () => {
      const summary = generateToolSummary(
        'webfetch',
        { url: 'https://example.com' },
        { success: true, message: '' },
        { url: 'https://example.com' }
      );
      expect(summary.summary).toBe('fetched');
    });
  });

  describe('todo tool', () => {
    it('counts todo items', () => {
      const summary = generateToolSummary(
        'todo',
        { todos: [{ content: 'Task 1' }, { content: 'Task 2' }, { content: 'Task 3' }] },
        { success: true, message: '' },
        {}
      );
      expect(summary.primary).toBe('todos');
      expect(summary.summary).toBe('3 items');
    });

    it('shows singular for 1 item', () => {
      const summary = generateToolSummary(
        'todo',
        { todos: [{ content: 'Task 1' }] },
        { success: true, message: '' },
        {}
      );
      expect(summary.summary).toBe('1 item');
    });
  });

  describe('unknown tool', () => {
    it('uses default summary', () => {
      const summary = generateToolSummary(
        'unknown_tool',
        { query: 'test query' },
        { success: true, message: '' },
        {}
      );
      expect(summary.primary).toBe('test query');
      expect(summary.summary).toBe('done');
    });

    it('shows error for failed result', () => {
      const summary = generateToolSummary(
        'unknown_tool',
        {},
        { success: false, message: 'Error occurred' },
        {}
      );
      expect(summary.summary).toBe('error');
    });
  });

  describe('error handling', () => {
    it('shows error for tools with error in metadata', () => {
      const summary = generateToolSummary(
        'glob',
        { pattern: '**/*' },
        { success: false, message: '' },
        { pattern: '**/*', fileCount: 0, truncated: false, error: 'Permission denied' }
      );
      expect(summary.summary).toBe('error');
    });

    it('truncates long primary args', () => {
      const longPath = 'a'.repeat(100);
      const summary = generateToolSummary(
        'read',
        { file_path: longPath },
        { success: true, message: '' },
        { path: longPath, totalLines: 10, startLine: 1, endLine: 10, truncated: false }
      );
      expect(summary.primary.length).toBeLessThanOrEqual(50);
      expect(summary.primary.endsWith('...')).toBe(true);
    });
  });
});
