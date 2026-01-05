/**
 * Update command handler.
 * Checks for and installs updates from the git repository.
 */

import type { CommandHandler, CommandResult } from './types.js';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { readFile } from 'node:fs/promises';

/** Git repository URL for updates */
const GIT_REPO_URL = 'github:danielscholl/agent-base-v2';
const GIT_HTTPS_URL = 'https://github.com/danielscholl/agent-base-v2';

/**
 * Detect installation type based on executable path.
 */
function detectInstallationType(): 'global' | 'local' | 'unknown' {
  const execPath = process.argv[1] ?? '';
  const normalizedPath = execPath.replace(/\\/g, '/');

  // Check for global bun installation patterns using path segment boundaries
  if (
    /(^|\/)\.bun\/install\/global(\/|$)/.test(normalizedPath) ||
    /(^|\/)node_modules\/\.bin(\/|$)/.test(normalizedPath)
  ) {
    return 'global';
  }

  // Check for local development (running from source) with more specific path checks
  if (/(^|\/)src\/index\.tsx$/.test(normalizedPath) || /(^|\/)dist\//.test(normalizedPath)) {
    return 'local';
  }

  return 'unknown';
}

/**
 * Run a command and return the result.
 */
async function runCommand(
  command: string,
  args: string[]
): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    let errorOutput = '';
    let settled = false;

    // Named handlers for proper cleanup
    const stdoutHandler = (data: Buffer): void => {
      output += data.toString();
    };

    const stderrHandler = (data: Buffer): void => {
      errorOutput += data.toString();
    };

    const cleanup = (): void => {
      proc.stdout.removeListener('data', stdoutHandler);
      proc.stderr.removeListener('data', stderrHandler);
    };

    // stdout and stderr are guaranteed to be Readable streams since stdio is ['ignore', 'pipe', 'pipe']
    proc.stdout.on('data', stdoutHandler);
    proc.stderr.on('data', stderrHandler);

    proc.once('close', (code) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (code === 0) {
        resolve({ success: true, output });
      } else {
        resolve({ success: false, output: errorOutput || output });
      }
    });

    proc.once('error', (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ success: false, output: err.message });
    });
  });
}

/**
 * Get current version from package.json.
 */
async function getCurrentVersion(): Promise<string> {
  try {
    // Try to find package.json relative to the executable
    const execDir = dirname(process.argv[1] ?? '');
    const possiblePaths = [
      join(execDir, '..', 'package.json'),
      join(execDir, '..', '..', 'package.json'),
      join(process.cwd(), 'package.json'),
    ];

    for (const pkgPath of possiblePaths) {
      try {
        const content = await readFile(pkgPath, 'utf-8');
        const pkg = JSON.parse(content) as { version?: string };
        if (pkg.version !== undefined && pkg.version !== '') {
          return pkg.version;
        }
      } catch {
        // File doesn't exist or isn't readable, try next path
      }
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Main update command handler.
 */
export const updateHandler: CommandHandler = async (args, context): Promise<CommandResult> => {
  const parts = args.trim().split(/\s+/).filter(Boolean);

  const checkOnly = parts.includes('--check');
  const force = parts.includes('--force');

  const installType = detectInstallationType();
  const currentVersion = await getCurrentVersion();

  context.onOutput('', 'info');
  context.onOutput('Update Check', 'success');
  context.onOutput('', 'info');
  context.onOutput(`Current version: ${currentVersion}`, 'info');
  context.onOutput(`Installation type: ${installType}`, 'info');
  context.onOutput('', 'info');

  if (installType === 'local') {
    context.onOutput('Running from local development source.', 'info');
    context.onOutput('', 'info');
    context.onOutput('To update, run:', 'info');
    context.onOutput('  git pull', 'info');
    context.onOutput('  bun install', 'info');
    return { success: true, message: 'Local development detected' };
  }

  if (installType === 'unknown') {
    context.onOutput('Could not determine installation type.', 'warning');
    context.onOutput('', 'info');
    context.onOutput('To install globally:', 'info');
    context.onOutput(`  bun install -g ${GIT_REPO_URL}`, 'info');
    context.onOutput('', 'info');
    context.onOutput('Or clone and run from source:', 'info');
    context.onOutput(`  git clone ${GIT_HTTPS_URL}`, 'info');
    context.onOutput('  cd agent-base-v2 && bun install && bun run src/index.tsx', 'info');
    return { success: false, message: 'Unknown installation type' };
  }

  // Global installation - proceed with update
  if (checkOnly) {
    context.onOutput('Checking for updates...', 'info');
    context.onOutput('', 'info');

    // For now, we can't easily check remote version without fetching
    // Just inform user how to update
    context.onOutput('To update to the latest version, run:', 'info');
    context.onOutput('  agent update', 'info');
    context.onOutput('', 'info');
    context.onOutput('Or manually:', 'info');
    context.onOutput(`  bun install -g ${GIT_REPO_URL}`, 'info');
    return { success: true, message: 'Check complete' };
  }

  // Perform update
  context.onOutput('Updating agent...', 'info');
  context.onOutput('', 'info');

  const updateArgs = ['install', '-g'];
  if (force) {
    updateArgs.push('--force');
  }
  updateArgs.push(GIT_REPO_URL);

  context.onOutput(`Running: bun ${updateArgs.join(' ')}`, 'info');
  context.onOutput('', 'info');

  const result = await runCommand('bun', updateArgs);

  if (result.success) {
    context.onOutput('Update successful!', 'success');
    context.onOutput('', 'info');
    context.onOutput('Restart the agent to use the new version.', 'info');
    return { success: true, message: 'Update complete' };
  } else {
    context.onOutput('Update failed.', 'error');
    context.onOutput('', 'info');
    if (result.output) {
      context.onOutput(result.output, 'error');
    }
    context.onOutput('', 'info');
    context.onOutput('Try manually:', 'info');
    context.onOutput(`  bun install -g ${GIT_REPO_URL}`, 'info');
    return { success: false, message: 'Update failed' };
  }
};
