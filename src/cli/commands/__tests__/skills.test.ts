/**
 * Tests for skill command handlers.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import type { CommandContext } from '../types.js';
import type { DiscoveredSkill } from '../../../skills/loader.js';

// Mock the SkillLoader
jest.unstable_mockModule('../../../skills/loader.js', () => ({
  SkillLoader: jest.fn().mockImplementation(() => ({
    discover: jest.fn().mockResolvedValue({
      skills: [
        {
          manifest: {
            name: 'test-skill',
            description: 'A test skill for testing',
            license: 'MIT',
          },
          path: '/path/to/test-skill/SKILL.md',
          directory: '/path/to/test-skill',
          source: 'bundled',
        },
        {
          manifest: {
            name: 'user-skill',
            description: 'A user-defined skill',
          },
          path: '/home/user/.agent/skills/user-skill/SKILL.md',
          directory: '/home/user/.agent/skills/user-skill',
          source: 'user',
        },
        {
          manifest: {
            name: 'my-plugin',
            description: 'An installed plugin skill',
          },
          path: '/home/user/.agent/skills/my-plugin/SKILL.md',
          directory: '/home/user/.agent/skills/my-plugin',
          source: 'plugin',
        },
      ] as DiscoveredSkill[],
      errors: [],
    }),
  })),
}));

// Mock the installer
jest.unstable_mockModule('../../../skills/installer.js', () => ({
  installSkill: jest.fn().mockResolvedValue({
    success: true,
    skillName: 'new-skill',
    path: '/home/user/.agent/skills/new-skill',
  }),
  updateSkill: jest.fn().mockResolvedValue({
    success: true,
    skillName: 'my-plugin',
    updated: true,
  }),
  removeSkill: jest.fn().mockResolvedValue(true),
  listInstalledPlugins: jest.fn().mockResolvedValue(['my-plugin', 'another-plugin']),
  getPluginsDir: jest.fn().mockReturnValue('/home/user/.agent/skills'),
}));

// Mock the config manager
jest.unstable_mockModule('../../../config/manager.js', () => ({
  loadConfig: jest.fn().mockResolvedValue({
    success: true,
    result: {
      skills: {
        plugins: [{ url: 'https://github.com/user/my-plugin', name: 'my-plugin', enabled: true }],
        disabledBundled: [],
        enabledBundled: [],
      },
    },
  }),
  ConfigManager: jest.fn().mockImplementation(() => ({
    save: jest.fn().mockResolvedValue({ success: true }),
  })),
}));

interface OutputEntry {
  content: string;
  type?: string;
}

function createMockContext(): CommandContext & {
  outputs: OutputEntry[];
  exitCalled: boolean;
} {
  const outputs: OutputEntry[] = [];

  return {
    config: null,
    onOutput: (content: string, type?: string) => {
      outputs.push({ content, type });
    },
    exit: () => {
      // noop for test
    },
    outputs,
    exitCalled: false,
  };
}

describe('skill command handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('skillHandler', () => {
    it('routes to skillShowHandler by default', async () => {
      const { skillHandler } = await import('../skills.js');
      const context = createMockContext();
      const result = await skillHandler('', context);

      expect(result.success).toBe(true);
      expect(context.outputs.some((o) => o.content.includes('Skill Management'))).toBe(true);
    });

    it('routes to show subcommand', async () => {
      const { skillHandler } = await import('../skills.js');
      const context = createMockContext();
      const result = await skillHandler('show', context);

      expect(result.success).toBe(true);
      expect(context.outputs.some((o) => o.content.includes('Skill Management'))).toBe(true);
    });

    it('routes to install subcommand', async () => {
      const { skillHandler } = await import('../skills.js');
      const context = createMockContext();
      const result = await skillHandler('install https://github.com/user/skill', context);

      expect(result.success).toBe(true);
      expect(context.outputs.some((o) => o.content.includes('Installed'))).toBe(true);
    });

    it('routes to manage subcommand', async () => {
      const { skillHandler } = await import('../skills.js');
      const context = createMockContext();
      const result = await skillHandler('manage', context);

      expect(result.success).toBe(true);
      expect(context.outputs.some((o) => o.content.includes('Skill Management Actions'))).toBe(
        true
      );
    });

    it('shows error for unknown subcommand', async () => {
      const { skillHandler } = await import('../skills.js');
      const context = createMockContext();
      const result = await skillHandler('unknown', context);

      expect(result.success).toBe(false);
      expect(context.outputs.some((o) => o.content.includes('Unknown subcommand'))).toBe(true);
    });
  });

  describe('skillShowHandler', () => {
    it('shows discovered skills grouped by source', async () => {
      const { skillShowHandler } = await import('../skills.js');
      const context = createMockContext();
      const result = await skillShowHandler('', context);

      expect(result.success).toBe(true);
      expect(context.outputs.some((o) => o.content.includes('[Bundled Skills]'))).toBe(true);
      expect(context.outputs.some((o) => o.content.includes('[User Skills]'))).toBe(true);
      expect(context.outputs.some((o) => o.content.includes('[Plugin Skills]'))).toBe(true);
      expect(context.outputs.some((o) => o.content.includes('test-skill'))).toBe(true);
      expect(context.outputs.some((o) => o.content.includes('user-skill'))).toBe(true);
      expect(context.outputs.some((o) => o.content.includes('my-plugin'))).toBe(true);
    });

    it('returns data with discovered skills', async () => {
      const { skillShowHandler } = await import('../skills.js');
      const context = createMockContext();
      const result = await skillShowHandler('', context);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      const data = result.data as { skills: unknown[]; errors: unknown[] };
      expect(data.skills.length).toBe(3);
      expect(data.errors.length).toBe(0);
    });
  });

  describe('skillInstallHandler', () => {
    it('requires git URL', async () => {
      const { skillInstallHandler } = await import('../skills.js');
      const context = createMockContext();
      const result = await skillInstallHandler('', context);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Git URL required');
      expect(context.outputs.some((o) => o.content.includes('Usage:'))).toBe(true);
    });

    it('installs skill from git URL', async () => {
      const { skillInstallHandler } = await import('../skills.js');
      const context = createMockContext();
      const result = await skillInstallHandler('https://github.com/user/my-skill', context);

      expect(result.success).toBe(true);
      expect(context.outputs.some((o) => o.content.includes('Installed: new-skill'))).toBe(true);
      expect(context.outputs.some((o) => o.content.includes('Location:'))).toBe(true);
    });

    it('parses --name and --ref flags', async () => {
      const { skillInstallHandler } = await import('../skills.js');
      const installer = await import('../../../skills/installer.js');
      const context = createMockContext();

      await skillInstallHandler(
        'https://github.com/user/my-skill --name custom-name --ref v1.0.0',
        context
      );

      expect(installer.installSkill).toHaveBeenCalledWith({
        url: 'https://github.com/user/my-skill',
        name: 'custom-name',
        ref: 'v1.0.0',
      });
    });
  });

  describe('skillManageHandler', () => {
    it('shows help when no action provided', async () => {
      const { skillManageHandler } = await import('../skills.js');
      const context = createMockContext();
      const result = await skillManageHandler('', context);

      expect(result.success).toBe(true);
      expect(context.outputs.some((o) => o.content.includes('Skill Management Actions'))).toBe(
        true
      );
      expect(context.outputs.some((o) => o.content.includes('enable'))).toBe(true);
      expect(context.outputs.some((o) => o.content.includes('disable'))).toBe(true);
      expect(context.outputs.some((o) => o.content.includes('update'))).toBe(true);
      expect(context.outputs.some((o) => o.content.includes('remove'))).toBe(true);
    });

    it('requires skill name for enable', async () => {
      const { skillManageHandler } = await import('../skills.js');
      const context = createMockContext();
      const result = await skillManageHandler('enable', context);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Skill name required');
    });

    it('requires skill name for disable', async () => {
      const { skillManageHandler } = await import('../skills.js');
      const context = createMockContext();
      const result = await skillManageHandler('disable', context);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Skill name required');
    });

    it('updates a plugin skill', async () => {
      const { skillManageHandler } = await import('../skills.js');
      const context = createMockContext();
      const result = await skillManageHandler('update my-plugin', context);

      expect(result.success).toBe(true);
      expect(context.outputs.some((o) => o.content.includes('Updated: my-plugin'))).toBe(true);
    });

    it('removes a plugin skill', async () => {
      const { skillManageHandler } = await import('../skills.js');
      const context = createMockContext();
      const result = await skillManageHandler('remove my-plugin', context);

      expect(result.success).toBe(true);
      expect(context.outputs.some((o) => o.content.includes('Removed: my-plugin'))).toBe(true);
    });

    it('lists installed plugins', async () => {
      const { skillManageHandler } = await import('../skills.js');
      const context = createMockContext();
      const result = await skillManageHandler('list', context);

      expect(result.success).toBe(true);
      expect(context.outputs.some((o) => o.content.includes('Installed Plugins'))).toBe(true);
      expect(context.outputs.some((o) => o.content.includes('my-plugin'))).toBe(true);
    });

    it('shows error for unknown action', async () => {
      const { skillManageHandler } = await import('../skills.js');
      const context = createMockContext();
      const result = await skillManageHandler('invalid', context);

      expect(result.success).toBe(false);
      expect(context.outputs.some((o) => o.content.includes('Unknown action'))).toBe(true);
    });
  });
});
