/**
 * Tests for SpanNode component.
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { SpanNode } from '../SpanNode.js';
import type { ExecutionSpan } from '../ExecutionStatus.js';

describe('SpanNode', () => {
  const createSpan = (overrides: Partial<ExecutionSpan> = {}): ExecutionSpan => ({
    number: 1,
    status: 'complete',
    duration: 2.5,
    messageCount: 3,
    isThinking: false,
    toolNodes: [],
    ...overrides,
  });

  describe('collapsed view (default)', () => {
    it('renders span number and duration', () => {
      const span = createSpan({ number: 2, duration: 3.5 });
      const { lastFrame } = render(<SpanNode span={span} />);
      const frame = lastFrame();
      expect(frame).toContain('Span 2');
      expect(frame).toContain('3.5s');
    });

    it('shows tool count', () => {
      const span = createSpan({
        toolNodes: [
          { id: '1', name: 'bash', status: 'complete', span: 1 },
          { id: '2', name: 'glob', status: 'complete', span: 1 },
        ],
      });
      const { lastFrame } = render(<SpanNode span={span} />);
      expect(lastFrame()).toContain('2 tools');
    });

    it('shows singular tool for 1 tool', () => {
      const span = createSpan({
        toolNodes: [{ id: '1', name: 'bash', status: 'complete', span: 1 }],
      });
      const { lastFrame } = render(<SpanNode span={span} />);
      expect(lastFrame()).toContain('1 tool');
    });

    it('shows 0 tools when empty', () => {
      const span = createSpan({ toolNodes: [] });
      const { lastFrame } = render(<SpanNode span={span} />);
      expect(lastFrame()).toContain('0 tools');
    });
  });

  describe('expanded view', () => {
    it('shows tool details when expanded', () => {
      const span = createSpan({
        toolNodes: [{ id: '1', name: 'bash', status: 'complete', span: 1, primaryArg: 'npm test' }],
      });
      const { lastFrame } = render(<SpanNode span={span} expanded={true} />);
      const frame = lastFrame();
      expect(frame).toContain('bash');
      expect(frame).toContain('npm test');
    });

    it('shows tool tree when expanded with tools', () => {
      const span = createSpan({
        messageCount: 5,
        toolNodes: [{ id: '1', name: 'bash', status: 'complete', span: 1 }],
      });
      const { lastFrame } = render(<SpanNode span={span} expanded={true} />);
      // Expanded view shows tool tree, not "Thinking" (that's in ExecutionStatus)
      expect(lastFrame()).toContain('bash');
      expect(lastFrame()).toContain('Span 1');
    });
  });

  describe('status indicators', () => {
    it('shows working status for active span', () => {
      const span = createSpan({ status: 'working' });
      const { lastFrame } = render(<SpanNode span={span} />);
      // Should contain the active symbol ● (in yellow)
      expect(lastFrame()).toContain('●');
    });

    it('shows complete status for finished span', () => {
      const span = createSpan({ status: 'complete' });
      const { lastFrame } = render(<SpanNode span={span} />);
      // Should contain the complete symbol •
      expect(lastFrame()).toContain('•');
    });

    it('shows error indicator when tools failed', () => {
      const span = createSpan({
        toolNodes: [{ id: '1', name: 'bash', status: 'error', error: 'Command failed', span: 1 }],
      });
      const { lastFrame } = render(<SpanNode span={span} expanded={true} />);
      // Should contain the error symbol ✗
      expect(lastFrame()).toContain('✗');
    });
  });

  describe('tree drawing', () => {
    it('uses branch character for tool nodes when expanded', () => {
      const span = createSpan({
        toolNodes: [
          { id: '1', name: 'bash', status: 'complete', span: 1 },
          { id: '2', name: 'glob', status: 'complete', span: 1 },
        ],
      });
      const { lastFrame } = render(<SpanNode span={span} expanded={true} />);
      expect(lastFrame()).toContain('├');
    });

    it('uses last branch character for last tool node when expanded', () => {
      const span = createSpan({
        toolNodes: [{ id: '1', name: 'bash', status: 'complete', span: 1 }],
      });
      const { lastFrame } = render(<SpanNode span={span} expanded={true} />);
      expect(lastFrame()).toContain('└');
    });
  });

  describe('tool node rendering', () => {
    it('renders multiple tools in order', () => {
      const span = createSpan({
        toolNodes: [
          { id: '1', name: 'glob', status: 'complete', span: 1, primaryArg: '**/*.ts' },
          { id: '2', name: 'read', status: 'complete', span: 1, primaryArg: 'file.ts' },
          { id: '3', name: 'edit', status: 'complete', span: 1, primaryArg: 'file.ts' },
        ],
      });
      const { lastFrame } = render(<SpanNode span={span} expanded={true} />);
      const frame = lastFrame() ?? '';
      // All tool names should appear
      expect(frame).toContain('glob');
      expect(frame).toContain('read');
      expect(frame).toContain('edit');
    });

    it('shows running status for active tools', () => {
      const span = createSpan({
        status: 'working',
        toolNodes: [{ id: '1', name: 'bash', status: 'running', span: 1 }],
      });
      const { lastFrame } = render(<SpanNode span={span} expanded={true} />);
      expect(lastFrame()).toContain('→');
    });

    it('shows result summary for completed tools', () => {
      const span = createSpan({
        toolNodes: [
          {
            id: '1',
            name: 'glob',
            status: 'complete',
            span: 1,
            primaryArg: '**/*.ts',
            resultSummary: '42 files',
          },
        ],
      });
      const { lastFrame } = render(<SpanNode span={span} expanded={true} />);
      expect(lastFrame()).toContain('42 files');
    });

    it('shows duration for slow tools', () => {
      const span = createSpan({
        toolNodes: [{ id: '1', name: 'bash', status: 'complete', span: 1, duration: 2.5 }],
      });
      const { lastFrame } = render(<SpanNode span={span} expanded={true} />);
      expect(lastFrame()).toContain('2.5s');
    });
  });

  describe('showToolHistory prop', () => {
    it('hides tool details when showToolHistory is false', () => {
      const span = createSpan({
        toolNodes: [{ id: '1', name: 'bash', status: 'complete', span: 1, primaryArg: 'npm test' }],
      });
      const { lastFrame } = render(
        <SpanNode span={span} expanded={true} showToolHistory={false} />
      );
      // Should show collapsed view (tool count) instead of expanded
      expect(lastFrame()).toContain('1 tool');
      // Should NOT show tool details
      expect(lastFrame()).not.toContain('npm test');
    });
  });

  describe('reasoning display', () => {
    it('shows reasoning content when expanded and reasoning exists', () => {
      const span = createSpan({
        reasoning: 'This is the captured reasoning content',
        reasoningFullLength: 40,
      });
      const { lastFrame } = render(<SpanNode span={span} expanded={true} />);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('This is the captured reasoning content');
    });

    it('shows truncation indicator when reasoning was truncated', () => {
      const span = createSpan({
        reasoning: '...truncated reasoning content',
        reasoningFullLength: 600, // More than the truncated text
      });
      const { lastFrame } = render(<SpanNode span={span} expanded={true} />);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('600 chars total');
    });

    it('does not show truncation indicator when reasoning is complete', () => {
      const reasoning = 'Short reasoning';
      const span = createSpan({
        reasoning,
        reasoningFullLength: reasoning.length,
      });
      const { lastFrame } = render(<SpanNode span={span} expanded={true} />);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('Short reasoning');
      expect(frame).not.toContain('chars total');
    });

    it('does not show reasoning in collapsed view', () => {
      const span = createSpan({
        reasoning: 'Hidden reasoning content',
        reasoningFullLength: 24,
      });
      const { lastFrame } = render(<SpanNode span={span} expanded={false} />);
      const frame = lastFrame() ?? '';
      expect(frame).not.toContain('Hidden reasoning content');
    });

    it('does not render reasoning section when reasoning is empty', () => {
      const span = createSpan({
        reasoning: '',
        reasoningFullLength: 0,
      });
      const { lastFrame } = render(<SpanNode span={span} expanded={true} />);
      const frame = lastFrame() ?? '';
      // Should not have the reasoning wrapper structure
      expect(frame).not.toContain('chars total');
    });

    it('does not render reasoning section when reasoning is undefined', () => {
      const span = createSpan({
        // No reasoning field
      });
      const { lastFrame } = render(<SpanNode span={span} expanded={true} />);
      const frame = lastFrame() ?? '';
      // Should only show the span header without reasoning content
      expect(frame).toContain('Span 1');
    });
  });
});
