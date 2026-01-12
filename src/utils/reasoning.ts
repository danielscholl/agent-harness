/**
 * Reasoning capture utilities for per-span tracking.
 *
 * Provides truncation and preview functions for storing
 * and displaying captured reasoning content from LLM streams.
 */

/**
 * Configuration for reasoning capture and display.
 */
export const REASONING_CONFIG = {
  /** Maximum characters stored per span */
  MAX_STORED: 500,
  /** Preview length for non-verbose mode */
  PREVIEW_LENGTH: 60,
} as const;

/**
 * Result of truncating reasoning content.
 */
export interface TruncatedReasoning {
  /** Truncated reasoning text (may include leading "...") */
  truncated: string;
  /** Original full length before truncation */
  fullLength: number;
}

/**
 * Truncate reasoning content for storage.
 *
 * Keeps the tail of the content since the most relevant
 * reasoning typically appears at the end of the stream.
 *
 * @param full - Full reasoning content
 * @returns Truncated result with original length
 */
export function truncateReasoning(full: string): TruncatedReasoning {
  const fullLength = full.length;
  if (fullLength <= REASONING_CONFIG.MAX_STORED) {
    return { truncated: full, fullLength };
  }
  // Keep tail (most relevant reasoning is at the end)
  return {
    truncated: '...' + full.slice(-(REASONING_CONFIG.MAX_STORED - 3)),
    fullLength,
  };
}

/**
 * Truncate text for preview display.
 *
 * Collapses newlines to spaces and truncates to specified length.
 *
 * @param text - Text to preview
 * @param maxLen - Maximum length (default: PREVIEW_LENGTH)
 * @returns Truncated preview text
 */
export function truncatePreview(
  text: string,
  maxLen: number = REASONING_CONFIG.PREVIEW_LENGTH
): string {
  const cleaned = text.replace(/\n/g, ' ').trim();
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen - 3) + '...';
}
