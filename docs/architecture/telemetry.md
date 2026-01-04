# Telemetry Architecture

> **Status:** Current
> **Source of truth:** [`src/telemetry/setup.ts`](../../src/telemetry/setup.ts), [`src/config/schema.ts`](../../src/config/schema.ts)

This document describes the OpenTelemetry integration for observability.

---

## Overview

The telemetry system provides:

- **OpenTelemetry SDK** for tracing
- **GenAI semantic conventions** for LLM operations
- **OTLP export** to various backends (HTTP/gRPC auto-detection)
- **Opt-in activation** with graceful no-op degradation

---

## Span Hierarchy

```
agent.run (root span)
├── gen_ai.chat (LLM call)
│   ├── gen_ai.provider.name: "openai"
│   ├── gen_ai.request.model: "gpt-4o"
│   ├── gen_ai.usage.input_tokens: 150
│   └── gen_ai.usage.output_tokens: 50
│
├── tool.execute (tool call)
│   ├── tool.name: "read_file"
│   ├── tool.result.success: true
│   └── duration_ms: 23
│
└── gen_ai.chat (final response)
    └── ...
```

---

## Integration Points

```
AgentCallbacks
     │
     ├─► onLLMStart   ──► startLLMSpan()
     ├─► onLLMEnd     ──► recordTokenUsage(), span.end()
     ├─► onToolStart  ──► startToolSpan()
     └─► onToolEnd    ──► recordToolResult(), span.end()
```

---

## GenAI Semantic Conventions

Standard attributes for LLM operations:

| Attribute | Description |
|-----------|-------------|
| `gen_ai.system` | AI system (e.g., "openai") |
| `gen_ai.request.model` | Model identifier |
| `gen_ai.request.max_tokens` | Max tokens requested |
| `gen_ai.request.temperature` | Temperature setting |
| `gen_ai.usage.input_tokens` | Prompt tokens |
| `gen_ai.usage.output_tokens` | Completion tokens |
| `gen_ai.response.finish_reasons` | Why generation stopped |

---

## Configuration

```typescript
{
  telemetry: {
    enabled: boolean,                              // Default: false
    enableSensitiveData: boolean,                  // Default: false
    otlpEndpoint?: string,                         // OTLP endpoint URL
    applicationinsightsConnectionString?: string   // Azure App Insights
  }
}
```

### Environment Variables

| Variable | Config Path | Notes |
|----------|-------------|-------|
| `ENABLE_OTEL` | `telemetry.enabled` | Boolean coercion |
| `OTLP_ENDPOINT` | `telemetry.otlpEndpoint` | OTLP collector URL |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | `telemetry.applicationinsightsConnectionString` | Azure connection string |

### Sensitive Data

When `enableSensitiveData: false` (default):
- Prompt content is NOT logged
- Response content is NOT logged
- Only metadata and token counts are recorded

When `enableSensitiveData: true`:
- Full prompts and responses are logged
- Use only in development/debugging

---

## Endpoint Auto-Detection

The telemetry setup auto-detects the OTLP protocol:

1. If `otlpEndpoint` contains `:4317` or `:4318/v1/traces` → Use HTTP exporter
2. If `otlpEndpoint` contains `:4317` without `/v1/traces` → Use gRPC exporter
3. Otherwise → Use HTTP exporter as default

```typescript
// Examples
otlpEndpoint: "http://localhost:4317"           // gRPC
otlpEndpoint: "http://localhost:4318/v1/traces" // HTTP
```

---

## No-Op Behavior

When telemetry is disabled (`enabled: false`) or configuration is missing:

- No-op span implementations used
- Zero performance overhead
- Agent continues normally
- All telemetry calls become no-ops

```typescript
// In setup.ts
if (!config.telemetry.enabled) {
  return createNoopHelpers();
}
```

---

## OTLP Export

Telemetry exports to any OTLP-compatible backend:

| Backend | Use Case | Endpoint Example |
|---------|----------|------------------|
| Aspire Dashboard | Local development | `http://localhost:4317` |
| Jaeger | Self-hosted tracing | `http://localhost:4317` |
| Grafana Tempo | Production tracing | `https://tempo.example.com:4317` |
| Azure Monitor | Azure deployments | Use connection string instead |

---

## Aspire Dashboard Integration

For local development with .NET Aspire:

```bash
# Start Aspire dashboard
docker run --rm -p 18888:18888 -p 4317:18889 \
  -d --name aspire-dashboard \
  mcr.microsoft.com/dotnet/aspire-dashboard:latest
```

Configure:

```yaml
telemetry:
  enabled: true
  otlpEndpoint: http://localhost:4317
```

View at: http://localhost:18888

---

## Azure Application Insights

For Azure deployments, use the connection string:

```yaml
telemetry:
  enabled: true
  applicationinsightsConnectionString: "InstrumentationKey=xxx;IngestionEndpoint=https://..."
```

When `applicationinsightsConnectionString` is provided, the telemetry system configures the Azure Monitor exporter.

---

## TelemetryHelpers Interface

```typescript
interface TelemetryHelpers {
  // Start LLM span with GenAI conventions
  startLLMSpan(
    model: string,
    provider: string,
    options?: { temperature?: number; maxTokens?: number }
  ): Span;

  // Record token usage on span
  recordTokenUsage(span: Span, usage: TokenUsage): void;

  // Start tool execution span
  startToolSpan(toolName: string): Span;

  // Record tool result on span
  recordToolResult(span: Span, success: boolean): void;

  // Get current trace context
  getContext(): SpanContext;
}
```

---

## SpanContext Propagation

All callbacks receive `SpanContext` for correlation:

```typescript
onLLMStart(ctx: SpanContext, model: string, messages: Message[]): void;
```

This enables:
- Distributed tracing across services
- Correlation of LLM calls with tool executions
- Parent-child span relationships

---

## Related Documentation

- [Core Interfaces](./core-interfaces.md) - Callback interface
- [Configuration](./configuration.md) - Telemetry settings
