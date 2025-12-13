/**
 * Test helpers for telemetry span validation.
 * Provides utilities for capturing and inspecting spans in tests.
 */

import { InMemorySpanExporter, ReadableSpan } from '@opentelemetry/sdk-trace-base';
import type { Attributes } from '@opentelemetry/api';
import { initializeTelemetry, shutdown } from '../index.js';
import type { TelemetryConfig } from '../../config/schema.js';

// -----------------------------------------------------------------------------
// Test Helper Types
// -----------------------------------------------------------------------------

/**
 * Helper for capturing and inspecting spans in tests.
 */
export interface SpanCapture {
  /** The in-memory exporter */
  exporter: InMemorySpanExporter;
  /** Get all captured spans */
  getSpans: () => ReadableSpan[];
  /** Get the first span (throws if none) */
  getFirstSpan: () => ReadableSpan;
  /** Get spans by name pattern */
  getSpansByName: (pattern: string | RegExp) => ReadableSpan[];
  /** Get a span's attributes */
  getAttributes: (span: ReadableSpan) => Attributes;
  /** Get a specific attribute value from a span */
  getAttribute: (span: ReadableSpan, key: string) => unknown;
  /** Clear captured spans */
  reset: () => void;
  /** Shutdown and cleanup */
  shutdown: () => Promise<void>;
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Create a test config with defaults.
 */
export function createTestConfig(overrides: Partial<TelemetryConfig> = {}): TelemetryConfig {
  return {
    enabled: true,
    enableSensitiveData: false,
    otlpEndpoint: undefined,
    applicationinsightsConnectionString: undefined,
    ...overrides,
  };
}

/**
 * Initialize telemetry with an in-memory exporter for testing.
 * Returns helpers for capturing and inspecting spans.
 *
 * NOTE: Always call `await capture.shutdown()` in afterEach to ensure proper cleanup.
 *
 * @example
 * ```typescript
 * const capture = await initializeTestTelemetry();
 *
 * const span = startLLMSpan({ providerName: 'openai', modelName: 'gpt-4o' });
 * span.end();
 *
 * const spans = capture.getSpans();
 * expect(spans).toHaveLength(1);
 * expect(capture.getAttribute(spans[0], 'gen_ai.provider.name')).toBe('openai');
 *
 * await capture.shutdown();
 * ```
 */
export async function initializeTestTelemetry(
  configOverrides: Partial<TelemetryConfig> = {}
): Promise<SpanCapture> {
  // Always shutdown first to ensure clean state
  await shutdown();

  const exporter = new InMemorySpanExporter();

  await initializeTelemetry({
    config: createTestConfig({ enabled: true, ...configOverrides }),
    customExporter: exporter,
    serviceName: 'test-service',
  });

  return {
    exporter,

    getSpans(): ReadableSpan[] {
      return exporter.getFinishedSpans();
    },

    getFirstSpan(): ReadableSpan {
      const spans = exporter.getFinishedSpans();
      const first = spans[0];
      if (first === undefined) {
        throw new Error('No spans captured');
      }
      return first;
    },

    getSpansByName(pattern: string | RegExp): ReadableSpan[] {
      const spans = exporter.getFinishedSpans();
      if (typeof pattern === 'string') {
        return spans.filter((span) => span.name.includes(pattern));
      }
      return spans.filter((span) => pattern.test(span.name));
    },

    getAttributes(span: ReadableSpan): Attributes {
      return span.attributes;
    },

    getAttribute(span: ReadableSpan, key: string): unknown {
      return span.attributes[key];
    },

    reset(): void {
      exporter.reset();
    },

    async shutdown(): Promise<void> {
      await shutdown();
    },
  };
}

/**
 * Find a span by name from a list of spans.
 */
export function findSpanByName(spans: ReadableSpan[], name: string): ReadableSpan | undefined {
  return spans.find((span) => span.name === name);
}

/**
 * Find spans containing a name pattern.
 */
export function findSpansContaining(spans: ReadableSpan[], pattern: string): ReadableSpan[] {
  return spans.filter((span) => span.name.includes(pattern));
}

/**
 * Assert a span has expected attributes.
 */
export function assertSpanAttributes(span: ReadableSpan, expected: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(expected)) {
    const actual = span.attributes[key];
    if (actual !== value) {
      throw new Error(
        `Span "${span.name}" attribute "${key}": expected ${JSON.stringify(value)}, got ${JSON.stringify(actual)}`
      );
    }
  }
}
