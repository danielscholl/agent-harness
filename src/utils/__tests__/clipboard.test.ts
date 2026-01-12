/**
 * Tests for clipboard utility.
 *
 * Note: These are integration tests that test the actual readClipboard function.
 * We test platform detection and error handling, but cannot mock execSync
 * due to the require() approach used to avoid ESM module issues.
 */

import { describe, it, expect } from '@jest/globals';
import { platform } from 'os';
import { readClipboard } from '../clipboard.js';

describe('readClipboard', () => {
  describe('platform-specific behavior', () => {
    it('should return a string or null on the current platform', () => {
      // This is an integration test - it actually calls the clipboard
      // On CI without clipboard tools, it should return null gracefully
      const result = readClipboard();

      // Result should be either string (clipboard content) or null (failed)
      expect(result === null || typeof result === 'string').toBe(true);
    });

    it('should handle clipboard read gracefully when no clipboard is available', () => {
      // This test verifies error handling - if clipboard tools aren't available
      // or clipboard is empty, it should return null, not throw
      const result = readClipboard();

      // Should not throw, should return string or null
      expect(() => readClipboard()).not.toThrow();
      expect(result === null || typeof result === 'string').toBe(true);
    });
  });

  describe('platform detection', () => {
    it('should detect the current platform', () => {
      const os = platform();
      // Verify platform detection is working
      expect(['darwin', 'linux', 'win32', 'freebsd', 'sunos', 'aix']).toContain(os);
    });

    it('returns null on unsupported platform', () => {
      // If we're on an unsupported platform, readClipboard should return null
      // This is really just testing that the function doesn't crash
      const os = platform();
      const result = readClipboard();

      if (os !== 'darwin' && os !== 'linux' && os !== 'win32') {
        expect(result).toBeNull();
      } else {
        // On supported platforms, result could be string or null
        expect(result === null || typeof result === 'string').toBe(true);
      }
    });
  });

  describe('return type', () => {
    it('should return string or null, never undefined', () => {
      const result = readClipboard();
      // TypeScript knows result is string | null, but we verify the contract
      expect(result).not.toBeUndefined();
    });
  });
});
