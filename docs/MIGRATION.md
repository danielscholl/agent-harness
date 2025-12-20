# Migration Guide: Python to TypeScript

This guide helps you migrate from the Python `agent-base` implementation to the TypeScript `agent-base-v2`.

---

## Overview

The TypeScript rewrite maintains the same architectural concepts while improving type safety, performance, and developer experience.

| Python (agent-base) | TypeScript (agent-base-v2) |
|---------------------|---------------------------|
| Python 3.11+ | Bun 1.3.4+ / Node 24+ |
| Microsoft Agent Framework | LangChain.js |
| Pydantic | Zod |
| Rich + Typer CLI | React + Ink |
| EventBus pattern | Callback interface |
| pytest | Jest |

---

## Key Conceptual Changes

### 1. Event Handling: EventBus to Callbacks

**Python (EventBus pattern):**
```python
from agent import EventBus

# Subscribe to events
EventBus.subscribe("agent.start", lambda data: print(f"Started: {data}"))
EventBus.subscribe("llm.response", lambda data: print(f"LLM: {data}"))

# Events are published globally
agent.run("Hello")
```

**TypeScript (Callback interface):**
```typescript
const callbacks: AgentCallbacks = {
  onAgentStart: (ctx, query) => console.log(`Started: ${query}`),
  onLLMEnd: (ctx, response) => console.log(`LLM: ${response}`),
};

const agent = new Agent({ config, callbacks });
await agent.run("Hello");
```

**Why the change:** Callbacks provide type safety, better React integration, and explicit dependency injection.

### 2. Configuration

**Python (env + YAML):**
```python
# config.py
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
MODEL = os.getenv("MODEL", "gpt-4o")
```

**TypeScript (Zod schema):**
```typescript
import { getDefaultConfig, parseConfig } from './config/schema.js';

const config = getDefaultConfig();
config.providers.openai = { apiKey: process.env.OPENAI_API_KEY };
config.providers.default = 'openai';

// Or parse from YAML
const result = parseConfig(yamlContent);
if (result.success) {
  const config = result.data;
}
```

### 3. Tool Definition

**Python (Pydantic + decorator):**
```python
from pydantic import BaseModel
from agent.tools import tool

class WeatherInput(BaseModel):
    city: str
    units: str = "celsius"

@tool
def get_weather(input: WeatherInput) -> dict:
    """Get weather for a city."""
    return {"city": input.city, "temp": 22}
```

**TypeScript (Zod + createTool):**
```typescript
import { z } from 'zod';
import { createTool } from './tools/base.js';

const weatherSchema = z.object({
  city: z.string().describe('City name'),
  units: z.enum(['celsius', 'fahrenheit']).default('celsius'),
});

const weatherTool = createTool({
  name: 'get_weather',
  description: 'Get weather for a city',
  schema: weatherSchema,
  execute: async (input) => {
    const { city, units } = input as z.infer<typeof weatherSchema>;
    return {
      success: true,
      result: { city, temp: 22 },
      message: 'Weather retrieved',
    };
  },
});
```

### 4. Error Handling

**Python (exceptions):**
```python
try:
    result = tool.execute(args)
except ToolError as e:
    logger.error(f"Tool failed: {e}")
    raise
```

**TypeScript (structured responses):**
```typescript
const result = await tool.invoke(args);

if (result.success) {
  console.log(result.result);
} else {
  console.error(`Error: ${result.error} - ${result.message}`);
}
```

**Why the change:** Structured responses provide consistent error handling without exception chains.

---

## Component Mapping

### Agent

| Python | TypeScript | Notes |
|--------|------------|-------|
| `Agent()` | `new Agent({ config, callbacks })` | DI-based |
| `agent.run(query)` | `await agent.run(query)` | Async only |
| `agent.stream(query)` | `await agent.runStream(query)` | Returns generator |

### Tools

| Python | TypeScript | Notes |
|--------|------------|-------|
| `@tool` decorator | `createTool()` | Factory function |
| `ToolInput` (Pydantic) | Zod schema | Runtime validation |
| `raise ToolError` | `{ success: false, error: 'CODE', message: 'text' }` | Structured response |

### Configuration

| Python | TypeScript | Notes |
|--------|------------|-------|
| `config.yaml` | `AppConfigSchema` | Zod validation |
| `os.getenv()` | `process.env` + config | Type-safe |
| `settings.py` | `src/config/schema.ts` | Centralized |

### Memory

| Python | TypeScript | Notes |
|--------|------------|-------|
| `MemoryStore` | `config.memory` | Config-driven |
| `mem0` integration | `mem0` (planned) | Same backend |

### Skills

| Python | TypeScript | Notes |
|--------|------------|-------|
| `SKILL.yaml` | `SKILL.md` (YAML front matter) | Unified format |
| Plugin loading | `SkillLoader` | Dynamic discovery |

---

## Migration Steps

### Step 1: Environment Setup

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Clone TypeScript version
git clone https://github.com/danielscholl/agent-base-v2.git
cd agent-base-v2

# Install dependencies
bun install
```

### Step 2: Migrate Configuration

Convert your Python config to TypeScript:

```typescript
// Before: Python config.py
// PROVIDER = "openai"
// MODEL = "gpt-4o"

// After: TypeScript
const config = getDefaultConfig();
config.providers.default = 'openai';
config.providers.openai = {
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY,
};
```

### Step 3: Migrate Tools

For each Python tool, create a TypeScript equivalent:

```typescript
// 1. Define schema with Zod
const schema = z.object({
  // ... fields from Pydantic model
});

// 2. Create tool with createTool
const tool = createTool({
  name: 'tool_name',
  description: 'Tool description',
  schema,
  execute: async (input) => {
    // Convert Python logic to TypeScript
    return { success: true, result: data, message: 'Done' };
  },
});
```

### Step 4: Migrate Event Handlers

Convert EventBus subscriptions to callbacks:

```typescript
// Before: Python EventBus
// EventBus.subscribe("agent.start", on_start)
// EventBus.subscribe("agent.end", on_end)

// After: TypeScript callbacks
const callbacks: AgentCallbacks = {
  onAgentStart: (ctx, query) => { /* on_start logic */ },
  onAgentEnd: (ctx, answer) => { /* on_end logic */ },
};
```

### Step 5: Migrate Skills

Update SKILL files to use YAML front matter in markdown:

```markdown
---
name: my_skill
version: 1.0.0
triggers:
  - keywords: ["example"]
---

# My Skill

Skill instructions here...
```

### Step 6: Update Tests

Convert pytest tests to Jest:

```typescript
// Before: pytest
// def test_tool():
//     result = tool.execute({"arg": "value"})
//     assert result["success"]

// After: Jest
describe('tool', () => {
  it('executes successfully', async () => {
    const result = await tool.invoke({ arg: 'value' });
    expect(result.success).toBe(true);
  });
});
```

---

## Common Patterns

### Async Handling

Python's sync/async hybrid becomes consistently async:

```typescript
// All agent operations are async
const answer = await agent.run(query);
const stream = await agent.runStream(query);

// Tool execution is async
const result = await tool.invoke(args);
```

### Type Safety

Use Zod for runtime validation with type inference:

```typescript
const schema = z.object({
  name: z.string(),
  age: z.number().optional(),
});

type Input = z.infer<typeof schema>;
// Input = { name: string; age?: number }
```

### Error Codes

Standard error codes replace custom exceptions:

| Python Exception | TypeScript Code |
|------------------|-----------------|
| `ValidationError` | `VALIDATION_ERROR` |
| `IOError` | `IO_ERROR` |
| `PermissionError` | `PERMISSION_DENIED` |
| `RateLimitError` | `RATE_LIMITED` |
| `NotFoundError` | `NOT_FOUND` |

---

## Feature Parity

| Feature | Python | TypeScript | Notes |
|---------|--------|------------|-------|
| Multi-provider LLM | Yes | Yes | Same providers |
| Tool execution | Yes | Yes | Structured responses |
| Memory | Yes | Partial | Local memory done |
| Skills | Yes | Yes | SKILL.md format |
| Telemetry | Partial | Yes | Full OTel support |
| Session persistence | Yes | Yes | Save/restore |
| CLI interface | Rich+Typer | React+Ink | Better UI |

---

## Getting Help

- [Architecture Docs](architecture.md)
- [Testing Guide](guides/testing.md)
- [GitHub Issues](https://github.com/danielscholl/agent-base-v2/issues)
