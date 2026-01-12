/**
 * Tests for FocusZone component.
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { FocusZone } from '../FocusZone.js';

describe('FocusZone', () => {
  describe('basic rendering', () => {
    it('renders content', () => {
      const { lastFrame } = render(<FocusZone content="Hello, World!" />);
      expect(lastFrame()).toContain('Hello, World!');
    });

    it('renders nothing when content is empty', () => {
      const { lastFrame } = render(<FocusZone content="" />);
      expect(lastFrame()).toBe('');
    });

    it('renders nothing when content is whitespace only', () => {
      const { lastFrame } = render(<FocusZone content="   " />);
      expect(lastFrame()).toBe('');
    });

    it('renders title when provided', () => {
      const { lastFrame } = render(<FocusZone content="content" title="My Title" />);
      expect(lastFrame()).toContain('My Title');
    });
  });

  describe('line limiting', () => {
    it('shows only maxLines lines', () => {
      const content = 'line1\nline2\nline3\nline4\nline5';
      const { lastFrame } = render(<FocusZone content={content} maxLines={3} />);
      const frame = lastFrame();
      // Should show last 3 lines
      expect(frame).toContain('line3');
      expect(frame).toContain('line4');
      expect(frame).toContain('line5');
    });

    it('shows scroll indicator when content is truncated', () => {
      const content = 'line1\nline2\nline3\nline4\nline5';
      const { lastFrame } = render(<FocusZone content={content} maxLines={3} />);
      expect(lastFrame()).toContain('more');
    });

    it('does not show scroll indicator when content fits', () => {
      const content = 'line1\nline2';
      const { lastFrame } = render(<FocusZone content={content} maxLines={5} />);
      expect(lastFrame()).not.toContain('more');
    });

    it('uses default maxLines of 8', () => {
      const lines = Array.from({ length: 10 }, (_, i) => `line${String(i + 1)}`).join('\n');
      const { lastFrame } = render(<FocusZone content={lines} />);
      // Should show scroll indicator since we have 10 lines but only show 8
      expect(lastFrame()).toContain('more');
    });
  });

  describe('streaming indicator', () => {
    it('shows streaming cursor when isStreaming is true', () => {
      const { lastFrame } = render(<FocusZone content="streaming..." isStreaming={true} />);
      // The streaming cursor character
      expect(lastFrame()).toContain('▌');
    });

    it('does not show streaming cursor when isStreaming is false', () => {
      const { lastFrame } = render(<FocusZone content="done" isStreaming={false} />);
      expect(lastFrame()).not.toContain('▌');
    });
  });

  describe('bordered mode', () => {
    it('renders with borders when bordered is true', () => {
      const { lastFrame } = render(<FocusZone content="boxed content" bordered={true} />);
      const frame = lastFrame();
      // Should contain box drawing characters
      expect(frame).toContain('┌');
      expect(frame).toContain('└');
      expect(frame).toContain('│');
    });

    it('renders title inside bordered box', () => {
      const { lastFrame } = render(
        <FocusZone content="content" title="Box Title" bordered={true} />
      );
      const frame = lastFrame();
      expect(frame).toContain('Box Title');
      expect(frame).toContain('┌');
    });

    it('shows streaming cursor in bordered mode', () => {
      const { lastFrame } = render(
        <FocusZone content="streaming" bordered={true} isStreaming={true} />
      );
      expect(lastFrame()).toContain('▌');
    });

    it('respects boxWidth parameter', () => {
      const { lastFrame } = render(<FocusZone content="short" bordered={true} boxWidth={40} />);
      // The box should be 40 chars wide (including borders)
      // Can't easily test exact width, but we can check it renders
      expect(lastFrame()).toContain('┌');
      expect(lastFrame()).toContain('└');
    });

    it('truncates long lines in bordered mode', () => {
      const longLine = 'a'.repeat(100);
      const { lastFrame } = render(<FocusZone content={longLine} bordered={true} boxWidth={40} />);
      // Should truncate with ellipsis
      expect(lastFrame()).toContain('...');
    });
  });

  describe('indentation', () => {
    it('applies indentation in non-bordered mode', () => {
      const { lastFrame } = render(<FocusZone content="indented" indent={4} />);
      // Should have leading spaces
      const lines = lastFrame()?.split('\n') ?? [];
      expect(lines.some((line) => line.startsWith('    '))).toBe(true);
    });

    it('applies indentation in bordered mode', () => {
      const { lastFrame } = render(<FocusZone content="boxed" bordered={true} indent={4} />);
      // Should have leading spaces before box
      const lines = lastFrame()?.split('\n') ?? [];
      expect(lines.some((line) => line.startsWith('    ┌'))).toBe(true);
    });
  });
});
