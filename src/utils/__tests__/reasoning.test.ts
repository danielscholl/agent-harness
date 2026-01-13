/**
 * Tests for reasoning capture utilities.
 */

import { truncateReasoning, truncatePreview, REASONING_CONFIG } from '../reasoning.js';

describe('reasoning utilities', () => {
  describe('REASONING_CONFIG', () => {
    it('exports configuration constants', () => {
      expect(REASONING_CONFIG.MAX_STORED).toBe(500);
      expect(REASONING_CONFIG.PREVIEW_LENGTH).toBe(60);
    });
  });

  describe('truncateReasoning', () => {
    it('returns text unchanged when under max length', () => {
      const text = 'Short reasoning content';
      const result = truncateReasoning(text);
      expect(result.truncated).toBe(text);
      expect(result.fullLength).toBe(text.length);
    });

    it('returns text unchanged at exactly max length', () => {
      const text = 'a'.repeat(REASONING_CONFIG.MAX_STORED);
      const result = truncateReasoning(text);
      expect(result.truncated).toBe(text);
      expect(result.fullLength).toBe(text.length);
    });

    it('truncates with ellipsis prefix when over max length', () => {
      const text = 'a'.repeat(REASONING_CONFIG.MAX_STORED + 100);
      const result = truncateReasoning(text);
      expect(result.truncated.startsWith('...')).toBe(true);
      expect(result.truncated.length).toBe(REASONING_CONFIG.MAX_STORED);
      expect(result.fullLength).toBe(text.length);
    });

    it('keeps the tail of the content (most recent reasoning)', () => {
      const prefix = 'START_';
      const suffix = '_END';
      const middle = 'x'.repeat(REASONING_CONFIG.MAX_STORED + 50);
      const text = prefix + middle + suffix;
      const result = truncateReasoning(text);

      // The truncated result should end with the suffix
      expect(result.truncated.endsWith(suffix)).toBe(true);
      // And should start with ellipsis
      expect(result.truncated.startsWith('...')).toBe(true);
    });

    it('handles empty string', () => {
      const result = truncateReasoning('');
      expect(result.truncated).toBe('');
      expect(result.fullLength).toBe(0);
    });
  });

  describe('truncatePreview', () => {
    it('returns text unchanged when under max length', () => {
      const text = 'Short preview';
      const result = truncatePreview(text, 60);
      expect(result).toBe(text);
    });

    it('truncates with ellipsis when over max length', () => {
      const text = 'a'.repeat(100);
      const result = truncatePreview(text, 60);
      expect(result.endsWith('...')).toBe(true);
      expect(result.length).toBe(60);
    });

    it('collapses newlines to spaces', () => {
      const text = 'Line 1\nLine 2\nLine 3';
      const result = truncatePreview(text, 60);
      expect(result).toBe('Line 1 Line 2 Line 3');
    });

    it('trims whitespace', () => {
      const text = '  spaced text  ';
      const result = truncatePreview(text, 60);
      expect(result).toBe('spaced text');
    });

    it('uses default max length from config', () => {
      const text = 'a'.repeat(100);
      const result = truncatePreview(text);
      expect(result.length).toBe(REASONING_CONFIG.PREVIEW_LENGTH);
    });

    it('handles empty string', () => {
      const result = truncatePreview('');
      expect(result).toBe('');
    });

    it('handles whitespace-only string', () => {
      const result = truncatePreview('   \n\n   ');
      expect(result).toBe('');
    });
  });
});
