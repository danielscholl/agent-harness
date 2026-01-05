/**
 * Tests for update command handler.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import type { CommandContext } from '../types.js';

// Mock child_process for spawn tests
const mockSpawn = jest.fn();
jest.unstable_mockModule('node:child_process', () => ({
  spawn: mockSpawn,
}));

// Mock fs/promises for readFile tests
const mockReadFile = jest.fn();
jest.unstable_mockModule('node:fs/promises', () => ({
  readFile: mockReadFile,
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

describe('update command handler', () => {
  let originalArgv: string[];

  beforeEach(() => {
    jest.clearAllMocks();
    // Save original process.argv
    originalArgv = process.argv;
    // Set default test argv
    process.argv = ['bun', '/Users/test/.bun/install/global/agent-base-v2/index.js'];

    // Default mock for readFile - returns valid package.json
    mockReadFile.mockResolvedValue(JSON.stringify({ version: '0.1.0' }));
  });

  afterEach(() => {
    // Restore original process.argv
    process.argv = originalArgv;
    jest.resetModules();
  });

  // Note: help tests removed - help is now handled by meow in index.tsx before handler is called

  describe('detectInstallationType', () => {
    it('detects global installation via .bun/install/global', async () => {
      process.argv = ['bun', '/Users/test/.bun/install/global/agent-base-v2/index.js'];

      const { updateHandler } = await import('../update.js');
      const context = createMockContext();
      await updateHandler('--check', context);

      expect(context.outputs.some((o) => o.content.includes('Installation type: global'))).toBe(
        true
      );
    });

    it('detects global installation via node_modules/.bin', async () => {
      process.argv = ['node', '/usr/local/lib/node_modules/.bin/agent'];

      const { updateHandler } = await import('../update.js');
      const context = createMockContext();
      await updateHandler('--check', context);

      expect(context.outputs.some((o) => o.content.includes('Installation type: global'))).toBe(
        true
      );
    });

    it('detects local development via src/index.tsx', async () => {
      process.argv = ['bun', '/Users/test/projects/agent-base-v2/src/index.tsx'];

      const { updateHandler } = await import('../update.js');
      const context = createMockContext();
      const result = await updateHandler('', context);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Local development detected');
      expect(context.outputs.some((o) => o.content.includes('Installation type: local'))).toBe(
        true
      );
      expect(
        context.outputs.some((o) => o.content.includes('Running from local development source'))
      ).toBe(true);
    });

    it('detects local development via dist/', async () => {
      process.argv = ['bun', '/Users/test/projects/agent-base-v2/dist/index.js'];

      const { updateHandler } = await import('../update.js');
      const context = createMockContext();
      const result = await updateHandler('', context);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Local development detected');
      expect(context.outputs.some((o) => o.content.includes('Installation type: local'))).toBe(
        true
      );
    });

    it('returns unknown for unrecognized paths', async () => {
      process.argv = ['node', '/some/random/path/agent.js'];

      const { updateHandler } = await import('../update.js');
      const context = createMockContext();
      const result = await updateHandler('', context);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Unknown installation type');
      expect(context.outputs.some((o) => o.content.includes('Installation type: unknown'))).toBe(
        true
      );
      expect(
        context.outputs.some((o) => o.content.includes('Could not determine installation type'))
      ).toBe(true);
    });

    it('handles Windows-style paths', async () => {
      process.argv = ['bun', 'C:\\Users\\test\\.bun\\install\\global\\agent-base-v2\\index.js'];

      const { updateHandler } = await import('../update.js');
      const context = createMockContext();
      await updateHandler('--check', context);

      expect(context.outputs.some((o) => o.content.includes('Installation type: global'))).toBe(
        true
      );
    });
  });

  describe('getCurrentVersion', () => {
    it('returns version from package.json', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({ version: '0.2.5' }));

      const { updateHandler } = await import('../update.js');
      const context = createMockContext();
      await updateHandler('--check', context);

      expect(context.outputs.some((o) => o.content.includes('Current version: 0.2.5'))).toBe(true);
    });

    it('returns unknown when package.json not found', async () => {
      mockReadFile.mockRejectedValue(new Error('File not found'));

      const { updateHandler } = await import('../update.js');
      const context = createMockContext();
      await updateHandler('--check', context);

      expect(context.outputs.some((o) => o.content.includes('Current version: unknown'))).toBe(
        true
      );
    });

    it('returns unknown when version field is missing', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({ name: 'agent-base-v2' }));

      const { updateHandler } = await import('../update.js');
      const context = createMockContext();
      await updateHandler('--check', context);

      expect(context.outputs.some((o) => o.content.includes('Current version: unknown'))).toBe(
        true
      );
    });

    it('returns unknown when version field is empty string', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({ version: '' }));

      const { updateHandler } = await import('../update.js');
      const context = createMockContext();
      await updateHandler('--check', context);

      expect(context.outputs.some((o) => o.content.includes('Current version: unknown'))).toBe(
        true
      );
    });
  });

  describe('local development installation', () => {
    beforeEach(() => {
      process.argv = ['bun', '/Users/test/projects/agent-base-v2/src/index.tsx'];
    });

    it('shows git pull instructions', async () => {
      const { updateHandler } = await import('../update.js');
      const context = createMockContext();
      const result = await updateHandler('', context);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Local development detected');
      expect(
        context.outputs.some((o) => o.content.includes('Running from local development source'))
      ).toBe(true);
      expect(context.outputs.some((o) => o.content.includes('To update, run:'))).toBe(true);
      expect(context.outputs.some((o) => o.content.includes('git pull'))).toBe(true);
      expect(context.outputs.some((o) => o.content.includes('bun install'))).toBe(true);
    });

    it('handles --check flag for local development', async () => {
      const { updateHandler } = await import('../update.js');
      const context = createMockContext();
      const result = await updateHandler('--check', context);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Local development detected');
      expect(context.outputs.some((o) => o.content.includes('git pull'))).toBe(true);
    });
  });

  describe('unknown installation type', () => {
    beforeEach(() => {
      process.argv = ['node', '/some/random/path/agent.js'];
    });

    it('shows installation instructions', async () => {
      const { updateHandler } = await import('../update.js');
      const context = createMockContext();
      const result = await updateHandler('', context);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Unknown installation type');
      expect(
        context.outputs.some((o) => o.content.includes('Could not determine installation type'))
      ).toBe(true);
      expect(context.outputs.some((o) => o.content.includes('To install globally:'))).toBe(true);
      expect(
        context.outputs.some((o) => o.content.includes('bun install -g github:danielscholl'))
      ).toBe(true);
      expect(context.outputs.some((o) => o.content.includes('Or clone and run from source:'))).toBe(
        true
      );
      expect(context.outputs.some((o) => o.content.includes('git clone'))).toBe(true);
    });
  });

  describe('check-only mode', () => {
    beforeEach(() => {
      process.argv = ['bun', '/Users/test/.bun/install/global/agent-base-v2/index.js'];
    });

    it('checks for updates without installing', async () => {
      const { updateHandler } = await import('../update.js');
      const context = createMockContext();
      const result = await updateHandler('--check', context);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Check complete');
      expect(context.outputs.some((o) => o.content.includes('Checking for updates...'))).toBe(true);
      expect(
        context.outputs.some((o) => o.content.includes('To update to the latest version'))
      ).toBe(true);
      expect(context.outputs.some((o) => o.content.includes('agent update'))).toBe(true);
      expect(context.outputs.some((o) => o.content.includes('Or manually:'))).toBe(true);
    });
  });

  describe('global installation update', () => {
    beforeEach(() => {
      process.argv = ['bun', '/Users/test/.bun/install/global/agent-base-v2/index.js'];
    });

    it('updates successfully', async () => {
      // Mock successful spawn
      const eventHandlers: Record<string, ((arg: number | null | Error) => void)[]> = {};
      const mockProcess = {
        stdout: {
          on: jest.fn(),
          removeListener: jest.fn(),
        },
        stderr: {
          on: jest.fn(),
          removeListener: jest.fn(),
        },
        once: jest.fn((event: string, callback: (arg: number | null | Error) => void) => {
          if (!eventHandlers[event]) {
            eventHandlers[event] = [];
          }
          eventHandlers[event].push(callback);

          // Simulate successful close
          if (event === 'close') {
            setTimeout(() => {
              callback(0);
            }, 10);
          }
          return mockProcess;
        }),
      };
      mockSpawn.mockReturnValue(mockProcess);

      const { updateHandler } = await import('../update.js');
      const context = createMockContext();
      const result = await updateHandler('', context);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Update complete');
      expect(context.outputs.some((o) => o.content.includes('Updating agent...'))).toBe(true);
      expect(
        context.outputs.some((o) =>
          o.content.includes('Running: bun install -g github:danielscholl')
        )
      ).toBe(true);
      expect(context.outputs.some((o) => o.content.includes('Update successful!'))).toBe(true);
      expect(context.outputs.some((o) => o.content.includes('Restart the agent'))).toBe(true);
    });

    it('updates with --force flag', async () => {
      const eventHandlers: Record<string, ((arg: number | null | Error) => void)[]> = {};
      const mockProcess = {
        stdout: {
          on: jest.fn(),
          removeListener: jest.fn(),
        },
        stderr: {
          on: jest.fn(),
          removeListener: jest.fn(),
        },
        once: jest.fn((event: string, callback: (arg: number | null | Error) => void) => {
          if (!eventHandlers[event]) {
            eventHandlers[event] = [];
          }
          eventHandlers[event].push(callback);

          if (event === 'close') {
            setTimeout(() => {
              callback(0);
            }, 10);
          }
          return mockProcess;
        }),
      };
      mockSpawn.mockReturnValue(mockProcess);

      const { updateHandler } = await import('../update.js');
      const context = createMockContext();
      const result = await updateHandler('--force', context);

      expect(result.success).toBe(true);
      expect(
        context.outputs.some((o) => o.content.includes('Running: bun install -g --force github:'))
      ).toBe(true);
    });

    it('handles update failure', async () => {
      const eventHandlers: Record<string, ((arg: number | null | Error) => void)[]> = {};
      const mockProcess = {
        stdout: {
          on: jest.fn(),
          removeListener: jest.fn(),
        },
        stderr: {
          on: jest.fn((event: string, callback: (data: Buffer) => void) => {
            // Simulate stderr data
            setTimeout(() => {
              callback(Buffer.from('Error: Update failed'));
            }, 5);
          }),
          removeListener: jest.fn(),
        },
        once: jest.fn((event: string, callback: (arg: number | null | Error) => void) => {
          if (!eventHandlers[event]) {
            eventHandlers[event] = [];
          }
          eventHandlers[event].push(callback);

          // Simulate failed close
          if (event === 'close') {
            setTimeout(() => {
              callback(1);
            }, 10);
          }
          return mockProcess;
        }),
      };
      mockSpawn.mockReturnValue(mockProcess);

      const { updateHandler } = await import('../update.js');
      const context = createMockContext();
      const result = await updateHandler('', context);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Update failed');
      expect(context.outputs.some((o) => o.content.includes('Update failed.'))).toBe(true);
      expect(context.outputs.some((o) => o.content.includes('Try manually:'))).toBe(true);
    });

    it('handles spawn error', async () => {
      const eventHandlers: Record<string, ((arg: number | null | Error) => void)[]> = {};
      const mockProcess = {
        stdout: {
          on: jest.fn(),
          removeListener: jest.fn(),
        },
        stderr: {
          on: jest.fn(),
          removeListener: jest.fn(),
        },
        once: jest.fn((event: string, callback: (arg: number | null | Error) => void) => {
          if (!eventHandlers[event]) {
            eventHandlers[event] = [];
          }
          eventHandlers[event].push(callback);

          // Simulate error event
          if (event === 'error') {
            setTimeout(() => {
              callback(new Error('Command not found'));
            }, 10);
          }
          return mockProcess;
        }),
      };
      mockSpawn.mockReturnValue(mockProcess);

      const { updateHandler } = await import('../update.js');
      const context = createMockContext();
      const result = await updateHandler('', context);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Update failed');
      expect(context.outputs.some((o) => o.content.includes('Update failed.'))).toBe(true);
    });
  });

  describe('combined flags', () => {
    beforeEach(() => {
      process.argv = ['bun', '/Users/test/.bun/install/global/agent-base-v2/index.js'];
    });

    it('handles --check and --force together (check takes precedence)', async () => {
      const { updateHandler } = await import('../update.js');
      const context = createMockContext();
      const result = await updateHandler('--check --force', context);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Check complete');
      expect(context.outputs.some((o) => o.content.includes('Checking for updates...'))).toBe(true);
    });
  });
});
