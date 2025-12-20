# System Prompts Guide

This guide covers customizing the agent's system prompt.

---

## Overview

The system prompt defines the agent's behavior, personality, and capabilities. The framework supports a flexible three-tier loading system with placeholder substitution.

---

## Prompt Loading Priority

Prompts are loaded with the following priority (first found wins):

1. **Config override**: `config.agent.systemPromptFile`
2. **User default**: `~/.agent/system.md`
3. **Package default**: Built-in prompt bundled with the framework

---

## Creating a Custom Prompt

### User Default Location

Create a file at `~/.agent/system.md`:

```markdown
---
title: My Custom Agent
version: 1.0
---

You are a specialized assistant for software development.

Using model: {{MODEL}} via {{PROVIDER}}

Guidelines:
- Focus on TypeScript and JavaScript
- Prefer concise, actionable responses
- Use available tools proactively
```

### Config Override

Set a specific path in your configuration file (`~/.agent/config.yaml` or `./config.yaml`):

```yaml
agent:
  systemPromptFile: /path/to/my-prompt.md
```

---

## Available Placeholders

Use `{{PLACEHOLDER}}` syntax for dynamic values:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{MODEL}}` | Current LLM model name | `gpt-4o` |
| `{{PROVIDER}}` | Current provider name | `openai` |
| `{{DATA_DIR}}` | Agent data directory | `~/.agent-data` |
| `{{MEMORY_ENABLED}}` | Memory feature status | `enabled` or `disabled` |

### Example Usage

```markdown
You are an AI assistant using {{MODEL}} from {{PROVIDER}}.

Current configuration:
- Data storage: {{DATA_DIR}}
- Memory: {{MEMORY_ENABLED}}
```

After replacement:

```markdown
You are an AI assistant using gpt-4o from openai.

Current configuration:
- Data storage: ~/.agent-data
- Memory: enabled
```

---

## YAML Front Matter

Prompts can include YAML front matter for metadata. The front matter is automatically stripped before use:

```markdown
---
title: Development Assistant
author: Your Name
version: 2.0
tags:
  - development
  - typescript
---

You are a development assistant...
```

The content after `---` delimiter becomes the actual system prompt.

---

## Skills Integration

When skills are enabled, the framework appends skill documentation to the system prompt:

```typescript
const { prompt, skills } = await loadSystemPromptWithSkills({
  config,
  model: 'gpt-4o',
  provider: 'openai',
  includeSkills: true,
});

console.log(`Loaded ${skills.length} skills`);
```

The resulting prompt structure:

```
[Base system prompt]

<skills>
  [Skill documentation XML]
</skills>
```

---

## Best Practices

### Keep It Concise

System prompts consume context tokens. Be direct and avoid redundancy.

```markdown
# Good
You are a TypeScript development assistant. Use tools to help with coding tasks.

# Avoid
You are a very helpful and knowledgeable TypeScript development assistant
who is always ready to help with any coding tasks. You have access to
various tools that you can use to assist with different types of work...
```

### Use Placeholders

Dynamic content should use placeholders rather than hardcoded values:

```markdown
# Good
Model: {{MODEL}}

# Avoid
Model: gpt-4o
```

### Structure with Headings

For longer prompts, use markdown structure:

```markdown
# Role
You are a development assistant.

# Capabilities
- Code analysis
- Testing
- Documentation

# Guidelines
- Be concise
- Explain reasoning
```

---

## API Reference

### loadSystemPrompt(options)

Load a system prompt with placeholder replacement.

```typescript
const prompt = await loadSystemPrompt({
  config: appConfig,
  model: 'gpt-4o',
  provider: 'openai',
});
```

**Parameters:**
- `config` - Application configuration
- `model` - LLM model name
- `provider` - Provider name

**Returns:** `Promise<string>` - Processed system prompt with placeholders replaced

### loadSystemPromptWithSkills(options)

Load a system prompt with skill discovery and integration.

```typescript
const { prompt, skills } = await loadSystemPromptWithSkills({
  config: appConfig,
  model: 'gpt-4o',
  provider: 'openai',
  includeSkills: true,
});
```

**Parameters:**
- `config` - Application configuration
- `model` - LLM model name
- `provider` - Provider name
- `includeSkills` - Whether to append skill documentation

**Returns:** `Promise<{ prompt: string; skills: Skill[] }>` - Prompt with skills and skill list

### replacePlaceholders(content, values)

Manually replace placeholders in text.

```typescript
const result = replacePlaceholders('Hello, {{NAME}}!', { NAME: 'World' });
// Result: 'Hello, World!'
```

**Parameters:**
- `content` - Text containing `{{PLACEHOLDER}}` syntax
- `values` - Object mapping placeholder names to replacement values

**Returns:** `string` - Content with placeholders replaced

### stripYamlFrontMatter(content)

Remove YAML front matter from markdown content.

```typescript
const content = stripYamlFrontMatter(`---
title: Test
---
Content here`);
// Result: 'Content here'
```

**Parameters:**
- `content` - Markdown content with optional YAML front matter

**Returns:** `string` - Content with front matter removed
