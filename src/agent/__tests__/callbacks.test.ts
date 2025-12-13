/**
 * Unit tests for AgentCallbacks helpers.
 */

import { describe, it, expect } from '@jest/globals';
import { createSpanContext, createChildSpanContext } from '../callbacks.js';

describe('callbacks', () => {
  describe('createSpanContext', () => {
    it('creates a span context with trace and span IDs', () => {
      const ctx = createSpanContext();

      expect(ctx.traceId).toBeDefined();
      expect(ctx.spanId).toBeDefined();
      expect(ctx.parentSpanId).toBeUndefined();
    });

    it('generates 32-character trace ID (128-bit)', () => {
      const ctx = createSpanContext();
      expect(ctx.traceId).toHaveLength(32);
      expect(/^[0-9a-f]+$/.test(ctx.traceId)).toBe(true);
    });

    it('generates 16-character span ID (64-bit)', () => {
      const ctx = createSpanContext();
      expect(ctx.spanId).toHaveLength(16);
      expect(/^[0-9a-f]+$/.test(ctx.spanId)).toBe(true);
    });

    it('generates unique trace IDs', () => {
      const ctx1 = createSpanContext();
      const ctx2 = createSpanContext();

      expect(ctx1.traceId).not.toBe(ctx2.traceId);
    });

    it('generates unique span IDs', () => {
      const ctx1 = createSpanContext();
      const ctx2 = createSpanContext();

      expect(ctx1.spanId).not.toBe(ctx2.spanId);
    });
  });

  describe('createChildSpanContext', () => {
    it('preserves parent trace ID', () => {
      const parent = createSpanContext();
      const child = createChildSpanContext(parent);

      expect(child.traceId).toBe(parent.traceId);
    });

    it('generates new span ID', () => {
      const parent = createSpanContext();
      const child = createChildSpanContext(parent);

      expect(child.spanId).not.toBe(parent.spanId);
      expect(child.spanId).toHaveLength(16);
    });

    it('sets parent span ID reference', () => {
      const parent = createSpanContext();
      const child = createChildSpanContext(parent);

      expect(child.parentSpanId).toBe(parent.spanId);
    });

    it('creates grandchild context correctly', () => {
      const grandparent = createSpanContext();
      const parent = createChildSpanContext(grandparent);
      const child = createChildSpanContext(parent);

      // All share the same trace
      expect(child.traceId).toBe(grandparent.traceId);
      expect(parent.traceId).toBe(grandparent.traceId);

      // Each has unique span ID
      expect(child.spanId).not.toBe(parent.spanId);
      expect(parent.spanId).not.toBe(grandparent.spanId);

      // Parent relationships are correct
      expect(child.parentSpanId).toBe(parent.spanId);
      expect(parent.parentSpanId).toBe(grandparent.spanId);
      expect(grandparent.parentSpanId).toBeUndefined();
    });

    it('generates unique child span IDs for multiple children', () => {
      const parent = createSpanContext();
      const child1 = createChildSpanContext(parent);
      const child2 = createChildSpanContext(parent);
      const child3 = createChildSpanContext(parent);

      // All have same trace
      expect(child1.traceId).toBe(parent.traceId);
      expect(child2.traceId).toBe(parent.traceId);
      expect(child3.traceId).toBe(parent.traceId);

      // All have same parent
      expect(child1.parentSpanId).toBe(parent.spanId);
      expect(child2.parentSpanId).toBe(parent.spanId);
      expect(child3.parentSpanId).toBe(parent.spanId);

      // All have unique span IDs
      const spanIds = [child1.spanId, child2.spanId, child3.spanId];
      const uniqueSpanIds = new Set(spanIds);
      expect(uniqueSpanIds.size).toBe(3);
    });
  });
});
