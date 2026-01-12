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
    let cmd: string;

    if (os === 'darwin') {
      cmd = 'pbpaste';
    } else if (os === 'linux') {
      // Try xclip first, fall back to xsel
      // Using shell to handle command-not-found gracefully
      cmd = 'xclip -selection clipboard -o 2>/dev/null || xsel --clipboard --output 2>/dev/null';
    } else if (os === 'win32') {
      // PowerShell's Get-Clipboard works on Windows 10+
      cmd = 'powershell -command "Get-Clipboard"';
    } else {
      // Unsupported platform
      return null;
    }

    // Use require() for child_process to avoid ESM module loading issues in tests
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { execSync } = require('child_process') as typeof import('child_process');

    const result = execSync(cmd, {
      encoding: 'utf8',
      timeout: 1000, // 1 second timeout to avoid hanging
      stdio: ['pipe', 'pipe', 'pipe'], // Suppress stderr
    });

    // Normalize CRLF to LF for cross-platform consistency
    return result.replace(/\r\n/g, '\n');
  } catch {
    // Clipboard read failed (permissions, missing tools, empty clipboard, etc.)
    // Return null to indicate failure - callers should handle gracefully
    return null;
  }
}
