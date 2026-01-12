/**
 * Clipboard utilities for terminal input.
 * Provides cross-platform clipboard reading support.
 *
 * Note: Uses dynamic imports to avoid Jest ESM module mocking issues
 * with native Node.js modules like child_process.
 */

import { platform } from 'os';

/**
 * Read text from the system clipboard.
 * Uses platform-specific commands:
 * - macOS: pbpaste
 * - Linux: xclip or xsel
 * - Windows: PowerShell Get-Clipboard
 *
 * @returns Clipboard content as string, or null if reading fails
 */
export function readClipboard(): string | null {
  try {
    const os = platform();

    // Use require() for child_process to avoid ESM module loading issues in tests
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { execSync, execFileSync } = require('child_process') as typeof import('child_process');

    let result: string;

    if (os === 'darwin') {
      result = execSync('pbpaste', {
        encoding: 'utf8',
        timeout: 1000,
        stdio: ['pipe', 'pipe', 'ignore'],
      });
    } else if (os === 'linux') {
      // Try xclip first, fall back to xsel
      // Using execFileSync to avoid shell execution and command injection risks
      try {
        result = execFileSync('xclip', ['-selection', 'clipboard', '-o'], {
          encoding: 'utf8',
          timeout: 1000,
          stdio: ['pipe', 'pipe', 'ignore'],
        });
      } catch {
        // xclip failed, try xsel
        result = execFileSync('xsel', ['--clipboard', '--output'], {
          encoding: 'utf8',
          timeout: 1000,
          stdio: ['pipe', 'pipe', 'ignore'],
        });
      }
    } else if (os === 'win32') {
      // PowerShell's Get-Clipboard works on Windows 10+
      // Security: Command is a fixed string with no user input, no shell injection risk
      result = execSync('powershell -command "Get-Clipboard"', {
        encoding: 'utf8',
        timeout: 1000,
        stdio: ['pipe', 'pipe', 'ignore'],
      });
    } else {
      // Unsupported platform
      return null;
    }

    // Normalize CRLF to LF for cross-platform consistency
    // Trim trailing whitespace/newlines for better usability
    return result.replace(/\r\n/g, '\n').trimEnd();
  } catch {
    // Clipboard read failed (permissions, missing tools, empty clipboard, etc.)
    // Return null to indicate failure - callers should handle gracefully
    return null;
  }
}
