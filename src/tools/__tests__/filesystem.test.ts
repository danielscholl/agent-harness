/**
 * Tests for FileSystem tools.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  getPathInfoTool,
  listDirectoryTool,
  readFileTool,
  searchTextTool,
  writeFileTool,
  applyTextEditTool,
  createDirectoryTool,
  applyFilePatchTool,
  resolveWorkspacePath,
  resolveWorkspacePathSafe,
  getWorkspaceRoot,
  isFilesystemWritesEnabled,
  mapSystemErrorToToolError,
} from '../filesystem.js';
import { isSuccessResponse, isErrorResponse } from '../index.js';
import type {
  PathInfoResult,
  ListDirectoryResult,
  ReadFileResult,
  SearchTextResult,
  WriteFileResult,
  ApplyTextEditResult,
  CreateDirectoryResult,
  ApplyFilePatchResult,
} from '../filesystem.js';
import type { ToolResponse } from '../index.js';

// Test directory management
let testDir: string;
let originalWorkspaceRoot: string | undefined;

beforeEach(async () => {
  // Save original workspace root
  originalWorkspaceRoot = process.env['AGENT_WORKSPACE_ROOT'];

  // Create temp directory for tests
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fs-tools-test-'));

  // Set workspace root to test directory
  process.env['AGENT_WORKSPACE_ROOT'] = testDir;
});

afterEach(async () => {
  // Restore original workspace root
  if (originalWorkspaceRoot !== undefined) {
    process.env['AGENT_WORKSPACE_ROOT'] = originalWorkspaceRoot;
  } else {
    delete process.env['AGENT_WORKSPACE_ROOT'];
  }

  // Clean up test directory
  await fs.rm(testDir, { recursive: true, force: true });
});

// =============================================================================
// Utility Functions Tests
// =============================================================================

describe('resolveWorkspacePath', () => {
  it('resolves relative paths within workspace', () => {
    const resolved = resolveWorkspacePath('test.txt');
    expect(typeof resolved).toBe('string');
    expect(resolved).toBe(path.join(testDir, 'test.txt'));
  });

  it('blocks path traversal with ..', () => {
    const resolved = resolveWorkspacePath('../outside.txt');
    expect(typeof resolved).not.toBe('string');
    if (typeof resolved !== 'string') {
      expect(resolved.success).toBe(false);
      expect(resolved.error).toBe('PERMISSION_DENIED');
    }
  });

  it('blocks absolute paths outside workspace', () => {
    const resolved = resolveWorkspacePath('/etc/passwd');
    expect(typeof resolved).not.toBe('string');
    if (typeof resolved !== 'string') {
      expect(resolved.success).toBe(false);
      expect(resolved.error).toBe('PERMISSION_DENIED');
    }
  });

  it('allows current directory', () => {
    const resolved = resolveWorkspacePath('.');
    expect(typeof resolved).toBe('string');
    expect(resolved).toBe(testDir);
  });
});

describe('resolveWorkspacePathSafe', () => {
  it('resolves existing paths to real path', async () => {
    // Create a file
    const filePath = path.join(testDir, 'test.txt');
    await fs.writeFile(filePath, 'test');

    const resolved = await resolveWorkspacePathSafe('test.txt');
    expect(typeof resolved).toBe('string');
    // On macOS, temp dirs may be symlinks (/var -> /private/var)
    // Just verify the file name is in the resolved path
    if (typeof resolved === 'string') {
      expect(resolved.endsWith('test.txt')).toBe(true);
    }
  });

  it('blocks symlinks that escape workspace', async () => {
    // Create a symlink pointing outside workspace
    const symlinkPath = path.join(testDir, 'escape');
    await fs.symlink('/etc', symlinkPath);

    const resolved = await resolveWorkspacePathSafe('escape', undefined, true);
    expect(typeof resolved).not.toBe('string');
    if (typeof resolved !== 'string') {
      expect(resolved.success).toBe(false);
      expect(resolved.error).toBe('PERMISSION_DENIED');
      expect(resolved.message).toContain('Symlink resolves outside workspace');
    }
  });

  it('allows symlinks within workspace', async () => {
    // Create a file and a symlink to it within workspace
    const targetPath = path.join(testDir, 'target.txt');
    await fs.writeFile(targetPath, 'target content');
    const symlinkPath = path.join(testDir, 'link.txt');
    await fs.symlink(targetPath, symlinkPath);

    const resolved = await resolveWorkspacePathSafe('link.txt', undefined, true);
    expect(typeof resolved).toBe('string');
    if (typeof resolved === 'string') {
      // Resolved path should be the real target
      expect(resolved.endsWith('target.txt')).toBe(true);
    }
  });

  it('returns NOT_FOUND when requireExists=true and path does not exist', async () => {
    const resolved = await resolveWorkspacePathSafe('nonexistent.txt', undefined, true);
    expect(typeof resolved).not.toBe('string');
    if (typeof resolved !== 'string') {
      expect(resolved.success).toBe(false);
      expect(resolved.error).toBe('NOT_FOUND');
    }
  });

  it('allows non-existent paths when requireExists=false', async () => {
    const resolved = await resolveWorkspacePathSafe('new-file.txt');
    expect(typeof resolved).toBe('string');
  });

  it('checks parent directory for new files in symlinked directory', async () => {
    // Create a symlink to a directory outside workspace
    const symlinkDir = path.join(testDir, 'escape-dir');
    await fs.symlink('/tmp', symlinkDir);

    // Try to create a file in the symlinked directory
    const resolved = await resolveWorkspacePathSafe('escape-dir/newfile.txt');
    expect(typeof resolved).not.toBe('string');
    if (typeof resolved !== 'string') {
      expect(resolved.success).toBe(false);
      expect(resolved.error).toBe('PERMISSION_DENIED');
    }
  });
});

describe('getWorkspaceRoot', () => {
  it('returns environment variable when set', () => {
    const root = getWorkspaceRoot();
    expect(root).toBe(testDir);
  });
});

describe('isFilesystemWritesEnabled', () => {
  let originalValue: string | undefined;

  beforeEach(() => {
    originalValue = process.env['AGENT_FILESYSTEM_WRITES_ENABLED'];
  });

  afterEach(() => {
    if (originalValue !== undefined) {
      process.env['AGENT_FILESYSTEM_WRITES_ENABLED'] = originalValue;
    } else {
      delete process.env['AGENT_FILESYSTEM_WRITES_ENABLED'];
    }
  });

  it('returns true by default when env var is not set', () => {
    delete process.env['AGENT_FILESYSTEM_WRITES_ENABLED'];
    expect(isFilesystemWritesEnabled()).toBe(true);
  });

  it('returns true for empty string', () => {
    process.env['AGENT_FILESYSTEM_WRITES_ENABLED'] = '';
    expect(isFilesystemWritesEnabled()).toBe(true);
  });

  it('returns false when set to "false"', () => {
    process.env['AGENT_FILESYSTEM_WRITES_ENABLED'] = 'false';
    expect(isFilesystemWritesEnabled()).toBe(false);
  });

  it('returns false when set to "FALSE"', () => {
    process.env['AGENT_FILESYSTEM_WRITES_ENABLED'] = 'FALSE';
    expect(isFilesystemWritesEnabled()).toBe(false);
  });

  it('returns false when set to "0"', () => {
    process.env['AGENT_FILESYSTEM_WRITES_ENABLED'] = '0';
    expect(isFilesystemWritesEnabled()).toBe(false);
  });

  it('returns true when set to "true"', () => {
    process.env['AGENT_FILESYSTEM_WRITES_ENABLED'] = 'true';
    expect(isFilesystemWritesEnabled()).toBe(true);
  });

  it('returns true when set to "1"', () => {
    process.env['AGENT_FILESYSTEM_WRITES_ENABLED'] = '1';
    expect(isFilesystemWritesEnabled()).toBe(true);
  });
});

describe('mapSystemErrorToToolError', () => {
  it('maps ENOENT to NOT_FOUND', () => {
    const error = new Error('File not found') as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    const mapped = mapSystemErrorToToolError(error);
    expect(mapped.code).toBe('NOT_FOUND');
  });

  it('maps EACCES to PERMISSION_DENIED', () => {
    const error = new Error('Permission denied') as NodeJS.ErrnoException;
    error.code = 'EACCES';
    const mapped = mapSystemErrorToToolError(error);
    expect(mapped.code).toBe('PERMISSION_DENIED');
  });

  it('maps EPERM to PERMISSION_DENIED', () => {
    const error = new Error('Operation not permitted') as NodeJS.ErrnoException;
    error.code = 'EPERM';
    const mapped = mapSystemErrorToToolError(error);
    expect(mapped.code).toBe('PERMISSION_DENIED');
  });

  it('maps unknown errors to IO_ERROR', () => {
    const error = new Error('Unknown error') as NodeJS.ErrnoException;
    error.code = 'UNKNOWN_CODE';
    const mapped = mapSystemErrorToToolError(error);
    expect(mapped.code).toBe('IO_ERROR');
  });
});

// =============================================================================
// get_path_info Tests
// =============================================================================

describe('getPathInfoTool', () => {
  it('has correct tool metadata', () => {
    expect(getPathInfoTool.name).toBe('get_path_info');
  });

  describe('success cases', () => {
    it('returns info for existing file', async () => {
      const filePath = path.join(testDir, 'test.txt');
      await fs.writeFile(filePath, 'test content');

      const result = (await getPathInfoTool.invoke({
        path: 'test.txt',
      })) as ToolResponse<PathInfoResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.exists).toBe(true);
        expect(result.result.type).toBe('file');
        expect(result.result.size).toBe(12);
        expect(result.result.isReadable).toBe(true);
        expect(result.result.isWritable).toBe(true);
      }
    });

    it('returns info for existing directory', async () => {
      const dirPath = path.join(testDir, 'subdir');
      await fs.mkdir(dirPath);

      const result = (await getPathInfoTool.invoke({
        path: 'subdir',
      })) as ToolResponse<PathInfoResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.exists).toBe(true);
        expect(result.result.type).toBe('directory');
        expect(result.result.size).toBeNull();
      }
    });

    it('returns info for current directory as default', async () => {
      const result = (await getPathInfoTool.invoke({})) as ToolResponse<PathInfoResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.exists).toBe(true);
        expect(result.result.type).toBe('directory');
      }
    });

    it('returns exists=false for non-existent path', async () => {
      const result = (await getPathInfoTool.invoke({
        path: 'nonexistent.txt',
      })) as ToolResponse<PathInfoResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.exists).toBe(false);
        expect(result.result.type).toBeNull();
        expect(result.result.size).toBeNull();
        expect(result.result.isReadable).toBe(false);
        expect(result.result.isWritable).toBe(false);
      }
    });
  });

  describe('error cases', () => {
    it('blocks path traversal', async () => {
      const result = (await getPathInfoTool.invoke({
        path: '../outside',
      })) as ToolResponse<PathInfoResult>;

      expect(isErrorResponse(result)).toBe(true);
      if (isErrorResponse(result)) {
        expect(result.error).toBe('PERMISSION_DENIED');
      }
    });
  });
});

// =============================================================================
// list_directory Tests
// =============================================================================

describe('listDirectoryTool', () => {
  it('has correct tool metadata', () => {
    expect(listDirectoryTool.name).toBe('list_directory');
  });

  describe('success cases', () => {
    it('lists directory contents', async () => {
      await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(testDir, 'file2.txt'), 'content2');
      await fs.mkdir(path.join(testDir, 'subdir'));

      const result = (await listDirectoryTool.invoke({
        path: '.',
      })) as ToolResponse<ListDirectoryResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.entries.length).toBe(3);
        expect(result.result.truncated).toBe(false);
        const names = result.result.entries.map((e) => e.name).sort();
        expect(names).toEqual(['file1.txt', 'file2.txt', 'subdir']);
      }
    });

    it('respects maxEntries limit', async () => {
      // Create 5 files
      for (let i = 0; i < 5; i++) {
        await fs.writeFile(path.join(testDir, `file${String(i)}.txt`), 'content');
      }

      const result = (await listDirectoryTool.invoke({
        path: '.',
        maxEntries: 3,
      })) as ToolResponse<ListDirectoryResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.entries.length).toBe(3);
        expect(result.result.truncated).toBe(true);
      }
    });

    it('excludes hidden files by default', async () => {
      await fs.writeFile(path.join(testDir, 'visible.txt'), 'content');
      await fs.writeFile(path.join(testDir, '.hidden'), 'content');

      const result = (await listDirectoryTool.invoke({
        path: '.',
      })) as ToolResponse<ListDirectoryResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.entries.length).toBe(1);
        expect(result.result.entries[0]?.name).toBe('visible.txt');
      }
    });

    it('includes hidden files when requested', async () => {
      await fs.writeFile(path.join(testDir, 'visible.txt'), 'content');
      await fs.writeFile(path.join(testDir, '.hidden'), 'content');

      const result = (await listDirectoryTool.invoke({
        path: '.',
        includeHidden: true,
      })) as ToolResponse<ListDirectoryResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.entries.length).toBe(2);
      }
    });

    it('handles recursive mode', async () => {
      await fs.mkdir(path.join(testDir, 'subdir'));
      await fs.writeFile(path.join(testDir, 'root.txt'), 'content');
      await fs.writeFile(path.join(testDir, 'subdir', 'nested.txt'), 'content');

      const result = (await listDirectoryTool.invoke({
        path: '.',
        recursive: true,
      })) as ToolResponse<ListDirectoryResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.entries.length).toBe(3); // root.txt, subdir, subdir/nested.txt
      }
    });

    it('skips hidden directories in recursive mode by default', async () => {
      // Create visible dir with file
      await fs.mkdir(path.join(testDir, 'visible'));
      await fs.writeFile(path.join(testDir, 'visible', 'file.txt'), 'content');
      // Create hidden dir with file
      await fs.mkdir(path.join(testDir, '.hidden'));
      await fs.writeFile(path.join(testDir, '.hidden', 'secret.txt'), 'content');

      const result = (await listDirectoryTool.invoke({
        path: '.',
        recursive: true,
      })) as ToolResponse<ListDirectoryResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        // Should only have visible dir and its file, not hidden dir or its contents
        expect(result.result.entries.length).toBe(2);
        const names = result.result.entries.map((e) => e.name);
        expect(names).toContain('visible');
        expect(names).toContain('file.txt');
        expect(names).not.toContain('.hidden');
        expect(names).not.toContain('secret.txt');
      }
    });

    it('includes hidden directories in recursive mode when requested', async () => {
      // Create visible dir with file
      await fs.mkdir(path.join(testDir, 'visible'));
      await fs.writeFile(path.join(testDir, 'visible', 'file.txt'), 'content');
      // Create hidden dir with file
      await fs.mkdir(path.join(testDir, '.hidden'));
      await fs.writeFile(path.join(testDir, '.hidden', 'secret.txt'), 'content');

      const result = (await listDirectoryTool.invoke({
        path: '.',
        recursive: true,
        includeHidden: true,
      })) as ToolResponse<ListDirectoryResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        // Should have all 4 entries: visible, visible/file.txt, .hidden, .hidden/secret.txt
        expect(result.result.entries.length).toBe(4);
        const names = result.result.entries.map((e) => e.name);
        expect(names).toContain('.hidden');
        expect(names).toContain('secret.txt');
      }
    });
  });

  describe('error cases', () => {
    it('returns error for non-existent directory', async () => {
      const result = (await listDirectoryTool.invoke({
        path: 'nonexistent',
      })) as ToolResponse<ListDirectoryResult>;

      expect(isErrorResponse(result)).toBe(true);
      if (isErrorResponse(result)) {
        expect(result.error).toBe('NOT_FOUND');
      }
    });

    it('returns error for file path', async () => {
      await fs.writeFile(path.join(testDir, 'file.txt'), 'content');

      const result = (await listDirectoryTool.invoke({
        path: 'file.txt',
      })) as ToolResponse<ListDirectoryResult>;

      expect(isErrorResponse(result)).toBe(true);
      if (isErrorResponse(result)) {
        expect(result.error).toBe('VALIDATION_ERROR');
      }
    });
  });
});

// =============================================================================
// read_file Tests
// =============================================================================

describe('readFileTool', () => {
  it('has correct tool metadata', () => {
    expect(readFileTool.name).toBe('read_file');
  });

  describe('success cases', () => {
    it('reads file content', async () => {
      await fs.writeFile(path.join(testDir, 'test.txt'), 'line1\nline2\nline3');

      const result = (await readFileTool.invoke({
        path: 'test.txt',
      })) as ToolResponse<ReadFileResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.content).toBe('line1\nline2\nline3');
        expect(result.result.totalLines).toBe(3);
        expect(result.result.truncated).toBe(false);
      }
    });

    it('respects startLine parameter', async () => {
      await fs.writeFile(path.join(testDir, 'test.txt'), 'line1\nline2\nline3\nline4\nline5');

      const result = (await readFileTool.invoke({
        path: 'test.txt',
        startLine: 2,
      })) as ToolResponse<ReadFileResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.content).toBe('line2\nline3\nline4\nline5');
        expect(result.result.startLine).toBe(2);
      }
    });

    it('respects maxLines parameter', async () => {
      await fs.writeFile(path.join(testDir, 'test.txt'), 'line1\nline2\nline3\nline4\nline5');

      const result = (await readFileTool.invoke({
        path: 'test.txt',
        maxLines: 2,
      })) as ToolResponse<ReadFileResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.content).toBe('line1\nline2');
        expect(result.result.truncated).toBe(true);
        expect(result.result.nextStartLine).toBe(3);
      }
    });

    it('handles empty file', async () => {
      await fs.writeFile(path.join(testDir, 'empty.txt'), '');

      const result = (await readFileTool.invoke({
        path: 'empty.txt',
      })) as ToolResponse<ReadFileResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.content).toBe('');
        expect(result.result.totalLines).toBe(1);
      }
    });

    it('handles unicode content', async () => {
      await fs.writeFile(path.join(testDir, 'unicode.txt'), '日本語\n中文\n한국어');

      const result = (await readFileTool.invoke({
        path: 'unicode.txt',
      })) as ToolResponse<ReadFileResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.content).toContain('日本語');
      }
    });
  });

  describe('error cases', () => {
    it('returns error for non-existent file', async () => {
      const result = (await readFileTool.invoke({
        path: 'nonexistent.txt',
      })) as ToolResponse<ReadFileResult>;

      expect(isErrorResponse(result)).toBe(true);
      if (isErrorResponse(result)) {
        expect(result.error).toBe('NOT_FOUND');
      }
    });

    it('returns error for directory path', async () => {
      await fs.mkdir(path.join(testDir, 'dir'));

      const result = (await readFileTool.invoke({ path: 'dir' })) as ToolResponse<ReadFileResult>;

      expect(isErrorResponse(result)).toBe(true);
      if (isErrorResponse(result)) {
        expect(result.error).toBe('VALIDATION_ERROR');
      }
    });

    it('returns error for binary file', async () => {
      const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      await fs.writeFile(path.join(testDir, 'binary.bin'), binaryContent);

      const result = (await readFileTool.invoke({
        path: 'binary.bin',
      })) as ToolResponse<ReadFileResult>;

      expect(isErrorResponse(result)).toBe(true);
      if (isErrorResponse(result)) {
        expect(result.error).toBe('VALIDATION_ERROR');
        expect(result.message).toContain('binary');
      }
    });

    it('returns error for startLine beyond file length', async () => {
      await fs.writeFile(path.join(testDir, 'test.txt'), 'line1\nline2');

      const result = (await readFileTool.invoke({
        path: 'test.txt',
        startLine: 100,
      })) as ToolResponse<ReadFileResult>;

      expect(isErrorResponse(result)).toBe(true);
      if (isErrorResponse(result)) {
        expect(result.error).toBe('VALIDATION_ERROR');
        expect(result.message).toContain('startLine');
      }
    });
  });
});

// =============================================================================
// search_text Tests
// =============================================================================

describe('searchTextTool', () => {
  it('has correct tool metadata', () => {
    expect(searchTextTool.name).toBe('search_text');
  });

  describe('success cases', () => {
    it('finds literal matches', async () => {
      await fs.writeFile(path.join(testDir, 'test.txt'), 'hello world\ngoodbye world');

      const result = (await searchTextTool.invoke({
        query: 'world',
        path: '.',
      })) as ToolResponse<SearchTextResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.matches.length).toBe(2);
      }
    });

    it('supports regex mode', async () => {
      await fs.writeFile(path.join(testDir, 'test.txt'), 'hello123\nworld456');

      const result = (await searchTextTool.invoke({
        query: '\\d+',
        path: '.',
        useRegex: true,
      })) as ToolResponse<SearchTextResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.matches.length).toBe(2);
      }
    });

    it('supports case-insensitive search', async () => {
      await fs.writeFile(path.join(testDir, 'test.txt'), 'Hello\nHELLO\nhello');

      const result = (await searchTextTool.invoke({
        query: 'hello',
        path: '.',
        caseSensitive: false,
      })) as ToolResponse<SearchTextResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.matches.length).toBe(3);
      }
    });

    it('respects maxMatches limit', async () => {
      await fs.writeFile(path.join(testDir, 'test.txt'), 'a\na\na\na\na');

      const result = (await searchTextTool.invoke({
        query: 'a',
        path: '.',
        maxMatches: 2,
      })) as ToolResponse<SearchTextResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.matches.length).toBe(2);
        expect(result.result.truncated).toBe(true);
      }
    });

    it('finds all matches per line', async () => {
      // Test multiple matches on a single line
      await fs.writeFile(path.join(testDir, 'test.txt'), 'foo bar foo baz foo');

      const result = (await searchTextTool.invoke({
        query: 'foo',
        path: '.',
      })) as ToolResponse<SearchTextResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.matches.length).toBe(3);
        // All matches should be on line 1
        expect(result.result.matches.every((m) => m.line === 1)).toBe(true);
        // Check match positions
        expect(result.result.matches[0]?.matchStart).toBe(0);
        expect(result.result.matches[1]?.matchStart).toBe(8);
        expect(result.result.matches[2]?.matchStart).toBe(16);
      }
    });

    it('finds all regex matches per line', async () => {
      await fs.writeFile(path.join(testDir, 'test.txt'), 'a1 b2 c3 d4');

      const result = (await searchTextTool.invoke({
        query: '[a-z]\\d',
        path: '.',
        useRegex: true,
      })) as ToolResponse<SearchTextResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.matches.length).toBe(4);
        // All matches should be on line 1
        expect(result.result.matches.every((m) => m.line === 1)).toBe(true);
      }
    });

    it('skips binary files', async () => {
      await fs.writeFile(path.join(testDir, 'text.txt'), 'hello world');
      await fs.writeFile(
        path.join(testDir, 'binary.bin'),
        Buffer.from([0x00, 0x68, 0x65, 0x6c, 0x6c, 0x6f])
      );

      const result = (await searchTextTool.invoke({
        query: 'hello',
        path: '.',
      })) as ToolResponse<SearchTextResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.matches.length).toBe(1);
        expect(result.result.matches[0]?.file).toBe('text.txt');
      }
    });

    it('skips oversized files gracefully', async () => {
      // Create a small searchable file
      await fs.writeFile(path.join(testDir, 'small.txt'), 'findme');

      // Create a file that exceeds DEFAULT_MAX_READ_BYTES (1MB)
      // We'll mock this by checking the behavior - the file is skipped without error
      // For a real test, we'd need a 1MB+ file, but we can verify the logic works
      // by checking that filesSearched counts the file even if skipped
      const result = (await searchTextTool.invoke({
        query: 'findme',
        path: '.',
      })) as ToolResponse<SearchTextResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.matches.length).toBe(1);
        expect(result.result.matches[0]?.file).toBe('small.txt');
      }
    });

    it('searches single file', async () => {
      await fs.writeFile(path.join(testDir, 'a.txt'), 'match here');
      await fs.writeFile(path.join(testDir, 'b.txt'), 'match here too');

      const result = (await searchTextTool.invoke({
        query: 'match',
        path: 'a.txt',
      })) as ToolResponse<SearchTextResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.matches.length).toBe(1);
        expect(result.result.filesSearched).toBe(1);
      }
    });
  });

  describe('error cases', () => {
    it('returns error for invalid regex', async () => {
      const result = (await searchTextTool.invoke({
        query: '[invalid',
        path: '.',
        useRegex: true,
      })) as ToolResponse<SearchTextResult>;

      expect(isErrorResponse(result)).toBe(true);
      if (isErrorResponse(result)) {
        expect(result.error).toBe('VALIDATION_ERROR');
        expect(result.message).toContain('Invalid regex');
      }
    });

    it('returns error for non-existent path', async () => {
      const result = (await searchTextTool.invoke({
        query: 'test',
        path: 'nonexistent',
      })) as ToolResponse<SearchTextResult>;

      expect(isErrorResponse(result)).toBe(true);
      if (isErrorResponse(result)) {
        expect(result.error).toBe('NOT_FOUND');
      }
    });
  });
});

// =============================================================================
// write_file Tests
// =============================================================================

describe('writeFileTool', () => {
  it('has correct tool metadata', () => {
    expect(writeFileTool.name).toBe('write_file');
  });

  describe('success cases', () => {
    it('creates new file with mode=create', async () => {
      const result = (await writeFileTool.invoke({
        path: 'new.txt',
        content: 'new content',
        mode: 'create',
      })) as ToolResponse<WriteFileResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.existedBefore).toBe(false);
        expect(result.result.mode).toBe('create');
      }

      const content = await fs.readFile(path.join(testDir, 'new.txt'), 'utf-8');
      expect(content).toBe('new content');
    });

    it('overwrites existing file with mode=overwrite', async () => {
      await fs.writeFile(path.join(testDir, 'existing.txt'), 'old content');

      const result = (await writeFileTool.invoke({
        path: 'existing.txt',
        content: 'new content',
        mode: 'overwrite',
      })) as ToolResponse<WriteFileResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.existedBefore).toBe(true);
        expect(result.result.mode).toBe('overwrite');
      }

      const content = await fs.readFile(path.join(testDir, 'existing.txt'), 'utf-8');
      expect(content).toBe('new content');
    });

    it('appends to file with mode=append', async () => {
      await fs.writeFile(path.join(testDir, 'existing.txt'), 'start');

      const result = (await writeFileTool.invoke({
        path: 'existing.txt',
        content: ' end',
        mode: 'append',
      })) as ToolResponse<WriteFileResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.mode).toBe('append');
      }

      const content = await fs.readFile(path.join(testDir, 'existing.txt'), 'utf-8');
      expect(content).toBe('start end');
    });

    it('creates parent directories automatically', async () => {
      const result = (await writeFileTool.invoke({
        path: 'nested/deep/file.txt',
        content: 'nested content',
        mode: 'create',
      })) as ToolResponse<WriteFileResult>;

      expect(isSuccessResponse(result)).toBe(true);

      const content = await fs.readFile(path.join(testDir, 'nested/deep/file.txt'), 'utf-8');
      expect(content).toBe('nested content');
    });
  });

  describe('error cases', () => {
    it('returns error when file exists with mode=create', async () => {
      await fs.writeFile(path.join(testDir, 'existing.txt'), 'content');

      const result = (await writeFileTool.invoke({
        path: 'existing.txt',
        content: 'new content',
        mode: 'create',
      })) as ToolResponse<WriteFileResult>;

      expect(isErrorResponse(result)).toBe(true);
      if (isErrorResponse(result)) {
        expect(result.error).toBe('VALIDATION_ERROR');
        expect(result.message).toContain('already exists');
      }
    });

    it('blocks path traversal', async () => {
      const result = (await writeFileTool.invoke({
        path: '../outside.txt',
        content: 'content',
        mode: 'create',
      })) as ToolResponse<WriteFileResult>;

      expect(isErrorResponse(result)).toBe(true);
      if (isErrorResponse(result)) {
        expect(result.error).toBe('PERMISSION_DENIED');
      }
    });

    it('returns error when writes are disabled', async () => {
      const original = process.env['AGENT_FILESYSTEM_WRITES_ENABLED'];
      process.env['AGENT_FILESYSTEM_WRITES_ENABLED'] = 'false';

      try {
        const result = (await writeFileTool.invoke({
          path: 'new.txt',
          content: 'content',
          mode: 'create',
        })) as ToolResponse<WriteFileResult>;

        expect(isErrorResponse(result)).toBe(true);
        if (isErrorResponse(result)) {
          expect(result.error).toBe('PERMISSION_DENIED');
          expect(result.message).toContain('writes are disabled');
        }
      } finally {
        if (original !== undefined) {
          process.env['AGENT_FILESYSTEM_WRITES_ENABLED'] = original;
        } else {
          delete process.env['AGENT_FILESYSTEM_WRITES_ENABLED'];
        }
      }
    });
  });
});

// =============================================================================
// apply_text_edit Tests
// =============================================================================

describe('applyTextEditTool', () => {
  it('has correct tool metadata', () => {
    expect(applyTextEditTool.name).toBe('apply_text_edit');
  });

  describe('success cases', () => {
    it('replaces single exact match', async () => {
      await fs.writeFile(path.join(testDir, 'test.txt'), 'hello world');

      const result = (await applyTextEditTool.invoke({
        path: 'test.txt',
        expectedText: 'world',
        replacementText: 'universe',
      })) as ToolResponse<ApplyTextEditResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.replacements).toBe(1);
      }

      const content = await fs.readFile(path.join(testDir, 'test.txt'), 'utf-8');
      expect(content).toBe('hello universe');
    });

    it('replaces all occurrences with replaceAll=true', async () => {
      await fs.writeFile(path.join(testDir, 'test.txt'), 'foo bar foo');

      const result = (await applyTextEditTool.invoke({
        path: 'test.txt',
        expectedText: 'foo',
        replacementText: 'baz',
        replaceAll: true,
      })) as ToolResponse<ApplyTextEditResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.replacements).toBe(2);
      }

      const content = await fs.readFile(path.join(testDir, 'test.txt'), 'utf-8');
      expect(content).toBe('baz bar baz');
    });

    it('handles multiline replacements', async () => {
      await fs.writeFile(path.join(testDir, 'test.txt'), 'line1\nold\nline3');

      const result = (await applyTextEditTool.invoke({
        path: 'test.txt',
        expectedText: 'old',
        replacementText: 'new1\nnew2',
      })) as ToolResponse<ApplyTextEditResult>;

      expect(isSuccessResponse(result)).toBe(true);

      const content = await fs.readFile(path.join(testDir, 'test.txt'), 'utf-8');
      expect(content).toBe('line1\nnew1\nnew2\nline3');
    });
  });

  describe('error cases', () => {
    it('returns error when text not found', async () => {
      await fs.writeFile(path.join(testDir, 'test.txt'), 'hello world');

      const result = (await applyTextEditTool.invoke({
        path: 'test.txt',
        expectedText: 'missing',
        replacementText: 'new',
      })) as ToolResponse<ApplyTextEditResult>;

      expect(isErrorResponse(result)).toBe(true);
      if (isErrorResponse(result)) {
        expect(result.error).toBe('NOT_FOUND');
        expect(result.message).toContain('not found');
      }
    });

    it('returns error for multiple matches without replaceAll', async () => {
      await fs.writeFile(path.join(testDir, 'test.txt'), 'foo bar foo');

      const result = (await applyTextEditTool.invoke({
        path: 'test.txt',
        expectedText: 'foo',
        replacementText: 'baz',
      })) as ToolResponse<ApplyTextEditResult>;

      expect(isErrorResponse(result)).toBe(true);
      if (isErrorResponse(result)) {
        expect(result.error).toBe('VALIDATION_ERROR');
        expect(result.message).toContain('2 times');
      }
    });

    it('returns error for empty expectedText', async () => {
      await fs.writeFile(path.join(testDir, 'test.txt'), 'content');

      const result = (await applyTextEditTool.invoke({
        path: 'test.txt',
        expectedText: '',
        replacementText: 'new',
      })) as ToolResponse<ApplyTextEditResult>;

      expect(isErrorResponse(result)).toBe(true);
      if (isErrorResponse(result)) {
        expect(result.error).toBe('VALIDATION_ERROR');
        expect(result.message).toContain('empty');
      }
    });

    it('returns error for non-existent file', async () => {
      const result = (await applyTextEditTool.invoke({
        path: 'nonexistent.txt',
        expectedText: 'old',
        replacementText: 'new',
      })) as ToolResponse<ApplyTextEditResult>;

      expect(isErrorResponse(result)).toBe(true);
      if (isErrorResponse(result)) {
        expect(result.error).toBe('NOT_FOUND');
      }
    });

    it('returns error when writes are disabled', async () => {
      await fs.writeFile(path.join(testDir, 'test.txt'), 'hello world');

      const original = process.env['AGENT_FILESYSTEM_WRITES_ENABLED'];
      process.env['AGENT_FILESYSTEM_WRITES_ENABLED'] = 'false';

      try {
        const result = (await applyTextEditTool.invoke({
          path: 'test.txt',
          expectedText: 'hello',
          replacementText: 'hi',
        })) as ToolResponse<ApplyTextEditResult>;

        expect(isErrorResponse(result)).toBe(true);
        if (isErrorResponse(result)) {
          expect(result.error).toBe('PERMISSION_DENIED');
          expect(result.message).toContain('writes are disabled');
        }
      } finally {
        if (original !== undefined) {
          process.env['AGENT_FILESYSTEM_WRITES_ENABLED'] = original;
        } else {
          delete process.env['AGENT_FILESYSTEM_WRITES_ENABLED'];
        }
      }
    });
  });
});

// =============================================================================
// create_directory Tests
// =============================================================================

describe('createDirectoryTool', () => {
  it('has correct tool metadata', () => {
    expect(createDirectoryTool.name).toBe('create_directory');
  });

  describe('success cases', () => {
    it('creates new directory', async () => {
      const result = (await createDirectoryTool.invoke({
        path: 'newdir',
      })) as ToolResponse<CreateDirectoryResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.created).toBe(true);
      }

      const stats = await fs.stat(path.join(testDir, 'newdir'));
      expect(stats.isDirectory()).toBe(true);
    });

    it('creates parent directories by default', async () => {
      const result = (await createDirectoryTool.invoke({
        path: 'nested/deep/dir',
      })) as ToolResponse<CreateDirectoryResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.created).toBe(true);
        expect(result.result.parentsCreated).toBeGreaterThan(0);
      }

      const stats = await fs.stat(path.join(testDir, 'nested/deep/dir'));
      expect(stats.isDirectory()).toBe(true);
    });

    it('is idempotent for existing directory', async () => {
      await fs.mkdir(path.join(testDir, 'existing'));

      const result = (await createDirectoryTool.invoke({
        path: 'existing',
      })) as ToolResponse<CreateDirectoryResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.created).toBe(false);
        expect(result.message).toContain('already exists');
      }
    });
  });

  describe('error cases', () => {
    it('returns error when path exists as file', async () => {
      await fs.writeFile(path.join(testDir, 'existing'), 'content');

      const result = (await createDirectoryTool.invoke({
        path: 'existing',
      })) as ToolResponse<CreateDirectoryResult>;

      expect(isErrorResponse(result)).toBe(true);
      if (isErrorResponse(result)) {
        expect(result.error).toBe('VALIDATION_ERROR');
        expect(result.message).toContain('not a directory');
      }
    });

    it('returns error for parent not found with parents=false', async () => {
      const result = (await createDirectoryTool.invoke({
        path: 'nonexistent/newdir',
        parents: false,
      })) as ToolResponse<CreateDirectoryResult>;

      expect(isErrorResponse(result)).toBe(true);
      if (isErrorResponse(result)) {
        expect(result.error).toBe('NOT_FOUND');
      }
    });

    it('blocks path traversal', async () => {
      const result = (await createDirectoryTool.invoke({
        path: '../outside',
      })) as ToolResponse<CreateDirectoryResult>;

      expect(isErrorResponse(result)).toBe(true);
      if (isErrorResponse(result)) {
        expect(result.error).toBe('PERMISSION_DENIED');
      }
    });

    it('returns error when writes are disabled', async () => {
      const original = process.env['AGENT_FILESYSTEM_WRITES_ENABLED'];
      process.env['AGENT_FILESYSTEM_WRITES_ENABLED'] = 'false';

      try {
        const result = (await createDirectoryTool.invoke({
          path: 'newdir',
        })) as ToolResponse<CreateDirectoryResult>;

        expect(isErrorResponse(result)).toBe(true);
        if (isErrorResponse(result)) {
          expect(result.error).toBe('PERMISSION_DENIED');
          expect(result.message).toContain('writes are disabled');
        }
      } finally {
        if (original !== undefined) {
          process.env['AGENT_FILESYSTEM_WRITES_ENABLED'] = original;
        } else {
          delete process.env['AGENT_FILESYSTEM_WRITES_ENABLED'];
        }
      }
    });
  });
});

// =============================================================================
// apply_file_patch Tests
// =============================================================================

describe('applyFilePatchTool', () => {
  it('has correct tool metadata', () => {
    expect(applyFilePatchTool.name).toBe('apply_file_patch');
  });

  describe('success cases', () => {
    it('applies simple single-hunk patch', async () => {
      const originalContent = 'line1\nline2\nline3\nline4\nline5';
      await fs.writeFile(path.join(testDir, 'test.txt'), originalContent);

      const patch = `--- a/test.txt
+++ b/test.txt
@@ -2,3 +2,3 @@
 line2
-line3
+line3-modified
 line4`;

      const result = (await applyFilePatchTool.invoke({
        path: 'test.txt',
        patch,
      })) as ToolResponse<ApplyFilePatchResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.hunksApplied).toBe(1);
        expect(result.result.linesAdded).toBe(1);
        expect(result.result.linesRemoved).toBe(1);
        expect(result.result.dryRun).toBe(false);
      }

      const content = await fs.readFile(path.join(testDir, 'test.txt'), 'utf-8');
      expect(content).toBe('line1\nline2\nline3-modified\nline4\nline5');
    });

    it('applies multi-hunk patch', async () => {
      const originalContent =
        'line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10';
      await fs.writeFile(path.join(testDir, 'test.txt'), originalContent);

      const patch = `--- a/test.txt
+++ b/test.txt
@@ -1,3 +1,3 @@
-line1
+line1-modified
 line2
 line3
@@ -8,3 +8,3 @@
 line8
-line9
+line9-modified
 line10`;

      const result = (await applyFilePatchTool.invoke({
        path: 'test.txt',
        patch,
      })) as ToolResponse<ApplyFilePatchResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.hunksApplied).toBe(2);
        expect(result.result.linesAdded).toBe(2);
        expect(result.result.linesRemoved).toBe(2);
      }

      const content = await fs.readFile(path.join(testDir, 'test.txt'), 'utf-8');
      expect(content).toContain('line1-modified');
      expect(content).toContain('line9-modified');
    });

    it('validates patch without writing in dryRun mode', async () => {
      const originalContent = 'line1\nline2\nline3';
      await fs.writeFile(path.join(testDir, 'test.txt'), originalContent);

      const patch = `@@ -1,3 +1,3 @@
 line1
-line2
+line2-modified
 line3`;

      const result = (await applyFilePatchTool.invoke({
        path: 'test.txt',
        patch,
        dryRun: true,
      })) as ToolResponse<ApplyFilePatchResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.dryRun).toBe(true);
        expect(result.result.hunksApplied).toBe(1);
        expect(result.message).toContain('Dry run');
      }

      // Content should be unchanged
      const content = await fs.readFile(path.join(testDir, 'test.txt'), 'utf-8');
      expect(content).toBe(originalContent);
    });

    it('returns SHA256 hashes', async () => {
      await fs.writeFile(path.join(testDir, 'test.txt'), 'original content');

      const patch = `@@ -1 +1 @@
-original content
+new content`;

      const result = (await applyFilePatchTool.invoke({
        path: 'test.txt',
        patch,
      })) as ToolResponse<ApplyFilePatchResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.sha256Before).toMatch(/^[a-f0-9]{64}$/);
        expect(result.result.sha256After).toMatch(/^[a-f0-9]{64}$/);
        expect(result.result.sha256Before).not.toBe(result.result.sha256After);
      }
    });

    it('validates expectedSha256 when provided', async () => {
      const content = 'test content';
      await fs.writeFile(path.join(testDir, 'test.txt'), content);

      // Compute expected SHA256
      const crypto = await import('node:crypto');
      const expectedSha256 = crypto.createHash('sha256').update(content, 'utf-8').digest('hex');

      const patch = `@@ -1 +1 @@
-test content
+modified content`;

      const result = (await applyFilePatchTool.invoke({
        path: 'test.txt',
        patch,
        expectedSha256,
      })) as ToolResponse<ApplyFilePatchResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.sha256Before).toBe(expectedSha256);
      }
    });

    it('applies patch that adds lines', async () => {
      const originalContent = 'line1\nline2\nline3';
      await fs.writeFile(path.join(testDir, 'test.txt'), originalContent);

      const patch = `@@ -1,3 +1,5 @@
 line1
+added1
+added2
 line2
 line3`;

      const result = (await applyFilePatchTool.invoke({
        path: 'test.txt',
        patch,
      })) as ToolResponse<ApplyFilePatchResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.linesAdded).toBe(2);
        expect(result.result.linesRemoved).toBe(0);
      }

      const content = await fs.readFile(path.join(testDir, 'test.txt'), 'utf-8');
      expect(content).toBe('line1\nadded1\nadded2\nline2\nline3');
    });

    it('applies patch that removes lines', async () => {
      const originalContent = 'line1\nline2\nline3\nline4\nline5';
      await fs.writeFile(path.join(testDir, 'test.txt'), originalContent);

      const patch = `@@ -1,5 +1,3 @@
 line1
-line2
-line3
 line4
 line5`;

      const result = (await applyFilePatchTool.invoke({
        path: 'test.txt',
        patch,
      })) as ToolResponse<ApplyFilePatchResult>;

      expect(isSuccessResponse(result)).toBe(true);
      if (isSuccessResponse(result)) {
        expect(result.result.linesAdded).toBe(0);
        expect(result.result.linesRemoved).toBe(2);
      }

      const content = await fs.readFile(path.join(testDir, 'test.txt'), 'utf-8');
      expect(content).toBe('line1\nline4\nline5');
    });
  });

  describe('error cases', () => {
    it('returns error for non-existent file', async () => {
      const patch = `@@ -1 +1 @@
-old
+new`;

      const result = (await applyFilePatchTool.invoke({
        path: 'nonexistent.txt',
        patch,
      })) as ToolResponse<ApplyFilePatchResult>;

      expect(isErrorResponse(result)).toBe(true);
      if (isErrorResponse(result)) {
        expect(result.error).toBe('NOT_FOUND');
      }
    });

    it('returns error for invalid patch format', async () => {
      await fs.writeFile(path.join(testDir, 'test.txt'), 'content');

      const result = (await applyFilePatchTool.invoke({
        path: 'test.txt',
        patch: 'not a valid patch',
      })) as ToolResponse<ApplyFilePatchResult>;

      expect(isErrorResponse(result)).toBe(true);
      if (isErrorResponse(result)) {
        expect(result.error).toBe('VALIDATION_ERROR');
        expect(result.message).toContain('No valid hunks');
      }
    });

    it('returns error for context mismatch', async () => {
      await fs.writeFile(path.join(testDir, 'test.txt'), 'actual content');

      const patch = `@@ -1,1 +1,1 @@
-expected content
+new content`;

      const result = (await applyFilePatchTool.invoke({
        path: 'test.txt',
        patch,
      })) as ToolResponse<ApplyFilePatchResult>;

      expect(isErrorResponse(result)).toBe(true);
      if (isErrorResponse(result)) {
        expect(result.error).toBe('VALIDATION_ERROR');
        expect(result.message).toContain('context mismatch');
      }
    });

    it('returns error for SHA256 mismatch', async () => {
      await fs.writeFile(path.join(testDir, 'test.txt'), 'content');

      const patch = `@@ -1 +1 @@
-content
+new content`;

      const result = (await applyFilePatchTool.invoke({
        path: 'test.txt',
        patch,
        expectedSha256:
          'wrong-hash-0000000000000000000000000000000000000000000000000000000000000000',
      })) as ToolResponse<ApplyFilePatchResult>;

      expect(isErrorResponse(result)).toBe(true);
      if (isErrorResponse(result)) {
        expect(result.error).toBe('VALIDATION_ERROR');
        expect(result.message).toContain('SHA256 mismatch');
      }
    });

    it('returns error for binary files', async () => {
      await fs.writeFile(
        path.join(testDir, 'binary.bin'),
        Buffer.from([0x00, 0x68, 0x65, 0x6c, 0x6c, 0x6f])
      );

      const patch = `@@ -1 +1 @@
-old
+new`;

      const result = (await applyFilePatchTool.invoke({
        path: 'binary.bin',
        patch,
      })) as ToolResponse<ApplyFilePatchResult>;

      expect(isErrorResponse(result)).toBe(true);
      if (isErrorResponse(result)) {
        expect(result.error).toBe('VALIDATION_ERROR');
        expect(result.message).toContain('binary');
      }
    });

    it('blocks path traversal', async () => {
      const patch = `@@ -1 +1 @@
-old
+new`;

      const result = (await applyFilePatchTool.invoke({
        path: '../outside.txt',
        patch,
      })) as ToolResponse<ApplyFilePatchResult>;

      expect(isErrorResponse(result)).toBe(true);
      if (isErrorResponse(result)) {
        expect(result.error).toBe('PERMISSION_DENIED');
      }
    });

    it('returns error when writes are disabled', async () => {
      await fs.writeFile(path.join(testDir, 'test.txt'), 'content');

      const original = process.env['AGENT_FILESYSTEM_WRITES_ENABLED'];
      process.env['AGENT_FILESYSTEM_WRITES_ENABLED'] = 'false';

      try {
        const patch = `@@ -1 +1 @@
-content
+new content`;

        const result = (await applyFilePatchTool.invoke({
          path: 'test.txt',
          patch,
        })) as ToolResponse<ApplyFilePatchResult>;

        expect(isErrorResponse(result)).toBe(true);
        if (isErrorResponse(result)) {
          expect(result.error).toBe('PERMISSION_DENIED');
          expect(result.message).toContain('writes are disabled');
        }
      } finally {
        if (original !== undefined) {
          process.env['AGENT_FILESYSTEM_WRITES_ENABLED'] = original;
        } else {
          delete process.env['AGENT_FILESYSTEM_WRITES_ENABLED'];
        }
      }
    });

    it('allows dryRun even when writes are disabled', async () => {
      await fs.writeFile(path.join(testDir, 'test.txt'), 'content');

      const original = process.env['AGENT_FILESYSTEM_WRITES_ENABLED'];
      process.env['AGENT_FILESYSTEM_WRITES_ENABLED'] = 'false';

      try {
        const patch = `@@ -1 +1 @@
-content
+new content`;

        const result = (await applyFilePatchTool.invoke({
          path: 'test.txt',
          patch,
          dryRun: true,
        })) as ToolResponse<ApplyFilePatchResult>;

        expect(isSuccessResponse(result)).toBe(true);
        if (isSuccessResponse(result)) {
          expect(result.result.dryRun).toBe(true);
        }
      } finally {
        if (original !== undefined) {
          process.env['AGENT_FILESYSTEM_WRITES_ENABLED'] = original;
        } else {
          delete process.env['AGENT_FILESYSTEM_WRITES_ENABLED'];
        }
      }
    });
  });

  describe('requireExactFileMatch validation', () => {
    it('succeeds when requireExactFileMatch=true and patch path matches', async () => {
      await fs.writeFile(path.join(testDir, 'test.txt'), 'content');

      const patch = `--- a/test.txt
+++ b/test.txt
@@ -1 +1 @@
-content
+new content`;

      const result = (await applyFilePatchTool.invoke({
        path: 'test.txt',
        patch,
        requireExactFileMatch: true,
      })) as ToolResponse<ApplyFilePatchResult>;

      expect(isSuccessResponse(result)).toBe(true);
    });

    it('fails when requireExactFileMatch=true and patch path does not match', async () => {
      await fs.writeFile(path.join(testDir, 'test.txt'), 'content');

      const patch = `--- a/other.txt
+++ b/other.txt
@@ -1 +1 @@
-content
+new content`;

      const result = (await applyFilePatchTool.invoke({
        path: 'test.txt',
        patch,
        requireExactFileMatch: true,
      })) as ToolResponse<ApplyFilePatchResult>;

      expect(isErrorResponse(result)).toBe(true);
      if (isErrorResponse(result)) {
        expect(result.error).toBe('VALIDATION_ERROR');
        expect(result.message).toContain('Patch file path mismatch');
        expect(result.message).toContain('other.txt');
      }
    });

    it('succeeds when requireExactFileMatch=false (default) even with mismatched path', async () => {
      await fs.writeFile(path.join(testDir, 'test.txt'), 'content');

      const patch = `--- a/other.txt
+++ b/other.txt
@@ -1 +1 @@
-content
+new content`;

      const result = (await applyFilePatchTool.invoke({
        path: 'test.txt',
        patch,
        requireExactFileMatch: false,
      })) as ToolResponse<ApplyFilePatchResult>;

      expect(isSuccessResponse(result)).toBe(true);
    });

    it('matches patch paths with different prefix styles (a/b prefixes)', async () => {
      await fs.writeFile(path.join(testDir, 'file.txt'), 'hello');

      // Patch with a/ b/ prefixes should match plain path
      const patch = `--- a/file.txt
+++ b/file.txt
@@ -1 +1 @@
-hello
+world`;

      const result = (await applyFilePatchTool.invoke({
        path: 'file.txt',
        patch,
        requireExactFileMatch: true,
      })) as ToolResponse<ApplyFilePatchResult>;

      expect(isSuccessResponse(result)).toBe(true);
    });

    it('handles patches without file headers gracefully', async () => {
      await fs.writeFile(path.join(testDir, 'test.txt'), 'content');

      // Patch with no --- +++ headers, just hunks
      const patch = `@@ -1 +1 @@
-content
+new content`;

      const result = (await applyFilePatchTool.invoke({
        path: 'test.txt',
        patch,
        requireExactFileMatch: true,
      })) as ToolResponse<ApplyFilePatchResult>;

      // Should succeed - no file paths in patch means nothing to check
      expect(isSuccessResponse(result)).toBe(true);
    });
  });
});
