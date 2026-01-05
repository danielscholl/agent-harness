/**
 * Tests for skill plugin installer.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock child_process
const mockExecAsync = jest.fn();
jest.unstable_mockModule('node:child_process', () => ({
  exec: jest.fn(),
}));
jest.unstable_mockModule('node:util', () => ({
  promisify: jest.fn(() => mockExecAsync),
}));

// Mock fs/promises
const mockMkdir = jest.fn();
const mockRm = jest.fn();
const mockAccess = jest.fn();
const mockReaddir = jest.fn();
const mockReadFile = jest.fn();

jest.unstable_mockModule('node:fs/promises', () => ({
  mkdir: mockMkdir,
  rm: mockRm,
  access: mockAccess,
  readdir: mockReaddir,
  readFile: mockReadFile,
}));

// Mock os
jest.unstable_mockModule('node:os', () => ({
  homedir: () => '/home/user',
}));

// Mock parser - use a stable mock function
const mockParseSkillMd = jest.fn();

jest.unstable_mockModule('../parser.js', () => ({
  parseSkillMd: mockParseSkillMd,
}));

describe('installer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockRm.mockResolvedValue(undefined);
    mockAccess.mockRejectedValue(new Error('Not found')); // Default: file doesn't exist
    mockReaddir.mockResolvedValue([]);
    mockReadFile.mockResolvedValue('---\nname: test-skill\ndescription: Test\n---\n# Body');
    // Set up default parser mock result
    mockParseSkillMd.mockReturnValue({
      success: true,
      content: {
        manifest: {
          name: 'test-skill',
          description: 'A test skill',
        },
        body: '# Test Skill',
      },
    });
  });

  describe('getPluginsDir', () => {
    it('returns default plugins directory', async () => {
      const { getPluginsDir } = await import('../installer.js');
      expect(getPluginsDir()).toBe('/home/user/.agent/skills');
    });

    it('returns custom base directory when provided', async () => {
      const { getPluginsDir } = await import('../installer.js');
      expect(getPluginsDir('/custom/path')).toBe('/custom/path');
    });
  });

  describe('extractRepoName', () => {
    it('extracts repo name from HTTPS URL', async () => {
      const { extractRepoName } = await import('../installer.js');
      expect(extractRepoName('https://github.com/user/my-skill')).toBe('my-skill');
    });

    it('extracts repo name from HTTPS URL with .git suffix', async () => {
      const { extractRepoName } = await import('../installer.js');
      expect(extractRepoName('https://github.com/user/my-skill.git')).toBe('my-skill');
    });

    it('returns unknown-skill for invalid URL', async () => {
      const { extractRepoName } = await import('../installer.js');
      expect(extractRepoName('invalid')).toBe('unknown-skill');
    });
  });

  describe('installSkill', () => {
    it('clones repository and validates SKILL.md', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });
      // The installer checks: 1) target dir exists, 2) SKILL.md exists after clone
      // We need to reject first (dir doesn't exist) then resolve (SKILL.md exists)
      mockAccess
        .mockRejectedValueOnce(new Error('Not found')) // Target dir doesn't exist (line 103)
        .mockResolvedValueOnce(undefined); // SKILL.md exists (line 124)

      const { installSkill } = await import('../installer.js');
      const result = await installSkill({
        url: 'https://github.com/user/test-skill',
      });

      expect(result.success).toBe(true);
      expect(result.skillName).toBe('test-skill');
      expect(mockMkdir).toHaveBeenCalled();
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('git clone --depth 1'),
        expect.any(Object)
      );
    });

    it('returns error if skill already exists', async () => {
      mockAccess.mockResolvedValueOnce(undefined); // Target dir exists

      const { installSkill } = await import('../installer.js');
      const result = await installSkill({
        url: 'https://github.com/user/test-skill',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('supports --ref flag for specific branch/tag', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });
      mockAccess.mockRejectedValueOnce(new Error('Not found')).mockResolvedValueOnce(undefined);

      const { installSkill } = await import('../installer.js');
      await installSkill({
        url: 'https://github.com/user/test-skill',
        ref: 'v1.0.0',
      });

      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('--branch "v1.0.0"'),
        expect.any(Object)
      );
    });

    it('rolls back if SKILL.md is missing', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });
      mockAccess
        .mockRejectedValueOnce(new Error('Not found')) // Target dir doesn't exist
        .mockRejectedValueOnce(new Error('Not found')); // SKILL.md doesn't exist

      const { installSkill } = await import('../installer.js');
      const result = await installSkill({
        url: 'https://github.com/user/test-skill',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('SKILL.md');
      expect(mockRm).toHaveBeenCalled();
    });

    it('rolls back if SKILL.md validation fails', async () => {
      // Override the parse result to simulate failure
      mockParseSkillMd.mockReturnValue({
        success: false,
        error: 'Invalid manifest',
        type: 'VALIDATION_ERROR',
      });

      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });
      mockAccess.mockRejectedValueOnce(new Error('Not found')).mockResolvedValueOnce(undefined);

      const { installSkill } = await import('../installer.js');
      const result = await installSkill({
        url: 'https://github.com/user/test-skill',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid SKILL.md');
      expect(mockRm).toHaveBeenCalled();
    });

    it('handles git clone failure', async () => {
      mockExecAsync.mockRejectedValue(new Error('Git clone failed'));
      mockAccess.mockRejectedValueOnce(new Error('Not found'));

      const { installSkill } = await import('../installer.js');
      const result = await installSkill({
        url: 'https://github.com/user/test-skill',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to install');
    });
  });

  describe('updateSkill', () => {
    it('pulls latest changes for installed skill', async () => {
      mockAccess.mockResolvedValue(undefined); // Dir and .git exist
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'abc123\n', stderr: '' }) // Before hash
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git pull
        .mockResolvedValueOnce({ stdout: 'def456\n', stderr: '' }); // After hash

      const { updateSkill } = await import('../installer.js');
      const result = await updateSkill('test-skill');

      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
    });

    it('reports when already up to date', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'abc123\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'abc123\n', stderr: '' }); // Same hash

      const { updateSkill } = await import('../installer.js');
      const result = await updateSkill('test-skill');

      expect(result.success).toBe(true);
      expect(result.updated).toBe(false);
    });

    it('returns error if skill not found', async () => {
      mockAccess.mockRejectedValue(new Error('Not found'));

      const { updateSkill } = await import('../installer.js');
      const result = await updateSkill('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('returns error if not a git repository', async () => {
      mockAccess
        .mockResolvedValueOnce(undefined) // Dir exists
        .mockRejectedValueOnce(new Error('Not found')); // .git doesn't exist

      const { updateSkill } = await import('../installer.js');
      const result = await updateSkill('not-a-repo');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not a git repository');
    });
  });

  describe('removeSkill', () => {
    it('removes skill directory', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockRm.mockResolvedValue(undefined);

      const { removeSkill } = await import('../installer.js');
      const result = await removeSkill('test-skill');

      expect(result).toBe(true);
      expect(mockRm).toHaveBeenCalledWith(
        expect.stringContaining('test-skill'),
        expect.objectContaining({ recursive: true, force: true })
      );
    });

    it('returns false if skill not found', async () => {
      mockAccess.mockRejectedValue(new Error('Not found'));

      const { removeSkill } = await import('../installer.js');
      const result = await removeSkill('nonexistent');

      expect(result).toBe(false);
    });

    it('returns false on removal error', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockRm.mockRejectedValue(new Error('Permission denied'));

      const { removeSkill } = await import('../installer.js');
      const result = await removeSkill('test-skill');

      expect(result).toBe(false);
    });
  });

  describe('listInstalledPlugins', () => {
    it('returns empty array when no plugins installed', async () => {
      mockAccess.mockRejectedValue(new Error('Not found'));

      const { listInstalledPlugins } = await import('../installer.js');
      const result = await listInstalledPlugins();

      expect(result).toEqual([]);
    });

    it('lists plugins with SKILL.md files', async () => {
      mockAccess
        .mockResolvedValueOnce(undefined) // Plugins dir exists
        .mockResolvedValueOnce(undefined) // plugin-a/SKILL.md exists
        .mockRejectedValueOnce(new Error('Not found')) // plugin-b/SKILL.md doesn't exist
        .mockResolvedValueOnce(undefined); // plugin-c/SKILL.md exists

      mockReaddir.mockResolvedValue([
        { name: 'plugin-a', isDirectory: () => true },
        { name: 'plugin-b', isDirectory: () => true },
        { name: 'plugin-c', isDirectory: () => true },
        { name: 'file.txt', isDirectory: () => false },
      ]);

      const { listInstalledPlugins } = await import('../installer.js');
      const result = await listInstalledPlugins();

      expect(result).toEqual(['plugin-a', 'plugin-c']);
    });

    it('returns sorted list', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([
        { name: 'zebra-skill', isDirectory: () => true },
        { name: 'alpha-skill', isDirectory: () => true },
      ]);

      const { listInstalledPlugins } = await import('../installer.js');
      const result = await listInstalledPlugins();

      expect(result).toEqual(['alpha-skill', 'zebra-skill']);
    });
  });
});
